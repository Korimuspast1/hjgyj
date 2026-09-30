/**
 * Neon Dash — object library.
 *
 * Every placeable object type in the game lives here.  The definitions drive:
 *   - the level editor palette (categories, search, thumbnails),
 *   - collision (solid / slab / lethal + hitbox shape),
 *   - gameplay triggers (portals, pads, orbs),
 *   - rendering (kind + style switch in render/sprites.js).
 *
 * IDs are STABLE integers — they are what the level encoding format stores,
 * so never renumber existing entries (append new types at the end of a
 * category instead).
 *
 * Grid: 1 unit = 1 block.  Objects occupy [x, x+w) x [y, y+h) with y measured
 * from the ground (y = 0 is the ground row).  Rotation r in {0,1,2,3} rotates
 * the object 90 deg clockwise around the centre of its cell footprint.
 */
/* global GD */
GD.register('objectdefs', function (GD) {
  'use strict';

  var MAX_X = 100000;   // sanity bounds for the editor & validator
  var MAX_Y = 13;       // topmost row (level height is 14 units)
  var LEVEL_HEIGHT = 14;

  /**
   * Movement parameter packing for "moving" object types.
   * p = amp * 4096 + period8 * 64 + phase * 4 + axis
   *   amp     0..15   travel amplitude in grid units
   *   period8 1..63   oscillation period in 1/8 s (0.125s .. 7.875s)
   *   phase   0..15   starting phase in 1/16 of a cycle
   *   axis    0|1     0 = horizontal, 1 = vertical
   */
  function packMovement(amp, periodSec, phase, axis) {
    var a = GD.util.clamp(Math.round(amp), 0, 15);
    var p8 = GD.util.clamp(Math.round(periodSec * 8), 1, 63);
    var ph = GD.util.clamp(Math.round((phase % 1) * 16), 0, 15);
    var ax = axis ? 1 : 0;
    return a * 4096 + p8 * 64 + ph * 4 + ax;
  }

  function unpackMovement(p) {
    p = Math.max(0, Math.floor(p || 0));
    var amp = Math.floor(p / 4096);        // bits 12+
    var period8 = Math.floor((p % 4096) / 64); // bits 6..11
    var phase = Math.floor((p % 64) / 4);  // bits 1..4
    var axis = p % 2;                      // bit 0
    return {
      amp: amp,
      period: (period8 || 1) / 8,
      phase: phase / 16,
      axis: axis
    };
  }

  /** Movement offset (in units) at time t for a packed parameter. */
  function movementOffset(p, t) {
    var m = unpackMovement(p);
    if (!m.amp) return { dx: 0, dy: 0 };
    var w = 2 * Math.PI / m.period;
    var o = Math.sin(w * t + m.phase * 2 * Math.PI) * m.amp;
    return m.axis === 0 ? { dx: o, dy: 0 } : { dx: 0, dy: o };
  };

  // ---------------------------------------------------------------- categories
  var CATEGORIES = [
    { id: 'blocks',    name: 'Blocks',      color: '#3aa0ff' },
    { id: 'platforms', name: 'Platforms',   color: '#40e0d0' },
    { id: 'spikes',    name: 'Spikes',      color: '#ff5577' },
    { id: 'hazards',   name: 'Hazards',     color: '#ff9944' },
    { id: 'portals',   name: 'Portals',     color: '#c060ff' },
    { id: 'triggers',  name: 'Pads & Orbs', color: '#ffd94a' },
    { id: 'decor',     name: 'Decorations', color: '#88ffcc' }
  ];

  // ---------------------------------------------------------------- definitions
  var defs = {};
  var list = [];

  function def(d) {
    d.w = d.w || 1;
    d.h = d.h || 1;
    d.r = 0; // placeholder, real rotation comes from level data
    defs[d.id] = d;
    list.push(d);
    return d;
  }

  // ---- Solid blocks (land on top, deadly from the sides — Geometry Dash rules)
  def({ id: 1,  key: 'block_basic',   name: 'Basic Block',   cat: 'blocks', kind: 'block', style: 'basic',   solid: true });
  def({ id: 2,  key: 'block_brick',   name: 'Brick Block',   cat: 'blocks', kind: 'block', style: 'brick',   solid: true });
  def({ id: 3,  key: 'block_metal',   name: 'Metal Block',   cat: 'blocks', kind: 'block', style: 'metal',   solid: true });
  def({ id: 4,  key: 'block_glass',   name: 'Glass Block',   cat: 'blocks', kind: 'block', style: 'glass',   solid: true });
  def({ id: 5,  key: 'block_glow',    name: 'Glow Block',    cat: 'blocks', kind: 'block', style: 'glow',    solid: true });
  def({ id: 6,  key: 'block_checker', name: 'Checker Block', cat: 'blocks', kind: 'block', style: 'checker', solid: true });
  def({ id: 7,  key: 'block_stone',   name: 'Stone Block',   cat: 'blocks', kind: 'block', style: 'stone',   solid: true });
  def({ id: 8,  key: 'block_circuit', name: 'Circuit Block', cat: 'blocks', kind: 'block', style: 'circuit', solid: true });
  def({ id: 9,  key: 'block_ice',     name: 'Ice Block',     cat: 'blocks', kind: 'block', style: 'ice',     solid: true });
  def({ id: 10, key: 'block_half',    name: 'Half Block',    cat: 'blocks', kind: 'block', style: 'half',    solid: true, h: 0.5 });

  // ---- Platforms (only solid from above — jump through them from below)
  def({ id: 12, key: 'platform_tiny',  name: 'Tiny Platform',  cat: 'platforms', kind: 'platform', w: 1, h: 0.3, slab: true, style: 'neon' });
  def({ id: 13, key: 'platform_short', name: 'Short Platform', cat: 'platforms', kind: 'platform', w: 2, h: 0.3, slab: true, style: 'neon' });
  def({ id: 14, key: 'platform_long',  name: 'Long Platform',  cat: 'platforms', kind: 'platform', w: 4, h: 0.3, slab: true, style: 'neon' });

  // ---- Spikes (deadly to the touch)
  def({ id: 20, key: 'spike',       name: 'Spike',        cat: 'spikes', kind: 'spike', style: 'classic', lethal: true, hitbox: { type: 'tri', w: 1, h: 1 } });
  def({ id: 21, key: 'spike_small', name: 'Small Spike',  cat: 'spikes', kind: 'spike', style: 'classic', lethal: true, h: 0.5, hitbox: { type: 'tri', w: 1, h: 0.5 } });
  def({ id: 22, key: 'spike_mini',  name: 'Mini Spike',   cat: 'spikes', kind: 'spike', style: 'classic', lethal: true, w: 0.6, h: 0.35, hitbox: { type: 'tri', w: 0.6, h: 0.35 } });
  def({ id: 23, key: 'spike_pair',  name: 'Double Spike', cat: 'spikes', kind: 'spike', style: 'pair',   lethal: true, hitbox: { type: 'tri2', w: 1, h: 0.55 } });
  def({ id: 24, key: 'spike_needle', name: 'Needle',      cat: 'spikes', kind: 'spike', style: 'needle', lethal: true, w: 0.5, h: 1, hitbox: { type: 'tri', w: 0.5, h: 1 } });
  def({ id: 25, key: 'spike_ball',  name: 'Spike Ball',   cat: 'spikes', kind: 'spikeball', lethal: true, hitbox: { type: 'circle', r: 0.42 } });

  // ---- Hazards (saws, mines, moving dangers)
  def({ id: 28, key: 'saw_small',  name: 'Small Saw',   cat: 'hazards', kind: 'saw', lethal: true, hitbox: { type: 'circle', r: 0.40 }, spin: 6 });
  def({ id: 29, key: 'saw_medium', name: 'Medium Saw',  cat: 'hazards', kind: 'saw', lethal: true, hitbox: { type: 'circle', r: 0.62 }, spin: 5 });
  def({ id: 30, key: 'saw_big',    name: 'Big Saw',     cat: 'hazards', kind: 'saw', lethal: true, hitbox: { type: 'circle', r: 0.92 }, spin: 4 });
  def({ id: 31, key: 'mine',       name: 'Mine',        cat: 'hazards', kind: 'mine', lethal: true, hitbox: { type: 'circle', r: 0.30 }, pulse: 1.6 });
  def({ id: 32, key: 'moving_spike', name: 'Moving Spike', cat: 'hazards', kind: 'spike', style: 'classic', lethal: true, moving: true, h: 0.5, hitbox: { type: 'tri', w: 1, h: 0.5 } });
  def({ id: 33, key: 'moving_saw',  name: 'Moving Saw',  cat: 'hazards', kind: 'saw', lethal: true, moving: true, hitbox: { type: 'circle', r: 0.45 }, spin: 6 });
  def({ id: 34, key: 'moving_mine', name: 'Floating Mine', cat: 'hazards', kind: 'mine', lethal: true, moving: true, hitbox: { type: 'circle', r: 0.30 }, pulse: 1.6 });

  // ---- Portals (1x3 trigger column)
  def({ id: 40, key: 'portal_grav_up',   name: 'Gravity Flip Portal',  cat: 'portals', kind: 'portal', style: 'gravup',   w: 1, h: 3, trigger: 'gravity', value: -1 });
  def({ id: 41, key: 'portal_grav_down', name: 'Gravity Normal Portal', cat: 'portals', kind: 'portal', style: 'gravdown', w: 1, h: 3, trigger: 'gravity', value: 1 });
  def({ id: 42, key: 'portal_speed_05',  name: 'Speed 0.5x Portal', cat: 'portals', kind: 'portal', style: 'speed05', w: 1, h: 3, trigger: 'speed', value: 0.807 });
  def({ id: 43, key: 'portal_speed_1',   name: 'Speed 1x Portal',   cat: 'portals', kind: 'portal', style: 'speed1',  w: 1, h: 3, trigger: 'speed', value: 1.0 });
  def({ id: 44, key: 'portal_speed_2',   name: 'Speed 2x Portal',   cat: 'portals', kind: 'portal', style: 'speed2',  w: 1, h: 3, trigger: 'speed', value: 1.243 });
  def({ id: 45, key: 'portal_speed_3',   name: 'Speed 3x Portal',   cat: 'portals', kind: 'portal', style: 'speed3',  w: 1, h: 3, trigger: 'speed', value: 1.502 });
  def({ id: 46, key: 'portal_speed_4',   name: 'Speed 4x Portal',   cat: 'portals', kind: 'portal', style: 'speed4',  w: 1, h: 3, trigger: 'speed', value: 1.849 });

  // ---- Pads (floor boosters) & Orbs (tap in mid-air)
  def({ id: 50, key: 'pad_yellow', name: 'Yellow Pad', cat: 'triggers', kind: 'pad', style: 'yellow', w: 1, h: 0.35, trigger: 'pad', value: 1.32 });
  def({ id: 51, key: 'pad_pink',   name: 'Pink Pad',   cat: 'triggers', kind: 'pad', style: 'pink',   w: 1, h: 0.35, trigger: 'pad', value: 0.95 });
  def({ id: 52, key: 'pad_blue',   name: 'Blue Pad',   cat: 'triggers', kind: 'pad', style: 'blue',   w: 1, h: 0.35, trigger: 'gravpad', value: 0.75 });
  def({ id: 55, key: 'orb_yellow', name: 'Yellow Orb', cat: 'triggers', kind: 'orb', style: 'yellow', trigger: 'orb', value: 1.0 });
  def({ id: 56, key: 'orb_pink',   name: 'Pink Orb',   cat: 'triggers', kind: 'orb', style: 'pink',   trigger: 'orb', value: 0.78 });
  def({ id: 57, key: 'orb_blue',   name: 'Blue Orb',   cat: 'triggers', kind: 'orb', style: 'blue',   trigger: 'gravorb', value: 0.7 });
  def({ id: 58, key: 'orb_green',  name: 'Green Orb',  cat: 'triggers', kind: 'orb', style: 'green',  trigger: 'gravorbjump', value: 0.9 });

  // ---- Decorations (no gameplay effect, big visual variety)
  def({ id: 60, key: 'deco_arrow',   name: 'Hint Arrow',     cat: 'decor', kind: 'deco', style: 'arrow' });
  def({ id: 61, key: 'deco_chain',   name: 'Chain',          cat: 'decor', kind: 'deco', style: 'chain' });
  def({ id: 62, key: 'deco_dot',     name: 'Glow Dot',       cat: 'decor', kind: 'deco', style: 'dot' });
  def({ id: 63, key: 'deco_ring',    name: 'Pulse Ring',     cat: 'decor', kind: 'deco', style: 'ring', moving: true });
  def({ id: 64, key: 'deco_diamond', name: 'Diamond',        cat: 'decor', kind: 'deco', style: 'diamond' });
  def({ id: 65, key: 'deco_star',    name: 'Star',           cat: 'decor', kind: 'deco', style: 'star' });
  def({ id: 66, key: 'deco_cross',   name: 'Cross',          cat: 'decor', kind: 'deco', style: 'cross' });
  def({ id: 67, key: 'deco_bgspikes', name: 'BG Spikes',     cat: 'decor', kind: 'deco', style: 'bgspikes' });
  def({ id: 68, key: 'deco_grass',   name: 'Neon Grass',     cat: 'decor', kind: 'deco', style: 'grass' });
  def({ id: 69, key: 'deco_building', name: 'BG Building',   cat: 'decor', kind: 'deco', style: 'building' });
  def({ id: 70, key: 'deco_planet',  name: 'Planet',         cat: 'decor', kind: 'deco', style: 'planet' });
  def({ id: 71, key: 'deco_box',     name: 'BG Square',      cat: 'decor', kind: 'deco', style: 'box' });
  def({ id: 72, key: 'deco_beam',    name: 'Light Beam',     cat: 'decor', kind: 'deco', style: 'beam', moving: true });
  def({ id: 73, key: 'deco_wave',    name: 'Wave Line',      cat: 'decor', kind: 'deco', style: 'wave' });
  def({ id: 74, key: 'deco_tri',     name: 'BG Triangle',    cat: 'decor', kind: 'deco', style: 'bgtri' });
  def({ id: 75, key: 'deco_pulse',   name: 'Pulse Square',   cat: 'decor', kind: 'deco', style: 'pulsesq', moving: true });

  // ---------------------------------------------------------------- helpers
  function getDef(id) {
    return defs[id] || null;
  }

  function byCategory(cat) {
    return list.filter(function (d) { return d.cat === cat; });
  }

  /** Effective AABB of a placed object (before rotation/ movement). */
  function bounds(obj) {
    var d = defs[obj.t];
    if (!d) return null;
    return { x: obj.x, y: obj.y, w: d.w, h: d.h };
  }

  return {
    defs: defs,
    list: list,
    CATEGORIES: CATEGORIES,
    getDef: getDef,
    byCategory: byCategory,
    bounds: bounds,
    packMovement: packMovement,
    unpackMovement: unpackMovement,
    movementOffset: movementOffset,
    MAX_X: MAX_X,
    MAX_Y: MAX_Y,
    LEVEL_HEIGHT: LEVEL_HEIGHT,
    SOLID: 'solid', SLAB: 'slab'
  };
});
