/**
 * Input: mouse, wheel and keyboard. It turns browser events into tool use,
 * GUI actions, and camera movement. It never modifies simulation arrays
 * directly; it calls Game and app actions.
 *
 * Mouse:
 *   left click / drag   place or paint with the selected tool (spawn tools click only)
 *   right click / drag  remove ants, enemies and terrain under the brush
 *   wheel               zoom in or out (1, 2, 4)
 * Keyboard: see HELP in the game (press H) and README.md.
 */
import { TOOLS, TOOLS_BY_ID, SPAWN_KINDS } from './tools.js';
import { VIEW_WIDTH, VIEW_HEIGHT, CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js';
const PAN_CELLS_PER_SECOND = 90;

/** Non-tool hotkeys. Values are action names understood by main.js (see `keyAction`). */
const KEY_ACTIONS = Object.freeze({
  ' ': 'pause',
  F2: 'speed',
  F5: 'save',
  F9: 'load',
  Delete: 'reset',
  '[': 'brushDown',
  ']': 'brushUp',
  g: 'quantity',
  '+': 'zoomIn',
  '=': 'zoomIn',
  '-': 'zoomOut',
  v: 'debug:pheromones',
  x: 'debug:states',
  n: 'debug:grid',
  m: 'debug:paths',
  h: 'help',
  Escape: 'clear',
});

export class Input {
  /**
   * @param {object} opts
   * @param {HTMLCanvasElement} opts.canvas
   * @param {import('./game.js').Game} opts.getGame returns the current Game (it can be replaced on load)
   * @param {import('./gui.js').GUI} opts.gui
   * @param {object} opts.actions app-level actions, see main.js
   */
  constructor({ canvas, getGame, gui, actions }) {
    this.canvas = canvas;
    this.getGame = getGame;
    this.gui = gui;
    this.actions = actions;
    /** Pointer in canvas pixels, world cell and whether it is inside the viewport. */
    this.pointer = null;
    this.leftHeld = false;
    this.rightHeld = false;
    this.lastCell = -1;
    this.pan = { left: false, right: false, up: false, down: false };
    this.bind();
  }

  /** Maps a mouse event to canvas pixel coordinates (the canvas is CSS-scaled). */
  toCanvas(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = Math.floor(((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width);
    const py = Math.floor(((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height);
    return { px, py };
  }

  /** Refreshes `pointer` from a mouse event. */
  updatePointer(e) {
    const { px, py } = this.toCanvas(e);
    const game = this.getGame();
    const z = game.ui.zoom;
    const inWorld = px >= 0 && py >= 0 && px < VIEW_WIDTH && py < VIEW_HEIGHT;
    const cellX = Math.floor(game.ui.camX + px / z);
    const cellY = Math.floor(game.ui.camY + py / z);
    this.pointer = { px, py, cellX, cellY, inWorld: inWorld && game.world.inBounds(cellX, cellY) };
    return this.pointer;
  }

  bind() {
    const c = this.canvas;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointermove', (e) => this.onMove(e));
    c.addEventListener('pointerdown', (e) => this.onDown(e));
    c.addEventListener('pointerleave', () => {
      this.pointer = null;
    });
    window.addEventListener('pointerup', (e) => this.onUp(e));
    c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
    window.addEventListener('blur', () => this.clearHeld());
  }

  clearHeld() {
    this.leftHeld = false;
    this.rightHeld = false;
    this.pan = { left: false, right: false, up: false, down: false };
  }

  onDown(e) {
    const p = this.updatePointer(e);
    const game = this.getGame();
    if (e.button !== 0 && e.button !== 2) return;
    if (!p.inWorld) {
      if (e.button === 0) {
        const button = this.gui.buttonAt(p.px, p.py);
        if (button) this.activate(button);
      }
      return;
    }
    if (e.button === 0) {
      this.leftHeld = true;
      this.applyLeft(game, p.cellX, p.cellY, true);
    } else {
      this.rightHeld = true;
      this.applyRight(game, p.cellX, p.cellY);
    }
    this.lastCell = p.cellY * game.world.width + p.cellX;
  }

  onMove(e) {
    const p = this.updatePointer(e);
    if (!p.inWorld) return;
    const game = this.getGame();
    const cell = p.cellY * game.world.width + p.cellX;
    if (cell === this.lastCell) return;
    if (this.leftHeld) this.applyLeft(game, p.cellX, p.cellY, false);
    else if (this.rightHeld) this.applyRight(game, p.cellX, p.cellY);
    this.lastCell = cell;
  }

  onUp(e) {
    if (e.button === 0) this.leftHeld = false;
    if (e.button === 2) this.rightHeld = false;
    this.lastCell = -1;
  }

  onWheel(e) {
    e.preventDefault();
    this.actions.cycleZoom(e.deltaY < 0 ? 1 : -1);
  }

  /** Left button: spawn tools act on click only; terrain tools also act while dragging. */
  applyLeft(game, x, y, click) {
    const tool = TOOLS_BY_ID[game.ui.tool];
    if (!tool) return;
    if (!click && SPAWN_KINDS.includes(tool.kind)) return;
    if (tool.kind === 'inspect' && !click) return;
    game.applyTool(tool.id, x, y);
    this.actions.worldChanged();
  }

  applyRight(game, x, y) {
    game.eraseAt(x, y);
    this.actions.worldChanged();
  }

  /** Runs a GUI button's action. */
  activate(button) {
    const a = this.actions;
    switch (button.kind) {
      case 'tool': a.selectTool(button.value); break;
      case 'brush': a.selectBrush(button.value); break;
      case 'quantity': a.selectQuantity(button.value); break;
      case 'speed': a.selectSpeed(button.value); break;
      case 'pause': a.togglePause(); break;
      case 'debug': a.toggleDebug(button.value); break;
      case 'zoom': a.cycleZoom(1); break;
      case 'action': a[button.value](); break;
      default: break;
    }
  }

  onKeyDown(e) {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.metaKey) return;
    const key = e.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    const isLeft = lower === 'a' || key === 'ArrowLeft';
    const isRight = lower === 'd' || key === 'ArrowRight';
    const isUp = lower === 'w' || key === 'ArrowUp';
    const isDown = lower === 's' || key === 'ArrowDown';
    if (isLeft) this.pan.left = true;
    if (isRight) this.pan.right = true;
    if (isUp) this.pan.up = true;
    if (isDown) this.pan.down = true;
    if (isLeft || isRight || isUp || isDown) {
      e.preventDefault();
      return;
    }
    if (e.repeat && key !== '[' && key !== ']') return;

    const tool = TOOLS.find((t) => t.hotkey === lower);
    if (tool) {
      this.actions.selectTool(tool.id);
    } else if (KEY_ACTIONS[key] || KEY_ACTIONS[lower]) {
      this.actions.keyAction(KEY_ACTIONS[key] || KEY_ACTIONS[lower]);
    } else {
      return; // not ours: let the browser handle it
    }
    e.preventDefault();
  }

  onKeyUp(e) {
    const key = e.key;
    const lower = key.length === 1 ? key.toLowerCase() : key;
    if (lower === 'a' || key === 'ArrowLeft') this.pan.left = false;
    else if (lower === 'd' || key === 'ArrowRight') this.pan.right = false;
    else if (lower === 'w' || key === 'ArrowUp') this.pan.up = false;
    else if (lower === 's' || key === 'ArrowDown') this.pan.down = false;
  }

  /**
   * Camera panning, called every frame with the elapsed time (seconds).
   * Clamping to the world happens in Renderer.draw.
   */
  update(dt) {
    const ui = this.getGame().ui;
    const d = PAN_CELLS_PER_SECOND * dt;
    if (this.pan.left) ui.camX -= d;
    if (this.pan.right) ui.camX += d;
    if (this.pan.up) ui.camY -= d;
    if (this.pan.down) ui.camY += d;
  }
}
