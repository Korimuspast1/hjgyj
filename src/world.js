/**
 * Grid world: terrain types and per-cell properties stored in typed arrays.
 *
 * Cell properties: type, density, subtype (food kind), moisture, light,
 * stress (cave-in timer). Pheromones live in pheromones.js.
 */
import { WORLD_WIDTH, WORLD_HEIGHT, SURFACE_Y } from './config.js';
import { DX, DY } from './utils.js';

/** Terrain types. TUNNEL and CHAMBER are ant-made empty space. */
export const CELL = Object.freeze({
  EMPTY: 0,
  SAND: 1,
  DIRT: 2,
  CLAY: 3,
  ROCK: 4,
  WATER: 5,
  GLASS: 6,
  FOOD: 7,
  FUNGUS: 8,
  TUNNEL: 9,
  CHAMBER: 10,
});

export const CELL_NAMES = Object.freeze([
  'Air', 'Sand', 'Dirt', 'Clay', 'Rock', 'Water', 'Glass', 'Food', 'Fungus', 'Tunnel', 'Chamber',
]);

/** Blocks movement, water and loose material. */
export const SOLID = Uint8Array.from([0, 1, 1, 1, 1, 0, 1, 0, 0, 0, 0]);
/** Ants may stand here (water is excluded on purpose: it drowns them). */
export const ANT_PASSABLE = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]);
/** Falling sand and water may displace these cells. */
export const DISPLACEABLE = Uint8Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1]);
/** Water flows into these cells. */
export const WATER_FLOW = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
/** Ticks needed to dig a cell at strength 1. 0 = cannot be dug. */
export const DIGGABLE_TIME = Uint8Array.from([0, 8, 16, 30, 0, 0, 0, 0, 0, 0, 0]);

export const FOOD_KIND = Object.freeze({ SEED: 0, LEAF: 1, SUGAR: 2, CORPSE: 3 });
export const FOOD_NAMES = Object.freeze(['Seed', 'Leaf', 'Sugar', 'Corpse']);
/** Nutrition units placed per food cell when painted. */
export const FOOD_UNITS = Object.freeze([6, 4, 8, 6]);

/**
 * The world grid. All arrays are indexed by `y * width + x`.
 */
export class World {
  constructor(width = WORLD_WIDTH, height = WORLD_HEIGHT) {
    this.width = width;
    this.height = height;
    this.size = width * height;
    this.type = new Uint8Array(this.size);
    this.density = new Uint8Array(this.size);
    this.subtype = new Uint8Array(this.size);
    this.moisture = new Uint8Array(this.size);
    this.light = new Uint8Array(this.size);
    this.stress = new Uint8Array(this.size);
    this.waterStamp = new Uint32Array(this.size); // tick when water last moved into a cell
  }

  index(x, y) {
    return y * this.width + x;
  }

  xOf(i) {
    return i % this.width;
  }

  yOf(i) {
    return (i - (i % this.width)) / this.width;
  }

  inBounds(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Out-of-bounds cells behave like glass walls. */
  typeAt(x, y) {
    return this.inBounds(x, y) ? this.type[y * this.width + x] : CELL.GLASS;
  }

  setCell(x, y, type, density = 0, subtype = 0) {
    if (!this.inBounds(x, y)) return false;
    this.setIndex(y * this.width + x, type, density, subtype);
    return true;
  }

  setIndex(i, type, density = 0, subtype = 0) {
    this.type[i] = type;
    this.density[i] = density;
    this.subtype[i] = subtype;
    this.stress[i] = 0;
    if (type !== CELL.SAND && type !== CELL.DIRT) this.moisture[i] = 0;
  }

  /** Number of solid cells among the 8 neighbours. Out of bounds counts as solid. */
  countSolidNeighbours(x, y) {
    let count = 0;
    for (let d = 0; d < 8; d++) {
      if (SOLID[this.typeAt(x + DX[d], y + DY[d])]) count++;
    }
    return count;
  }

  /**
   * Whether an ant may stand on (x,y). Open cells need a solid neighbour
   * (ants walk on surfaces like real ants), except tunnels and chambers,
   * which are always enclosed by walls.
   */
  canAntEnter(x, y) {
    if (!this.inBounds(x, y)) return false;
    const t = this.type[y * this.width + x];
    if (!ANT_PASSABLE[t]) return false;
    if (t === CELL.TUNNEL || t === CELL.CHAMBER) return true;
    return this.countSolidNeighbours(x, y) > 0;
  }

  /** Recomputes the light level from depth (surface = bright, deeper = darker). */
  computeLight() {
    for (let y = 0; y < this.height; y++) {
      const value = y < SURFACE_Y ? 255 : Math.max(0, 255 - (y - SURFACE_Y) * 3);
      this.light.fill(value, y * this.width, (y + 1) * this.width);
    }
  }

  /**
   * Resets to the starting state: glass box, air above, uniform sand below.
   */
  resetToFormicarium() {
    const { width: W, height: H } = this;
    this.type.fill(CELL.EMPTY);
    this.density.fill(0);
    this.subtype.fill(0);
    this.moisture.fill(0);
    this.stress.fill(0);
    this.waterStamp.fill(0);
    for (let x = 0; x < W; x++) {
      this.setIndex(this.index(x, 0), CELL.GLASS);
      this.setIndex(this.index(x, H - 1), CELL.GLASS);
    }
    for (let y = 0; y < H; y++) {
      this.setIndex(this.index(0, y), CELL.GLASS);
      this.setIndex(this.index(W - 1, y), CELL.GLASS);
    }
    for (let y = SURFACE_Y; y <= H - 2; y++) {
      for (let x = 1; x <= W - 2; x++) this.setIndex(this.index(x, y), CELL.SAND, 255);
    }
    this.computeLight();
  }

  /** @returns {Object<string, number>} count of each terrain type */
  countTypes() {
    const counts = {};
    for (const name of CELL_NAMES) counts[name] = 0;
    for (let i = 0; i < this.size; i++) counts[CELL_NAMES[this.type[i]]]++;
    return counts;
  }
}
