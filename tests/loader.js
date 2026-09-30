/**
 * Test/module loader — evaluates the game's browser scripts inside Node.
 *
 * The game ships as plain <script> files registering on a global GD
 * namespace (see game/js/core/namespace.js).  This loader runs the same
 * files inside a vm context so every module can be unit-tested without a
 * browser.  For UI tests a jsdom window/document can be injected.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAME_ROOT = path.join(__dirname, '..', 'game', 'js');

// Load order matters: core utilities first, then everything else.
const SCRIPT_ORDER = [
  'core/namespace.js',
  'core/util.js',
  'core/rng.js',
  'core/i18n.js',
  'core/storage.js',
  'core/objectdefs.js',
  'core/level.js',
  'core/encoding.js',
  'core/collision.js',
  'core/physics.js',
  'core/audio.js',
  'levels/official.js',
  'logic/levelbuild.js',
  'logic/gameplay.js',
  'logic/bot.js',
  'render/sprites.js',
  'render/background.js',
  'render/playericon.js',
  'render/levelrenderer.js',
  'ui/net.js',
  'ui/screens.js',
  'ui/levelselect.js',
  'ui/editor.js',
  'ui/online.js',
  'boot.js'
];

// Modules that MUST exist for the game to be considered complete.
const REQUIRED = new Set([
  'core/namespace.js', 'core/util.js', 'core/rng.js', 'core/i18n.js',
  'core/storage.js', 'core/objectdefs.js', 'core/level.js', 'core/encoding.js',
  'core/collision.js', 'core/physics.js', 'core/audio.js',
  'logic/levelbuild.js', 'logic/gameplay.js', 'logic/bot.js'
]);

/**
 * Load the game into a fresh sandbox.
 * extras: object merged into the global scope (e.g. jsdom window/document).
 * skip: array of SCRIPT_ORDER entries to skip (e.g. boot.js for pure tests).
 */
function loadGame(extras, skip) {
  extras = extras || {};
  skip = new Set(skip || []);
  const sandbox = Object.assign({}, extras);
  sandbox.console = console;
  sandbox.setTimeout = setTimeout;
  sandbox.clearTimeout = clearTimeout;
  sandbox.setInterval = setInterval;
  sandbox.clearInterval = clearInterval;
  if (!sandbox.globalThis) sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  for (const rel of SCRIPT_ORDER) {
    if (skip.has(rel)) continue;
    const file = path.join(GAME_ROOT, rel);
    if (!fs.existsSync(file)) {
      if (REQUIRED.has(rel)) throw new Error('Missing game script: ' + rel);
      continue; // later modules (render/ui/boot) load when present
    }
    const code = fs.readFileSync(file, 'utf8');
    try {
      vm.runInContext(code, sandbox, { filename: rel });
    } catch (e) {
      e.message = 'While loading ' + rel + ': ' + e.message;
      throw e;
    }
  }
  // If a DOM window was injected, GD lives on the window object; expose it
  // on the sandbox too so require-style access works uniformly.
  if (sandbox.window && sandbox.window.GD) sandbox.GD = sandbox.window.GD;
  return sandbox;
}

module.exports = { loadGame, SCRIPT_ORDER, GAME_ROOT };
