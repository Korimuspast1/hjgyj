// Tile/rect collision, movement integration and line-of-sight
import { TILE, TS, TILE_INFO } from '../world/tiles.js';

export function tileIndex(world, tx, ty) { return ty * world.w + tx; }

export function doorState(world, tx, ty) { return world.doors.get(tileIndex(world, tx, ty)); }

export function solidAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  const t = world.tiles[ty * world.w + tx];
  const info = TILE_INFO[t];
  if (!info.solid) return false;
  if (t === TILE.DOOR) {
    const d = world.doors.get(tileIndex(world, tx, ty));
    return !(d && (d.open || d.broken));
  }
  if (t === TILE.WINDOW || t === TILE.GLASS) {
    const d = world.doors.get(tileIndex(world, tx, ty));
    return !(d && d.broken);
  }
  return true;
}

export function opaqueAt(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  const t = world.tiles[ty * world.w + tx];
  const info = TILE_INFO[t];
  if (t === TILE.WINDOW || t === TILE.GLASS) return false;
  if (t === TILE.DOOR) {
    const d = world.doors.get(tileIndex(world, tx, ty));
    return !(d && d.open);
  }
  return !!info.opaque;
}

export function rectOverlapCircle(r, cx, cy, rad) {
  const nx = Math.max(r.x0, Math.min(cx, r.x1));
  const ny = Math.max(r.y0, Math.min(cy, r.y1));
  const dx = cx - nx, dy = cy - ny;
  return dx * dx + dy * dy < rad * rad;
}

// Move an entity with axis-separated collision against solid tiles and obstacles.
export function moveEntity(world, e, dx, dy) {
  let hit = false;
  if (dx !== 0) {
    e.x += dx;
    hit = resolveAxis(world, e, 'x', dx > 0 ? 1 : -1) || hit;
  }
  if (dy !== 0) {
    e.y += dy;
    hit = resolveAxis(world, e, 'y', dy > 0 ? 1 : -1) || hit;
  }
  // world bounds
  e.x = Math.max(e.r, Math.min(world.w * TS - e.r, e.x));
  e.y = Math.max(e.r, Math.min(world.h * TS - e.r, e.y));
  return hit;
}

function resolveAxis(world, e, axis, dir) {
  const r = e.r;
  const minX = Math.floor((e.x - r) / TS), maxX = Math.floor((e.x + r) / TS);
  const minY = Math.floor((e.y - r) / TS), maxY = Math.floor((e.y + r) / TS);
  let resolved = false;
  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      if (!solidAt(world, tx, ty)) continue;
      const rx = tx * TS, ry = ty * TS;
      const ox = Math.min(e.x + r, rx + TS) - Math.max(e.x - r, rx);
      const oy = Math.min(e.y + r, ry + TS) - Math.max(e.y - r, ry);
      if (ox <= 0 || oy <= 0) continue;
      if (axis === 'x') {
        e.x = dir > 0 ? rx - r - 0.01 : rx + TS + r + 0.01;
      } else {
        e.y = dir > 0 ? ry - r - 0.01 : ry + TS + r + 0.01;
      }
      resolved = true;
    }
  }
  // static rect obstacles (cars, trees)
  for (const o of world.obstacles) {
    if (!rectOverlapCircle(o, e.x, e.y, r)) continue;
    const cx = Math.max(o.x0, Math.min(e.x, o.x1));
    const cy = Math.max(o.y0, Math.min(e.y, o.y1));
    let dx = e.x - cx, dy = e.y - cy;
    let d = Math.hypot(dx, dy);
    if (d < 0.0001) { dx = 1; dy = 0; d = 1; }
    const push = (r - d);
    if (axis === 'x') e.x += (dx / d) * push;
    else e.y += (dy / d) * push;
    resolved = true;
  }
  return resolved;
}

// Separation between bodies (crowd pushing) — cheap O(n^2) but small n.
export function separate(list, strength = 1) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const rr = a.r + b.r;
      const d2 = dx * dx + dy * dy;
      if (d2 >= rr * rr || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const overlap = (rr - d) * 0.5 * strength;
      const nx = dx / d, ny = dy / d;
      a.x -= nx * overlap; a.y -= ny * overlap;
      b.x += nx * overlap; b.y += ny * overlap;
    }
  }
}

// Line of sight between two points (grid raycast)
export function losClear(world, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / (TS * 0.45));
  if (steps === 0) return true;
  const sx = dx / steps, sy = dy / steps;
  let x = x0, y = y0;
  for (let i = 0; i < steps; i++) {
    x += sx; y += sy;
    const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
    if (opaqueAt(world, tx, ty)) return false;
  }
  return true;
}

export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
