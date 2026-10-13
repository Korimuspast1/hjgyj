/**
 * GUI panel: the 48 px strip under the world viewport.
 *
 * The layout is data: `buildButtons()` returns rectangles with an action,
 * `draw()` paints them, and `buttonAt()` does hit testing. input.js calls the
 * action when a button is clicked, so adding a button means adding one entry here.
 *
 * Layout (panel y = 270..317):
 *   row A (y=272): 10 tools | brush x3 | quantity x3 | speed x3 | pause
 *   row B (y=292): 10 tools | save | load | reset | debug x4 | zoom | help
 */
import { TOOLS } from './tools.js';
import { BRUSH_SIZES, QUANTITIES, SPEED_LEVELS, VIEW_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
import { PALETTE, colorOf } from './sprites.js';
import { drawSprite } from './assets.js';
import { drawText, textWidth } from './font.js';

const BTN = 18;
const ROW_Y = [VIEW_HEIGHT + 2, VIEW_HEIGHT + 22];
const TOOL_STEP = 20;

/**
 * @typedef {object} Button
 * @property {string} id unique id
 * @property {'tool'|'brush'|'quantity'|'speed'|'pause'|'action'|'debug'|'zoom'} kind
 * @property {*} [value] tool id, index, debug key or action name
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {string} label text drawn when there is no icon
 * @property {string} [icon] sprite name
 * @property {string} tip tooltip text
 */

/** @returns {Button[]} every clickable element in the panel */
export function buildButtons() {
  const buttons = [];
  TOOLS.forEach((tool, i) => {
    const row = i < 10 ? 0 : 1;
    const col = i % 10;
    buttons.push({
      id: `tool:${tool.id}`, kind: 'tool', value: tool.id,
      x: 4 + col * TOOL_STEP, y: ROW_Y[row], w: BTN, h: BTN,
      label: '', icon: tool.icon, tip: `${tool.label}  [${tool.hotkey.toUpperCase()}]`,
    });
  });
  BRUSH_SIZES.forEach((size, i) => {
    buttons.push({ id: `brush:${i}`, kind: 'brush', value: i, x: 212 + i * 20, y: ROW_Y[0], w: BTN, h: BTN, label: String(size), tip: `BRUSH SIZE ${size}  [ [ ] ]` });
  });
  QUANTITIES.forEach((q, i) => {
    buttons.push({ id: `qty:${i}`, kind: 'quantity', value: i, x: 272 + i * 20, y: ROW_Y[0], w: BTN, h: BTN, label: String(q), tip: `SPAWN QUANTITY ${q}  [G]` });
  });
  SPEED_LEVELS.forEach((s, i) => {
    buttons.push({ id: `speed:${i}`, kind: 'speed', value: i, x: 332 + i * 20, y: ROW_Y[0], w: BTN, h: BTN, label: `X${s}`, tip: `SIMULATION SPEED X${s}  [F2]` });
  });
  buttons.push({ id: 'pause', kind: 'pause', value: null, x: 392, y: ROW_Y[0], w: 40, h: BTN, label: 'PAUSE', tip: 'PAUSE / PLAY  [SPACE]' });

  buttons.push({ id: 'save', kind: 'action', value: 'save', x: 212, y: ROW_Y[1], w: 34, h: BTN, label: 'SAVE', tip: 'SAVE TO BROWSER  [F5]' });
  buttons.push({ id: 'load', kind: 'action', value: 'load', x: 248, y: ROW_Y[1], w: 34, h: BTN, label: 'LOAD', tip: 'LOAD SAVED GAME  [F9]' });
  buttons.push({ id: 'reset', kind: 'action', value: 'reset', x: 284, y: ROW_Y[1], w: 34, h: BTN, label: 'RESET', tip: 'EMPTY FORMICARIUM  [DEL]' });
  const debug = [
    ['pheromones', 'V', 'PHEROMONE OVERLAY  [V]'],
    ['states', 'X', 'ANT STATES  [X]'],
    ['grid', 'N', 'CELL GRID  [N]'],
    ['paths', 'M', 'ANT PATHS  [M]'],
  ];
  debug.forEach(([key, label, tip], i) => {
    buttons.push({ id: `debug:${key}`, kind: 'debug', value: key, x: 322 + i * 20, y: ROW_Y[1], w: BTN, h: BTN, label, tip });
  });
  buttons.push({ id: 'zoom', kind: 'zoom', value: null, x: 404, y: ROW_Y[1], w: 34, h: BTN, label: 'Z1', tip: 'ZOOM 1 / 2 / 4  [WHEEL, + -]' });
  buttons.push({ id: 'help', kind: 'action', value: 'help', x: 442, y: ROW_Y[1], w: BTN, h: BTN, label: '?', tip: 'HELP  [H]' });
  return buttons;
}

/** Whether a button shows its selected/on state given the current UI settings. */
export function isSelected(button, ui) {
  switch (button.kind) {
    case 'tool': return ui.tool === button.value;
    case 'brush': return ui.brush === button.value;
    case 'quantity': return ui.quantity === button.value;
    case 'speed': return ui.speed === button.value;
    case 'debug': return !!ui.debug[button.value];
    case 'zoom': return ui.zoom !== 1;
    case 'pause': return ui.paused;
    default: return false;
  }
}

export class GUI {
  /**
   * @param {import('./assets.js').Assets} assets
   */
  constructor(assets) {
    this.assets = assets;
    this.buttons = buildButtons();
    /** @type {Button|null} */
    this.hover = null;
  }

  /** @returns {Button|null} the button under canvas point (px, py), if any */
  buttonAt(px, py) {
    if (py < VIEW_HEIGHT) return null;
    for (const b of this.buttons) {
      if (px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h) return b;
    }
    return null;
  }

  /**
   * Draws the panel, button states, labels and the tooltip for the hovered button.
   * @param {CanvasRenderingContext2D} ctx identity transform
   * @param {import('./game.js').Game} game
   * @param {{px:number, py:number}|null} pointer last pointer position in canvas pixels
   */
  draw(ctx, game, pointer) {
    const ui = game.ui;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.tunnel;
    ctx.fillRect(0, VIEW_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT - VIEW_HEIGHT);
    ctx.fillStyle = PALETTE.dirt2;
    ctx.fillRect(0, VIEW_HEIGHT, CANVAS_WIDTH, 1);

    this.hover = pointer ? this.buttonAt(pointer.px, pointer.py) : null;
    for (const b of this.buttons) {
      const selected = isSelected(b, ui);
      const hovered = b === this.hover;
      ctx.fillStyle = colorOf(selected ? 'dirt2' : hovered ? 'dirt1' : 'dirt0');
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = colorOf(selected ? 'yellow' : 'dirt2');
      ctx.fillRect(b.x, b.y, b.w, 1);
      ctx.fillRect(b.x, b.y + b.h - 1, b.w, 1);
      ctx.fillRect(b.x, b.y, 1, b.h);
      ctx.fillRect(b.x + b.w - 1, b.y, 1, b.h);

      if (b.icon) {
        const f = this.assets.frames[b.icon];
        const iw = f ? f.w : 8;
        const ih = f ? f.h : 8;
        drawSprite(ctx, this.assets, b.icon, b.x + ((b.w - iw) >> 1), b.y + ((b.h - ih) >> 1));
      } else {
        const label = b.kind === 'pause' ? (ui.paused ? 'PLAY' : 'PAUSE') : b.kind === 'zoom' ? `Z${ui.zoom}` : b.label;
        const tw = textWidth(label);
        drawText(ctx, label, b.x + ((b.w - tw) >> 1), b.y + 6, selected ? '#ffffff' : '#f3e9c6', '#1b1410');
      }
    }

    if (this.hover) this.drawTooltip(ctx, this.hover);
  }

  drawTooltip(ctx, b) {
    const w = textWidth(b.tip) + 6;
    const h = 11;
    let x = Math.min(CANVAS_WIDTH - w - 2, Math.max(2, b.x));
    let y = b.y - h - 2;
    if (y < 2) y = VIEW_HEIGHT + 2;
    ctx.fillStyle = 'rgba(27, 20, 16, 0.95)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = colorOf('yellow');
    ctx.fillRect(x, y, w, 1);
    drawText(ctx, b.tip, x + 3, y + 3, '#f3e9c6');
  }
}

