/**
 * Neon Dash — prerendered sprite cache.
 *
 * Every object type is drawn once into an offscreen canvas (glow included —
 * shadowBlur is far too expensive per-frame) and then blitted during play.
 * Sprites are keyed by (type, rotation, theme) and rendered at SPRITE_PX
 * pixels per grid unit; on-screen scaling handles zoom.
 */
/* global GD */
GD.register('sprites', function (GD) {
  'use strict';

  var SPRITE_PX = 48;          // pixels per grid unit in sprite space
  var cache = new Map();       // key -> canvas

  var S = {};

  function key(id, rot, themeId) {
    return id + ':' + (rot || 0) + ':' + (themeId || 0);
  }

  S.SPRITE_PX = SPRITE_PX;

  S.get = function (id, rot, themeId) {
    var k = key(id, rot, themeId);
    var c = cache.get(k);
    if (!c) {
      c = render(id, rot || 0, themeId || 0);
      cache.set(k, c);
    }
    return c;
  };

  S.clearCache = function () { cache.clear(); };

  // ------------------------------------------------------------------ utils
  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  /** Headless environments (jsdom) have no 2d context — return a blank canvas. */
  function ctx2d(c) {
    try { return c.getContext ? c.getContext('2d') : null; } catch (e) { return null; }
  }

  function theme(id) {
    return GD.level.THEMES[id] || GD.level.THEMES[0];
  }

  /** Draw with a neon glow: stroke/fill callback executed twice. */
  function withGlow(ctx, color, blur, fn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn(ctx);
    ctx.restore();
  }

  // ------------------------------------------------------------- renderers
  function render(id, rot, themeId) {
    var d = GD.objectdefs.getDef(id);
    var T = theme(themeId);
    var u = SPRITE_PX;
    var pad = Math.ceil(u * 0.35); // room for glow
    var w = d.w * u + pad * 2;
    var h = d.h * u + pad * 2;
    var c = makeCanvas(w, h);
    var ctx = ctx2d(c);
    if (!ctx) return c;
    ctx.translate(pad, pad);
    ctx.lineJoin = 'round';

    // Draw the object un-rotated, then bake rotation around the footprint
    // centre for anything whose orientation matters.
    drawObject(ctx, d, T, u);

    if (rot) {
      var c2 = makeCanvas(w, h);
      var x = ctx2d(c2);
      if (!x) return c2;
      x.translate(w / 2, h / 2);
      x.rotate(rot * Math.PI / 2);
      x.translate(-w / 2, -h / 2);
      x.drawImage(c, 0, 0);
      return c2;
    }
    return c;
  }

  function drawObject(ctx, d, T, u) {
    switch (d.kind) {
      case 'block': drawBlock(ctx, d, T, u); break;
      case 'platform': drawPlatform(ctx, d, T, u); break;
      case 'spike': drawSpike(ctx, d, T, u); break;
      case 'spikeball': drawSpikeBall(ctx, d, T, u); break;
      case 'saw': drawSaw(ctx, d, T, u); break;
      case 'mine': drawMine(ctx, d, T, u); break;
      case 'portal': drawPortal(ctx, d, T, u); break;
      case 'pad': drawPad(ctx, d, T, u); break;
      case 'orb': drawOrb(ctx, d, T, u); break;
      case 'deco': drawDeco(ctx, d, T, u); break;
    }
  }

  var BLOCK_STYLES = {
    basic:   { fill: '#0d1030', edge: '#ffffff' },
    brick:   { fill: '#161a3e', edge: '#ffffff', brick: true },
    metal:   { fill: '#1b2140', edge: '#cfe3ff', rivets: true },
    glass:   { fill: 'rgba(140,200,255,0.28)', edge: '#dff4ff' },
    glow:    { fill: '#101638', edge: T_ACCENT, glowEdge: true },
    checker: { fill: '#10143a', edge: '#ffffff', checker: true },
    stone:   { fill: '#20242e', edge: '#e8e8f0', cracks: true },
    circuit: { fill: '#0e1a2e', edge: '#5cf2ff', circuit: true },
    ice:     { fill: 'rgba(180,230,255,0.35)', edge: '#ffffff', shine: true },
    half:    { fill: '#0d1030', edge: '#ffffff' }
  };

  function T_ACCENT() { return '#00e5ff'; } // replaced per-theme at call time

  function drawBlock(ctx, d, T, u) {
    var style = BLOCK_STYLES[d.style] || BLOCK_STYLES.basic;
    var edge = style.glowEdge ? T.accent : style.edge;
    var w = d.w * u, h = d.h * u;
    ctx.fillStyle = style.fill;
    ctx.fillRect(0, 0, w, h);
    // inner detail
    if (style.brick) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)';
      ctx.lineWidth = 2;
      for (var yy = u / 2; yy < h; yy += u / 2) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, u / 2); ctx.stroke();
    }
    if (style.checker) {
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fillRect(0, 0, w / 2, h / 2);
      ctx.fillRect(w / 2, h / 2, w / 2, h / 2);
    }
    if (style.rivets) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      var m = u * 0.16;
      [[m, m], [w - m, m], [m, h - m], [w - m, h - m]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], u * 0.05, 0, 7); ctx.fill();
      });
    }
    if (style.circuit) {
      ctx.strokeStyle = 'rgba(92,242,255,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(u * 0.22, u * 0.22, u * 0.56, u * 0.56);
      ctx.beginPath(); ctx.moveTo(u * 0.5, 0); ctx.lineTo(u * 0.5, u * 0.22); ctx.stroke();
    }
    if (style.cracks) {
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.1); ctx.lineTo(w * 0.4, h * 0.5); ctx.lineTo(w * 0.3, h * 0.9);
      ctx.stroke();
    }
    if (style.shine) {
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(w * 0.35, 0); ctx.lineTo(0, h * 0.35);
      ctx.closePath(); ctx.fill();
    }
    // neon border
    withGlow(ctx, edge, u * 0.18, function (x) {
      x.strokeStyle = edge;
      x.lineWidth = Math.max(2, u * 0.07);
      x.strokeRect(0, 0, w, h);
    });
    // top highlight (the "walkable" edge, like GD's white top line)
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(0, 0, w, Math.max(2, u * 0.05));
  }

  function drawPlatform(ctx, d, T, u) {
    var w = d.w * u, h = d.h * u;
    var grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, T.accent);
    grad.addColorStop(1, 'rgba(255,255,255,0.15)');
    withGlow(ctx, T.accent, u * 0.25, function (x) {
      x.fillStyle = grad;
      var r = h / 2;
      x.beginPath();
      x.moveTo(r, 0); x.lineTo(w - r, 0); x.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2);
      x.lineTo(r, h); x.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
      x.closePath(); x.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(u * 0.1, 0, w - u * 0.2, Math.max(2, u * 0.05));
  }

  function drawSpike(ctx, d, T, u) {
    var w = d.w * u, h = d.h * u;
    var n = d.style === 'pair' ? 2 : 1;
    for (var i = 0; i < n; i++) {
      var x0 = (i * w) / n, x1 = ((i + 1) * w) / n;
      var path = function (x, inset) {
        x.beginPath();
        x.moveTo(x0 + inset, 0);
        x.lineTo(x1 - inset, 0);
        x.lineTo((x0 + x1) / 2, h);
        x.closePath();
      };
      ctx.fillStyle = '#0a0c1c';
      path(ctx, 0); ctx.fill();
      withGlow(ctx, '#ffffff', u * 0.12, function (x) {
        path(x, 0);
        x.strokeStyle = '#ffffff';
        x.lineWidth = Math.max(2, u * 0.055);
        x.stroke();
      });
      // inner shade
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x0 + w / (2 * n) * 0.3, h * 0.25);
      ctx.lineTo((x0 + x1) / 2, h * 0.86);
      ctx.lineTo(x1 - w / (2 * n) * 0.3, h * 0.25);
      ctx.stroke();
    }
  }

  function drawSpikeBall(ctx, d, T, u) {
    var cx = d.w * u / 2, cy = d.h * u / 2, r = u * 0.42;
    withGlow(ctx, '#ff4466', u * 0.2, function (x) {
      x.fillStyle = '#0a0c1c';
      x.strokeStyle = '#ffffff';
      x.lineWidth = Math.max(2, u * 0.05);
      x.beginPath();
      for (var a = 0; a < 12; a++) {
        var ang = (a / 12) * Math.PI * 2;
        var rr = a % 2 === 0 ? r : r * 0.6;
        var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
        if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.fill(); x.stroke();
    });
    ctx.fillStyle = '#ff4466';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.35, 0, 7); ctx.fill();
  }

  function drawSaw(ctx, d, T, u) {
    var cx = d.w * u / 2, cy = d.h * u / 2;
    var r = (d.hitbox ? d.hitbox.r : 0.45) * u * 1.06;
    withGlow(ctx, '#ff9944', u * 0.22, function (x) {
      x.fillStyle = '#0a0c1c';
      x.strokeStyle = '#ffd9a0';
      x.lineWidth = Math.max(2, u * 0.05);
      x.beginPath();
      var teeth = 10;
      for (var a = 0; a < teeth * 2; a++) {
        var ang = (a / (teeth * 2)) * Math.PI * 2;
        var rr = a % 2 === 0 ? r : r * 0.72;
        var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
        if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
      }
      x.closePath(); x.fill(); x.stroke();
    });
    ctx.fillStyle = '#ff9944';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.22, 0, 7); ctx.fill();
    ctx.fillStyle = '#0a0c1c';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.1, 0, 7); ctx.fill();
  }

  function drawMine(ctx, d, T, u) {
    var cx = d.w * u / 2, cy = d.h * u / 2, r = u * 0.3;
    withGlow(ctx, '#ff3355', u * 0.3, function (x) {
      x.strokeStyle = '#ff8899';
      x.lineWidth = Math.max(2, u * 0.05);
      for (var a = 0; a < 8; a++) {
        var ang = (a / 8) * Math.PI * 2;
        x.beginPath();
        x.moveTo(cx + Math.cos(ang) * r * 0.6, cy + Math.sin(ang) * r * 0.6);
        x.lineTo(cx + Math.cos(ang) * r * 1.35, cy + Math.sin(ang) * r * 1.35);
        x.stroke();
      }
      x.fillStyle = '#200a12';
      x.beginPath(); x.arc(cx, cy, r * 0.75, 0, 7); x.fill();
      x.strokeStyle = '#ff5577'; x.stroke();
    });
    ctx.fillStyle = '#ff3355';
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.3, 0, 7); ctx.fill();
  }

  var PORTAL_COLORS = {
    gravup: { a: '#3aa0ff', b: '#7fd4ff' },
    gravdown: { a: '#ffd94a', b: '#fff0a0' },
    speed05: { a: '#ff9d3a', b: '#ffd0a0' },
    speed1: { a: '#4dd964', b: '#b0ffb8' },
    speed2: { a: '#3ae0ff', b: '#c0f8ff' },
    speed3: { a: '#ff4da6', b: '#ffc0e5' },
    speed4: { a: '#ff3355', b: '#ffb0c0' }
  };

  function drawPortal(ctx, d, T, u) {
    var col = PORTAL_COLORS[d.style] || PORTAL_COLORS.gravup;
    var w = d.w * u, h = d.h * u;
    withGlow(ctx, col.a, u * 0.35, function (x) {
      x.strokeStyle = col.a;
      x.lineWidth = Math.max(3, u * 0.09);
      x.beginPath();
      x.ellipse(w / 2, h / 2, w * 0.38, h * 0.44, 0, 0, 7);
      x.stroke();
    });
    withGlow(ctx, col.b, u * 0.2, function (x) {
      x.strokeStyle = col.b;
      x.lineWidth = Math.max(2, u * 0.05);
      x.beginPath();
      x.ellipse(w / 2, h / 2, w * 0.24, h * 0.34, 0, 0, 7);
      x.stroke();
    });
    // floating ticks
    ctx.fillStyle = col.b;
    for (var i = 0; i < 3; i++) {
      var yy = h * (0.25 + i * 0.25);
      ctx.fillRect(w * 0.42, yy - u * 0.03, w * 0.16, u * 0.06);
    }
  }

  var PAD_COLORS = { yellow: '#ffd94a', pink: '#ff7bd5', blue: '#4ab6ff' };

  function drawPad(ctx, d, T, u) {
    var col = PAD_COLORS[d.style] || PAD_COLORS.yellow;
    var w = d.w * u, h = Math.max(u * 0.3, d.h * u);
    withGlow(ctx, col, u * 0.3, function (x) {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(w * 0.08, h);
      x.quadraticCurveTo(w * 0.5, -h * 0.9, w * 0.92, h);
      x.closePath(); x.fill();
    });
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(w * 0.2, h * 0.35, w * 0.6, Math.max(2, u * 0.05));
  }

  var ORB_COLORS = { yellow: '#ffd94a', pink: '#ff7bd5', blue: '#4ab6ff', green: '#5cf28a' };

  function drawOrb(ctx, d, T, u) {
    var col = ORB_COLORS[d.style] || ORB_COLORS.yellow;
    var cx = d.w * u / 2, cy = d.h * u / 2, r = u * 0.36;
    withGlow(ctx, col, u * 0.35, function (x) {
      x.strokeStyle = col;
      x.lineWidth = Math.max(3, u * 0.08);
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
    });
    var grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.5, col);
    grad.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.82, 0, 7); ctx.fill();
  }

  function drawDeco(ctx, d, T, u) {
    var w = d.w * u, h = d.h * u;
    var col = T.accent;
    ctx.globalAlpha = 0.9;
    switch (d.style) {
      case 'arrow':
        withGlow(ctx, col, u * 0.2, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(3, u * 0.08);
          x.beginPath();
          x.moveTo(w * 0.5, h * 0.08); x.lineTo(w * 0.5, h * 0.8);
          x.moveTo(w * 0.22, h * 0.5); x.lineTo(w * 0.5, h * 0.12); x.lineTo(w * 0.78, h * 0.5);
          x.stroke();
        });
        break;
      case 'chain':
        ctx.strokeStyle = 'rgba(200,210,255,0.8)';
        ctx.lineWidth = Math.max(2, u * 0.06);
        for (var i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.ellipse(w / 2, (i + 0.5) * h / 4, w * 0.16, h * 0.11, 0, 0, 7);
          ctx.stroke();
        }
        break;
      case 'dot':
        withGlow(ctx, col, u * 0.3, function (x) {
          x.fillStyle = col;
          x.beginPath(); x.arc(w / 2, h / 2, u * 0.09, 0, 7); x.fill();
        });
        break;
      case 'ring':
        withGlow(ctx, col, u * 0.25, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(2, u * 0.05);
          x.beginPath(); x.arc(w / 2, h / 2, u * 0.34, 0, 7); x.stroke();
        });
        break;
      case 'diamond':
        withGlow(ctx, col, u * 0.2, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(2, u * 0.06);
          x.beginPath();
          x.moveTo(w / 2, h * 0.1); x.lineTo(w * 0.85, h / 2);
          x.lineTo(w / 2, h * 0.9); x.lineTo(w * 0.15, h / 2);
          x.closePath(); x.stroke();
        });
        break;
      case 'star':
        withGlow(ctx, '#ffe08a', u * 0.25, function (x) {
          x.fillStyle = '#ffe08a';
          x.beginPath();
          for (var a = 0; a < 10; a++) {
            var ang = (a / 10) * Math.PI * 2 - Math.PI / 2;
            var rr = a % 2 === 0 ? u * 0.38 : u * 0.16;
            var px = w / 2 + Math.cos(ang) * rr, py = h / 2 + Math.sin(ang) * rr;
            if (a === 0) x.moveTo(px, py); else x.lineTo(px, py);
          }
          x.closePath(); x.fill();
        });
        break;
      case 'cross':
        withGlow(ctx, col, u * 0.18, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(3, u * 0.1);
          x.beginPath();
          x.moveTo(w * 0.5, h * 0.12); x.lineTo(w * 0.5, h * 0.88);
          x.moveTo(w * 0.12, h * 0.5); x.lineTo(w * 0.88, h * 0.5);
          x.stroke();
        });
        break;
      case 'bgspikes':
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.moveTo(0, h); ctx.lineTo(0, h * 0.5); ctx.lineTo(w * 0.25, h); 
        ctx.lineTo(w * 0.5, h * 0.4); ctx.lineTo(w * 0.75, h); ctx.lineTo(w, h * 0.5); ctx.lineTo(w, h);
        ctx.closePath(); ctx.fill();
        break;
      case 'grass':
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, u * 0.05);
        ctx.globalAlpha = 0.7;
        for (var g = 0; g < 4; g++) {
          ctx.beginPath();
          ctx.moveTo((g + 0.5) * w / 4, h);
          ctx.quadraticCurveTo((g + 0.5) * w / 4 + w * 0.08, h * 0.4, (g + 0.5) * w / 4 + w * 0.16, h * 0.15);
          ctx.stroke();
        }
        break;
      case 'building':
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(w * 0.1, h * 0.25, w * 0.8, h * 0.75);
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.5;
        for (var b = 0; b < 3; b++) ctx.fillRect(w * (0.2 + b * 0.25), h * 0.4, w * 0.1, h * 0.12);
        break;
      case 'planet':
        withGlow(ctx, col, u * 0.3, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(2, u * 0.05);
          x.beginPath(); x.arc(w / 2, h / 2, u * 0.3, 0, 7); x.stroke();
          x.beginPath(); x.ellipse(w / 2, h / 2, u * 0.45, u * 0.12, -0.4, 0, 7); x.stroke();
        });
        break;
      case 'box':
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = Math.max(2, u * 0.06);
        ctx.strokeRect(0, 0, w, h);
        break;
      case 'beam':
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, 'rgba(255,255,255,0.0)');
        grad.addColorStop(0.5, 'rgba(255,255,255,0.10)');
        grad.addColorStop(1, 'rgba(255,255,255,0.0)');
        ctx.fillStyle = grad;
        ctx.fillRect(w * 0.25, 0, w * 0.5, h);
        break;
      case 'wave':
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, u * 0.05);
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        for (var t = 0; t <= 1.001; t += 0.1) {
          var px = t * w, py = h / 2 + Math.sin(t * Math.PI * 2) * h * 0.3;
          if (t === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
        break;
      case 'bgtri':
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.lineTo(w / 2, 0);
        ctx.closePath(); ctx.fill();
        break;
      case 'pulsesq':
        withGlow(ctx, col, u * 0.15, function (x) {
          x.strokeStyle = col; x.lineWidth = Math.max(2, u * 0.05);
          x.strokeRect(w * 0.12, h * 0.12, w * 0.76, h * 0.76);
        });
        break;
    }
    ctx.globalAlpha = 1;
  }

  return S;
});
