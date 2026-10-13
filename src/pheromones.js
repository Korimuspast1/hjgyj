/**
 * Pheromone layers (stigmergy). Ants communicate by changing these fields.
 *
 *  HOME    - laid by ants heading back to the nest; leads home.
 *  FOOD    - laid by ants carrying food; strongest near the food source.
 *  DANGER  - laid where ants were attacked; makes ants flee or soldiers gather.
 *  EXPLORE - laid by scouts; scouts prefer low values to cover new ground.
 *
 * update() is O(cells) per tick regardless of how many ants exist.
 */
import {
  PHEROMONE_MAX,
  PHEROMONE_EVAPORATION,
  PHEROMONE_DIFFUSION,
  PHEROMONE_DIFFUSE_EVERY,
} from './config.js';
import { SOLID } from './world.js';

export const LAYER = Object.freeze({ HOME: 0, FOOD: 1, DANGER: 2, EXPLORE: 3 });
export const LAYER_NAMES = Object.freeze(['home', 'food', 'danger', 'explore']);

export class Pheromones {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.layers = LAYER_NAMES.map(() => new Float32Array(this.size));
    this.scratch = new Float32Array(this.size);
    /** 1 when a layer may hold pheromone; empty layers are skipped by update(). */
    this.active = new Uint8Array(LAYER_NAMES.length);
    this.updates = 0;
  }

  /** Adds `amount` to a layer at cell index i, capped at PHEROMONE_MAX. */
  deposit(layer, i, amount) {
    const field = this.layers[layer];
    const value = field[i] + amount;
    field[i] = value > PHEROMONE_MAX ? PHEROMONE_MAX : value;
    this.active[layer] = 1;
  }

  get(layer, i) {
    return this.layers[layer][i];
  }

  /**
   * Evaporates and (periodically) diffuses every layer.
   * Solid cells never hold pheromone. Layers that are entirely empty are skipped,
   * and the border ring is always zero, so the inner loop needs no bounds checks.
   * @param {import('./world.js').World} world
   */
  update(world) {
    const W = this.width;
    const H = this.height;
    const type = world.type;
    const diffuse = this.updates % PHEROMONE_DIFFUSE_EVERY === 0;
    this.updates++;
    const D = PHEROMONE_DIFFUSION;
    const E = PHEROMONE_EVAPORATION;

    for (let l = 0; l < this.layers.length; l++) {
      if (!this.active[l]) continue;
      const current = this.layers[l];
      const next = this.scratch;
      next.fill(0); // border ring and any solid cell stay zero
      let any = false;
      for (let y = 1; y < H - 1; y++) {
        const row = y * W;
        for (let i = row + 1; i < row + W - 1; i++) {
          if (SOLID[type[i]]) continue;
          const v0 = current[i];
          let v = v0;
          if (diffuse) v += D * (current[i - 1] + current[i + 1] + current[i - W] + current[i + W] - 4 * v0);
          v *= E;
          if (v >= 0.02) {
            next[i] = v;
            any = true;
          }
        }
      }
      // Swap buffers instead of copying.
      this.layers[l] = next;
      this.scratch = current;
      this.active[l] = any ? 1 : 0;
    }
  }

  /** Clears every layer (used when the world is reset). */
  clear() {
    for (const field of this.layers) field.fill(0);
    this.active.fill(0);
  }
}
