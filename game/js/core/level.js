/**
 * Neon Dash — level model, validation and spatial index.
 *
 * A level is a header plus a list of objects placed on the unit grid:
 *   { name, author, songId, themeId, difficulty, length,
 *     objects: [ { t, x, y, r, p } ] }
 *
 * See docs/LEVEL_FORMAT.md for the full encoding specification.
 */
/* global GD */
GD.register('level', function (GD) {
  'use strict';

  var objectdefs = null; // resolved lazily to avoid load-order coupling

  function od() {
    if (!objectdefs) objectdefs = GD.objectdefs;
    return objectdefs;
  }

  var MAX_OBJECTS = 20000;
  var MAX_NAME = 24;
  var MIN_LENGTH = 16;
  var MAX_LENGTH = 6000;

  var THEMES = [
    { id: 0, key: 'stereo',   name: 'Stereo Blue',  top: '#2a6df0', bottom: '#0a1e5e', ground: '#122a8a', groundLine: '#9fc8ff', accent: '#00e5ff' },
    { id: 1, key: 'sunset',   name: 'Sunset',       top: '#ff5e62', bottom: '#4a1042', ground: '#5a1448', groundLine: '#ffb3c8', accent: '#ffcc33' },
    { id: 2, key: 'toxic',    name: 'Toxic',        top: '#1fd46b', bottom: '#062b18', ground: '#0a3d22', groundLine: '#8effc0', accent: '#aaff33' },
    { id: 3, key: 'midnight', name: 'Midnight',     top: '#7a3cff', bottom: '#12082e', ground: '#1c0f45', groundLine: '#c8b3ff', accent: '#cc66ff' },
    { id: 4, key: 'inferno',  name: 'Inferno',      top: '#ff2e2e', bottom: '#3d0505', ground: '#4a0808', groundLine: '#ffb0a0', accent: '#ff7733' }
  ];

  var SONGS = [
    { id: 0, key: 'neon',    name: 'Neon Drive',     bpm: 128, seed: 'neon-drive',      mood: 'bright' },
    { id: 1, key: 'circuit', name: 'Circuit Breaker', bpm: 140, seed: 'circuit-breaker', mood: 'dark' },
    { id: 2, key: 'voltage', name: 'Voltage',         bpm: 152, seed: 'voltage',        mood: 'bright' },
    { id: 3, key: 'hyper',   name: 'Hyperdrive',      bpm: 160, seed: 'hyperdrive',     mood: 'dark' }
  ];

  var DIFFICULTIES = [
    { id: 0, key: 'easy',   name: 'Easy',   stars: 1, color: '#4dd964' },
    { id: 1, key: 'normal', name: 'Normal', stars: 2, color: '#45c6ff' },
    { id: 2, key: 'hard',   name: 'Hard',   stars: 4, color: '#ffcc33' },
    { id: 3, key: 'harder', name: 'Harder', stars: 6, color: '#ff7733' },
    { id: 4, key: 'insane', name: 'Insane', stars: 8, color: '#ff3355' }
  ];

  /** Create an empty level. */
  function create(name, author) {
    return {
      name: GD.util.sanitizeName(name || 'Untitled', MAX_NAME),
      author: GD.util.sanitizeName(author || 'Player', MAX_NAME),
      songId: 0,
      themeId: 0,
      difficulty: 1,
      length: 120,
      objects: []
    };
  }

  /**
   * Validate & normalise a level object (in place).  Throws Error with a
   * human-readable message describing the first problem found — used both by
   * the level importer (corrupted data protection) and the API server mirror
   * (server/ndl.py keeps the same rules).
   */
  function validate(level, opts) {
    opts = opts || {};
    if (!level || typeof level !== 'object') throw new Error('Level is not an object');
    if (typeof level.name !== 'string' || !level.name.length) throw new Error('Level name missing');
    if (level.name.length > MAX_NAME) throw new Error('Level name too long (max ' + MAX_NAME + ')');
    if (typeof level.author !== 'string' || level.author.length > MAX_NAME) throw new Error('Invalid author');
    var songId = level.songId | 0;
    if (!(songId >= 0 && songId < SONGS.length)) throw new Error('Unknown song id ' + level.songId);
    var themeId = level.themeId | 0;
    if (!(themeId >= 0 && themeId < THEMES.length)) throw new Error('Unknown theme id ' + level.themeId);
    var difficulty = level.difficulty | 0;
    if (!(difficulty >= 0 && difficulty < DIFFICULTIES.length)) throw new Error('Unknown difficulty ' + level.difficulty);
    var length = level.length | 0;
    if (!(length >= MIN_LENGTH && length <= MAX_LENGTH)) {
      throw new Error('Level length must be ' + MIN_LENGTH + '-' + MAX_LENGTH + ' units');
    }
    if (!Array.isArray(level.objects)) throw new Error('Level objects missing');
    if (level.objects.length > MAX_OBJECTS) throw new Error('Too many objects (max ' + MAX_OBJECTS + ')');

    var maxY = od().MAX_Y;
    for (var i = 0; i < level.objects.length; i++) {
      var o = level.objects[i];
      if (!o || typeof o !== 'object') throw new Error('Bad object at index ' + i);
      var d = od().getDef(o.t);
      if (!d) throw new Error('Unknown object type ' + o.t + ' at index ' + i);
      if (typeof o.x !== 'number' || Math.floor(o.x) !== o.x || o.x < 0 || o.x > od().MAX_X) {
        throw new Error('Invalid x coordinate ' + o.x + ' at index ' + i);
      }
      if (typeof o.y !== 'number' || Math.floor(o.y) !== o.y || o.y < 0 || o.y > maxY) {
        throw new Error('Invalid y coordinate ' + o.y + ' at index ' + i);
      }
      if (o.y + d.h > od().LEVEL_HEIGHT) throw new Error('Object at index ' + i + ' pokes above the ceiling');
      var r = o.r || 0;
      if (!(r >= 0 && r <= 3)) throw new Error('Invalid rotation ' + o.r + ' at index ' + i);
      var p = o.p || 0;
      if (!(p >= 0 && p <= 65535)) throw new Error('Invalid param ' + o.p + ' at index ' + i);
      // Params are meaningful only for "moving" types but tolerated everywhere
      // (ignored) to keep the format forward-compatible.
      if (o.x > length + 32) {
        if (!opts.lenientOverflow) throw new Error('Object at index ' + i + ' is beyond the level end');
      }
    }
    level.name = GD.util.sanitizeName(level.name, MAX_NAME);
    level.author = GD.util.sanitizeName(level.author, MAX_NAME);
    level.songId = songId;
    level.themeId = themeId;
    level.difficulty = difficulty;
    level.length = length;
    return level;
  }

  /**
   * Build a spatial index: buckets of objects keyed by grid column.
   * Query with columns [x0..x1] to get all objects potentially overlapping.
   */
  function buildIndex(level) {
    var buckets = new Map();
    for (var i = 0; i < level.objects.length; i++) {
      var o = level.objects[i];
      var d = od().getDef(o.t);
      if (!d) continue;
      var w = d.w;
      var x0 = Math.floor(o.x) - 1;
      var x1 = Math.floor(o.x + w);
      for (var c = x0; c <= x1; c++) {
        var arr = buckets.get(c);
        if (!arr) { arr = []; buckets.set(c, arr); }
        arr.push(o);
      }
    }
    return {
      buckets: buckets,
      /** All objects whose footprint intersects columns [x0..x1]. */
      query: function (x0, x1) {
        var out = [];
        var seen = new Set();
        for (var c = Math.floor(x0); c <= Math.floor(x1); c++) {
          var arr = buckets.get(c);
          if (!arr) continue;
          for (var i = 0; i < arr.length; i++) {
            var o = arr[i];
            if (!seen.has(o)) { seen.add(o); out.push(o); }
          }
        }
        return out;
      }
    };
  }

  /** Compute the level's end-of-level x (players finish when reaching it). */
  function finishX(level) {
    return level.length;
  }

  /** Highest occupied column — used by the editor to hint the level length. */
  function lastUsedX(level) {
    var m = 0;
    for (var i = 0; i < level.objects.length; i++) {
      var d = od().getDef(level.objects[i].t);
      if (d) m = Math.max(m, level.objects[i].x + d.w);
    }
    return m;
  }

  return {
    THEMES: THEMES,
    SONGS: SONGS,
    DIFFICULTIES: DIFFICULTIES,
    create: create,
    validate: validate,
    buildIndex: buildIndex,
    finishX: finishX,
    lastUsedX: lastUsedX,
    MAX_OBJECTS: MAX_OBJECTS,
    MAX_NAME: MAX_NAME,
    MIN_LENGTH: MIN_LENGTH,
    MAX_LENGTH: MAX_LENGTH
  };
});
