/**
 * Renderer: draws the world, creatures and debug overlays into the 480x270
 * viewport. The GUI panel is drawn separately by gui.js.
 *
 * Terrain is rebuilt into an ImageData buffer only when the simulation ticks
 * (or the player paints), not on every display frame. Creatures are drawn as
 * sprites on top. The camera maps world cells to screen pixels with an integer
 * zoom and nearest-neighbour scaling.
 */
import { CELL, FOOD_KIND, CELL_NAMES, SOLID } from './world.js';
import { LAYER, LAYER_NAMES } from './pheromones.js';
import { hash2, clamp } from './utils.js';
import { PALETTE, PALETTE_KEYS, colorOf } from './sprites.js';
import { drawSprite, spriteSize } from './assets.js';
import { drawText, textWidth, GLYPH_HEIGHT } from './font.js';
import { SURFACE_Y, VIEW_WIDTH, VIEW_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT, PHEROMONE_MAX, BRUSH_SIZES } from './config.js';
import { ROLE_LABELS } from './ant.js';

/** Packs a '#rrggbb' colour into a little-endian ABGR uint32 for ImageData. */
function pack(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
}

const PACKED = Object.fromEntries(PALETTE_KEYS.map((k) => [k, pack(PALETTE[k])]));

/** Colour lists per terrain type, picked by a per-cell hash for a dithered look. */
const TERRAIN_COLOURS = {
  [CELL.SAND]: ['sand0', 'sand0', 'sand1', 'sand2', 'sand3'],
  [CELL.DIRT]: ['dirt1', 'dirt1', 'dirt0', 'dirt2'],
  [CELL.CLAY]: ['clay0', 'clay0', 'clay1'],
  [CELL.ROCK]: ['rock0', 'rock0', 'rock2', 'rock1'],
  [CELL.WATER]: ['water1', 'water0', 'water2'],
  [CELL.GLASS]: ['glass0', 'glass0', 'glass1'],
  [CELL.TUNNEL]: ['tunnel', 'tunnel', 'dirt0'],
  [CELL.CHAMBER]: ['chamber', 'chamber', 'tunnel'],
  [CELL.FUNGUS]: ['dirt2'],
};

/** Overlay colours for each pheromone layer (debug view). */
const LAYER_RGB = [
  [60, 120, 255], // home: blue
  [80, 220, 80], // food: green
  [255, 60, 60], // danger: red
  [255, 220, 60], // explore: yellow
];

/** Creature sprites are named after roles/species, with a walk-frame suffix. */
/**
 * Picks the sprite for an ant from its role, walk-cycle frame and current task:
 * fighting shows the bite pose, active digging shows the dig pose, otherwise walk.
 */
function antSpriteName(ant) {
  const f = ant.animFrame & 1;
  if (ant.task.kind === 'fight') return `ant_${ant.role}_bite`;
  if (ant.task.kind === 'dig' && ant.digTarget >= 0) return `ant_${ant.role}_dig${f}`;
  return `ant_${ant.role}_${f}`;
}

/** Terrain colour for one cell, as a packed uint32. */
function terrainColour(world, i, x, y, tick) {
  const t = world.type[i];
  const h = hash2(x, y);
  if (t === CELL.EMPTY) {
    return PACKED[h < 0.1 ? 'air1' : 'air0'];
  }
  if (t === CELL.WATER) {
    const shimmer = hash2(x + (tick >> 3), y);
    return PACKED[shimmer < 0.15 ? 'water2' : shimmer < 0.6 ? 'water1' : 'water0'];
  }
  if (t === CELL.FOOD) {
    const kind = world.subtype[i];
    if (kind === FOOD_KIND.SEED) return PACKED[h < 0.5 ? 'sand3' : 'sand2'];
    if (kind === FOOD_KIND.LEAF) return PACKED[h < 0.4 ? 'leaf0' : 'leaf1'];
    if (kind === FOOD_KIND.SUGAR) return PACKED[h < 0.5 ? 'glass1' : 'cream'];
    return PACKED[h < 0.3 ? 'violet' : 'rock2']; // corpse
  }
  const list = TERRAIN_COLOURS[t];
  if (!list) return PACKED.violet; // unknown type: visible debug colour
  return PACKED[list[(h * list.length) | 0]];
}

/** Draws to a canvas with the world transform: cell (x,y) at screen (x*zoom, y*zoom). */
export class Renderer {
  /**
   * @param {HTMLCanvasElement} canvas the 480x318 internal canvas
   * @param {import('./assets.js').Assets} assets
   */
  constructor(canvas, assets) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.assets = assets;
    this.terrainCanvas = document.createElement('canvas');
    this.terrainCanvas.width = VIEW_WIDTH;
    this.terrainCanvas.height = VIEW_HEIGHT;
    this.terrainCtx = this.terrainCanvas.getContext('2d');
    this.terrainImage = this.terrainCtx.createImageData(VIEW_WIDTH, VIEW_HEIGHT);
    this.terrain32 = new Uint32Array(this.terrainImage.data.buffer);
    this.lastTerrainTick = -1;
    this.terrainDirty = true;
    this.lastDebugKey = '';
    this.frame = 0;
    /** 0..1 position between the previous and current tick (for smooth motion). */
    this.alpha = 1;
    this.tick = 0;
  }

  /** Forces a terrain rebuild on the next draw (called after the player paints). */
  markDirty() {
    this.terrainDirty = true;
  }

  /** Rebuilds the terrain buffer from the world, plus pheromone tint when enabled. */
  buildTerrain(game) {
    const world = game.world;
    const W = world.width;
    const H = world.height;
    const out = this.terrain32;
    const tick = game.tick;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        out[i] = terrainColour(world, i, x, y, tick);
      }
    }
    if (game.ui.debug.pheromones) this.tintPheromones(game);
    this.terrainCtx.putImageData(this.terrainImage, 0, 0);
    this.lastTerrainTick = tick;
    this.terrainDirty = false;
  }

  /** Blends the strongest pheromone layer of each cell over the terrain colour. */
  tintPheromones(game) {
    const { pheromones, world } = game;
    const out = this.terrain32;
    const size = world.size;
    for (let i = 0; i < size; i++) {
      if (SOLID[world.type[i]]) continue;
      let best = -1;
      let bestV = 2;
      for (let l = 0; l < pheromones.layers.length; l++) {
        const v = pheromones.layers[l][i];
        if (v > bestV) {
          bestV = v;
          best = l;
        }
      }
      if (best < 0) continue;
      const a = Math.min(0.75, bestV / PHEROMONE_MAX);
      const [r, g, b] = LAYER_RGB[best];
      const c = out[i];
      const cr = c & 0xff;
      const cg = (c >>> 8) & 0xff;
      const cb = (c >>> 16) & 0xff;
      const nr = cr + (r - cr) * a;
      const ng = cg + (g - cg) * a;
      const nb = cb + (b - cb) * a;
      out[i] = (0xff000000 | (nb << 16) | (ng << 8) | nr) >>> 0;
    }
  }

  /**
   * Draws one complete viewport frame.
   * @param {import('./game.js').Game} game
   * @param {{mouse: object, selectedTool: object|null, help: boolean}} view
   */
  draw(game, view) {
    const ctx = this.ctx;
    const ui = game.ui;
    this.frame++;
    this.alpha = view.alpha == null ? 1 : view.alpha;
    this.tick = game.tick;
    if (this.terrainDirty || game.tick !== this.lastTerrainTick || this.debugKey(ui) !== this.lastDebugKey) {
      this.buildTerrain(game);
      this.lastDebugKey = this.debugKey(ui);
    }

    const z = ui.zoom;
    ui.camX = clamp(ui.camX, 0, VIEW_WIDTH - VIEW_WIDTH / z);
    ui.camY = clamp(ui.camY, 0, VIEW_HEIGHT - VIEW_HEIGHT / z);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.clip();
    ctx.setTransform(z, 0, 0, z, -ui.camX * z, -ui.camY * z);

    ctx.drawImage(this.terrainCanvas, 0, 0);
    this.drawBrood(game);
    this.drawEnemies(game);
    this.drawAnts(game);
    if (ui.debug.paths) this.drawPaths(game);
    if (ui.debug.grid) this.drawGrid(game);
    if (ui.debug.states) this.drawStates(game);
    this.drawHover(game, view.mouse);
    this.drawSelection(game);

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawHud(game, view);
    if (view.help) this.drawHelp();
  }

  debugKey(ui) {
    const d = ui.debug;
    return `${d.pheromones ? 1 : 0}`;
  }

  /** Draws a sprite centred horizontally on cell (x,y), with its bottom row on that cell. */
  spriteAt(name, x, y) {
    const { w, h } = spriteSize(this.assets, name);
    drawSprite(this.ctx, this.assets, name, x - ((w - 1) >> 1), y - h + 1);
    return h;
  }

  drawBrood(game) {
    for (const b of game.brood) {
      if (!b.alive || b.carried) continue;
      this.spriteAt(b.kind === 'egg' ? 'egg' : b.kind === 'larva' ? 'larva' : 'pupa', b.x, b.y);
    }
  }

  /**
   * Where a creature is drawn this frame. A move is a glide from the cell it
   * left to the cell it entered, spread over the time the entity needs for one
   * step (1 / speed ticks). Between moves the creature rests on its cell.
   * @returns {{x: number, y: number}} fractional cell coordinates
   */
  entityPos(e) {
    if (e.fromX === e.x && e.fromY === e.y) return { x: e.x, y: e.y };
    const carry = e.carrying || (e.inventory && e.inventory.kind) ? 0.7 : 1;
    const stepTicks = 1 / Math.max(0.05, e.speed * carry);
    const progress = Math.min(1, Math.max(0, (this.tick - e.movedTick + this.alpha) / stepTicks));
    return {
      x: e.fromX + (e.x - e.fromX) * progress,
      y: e.fromY + (e.y - e.fromY) * progress,
    };
  }

  /**
   * Draws a creature at its glide position, mirrored when it faces left.
   * Returns the screen-space box in world cells.
   */
  drawCreature(name, e, facing) {
    const { w, h } = spriteSize(this.assets, name);
    const pos = this.entityPos(e);
    const left = pos.x - ((w - 1) >> 1);
    const top = pos.y - h + 1;
    const ctx = this.ctx;
    if (facing < 0) {
      ctx.save();
      ctx.translate(left + w, top);
      ctx.scale(-1, 1);
      drawSprite(ctx, this.assets, name, 0, 0);
      ctx.restore();
    } else {
      drawSprite(ctx, this.assets, name, left, top);
    }
    return { left, top, w, h };
  }

  drawEnemies(game) {
    for (const e of game.enemies) {
      if (!e.alive) continue;
      this.drawCreature(`${e.species}_${e.animFrame & 1}`, e, e.facing);
    }
  }

  drawAnts(game) {
    const ctx = this.ctx;
    for (const ant of game.ants) {
      if (!ant.alive) continue;
      const name = ant.role === 'queen' ? `queen_${ant.animFrame & 1}` : antSpriteName(ant);
      const box = this.drawCreature(name, ant, ant.facing);
      if (ant.inventory) {
        const colour = { food: 'leaf1', corpse: 'rock2', sand: 'sand0', egg: 'cream' }[ant.inventory.kind] || 'cream';
        ctx.fillStyle = colorOf(colour);
        ctx.fillRect(Math.round(box.left + box.w / 2) - 1, Math.round(box.top) - 2, 2, 2);
      }
    }
  }

  /** Yellow box around the creature picked with the inspect tool. */
  drawSelection(game) {
    const sel = game.selected;
    if (!sel || !sel.alive) return;
    const ctx = this.ctx;
    const name = sel.role ? (sel.role === 'queen' ? `queen_${sel.animFrame & 1}` : antSpriteName(sel)) : `${sel.species}_${sel.animFrame & 1}`;
    const { w, h } = spriteSize(this.assets, name);
    const pos = this.entityPos(sel);
    const ex = pos.x;
    const ey = pos.y;
    const x0 = ex - ((w - 1) >> 1) - 2;
    const y0 = ey - h - 1;
    const bw = w + 4;
    const bh = h + 3;
    ctx.fillStyle = colorOf('yellow');
    ctx.fillRect(x0, y0, bw, 1);
    ctx.fillRect(x0, y0 + bh - 1, bw, 1);
    ctx.fillRect(x0, y0, 1, bh);
    ctx.fillRect(x0 + bw - 1, y0, 1, bh);
  }

  drawPaths(game) {
    const ctx = this.ctx;
    const W = game.world.width;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (const ant of game.ants) {
      if (!ant.alive || !ant.path) continue;
      for (let k = ant.pathPos; k < ant.path.length; k++) {
        const i = ant.path[k];
        ctx.fillRect(i % W, (i - (i % W)) / W, 1, 1);
      }
    }
  }

  drawGrid(game) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    for (let x = 0; x < game.world.width; x += 10) ctx.fillRect(x, 0, 1, game.world.height);
    for (let y = 0; y < game.world.height; y += 10) ctx.fillRect(0, y, game.world.width, 1);
  }

  /** Short task label above each ant (debug 'X' overlay). */
  drawStates(game) {
    const ctx = this.ctx;
    for (const ant of game.ants) {
      if (!ant.alive) continue;
      const label = ant.role === 'queen' ? 'QUEEN' : (ant.task.kind || '').slice(0, 5).toUpperCase();
      const w = textWidth(label);
      drawText(ctx, label, ant.x - ((w - 1) >> 1), ant.y - 12, '#ffffff', '#000000');
    }
    for (const e of game.enemies) {
      if (!e.alive) continue;
      drawText(ctx, e.species.slice(0, 4).toUpperCase(), e.x - 4, e.y - 10, '#ff8080', '#000000');
    }
  }

  /** Brush outline and inspected-cell marker, in world coordinates. */
  drawHover(game, mouse) {
    const ctx = this.ctx;
    const world = game.world;
    if (mouse && mouse.inWorld) {
      const r = (BRUSH_SIZES[game.ui.brush] - 1) >> 1;
      const x0 = mouse.cellX - r;
      const y0 = mouse.cellY - r;
      const size = r * 2 + 1;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(x0, y0, size, 1);
      ctx.fillRect(x0, y0 + size - 1, size, 1);
      ctx.fillRect(x0, y0, 1, size);
      ctx.fillRect(x0 + size - 1, y0, 1, size);
    }
    if (game.inspectIndex >= 0) {
      const x = world.xOf(game.inspectIndex);
      const y = world.yOf(game.inspectIndex);
      ctx.fillStyle = colorOf('yellow');
      ctx.fillRect(x - 1, y - 1, 3, 1);
      ctx.fillRect(x - 1, y + 1, 3, 1);
      ctx.fillRect(x - 1, y - 1, 1, 3);
      ctx.fillRect(x + 1, y - 1, 1, 3);
    }
  }

  /** Screen-space text: status line, messages, tool name, inspect box. */
  drawHud(game, view) {
    const ctx = this.ctx;
    const ui = game.ui;
    const s = game.stats;
    const colony = game.colonies[0];
    const status = `ANTS ${s.population}  BROOD ${s.brood}  FOOD ${Math.round(colony.foodStored)}  ENEMIES ${s.enemies}`;
    const speed = ui.paused ? 'PAUSED' : `X${[1, 2, 4][ui.speed]}`;
    const top = `${status}  T ${game.tick}  ${speed}  Z${ui.zoom}`;
    ctx.fillStyle = 'rgba(27, 20, 16, 0.6)';
    ctx.fillRect(0, 0, textWidth(top) + 6, GLYPH_HEIGHT + 4);
    drawText(ctx, top, 3, 2, '#f3e9c6');

    if (view.selectedTool) {
      const label = `TOOL: ${view.selectedTool.label}`;
      const w = textWidth(label);
      ctx.fillStyle = 'rgba(27, 20, 16, 0.6)';
      ctx.fillRect(VIEW_WIDTH - w - 7, 0, w + 7, GLYPH_HEIGHT + 4);
      drawText(ctx, label, VIEW_WIDTH - w - 4, 2, '#f0d75a');
    }

    const recent = game.events.slice(-3);
    recent.forEach((ev, k) => {
      const y = VIEW_HEIGHT - 8 - (recent.length - 1 - k) * 8;
      const w = textWidth(ev.text);
      ctx.fillStyle = 'rgba(27, 20, 16, 0.55)';
      ctx.fillRect(2, y - 2, w + 4, GLYPH_HEIGHT + 3);
      drawText(ctx, ev.text, 4, y, '#e4f7fc');
    });

    if (game.inspectIndex >= 0) this.drawInspect(game);
  }

  /** Right-hand info panel: full data for a selected creature, else the inspected cell. */
  drawInspect(game) {
    const ctx = this.ctx;
    const lines = game.selected && game.selected.alive ? this.creatureLines(game, game.selected) : this.cellLines(game);
    const w = Math.max(...lines.map(textWidth)) + 8;
    const h = lines.length * 8 + 4;
    const bx = VIEW_WIDTH - w - 4;
    const by = 16;
    ctx.fillStyle = 'rgba(27, 20, 16, 0.88)';
    ctx.fillRect(bx, by, w, h);
    lines.forEach((line, k) => drawText(ctx, line, bx + 4, by + 3 + k * 8, k === 0 ? '#f0d75a' : '#f3e9c6'));
  }

  cellLines(game) {
    const world = game.world;
    const i = game.inspectIndex;
    const x = world.xOf(i);
    const y = world.yOf(i);
    const ph = LAYER_NAMES.map((n, l) => `${n[0].toUpperCase()}${Math.round(game.pheromones.layers[l][i])}`).join(' ');
    return [
      `CELL ${x},${y}  ${CELL_NAMES[world.type[i]].toUpperCase()}`,
      `DENSITY ${world.density[i]}  MOIST ${world.moisture[i]}  LIGHT ${world.light[i]}`,
      `PHERO ${ph}`,
      'CLICK AN ANT OR ENEMY FOR DETAILS',
    ];
  }

  /** Every field the player may want to read about an ant or enemy. */
  creatureLines(game, c) {
    const world = game.world;
    const cell = CELL_NAMES[world.typeAt(c.x, c.y)].toUpperCase();
    const here = world.index(c.x, c.y);
    const ph = (l) => Math.round(game.pheromones.layers[l][here]);
    const target = c.task && c.task.target ? `${c.task.target.x},${c.task.target.y}` : '-';
    const pct = (v) => Math.round(v);
    if (c.species) {
      return [
        `${c.species.toUpperCase()} #${c.id}  ENEMY`,
        `HP ${pct(c.hp)}/${c.maxHp}  DAMAGE ${c.damage}  COOLDOWN ${c.cooldown}/${c.cooldownMax}`,
        `SPEED ${c.speed.toFixed(2)}  SIGHT ${c.sight}  FACING ${c.facing > 0 ? 'RIGHT' : 'LEFT'}`,
        `POS ${c.x},${c.y}  CELL ${cell}`,
        `CARRYING ${c.carrying || 'NOTHING'}  STUCK ${c.stuckTicks}`,
      ];
    }
    const colony = game.colonyOf(c);
    const role = ROLE_LABELS[c.role] || c.role.toUpperCase();
    const pathInfo = c.path ? `${c.pathPos}/${c.path.length}` : '-';
    const danger = c.memory.dangerTick < 0 ? 'NEVER' : `${game.tick - c.memory.dangerTick} TICKS AGO`;
    return [
      `ANT #${c.id}  ${role}  ${c.alive ? 'ALIVE' : 'DEAD'}`,
      `COLONY ${colony ? colony.name : '-'}  AGE ${c.ageTicks} TICKS`,
      `HP ${pct(c.hp)}/${c.maxHp}  DAMAGE ${c.damage}  STRENGTH ${c.strength.toFixed(2)}`,
      `HUNGER ${pct(c.hunger)}  THIRST ${pct(c.thirst)}  ENERGY ${pct(c.energy)}`,
      `SPEED ${c.speed.toFixed(2)}  SIGHT ${c.sight}  FACING ${c.facing > 0 ? 'RIGHT' : 'LEFT'}`,
      `TASK ${c.task.kind.toUpperCase()}  TARGET ${target}`,
      `CARRYING ${c.carrying ? c.carrying.toUpperCase() : 'NOTHING'}`,
      `POS ${c.x},${c.y}  CELL ${cell}`,
      `PATH ${pathInfo}  STUCK ${c.stuckTicks}  FAILS ${c.task.fails || 0}`,
      `MOVE ${c.moveCredit.toFixed(2)}  NEXT DECISION ${c.decisionTimer}`,
      `DANGER SEEN ${danger}`,
      `PHERO H${ph(0)} F${ph(1)} D${ph(2)} E${ph(3)}`,
    ];
  }

  drawHelp() {
    const ctx = this.ctx;
    const lines = [
      'HELP (H TO CLOSE)',
      'LEFT CLICK / DRAG  PLACE OR PAINT',
      'RIGHT CLICK / DRAG  REMOVE',
      'WASD / ARROWS  PAN   WHEEL / +- / Z  ZOOM',
      '1-0 Q E R T Y U I O P F  TOOLS',
      'SPACE PAUSE  F2 SPEED  [ ] BRUSH  G QTY',
      'V PHEROMONES  X STATES  N GRID  M PATHS',
      'F5 SAVE  F9 LOAD  DEL RESET',
      'EMPTY START: SPAWN A QUEEN (2) TO FOUND A NEST',
    ];
    const w = Math.max(...lines.map(textWidth)) + 12;
    const h = lines.length * 8 + 8;
    const x = Math.floor((VIEW_WIDTH - w) / 2);
    const y = 24;
    ctx.fillStyle = 'rgba(27, 20, 16, 0.9)';
    ctx.fillRect(x, y, w, h);
    lines.forEach((line, k) => drawText(ctx, line, x + 6, y + 4 + k * 8, k === 0 ? '#f0d75a' : '#f3e9c6'));
  }
}
