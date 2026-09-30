/**
 * Neon Dash — player physics & simulation.
 *
 * Deterministic, fixed-substep simulation of the auto-runner cube:
 *   - constant horizontal speed (modified by speed portals),
 *   - GD-style gravity with hold-to-jump,
 *   - pads, orbs, gravity/speed portals,
 *   - solid blocks (land on top / die on walls, Geometry Dash rules),
 *   - pass-through platforms, spikes, saws, mines, moving hazards,
 *   - solid floor & ceiling so flipped-gravity sections play correctly.
 *
 * The module is pure: it never touches the DOM or timers, so the unit tests
 * and the "verification bot" (logic/bot.js) can step it directly.
 */
/* global GD */
GD.register('physics', function (GD) {
  'use strict';

  var P = {};

  // --- Tuned to feel like Geometry Dash's 1x-speed cube -------------------
  P.SPEED_BASE = 10.4;      // grid units / second at 1x
  P.GRAVITY = 65.6;         // units / s^2
  P.JUMP_V = 16.4;          // jump start velocity (units / s)
  P.TERMINAL = 26.0;        // max fall speed
  P.PLAYER_SIZE = 1.0;      // player occupies a 1x1 cell
  P.LETHAL_INSET = 0.25;    // forgiving inner hitbox for spikes/saws (0.5 box)
  P.LAND_TOLERANCE = 0.14;  // corner-clip forgiveness when landing
  P.STEP = 1 / 240;         // physics substep
  P.ROT_SPEED = Math.PI * 1.05; // radians / s while airborne (~189 deg / jump)
  P.ORB_BUFFER = 0.15;      // seconds a tap stays "buffered" for orbs
  P.LEVEL_H = GD.objectdefs ? GD.objectdefs.LEVEL_HEIGHT : 14;
  P.CEILING_MARGIN = 0.2;   // playable space below the ceiling

  /** Fresh player state at the start of an attempt. */
  P.createState = function () {
    return {
      x: 0, y: 0, vy: 0,
      gravity: 1,          // 1 = normal, -1 = inverted
      speedMult: 1,
      onGround: true,
      rot: 0,
      time: 0,             // simulation clock (drives moving objects)
      alive: true,
      finished: false,
      progress: 0,
      usedTriggers: {},    // id -> true, reset per attempt
      deathCause: null
    };
  };

  /** Effective world-space box of a placed object (rotation + movement). */
  P.objectBox = function (obj, time) {
    var d = GD.objectdefs.getDef(obj.t);
    if (!d) return null;
    var x = obj.x, y = obj.y, w = d.w, h = d.h, r = obj.r || 0;
    if (r === 1 || r === 3) { // rotate footprint 90deg around cell centre
      var cx = x + w / 2, cy = y + h / 2;
      var t = w; w = h; h = t;
      x = cx - w / 2; y = cy - h / 2;
    }
    if (obj.p) {
      var off = GD.objectdefs.movementOffset(obj.p, time);
      x += off.dx; y += off.dy;
    }
    return { x: x, y: y, w: w, h: h, def: d, r: r, obj: obj };
  };

  /** Player box for solid collision. */
  P.playerBox = function (s) {
    return { x: s.x, y: s.y, w: P.PLAYER_SIZE, h: P.PLAYER_SIZE };
  };

  /** Player box for lethal collision (smaller = forgiving, like GD). */
  P.playerLethalBox = function (s) {
    var i = P.LETHAL_INSET;
    return { x: s.x + i, y: s.y + i, w: P.PLAYER_SIZE - 2 * i, h: P.PLAYER_SIZE - 2 * i };
  };

  function kill(s, events, cause) {
    if (!s.alive) return;
    s.alive = false;
    s.deathCause = cause;
    events.push({ type: 'death', cause: cause, x: s.x, y: s.y });
  }

  function triggerKey(obj) {
    return obj.t + '@' + obj.x + ',' + obj.y;
  }

  /**
   * Advance the simulation by dt (split into fixed substeps).
   * input = { held: bool, buffer: seconds-of-tap-buffer }
   * Returns the list of events that happened during this call.
   */
  P.step = function (state, level, index, dt, input) {
    var events = [];
    if (!state.alive || state.finished) return events;
    input = input || { held: false, buffer: 0 };

    var remaining = Math.min(dt, 0.25);
    while (remaining > 1e-9 && state.alive && !state.finished) {
      var h = Math.min(P.STEP, remaining);
      remaining -= h;
      substep(state, level, index, h, input, events);
      if (input.buffer > 0) input.buffer = Math.max(0, input.buffer - h);
    }
    return events;
  };

  function substep(s, level, index, dt, input, events) {
    var C = GD.collision;

    // ---- 1. finish line -------------------------------------------------
    if (s.x >= level.length) {
      s.x = Math.min(s.x, level.length + 2);
      s.finished = true;
      s.progress = 1;
      events.push({ type: 'finish', x: s.x, y: s.y });
      return;
    }

    var prevBottom = s.y;
    var wasOnGround = s.onGround;

    // ---- 2. horizontal movement (auto-runner) ---------------------------
    s.x += P.SPEED_BASE * s.speedMult * dt;

    // ---- 3. vertical integration ----------------------------------------
    s.vy += -P.GRAVITY * s.gravity * dt;
    if (s.vy > P.TERMINAL) s.vy = P.TERMINAL;
    if (s.vy < -P.TERMINAL) s.vy = -P.TERMINAL;
    s.y += s.vy * dt;
    s.onGround = false;

    // ---- 4. floor & ceiling (solid level boundaries, never lethal) -------
    if (s.y <= 0 && s.vy <= 0) {
      if (s.gravity > 0) { s.y = 0; s.vy = 0; s.onGround = true; if (!wasOnGround) events.push({ type: 'land' }); }
      else { s.y = 0; s.vy = 0; } // inverted gravity resting on floor: just stop
    }
    var ceil = P.LEVEL_H - P.PLAYER_SIZE;
    if (s.y >= ceil && s.vy >= 0) {
      if (s.gravity < 0) { s.y = ceil; s.vy = 0; s.onGround = true; if (!wasOnGround) events.push({ type: 'land' }); }
      else { s.y = ceil; s.vy = 0; } // bumped head on ceiling while normal gravity
    }

    // ---- 5. objects ------------------------------------------------------
    var near = index.query(s.x - 3, s.x + 3);
    var n = near.length;
    for (var i = 0; i < n && s.alive; i++) {
      var obj = near[i];
      var box = P.objectBox(obj, s.time);
      if (!box || box.x > s.x + 2 || box.x + box.w < s.x - 1.5) continue;
      var d = box.def;

      if (d.solid) {
        var pb = P.playerBox(s);
        if (C.aabbOverlap(pb, box)) {
          var cls = C.classifySolid(pb, prevBottom, box, s.gravity, P.LAND_TOLERANCE);
          if (cls === 'land') {
            if (s.gravity > 0) { s.y = box.y + box.h; } else { s.y = box.y - P.PLAYER_SIZE; }
            if (s.vy !== 0 && !wasOnGround) events.push({ type: 'land', x: s.x, y: s.y });
            s.vy = 0;
            s.onGround = true;
          } else if (cls === 'crush') {
            kill(s, events, 'wall');
          }
        }
      } else if (d.slab) {
        // Platforms: solid only from the walking face, pass through otherwise.
        var pb2 = P.playerBox(s);
        if (C.aabbOverlap(pb2, box)) {
          var walkingTop = s.gravity > 0 && s.vy <= 0.001 && prevBottom >= box.y + box.h - 0.3;
          var walkingBottom = s.gravity < 0 && s.vy >= -0.001 && prevBottom + P.PLAYER_SIZE <= box.y + 0.3;
          if (walkingTop) {
            s.y = box.y + box.h; s.vy = 0; s.onGround = true;
            if (!wasOnGround) events.push({ type: 'land', x: s.x, y: s.y });
          } else if (walkingBottom) {
            s.y = box.y - P.PLAYER_SIZE; s.vy = 0; s.onGround = true;
            if (!wasOnGround) events.push({ type: 'land', x: s.x, y: s.y });
          }
        }
      }

      if (d.lethal && s.alive) {
        var lb = P.playerLethalBox(s);
        var hit = false;
        var hb = d.hitbox || { type: 'box', w: d.w, h: d.h };
        if (hb.type === 'circle') {
          hit = C.circleBoxOverlap(
            { x: box.x + box.w / 2, y: box.y + box.h / 2, r: hb.r }, lb);
        } else if (hb.type === 'tri' || hb.type === 'tri2') {
          if (hb.type === 'tri') {
            hit = C.triBoxOverlap({ x: box.x, y: box.y, w: box.w, h: box.h, dir: box.r }, lb, 0.06);
          } else { // tri2 = two small triangles side by side
            hit = C.triBoxOverlap({ x: box.x, y: box.y, w: box.w / 2, h: box.h, dir: box.r }, lb, 0.05) ||
                  C.triBoxOverlap({ x: box.x + box.w / 2, y: box.y, w: box.w / 2, h: box.h, dir: box.r }, lb, 0.05);
          }
        } else {
          hit = C.aabbOverlap({ x: box.x, y: box.y, w: box.w, h: box.h }, lb);
        }
        if (hit) {
          var cause = d.kind === 'saw' ? 'saw' : (d.kind === 'mine' ? 'mine' : 'spike');
          kill(s, events, cause);
        }
      }
    }

    // ---- 6. triggers (portals, pads, orbs) -------------------------------
    for (i = 0; i < n && s.alive && !s.finished; i++) {
      var obj2 = near[i];
      var d2 = GD.objectdefs.getDef(obj2.t);
      if (!d2 || !d2.trigger) continue;
      var b2 = P.objectBox(obj2, s.time);
      if (!C.aabbOverlap(P.playerBox(s), b2)) continue;

      var key = triggerKey(obj2);
      if (d2.trigger === 'gravity') {
        if (s.usedTriggers[key]) continue;
        s.usedTriggers[key] = true;
        if (s.gravity !== d2.value) {
          s.gravity = d2.value;
          events.push({ type: 'portal', kind: 'gravity', value: d2.value, x: s.x, y: s.y });
        }
      } else if (d2.trigger === 'speed') {
        if (s.usedTriggers[key]) continue;
        s.usedTriggers[key] = true;
        if (s.speedMult !== d2.value) {
          s.speedMult = d2.value;
          events.push({ type: 'portal', kind: 'speed', value: d2.value, x: s.x, y: s.y });
        }
      } else if (d2.trigger === 'pad') {
        if (s.usedTriggers[key]) continue;
        s.usedTriggers[key] = true;
        s.vy = d2.value * P.JUMP_V * s.gravity;
        s.onGround = false;
        events.push({ type: 'pad', style: d2.style, x: s.x, y: s.y });
      } else if (d2.trigger === 'gravpad') {
        if (s.usedTriggers[key]) continue;
        s.usedTriggers[key] = true;
        s.gravity = -s.gravity;
        s.vy = d2.value * P.JUMP_V * s.gravity;
        s.onGround = false;
        events.push({ type: 'pad', style: 'blue', x: s.x, y: s.y });
        events.push({ type: 'portal', kind: 'gravity', value: s.gravity, x: s.x, y: s.y });
      } else if (d2.trigger === 'orb' || d2.trigger === 'gravorb' || d2.trigger === 'gravorbjump') {
        if (s.usedTriggers[key]) continue;
        if (input.held || input.buffer > 0) {
          s.usedTriggers[key] = true;
          input.buffer = 0;
          if (d2.trigger === 'gravorb') {
            s.gravity = -s.gravity;
            events.push({ type: 'portal', kind: 'gravity', value: s.gravity, x: s.x, y: s.y });
          } else if (d2.trigger === 'gravorbjump') {
            s.gravity = -s.gravity;
            events.push({ type: 'portal', kind: 'gravity', value: s.gravity, x: s.x, y: s.y });
          }
          s.vy = d2.value * P.JUMP_V * s.gravity;
          s.onGround = false;
          events.push({ type: 'orb', style: d2.style, x: s.x, y: s.y });
        }
      }
    }

    // ---- 7. jump (hold to auto-jump on landing, like GD) ------------------
    if (s.alive && !s.finished && s.onGround && input.held) {
      s.vy = P.JUMP_V * s.gravity;
      s.onGround = false;
      events.push({ type: 'jump', x: s.x, y: s.y });
    }

    // ---- 8. rotation animation -------------------------------------------
    if (s.onGround) {
      var target = Math.round(s.rot / (Math.PI / 2)) * (Math.PI / 2);
      s.rot = target + (s.rot - target) * Math.exp(-25 * dt);
      if (Math.abs(s.rot - target) < 0.01) s.rot = target;
    } else {
      s.rot += P.ROT_SPEED * dt * s.gravity;
    }

    // ---- 9. bookkeeping ----------------------------------------------------
    s.time += dt;
    s.progress = GD.util.clamp(s.x / level.length, 0, 1);

    // Safety net: outside the level vertically -> death.
    if (s.y < -2 || s.y > P.LEVEL_H + 2) kill(s, events, 'void');
  }

  return P;
});
