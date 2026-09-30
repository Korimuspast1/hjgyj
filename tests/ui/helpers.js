/**
 * Shared UI-test helpers: build a jsdom world, boot the game in it, and
 * provide tiny helpers for finding/clicking elements.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const GAME_ROOT = path.join(__dirname, '..', '..', 'game');
const liveDoms = [];
module.exports.closeAll = function () {
  for (const d of liveDoms.splice(0)) {
    try { d.window.close(); } catch (e) { /* ignore */ }
  }
};

function makeDom(url) {
  const virtualConsole = new VirtualConsole();
  // jsdom "not implemented" noises (canvas etc.) are expected — swallow them
  const dom = new JSDOM(fs.readFileSync(path.join(GAME_ROOT, 'index.html'), 'utf8'), {
    url: url || 'http://localhost:8080/index.html',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    virtualConsole,
    storageQuota: 10000000
  });
  return dom;
}

/**
 * Boot the game inside a jsdom window and return { dom, window, GD, sb }.
 * The game scripts are evaluated in a vm context that shares the jsdom
 * window, exactly like a browser would.
 */
function bootGame(opts) {
  opts = opts || {};
  const dom = makeDom(opts.url);
  const { loadGame } = require(path.join(__dirname, '..', 'loader.js'));

  const sb = loadGame({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    location: dom.window.location,
    requestAnimationFrame: dom.window.requestAnimationFrame ? function (fn) { return dom.window.requestAnimationFrame(fn); } : function () { return 0; },
    cancelAnimationFrame: dom.window.cancelAnimationFrame ? function (id) { return dom.window.cancelAnimationFrame(id); } : function () {},
    localStorage: dom.window.localStorage,
    URLSearchParams: dom.window.URLSearchParams,
    Event: dom.window.Event,
    history: dom.window.history
  });

  // The scripts registered GD onto the jsdom window (namespace.js attaches
  // to `window` when it exists).
  const GD = dom.window.GD || sb.GD;

  // Boot once DOM is ready (document is already parsed by jsdom).
  GD.app.boot();

  return { dom, window: dom.window, document: dom.window.document, GD, sb };
}

function q(root, sel) { return root.querySelector(sel); }
function qa(root, sel) { return Array.prototype.slice.call(root.querySelectorAll(sel)); }
function byTestid(root, id) { return root.querySelector('[data-testid="' + id + '"]'); }

function click(node) {
  if (!node) throw new Error('click(): node is null');
  const win = node.ownerDocument && node.ownerDocument.defaultView;
  const Win = win || window;
  node.dispatchEvent(new Win.Event('pointerdown', { bubbles: true }));
  node.dispatchEvent(new Win.MouseEvent('click', { bubbles: true, cancelable: true }));
}

/** Pointer interaction at specific canvas coordinates (editor placement etc.). */
function clickAt(node, clientX, clientY) {
  if (!node) throw new Error('clickAt(): node is null');
  const win = node.ownerDocument && node.ownerDocument.defaultView;
  node.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
  node.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
}

/** Pointer press-and-hold at canvas coordinates (gameplay jump). */
function pressAt(node, clientX, clientY) {
  const win = node.ownerDocument && node.ownerDocument.defaultView;
  node.dispatchEvent(new win.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
}
function releaseAt(node, clientX, clientY) {
  const win = node.ownerDocument && node.ownerDocument.defaultView;
  node.dispatchEvent(new win.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX, clientY, button: 0 }));
}

/**
 * Screen position that the editor canvas (initial camera) maps the world cell
 * centre (gx+0.5, gy+0.5) to.  In jsdom the canvas is 300x150 with no CSS
 * layout, getBoundingClientRect() is 0,0 — mirroring editor.js gridPos().
 */
function editorCellScreen(gx, gy) {
  // Mirrors render/levelrenderer.js (VIEW_UNITS 11.5, GROUND_FRAC 0.80) and
  // the editor's initial camera (x=10, y=3, zoom=0.8).
  const cam = { x: 10, y: 3, zoom: 0.8 };
  const w = 300, h = 150;
  const ppu = (h / 11.5) * cam.zoom;
  const groundY = h * 0.80;
  const cx = w * 0.32;
  return {
    x: cx + (gx + 0.5 - cam.x) * ppu,
    y: groundY - (gy + 0.5 - cam.y) * ppu
  };
}

/** Wait (via rAF loop) until cond() is truthy or timeout. */
function waitFor(cond, timeoutMs, stepMs) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    (function tick() {
      let v;
      try { v = cond(); } catch (e) { return reject(e); }
      if (v) return resolve(v);
      if (Date.now() - t0 > (timeoutMs || 2000)) {
        return reject(new Error('waitFor timeout after ' + (timeoutMs || 2000) + 'ms'));
      }
      setTimeout(tick, stepMs || 25);
    })();
  });
}

module.exports = { makeDom, bootGame, q, qa, byTestid, click, clickAt, pressAt, releaseAt, editorCellScreen, waitFor };
