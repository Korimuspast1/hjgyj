/**
 * Shared helpers: seeded randomness, deterministic hashing and grid math.
 * No DOM or game references here, so the Node test-suite can use everything.
 */

/** 8 neighbour offsets. Indices 0-3 are orthogonal, 4-7 diagonal. */
export const DX = Int8Array.from([1, -1, 0, 0, 1, 1, -1, -1]);
export const DY = Int8Array.from([0, 0, 1, -1, 1, -1, 1, -1]);

/**
 * Seeded PRNG (mulberry32). Deterministic so runs can be replayed and saved.
 */
export class Random {
  /** @param {number} seed 32-bit seed */
  constructor(seed = 1) {
    this.state = seed >>> 0;
  }

  /** @returns {number} float in [0, 1) */
  next() {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** @returns {number} integer in [0, n) */
  int(n) {
    return Math.floor(this.next() * n);
  }

  /** @returns {number} float in [min, max) */
  range(min, max) {
    return min + this.next() * (max - min);
  }

  /** @returns {boolean} true with probability p */
  chance(p) {
    return this.next() < p;
  }

  /** @returns {*} random element of a non-empty array */
  pick(list) {
    return list[Math.floor(this.next() * list.length)];
  }
}

/**
 * Deterministic 2D hash in [0, 1). Used for per-cell visual variation so the
 * terrain looks stable frame to frame without storing extra arrays.
 * @param {number} x
 * @param {number} y
 */
export function hash2(x, y) {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** @returns {number} v clamped into [lo, hi] */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Chebyshev (king-move) distance. */
export function chebyshev(ax, ay, bx, by) {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Manhattan distance. */
export function manhattan(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

/**
 * Integer cells on a line from (x0,y0) to (x1,y1), inclusive.
 * Used to paint continuously while the mouse is dragged.
 * @returns {Array<[number, number]>}
 */
export function lineCells(x0, y0, x1, y1) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const cells = [];
  for (let k = 0; k <= steps; k++) {
    cells.push([Math.round(x0 + ((x1 - x0) * k) / steps), Math.round(y0 + ((y1 - y0) * k) / steps)]);
  }
  return cells;
}
