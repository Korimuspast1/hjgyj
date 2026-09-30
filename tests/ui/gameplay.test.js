/**
 * UI TESTS — game screen: HUD, pause/resume/quit, death & respawn,
 * level completion through the REAL render loop (jsdom rAF).
 */
'use strict';
const assert = require('assert');
const { bootGame, q, qa, byTestid, click, pressAt, releaseAt, waitFor } = require('./helpers.js');

function menuBtn(ctx, action) {
  return q(ctx.document, '.menu-btn[data-action="' + action + '"]');
}

/** Build and start playing a level through the same API levelselect uses. */
function playLevel(ctx, level, params) {
  ctx.GD.ui.show('game', Object.assign({ level: level }, params || {}));
}

function tinyLevel(GD, opts) {
  opts = opts || {};
  const lv = GD.level.create(opts.name || 'Tiny', 'Tester');
  lv.length = opts.length || 35;
  lv.difficulty = opts.difficulty !== undefined ? opts.difficulty : 0;
  if (opts.objects) lv.objects = opts.objects;
  return lv;
}

describe('game screen', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
  });

  it('boots with a visible HUD and live progress', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, { length: 60 }));
    assert.ok(q(ctx.document, '#game-screen'));
    assert.ok(q(ctx.document, '#game-hud'));
    assert.strictEqual(q(ctx.document, '#hud-attempt').textContent, 'Attempt 1');
    // rAF loop runs -> progress text advances beyond 0%
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent !== '0%', 6000);
    const pct = parseInt(q(ctx.document, '#hud-progress-text').textContent, 10);
    assert.ok(pct > 0 && pct < 100, 'progress in flight: ' + pct + '%');
  });

  it('pause shows a dialog; resume closes it and continues', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, { length: 400 }));
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent !== '0%', 6000);
    click(q(ctx.document, '#btn-pause'));
    let overlay = q(ctx.document, '.modal-overlay');
    assert.ok(overlay, 'pause dialog');
    assert.ok(overlay.textContent.includes(ctx.GD.i18n.t('game.paused')));
    const pctWhenPaused = q(ctx.document, '#hud-progress-text').textContent;
    const resume = qa(overlay, 'button').find(b => b.textContent === ctx.GD.i18n.t('game.resume'));
    click(resume);
    assert.strictEqual(q(ctx.document, '.modal-overlay'), null, 'dialog closed');
    // the run continues past the paused value
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent !== pctWhenPaused, 8000);
  });

  it('restart from the pause menu resets progress', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, { length: 400 }));
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent !== '0%', 6000);
    click(q(ctx.document, '#btn-pause'));
    const restart = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('game.restart'));
    click(restart);
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent === '0%', 3000);
    assert.strictEqual(q(ctx.document, '#hud-attempt').textContent, 'Attempt 2', 'restart counts as a new attempt');
  });

  it('quit returns to the level select', async function () {
    playLevel(ctx, tinyLevel(ctx.GD));
    click(q(ctx.document, '#btn-pause'));
    const quit = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('game.quit'));
    click(quit);
    assert.ok(q(ctx.document, '#select-screen'), 'back at level select');
  });

  it('death by spike respawns and bumps the attempt counter', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, {
      name: 'Spiky', length: 120,
      objects: [{ t: 20, x: 12, y: 0 }]
    }));
    await waitFor(() => q(ctx.document, '#hud-attempt').textContent === 'Attempt 2', 10000);
    assert.strictEqual(q(ctx.document, '#hud-attempt').textContent, 'Attempt 2', 'respawned as attempt 2');
    assert.strictEqual(q(ctx.document, '#hud-progress-text').textContent, '0%', 'back at the start');
  });

  it('an empty level completes and shows the win dialog', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, { name: 'Free Win', length: 25 }));
    await waitFor(() => q(ctx.document, '.modal-overlay'), 15000);
    const overlay = q(ctx.document, '.modal-overlay');
    assert.ok(overlay.textContent.includes(ctx.GD.i18n.t('game.complete')), 'win dialog');
    assert.ok(overlay.textContent.includes('Free Win'));
    assert.ok(overlay.textContent.includes('100%'));
    // close -> back to select
    const close = qa(overlay, 'button').find(b => b.textContent === ctx.GD.i18n.t('common.close'));
    click(close);
    assert.ok(q(ctx.document, '#select-screen'));
  });

  it('progress is persisted for levels with a storage key', async function () {
    const lv = tinyLevel(ctx.GD, { name: 'Saved', length: 25 });
    playLevel(ctx, lv, { storageKey: 'custom:xyz', levelKey: 'custom:xyz' });
    await waitFor(() => q(ctx.document, '.modal-overlay'), 15000);
    await waitFor(() => {
      const p = ctx.GD.storage.getProgress()['custom:xyz'];
      return p && p.completed === true;
    }, 3000);
    const p = ctx.GD.storage.getProgress()['custom:xyz'];
    assert.strictEqual(p.best, 1);
    assert.ok(p.attempts >= 1);
  });

  it('hold-to-jump: holding clears a spike corridor a runner would die on', async function () {
    // Spikes placed at the midpoints of consecutive jump arcs (jump period is
    // 5.2 units at 1x speed): holding from the start keeps the cube airborne
    // over every spike and finishes the level.
    const spikes = [];
    for (let x = 2.6; x < 34; x += 5.2) spikes.push({ t: 20, x: Math.round(x), y: 0 });
    playLevel(ctx, tinyLevel(ctx.GD, {
      name: 'Hopper', length: 40, objects: spikes
    }));
    const canvas = ctx.document.getElementById('game-canvas');
    pressAt(canvas, 150, 200);   // hold
    try {
      await waitFor(() => q(ctx.document, '.modal-overlay'), 15000);
    } finally {
      releaseAt(canvas, 150, 200);
    }
    assert.ok(q(ctx.document, '.modal-overlay').textContent.includes(ctx.GD.i18n.t('game.complete')),
      'hold-to-jump cleared the corridor');
    assert.strictEqual(q(ctx.document, '#hud-attempt').textContent, 'Attempt 1', 'no deaths needed');
  });

  it('the same corridor kills a cube that never jumps', async function () {
    const spikes = [];
    for (let x = 2.6; x < 34; x += 5.2) spikes.push({ t: 20, x: Math.round(x), y: 0 });
    playLevel(ctx, tinyLevel(ctx.GD, { name: 'Hopper', length: 40, objects: spikes }));
    await waitFor(() => q(ctx.document, '#hud-attempt').textContent === 'Attempt 2', 10000);
  });

  it('Android back button pauses an active game', async function () {
    playLevel(ctx, tinyLevel(ctx.GD, { length: 400 }));
    await waitFor(() => q(ctx.document, '#hud-progress-text').textContent !== '0%', 6000);
    ctx.window.onAndroidBack();
    assert.ok(q(ctx.document, '.modal-overlay'), 'pause dialog via hardware back');
    assert.ok(ctx.document.body.textContent.includes(ctx.GD.i18n.t('game.paused')));
  });
});
