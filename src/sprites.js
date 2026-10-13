/**
 * Pixel sprites, generated from code (no image files are needed to run the game).
 *
 * Every sprite is described by simple primitives (ellipses, rectangles, lines,
 * dots). `rasterize` paints them onto a small grid of palette entries, adds a
 * one-pixel ink outline and returns the pixels. `buildSheet` packs all sprites
 * into one RGBA atlas. tools/build-atlas.mjs writes that atlas to
 * assets/atlas.png, and the browser uses the same code as a fallback.
 *
 * Palette: 32 colours, no anti-aliasing. Each palette entry is a named colour.
 * Ant and enemy colours are picked from the same palette.
 *
 * This module has no DOM dependency, so the Node test-suite and build script can import it.
 */

/** The 32-colour palette. Order matters: the index is the palette id. */
export const PALETTE = Object.freeze({
  ink: '#1b1410',
  dirt0: '#4b3423',
  dirt1: '#5f4530',
  dirt2: '#77573c',
  sand0: '#d8b574',
  sand1: '#cfa766',
  sand2: '#c49a58',
  sand3: '#e6c88e',
  clay0: '#a8603f',
  clay1: '#8e4f35',
  rock0: '#6d6a68',
  rock1: '#55524f',
  rock2: '#86827e',
  water0: '#2c6fa8',
  water1: '#3f8fcc',
  water2: '#8fd3f0',
  glass0: '#a9d9e6',
  glass1: '#e4f7fc',
  leaf0: '#3e8a3c',
  leaf1: '#67b84a',
  yellow: '#f0d75a',
  red: '#d8402f',
  cream: '#f3e9c6',
  larva: '#f2c9a0',
  orange: '#c77d3a',
  pink: '#e8a0b0',
  violet: '#6b5b95',
  tunnel: '#2b1d14',
  chamber: '#3d2a1c',
  air0: '#c7e6f0',
  air1: '#a9cfe0',
  grey: '#9aa0a6',
});

/** Palette names in index order; `PALETTE_KEYS.indexOf(name)` gives the id. */
export const PALETTE_KEYS = Object.freeze(Object.keys(PALETTE));

/** Hex colour string for a palette name. Throws on unknown names so typos fail fast. */
export function colorOf(name) {
  const hex = PALETTE[name];
  if (!hex) throw new Error(`Unknown palette colour: ${name}`);
  return hex;
}

/** Body colours per ant role: body fill, shade (lower half) and optional big-headed flag. */
export const ROLE_TINTS = Object.freeze({
  worker: { body: 'orange', shade: 'clay1' },
  digger: { body: 'clay0', shade: 'clay1' },
  forager: { body: 'yellow', shade: 'orange' },
  nurse: { body: 'larva', shade: 'sand2' },
  soldier: { body: 'clay1', shade: 'dirt0', big: true },
  builder: { body: 'grey', shade: 'rock1' },
  scout: { body: 'water2', shade: 'water1' },
  undertaker: { body: 'violet', shade: 'dirt1' },
});

// ---- Rasterizer -----------------------------------------------------------------

/**
 * Paints a sprite spec onto a grid.
 * Spec: { w, h, outline?: boolean, shapes?: [...], lines?: [...], dots?: [...] }
 *  shapes: { e: [cx, cy, rx, ry], fill, shade? } or { r: [x0, y0, x1, y1], fill }
 *  lines:  [x0, y0, x1, y1, colour?]   (Bresenham, drawn last, default ink)
 *  dots:   [x, y, colour]
 * @returns {Array<string|null>} row-major colour names (null = transparent)
 */
export function rasterize(spec) {
  const { w, h } = spec;
  const grid = new Array(w * h).fill(null);
  const set = (x, y, colour) => {
    if (x >= 0 && y >= 0 && x < w && y < h) grid[y * w + x] = colour;
  };

  for (const s of spec.shapes || []) {
    if (s.r) {
      const [x0, y0, x1, y1] = s.r;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) set(x, y, s.fill);
      continue;
    }
    const [cx, cy, rx, ry] = s.e;
    const shadeFrom = cy + ry * 0.3;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x + 0.5;
        const py = y + 0.5;
        const d = ((px - cx) / rx) ** 2 + ((py - cy) / ry) ** 2;
        if (d <= 1) set(x, y, s.shade && py > shadeFrom ? s.shade : s.fill);
      }
    }
  }

  if (spec.outline !== false) {
    // Outline = empty pixels that touch a filled pixel (4-neighbourhood).
    const filled = grid.map((c) => c !== null);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (filled[i]) continue;
        const touches =
          (x > 0 && filled[i - 1]) ||
          (x < w - 1 && filled[i + 1]) ||
          (y > 0 && filled[i - w]) ||
          (y < h - 1 && filled[i + w]);
        if (touches) grid[i] = 'ink';
      }
    }
  }

  for (const [x0, y0, x1, y1, colour = 'ink'] of spec.lines || []) {
    // Bresenham line.
    let x = x0;
    let y = y0;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      set(x, y, colour);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  for (const [x, y, colour] of spec.dots || []) set(x, y, colour);
  return grid;
}

// ---- Entity specs ---------------------------------------------------------------

/**
 * Side-view ant facing right, 12x9 pixels. Anatomy from back to front:
 * gaster (abdomen), petiole (waist), thorax with three pairs of legs, head with
 * eye, antennae and mandibles. Poses:
 *   'walk'  - leg pose alternates with `frame` (0/1) for the walk cycle
 *   'dig'   - head lowered, mandibles pushed into the ground (frame = leg step)
 *   'bite'  - head raised, mandibles open (fighting)
 * `big` gives soldiers a larger head.
 */
function antSpec(tint, pose = 'walk', frame = 0, big = false) {
  const headR = big ? 1.9 : 1.6;
  // Head centre moves with the pose: digging lowers it, biting raises it.
  const head = pose === 'dig' ? [8.9, 4.4] : pose === 'bite' ? [8.9, 2.4] : [8.9, 3.2];
  // Legs: attachment point on the body, then foot offsets for frame 0 and 1.
  const legSets = [
    { at: [7, 5], feet: [[2, -1], [0, 2]] }, // front
    { at: [5, 5], feet: [[-1, 2], [2, -1]] }, // middle
    { at: [3, 6], feet: [[-2, 0], [-1, 1]] }, // hind
  ];
  const lines = [
    [8, 1, 10, 0], // antenna forward
    [8, 1, 6, 0], // antenna back
  ];
  const legLines = legSets.map(({ at, feet }) => {
    const [dx, dy] = feet[frame & 1];
    return [at[0], at[1], at[0] + dx, 8, 'ink'];
  });
  if (pose === 'bite') {
    lines.push([10, 3, 12, 1], [10, 4, 12, 6]); // mandibles open
  } else if (pose === 'dig') {
    lines.push([10, 5, 10, 7]); // mandible in the sand
  } else {
    lines.push([10, 4, 11, 4]); // closed mandibles
  }
  return {
    w: 12,
    h: 9,
    shapes: [
      { e: [2.6, 4.4, 2.5, 2.2], fill: tint.shade, shade: tint.shade }, // gaster (darker, so segments read apart)
      { e: [4.9, 4.9, 0.8, 0.8], fill: 'ink' }, // petiole (waist)
      { e: [6.4, 4.0, 1.7, 1.6], fill: tint.body, shade: tint.shade }, // thorax
      { e: [head[0], head[1], headR, headR], fill: tint.body, shade: tint.shade }, // head
    ],
    lines: [...lines, ...legLines],
    dots: [[Math.round(head[0]) + 1, Math.round(head[1]) - 1, 'ink']], // eye
  };
}

/** Queen: the same skeleton, bigger gaster, pale body. */
function queenSpec(frame) {
  const spec = antSpec({ body: 'pink', shade: 'violet' }, 'walk', frame, false);
  spec.shapes[0] = { e: [2.4, 4.6, 3.0, 2.8], fill: 'pink', shade: 'violet' };
  spec.shapes.unshift({ e: [4.2, 2.0, 3.6, 1.2], fill: 'glass1' }); // wings
  spec.w = 13;
  return spec;
}

/** Raiders: red body with heavy mandibles. */
function enemyAntSpec(frame) {
  const spec = antSpec({ body: 'red', shade: 'dirt0' }, 'walk', frame, false);
  spec.lines.push([10, 4, 12, 3, 'ink'], [10, 5, 12, 6, 'ink']);
  return spec;
}

function beetleSpec(frame) {
  const legs = frame === 0 ? [[2, 7], [5, 7], [8, 7]] : [[3, 7], [6, 7], [9, 7]];
  return {
    w: 12,
    h: 9,
    shapes: [
      { e: [5.2, 4.0, 4.4, 3.0], fill: 'leaf0', shade: 'dirt0' },
      { e: [9.6, 4.0, 1.6, 1.5], fill: 'dirt0' },
    ],
    lines: [
      [2, 2, 8, 2, 'leaf1'], // shell highlight
      [1, 4, 8, 4, 'leaf1'],
    ],
    dots: [...legs.map(([x, y]) => [x, y, 'ink']), [10, 3, 'ink']],
  };
}

function spiderSpec(frame) {
  const d = frame === 0 ? 0 : 1;
  return {
    w: 13,
    h: 10,
    shapes: [
      { e: [3.5, 5.0, 2.8, 2.6], fill: 'violet', shade: 'dirt0' },
      { e: [9.2, 4.6, 2.2, 2.0], fill: 'violet', shade: 'dirt0' },
    ],
    lines: [
      [5, 3, 1, 0 + d],
      [5, 4, 0, 4 + d],
      [4, 6, 0, 8 - d],
      [5, 7, 2, 9],
      [7, 3, 5, 0],
      [8, 2, 10, 0],
      [9, 7, 6, 9],
      [10, 7, 12, 9 - d],
    ],
    dots: [
      [10, 3, 'red'],
      [11, 3, 'red'],
    ],
  };
}

function eggSpec() {
  return { w: 4, h: 5, shapes: [{ e: [2, 2.5, 1.7, 2.2], fill: 'cream', shade: 'sand3' }] };
}

function larvaSpec() {
  return {
    w: 7,
    h: 5,
    shapes: [{ e: [3, 2.5, 2.9, 1.9], fill: 'larva', shade: 'sand2' }],
    dots: [[5, 2, 'ink']],
  };
}

function pupaSpec() {
  return { w: 5, h: 6, shapes: [{ e: [2.5, 3, 2.0, 2.6], fill: 'sand3', shade: 'sand2' }] };
}

function seedSpec() {
  return { w: 5, h: 4, shapes: [{ e: [2.5, 2, 2.0, 1.4], fill: 'sand3', shade: 'sand2' }] };
}

function leafSpec() {
  return {
    w: 8,
    h: 5,
    shapes: [{ e: [3.5, 2.5, 3.2, 1.9], fill: 'leaf1', shade: 'leaf0' }],
    lines: [[1, 2, 6, 2, 'leaf0']],
  };
}

function sugarSpec() {
  return { w: 5, h: 5, shapes: [{ r: [1, 1, 4, 4], fill: 'glass1' }, { r: [1, 3, 4, 4], fill: 'glass0' }] };
}

function corpseSpec() {
  return {
    w: 8,
    h: 5,
    shapes: [{ e: [3.5, 2.5, 3.0, 2.0], fill: 'rock2', shade: 'rock1' }],
    dots: [
      [2, 2, 'violet'],
      [5, 2, 'violet'],
    ],
  };
}

// ---- UI icons (16x16) ----------------------------------------------------------

function uiSand() {
  return {
    w: 16,
    h: 16,
    shapes: [{ r: [0, 0, 16, 16], fill: 'sand0' }],
    dots: [
      [2, 3, 'sand2'], [7, 1, 'sand1'], [11, 5, 'sand3'], [4, 9, 'sand1'], [13, 11, 'sand2'],
      [9, 14, 'sand3'], [1, 13, 'sand2'], [6, 6, 'sand3'], [14, 3, 'sand1'], [3, 6, 'sand1'],
    ],
  };
}

function uiDirt() {
  return {
    w: 16,
    h: 16,
    shapes: [{ r: [0, 0, 16, 16], fill: 'dirt1' }],
    dots: [
      [2, 3, 'dirt0'], [7, 1, 'dirt2'], [11, 5, 'dirt0'], [4, 9, 'dirt2'], [13, 11, 'dirt0'],
      [9, 14, 'dirt2'], [1, 13, 'dirt0'], [6, 6, 'dirt2'], [14, 3, 'dirt0'],
    ],
  };
}

function uiClay() {
  return {
    w: 16,
    h: 16,
    shapes: [{ r: [0, 0, 16, 16], fill: 'clay0' }],
    lines: [
      [0, 5, 15, 5, 'clay1'],
      [0, 11, 15, 11, 'clay1'],
    ],
  };
}

function uiRock() {
  return {
    w: 16,
    h: 16,
    shapes: [{ e: [8, 8.5, 7, 6], fill: 'rock0', shade: 'rock1' }],
    dots: [[5, 4, 'rock2'], [6, 4, 'rock2'], [4, 5, 'rock2']],
  };
}

function uiWater() {
  return {
    w: 16,
    h: 16,
    shapes: [
      { e: [8, 10.5, 4.6, 4.4], fill: 'water1', shade: 'water0' },
      { e: [8, 6.5, 2.2, 4.0], fill: 'water1' },
    ],
    dots: [[6, 10, 'water2'], [6, 9, 'water2']],
  };
}

function uiTunnel() {
  return {
    w: 16,
    h: 16,
    shapes: [
      { r: [0, 0, 16, 16], fill: 'dirt1' },
      { e: [8, 12, 5, 6], fill: 'tunnel' },
    ],
  };
}

function uiChamber() {
  return {
    w: 16,
    h: 16,
    shapes: [
      { r: [0, 0, 16, 16], fill: 'dirt1' },
      { e: [8, 8, 6, 6], fill: 'chamber' },
      { e: [8, 8, 2.5, 2.5], fill: 'air1' },
    ],
  };
}

function uiEraser() {
  return {
    w: 16,
    h: 16,
    shapes: [
      { r: [3, 4, 13, 12], fill: 'pink' },
      { r: [3, 4, 13, 7], fill: 'red' },
    ],
  };
}

function uiInspect() {
  return {
    w: 16,
    h: 16,
    shapes: [{ e: [7, 7, 4.5, 4.5], fill: 'glass1', shade: 'glass0' }],
    lines: [
      [10, 10, 14, 14],
      [11, 10, 14, 13],
    ],
  };
}

/** Pale magenta/ink checker: shown when a sprite name is unknown. */
function missingSpec() {
  return {
    w: 8,
    h: 8,
    outline: false,
    shapes: [{ r: [0, 0, 8, 8], fill: 'red' }],
    dots: [
      [0, 0, 'ink'], [1, 0, 'ink'], [2, 0, 'ink'], [3, 0, 'ink'],
      [4, 1, 'ink'], [5, 1, 'ink'], [6, 1, 'ink'], [7, 1, 'ink'],
    ],
  };
}

/**
 * Builds every sprite spec, keyed by sprite name. Names are referenced by
 * tools.js (icons), render.js (entities) and the atlas.
 * @returns {Object<string, object>}
 */
export function buildSpecs() {
  const specs = {};
  for (const [role, tint] of Object.entries(ROLE_TINTS)) {
    const big = !!tint.big;
    specs[`ant_${role}_0`] = antSpec(tint, 'walk', 0, big);
    specs[`ant_${role}_1`] = antSpec(tint, 'walk', 1, big);
    specs[`ant_${role}_dig0`] = antSpec(tint, 'dig', 0, big);
    specs[`ant_${role}_dig1`] = antSpec(tint, 'dig', 1, big);
    specs[`ant_${role}_bite`] = antSpec(tint, 'bite', 0, big);
  }
  specs.queen_0 = queenSpec(0);
  specs.queen_1 = queenSpec(1);
  specs.raider_0 = enemyAntSpec(0);
  specs.raider_1 = enemyAntSpec(1);
  specs.beetle_0 = beetleSpec(0);
  specs.beetle_1 = beetleSpec(1);
  specs.spider_0 = spiderSpec(0);
  specs.spider_1 = spiderSpec(1);
  specs.egg = eggSpec();
  specs.larva = larvaSpec();
  specs.pupa = pupaSpec();
  specs.food_seed = seedSpec();
  specs.food_leaf = leafSpec();
  specs.food_sugar = sugarSpec();
  specs.food_corpse = corpseSpec();
  specs.ui_sand = uiSand();
  specs.ui_dirt = uiDirt();
  specs.ui_clay = uiClay();
  specs.ui_rock = uiRock();
  specs.ui_water = uiWater();
  specs.ui_tunnel = uiTunnel();
  specs.ui_chamber = uiChamber();
  specs.ui_eraser = uiEraser();
  specs.ui_inspect = uiInspect();
  specs.missing = missingSpec();
  return specs;
}

// ---- Atlas ----------------------------------------------------------------------

const ATLAS_PAD = 1;

/**
 * Packs all sprites into one RGBA atlas with a shelf packer.
 * @returns {{width: number, height: number, rgba: Uint8Array, frames: Object<string, {x:number,y:number,w:number,h:number}>}}
 */
export function buildSheet() {
  const specs = buildSpecs();
  const names = Object.keys(specs).sort();
  const rasters = new Map(names.map((n) => [n, { spec: specs[n], grid: rasterize(specs[n]) }]));

  // Shelf packing into a power-of-two atlas, 256 px wide.
  const width = 256;
  let x = 0;
  let y = 0;
  let shelfH = 0;
  const frames = {};
  for (const name of names) {
    const { spec } = rasters.get(name);
    if (x + spec.w + ATLAS_PAD > width) {
      x = 0;
      y += shelfH + ATLAS_PAD;
      shelfH = 0;
    }
    frames[name] = { x, y, w: spec.w, h: spec.h };
    x += spec.w + ATLAS_PAD;
    shelfH = Math.max(shelfH, spec.h);
  }
  let height = 1;
  while (height < y + shelfH) height <<= 1;

  const rgba = new Uint8Array(width * height * 4); // fully transparent
  for (const name of names) {
    const { spec, grid } = rasters.get(name);
    const f = frames[name];
    for (let py = 0; py < spec.h; py++) {
      for (let px = 0; px < spec.w; px++) {
        const colour = grid[py * spec.w + px];
        if (colour === null) continue;
        const hex = colorOf(colour);
        const o = ((f.y + py) * width + (f.x + px)) * 4;
        rgba[o] = parseInt(hex.slice(1, 3), 16);
        rgba[o + 1] = parseInt(hex.slice(3, 5), 16);
        rgba[o + 2] = parseInt(hex.slice(5, 7), 16);
        rgba[o + 3] = 255;
      }
    }
  }
  return { width, height, rgba, frames };
}
