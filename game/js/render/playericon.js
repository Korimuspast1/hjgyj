/**
 * Neon Dash — player icon rendering (the cube).
 *
 * Two customizable colours (primary body, secondary frame/face), a white
 * border, GD-style eyes and a glow.  Prerendered into an offscreen canvas
 * whenever the colours change.
 */
/* global GD */
GD.register('playericon', function (GD) {
  'use strict';

  var cached = null;
  var cachedKey = '';

  var PI = {};

  PI.PIXELS = 96; // sprite resolution

  /**
   * Returns a canvas with the player cube.  size = canvas px per unit.
   * colours = { primary: '#rrggbb', secondary: '#rrggbb' }
   */
  PI.get = function (colours) {
    var key = colours.primary + '|' + colours.secondary;
    if (cachedKey !== key) {
      cached = render(colours.primary, colours.secondary);
      cachedKey = key;
    }
    return cached;
  };

  function render(primary, secondary) {
    var u = PI.PIXELS;
    var pad = 8;
    var c = document.createElement('canvas');
    c.width = u + pad * 2;
    c.height = u + pad * 2;
    var ctx;
    try { ctx = c.getContext('2d'); } catch (e) { ctx = null; }
    if (!ctx) return c;
    ctx.translate(pad, pad);
    var r = u * 0.16;

    // glow
    ctx.save();
    ctx.shadowColor = primary;
    ctx.shadowBlur = 14;

    // outer frame (secondary colour)
    ctx.fillStyle = secondary;
    roundRect(ctx, 0, 0, u, u, r);
    ctx.fill();

    // inner body (primary)
    var inset = u * 0.10;
    ctx.fillStyle = primary;
    roundRect(ctx, inset, inset, u - inset * 2, u - inset * 2, r * 0.7);
    ctx.fill();
    ctx.restore();

    // glossy top
    var grad = ctx.createLinearGradient(0, 0, 0, u);
    grad.addColorStop(0, 'rgba(255,255,255,0.35)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = grad;
    roundRect(ctx, inset, inset, u - inset * 2, u - inset * 2, r * 0.7);
    ctx.fill();

    // eyes (GD face)
    var ey = u * 0.42, ex = u * 0.32, er = u * 0.13;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(u / 2 - ex, ey, er, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(u / 2 + ex, ey, er, 0, 7); ctx.fill();
    ctx.fillStyle = '#101425';
    var pr = er * 0.55;
    ctx.beginPath(); ctx.arc(u / 2 - ex + pr * 0.35, ey, pr, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(u / 2 + ex + pr * 0.35, ey, pr, 0, 7); ctx.fill();

    // mouth
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = u * 0.05;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(u * 0.36, u * 0.66);
    ctx.lineTo(u * 0.64, u * 0.66);
    ctx.stroke();

    return c;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  PI.roundRect = roundRect;

  return PI;
});
