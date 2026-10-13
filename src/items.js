/**
 * Brood: eggs, larvae and pupae. Eggs hatch into larvae; larvae must be fed
 * by nurses; well-fed larvae pupate; pupae emerge as adult ants whose role is
 * chosen by the colony.
 */
import { EGG_TICKS, LARVA_MIN_TICKS, PUPA_TICKS, LARVA_FEEDINGS } from './config.js';
import { SOLID } from './world.js';

export const LARVA_HUNGER_RATE = 0.05;

export class Brood {
  /**
   * @param {{id: number, kind: 'egg'|'larva'|'pupa', x: number, y: number, colonyId: number}} options
   */
  constructor({ id, kind, x, y, colonyId }) {
    this.id = id;
    this.kind = kind;
    this.x = x;
    this.y = y;
    this.colonyId = colonyId;
    this.age = 0;
    this.hunger = 0;
    this.fed = 0;
    this.alive = true;
    this.carried = false;
    this.cause = null;
  }
}

/**
 * Advances one brood item by one tick. Brood buried under sand dies.
 * @param {Brood} brood
 * @param {import('./game.js').Game} game
 */
export function updateBrood(brood, game) {
  if (!brood.alive) return;
  if (!brood.carried && SOLID[game.world.typeAt(brood.x, brood.y)]) {
    brood.alive = false;
    brood.cause = 'buried';
    return;
  }
  brood.age++;
  if (brood.kind === 'egg') {
    if (brood.age >= EGG_TICKS) {
      brood.kind = 'larva';
      brood.age = 0;
    }
  } else if (brood.kind === 'larva') {
    brood.hunger += LARVA_HUNGER_RATE;
    if (brood.hunger >= 100) {
      brood.alive = false;
      brood.cause = 'starved';
    } else if (brood.fed >= LARVA_FEEDINGS && brood.age >= LARVA_MIN_TICKS) {
      brood.kind = 'pupa';
      brood.age = 0;
    }
  } else if (brood.kind === 'pupa' && brood.age >= PUPA_TICKS) {
    brood.alive = false;
    game.hatchBrood(brood);
  }
}
