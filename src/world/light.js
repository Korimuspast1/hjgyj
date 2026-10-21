// Lighting: ambient day/night, lamps, flashlight cone, light grid for AI
export const LIGHT_CELL = 4; // tiles per light grid cell

export function ambientFor(time) {
  const h = (time / 60) % 24;
  if (h < 5) return { c: [58, 68, 108], a: 0.95, night: true };
  if (h < 7) return { c: [130, 128, 145], a: 0.95, night: false };
  if (h < 9) return { c: [220, 215, 200], a: 0.95, night: false };
  if (h < 17) return { c: [255, 252, 240], a: 0.95, night: false };
  if (h < 19.5) return { c: [196, 152, 120], a: 0.95, night: false };
  if (h < 21) return { c: [120, 104, 128], a: 0.95, night: true };
  return { c: [58, 68, 108], a: 0.95, night: true };
}

export function computeLightGrid(game) {
  const world = game.world;
  const gw = Math.ceil(world.w / LIGHT_CELL), gh = Math.ceil(world.h / LIGHT_CELL);
  if (!game.lightGrid || game.lightGrid.length !== gw * gh) game.lightGrid = new Float32Array(gw * gh);
  const grid = game.lightGrid;
  grid.fill(0);
  const night = game.isNight;
  for (const L of world.lights) {
    if (L.night && !night) continue;
    if (L.on === false) continue;
    const r = L.r;
    const cx = L.x / 16, cy = L.y / 16;
    const c0 = Math.max(0, Math.floor((cx - r / 16) / LIGHT_CELL));
    const c1 = Math.min(gw - 1, Math.ceil((cx + r / 16) / LIGHT_CELL));
    const r0 = Math.max(0, Math.floor((cy - r / 16) / LIGHT_CELL));
    const r1 = Math.min(gh - 1, Math.ceil((cy + r / 16) / LIGHT_CELL));
    let mul = 1;
    if (L.flicker) mul = 0.72 + 0.28 * (Math.sin(game.time * 9 + L.x) * 0.5 + 0.5) * (Math.random() < 0.06 ? 0.2 : 1);
    for (let gy = r0; gy <= r1; gy++) {
      for (let gx = c0; gx <= c1; gx++) {
        const px = (gx + 0.5) * LIGHT_CELL * 16;
        const py = (gy + 0.5) * LIGHT_CELL * 16;
        const d = Math.hypot(px - L.x, py - L.y);
        if (d > r) continue;
        const v = L.i * (1 - d / r) * mul;
        const idx = gy * gw + gx;
        if (v > grid[idx]) grid[idx] = v;
      }
    }
  }
  // ambient light level (used by zombie senses)
  const amb = game.ambientLevel;
  for (let i = 0; i < grid.length; i++) grid[i] = Math.min(1, grid[i] + amb * 0.45);
  game.lightGridW = gw; game.lightGridH = gh;
}

export function lightLevelAt(game, x, y) {
  if (!game.lightGrid) return game.ambientLevel;
  const gw = game.lightGridW;
  const gx = Math.min(gw - 1, Math.max(0, Math.floor(x / 16 / LIGHT_CELL)));
  const gy = Math.min(game.lightGridH - 1, Math.max(0, Math.floor(y / 16 / LIGHT_CELL)));
  return game.lightGrid[gy * gw + gx];
}

export function renderLighting(ctx, game) {
  const lc = game.lightCanvas;
  const lctx = game.lightCtx;
  const W = game.canvasW, H = game.canvasH;
  const zoom = game.zoom;
  const cam = game.cam;
  const amb = game.ambient;

  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, W, H);
  lctx.fillStyle = `rgb(${amb.c[0]},${amb.c[1]},${amb.c[2]})`;
  lctx.fillRect(0, 0, W, H);

  lctx.globalCompositeOperation = 'lighter';

  const toScreen = (wx, wy) => [(wx - cam.x) * zoom + W / 2, (wy - cam.y) * zoom + H / 2];

  // lamps
  const world = game.world;
  const margin = 120;
  for (const L of world.lights) {
    if (L.night && !game.isNight) continue;
    if (L.on === false) continue;
    const [sx, sy] = toScreen(L.x, L.y);
    const rad = L.r * zoom;
    if (sx < -margin || sy < -margin || sx > W + margin || sy > H + margin) continue;
    let mul = 1;
    if (L.flicker) mul = 0.7 + 0.3 * (Math.sin(game.time * 9 + L.x) * 0.5 + 0.5);
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    const inten = L.i * mul;
    g.addColorStop(0, `rgba(255,226,160,${0.95 * inten})`);
    g.addColorStop(0.45, `rgba(255,206,130,${0.45 * inten})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(sx, sy, rad, 0, Math.PI * 2); lctx.fill();
  }

  // player light (small aura) + flashlight cone
  const p = game.player;
  const [px, py] = toScreen(p.x, p.y - 4);
  const aura = lctx.createRadialGradient(px, py, 0, px, py, 46 * zoom);
  aura.addColorStop(0, 'rgba(210,205,190,0.45)');
  aura.addColorStop(1, 'rgba(180,180,170,0)');
  lctx.fillStyle = aura;
  lctx.beginPath(); lctx.arc(px, py, 46 * zoom, 0, Math.PI * 2); lctx.fill();

  if (p.flashlight) {
    const len = 190 * zoom;
    const spread = 0.42;
    const a = p.aim;
    const g = lctx.createRadialGradient(px, py, 0, px, py, len);
    g.addColorStop(0, 'rgba(255,246,205,0.98)');
    g.addColorStop(0.35, 'rgba(255,236,170,0.55)');
    g.addColorStop(1, 'rgba(255,220,140,0)');
    lctx.fillStyle = g;
    lctx.beginPath();
    lctx.moveTo(px, py);
    lctx.arc(px, py, len, a - spread, a + spread);
    lctx.closePath();
    lctx.fill();
  }

  // muzzle flashes / fires
  for (const L of game.dynamicLights) {
    const [sx, sy] = toScreen(L.x, L.y);
    const rad = L.r * zoom;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, `rgba(255,240,190,${L.i})`);
    g.addColorStop(1, 'rgba(255,200,120,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(sx, sy, rad, 0, Math.PI * 2); lctx.fill();
  }
  for (const f of game.fires) {
    const [sx, sy] = toScreen(f.x, f.y);
    const rad = f.r * zoom;
    const g = lctx.createRadialGradient(sx, sy, 0, sx, sy, rad);
    g.addColorStop(0, 'rgba(255,180,80,0.9)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    lctx.fillStyle = g;
    lctx.beginPath(); lctx.arc(sx, sy, rad, 0, Math.PI * 2); lctx.fill();
  }

  // composite
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lc, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}
