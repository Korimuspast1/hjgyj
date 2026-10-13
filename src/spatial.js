/**
 * Uniform-grid spatial hash. Rebuilt every tick for moving entities, so
 * "who is near me" queries are cheap without an O(n^2) scan.
 */
export class SpatialHash {
  /**
   * @param {number} width world width in cells
   * @param {number} height world height in cells
   * @param {number} cellSize bucket size in cells
   */
  constructor(width, height, cellSize = 8) {
    this.cellSize = cellSize;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    this.buckets = Array.from({ length: this.cols * this.rows }, () => []);
  }

  clear() {
    for (const bucket of this.buckets) bucket.length = 0;
  }

  bucketOf(x, y) {
    const cx = Math.min(this.cols - 1, Math.max(0, Math.floor(x / this.cellSize)));
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(y / this.cellSize)));
    return cy * this.cols + cx;
  }

  insert(entity) {
    this.buckets[this.bucketOf(entity.x, entity.y)].push(entity);
  }

  /**
   * Entities within Chebyshev `radius` of (x, y).
   * @returns {Array} possibly-reused output array
   */
  query(x, y, radius, out = []) {
    const cs = this.cellSize;
    const x0 = Math.max(0, Math.floor((x - radius) / cs));
    const x1 = Math.min(this.cols - 1, Math.floor((x + radius) / cs));
    const y0 = Math.max(0, Math.floor((y - radius) / cs));
    const y1 = Math.min(this.rows - 1, Math.floor((y + radius) / cs));
    for (let by = y0; by <= y1; by++) {
      for (let bx = x0; bx <= x1; bx++) {
        for (const entity of this.buckets[by * this.cols + bx]) {
          if (Math.max(Math.abs(entity.x - x), Math.abs(entity.y - y)) <= radius) out.push(entity);
        }
      }
    }
    return out;
  }
}
