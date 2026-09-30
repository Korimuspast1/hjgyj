/**
 * Neon Dash — level & world renderer.
 *
 * Draws the animated background, level objects (via the sprite cache), the
 * player, particle effects and editor overlays.  Used by:
 *   - the game screen (gameplay)
 *   - the editor canvas
 *   - the website's embedded player
 *
 * The renderer is purely a view: it reads a physics state or an editor
 * camera but never mutates gameplay data.
 */
/* global GD */
GD.register('levelrenderer', function (GD) {
  'use strict';

  var LR = {};

  LR.VIEW_UNITS = 11.5;      // grid units visible vertically at zoom 1
  LR.DEFAULT_GROUND_FRAC = 0.80;  // ground line position on screen

  // ---------------------------------------------------------------- camera
  function Camera() {
    this.x = 0;            // world units (centre of view)
    this.y = 0;            // vertical offset in units above ground
    this.zoom = 1;
    this.shake = 0;
  }
  LR.Camera = Camera;

  Camera.prototype.apply = function (ctx, w, h) {
    var ppu = this.ppu(w, h);
    var groundY = h * LR.DEFAULT_GROUND_FRAC;
    var cx = w * 0.32;      // player sits 32% from the left, GD-style
    var shakeX = 0, shakeY = 0;
    if (this.shake > 0) {
      shakeX = (Math.random() - 0.5) * this.shake * 14;
      shakeY = (Math.random() - 0.5) * this.shake * 14;
    }
    ctx.translate(cx + shakeX, groundY + shakeY);
    ctx.scale(ppu, -ppu);   // world y-up -> screen y-down
    ctx.translate(-this.x, -this.y);
  };

  Camera.prototype.ppu = function (w, h) {
    return (h / LR.VIEW_UNITS) * this.zoom;
  };

  /** World -> screen (for DOM overlays / hit testing). */
  Camera.prototype.worldToScreen = function (wx, wy, w, h) {
    var ppu = this.ppu(w, h);
    var groundY = h * LR.DEFAULT_GROUND_FRAC;
    var cx = w * 0.32;
    return {
      x: cx + (wx - this.x) * ppu,
      y: groundY - (wy - this.y) * ppu
    };
  };

  Camera.prototype.screenToWorld = function (sx, sy, w, h) {
    var ppu = this.ppu(w, h);
    var groundY = h * LR.DEFAULT_GROUND_FRAC;
    var cx = w * 0.32;
    return {
      x: this.x + (sx - cx) / ppu,
      y: this.y + (groundY - sy) / ppu
    };
  };

  // ------------------------------------------------------------- particles
  function Particles() {
    this.list = [];
  }
  LR.Particles = Particles;

  Particles.prototype.spawn = function (opts) {
    if (this.list.length > 400) this.list.shift();
    this.list.push({
      x: opts.x, y: opts.y,
      vx: opts.vx || 0, vy: opts.vy || 0,
      life: opts.life || 0.6, age: 0,
      size: opts.size || 0.12,
      color: opts.color || '#ffffff',
      gravity: opts.gravity === undefined ? 40 : opts.gravity,
      square: opts.square !== false,
      spin: opts.spin || 0,
      rot: 0
    });
  };

  Particles.prototype.burst = function (x, y, color, n, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = (0.3 + Math.random() * 0.7) * (speed || 9);
      this.spawn({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        life: 0.35 + Math.random() * 0.5,
        size: 0.08 + Math.random() * 0.16,
        color: color,
        spin: (Math.random() - 0.5) * 20
      });
    }
  };

  Particles.prototype.update = function (dt) {
    for (var i = this.list.length - 1; i >= 0; i--) {
      var p = this.list[i];
      p.age += dt;
      if (p.age >= p.life) { this.list.splice(i, 1); continue; }
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  };

  Particles.prototype.draw = function (ctx) {
    for (var i = 0; i < this.list.length; i++) {
      var p = this.list[i];
      var a = 1 - p.age / p.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      var s = p.size * (0.5 + a * 0.5);
      if (p.square) ctx.fillRect(-s / 2, -s / 2, s, s);
      else { ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, 7); ctx.fill(); }
      ctx.restore();
    }
  };

  Particles.prototype.clear = function () { this.list.length = 0; };

  // ----------------------------------------------------------- level draw
  /**
   * Draw a level's objects for the camera window.
   * time drives moving hazards & pulse animations.
   */
  LR.drawLevel = function (ctx, level, cam, w, h, time, opts) {
    opts = opts || {};
    var ppu = cam.ppu(w, h);
    var x0 = cam.x - (w * 0.32) / ppu - 3;
    var x1 = cam.x + (w * 0.68) / ppu + 3;

    var objects = level.objects;
    var i, o, d;

    // Two passes: background decoration, then gameplay objects.
    for (var pass = 0; pass < 2; pass++) {
      for (i = 0; i < objects.length; i++) {
        o = objects[i];
        d = GD.objectdefs.getDef(o.t);
        if (!d) continue;
        var isDeco = d.cat === 'decor';
        if ((pass === 0) !== isDeco) continue;
        if (o.x + d.w < x0 || o.x > x1) continue;
        drawObject(ctx, o, d, level, time, ppu, opts);
      }
    }

    // finish line
    if (level.length >= x0 && level.length <= x1) {
      var T = GD.level.THEMES[level.themeId] || GD.level.THEMES[0];
      ctx.save();
      ctx.globalAlpha = 0.85;
      for (var b = 0; b < 14; b++) {
        ctx.fillStyle = (b % 2 === 0) ? '#ffffff' : T.accent;
        ctx.fillRect(level.length, b, 0.5, 1);
      }
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(level.length, 0, 0.12, 14);
      ctx.restore();
    }
  };

  function drawObject(ctx, o, d, level, time, ppu, opts) {
    var sprite = GD.sprites.get(o.t, o.r || 0, level.themeId);
    var box = GD.physics.objectBox(o, time);
    var px = 48; // sprite space px per unit (see sprites.js)
    var x = box.x, y = box.y;
    var w = box.w, h = box.h;

    // animated effects
    var alpha = 1;
    if (d.pulse) {
      alpha = 0.75 + 0.25 * Math.sin(time * d.pulse * Math.PI * 2);
    }
    if (d.style === 'glow') {
      alpha = 0.8 + 0.2 * Math.sin(time * 3 + o.x);
    }
    if (d.cat === 'decor') alpha = 0.85;

    ctx.save();
    ctx.globalAlpha = alpha;

    if (d.kind === 'saw') {
      // spin around centre
      var cx = x + w / 2, cy = y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(time * (d.spin || 5));
      ctx.drawImage(sprite, -w / 2 - 48 * 0.35 * (w / 1), -h / 2 - 48 * 0.35 * (h / 1), w + 48 * 0.7 * w, h + 48 * 0.7 * h);
    } else if (d.kind === 'orb') {
      var bob = Math.sin(time * 2.4 + o.x * 0.7) * 0.08;
      var sc = 1 + Math.sin(time * 3 + o.x) * 0.05;
      var ocx = x + w / 2, ocy = y + h / 2 + bob;
      ctx.translate(ocx, ocy);
      ctx.scale(sc, sc);
      var padU = 0.35; // glow padding in units
      ctx.drawImage(sprite, -w / 2 - padU, -h / 2 - padU, w + padU * 2, h + padU * 2);
    } else if (d.kind === 'portal') {
      var pBob = Math.sin(time * 1.6 + o.x * 0.5) * 0.06;
      var pPadU = 0.35;
      ctx.translate(x + w / 2, y + h / 2 + pBob);
      ctx.drawImage(sprite, -w / 2 - pPadU, -h / 2 - pPadU, w + pPadU * 2, h + pPadU * 2);
    } else {
      var padU2 = 0.35;
      ctx.drawImage(sprite, x - padU2, y - padU2, w + padU2 * 2, h + padU2 * 2);
    }
    ctx.restore();

    // selection outline in the editor
    if (opts.selected && opts.selected.indexOf(o) !== -1) {
      ctx.save();
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 3 / ppu;
      ctx.strokeRect(x, y, w, h);
      ctx.restore();
    }
    void px;
  }

  // -------------------------------------------------------------- player
  LR.drawPlayer = function (ctx, state, colours, opts) {
    opts = opts || {};
    var sprite = GD.playericon.get(colours);
    var pad = 8 / GD.playericon.PIXELS;

    ctx.save();
    ctx.translate(state.x + 0.5, state.y + 0.5);
    ctx.rotate(state.rot * (opts.invertSpin ? -1 : 1));
    if (state.gravity < 0) ctx.scale(1, -1);
    var s = 1 + pad * 2;
    ctx.drawImage(sprite, -s / 2, -s / 2, s, s);
    ctx.restore();
  };

  /** Fading trail behind the cube. */
  LR.drawTrail = function (ctx, trail, colours) {
    for (var i = 0; i < trail.length; i++) {
      var t = trail[i];
      var a = (i / trail.length) * 0.35;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(t.x + 0.5, t.y + 0.5);
      ctx.rotate(t.rot || 0);
      ctx.fillStyle = colours.primary;
      var s = 0.9 * (i / trail.length);
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }
  };

  return LR;
});
