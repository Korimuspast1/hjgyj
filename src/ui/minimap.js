// Minimap + full map
import { TILE } from '../world/tiles.js';

const COLORS = {
  [TILE.VOID]: '#141618',
  [TILE.ASPHALT]: '#2b2c31',
  [TILE.ROAD_LINE]: '#3a3b41',
  [TILE.SIDEWALK]: '#4c4c48',
  [TILE.GRASS]: '#2e4529',
  [TILE.PATH]: '#4a4338',
  [TILE.DIRT]: '#453628',
  [TILE.RUBBLE]: '#3e3e3c',
  [TILE.WATER]: '#1d3a4a',
  [TILE.FLOOR_WOOD]: '#5a3f28',
  [TILE.FLOOR_TILE]: '#63635a',
  [TILE.FLOOR_CONCRETE]: '#46464a',
  [TILE.CARPET]: '#4a2a30',
  [TILE.FLOOR_CRACK]: '#4a4a44',
  [TILE.WALL]: '#2e2820',
  [TILE.WALL_BRICK]: '#33241d',
  [TILE.WALL_EXT]: '#3d3a35',
  [TILE.DOOR]: '#7a5a2a',
  [TILE.WINDOW]: '#28454f',
  [TILE.GLASS]: '#2f5a68',
  [TILE.FENCE]: '#3a4632',
  [TILE.RAIL]: '#3a3f42',
  [TILE.TABLE]: '#63432a',
  [TILE.SHELF]: '#3a2c1e',
  [TILE.COUNTER]: '#4e5052',
  [TILE.DESK]: '#3e2c20',
  [TILE.BED]: '#3f444a',
  [TILE.CRATE]: '#5a452b',
  [TILE.BARREL]: '#39413f',
  [TILE.PILLAR]: '#4b4a46',
  [TILE.LOCKER]: '#36403c',
  [TILE.FRIDGE]: '#6c716d',
  [TILE.CABINET]: '#3d3123',
  [TILE.TV]: '#22252a',
  [TILE.BENCH]: '#3d4a33',
  [TILE.STAIRS]: '#4a4b45',
};

export function buildMapBase(world) {
  const c = document.createElement('canvas');
  c.width = world.w; c.height = world.h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(world.w, world.h);
  const data = img.data;
  for (let i = 0; i < world.w * world.h; i++) {
    const t = world.tiles[i];
    let col = COLORS[t] || '#222';
    if (t === TILE.WINDOW || t === TILE.GLASS) {
      const d = world.doors.get(i);
      col = d && d.broken ? COLORS[TILE.WALL] : col;
    }
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16);
    data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export class Minimap {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.big = document.getElementById('bigmap');
    this.bigCtx = this.big.getContext('2d');
    this.bigCtx.imageSmoothingEnabled = false;
    this.base = null;
    this.dirty = true;
  }

  rebuild() {
    this.base = buildMapBase(this.game.world);
    this.dirty = false;
  }

  draw() {
    const g = this.game;
    if (!this.base || this.dirty) this.rebuild();
    const ctx = this.ctx;
    const size = this.canvas.width;
    const p = g.player;
    const view = 34; // tiles shown across
    const px = p.x / 16, py = p.y / 16;
    const sx = px - view / 2, sy = py - view / 2;
    ctx.fillStyle = '#0a0c0d';
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(this.base, sx, sy, view, view, 0, 0, size, size);
    const s = size / view;
    // containers
    ctx.fillStyle = '#c9a227';
    for (const c of g.world.containers) {
      const cx = c.x / 16 - sx, cy = c.y / 16 - sy;
      if (cx < 0 || cy < 0 || cx > view || cy > view) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) > 260) continue;
      ctx.fillRect(Math.round(cx * s), Math.round(cy * s), 1, 1);
    }
    // zombies
    ctx.fillStyle = '#c03a2a';
    for (const z of g.zombies) {
      if (z.dead) continue;
      const cx = z.x / 16 - sx, cy = z.y / 16 - sy;
      if (cx < 0 || cy < 0 || cx > view || cy > view) continue;
      if (Math.hypot(z.x - p.x, z.y - p.y) > 420) continue;
      ctx.fillRect(Math.round(cx * s) - 1, Math.round(cy * s) - 1, 2, 2);
    }
    // player
    ctx.fillStyle = '#e8f0e0';
    ctx.fillRect(size / 2 - 2, size / 2 - 2, 4, 4);
    ctx.strokeStyle = '#e8f0e0';
    ctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  drawBig() {
    const g = this.game;
    if (!this.base || this.dirty) this.rebuild();
    const ctx = this.bigCtx;
    const W = this.big.width, H = this.big.height;
    const sx = 0, sy = 0, sw = g.world.w, sh = g.world.h;
    ctx.fillStyle = '#0a0c0d';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(this.base, sx, sy, sw, sh, 0, 0, W, H);
    const kx = W / g.world.w, ky = H / g.world.h;
    // zombies
    ctx.fillStyle = '#c03a2a';
    for (const z of g.zombies) {
      if (z.dead) continue;
      ctx.fillRect(z.x / 16 * kx - 1, z.y / 16 * ky - 1, 2, 2);
    }
    // containers
    ctx.fillStyle = '#c9a227';
    for (const c of g.world.containers) {
      ctx.fillRect(c.x / 16 * kx - 0.5, c.y / 16 * ky - 0.5, 1, 1);
    }
    // player
    const p = g.player;
    ctx.fillStyle = '#e8f0e0';
    ctx.fillRect(p.x / 16 * kx - 3, p.y / 16 * ky - 3, 6, 6);
    ctx.strokeStyle = '#e8f0e0';
    ctx.beginPath();
    ctx.arc(p.x / 16 * kx, p.y / 16 * ky, 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#8d968e';
    ctx.font = '12px monospace';
    ctx.fillText(`Day ${g.day}   Kills ${g.player.kills}   Pos ${Math.round(p.x / 16)},${Math.round(p.y / 16)}`, 10, 16);
  }
}
