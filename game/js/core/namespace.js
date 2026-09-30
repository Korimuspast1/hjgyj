/**
 * Neon Dash — namespace & module loader.
 *
 * The game is written as plain browser scripts that register themselves on a
 * single global `GD` namespace.  This keeps the code runnable in three
 * environments without a bundler:
 *
 *   1. The Android app  (WebView, file:// — ES modules are blocked there)
 *   2. The companion website / any browser
 *   3. Node.js unit tests (tests/loader.js evaluates the same files)
 */
(function (global) {
  'use strict';

  // --- Tiny polyfills so the game runs on old Android WebViews (Chromium 44+) ---
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (len, pad) {
      var s = String(this);
      pad = pad === undefined ? ' ' : String(pad);
      while (s.length < len) s = pad + s;
      return s.slice(0, Math.max(len, s.length));
    };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function (search, start) {
      return String(this).indexOf(search, start !== undefined ? start : 0) !== -1;
    };
  }
  if (!Math.trunc) {
    Math.trunc = function (v) { return v < 0 ? Math.ceil(v) : Math.floor(v); };
  }

  var GD = global.GD || {};
  global.GD = GD;
  // When running inside a container that provides `window` separately (Node
  // tests with jsdom), also expose GD on the actual global scope so bare
  // `GD` references in later scripts resolve.
  if (typeof globalThis !== 'undefined' && globalThis !== global) {
    globalThis.GD = GD;
  }

  /**
   * Register a module:  GD.register('physics', function (GD) { ... });
   * The function is invoked immediately with the namespace so it can read
   * modules registered earlier in load order (documented in docs/ARCHITECTURE.md).
   */
  GD.register = function (name, factory) {
    if (typeof factory !== 'function') {
      throw new Error('GD.register("' + name + '"): factory must be a function');
    }
    if (GD[name] !== undefined && !GD.__reloading) {
      throw new Error('GD.register("' + name + '"): module already registered');
    }
    GD[name] = factory(GD) || GD[name];
    return GD[name];
  };

  /** True when running inside a browser-like DOM environment. */
  GD.IS_BROWSER = typeof window !== 'undefined' && typeof window.document !== 'undefined';

  /** True when running inside the Android WebView shell. */
  GD.IS_ANDROID = GD.IS_BROWSER &&
    typeof window.AndroidBridge !== 'undefined';

  /** Semantic version, shown in the settings screen. */
  GD.VERSION = '1.0.0';
})(typeof window !== 'undefined' ? window : globalThis);
