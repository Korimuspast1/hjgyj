// Tile definitions + procedurally generated pixel-art texture atlas
export const TS = 16;

export const TILE = {
  VOID: 0,
  ASPHALT: 1,
  SIDEWALK: 2,
  GRASS: 3,
  ROAD_LINE: 4,
  DIRT: 5,
  FLOOR_WOOD: 6,
  FLOOR_TILE: 7,
  FLOOR_CONCRETE: 8,
  CARPET: 9,
  FLOOR_CRACK: 10,
  WALL: 11,
  WALL_BRICK: 12,
  WALL_EXT: 13,
  DOOR: 14,
  WINDOW: 15,
  GLASS: 16,
  FENCE: 17,
  RAIL: 18,
  RUBBLE: 19,
  WATER: 20,
  TABLE: 21,
  SHELF: 22,
  COUNTER: 23,
  DESK: 24,
  BED: 25,
  CRATE: 26,
  BARREL: 27,
  PILLAR: 28,
  LOCKER: 29,
  FRIDGE: 30,
  CABINET: 31,
  TV: 32,
  BENCH: 33,
  PATH: 34,
  STAIRS: 35,
};

export const N_TILES = 36;

const info = {};
function def(id, o) {
  info[id] = Object.assign({ solid: false, opaque: false, floor: true, light: 0, breakable: false, kind: 'floor' }, o);
}
def(TILE.VOID, { solid: true, opaque: true, floor: false, kind: 'void' });
def(TILE.ASPHALT, { kind: 'road' });
def(TILE.SIDEWALK, { kind: 'road' });
def(TILE.ROAD_LINE, { kind: 'road' });
def(TILE.GRASS, { kind: 'outdoor' });
def(TILE.DIRT, { kind: 'outdoor' });
def(TILE.PATH, { kind: 'outdoor' });
def(TILE.WATER, { solid: true, kind: 'water' });
def(TILE.FLOOR_WOOD, { kind: 'indoor' });
def(TILE.FLOOR_TILE, { kind: 'indoor' });
def(TILE.FLOOR_CONCRETE, { kind: 'indoor' });
def(TILE.CARPET, { kind: 'indoor' });
def(TILE.FLOOR_CRACK, { kind: 'indoor' });
def(TILE.WALL, { solid: true, opaque: true, floor: false, kind: 'wall' });
def(TILE.WALL_BRICK, { solid: true, opaque: true, floor: false, kind: 'wall' });
def(TILE.WALL_EXT, { solid: true, opaque: true, floor: false, kind: 'wall' });
def(TILE.DOOR, { solid: true, floor: false, kind: 'door' });
def(TILE.WINDOW, { solid: true, opaque: true, floor: false, kind: 'window', breakable: true });
def(TILE.GLASS, { solid: true, floor: false, kind: 'window', breakable: true });
def(TILE.FENCE, { solid: true, floor: false, kind: 'fence' });
def(TILE.RAIL, { solid: true, floor: false, kind: 'fence' });
def(TILE.RUBBLE, { kind: 'outdoor' });
def(TILE.TABLE, { solid: true, floor: false, kind: 'furniture' });
def(TILE.SHELF, { solid: true, opaque: true, floor: false, kind: 'furniture' });
def(TILE.COUNTER, { solid: true, floor: false, kind: 'furniture' });
def(TILE.DESK, { solid: true, floor: false, kind: 'furniture' });
def(TILE.BED, { solid: true, floor: false, kind: 'furniture' });
def(TILE.CRATE, { solid: true, floor: false, kind: 'furniture' });
def(TILE.BARREL, { solid: true, floor: false, kind: 'furniture' });
def(TILE.PILLAR, { solid: true, opaque: true, floor: false, kind: 'furniture' });
def(TILE.LOCKER, { solid: true, opaque: true, floor: false, kind: 'furniture' });
def(TILE.FRIDGE, { solid: true, opaque: true, floor: false, kind: 'furniture' });
def(TILE.CABINET, { solid: true, opaque: true, floor: false, kind: 'furniture' });
def(TILE.TV, { solid: true, floor: false, kind: 'furniture' });
def(TILE.BENCH, { solid: true, floor: false, kind: 'furniture' });
def(TILE.STAIRS, { kind: 'indoor' });

export const TILE_INFO = info;

export function tileInfo(id) { return info[id] || info[TILE.VOID]; }

// ---------------------------------------------------------------- atlas
function px(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }

function speckle(ctx, rng, x, y, colors, count, s = 1) {
  for (let i = 0; i < count; i++) {
    px(ctx, x + ((rng() * TS) | 0), y + ((rng() * TS) | 0), s, s, colors[(rng() * colors.length) | 0]);
  }
}

function drawTile(ctx, id, ox, oy, rng) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.beginPath(); ctx.rect(0, 0, TS, TS); ctx.clip();
  switch (id) {
    case TILE.ASPHALT: {
      px(ctx, 0, 0, TS, TS, '#33343a');
      speckle(ctx, rng, 0, 0, ['#2b2c31', '#3c3d44', '#383940', '#2f3036'], 26);
      px(ctx, 0, 0, TS, 1, '#2a2b30');
      break;
    }
    case TILE.ROAD_LINE: {
      px(ctx, 0, 0, TS, TS, '#33343a');
      speckle(ctx, rng, 0, 0, ['#2b2c31', '#3c3d44'], 18);
      ctx.fillStyle = '#b3a04a'; ctx.fillRect(7, 0, 2, TS);
      break;
    }
    case TILE.SIDEWALK: {
      px(ctx, 0, 0, TS, TS, '#5d5d58');
      speckle(ctx, rng, 0, 0, ['#55554f', '#67675f', '#4e4e49'], 20);
      px(ctx, 0, 0, TS, 1, '#484842');
      px(ctx, 0, 0, 1, TS, '#484842');
      px(ctx, 0, 8, TS, 1, '#4b4b45');
      break;
    }
    case TILE.GRASS: {
      px(ctx, 0, 0, TS, TS, '#33502f');
      speckle(ctx, rng, 0, 0, ['#2b4529', '#3a5b34', '#38552f', '#2f4a2c'], 34);
      break;
    }
    case TILE.PATH: {
      px(ctx, 0, 0, TS, TS, '#5b5344');
      speckle(ctx, rng, 0, 0, ['#4f483b', '#665d4c'], 22);
      break;
    }
    case TILE.DIRT: {
      px(ctx, 0, 0, TS, TS, '#4d3d2b');
      speckle(ctx, rng, 0, 0, ['#433425', '#584634', '#3b2d21'], 26);
      break;
    }
    case TILE.RUBBLE: {
      px(ctx, 0, 0, TS, TS, '#4a4a48');
      speckle(ctx, rng, 0, 0, ['#3b3b39', '#565653', '#46453f'], 30);
      break;
    }
    case TILE.WATER: {
      px(ctx, 0, 0, TS, TS, '#1d3a4a');
      speckle(ctx, rng, 0, 0, ['#22455a', '#193444'], 20);
      px(ctx, 0, 3, TS, 1, '#2a5468');
      break;
    }
    case TILE.FLOOR_WOOD: {
      px(ctx, 0, 0, TS, TS, '#6b4a2e');
      for (let i = 0; i < 4; i++) {
        const y = i * 4;
        px(ctx, 0, y, TS, 4, ['#6b4a2e', '#72502f', '#634429', '#6e4c2c'][i]);
        px(ctx, 0, y, TS, 1, '#4f3520');
        for (let k = 0; k < 3; k++) px(ctx, (rng() * TS) | 0, y + 1 + ((rng() * 3) | 0), 2, 1, '#573a22');
      }
      break;
    }
    case TILE.FLOOR_TILE: {
      px(ctx, 0, 0, TS, TS, '#6a6a61');
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        px(ctx, i * 8, j * 8, 8, 8, ['#6a6a61', '#717166', '#63635a', '#6d6d63'][(rng() * 4) | 0]);
      }
      px(ctx, 0, 0, TS, 1, '#63635a'); px(ctx, 0, 0, 1, TS, '#63635a');
      px(ctx, 8, 0, 1, TS, '#63635a'); px(ctx, 0, 8, TS, 1, '#63635a');
      break;
    }
    case TILE.FLOOR_CONCRETE: {
      px(ctx, 0, 0, TS, TS, '#55555a');
      speckle(ctx, rng, 0, 0, ['#4c4c51', '#5e5e63', '#515156'], 22);
      px(ctx, 0, 0, TS, 1, '#46464b');
      break;
    }
    case TILE.CARPET: {
      px(ctx, 0, 0, TS, TS, '#5a3138');
      speckle(ctx, rng, 0, 0, ['#4e2b31', '#66373d'], 26);
      break;
    }
    case TILE.FLOOR_CRACK: {
      px(ctx, 0, 0, TS, TS, '#5c5c52');
      speckle(ctx, rng, 0, 0, ['#50504a', '#68685e'], 18);
      ctx.strokeStyle = '#3f3f38'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2 + rng() * 4, 0); ctx.lineTo(6 + rng() * 4, 8); ctx.lineTo(4 + rng() * 6, 16); ctx.stroke();
      break;
    }
    case TILE.WALL: {
      px(ctx, 0, 0, TS, TS, '#5a4c3c');
      speckle(ctx, rng, 0, 0, ['#4d4133', '#63533f'], 20);
      px(ctx, 0, 0, TS, 2, '#6b5a46');
      px(ctx, 0, TS - 2, TS, 2, '#3a3025');
      px(ctx, 0, 0, 2, TS, '#514435');
      px(ctx, TS - 2, 0, 2, TS, '#514435');
      break;
    }
    case TILE.WALL_BRICK: {
      px(ctx, 0, 0, TS, TS, '#4d3a30');
      for (let r = 0; r < 4; r++) {
        const y = r * 4;
        px(ctx, 0, y, TS, 1, '#3d2d25');
        const off = (r % 2) * 4;
        for (let c = 0; c < 2; c++) {
          const x = (off + c * 8) % TS;
          px(ctx, x, y + 1, 1, 3, '#3d2d25');
          px(ctx, x + 1, y + 1, 7, 3, ['#5c4436', '#674c3c', '#523b2f'][(rng() * 3) | 0]);
        }
      }
      break;
    }
    case TILE.WALL_EXT: {
      px(ctx, 0, 0, TS, TS, '#7a7166');
      speckle(ctx, rng, 0, 0, ['#6d655b', '#857c70'], 20);
      px(ctx, 0, 0, TS, 2, '#8d8478');
      px(ctx, 0, TS - 3, TS, 3, '#4c463e');
      break;
    }
    case TILE.DOOR: {
      px(ctx, 0, 0, TS, TS, '#5c3f24');
      speckle(ctx, rng, 0, 0, ['#513623', '#68482a'], 12);
      px(ctx, 0, 0, 2, TS, '#3a2716'); px(ctx, TS - 2, 0, 2, TS, '#3a2716');
      px(ctx, 0, 0, TS, 1, '#402b1a');
      px(ctx, 11, 8, 2, 2, '#c9a227');
      break;
    }
    case TILE.WINDOW: {
      px(ctx, 0, 0, TS, TS, '#3a4448');
      px(ctx, 2, 2, 12, 11, '#1e3b46');
      px(ctx, 3, 3, 10, 3, '#2d5a68');
      px(ctx, 3, 8, 10, 3, '#24485a');
      px(ctx, 7, 2, 1, 11, '#2b3236');
      px(ctx, 2, 6, 12, 1, '#2b3236');
      px(ctx, 0, 0, TS, 2, '#4d5a5e');
      break;
    }
    case TILE.GLASS: {
      px(ctx, 0, 0, TS, TS, '#1b2f38');
      ctx.globalAlpha = 0.45;
      px(ctx, 2, 2, 12, 11, '#5d8ea3');
      ctx.globalAlpha = 1;
      px(ctx, 3, 3, 4, 4, '#7fa8b8');
      px(ctx, 9, 8, 3, 3, '#7fa8b8');
      px(ctx, 0, 0, TS, 2, '#43504f');
      px(ctx, 0, 0, 2, TS, '#43504f');
      break;
    }
    case TILE.FENCE: {
      px(ctx, 0, 0, TS, TS, '#3d4a33');
      px(ctx, 2, 1, 2, TS, '#6b5537');
      px(ctx, 12, 1, 2, TS, '#6b5537');
      px(ctx, 0, 5, TS, 2, '#7a6242');
      px(ctx, 0, 10, TS, 2, '#7a6242');
      break;
    }
    case TILE.RAIL: {
      px(ctx, 0, 0, TS, TS, '#3a3f42');
      px(ctx, 0, 6, TS, 2, '#5d6468');
      px(ctx, 0, 3, TS, 1, '#4a5155');
      break;
    }
    case TILE.TABLE: {
      px(ctx, 0, 0, TS, TS, '#6b4a2e');
      px(ctx, 0, 0, TS, 2, '#7d5836');
      px(ctx, 0, TS - 2, TS, 2, '#4b3220');
      px(ctx, 0, 0, 2, TS, '#5c3f26'); px(ctx, TS - 2, 0, 2, TS, '#5c3f26');
      speckle(ctx, rng, 2, 3, ['#6b4a2e', '#75522f'], 6);
      break;
    }
    case TILE.SHELF: {
      px(ctx, 0, 0, TS, TS, '#3d2e1f');
      for (let i = 0; i < 3; i++) {
        px(ctx, 1, 1 + i * 5, 14, 4, '#6d543a');
        px(ctx, 1, 1 + i * 5, 14, 1, '#82654a');
        for (let k = 0; k < 3; k++) px(ctx, 2 + ((rng() * 12) | 0), 2 + i * 5, 2, 3, ['#7a5a3a', '#5c6a5c', '#6a4a4a', '#4a5a6a'][(rng() * 4) | 0]);
      }
      break;
    }
    case TILE.COUNTER: {
      px(ctx, 0, 0, TS, TS, '#6d6f70');
      speckle(ctx, rng, 0, 0, ['#5f6162', '#7a7c7d'], 12);
      px(ctx, 0, 0, TS, 3, '#838586');
      px(ctx, 0, TS - 2, TS, 2, '#4a4c4d');
      break;
    }
    case TILE.DESK: {
      px(ctx, 0, 0, TS, TS, '#4e3626');
      px(ctx, 0, 0, TS, 2, '#5e4230');
      px(ctx, 0, TS - 2, TS, 2, '#37251a');
      px(ctx, 4, 5, 7, 5, '#2f3a3e');
      px(ctx, 5, 6, 5, 3, '#4a6068');
      break;
    }
    case TILE.BED: {
      px(ctx, 0, 0, TS, TS, '#4a4f55');
      px(ctx, 1, 2, 14, 12, '#7b7f86');
      px(ctx, 2, 3, 12, 3, '#a9adb2');
      px(ctx, 2, 8, 12, 5, '#6a6e75');
      break;
    }
    case TILE.CRATE: {
      px(ctx, 0, 0, TS, TS, '#6b5334');
      px(ctx, 0, 0, TS, 2, '#7d6240');
      px(ctx, 0, TS - 2, TS, 2, '#4b3a24');
      px(ctx, 0, 0, 2, TS, '#5b4529');
      ctx.strokeStyle = '#4b3a24'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(13, 13); ctx.moveTo(13, 2); ctx.lineTo(2, 13); ctx.stroke();
      break;
    }
    case TILE.BARREL: {
      px(ctx, 0, 0, TS, TS, '#33383a');
      px(ctx, 1, 1, 14, 14, '#4a5154');
      px(ctx, 3, 3, 10, 10, '#565e61');
      px(ctx, 1, 5, 14, 1, '#3c4244');
      px(ctx, 1, 10, 14, 1, '#3c4244');
      px(ctx, 6, 6, 4, 4, '#6a7376');
      break;
    }
    case TILE.PILLAR: {
      px(ctx, 0, 0, TS, TS, '#5c5b57');
      px(ctx, 2, 2, 12, 12, '#6d6c67');
      px(ctx, 3, 3, 10, 2, '#7a7974');
      px(ctx, 3, 11, 10, 2, '#4c4b47');
      break;
    }
    case TILE.LOCKER: {
      px(ctx, 0, 0, TS, TS, '#3f4a46');
      px(ctx, 1, 1, 14, 14, '#4e5b56');
      px(ctx, 1, 7, 14, 1, '#333c39');
      px(ctx, 6, 6, 1, 2, '#b9c0b6'); px(ctx, 9, 6, 1, 2, '#b9c0b6');
      break;
    }
    case TILE.FRIDGE: {
      px(ctx, 0, 0, TS, TS, '#8d938e');
      px(ctx, 1, 1, 14, 6, '#9ba19b');
      px(ctx, 1, 8, 14, 7, '#868c87');
      px(ctx, 11, 3, 1, 3, '#4a504c');
      px(ctx, 11, 10, 1, 3, '#4a504c');
      break;
    }
    case TILE.CABINET: {
      px(ctx, 0, 0, TS, TS, '#4a3a28');
      px(ctx, 1, 1, 14, 14, '#5d4933');
      px(ctx, 1, 7, 14, 1, '#3a2d1f');
      px(ctx, 7, 5, 1, 2, '#c9a227'); px(ctx, 9, 5, 1, 2, '#c9a227');
      break;
    }
    case TILE.TV: {
      px(ctx, 0, 0, TS, TS, '#26292c');
      px(ctx, 1, 1, 14, 10, '#121517');
      px(ctx, 2, 2, 12, 8, '#1b2024');
      px(ctx, 3, 3, 4, 3, '#2a3237');
      px(ctx, 5, 12, 6, 3, '#1c2023');
      break;
    }
    case TILE.BENCH: {
      px(ctx, 0, 0, TS, TS, '#3d4a33');
      px(ctx, 1, 4, 14, 6, '#6b5537');
      px(ctx, 1, 4, 14, 1, '#7d6444');
      px(ctx, 1, 9, 14, 1, '#4b3a24');
      break;
    }
    case TILE.STAIRS: {
      px(ctx, 0, 0, TS, TS, '#585952');
      for (let i = 0; i < 4; i++) {
        px(ctx, 0, i * 4, TS, 3, ['#61625a', '#54554e', '#6a6b62', '#4d4e47'][i]);
        px(ctx, 0, i * 4 + 3, TS, 1, '#3f403a');
      }
      break;
    }
    default: {
      px(ctx, 0, 0, TS, TS, '#101010');
    }
  }
  ctx.restore();
}

export function buildAtlas(seed = 12345) {
  const variants = 4;
  const atlas = document.createElement('canvas');
  atlas.width = variants * TS;
  atlas.height = N_TILES * TS;
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const index = {};
  let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let id = 0; id < N_TILES; id++) {
    index[id] = [];
    for (let v = 0; v < variants; v++) {
      drawTile(ctx, id, v * TS, id * TS, rnd);
      index[id].push([v * TS, id * TS]);
    }
  }
  return { canvas: atlas, index };
}
