/**
 * Ant entity: identity, body, needs, inventory and short-term memory.
 * Decisions live in ai.js; this class only holds state.
 */
import { ANT_LIFESPAN_TICKS, SIGHT_RADIUS } from './config.js';

/** Castes. The queen is immobile and lays eggs; all others use the utility AI. */
export const ROLE = Object.freeze({
  WORKER: 'worker',
  DIGGER: 'digger',
  FORAGER: 'forager',
  NURSE: 'nurse',
  SOLDIER: 'soldier',
  BUILDER: 'builder',
  SCOUT: 'scout',
  UNDERTAKER: 'undertaker',
  QUEEN: 'queen',
});

/** Roles the colony can assign to newly hatched ants (the queen is never assigned). */
export const WORKER_ROLES = Object.freeze([
  ROLE.WORKER,
  ROLE.DIGGER,
  ROLE.FORAGER,
  ROLE.NURSE,
  ROLE.SOLDIER,
  ROLE.BUILDER,
  ROLE.SCOUT,
  ROLE.UNDERTAKER,
]);

export const ROLE_LABELS = Object.freeze({
  worker: 'WORKER',
  digger: 'DIGGER',
  forager: 'FORAGER',
  nurse: 'NURSE',
  soldier: 'SOLDIER',
  builder: 'BUILDER',
  scout: 'SCOUT',
  undertaker: 'UNDERTAKER',
  queen: 'QUEEN',
});

/** Target population share per role. The colony rebalances toward these. */
export const ROLE_SHARE = Object.freeze({
  worker: 0.05,
  digger: 0.2,
  forager: 0.25,
  nurse: 0.18,
  soldier: 0.08,
  builder: 0.08,
  scout: 0.07,
  undertaker: 0.04,
});

export class Ant {
  /**
   * @param {object} options
   * @param {number} options.id unique id
   * @param {number} options.colonyId owning colony id
   * @param {string} options.role a ROLE value
   * @param {number} options.x start cell x
   * @param {number} options.y start cell y
   * @param {import('./utils.js').Random} options.rng individual traits are drawn from this
   */
  constructor({ id, colonyId, role, x, y, rng }) {
    this.id = id;
    this.colonyId = colonyId;
    this.role = role;
    this.x = x;
    this.y = y;
    this.fromX = x;
    this.fromY = y;
    this.movedTick = -100; // tick of the last move (glide start)
    this.clock = 0; // current tick, set by Game.step
    this.facing = 1;
    this.animFrame = 0;
    this.alive = true;
    this.cause = null;

    const queen = role === ROLE.QUEEN;
    const soldier = role === ROLE.SOLDIER;
    this.maxHp = queen ? 200 : soldier ? 30 : 20;
    this.hp = this.maxHp;
    this.damage = queen ? 0 : soldier ? 4 : 2;
    this.strength = rng.range(0.8, 1.2);
    this.sight = SIGHT_RADIUS;

    // Needs: 0..100 for hunger and thirst (100 = starving), energy 0..100.
    this.hunger = rng.range(5, 30);
    this.thirst = rng.range(5, 30);
    this.energy = 100;

    this.ageTicks = 0;
    this.lifespan = ANT_LIFESPAN_TICKS * rng.range(0.85, 1.15);

    /** @type {{kind: string, amount?: number, ref?: object}|null} */
    this.inventory = null;
    this.carryTicks = 0;

    this.task = { kind: 'idle', target: null, ref: null, timer: 0 };
    this.decisionTimer = rng.int(4);

    this.speed = queen ? 0 : 0.5 * rng.range(0.85, 1.15) * (role === ROLE.SCOUT ? 1.3 : soldier ? 0.9 : 1);
    this.moveCredit = rng.next();
    this.heading = rng.int(8);

    this.path = null;
    this.pathPos = 0;
    this.pathGoalX = -1;
    this.pathGoalY = -1;
    this.pathRetryTick = 0;
    this.stuckTicks = 0;
    this.attackCooldown = 0;

    this.digProgress = 0;
    this.digTarget = -1;
    this.digGoal = null;

    /** Short-term memory. `bad` maps cell index -> tick until which it is ignored as a target. */
    this.memory = { dangerTick: -100000, dangerX: -1, dangerY: -1, bad: {} };
  }

  /** What the ant carries ('food' | 'sand' | 'corpse' | 'egg') or null. */
  get carrying() {
    return this.inventory ? this.inventory.kind : null;
  }

  get isQueen() {
    return this.role === ROLE.QUEEN;
  }
}
