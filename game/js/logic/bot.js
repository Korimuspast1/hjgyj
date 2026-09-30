/**
 * Neon Dash — verification bot.
 *
 * A headless auto-player used by the automated tests (and by the editor's
 * "validate" helper) to prove that levels are physically completable.
 * It runs the exact same physics as the real game with a look-ahead heuristic:
 *
 *   - while grounded: jump when a lethal hazard is at the take-off distance,
 *     or when reaching the mathematically correct distance to climb a wall,
 *   - in mid-air: tap orbs when a hazard is about to be hit,
 *   - all look-aheads mirror correctly for inverted gravity.
 *
 * The bot is intentionally conservative — levels it can complete are
 * guaranteed to have generous, human-friendly timing windows.
 */
/* global GD */
GD.register('bot', function (GD) {
  'use strict';

  var LOOKAHEAD = 3.2;      // units ahead the bot inspects
  var JUMP_APEX = 2.05;     // matches physics tuning

  /**
   * Horizontal distance (units) needed after a jump starts before the player
   * has risen `climb` units.  Returns a large number when the climb is
   * impossible.  solve: JUMP_V*t - G/2*t^2 = climb.
   */
  function distanceToClimb(climb, speed) {
    var P = GD.physics;
    var disc = P.JUMP_V * P.JUMP_V - 2 * P.GRAVITY * climb;
    if (disc < 0) return 1e9; // cannot reach this height
    var t = (P.JUMP_V - Math.sqrt(disc)) / P.GRAVITY;
    return t * speed;
  }

  /**
   * Simulate a level.  Returns:
   *   { completed, progress, deaths, attempts, maxX, stuckAt }
   */
  function simulate(level, maxAttempts) {
    maxAttempts = maxAttempts || 3;
    var index = GD.level.buildIndex(level);
    var deaths = 0;
    var lastDeathX = -1, repeatedDeaths = 0;
    var maxX = 0;

    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      var s = GD.physics.createState();
      var input = { held: false, buffer: 0 };
      var guard = 0;
      while (s.alive && !s.finished && guard++ < 240 * 900) {
        decide(s, index, level, input);
        GD.physics.step(s, level, index, 1 / 240, input);
        maxX = Math.max(maxX, s.x);
      }
      if (s.finished) {
        return { completed: true, progress: 1, deaths: deaths, attempts: attempt, maxX: maxX, stuckAt: null };
      }
      deaths++;
      if (Math.abs(s.x - lastDeathX) < 2) {
        repeatedDeaths++;
        if (repeatedDeaths >= maxAttempts - 1) break; // consistently stuck
      } else {
        repeatedDeaths = 0;
      }
      lastDeathX = s.x;
    }
    return {
      completed: false,
      progress: Math.min(1, maxX / level.length),
      deaths: deaths,
      attempts: maxAttempts,
      maxX: maxX,
      stuckAt: lastDeathX
    };
  }

  function decide(s, index, level, input) {
    var P = GD.physics;
    var grav = s.gravity;                                   // +1 normal, -1 inverted
    var feet = grav > 0 ? s.y : s.y + P.PLAYER_SIZE;        // walking surface
    var speed = P.SPEED_BASE * s.speedMult;
    var ahead = index.query(s.x - 1, s.x + LOOKAHEAD + 3);

    var hazardDist = 1e9;
    var wallDist = 1e9, wallClimb = 0;

    for (var i = 0; i < ahead.length; i++) {
      var box = P.objectBox(ahead[i], s.time);
      if (!box) continue;
      var d = box.def;
      var dist = box.x - s.x - P.PLAYER_SIZE;   // gap between player front and object
      if (dist < -1.4 || dist > LOOKAHEAD) continue;

      if (d.lethal) {
        var lo = box.y, hi = box.y + box.h;
        // Grounded: the running band.  Airborne: also look at everything we
        // are about to fall onto (orbs are tapped for those) — hence the much
        // lower bandLo while in the air.
        var bandLo = feet - (s.onGround ? 0.65 : 2.6);
        var bandHi = feet + (s.onGround ? 0.55 : 2.3);
        if (hi >= bandLo && lo <= bandHi) {
          // Circle hazards (saws) can overhang their grid cell — measure the
          // distance to the circle's leading edge, not the cell edge.
          var distEff = dist;
          if (d.hitbox && d.hitbox.type === 'circle') {
            distEff = (box.x + box.w / 2 - d.hitbox.r) - s.x - P.PLAYER_SIZE;
          }
          if (distEff >= -0.95 && distEff < hazardDist) hazardDist = distEff;
        }
      } else if (d.solid) {
        var top = grav > 0 ? box.y + box.h : box.y;
        var climb = (top - feet) * grav;
        var blocksUs = grav > 0 ? (box.y < feet + 0.95) : (box.y + box.h > feet - 0.95);
        if (climb > 0.05 && climb <= JUMP_APEX && blocksUs && dist >= -0.25 && dist < wallDist) {
          wallDist = dist;
          wallClimb = climb;
        }
      }
    }

    // --- Mid-air: tap orbs if a hazard is close ahead/below -----------------
    if (!s.onGround) {
      var wantOrb = hazardDist < 1e8 && hazardDist < 1.5;
      if (wantOrb) {
        var orbs = index.query(s.x - 1.5, s.x + 2.5);
        for (var k = 0; k < orbs.length; k++) {
          var d2 = GD.objectdefs.getDef(orbs[k].t);
          if (!d2 || (d2.trigger !== 'orb' && d2.trigger !== 'gravorb' && d2.trigger !== 'gravorbjump')) continue;
          var ob = P.objectBox(orbs[k], s.time);
          var od = ob.x - s.x - P.PLAYER_SIZE;
          if (od > -0.9 && od < 1.0) {
            input.held = true;
            input.buffer = 0.2;
            return;
          }
        }
      }
      input.held = false;
      return;
    }

    // --- Grounded: decide when to jump --------------------------------------
    var hazardAhead = hazardDist < 1e8;
    if (hazardAhead && hazardDist < 0.55) {
      input.held = true;
      input.buffer = 0.05;
      return;
    }
    if (wallDist < 1e8) {
      var need = distanceToClimb(wallClimb + 0.12, speed) + 0.05;
      if (wallDist <= need) {
        input.held = true;
        return;
      }
    }
    input.held = false;
  }

  return { simulate: simulate, decide: decide, distanceToClimb: distanceToClimb };
});
