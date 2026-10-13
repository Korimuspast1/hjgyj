/**
 * Ant AI: utility-based decisions plus per-task execution.
 *
 * Every 3-5 ticks an ant scores its options. The score depends on its role,
 * needs (hunger, thirst, energy), what it carries, and what it senses. The
 * best option wins, with three things that make behaviour feel alive:
 *   - inertia: the current task gets a small bonus, so ants don't flip-flop;
 *   - noise: small random jitter, so choices sometimes change;
 *   - hesitation: idle is an option, and idle ants sometimes wander a bit.
 * Adjacent enemies force an immediate re-decision (fight or flee).
 */
import { CELL, DIGGABLE_TIME, FOOD_KIND, SOLID } from './world.js';
import { ROLE } from './ant.js';
import { LAYER } from './pheromones.js';
import { walkTo, wanderStep, followGradient, stepAway } from './movement.js';
import { chebyshev, manhattan, DX, DY } from './utils.js';
import { NEST_RADIUS, HUNGER_RATE, THIRST_RATE, SURFACE_Y, LARVA_FEEDINGS } from './config.js';

/** Per-role multipliers on option scores. Missing keys count as 1. */
const ROLE_WEIGHTS = Object.freeze({
  worker: {},
  digger: { dig: 1.6, build: 0.8 },
  forager: { forage: 1.7, deposit: 1.2 },
  nurse: { nurse: 1.8, eat: 1.2 },
  soldier: { hunt: 1.8, fight: 1.4, flee: 0.7, forage: 0.6, dig: 0.4 },
  builder: { build: 1.8, dig: 0.8 },
  scout: { scout: 2.5, forage: 0.7 },
  undertaker: { collect: 1.8, dispose: 1.2 },
  queen: {},
});

const INERTIA = 0.08;
const NOISE = 0.03;
const BAD_TARGET_TICKS = 300;
const FLEE_DANGER = 20;

/**
 * Advances one ant by one tick: needs, decision (when due), action, pheromones.
 * @param {import('./ant.js').Ant} ant
 * @param {import('./game.js').Game} game
 */
export function updateAnt(ant, game) {
  if (!ant.alive || ant.role === ROLE.QUEEN) return;
  ant.moveCredit = Math.min(1, ant.moveCredit + ant.speed * (ant.carrying ? 0.7 : 1));
  tickNeeds(ant, game);
  if (!ant.alive) return;

  if (ant.decisionTimer > 0) ant.decisionTimer--;
  const kind = ant.task.kind;
  const engaged = kind === 'fight' || kind === 'flee';
  const adjacentThreat = !engaged && game.nearestEnemy(ant, 1) !== null;
  if (ant.decisionTimer <= 0 || adjacentThreat) {
    decideTask(ant, game);
    ant.decisionTimer = 3 + game.rng.int(3);
  }

  runTask(ant, game);
  depositPheromones(ant, game);
  if (game.rng.chance(0.05)) antennate(ant, game);
}

/** Ages the ant, drains or refills needs, and handles starvation and old age. */
export function tickNeeds(ant, game) {
  ant.ageTicks++;
  if (ant.ageTicks > ant.lifespan) {
    game.killAnt(ant, 'old age');
    return;
  }
  ant.hunger = Math.min(100, ant.hunger + HUNGER_RATE);
  ant.thirst = Math.min(100, ant.thirst + THIRST_RATE);
  if (ant.task.kind === 'rest') {
    ant.energy = Math.min(100, ant.energy + 0.8);
  } else {
    ant.energy = Math.max(0, ant.energy - 0.01);
  }
  if (ant.hunger >= 100 || ant.thirst >= 100) {
    ant.hp -= 0.05;
  } else if (ant.hp < ant.maxHp) {
    ant.hp = Math.min(ant.maxHp, ant.hp + 0.01);
  }
  if (ant.hp <= 0) game.killAnt(ant, ant.hunger >= 100 ? 'starved' : 'injuries');
}

/**
 * Scores every option available right now and adopts the best one.
 * @param {import('./ant.js').Ant} ant
 * @param {import('./game.js').Game} game
 */
export function decideTask(ant, game) {
  const { world, rng } = game;
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;
  const carrying = ant.carrying;
  const weights = ROLE_WEIGHTS[ant.role] || {};
  const options = [];
  const offer = (kind, base, target = null) => {
    options.push({ kind, target, score: base * (weights[kind] ?? 1) + rng.range(-NOISE, NOISE) });
  };

  // Threats first.
  const adjacentEnemy = game.nearestEnemy(ant, 1);
  if (adjacentEnemy) {
    const target = { x: adjacentEnemy.x, y: adjacentEnemy.y, ref: adjacentEnemy };
    if (ant.hp < ant.maxHp * 0.35 && ant.role !== ROLE.SOLDIER) offer('flee', 0.95, target);
    offer('fight', ant.role === ROLE.SOLDIER ? 0.95 : ant.hp > ant.maxHp * 0.5 ? 0.6 : 0.3, target);
  } else {
    const threat = game.nearestEnemy(ant, ant.sight);
    if (threat && ant.role === ROLE.SOLDIER) {
      offer('hunt', colony && colony.alarm > 0 ? 0.95 : 0.7, { x: threat.x, y: threat.y, ref: threat });
    } else if (ant.role === ROLE.SOLDIER && colony && ant.memory.dangerTick > game.tick - 200) {
      offer('hunt', 0.45, { x: ant.memory.dangerX, y: ant.memory.dangerY, ref: null });
    }
  }
  const here = world.index(ant.x, ant.y);
  if (ant.role !== ROLE.SOLDIER && game.pheromones.get(LAYER.DANGER, here) > FLEE_DANGER) {
    offer('flee', 0.4);
  }

  // Carrying something: get it where it belongs.
  if (carrying === 'food' && nest) offer('deposit', 0.85, nest);
  if (carrying === 'sand') {
    const surface = findSurface(game, ant);
    if (surface) offer('dump', 0.6, surface);
  }
  if (carrying === 'corpse') {
    const surface = findSurface(game, ant);
    if (surface) offer('dispose', 0.7, surface);
  }
  if (carrying === 'egg' && nest) offer('nurse', 0.75, nest);

  // Needs.
  if (!carrying && nest && colony.foodStored >= 1 && ant.hunger > 40) {
    offer('eat', (ant.hunger / 100) * 1.1, nest);
  }
  if (ant.thirst > 30) {
    const water = findWater(game, ant);
    if (water) offer('drink', (ant.thirst / 100) * 1.05, water);
  }
  if (ant.energy < 35 && nest && !carrying) offer('rest', ((45 - ant.energy) / 45) * 0.9, nest);

  // Food.
  if (!carrying) {
    const food = findFood(game, ant, colony);
    // Hungry colonies push harder for food.
    const hunger = colony && colony.foodStored < 5 ? 0.25 : 0;
    if (food) offer('forage', 0.45 + hunger, food);
    else if (game.pheromones.get(LAYER.FOOD, here) > 1) offer('forage', 0.3 + hunger, null);
  }

  // Colony work.
  if (ant.role === ROLE.NURSE) {
    const brood = findNurseTarget(game, ant, colony);
    if (brood) offer('nurse', 0.5, { x: brood.x, y: brood.y, ref: brood });
  }
  if (!carrying) {
    if (!ant.digGoal) ant.digGoal = pickDigGoal(game, ant);
    const front = findDigFront(game, ant);
    if (front) offer('dig', 0.35, front);
  }
  if (carrying === 'sand') {
    const spot = findBuildSpot(game, ant);
    if (spot) offer('build', 0.55, spot);
  }
  if (!carrying) {
    const corpse = findCorpse(game, ant, colony);
    if (corpse) offer('collect', 0.4, corpse);
    // Hungry colonies send ants out to search when no food is in sight.
    offer('scout', 0.25 + (colony && colony.foodStored < 5 ? 0.3 : 0));
  }

  // Fallbacks.
  offer('wander', 0.12);
  offer('idle', 0.05);

  let best = null;
  let bestScore = -Infinity;
  for (const option of options) {
    const score = option.score + (option.kind === ant.task.kind ? INERTIA : 0);
    if (score > bestScore) {
      bestScore = score;
      best = option;
    }
  }
  setTask(ant, best.kind, best.target);
  ant.stuckTicks = 0;
  if (rng.chance(0.002)) pruneBadTargets(ant, game.tick);
}

function setTask(ant, kind, target = null) {
  ant.task = { kind, target, ref: target && target.ref ? target.ref : null, timer: 0 };
}

/** Dispatches the current task to its executor. */
function runTask(ant, game) {
  switch (ant.task.kind) {
    case 'forage': return forageStep(ant, game);
    case 'deposit': return depositStep(ant, game);
    case 'eat': return eatStep(ant, game);
    case 'drink': return drinkStep(ant, game);
    case 'rest': return restStep(ant, game);
    case 'dig': return digStep(ant, game);
    case 'dump':
    case 'dispose': return dumpStep(ant, game);
    case 'build': return buildStep(ant, game);
    case 'nurse': return nurseStep(ant, game);
    case 'collect': return collectStep(ant, game);
    case 'scout': return scoutStep(ant, game);
    case 'hunt': return huntStep(ant, game);
    case 'flee': return fleeStep(ant, game);
    case 'fight': return undefined;
    case 'wander': wanderStep(ant, game); return undefined;
    default: return idleStep(ant, game);
  }
}

function forageStep(ant, game) {
  const world = game.world;
  const target = ant.task.target;
  if (!target) {
    if (!followGradient(ant, game, LAYER.FOOD, 'max')) wanderStep(ant, game);
    return;
  }
  const i = world.index(target.x, target.y);
  if (world.type[i] !== CELL.FOOD || world.density[i] === 0) {
    setTask(ant, 'idle');
    return;
  }
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived') {
    world.density[i] -= 1;
    if (world.density[i] === 0) world.setIndex(i, CELL.EMPTY);
    ant.inventory = { kind: 'food', amount: 1 };
    ant.carryTicks = 0;
    const colony = game.colonyOf(ant);
    if (colony && world.type[i] === CELL.FOOD) colony.noteFood(i);
    setTask(ant, 'deposit');
  } else if (result === 'blocked' && ant.stuckTicks > 20) {
    markBad(ant, i, game.tick);
    setTask(ant, 'idle');
  }
}

function depositStep(ant, game) {
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;
  if (!nest || !ant.inventory) {
    setTask(ant, 'idle');
    return;
  }
  const result = walkTo(ant, game, nest.x, nest.y, NEST_RADIUS);
  if (result === 'arrived') {
    if (ant.inventory.kind === 'food') {
      colony.addFood(ant.inventory.amount);
      colony.stats.foodDelivered += ant.inventory.amount;
    }
    ant.inventory = null;
    ant.carryTicks = 0;
    setTask(ant, 'idle');
  } else if (result === 'blocked' && ant.stuckTicks > 25) {
    setTask(ant, 'idle');
  }
}

function eatStep(ant, game) {
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;
  if (!nest) return setTask(ant, 'idle');
  const result = walkTo(ant, game, nest.x, nest.y, NEST_RADIUS);
  if (result === 'arrived') {
    if (colony.takeFood(1)) ant.hunger = Math.max(0, ant.hunger - 50);
    setTask(ant, 'idle');
  } else if (result === 'blocked' && ant.stuckTicks > 25) {
    setTask(ant, 'idle');
  }
  return undefined;
}

function drinkStep(ant, game) {
  const target = ant.task.target;
  if (!target || game.world.type[game.world.index(target.x, target.y)] !== CELL.WATER) {
    return setTask(ant, 'idle');
  }
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived') {
    ant.thirst = Math.max(0, ant.thirst - 4);
    if (ant.thirst <= 0) setTask(ant, 'idle');
  } else if (result === 'blocked' && ant.stuckTicks > 20) {
    setTask(ant, 'idle');
  }
  return undefined;
}

function restStep(ant, game) {
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;
  if (!nest) return setTask(ant, 'idle');
  const result = walkTo(ant, game, nest.x, nest.y, NEST_RADIUS);
  if (result === 'arrived' && ant.energy >= 95) setTask(ant, 'idle');
  return undefined;
}

function idleStep(ant, game) {
  // Hesitation: most of the time stand still, sometimes shuffle a step.
  if (game.rng.chance(0.15)) wanderStep(ant, game);
}

function scoutStep(ant, game) {
  const world = game.world;
  game.pheromones.deposit(LAYER.EXPLORE, world.index(ant.x, ant.y), 6);
  let target = ant.task.target;
  if (!target || (ant.x === target.x && ant.y === target.y)) {
    target = pickExploreTarget(game, ant);
    ant.task.target = target;
  }
  if (!target) return setTask(ant, 'idle');
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived') {
    ant.task.target = null; // pick the next unexplored spot
  } else if (result === 'blocked') {
    ant.task.fails = (ant.task.fails || 0) + 1;
    ant.task.target = null;
    if (ant.task.fails >= 4) setTask(ant, 'idle');
  }
  const colony = game.colonyOf(ant);
  if (colony) {
    const found = scanForFood(world, ant.x, ant.y, 3);
    if (found >= 0) colony.noteFood(found);
  }
  return undefined;
}

/**
 * Samples passable cells near the scout and returns the one with the least
 * explore pheromone (ties broken randomly). Sampling avoids walking in circles.
 */
function pickExploreTarget(game, ant) {
  const world = game.world;
  const field = game.pheromones.layers[LAYER.EXPLORE];
  let best = null;
  let bestValue = Infinity;
  for (let k = 0; k < 12; k++) {
    const x = ant.x + game.rng.int(31) - 15;
    const y = ant.y + game.rng.int(31) - 15;
    if (!world.canAntEnter(x, y)) continue;
    const value = field[world.index(x, y)] + game.rng.next();
    if (value < bestValue) {
      bestValue = value;
      best = { x, y };
    }
  }
  return best;
}

/**
 * Digging: pick the diggable neighbour closest to the dig goal, spend
 * strength each tick until the cell gives way, then carry the sand out.
 */
function digStep(ant, game) {
  const world = game.world;
  if (!ant.digGoal || chebyshev(ant.x, ant.y, ant.digGoal.x, ant.digGoal.y) < 3) {
    ant.digGoal = pickDigGoal(game, ant);
  }
  ant.task.timer++;

  const target = adjacentDiggable(game, ant);
  if (target >= 0) {
    // Face the cell being dug and work the legs, so the digging ant looks busy.
    const tx = world.xOf(target);
    if (tx !== ant.x) ant.facing = tx > ant.x ? 1 : -1;
    if (game.tick % 3 === 0) ant.animFrame ^= 1;
    if (target !== ant.digTarget) {
      ant.digTarget = target;
      ant.digProgress = 0;
    }
    ant.digProgress += ant.strength;
    if (ant.digProgress >= DIGGABLE_TIME[world.type[target]]) {
      world.setIndex(target, CELL.TUNNEL);
      ant.inventory = { kind: 'sand', amount: 1 };
      ant.digProgress = 0;
      ant.digTarget = -1;
      game.stats.dug++;
      ant.decisionTimer = 0; // next tick: decide what to do with the sand
    }
    return;
  }

  ant.digProgress = 0;
  let front = ant.task.target;
  if (!front || !hasDiggableNeighbour(world, front.x, front.y)) {
    front = findDigFront(game, ant);
    if (!front) return setTask(ant, 'idle');
    ant.task.target = front;
  }
  const result = walkTo(ant, game, front.x, front.y, 0);
  if (result === 'blocked' && ant.stuckTicks > 15) {
    setTask(ant, 'idle');
  }
  return undefined;
}

/**
 * Walks to a surface spot and drops sand (or removes a corpse). If no room is
 * found after a few tries, the ant gives up the grain so it can dig or forage again.
 */
function dumpStep(ant, game) {
  const world = game.world;
  let target = ant.task.target;
  if (!target) target = findSurface(game, ant);
  if (!target) return setTask(ant, 'idle');
  ant.task.target = target;
  // Radius 1: a diagonal neighbour of the surface cell is close enough to drop from.
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived') {
    if (ant.carrying === 'corpse') {
      // Undertakers take corpses out of the box entirely.
      ant.inventory = null;
      return setTask(ant, 'idle');
    }
    const spot = findDropSpot(game, ant);
    if (spot) {
      world.setCell(spot.x, spot.y, CELL.SAND, 255);
      game.stats.filled++;
      ant.inventory = null;
      setTask(ant, 'idle');
      ant.decisionTimer = 0;
    } else {
      ant.task.fails = (ant.task.fails || 0) + 1;
      if (ant.task.fails >= 3) {
        ant.inventory = null; // no room anywhere near: let the grain go
        setTask(ant, 'idle');
      } else {
        ant.task.target = null; // pick another surface cell next tick
      }
    }
  } else if (result === 'blocked') {
    // Decisions reset stuckTicks, so count blocked attempts on the task itself.
    ant.task.fails = (ant.task.fails || 0) + 1;
    if (ant.task.fails >= 3) {
      ant.inventory = null;
      setTask(ant, 'idle');
    } else {
      ant.task.target = null;
    }
  }
  return undefined;
}

/** Fills a tunnel cell next to unstable sand with carried sand. */
function buildStep(ant, game) {
  const world = game.world;
  const target = ant.task.target;
  if (!target || world.type[world.index(target.x, target.y)] !== CELL.TUNNEL) {
    return setTask(ant, 'idle');
  }
  if (ant.x === target.x && ant.y === target.y) {
    wanderStep(ant, game); // never drop sand on our own cell
    return undefined;
  }
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived' && game.occupancy[world.index(target.x, target.y)] === 0) {
    world.setCell(target.x, target.y, CELL.SAND, 255);
    ant.inventory = null;
    setTask(ant, 'idle');
  } else if (result === 'blocked' && ant.stuckTicks > 15) {
    setTask(ant, 'idle');
  }
  return undefined;
}

/**
 * Nurse duties: carry misplaced eggs to the nest, feed hungry larvae
 * (fetching food from the store first), and never touch pupae.
 */
function nurseStep(ant, game) {
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;

  if (ant.carrying === 'egg') {
    const egg = ant.inventory.ref;
    if (!egg || !egg.alive || !nest) {
      ant.inventory = null;
      return setTask(ant, 'idle');
    }
    egg.x = ant.x;
    egg.y = ant.y;
    const result = walkTo(ant, game, nest.x, nest.y, NEST_RADIUS + 1);
    if (result === 'arrived') {
      egg.carried = false;
      ant.inventory = null;
      setTask(ant, 'idle');
    }
    return undefined;
  }

  const ref = ant.task.ref;
  if (!ref || !ref.alive) return setTask(ant, 'idle');

  if (ref.kind === 'egg') {
    const result = walkTo(ant, game, ref.x, ref.y, 1);
    if (result === 'arrived' && !ref.carried) {
      ref.carried = true;
      ant.inventory = { kind: 'egg', ref };
    }
    return undefined;
  }

  if (ref.kind === 'larva') {
    if (ant.carrying === 'food') {
      const result = walkTo(ant, game, ref.x, ref.y, 1);
      if (result === 'arrived') {
        ref.fed++;
        ref.hunger = Math.max(0, ref.hunger - 45);
        ant.inventory = null;
        setTask(ant, 'idle');
      }
      return undefined;
    }
    if (!nest || colony.foodStored < 1) return setTask(ant, 'idle');
    const result = walkTo(ant, game, nest.x, nest.y, NEST_RADIUS);
    if (result === 'arrived' && colony.takeFood(1)) {
      ant.inventory = { kind: 'food', amount: 1 };
    }
    return undefined;
  }
  return setTask(ant, 'idle');
}

/** Undertaker: picks up a corpse and carries it away from the nest. */
function collectStep(ant, game) {
  const world = game.world;
  const target = ant.task.target;
  if (!target) return setTask(ant, 'idle');
  const i = world.index(target.x, target.y);
  if (world.type[i] !== CELL.FOOD || world.subtype[i] !== FOOD_KIND.CORPSE || world.density[i] === 0) {
    return setTask(ant, 'idle');
  }
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'arrived') {
    world.density[i] -= 1;
    if (world.density[i] === 0) world.setIndex(i, CELL.EMPTY);
    ant.inventory = { kind: 'corpse', amount: 1 };
    setTask(ant, 'dispose');
  } else if (result === 'blocked' && ant.stuckTicks > 20) {
    markBad(ant, i, game.tick);
    setTask(ant, 'idle');
  }
  return undefined;
}

function huntStep(ant, game) {
  const target = ant.task.target;
  if (!target) return setTask(ant, 'idle');
  if (target.ref) {
    if (!target.ref.alive) return setTask(ant, 'idle');
    target.x = target.ref.x;
    target.y = target.ref.y;
  }
  const result = walkTo(ant, game, target.x, target.y, 1);
  if (result === 'blocked' && ant.stuckTicks > 10) setTask(ant, 'idle');
  return undefined;
}

function fleeStep(ant, game) {
  const target = ant.task.target;
  if (target && target.ref && target.ref.alive) {
    stepAway(ant, game, target.ref.x, target.ref.y);
  } else if (!followGradient(ant, game, LAYER.DANGER, 'min')) {
    wanderStep(ant, game);
  }
}

/** Lays scent: food trails from carriers (strongest near the source), home trails near the nest. */
function depositPheromones(ant, game) {
  const world = game.world;
  const i = world.index(ant.x, ant.y);
  const pheromones = game.pheromones;
  if (ant.carrying) ant.carryTicks++;
  if (ant.carrying === 'food') {
    pheromones.deposit(LAYER.FOOD, i, Math.max(3, 30 - ant.carryTicks * 0.15));
  }
  const colony = game.colonyOf(ant);
  if (colony && colony.nest && (ant.carrying === 'food' || ant.task.kind === 'deposit')) {
    const dist = chebyshev(ant.x, ant.y, colony.nest.x, colony.nest.y);
    if (dist > NEST_RADIUS) pheromones.deposit(LAYER.HOME, i, 2 * (1 - Math.min(1, dist / 80)));
  }
}

/** Antennation: nearby nestmates share their most recent danger memory. */
function antennate(ant, game) {
  for (const mate of game.antHash.query(ant.x, ant.y, 1)) {
    if (mate === ant || !mate.alive || mate.colonyId !== ant.colonyId) continue;
    if (mate.memory.dangerTick > ant.memory.dangerTick) {
      ant.memory.dangerTick = mate.memory.dangerTick;
      ant.memory.dangerX = mate.memory.dangerX;
      ant.memory.dangerY = mate.memory.dangerY;
    }
  }
}

// ---- Sensing helpers ------------------------------------------------------

function markBad(ant, index, tick) {
  ant.memory.bad[index] = tick + BAD_TARGET_TICKS;
}

function isBad(ant, index, tick) {
  const expiry = ant.memory.bad[index];
  return expiry !== undefined && expiry > tick;
}

function pruneBadTargets(ant, tick) {
  for (const key of Object.keys(ant.memory.bad)) {
    if (ant.memory.bad[key] <= tick) delete ant.memory.bad[key];
  }
}

/** Index of the nearest food cell within `radius`, or -1. */
function scanForFood(world, x, y, radius) {
  let best = -1;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (!world.inBounds(nx, ny)) continue;
      const i = world.index(nx, ny);
      if (world.type[i] !== CELL.FOOD || world.density[i] === 0) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
  }
  return best;
}

function findFood(game, ant, colony) {
  const world = game.world;
  const near = scanForFood(world, ant.x, ant.y, ant.sight);
  if (near >= 0 && !isBad(ant, near, game.tick)) {
    return { x: world.xOf(near), y: world.yOf(near) };
  }
  let best = null;
  let bestDist = Infinity;
  if (colony) {
    for (const i of colony.knownFood) {
      if (world.type[i] !== CELL.FOOD || world.density[i] === 0 || isBad(ant, i, game.tick)) continue;
      const x = world.xOf(i);
      const y = world.yOf(i);
      const d = manhattan(ant.x, ant.y, x, y);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function findCorpse(game, ant, colony) {
  const world = game.world;
  const nest = colony ? colony.nest : null;
  const radius = 12;
  let best = null;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ant.x + dx;
      const y = ant.y + dy;
      if (!world.inBounds(x, y)) continue;
      const i = world.index(x, y);
      if (world.type[i] !== CELL.FOOD || world.subtype[i] !== FOOD_KIND.CORPSE || world.density[i] === 0) continue;
      if (nest && chebyshev(x, y, nest.x, nest.y) <= 10) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function findWater(game, ant) {
  const world = game.world;
  const radius = 8;
  let best = null;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ant.x + dx;
      const y = ant.y + dy;
      if (!world.inBounds(x, y) || world.type[world.index(x, y)] !== CELL.WATER) continue;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d < bestDist) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

function findNurseTarget(game, ant, colony) {
  const nest = colony ? colony.nest : null;
  if (!nest) return null;
  let best = null;
  let bestDist = Infinity;
  for (const b of game.brood) {
    if (!b.alive || b.carried) continue;
    let d;
    if (b.kind === 'larva' && b.fed < LARVA_FEEDINGS) {
      d = manhattan(ant.x, ant.y, b.x, b.y);
    } else if (b.kind === 'egg' && chebyshev(b.x, b.y, nest.x, nest.y) > 6) {
      d = manhattan(ant.x, ant.y, b.x, b.y) + 10;
    } else {
      continue;
    }
    if (d < bestDist && d < 120) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/** Random goal for digging: near the nest if there is one, otherwise anywhere in the sand. */
function pickDigGoal(game, ant) {
  const { world, rng } = game;
  const colony = game.colonyOf(ant);
  const nest = colony ? colony.nest : null;
  for (let tries = 0; tries < 30; tries++) {
    const x = nest ? nest.x + rng.int(81) - 40 : rng.int(world.width);
    const y = nest ? nest.y + rng.int(81) - 40 : SURFACE_Y + rng.int(world.height - SURFACE_Y - 2);
    const cx = Math.min(world.width - 3, Math.max(2, x));
    const cy = Math.min(world.height - 3, Math.max(SURFACE_Y + 2, y));
    const t = world.type[world.index(cx, cy)];
    if (t === CELL.SAND || t === CELL.DIRT) return { x: cx, y: cy };
  }
  return nest ? { x: nest.x, y: nest.y + 10 } : { x: world.width >> 1, y: world.height >> 1 };
}

function hasDiggableNeighbour(world, x, y) {
  for (let d = 0; d < 4; d++) {
    if (DIGGABLE_TIME[world.typeAt(x + DX[d], y + DY[d])] > 0) return true;
  }
  return false;
}

/** Cell index of the diggable orthogonal neighbour nearest the dig goal, or -1. */
function adjacentDiggable(game, ant) {
  const world = game.world;
  const goal = ant.digGoal || { x: ant.x, y: ant.y };
  let best = -1;
  let bestScore = Infinity;
  for (let d = 0; d < 4; d++) {
    const nx = ant.x + DX[d];
    const ny = ant.y + DY[d];
    if (!world.inBounds(nx, ny)) continue;
    const i = world.index(nx, ny);
    if (DIGGABLE_TIME[world.type[i]] === 0) continue;
    const score = manhattan(nx, ny, goal.x, goal.y) + game.rng.next() * 2;
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** An open cell near the ant that touches diggable soil. Chosen by goal direction, distance and noise. */
function findDigFront(game, ant) {
  const world = game.world;
  const radius = 10;
  const goal = ant.digGoal;
  let best = null;
  let bestScore = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ant.x + dx;
      const y = ant.y + dy;
      if (!world.canAntEnter(x, y) || !hasDiggableNeighbour(world, x, y)) continue;
      const toGoal = goal ? manhattan(x, y, goal.x, goal.y) : 0;
      const score = toGoal * 0.6 + manhattan(x, y, ant.x, ant.y) * 0.4 + game.rng.next() * 3;
      if (score < bestScore) {
        bestScore = score;
        best = { x, y };
      }
    }
  }
  return best;
}

/** A tunnel cell next to unstable sand. */
function findBuildSpot(game, ant) {
  const world = game.world;
  const radius = 5;
  let best = null;
  let bestDist = Infinity;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = ant.x + dx;
      const y = ant.y + dy;
      if (!world.inBounds(x, y) || world.type[world.index(x, y)] !== CELL.TUNNEL) continue;
      let unstable = false;
      for (let d = 0; d < 4 && !unstable; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (world.typeAt(nx, ny) === CELL.SAND && world.stress[world.index(nx, ny)] > 0) unstable = true;
      }
      if (!unstable) continue;
      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x, y };
      }
    }
  }
  return best;
}

/** Nearest open surface cell (air resting on solid ground). Returns {x, y} or null. */
function findSurface(game, ant) {
  let best = null;
  let bestDist = Infinity;
  for (const i of game.surfaceCells) {
    if (game.occupancy[i] > 0) continue; // do not crowd onto an occupied cell
    const x = game.world.xOf(i);
    const y = game.world.yOf(i);
    // Small random jitter spreads ants over several surface cells instead of one.
    const d = manhattan(ant.x, ant.y, x, y) + game.rng.next() * 6;
    if (d < bestDist) {
      bestDist = d;
      best = { x, y };
    }
  }
  return best;
}

/**
 * Where a carried grain can land: an unoccupied air cell with solid ground
 * beneath it (so it forms a pile), searched in rings out to radius 4. Cells
 * above the ant are never used (grains would fall on it).
 */
function findDropSpot(game, ant) {
  const world = game.world;
  for (let r = 1; r <= 4; r++) {
    const options = [];
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), dy) !== r && !(dy === 0 && Math.abs(dx) === r)) continue;
        const x = ant.x + dx;
        const y = ant.y + dy;
        if (world.typeAt(x, y) !== CELL.EMPTY) continue;
        if (!SOLID[world.typeAt(x, y + 1)]) continue;
        if (game.occupancy[world.index(x, y)] > 0) continue;
        options.push({ x, y });
      }
    }
    if (options.length) return game.rng.pick(options);
  }
  return null;
}
