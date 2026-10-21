// Procedural city generation: road grid, districts, buildings with rooms,
// furniture, loot containers, props, lights, zombie spawn spots.
import { TILE, TS, TILE_INFO } from './tiles.js';
import { mulberry32, hash2, randInt, chance, pick, shuffle, weighted } from '../core/rng.js';

export const WORLD_W = 200;
export const WORLD_H = 150;

export function generateWorld(seed) {
  const rng = mulberry32(seed);
  const W = WORLD_W, H = WORLD_H;
  const tiles = new Uint8Array(W * H);

  const world = {
    seed, w: W, h: H, tiles,
    doors: new Map(),      // tile index -> {open, hp, maxHp, broken}
    containers: [],        // searchable loot containers
    props: [],             // trees, cars, signs
    lights: [],            // light sources
    obstacles: [],         // px rects blocking movement (cars)
    spawnSpots: [],        // candidate zombie spawn points (px)
    houses: [],            // {x,y,doorX,doorY}
    blocks: [],
    streetlights: [],
    parkSpots: [],
  };

  const idx = (x, y) => y * W + x;
  const setT = (x, y, t) => { if (x >= 0 && y >= 0 && x < W && y < H) tiles[idx(x, y)] = t; };
  const getT = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? TILE.VOID : tiles[idx(x, y)];

  // ---------------------------------------------------------- base terrain
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = hash2(x >> 3, y >> 3, seed);
      setT(x, y, n < 0.12 ? TILE.GRASS : TILE.GRASS);
    }
  }
  // dark green forest patches in the far outskirts
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const f = hash2(x >> 2, y >> 2, seed + 991);
      const edge = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (edge < 6 && f < 0.55) setT(x, y, TILE.GRASS);
    }
  }

  // ---------------------------------------------------------- road grid
  const vx = [];
  let x = 6;
  while (x < W - 16) { vx.push(x); x += 24 + randInt(rng, -3, 5); }
  const hy = [];
  let y = 6;
  while (y < H - 16) { hy.push(y); y += 21 + randInt(rng, -3, 4); }

  // blocks
  const blocks = [];
  for (let i = 0; i < vx.length - 1; i++) {
    for (let j = 0; j < hy.length - 1; j++) {
      const bx0 = vx[i] + 3, by0 = hy[j] + 3;
      const bx1 = vx[i + 1] - 3, by1 = hy[j + 1] - 3;
      if (bx1 - bx0 < 5 || by1 - by0 < 5) continue;
      const ccx = (bx0 + bx1) / 2, ccy = (by0 + by1) / 2;
      const dist = Math.hypot((ccx - W / 2) / (W / 2), (ccy - H / 2) / (H / 2));
      let type;
      if (dist < 0.30) type = weighted(rng, [['downtown', 8], ['residential', 2], ['park', 1]]);
      else if (dist < 0.62) type = weighted(rng, [['residential', 6], ['downtown', 4], ['park', 2], ['lot', 2], ['industrial', 1]]);
      else type = weighted(rng, [['residential', 6], ['industrial', 3], ['park', 3], ['lot', 2], ['fields', 2]]);
      blocks.push({ x0: bx0, y0: by0, x1: bx1, y1: by1, type, i, j, dist });
    }
  }
  world.blocks = blocks;

  // sidewalks around every block
  for (const b of blocks) {
    for (let x = b.x0 - 1; x <= b.x1 + 1; x++) {
      setT(x, b.y0 - 1, TILE.SIDEWALK); setT(x, b.y1 + 1, TILE.SIDEWALK);
    }
    for (let y = b.y0; y <= b.y1; y++) {
      setT(b.x0 - 1, y, TILE.SIDEWALK); setT(b.x1 + 1, y, TILE.SIDEWALK);
    }
  }

  // roads (asphalt over everything)
  for (const rx of vx) {
    for (let y = 0; y < H; y++) {
      for (let dx = -1; dx <= 1; dx++) setT(rx + dx, y, TILE.ASPHALT);
      setT(rx, y, TILE.ROAD_LINE);
    }
  }
  for (const ry of hy) {
    for (let x = 0; x < W; x++) {
      for (let dy = -1; dy <= 1; dy++) setT(x, ry + dy, TILE.ASPHALT);
      setT(x, ry, TILE.ROAD_LINE);
    }
  }
  // re-draw crossing lines properly (intersections)
  for (const rx of vx) for (const ry of hy) {
    setT(rx, ry, TILE.ASPHALT);
    setT(rx - 1, ry, TILE.ASPHALT); setT(rx + 1, ry, TILE.ASPHALT);
    setT(rx, ry - 1, TILE.ASPHALT); setT(rx, ry + 1, TILE.ASPHALT);
  }

  // ---------------------------------------------------------- block content
  for (const b of blocks) {
    switch (b.type) {
      case 'residential': genResidential(rng, world, b, setT, getT, idx); break;
      case 'downtown': genDowntown(rng, world, b, setT, getT, idx); break;
      case 'industrial': genIndustrial(rng, world, b, setT, getT, idx); break;
      case 'park': genPark(rng, world, b, setT, getT, idx); break;
      case 'lot': genLot(rng, world, b, setT, getT, idx); break;
      case 'fields': genFields(rng, world, b, setT, getT, idx); break;
    }
  }

  // ---------------------------------------------------------- street lights
  for (const rx of vx) {
    for (let y = 4; y < H; y += 11) {
      const ty = y + ((hash2(rx, y, seed) * 5) | 0);
      if (getT(rx - 2, ty) === TILE.SIDEWALK || getT(rx + 2, ty) === TILE.SIDEWALK) {
        const lx = (rx - 2) * TS + 8, ly = ty * TS + 8;
        world.streetlights.push({ x: lx, y: ly });
        world.lights.push({ x: lx, y: ly, r: 78, i: 0.85, night: true, flicker: chance(rng, 0.12) });
      }
    }
  }
  for (const ry of hy) {
    for (let x = 4; x < W; x += 12) {
      const tx = x + ((hash2(x, ry, seed + 5) * 5) | 0);
      if (getT(tx, ry - 2) === TILE.SIDEWALK || getT(tx, ry + 2) === TILE.SIDEWALK) {
        const lx = tx * TS + 8, ly = (ry - 2) * TS + 8;
        world.streetlights.push({ x: lx, y: ly });
        world.lights.push({ x: lx, y: ly, r: 78, i: 0.85, night: true, flicker: chance(rng, 0.12) });
      }
    }
  }

  // ---------------------------------------------------------- ground clutter
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = getT(x, y);
      const r = hash2(x, y, seed + 313);
      if (t === TILE.SIDEWALK && r < 0.05) {
        setT(x, y, TILE.RUBBLE);
        world.spawnSpots.push({ x: x * TS + 8, y: y * TS + 8 });
      } else if (t === TILE.ASPHALT && r < 0.012) {
        setT(x, y, TILE.RUBBLE);
      }
    }
  }

  // ---------------------------------------------------------- parked cars
  for (const rx of vx) {
    for (let y = 2; y < H - 2; y += 3) {
      if (!chance(rng, 0.14)) continue;
      const side = chance(rng, 0.5) ? 1 : -1;
      const cx = rx + side * 2;
      const cy = y;
      if (getT(cx, cy) !== TILE.ASPHALT && getT(cx, cy) !== TILE.ROAD_LINE) continue;
      if (getT(cx, cy + 1) !== TILE.ASPHALT) continue;
      addCar(rng, world, cx * TS, cy * TS, chance(rng, 0.5) ? 0 : 90);
    }
  }
  for (const ry of hy) {
    for (let x = 2; x < W - 2; x += 3) {
      if (!chance(rng, 0.12)) continue;
      const side = chance(rng, 0.5) ? 1 : -1;
      const cx = x, cy = ry + side * 2;
      if (getT(cx, cy) !== TILE.ASPHALT && getT(cx, cy) !== TILE.ROAD_LINE) continue;
      if (getT(cx + 1, cy) !== TILE.ASPHALT) continue;
      addCar(rng, world, cx * TS, cy * TS, chance(rng, 0.5) ? 0 : 90);
    }
  }

  // ---------------------------------------------------------- spawn points
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = getT(x, y);
      const i = TILE_INFO[t];
      if (!i.solid && i.floor) world.spawnSpots.push({ x: x * TS + 8, y: y * TS + 8 });
    }
  }

  world.roadLines = { vx, hy };
  return world;
}

function addCar(rng, world, px, py, rot) {
  const colors = ['#7a3f3a', '#3f5a7a', '#6a6a55', '#4a4a4a', '#7a6a3f', '#3f6a5a', '#8a8a8a'];
  const color = pick(rng, colors);
  world.props.push({ type: 'car', x: px, y: py, rot, color, wrecked: chance(rng, 0.35) });
  const w = rot === 0 ? 30 : 14, h = rot === 0 ? 14 : 30;
  world.obstacles.push({ x0: px + 1, y0: py + 1, x1: px + 1 + w, y1: py + 1 + h });
  world.spawnSpots.push({ x: px + 8, y: py + 8 });
}

// ============================================================ block builders
function genResidential(rng, world, b, setT, getT, idx) {
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  // fill with grass yards
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.GRASS);

  // split the block into a grid of plots
  const nx = Math.min(3, Math.max(1, Math.round(w / 10)));
  const ny = Math.min(3, Math.max(1, Math.round(h / 9)));
  const plots = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px0 = b.x0 + Math.floor((i * w) / nx);
      const px1 = b.x0 + Math.floor(((i + 1) * w) / nx) - 1;
      const py0 = b.y0 + Math.floor((j * h) / ny);
      const py1 = b.y0 + Math.floor(((j + 1) * h) / ny) - 1;
      plots.push([px0, py0, px1, py1]);
    }
  }

  for (const p of plots) {
    const pw = p[2] - p[0] + 1, ph = p[3] - p[1] + 1;
    const aw = pw - 2, ah = ph - 2;
    if (aw < 6 || ah < 6) {
      // too small -> open yard
      for (let y = p[1]; y <= p[3]; y++) for (let x = p[0]; x <= p[2]; x++) setT(x, y, TILE.GRASS);
      continue;
    }
    const hw = randInt(rng, 6, Math.min(11, aw));
    const hh = randInt(rng, 6, Math.min(10, ah));
    const hx = p[0] + 1 + randInt(rng, 0, Math.max(0, aw - hw));
    const hy = p[1] + 1 + randInt(rng, 0, Math.max(0, ah - hh));
    const hx1 = hx + hw - 1, hy1 = hy + hh - 1;
    makeBuilding(rng, world, { x0: hx, y0: hy, x1: hx1, y1: hy1 }, 'house', setT, getT, idx);
    // yard fence
    if (chance(rng, 0.45)) {
      for (let x = hx - 1; x <= hx1 + 1; x++) { setT(x, hy - 1, TILE.FENCE); setT(x, hy1 + 1, TILE.FENCE); }
      for (let y = hy; y <= hy1; y++) { setT(hx - 1, y, TILE.FENCE); setT(hx1 + 1, y, TILE.FENCE); }
    }
    if (chance(rng, 0.6)) addTree(rng, world, hx - 1, hy - 1);
    if (chance(rng, 0.5)) addTree(rng, world, hx1 + 1, hy1 + 1);
  }
}

function genDowntown(rng, world, b, setT, getT, idx) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.SIDEWALK);
  const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1;
  const nx = Math.min(2, Math.max(1, Math.round(w / 13)));
  const ny = Math.min(2, Math.max(1, Math.round(h / 13)));
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const px0 = b.x0 + Math.floor((i * w) / nx) + 1;
      const px1 = b.x0 + Math.floor(((i + 1) * w) / nx) - 2;
      const py0 = b.y0 + Math.floor((j * h) / ny) + 1;
      const py1 = b.y0 + Math.floor(((j + 1) * h) / ny) - 2;
      if (px1 - px0 < 5 || py1 - py0 < 5) continue;
      makeBuilding(rng, world, { x0: px0, y0: py0, x1: px1, y1: py1 }, 'shop', setT, getT, idx);
    }
  }
}

function genIndustrial(rng, world, b, setT, getT, idx) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.DIRT);
  makeBuilding(rng, world, { x0: b.x0 + 1, y0: b.y0 + 1, x1: b.x1 - 1, y1: b.y1 - 1 }, 'warehouse', setT, getT, idx);
  for (let i = 0; i < 4; i++) {
    const tx = b.x0 + randInt(rng, 0, b.x1 - b.x0), ty = b.y0 + randInt(rng, 0, b.y1 - b.y0);
    addCar(rng, world, tx * TS, ty * TS, chance(rng, 0.5) ? 0 : 90);
  }
}

function genPark(rng, world, b, setT, getT, idx) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.GRASS);
  // path through the park
  const py = b.y0 + Math.floor((b.y1 - b.y0) / 2);
  for (let x = b.x0; x <= b.x1; x++) setT(x, py, TILE.PATH);
  const px = b.x0 + Math.floor((b.x1 - b.x0) / 2);
  for (let y = b.y0; y <= b.y1; y++) setT(px, y, TILE.PATH);
  for (let i = 0; i < randInt(rng, 6, 14); i++) {
    const tx = b.x0 + randInt(rng, 0, b.x1 - b.x0), ty = b.y0 + randInt(rng, 0, b.y1 - b.y0);
    if (getT(tx, ty) === TILE.PATH) continue;
    addTree(rng, world, tx, ty);
  }
  for (let i = 0; i < randInt(rng, 1, 4); i++) {
    const tx = b.x0 + randInt(rng, 0, b.x1 - b.x0), ty = b.y0 + randInt(rng, 0, b.y1 - b.y0);
    if (getT(tx, ty) !== TILE.PATH) setT(tx, ty, TILE.BENCH);
  }
}

function genLot(rng, world, b, setT, getT, idx) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.ASPHALT);
  for (let i = 0; i < randInt(rng, 2, 6); i++) {
    const tx = b.x0 + randInt(rng, 1, Math.max(1, b.x1 - b.x0 - 2));
    const ty = b.y0 + randInt(rng, 1, Math.max(1, b.y1 - b.y0 - 2));
    addCar(rng, world, tx * TS, ty * TS, chance(rng, 0.5) ? 0 : 90);
  }
}

function genFields(rng, world, b, setT, getT, idx) {
  for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) setT(x, y, TILE.DIRT);
  for (let i = 0; i < randInt(rng, 4, 12); i++) {
    const tx = b.x0 + randInt(rng, 0, b.x1 - b.x0), ty = b.y0 + randInt(rng, 0, b.y1 - b.y0);
    addTree(rng, world, tx, ty);
  }
}

function addTree(rng, world, tx, ty) {
  if (tx < 1 || ty < 1 || tx >= WORLD_W - 1 || ty >= WORLD_H - 1) return;
  world.props.push({
    type: 'tree', x: tx * TS + 8, y: ty * TS + 10,
    r: 7 + Math.random() * 4, seed: (Math.random() * 1e6) | 0,
    shade: chance(rng, 0.5) ? '#2f4a2c' : '#39573a'
  });
  world.obstacles.push({ x0: tx * TS + 3, y0: ty * TS + 4, x1: tx * TS + 13, y1: ty * TS + 15 });
}

// ============================================================ buildings
function makeBuilding(rng, world, r, style, setT, getT, idx) {
  const { x0, y0, x1, y1 } = r;
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  if (w < 5 || h < 5) return;

  const wallT = style === 'shop' ? TILE.WALL_BRICK : style === 'warehouse' ? TILE.WALL_EXT : TILE.WALL;
  const floorT = style === 'house' ? TILE.FLOOR_WOOD :
    style === 'shop' ? TILE.FLOOR_TILE :
    style === 'warehouse' ? TILE.FLOOR_CONCRETE : TILE.FLOOR_CONCRETE;

  // interior floor
  for (let y = y0 + 1; y <= y1 - 1; y++) for (let x = x0 + 1; x <= x1 - 1; x++) setT(x, y, floorT);

  // perimeter walls
  for (let x = x0; x <= x1; x++) { setT(x, y0, wallT); setT(x, y1, wallT); }
  for (let y = y0; y <= y1; y++) { setT(x0, y, wallT); setT(x1, y, wallT); }

  // rooms
  const rooms = [];
  const area = (x1 - x0 - 1) * (y1 - y0 - 1);
  let targetRooms = Math.max(1, Math.round(area / 40));
  if (style === 'house') targetRooms = Math.min(targetRooms, 4);
  else if (style === 'shop') targetRooms = Math.min(targetRooms, 10);
  else targetRooms = Math.min(targetRooms, 7);
  splitRooms(rng, x0 + 1, y0 + 1, x1 - 1, y1 - 1, targetRooms, rooms);
  // draw partition walls between rooms (with gaps)
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const A = rooms[i], B = rooms[j];
      const shareX = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0);
      const shareY = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
      if (shareY >= 0 && shareX < 1) {
        const yy = Math.max(A.y0, B.y0);
        const xa = Math.max(A.x0, B.x0), xb = Math.min(A.x1, B.x1);
        for (let x = xa; x <= xb; x++) setT(x, yy, wallT);
        const gap = xa + randInt(rng, 0, Math.max(0, xb - xa));
        setT(gap, yy, floorT);
      } else if (shareX >= 0 && shareY < 1) {
        const xx = Math.max(A.x0, B.x0);
        const ya = Math.max(A.y0, B.y0), yb = Math.min(A.y1, B.y1);
        for (let y = ya; y <= yb; y++) setT(xx, y, wallT);
        const gap = ya + randInt(rng, 0, Math.max(0, yb - ya));
        setT(xx, gap, floorT);
      }
    }
  }

  // door on the outer wall
  const side = pick(rng, ['n', 's', 'w', 'e']);
  let dx, dy;
  if (side === 'n') { dx = randInt(rng, x0 + 2, x1 - 2); dy = y0; }
  else if (side === 's') { dx = randInt(rng, x0 + 2, x1 - 2); dy = y1; }
  else if (side === 'w') { dx = x0; dy = randInt(rng, y0 + 2, y1 - 2); }
  else { dx = x1; dy = randInt(rng, y0 + 2, y1 - 2); }
  setT(dx, dy, TILE.DOOR);
  world.doors.set(idx(dx, dy), { open: false, hp: 100, maxHp: 100, broken: false, x: dx, y: dy, floor: floorT });
  world.houses.push({ x: dx, y: dy, x0, y0, x1, y1, style });

  // windows
  const mkWindow = (wx, wy) => {
    setT(wx, wy, TILE.WINDOW);
    world.doors.set(idx(wx, wy), { open: false, hp: 30, maxHp: 30, broken: false, type: 'window', x: wx, y: wy });
  };
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    if (getT(x, y0) === wallT && !(x === dx)) mkWindow(x, y0);
    if (getT(x, y1) === wallT && !(x === dx)) mkWindow(x, y1);
  }
  for (let y = y0 + 2; y <= y1 - 2; y += 3) {
    if (getT(x0, y) === wallT && !(y === dy)) mkWindow(x0, y);
    if (getT(x1, y) === wallT && !(y === dy)) mkWindow(x1, y);
  }
  // shopfront glass towards the street
  if (style === 'shop') {
    const gs = pick(rng, ['n', 's', 'w', 'e']);
    const mkGlass = (gx, gy) => {
      setT(gx, gy, TILE.GLASS);
      world.doors.set(idx(gx, gy), { open: false, hp: 20, maxHp: 20, broken: false, type: 'glass', x: gx, y: gy });
    };
    if (gs === 'n') for (let x = x0 + 1; x <= x1 - 1; x++) if (getT(x, y0) === wallT) mkGlass(x, y0);
    if (gs === 's') for (let x = x0 + 1; x <= x1 - 1; x++) if (getT(x, y1) === wallT) mkGlass(x, y1);
    if (gs === 'w') for (let y = y0 + 1; y <= y1 - 1; y++) if (getT(x0, y) === wallT) mkGlass(x0, y);
    if (gs === 'e') for (let y = y0 + 1; y <= y1 - 1; y++) if (getT(x1, y) === wallT) mkGlass(x1, y);
  }

  // furniture + containers + lights
  for (const rm of rooms) {
    const area = (rm.x1 - rm.x0 + 1) * (rm.y1 - rm.y0 + 1);
    const rtype = pickRoomType(rng, style, area);
    furnishRoom(rng, world, rm, rtype, style, setT, getT, idx);
  }
}

function pickRoomType(rng, style, area) {
  if (style === 'warehouse') return weighted(rng, [['storage', 5], ['office', 2], ['living', 1]]);
  if (style === 'shop') return weighted(rng, [['shop', 5], ['storage', 3], ['office', 2]]);
  if (area < 16) return weighted(rng, [['bath', 2], ['bedroom', 3], ['storage', 2], ['living', 1]]);
  return weighted(rng, [['living', 4], ['kitchen', 3], ['bedroom', 3], ['bath', 1], ['storage', 2]]);
}

function furnishRoom(rng, world, rm, type, style, setT, getT, idx) {
  const w = rm.x1 - rm.x0 + 1, h = rm.y1 - rm.y0 + 1;
  if (w <= 0 || h <= 0) return;

  // candidate spots for furniture
  const spots = [];
  for (let y = rm.y0; y <= rm.y1; y++) for (let x = rm.x0; x <= rm.x1; x++) spots.push([x, y]);
  shuffle(rng, spots);
  let si = 0;
  const next = () => (si < spots.length ? spots[si++] : null);

  const put = (tile, containerType, lootLevel) => {
    const sp = next();
    if (!sp) return false;
    const tx = sp[0], ty = sp[1];
    if (getT(tx, ty) === TILE.WALL || getT(tx, ty) === TILE.DOOR) return false;
    setT(tx, ty, tile);
    if (containerType) {
      world.containers.push({
        x: tx * TS + 8, y: ty * TS + 8, tx, ty, type: containerType,
        items: [], searched: false, level: lootLevel,
        name: containerName(containerType)
      });
    }
    return true;
  };
  // decoration (walkable)
  const decor = (tile) => {
    const sp = next();
    if (!sp) return;
    if (getT(sp[0], sp[1]) === TILE.WALL || getT(sp[0], sp[1]) === TILE.DOOR) return;
    setT(sp[0], sp[1], tile);
  };
  const cx = Math.floor((rm.x0 + rm.x1) / 2), cy = Math.floor((rm.y0 + rm.y1) / 2);

  switch (type) {
    case 'living':
      decor(TILE.CARPET);
      put(TILE.TABLE);
      if (chance(rng, 0.8)) put(TILE.TV);
      if (chance(rng, 0.7)) put(TILE.SHELF, 'shelf', 1);
      if (chance(rng, 0.5)) put(TILE.CABINET, 'cabinet', 1);
      break;
    case 'kitchen':
      for (let i = 0; i < randInt(rng, 1, 3); i++) put(TILE.COUNTER);
      put(TILE.FRIDGE, 'fridge', 2);
      if (chance(rng, 0.6)) put(TILE.TABLE);
      if (chance(rng, 0.5)) put(TILE.SHELF, 'shelf', 2);
      break;
    case 'bedroom':
      put(TILE.BED);
      if (chance(rng, 0.7)) put(TILE.SHELF, 'shelf', 1);
      if (chance(rng, 0.4)) put(TILE.CABINET, 'cabinet', 1);
      break;
    case 'bath':
      put(TILE.CABINET, 'cabinet', 1);
      break;
    case 'office':
      put(TILE.DESK, 'desk', 1);
      if (chance(rng, 0.7)) put(TILE.CABINET, 'cabinet', 2);
      if (chance(rng, 0.6)) put(TILE.SHELF, 'shelf', 2);
      break;
    case 'storage':
      for (let i = 0; i < randInt(rng, 1, 4); i++) put(chance(rng, 0.5) ? TILE.CRATE : TILE.BARREL, 'crate', 2);
      if (chance(rng, 0.6)) put(TILE.SHELF, 'shelf', 2);
      break;
    case 'shop':
      for (let i = 0; i < randInt(rng, 2, 5); i++) put(TILE.SHELF, 'shelf', 2);
      if (chance(rng, 0.7)) put(TILE.COUNTER, 'counter', 2);
      if (chance(rng, 0.5)) put(TILE.LOCKER, 'locker', 2);
      break;
  }

  // ceiling light in bigger rooms
  if (w >= 3 && h >= 3 && chance(rng, style === 'warehouse' ? 0.4 : 0.55)) {
    world.lights.push({
      x: cx * TS + 8, y: cy * TS + 8, r: 62, i: 0.62, night: false,
      flicker: chance(rng, 0.18), on: true
    });
  }
}

function containerName(t) {
  return { fridge: 'Refrigerator', shelf: 'Shelf', cabinet: 'Cabinet', locker: 'Locker', crate: 'Crate', desk: 'Desk', counter: 'Counter' }[t] || 'Container';
}

// recursive room split
function splitRooms(rng, x0, y0, x1, y1, count, out) {
  if (count <= 1 || x1 - x0 < 6 || y1 - y0 < 6) { out.push({ x0, y0, x1, y1 }); return; }
  const w = x1 - x0, h = y1 - y0;
  if (w >= h) {
    const cut = x0 + Math.max(3, Math.min(w - 3, Math.floor(w * (0.4 + rng() * 0.2))));
    const left = 1 + Math.floor(rng() * (count - 1));
    splitRooms(rng, x0, y0, cut - 1, y1, left, out);
    splitRooms(rng, cut, y0, x1, y1, count - left, out);
  } else {
    const cut = y0 + Math.max(3, Math.min(h - 3, Math.floor(h * (0.4 + rng() * 0.2))));
    const top = 1 + Math.floor(rng() * (count - 1));
    splitRooms(rng, x0, y0, x1, cut - 1, top, out);
    splitRooms(rng, x0, cut, x1, y1, count - top, out);
  }
}
