/**
 * Neon Dash — animated background & ground renderer.
 *
 * Geometry-Dash-style: saturated vertical gradient that slowly shifts hue,
 * parallax rows of translucent squares, and a ground plane with a glowing
 * top line.  Deterministic per level (seeded), zero allocations per frame
 * beyond the gradient caches.
 */
/* global GD */
GD.register('background', function (GD) {
  'use strict';

  var BG = {};

  var squareLayers = null;
  var squareSeedKey = null;

  function buildSquares(seed) {
    var rand = GD.rng.createRandom('bg:' + seed);
    var layers = [];
    for (var l = 0; l < 3; l++) {
      var count = 6 + l * 3;
      var arr = [];
      for (var i = 0; i < count; i++) {
        arr.push({
          x: rand.range(0, 200),
          y: rand.range(0.05, 0.75),
          size: rand.range(2.2, 5.5) + l,
          rot: rand.range(0, Math.PI),
          spin: rand.range(-0.15, 0.15),
          alpha: 0.05 + l * 0.03
        });
      }
      layers.push({ speed: 0.12 + l * 0.14, squares: arr });
    }
    return layers;
  }

  /**
   * Draw the full background for a level theme.
   *  ctx      — 2d context (screen space)
   *  w, h     — canvas size in px
   *  camX     — camera x in grid units
   *  time     — seconds (animation clock)
   *  themeId  — level theme
   *  seed     — level seed for deterministic decoration
   */
  BG.draw = function (ctx, w, h, camX, time, themeId, seed, groundY, inverted) {
    var T = GD.level.THEMES[themeId] || GD.level.THEMES[0];

    // ---- gradient sky (hue drifts gently with time) ------------------------
    var shift = Math.sin(time * 0.08) * 0.06;
    var top = shade(T.top, shift);
    var bottom = shade(T.bottom, shift);
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ---- parallax square pattern (the classic GD bg look) ------------------
    var key = themeId + ':' + (seed || '');
    if (squareSeedKey !== key) {
      squareLayers = buildSquares(key);
      squareSeedKey = key;
    }
    var unitsVisible = h / 48; // approx; pattern is screen-relative anyway
    for (var l = 0; l < squareLayers.length; l++) {
      var layer = squareLayers[l];
      var par = camX * layer.speed * 48;
      ctx.save();
      for (var i = 0; i < layer.squares.length; i++) {
        var q = layer.squares[i];
        var spacing = 26 + l * 8;
        var x = ((q.x * 48 - par) % (spacing * 48 / 4) + spacing * 12) % (w + 400) - 200;
        var y = q.y * h * (inverted ? 0.9 : 0.72);
        var s = q.size * 48 * 0.35 * (h / 720 + 0.4);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(q.rot + time * q.spin * 0.2);
        ctx.fillStyle = 'rgba(255,255,255,' + (q.alpha * (0.7 + 0.3 * Math.sin(time + i))) + ')';
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = 'rgba(255,255,255,' + (q.alpha * 1.6) + ')';
        ctx.lineWidth = 2;
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      }
      ctx.restore();
    }

    // ---- ground plane ------------------------------------------------------
    var gy = groundY !== undefined ? groundY : h * 0.78;
    var ggrad = ctx.createLinearGradient(0, gy, 0, h);
    ggrad.addColorStop(0, shade(T.ground, 0.05));
    ggrad.addColorStop(1, shade(T.ground, -0.12));
    ctx.fillStyle = ggrad;
    ctx.fillRect(0, gy, w, h - gy);

    // scrolling grid on the ground
    var cell = 48;
    var off = (-camX * 48) % cell;
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var gx = off; gx < w + cell; gx += cell) {
      ctx.moveTo(gx, gy); ctx.lineTo(gx, h);
    }
    ctx.stroke();

    // glowing top line
    ctx.save();
    ctx.shadowColor = T.groundLine;
    ctx.shadowBlur = 14;
    ctx.fillStyle = T.groundLine;
    ctx.fillRect(0, gy - 2, w, 3);
    ctx.restore();

    void unitsVisible;
  };

  /** Shift a hex color's brightness by [-1,1]. */
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    var f = function (v) { return Math.max(0, Math.min(255, Math.round(v + amt * 255))); };
    return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
  }

  BG.shade = shade;

  return BG;
});
