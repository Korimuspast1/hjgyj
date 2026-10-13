/**
 * Terrain physics: gravity for sand, dirt and food; angle-of-repose sliding;
 * water flow; and cave-ins for unsupported sand.
 *
 * Operates in place on World arrays. Anything that touches a living entity
 * is reported through `hooks`, so this module does not know about ants:
 *   hooks.occupiedAt(i) -> boolean     an entity stands on cell i
 *   hooks.onCrush(i)                   sand landed on the entity at i
 *   hooks.onDrown(i)                   water reached the entity at i
 *   hooks.onCollapse(x, y)             a cave-in happened at (x, y)
 */
import { CELL, DISPLACEABLE, WATER_FLOW, SOLID } from './world.js';
import {
  CAVE_IN_CHECK_EVERY,
  CAVE_IN_DELAY,
  CAVE_IN_MAX_PER_CHECK,
  SUPPORT_MIN,
} from './config.js';

/**
 * One physics step. Order: loose material, water, then cave-ins.
 * @param {import('./world.js').World} world
 * @param {import('./utils.js').Random} rng
 * @param {object} hooks see module header
 * @param {number} tick current simulation tick
 */
export function stepPhysics(world, rng, hooks, tick) {
  stepLooseMaterial(world, rng, hooks);
  stepWater(world, rng, hooks, tick);
  if (tick % CAVE_IN_CHECK_EVERY === 0) stepCaveIns(world, rng, hooks);
}

/** Ant-made empty space that loose soil must not slide into. */
const VOID = Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);

/** Whether a grain may move into a cell of type t (food and water rules differ). */
function fallable(t, soil) {
  return DISPLACEABLE[t] === 1 && !(soil && VOID[t]);
}

/**
 * Sand and dirt fall into empty space and slide diagonally when both the side
 * and the diagonal cell are free. That slope limit is the "angle of repose".
 * Food only falls. Rows are scanned bottom-up, so a grain moves at most once per tick.
 */
function stepLooseMaterial(world, rng, hooks) {
  const { width: W, height: H, type } = world;
  for (let y = H - 2; y >= 1; y--) {
    const leftFirst = rng.chance(0.5);
    for (let k = 1; k <= W - 2; k++) {
      const x = leftFirst ? k : W - 1 - k;
      const i = y * W + x;
      const t = type[i];
      if (t !== CELL.SAND && t !== CELL.DIRT && t !== CELL.FOOD) continue;
      const below = i + W;
      // Sand and dirt do not fall into ant-made voids: the ceiling of a chamber is
      // held up by its neighbours. Only cave-ins (below) can drop it into a void.
      const soil = t !== CELL.FOOD;
      if (DISPLACEABLE[type[below]] && !(soil && VOID[type[below]])) {
        moveLoose(world, i, below, hooks);
        continue;
      }
      if (!soil) continue;
      // Cheap test first: most grains are buried and never draw a random number.
      const leftOk = fallable(type[i - 1], soil) && fallable(type[below - 1], soil);
      const rightOk = fallable(type[i + 1], soil) && fallable(type[below + 1], soil);
      if (!leftOk && !rightOk) continue;
      const dir = leftOk && rightOk ? (rng.chance(0.5) ? 1 : -1) : rightOk ? 1 : -1;
      moveLoose(world, i, below + dir, hooks);
    }
  }
}

/** Moves a loose cell from src to dst. Displaced water rises into src; displaced air/tunnels vanish. */
function moveLoose(world, src, dst, hooks) {
  if (hooks.occupiedAt(dst)) hooks.onCrush(dst);
  const { type, density, subtype, moisture, stress } = world;
  const displacedType = type[dst];
  const displacedDensity = density[dst];
  type[dst] = type[src];
  density[dst] = density[src];
  subtype[dst] = subtype[src];
  moisture[dst] = moisture[src];
  stress[dst] = 0;
  if (displacedType === CELL.WATER) {
    type[src] = CELL.WATER;
    density[src] = displacedDensity;
  } else {
    type[src] = CELL.EMPTY;
    density[src] = 0;
  }
  subtype[src] = 0;
  moisture[src] = 0;
  stress[src] = 0;
}

/**
 * Water falls into open space, otherwise spreads sideways. Each water cell
 * moves at most once per tick (waterStamp), and it keeps neighbouring soil wet.
 */
function stepWater(world, rng, hooks, tick) {
  const { width: W, height: H, type, moisture, waterStamp } = world;
  for (let y = H - 2; y >= 1; y--) {
    const dir = rng.chance(0.5) ? 1 : -1;
    for (let k = 1; k <= W - 2; k++) {
      const x = dir > 0 ? k : W - 1 - k;
      const i = y * W + x;
      if (type[i] !== CELL.WATER || waterStamp[i] === tick) continue;

      // Wet the soil next to the water.
      const neighbours = [i - 1, i + 1, i - W, i + W];
      for (const n of neighbours) {
        const t = type[n];
        if ((t === CELL.SAND || t === CELL.DIRT) && moisture[n] < 255) {
          moisture[n] = Math.min(255, moisture[n] + 2);
        }
      }

      const below = i + W;
      if (WATER_FLOW[type[below]]) {
        moveWater(world, i, below, hooks, tick);
        continue;
      }
      const side = rng.chance(0.5) ? 1 : -1;
      if (WATER_FLOW[type[i + side]]) moveWater(world, i, i + side, hooks, tick);
      else if (WATER_FLOW[type[i - side]]) moveWater(world, i, i - side, hooks, tick);
    }
  }
}

function moveWater(world, src, dst, hooks, tick) {
  if (hooks.occupiedAt(dst)) hooks.onDrown(dst);
  world.type[dst] = CELL.WATER;
  world.density[dst] = 255;
  world.subtype[dst] = 0;
  world.stress[dst] = 0;
  world.waterStamp[dst] = tick;
  world.type[src] = CELL.EMPTY;
  world.density[src] = 0;
}

/**
 * Sand with too few solid neighbours is unstable. Stress builds up each
 * check and, after CAVE_IN_DELAY, the grain drops into the nearest free cell.
 */
export function stepCaveIns(world, rng, hooks) {
  const { width: W, height: H, type, stress } = world;
  // Offsets of the 8 neighbours. The loop only visits interior cells, so no bounds checks are needed.
  const offs = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1];
  let collapses = 0;
  for (let y = 1; y <= H - 2; y++) {
    for (let x = 1; x <= W - 2; x++) {
      const i = y * W + x;
      const t = type[i];
      if (t !== CELL.SAND && t !== CELL.DIRT) continue;
      let solid = 0;
      for (let k = 0; k < 8; k++) solid += SOLID[type[i + offs[k]]];
      if (solid >= SUPPORT_MIN) {
        if (stress[i] > 0) stress[i]--;
        continue;
      }
      if (stress[i] < 255) stress[i]++;
      if (stress[i] <= CAVE_IN_DELAY + rng.int(6) || collapses >= CAVE_IN_MAX_PER_CHECK) continue;
      const targets = [i + W, i + W - 1, i + W + 1, i - 1, i + 1];
      for (const dst of targets) {
        if (!DISPLACEABLE[type[dst]]) continue;
        moveLoose(world, i, dst, hooks);
        hooks.onCollapse(x, y);
        collapses++;
        break;
      }
    }
  }
}
