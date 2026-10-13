/**
 * Movement primitives shared by ants and enemies.
 *
 * Entities accumulate `moveCredit` every tick (their speed) and may move only
 * when credit >= 1, so speed is a fraction of a cell per tick. Movement goes
 * through walkTo (A* with budget + greedy fallback), followGradient
 * (pheromone sensing), wanderStep (persistent heading) and stepAway (flee).
 */
import { SOLID } from './world.js';
import { DX, DY, chebyshev } from './utils.js';
import { PATH_RETRY_TICKS } from './config.js';

/**
 * Moves an entity one cell. Updates facing and the walk-cycle frame and spends
 * one unit of move credit.
 */
export function moveEntity(entity, x, y) {
  const dx = x - entity.x;
  if (dx !== 0) entity.facing = dx > 0 ? 1 : -1;
  entity.prevX = entity.x;
  entity.prevY = entity.y;
  entity.x = x;
  entity.y = y;
  entity.animFrame ^= 1;
  entity.moveCredit -= 1;
}

/**
 * Whether a single step (including diagonals) from (fx,fy) to (tx,ty) is legal.
 * Diagonals may not cut solid corners.
 */
export function canStepTo(world, fx, fy, tx, ty) {
  const dx = tx - fx;
  const dy = ty - fy;
  if (Math.abs(dx) > 1 || Math.abs(dy) > 1 || (dx === 0 && dy === 0)) return false;
  if (!world.canAntEnter(tx, ty)) return false;
  if (dx !== 0 && dy !== 0 && (SOLID[world.typeAt(fx + dx, fy)] || SOLID[world.typeAt(fx, fy + dy)])) {
    return false;
  }
  return true;
}

/**
 * Walks toward a goal cell. Uses a cached A* path when available, plans a new
 * path when the goal changes (subject to the per-tick budget), and falls back
 * to greedy steps when no path is available.
 * @returns {'arrived'|'moving'|'blocked'}
 */
export function walkTo(entity, game, goalX, goalY, radius = 0) {
  if (chebyshev(entity.x, entity.y, goalX, goalY) <= radius) {
    entity.path = null;
    return 'arrived';
  }
  if (entity.moveCredit < 1) return 'moving';

  const world = game.world;
  const needsPath =
    !entity.path ||
    entity.pathGoalX !== goalX ||
    entity.pathGoalY !== goalY ||
    entity.pathPos >= entity.path.length;

  if (needsPath && game.pathBudget > 0 && game.tick >= entity.pathRetryTick) {
    game.pathBudget--;
    const path = game.pathfinder.find(entity.x, entity.y, goalX, goalY, { radius });
    entity.pathGoalX = goalX;
    entity.pathGoalY = goalY;
    entity.pathPos = 0;
    if (path) {
      entity.path = path;
    } else {
      entity.path = null;
      entity.pathRetryTick = game.tick + PATH_RETRY_TICKS;
    }
  }

  if (entity.path && entity.pathPos < entity.path.length) {
    const next = entity.path[entity.pathPos];
    const nx = world.xOf(next);
    const ny = world.yOf(next);
    if (canStepTo(world, entity.x, entity.y, nx, ny)) {
      moveEntity(entity, nx, ny);
      entity.pathPos++;
      entity.stuckTicks = 0;
      return chebyshev(entity.x, entity.y, goalX, goalY) <= radius ? 'arrived' : 'moving';
    }
    entity.path = null; // the world changed under us: replan next time
  }

  if (greedyStep(entity, game, goalX, goalY)) {
    entity.stuckTicks = 0;
    return chebyshev(entity.x, entity.y, goalX, goalY) <= radius ? 'arrived' : 'moving';
  }
  entity.stuckTicks++;
  return 'blocked';
}

/** Steps to the legal neighbour closest to (gx,gy). Noise prevents perfect oscillation. */
export function greedyStep(entity, game, gx, gy) {
  if (entity.moveCredit < 1) return false;
  const world = game.world;
  let best = null;
  let bestDist = Infinity;
  for (let d = 0; d < 8; d++) {
    const nx = entity.x + DX[d];
    const ny = entity.y + DY[d];
    if (!canStepTo(world, entity.x, entity.y, nx, ny)) continue;
    const dist = (nx - gx) ** 2 + (ny - gy) ** 2 + game.rng.next() * 0.9;
    if (dist < bestDist) {
      bestDist = dist;
      best = [nx, ny];
    }
  }
  if (!best) return false;
  moveEntity(entity, best[0], best[1]);
  return true;
}

/**
 * Follows a pheromone field. 'max' climbs toward stronger scent (above a small
 * threshold); 'min' moves toward the weakest value (used by scouts).
 * @returns {boolean} whether the entity moved
 */
export function followGradient(entity, game, layer, mode = 'max') {
  if (entity.moveCredit < 1) return false;
  const world = game.world;
  const field = game.pheromones.layers[layer];
  let best = null;
  let bestValue = mode === 'max' ? 0.5 : Infinity;
  for (let d = 0; d < 8; d++) {
    const nx = entity.x + DX[d];
    const ny = entity.y + DY[d];
    if (!canStepTo(world, entity.x, entity.y, nx, ny)) continue;
    const value = field[ny * world.width + nx] + game.rng.next() * 0.02;
    if (mode === 'max' ? value > bestValue : value < bestValue) {
      bestValue = value;
      best = [nx, ny];
    }
  }
  if (!best) return false;
  moveEntity(entity, best[0], best[1]);
  return true;
}

/**
 * Random walk that keeps its heading most of the time, so wandering looks
 * purposeful rather than jittery.
 * @returns {boolean} whether the entity moved
 */
export function wanderStep(entity, game) {
  if (entity.moveCredit < 1) return false;
  const world = game.world;
  const options = [];
  for (let d = 0; d < 8; d++) {
    if (canStepTo(world, entity.x, entity.y, entity.x + DX[d], entity.y + DY[d])) options.push(d);
  }
  if (options.length === 0) return false;
  const rng = game.rng;
  const pick = options.includes(entity.heading) && rng.chance(0.75) ? entity.heading : rng.pick(options);
  entity.heading = pick;
  moveEntity(entity, entity.x + DX[pick], entity.y + DY[pick]);
  return true;
}

/** Steps to the legal neighbour that maximises distance from (tx,ty). */
export function stepAway(entity, game, tx, ty) {
  if (entity.moveCredit < 1) return false;
  const world = game.world;
  let best = null;
  let bestDist = -1;
  for (let d = 0; d < 8; d++) {
    const nx = entity.x + DX[d];
    const ny = entity.y + DY[d];
    if (!canStepTo(world, entity.x, entity.y, nx, ny)) continue;
    const dist = (nx - tx) ** 2 + (ny - ty) ** 2 + game.rng.next() * 0.5;
    if (dist > bestDist) {
      bestDist = dist;
      best = [nx, ny];
    }
  }
  if (!best) return false;
  moveEntity(entity, best[0], best[1]);
  return true;
}
