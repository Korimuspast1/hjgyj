/**
 * A* pathfinding on the cell grid for ants and enemies.
 *
 * Moves are 8-directional. Diagonal steps may not cut through solid corners,
 * so ants never squeeze through a gap that is only diagonal. Search memory is
 * reused between calls with generation stamps, so no per-call allocation or
 * clearing of 130k-element arrays happens.
 */
import { SOLID } from './world.js';
import { PATH_MAX_NODES } from './config.js';
import { DX, DY } from './utils.js';

const SQRT2 = Math.SQRT2;
const DIAGONAL_EXTRA = SQRT2 - 2;

/** Binary min-heap with parallel key/value arrays. */
class MinHeap {
  constructor() {
    this.keys = [];
    this.values = [];
  }

  get size() {
    return this.keys.length;
  }

  push(key, value) {
    const keys = this.keys;
    const values = this.values;
    let i = keys.length;
    keys.push(key);
    values.push(value);
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (keys[parent] <= key) break;
      keys[i] = keys[parent];
      values[i] = values[parent];
      i = parent;
    }
    keys[i] = key;
    values[i] = value;
  }

  pop() {
    const keys = this.keys;
    const values = this.values;
    const top = values[0];
    const lastKey = keys.pop();
    const lastValue = values.pop();
    const n = keys.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && keys[child + 1] < keys[child]) child++;
        if (keys[child] >= lastKey) break;
        keys[i] = keys[child];
        values[i] = values[child];
        i = child;
      }
      keys[i] = lastKey;
      values[i] = lastValue;
    }
    return top;
  }

  clear() {
    this.keys.length = 0;
    this.values.length = 0;
  }
}

/** Octile distance: exact heuristic for 8-directional unit-cost grids. */
function octile(ax, ay, bx, by) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx + dy + DIAGONAL_EXTRA * Math.min(dx, dy);
}

export class Pathfinder {
  /** @param {import('./world.js').World} world */
  constructor(world) {
    this.world = world;
    this.gScore = new Float32Array(world.size);
    this.parent = new Int32Array(world.size);
    this.stamp = new Uint32Array(world.size); // generation in which a cell was touched
    this.closed = new Uint32Array(world.size); // generation in which a cell was expanded
    this.generation = 0;
    this.heap = new MinHeap();
  }

  /**
   * Finds a path from (sx,sy) to a cell within `radius` (Chebyshev) of (gx,gy).
   * @returns {number[]|null} cell indices from the first step to the goal,
   *   an empty array if the start is already within radius, or null if unreachable.
   */
  find(sx, sy, gx, gy, { radius = 0, maxNodes = PATH_MAX_NODES } = {}) {
    const world = this.world;
    const W = world.width;
    const H = world.height;
    if (Math.max(Math.abs(sx - gx), Math.abs(sy - gy)) <= radius) return [];
    if (radius === 0 && !world.canAntEnter(gx, gy)) return null;

    this.generation = (this.generation + 1) >>> 0;
    if (this.generation === 0) this.generation = 1;
    const gen = this.generation;
    const heap = this.heap;
    heap.clear();

    const start = sy * W + sx;
    this.stamp[start] = gen;
    this.gScore[start] = 0;
    this.parent[start] = -1;
    heap.push(octile(sx, sy, gx, gy), start);

    let expanded = 0;
    while (heap.size > 0) {
      const current = heap.pop();
      if (this.closed[current] === gen) continue;
      this.closed[current] = gen;

      const cx = current % W;
      const cy = (current - cx) / W;
      if (Math.max(Math.abs(cx - gx), Math.abs(cy - gy)) <= radius) {
        return this.reconstruct(current, start);
      }
      if (++expanded > maxNodes) return null;

      const gCurrent = this.gScore[current];
      for (let d = 0; d < 8; d++) {
        const dx = DX[d];
        const dy = DY[d];
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx;
        if (this.closed[ni] === gen) continue;
        if (!world.canAntEnter(nx, ny)) continue;
        const diagonal = dx !== 0 && dy !== 0;
        if (diagonal && (SOLID[world.type[cy * W + nx]] || SOLID[world.type[ny * W + cx]])) continue;
        const g = gCurrent + (diagonal ? SQRT2 : 1);
        if (this.stamp[ni] !== gen || g < this.gScore[ni]) {
          this.stamp[ni] = gen;
          this.gScore[ni] = g;
          this.parent[ni] = current;
          heap.push(g + octile(nx, ny, gx, gy), ni);
        }
      }
    }
    return null;
  }

  reconstruct(current, start) {
    const path = [];
    let c = current;
    while (c !== start) {
      path.push(c);
      c = this.parent[c];
    }
    path.reverse();
    return path;
  }
}
