/**
 * Neon Dash — deterministic seeded RNG (mulberry32).
 * Used by the music generator, particle effects and background decoration so
 * every level plays & sounds identical on every device.
 */
/* global GD */
GD.register('rng', function () {
  'use strict';

  /**
   * Hash an arbitrary string into a 32-bit seed (FNV-1a style with avalanche).
   * Empty / non-string input yields a fixed seed so behaviour stays deterministic.
   */
  function seedFromString(s) {
    s = String(s == null ? '' : s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = (h * 0x01000193) >>> 0;
    }
    // avalanche
    h ^= h >>> 16; h = (h * 0x85ebca6b) >>> 0;
    h ^= h >>> 13; h = (h * 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  }

  /** Create a PRNG.  rand() -> float in [0,1).  Deterministic across engines. */
  function createRandom(seed) {
    var a = (typeof seed === 'number' ? Math.floor(seed) : seedFromString(seed)) >>> 0;
    if (a === 0) a = 0x9e3779b9; // avoid degenerate zero state
    var hasNext = false, nextGauss = 0;
    var rand = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rand.int = function (maxExclusive) { return Math.floor(rand() * maxExclusive); };
    rand.range = function (lo, hi) { return lo + rand() * (hi - lo); };
    rand.pick = function (arr) { return arr[Math.floor(rand() * arr.length)]; };
    /** Standard normal distribution (Box–Muller). */
    rand.gauss = function () {
      if (hasNext) { hasNext = false; return nextGauss; }
      var u = Math.max(1e-9, rand()), v = rand();
      var mag = Math.sqrt(-2 * Math.log(u));
      nextGauss = mag * Math.sin(2 * Math.PI * v);
      hasNext = true;
      return mag * Math.cos(2 * Math.PI * v);
    };
    rand.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(rand() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    };
    return rand;
  }

  return { createRandom: createRandom, seedFromString: seedFromString };
});
