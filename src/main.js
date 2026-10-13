/**
 * Entry point. Wires the Game, the renderer, the GUI and input together, and
 * runs the main loop:
 *
 *   requestAnimationFrame -> accumulate real time -> step the fixed 20 Hz
 *   simulation (up to MAX_TICKS_PER_FRAME per frame) -> draw viewport and GUI.
 *
 * App-level actions (tools, saving, speed, zoom) are defined here and passed
 * to Input and GUI. Simulation rules live in the modules under src/.
 */
import { Game } from './game.js';
import { loadAssets } from './assets.js';
import { Renderer } from './render.js';
import { GUI } from './gui.js';
import { Input } from './input.js';
import { saveToStorage, loadFromStorage } from './save.js';
import { TOOLS_BY_ID } from './tools.js';
import { TICKS_PER_SECOND, SPEED_LEVELS, MAX_TICKS_PER_FRAME, ZOOM_LEVELS, BRUSH_SIZES, QUANTITIES } from './config.js';

/** Mutable app shell. `game` changes on reset and load; nothing else is global. */
const app = {
  game: null,
  renderer: null,
  gui: null,
  input: null,
  helpOpen: true,
};

/** App-level actions shared by mouse, GUI buttons and hotkeys. */
function makeActions() {
  const withGame = (fn) => () => fn(app.game);
  const actions = {
    selectTool(id) {
      if (!TOOLS_BY_ID[id]) return;
      app.game.ui.tool = id;
    },
    selectBrush(i) {
      app.game.ui.brush = i;
    },
    selectQuantity(i) {
      app.game.ui.quantity = i;
    },
    selectSpeed(i) {
      app.game.ui.speed = i;
      app.game.ui.paused = false;
    },
    togglePause() {
      app.game.ui.paused = !app.game.ui.paused;
    },
    toggleDebug(key) {
      app.game.ui.debug[key] = !app.game.ui.debug[key];
      app.renderer.markDirty();
    },
    cycleZoom(dir) {
      const ui = app.game.ui;
      const idx = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, ZOOM_LEVELS.indexOf(ui.zoom) + dir));
      ui.zoom = ZOOM_LEVELS[idx];
    },
    save: withGame((game) => {
      try {
        saveToStorage(game);
        game.log('Game saved in this browser.');
      } catch (err) {
        game.log(`Save failed: ${err.message}`);
      }
    }),
    load() {
      const ui = app.game.ui;
      try {
        const loaded = loadFromStorage();
        if (!loaded) {
          app.game.log('No saved game found.');
          return;
        }
        loaded.ui = ui;
        app.game = loaded;
        app.renderer.markDirty();
        loaded.log('Game loaded.');
      } catch (err) {
        app.game.log(`Load failed: ${err.message}`);
      }
    },
    reset() {
      const ui = app.game.ui;
      app.game = new Game(Math.floor(Math.random() * 0xffffffff));
      app.game.ui = ui;
      app.renderer.markDirty();
      app.game.log('Formicarium reset to empty sand and glass.');
    },
    help() {
      app.helpOpen = !app.helpOpen;
    },
    worldChanged() {
      app.renderer.markDirty();
    },
    /** Hotkeys that are not tools. Names come from KEY_ACTIONS in input.js. */
    keyAction(name) {
      const ui = app.game.ui;
      switch (name) {
        case 'pause': actions.togglePause(); break;
        case 'speed': actions.selectSpeed((ui.speed + 1) % SPEED_LEVELS.length); break;
        case 'save': actions.save(); break;
        case 'load': actions.load(); break;
        case 'reset': actions.reset(); break;
        case 'brushDown': actions.selectBrush(Math.max(0, ui.brush - 1)); break;
        case 'brushUp': actions.selectBrush(Math.min(BRUSH_SIZES.length - 1, ui.brush + 1)); break;
        case 'quantity': actions.selectQuantity((ui.quantity + 1) % QUANTITIES.length); break;
        case 'zoomIn': actions.cycleZoom(1); break;
        case 'zoomOut': actions.cycleZoom(-1); break;
        case 'help': actions.help(); break;
        case 'clear': app.game.clearSelection(); break;
        default:
          if (name.startsWith('debug:')) actions.toggleDebug(name.slice(6));
      }
    },
  };
  return actions;
}

/** Main loop. Real time is turned into whole fixed-rate simulation ticks. */
function startLoop(canvas, ctx) {
  let acc = 0;
  let last = performance.now();

  const frame = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const game = app.game;
    app.input.update(dt);

    if (!game.ui.paused) {
      acc += dt * TICKS_PER_SECOND * SPEED_LEVELS[game.ui.speed];
      let steps = 0;
      while (acc >= 1 && steps < MAX_TICKS_PER_FRAME) {
        game.step();
        acc -= 1;
        steps++;
      }
      if (steps === MAX_TICKS_PER_FRAME) acc = Math.min(acc, 1); // drop backlog instead of spiralling
    } else {
      acc = 0;
    }

    app.renderer.draw(game, {
      mouse: app.input.pointer,
      selectedTool: TOOLS_BY_ID[game.ui.tool],
      help: app.helpOpen,
      // Fraction of the next tick already elapsed: positions are interpolated by it.
      alpha: game.ui.paused ? 1 : Math.min(1, acc),
    });
    app.gui.draw(ctx, game, app.input.pointer);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

async function main() {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const assets = await loadAssets();
  app.game = Game.create(); // always starts empty: sand and glass only
  app.game.ui.zoom = 1;
  app.renderer = new Renderer(canvas, assets);
  app.gui = new GUI(assets);
  const actions = makeActions();
  app.input = new Input({ canvas, getGame: () => app.game, gui: app.gui, actions });
  startLoop(canvas, ctx);
  app.game.log('Spawn a queen (2) on the sand to found a colony.');
}

main().catch((err) => {
  console.error(err);
  const canvas = document.getElementById('game');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b1410';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f0d75a';
    ctx.font = '12px monospace';
    ctx.fillText(`Failed to start: ${err.message}`, 8, 20);
  }
});
