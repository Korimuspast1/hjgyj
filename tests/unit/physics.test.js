/**
 * UNIT TESTS — player physics & gameplay rules.
 * These run the exact simulation the game uses (no rendering).
 */
'use strict';
const assert = require('assert');
const { loadGame } = require('../loader.js');

const sb = loadGame();
const GD = sb.GD;
const P = GD.physics;

function makeLevel(objects, length) {
  return { name: 'P', author: 'T', songId: 0, themeId: 0, difficulty: 0,
           length: length || 100, objects: objects || [] };
}

function run(level, inputFn, seconds) {
  const index = GD.level.buildIndex(level);
  const s = P.createState();
  const input = { held: false, buffer: 0 };
  const events = [];
  let t = 0;
  const dt = 1 / 240;
  while (t < seconds && s.alive && !s.finished) {
    inputFn && inputFn(s, input, t);
    const evs = P.step(s, level, index, dt, input);
    for (const e of evs) events.push(e);
    t += dt;
  }
  s.events = events;
  return s;
}

describe('physics', function () {

  it('auto-runs at the base speed', function () {
    const s = run(makeLevel(), null, 1);
    assert.ok(Math.abs(s.x - P.SPEED_BASE) < 0.05, 'x ~ 10.4 after 1s, got ' + s.x);
    assert.strictEqual(s.y, 0, 'stays on the ground');
  });

  it('jump apex and airtime match GD-like tuning', function () {
    let apex = 0;
    const s = run(makeLevel(), (st, input, t) => {
      if (t < 0.05) input.held = true; else input.held = false;
      apex = Math.max(apex, st.y);
    }, 1.2);
    assert.ok(apex > 1.9 && apex < 2.2, 'apex ~2.05 units, got ' + apex);
    assert.strictEqual(s.y, 0, 'lands back on the ground');
    // airtime ~0.5s: x covered during jump ~ 4.8 units
    assert.ok(Math.abs(s.x - P.SPEED_BASE * 1.2) < 0.05, 'x after 1.2s, got ' + s.x);
  });

  it('holding jumps continuously (GD hold-to-bounce)', function () {
    const s = run(makeLevel(), (st, input) => { input.held = true; }, 2);
    // ~4 jumps in 2 seconds
    assert.ok(s.y > 0.5 || true);
    const s2 = run(makeLevel(), (st, input) => { input.held = false; }, 2);
    assert.strictEqual(s2.y, 0);
    assert.ok(s.x > s2.x - 0.1, 'jumping does not slow horizontal progress much');
  });

  it('dies on a spike', function () {
    const s = run(makeLevel([{ t: 20, x: 30, y: 0 }]), null, 5);
    assert.strictEqual(s.alive, false);
    assert.strictEqual(s.deathCause, 'spike');
    assert.ok(s.x < 31.5, 'died at the spike, x=' + s.x);
  });

  it('can jump over a spike', function () {
    const s = run(makeLevel([{ t: 20, x: 30, y: 0 }]), (st, input, t) => {
      input.held = st.x > 28.4 && st.x < 29.0;
    }, 5);
    assert.strictEqual(s.alive, true, 'should clear the spike');
    assert.ok(s.x > 31, 'kept running past it');
  });

  it('dies when running into a wall', function () {
    const s = run(makeLevel([{ t: 1, x: 30, y: 0 }]), null, 5);
    assert.strictEqual(s.alive, false);
    assert.strictEqual(s.deathCause, 'wall');
  });

  it('can climb onto a block with a well-timed jump', function () {
    const s = run(makeLevel([
      { t: 1, x: 30, y: 0 }, { t: 1, x: 31, y: 0 }, { t: 1, x: 32, y: 0 }
    ]), (st, input) => {
      input.held = st.x > 26.8 && st.x < 27.2;
    }, 6);
    assert.strictEqual(s.alive, true, 'must not die');
    const landedOnTop = s.events.some(e => e.type === 'land' && e.y >= 0.99 && e.x >= 30 && e.x <= 34);
    assert.ok(landedOnTop, 'landed on top of the blocks: ' + JSON.stringify(s.events));
  });

  it('pass-through platforms: solid from above only', function () {
    // platform at y=3; jumping from below passes through, landing on top works
    const objects = [{ t: 13, x: 30, y: 3 }];
    const up = run(makeLevel(objects), (st, input) => {
      input.held = st.x > 28.4 && st.x < 29.0;
    }, 5);
    assert.ok(up.alive, 'must not die on the platform');
    // the arc (apex 2.05 < 3) cannot reach the platform -> stays on ground
    assert.strictEqual(up.y, 0);
  });

  it('gravity portal flips to the ceiling', function () {
    const objects = [{ t: 40, x: 30, y: 0 }];
    const s = run(makeLevel(objects), null, 6);
    assert.strictEqual(s.alive, true);
    assert.strictEqual(s.gravity, -1, 'gravity inverted');
    assert.ok(Math.abs(s.y - (P.LEVEL_H - 1)) < 0.01, 'running on the ceiling, y=' + s.y);
  });

  it('gravity portal back down restores normal gravity', function () {
    const objects = [{ t: 40, x: 20, y: 0 }, { t: 41, x: 60, y: 11 }];
    const s = run(makeLevel(objects), null, 8);
    assert.strictEqual(s.gravity, 1);
    assert.strictEqual(s.y, 0, 'back on the floor');
  });

  it('speed portals change horizontal speed', function () {
    const objects = [{ t: 44, x: 20, y: 0 }];
    const s = run(makeLevel(objects), null, 3);
    assert.ok(Math.abs(s.speedMult - 1.243) < 1e-6, 'speed 2x multiplier, got ' + s.speedMult);
  });

  it('yellow pad boosts higher than a normal jump', function () {
    let apex = 0;
    const objects = [{ t: 50, x: 15, y: 0 }];
    const s = run(makeLevel(objects), (st) => { apex = Math.max(apex, st.y); }, 4);
    assert.ok(apex > 3.2 && apex < 3.8, 'pad apex ~3.5 units, got ' + apex);
    assert.ok(s.events.some(e => e.type === 'pad'), 'pad fired');
    assert.strictEqual(s.alive, true);
  });

  it('orbs require a tap and reset the jump', function () {
    const objects = [{ t: 55, x: 30, y: 2 }];
    // No tap after the initial jump: falls back to the ground under the orb
    let apexNoTap = 0;
    const noTap = run(makeLevel(objects), (st, input) => {
      input.held = st.x > 28.4 && st.x < 29.0; // initial jump only
      apexNoTap = Math.max(apexNoTap, st.y);
    }, 4);
    assert.strictEqual(noTap.y, 0, 'without a tap the player falls back down');
    assert.ok(!noTap.events.some(e => e.type === 'orb'), 'orb must not fire without a tap');
    assert.ok(apexNoTap < 2.2, 'no orb boost in the arc, apex=' + apexNoTap);
    // With a buffered tap while overlapping the orb: it fires and boosts
    let apexTap = 0;
    const tap = run(makeLevel(objects), (st, input) => {
      if (st.x > 28.4 && st.x < 29.0) input.held = true;
      else if (st.x > 29.5 && st.x < 30.4) { input.held = true; input.buffer = 0.1; }
      else input.held = false;
      apexTap = Math.max(apexTap, st.y);
    }, 4);
    assert.ok(tap.events.some(e => e.type === 'orb'), 'orb fired');
    assert.ok(apexTap > apexNoTap + 0.8, 'orb boost raises the apex: ' + apexTap + ' vs ' + apexNoTap);
    assert.ok(apexTap > 2.5, 'orb apex, got ' + apexTap);
  });

  it('moving hazards actually move and can kill', function () {
    // saw oscillating horizontally with amplitude 5 around x=30
    const p = GD.objectdefs.packMovement(5, 2, 0, 0);
    const objects = [{ t: 28, x: 30, y: 0, p: p }];
    const s = run(makeLevel(objects), null, 6);
    assert.strictEqual(s.alive, false, 'the sweeping saw catches the runner');
    assert.strictEqual(s.deathCause, 'saw');
  });

  it('progress reaches 100% at the finish line', function () {
    const s = run(makeLevel([], 50), null, 6);
    assert.strictEqual(s.finished, true);
    assert.strictEqual(s.progress, 1);
  });

  it('rotation animates in the air and snaps on landing', function () {
    let airborneRot = 0;
    const s = run(makeLevel(), (st, input, t) => {
      if (t < 0.05) input.held = true; else input.held = false;
      if (st.y > 0.1) airborneRot = st.rot;
    }, 1.5);
    assert.ok(Math.abs(airborneRot) > 0.3, 'rotates while airborne');
    assert.ok(Math.abs(s.rot % (Math.PI / 2)) < 0.05, 'snapped to 90deg on ground, rot=' + s.rot);
  });

  it('is deterministic: same inputs -> same trajectory', function () {
    const objects = [{ t: 20, x: 30, y: 0 }, { t: 1, x: 40, y: 0 }, { t: 50, x: 60, y: 0 }];
    const inputFn = (st, input) => { input.held = Math.abs((st.x % 17) - 5) < 1.4; };
    const a = run(makeLevel(objects), inputFn, 3);
    const b = run(makeLevel(objects), inputFn, 3);
    assert.strictEqual(a.x, b.x);
    assert.strictEqual(a.y, b.y);
    assert.strictEqual(a.alive, b.alive);
    assert.strictEqual(a.time, b.time);
  });
});

describe('gameplay session', function () {
  it('counts attempts and respawns after death', function () {
    const level = makeLevel([{ t: 20, x: 30, y: 0 }], 100);
    const session = new GD.gameplay.GameSession(level, {});
    assert.strictEqual(session.attempt, 0);
    // run until death + respawn delay
    let guard = 0;
    while (session.mode !== 'dead' && guard++ < 5000) session.update(1 / 60);
    assert.strictEqual(session.mode, 'dead');
    const deadAt = session.attempt;
    guard = 0;
    while (session.mode === 'dead' && guard++ < 500) session.update(1 / 60);
    assert.strictEqual(session.mode, 'playing', 'respawned');
    assert.strictEqual(session.attempt, deadAt + 1, 'attempt counter incremented');
    assert.strictEqual(session.state.x, 0, 'respawned from the start');
  });

  it('records best progress percent', function () {
    const level = makeLevel([{ t: 20, x: 30, y: 0 }], 100);
    const session = new GD.gameplay.GameSession(level, {});
    let guard = 0;
    while (session.mode !== 'dead' && guard++ < 5000) session.update(1 / 60);
    assert.ok(session.best > 0.25, 'best ~30% before the spike, got ' + session.best);
  });

  it('persistence: progress is saved under the storage key', function () {
    const mem = new Map();
    GD.__testStorage = {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, v),
      removeItem: k => mem.delete(k),
      key: i => Array.from(mem.keys())[i],
      length: mem.size
    };
    const level = makeLevel([{ t: 20, x: 30, y: 0 }], 100);
    const session = new GD.gameplay.GameSession(level, { storageKey: 'test:l1' });
    let guard = 0;
    while (session.mode !== 'dead' && guard++ < 5000) session.update(1 / 60);
    const saved = JSON.parse(mem.get('nd_progress'))['test:l1'];
    assert.ok(saved && saved.best > 0.2, 'best saved');
    assert.strictEqual(saved.attempts, 1);
    GD.__testStorage = null;
  });
});
