/**
 * Neon Dash — level construction helpers.
 *
 * Small fluent helpers used to build the official levels (and handy for
 * tests).  Everything funnels through the same object ids that the editor
 * uses, and every built level is validated before it ships.
 */
/* global GD */
GD.register('levelbuild', function (GD) {
  'use strict';

  function Builder(name, author, opts) {
    opts = opts || {};
    this.level = GD.level.create(name, author);
    this.level.songId = opts.songId || 0;
    this.level.themeId = opts.themeId || 0;
    this.level.difficulty = opts.difficulty !== undefined ? opts.difficulty : 1;
    this.level.length = opts.length || 240;
  }

  Builder.prototype.add = function (t, x, y, r, p) {
    this.level.objects.push({ t: t, x: x, y: y === undefined ? 0 : y, r: r || 0, p: p || 0 });
    return this;
  };

  Builder.prototype.spike = function (x, y, r) { return this.add(20, x, y, r); };
  Builder.prototype.spikeSmall = function (x, y, r) { return this.add(21, x, y, r); };
  Builder.prototype.block = function (x, y, style) {
    var id = { basic: 1, brick: 2, metal: 3, glass: 4, glow: 5, checker: 6, stone: 7, circuit: 8, ice: 9 }[style || 'basic'] || 1;
    return this.add(id, x, y);
  };
  Builder.prototype.saw = function (x, y, size) {
    var id = size === 'big' ? 30 : (size === 'medium' ? 29 : 28);
    return this.add(id, x, y);
  };
  Builder.prototype.movingSaw = function (x, y, amp, period, phase, axis, size) {
    var p = GD.objectdefs.packMovement(amp, period, phase, axis);
    return this.add(size === 'big' ? 30 : 28, x, y, 0, p);
  };
  Builder.prototype.mine = function (x, y) { return this.add(31, x, y); };
  Builder.prototype.pad = function (x, y, style) {
    return this.add(style === 'pink' ? 51 : (style === 'blue' ? 52 : 50), x, y);
  };
  Builder.prototype.orb = function (x, y, style) {
    return this.add(style === 'pink' ? 56 : (style === 'blue' ? 57 : (style === 'green' ? 58 : 55)), x, y);
  };
  Builder.prototype.portal = function (kind, x, y) {
    var ids = {
      gravUp: 40, gravDown: 41,
      speed05: 42, speed1: 43, speed2: 44, speed3: 45, speed4: 46
    };
    return this.add(ids[kind], x, y === undefined ? 0 : y);
  };
  Builder.prototype.platform = function (x, y, len) {
    return this.add(len >= 4 ? 14 : (len >= 2 ? 13 : 12), x, y);
  };
  Builder.prototype.deco = function (id, x, y, r, p) { return this.add(id, x, y, r, p); };

  /** Row of spikes from x0 to x1 inclusive. */
  Builder.prototype.spikeRow = function (x0, x1, y, r) {
    for (var x = x0; x <= x1; x++) this.spike(x, y, r);
    return this;
  };

  /** Solid pillar of blocks (a wall / staircase step). */
  Builder.prototype.column = function (x, y0, y1, style) {
    for (var y = y0; y <= y1; y++) this.block(x, y, style);
    return this;
  };

  /** A ceiling of blocks (for corridors). */
  Builder.prototype.ceiling = function (x0, x1, y, style) {
    for (var x = x0; x <= x1; x++) this.block(x, y, style);
    return this;
  };

  Builder.prototype.build = function () {
    GD.level.validate(this.level);
    return this.level;
  };

  return { Builder: Builder };
});
