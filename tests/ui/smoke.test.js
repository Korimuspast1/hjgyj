/**
 * UI TEST — boot & main menu.
 * Verifies the app boots, the main menu shows EXACTLY the three required
 * buttons (Play / Settings / Editor), all labelled in English, and that
 * each navigates to the right screen.
 */
'use strict';
const assert = require('assert');
const { bootGame, byTestid, q, qa, click } = require('./helpers');

describe('main menu', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
  });

  it('shows exactly three menu buttons: Play, Settings, Editor', function () {
    const buttons = qa(ctx.document, '.menu-btn');
    assert.strictEqual(buttons.length, 3, 'main menu must have exactly 3 buttons');
    const labels = buttons.map(b => b.textContent.trim()).sort();
    assert.deepStrictEqual(labels, ['Editor', 'Play', 'Settings']);
  });

  it('labels are in English by default', function () {
    assert.strictEqual(byTestid(ctx.document, 'x-missing'), null); // sanity
    const play = qa(ctx.document, '.menu-btn').find(b => b.textContent.trim() === 'Play');
    assert.ok(play, 'Play button exists');
    assert.strictEqual(ctx.GD.i18n.language, 'en');
  });

  it('Play opens the level select screen', function () {
    const play = qa(ctx.document, '.menu-btn').find(b => b.textContent.trim() === 'Play');
    click(play);
    assert.strictEqual(ctx.GD.ui.current(), 'select');
    assert.ok(q(ctx.document, '#select-screen'), 'select screen DOM present');
    assert.ok(byTestid(ctx.document, 'tab-official'), 'official tab exists');
  });

  it('Settings opens the settings screen with all controls', function () {
    const settings = qa(ctx.document, '.menu-btn').find(b => b.textContent.trim() === 'Settings');
    click(settings);
    assert.strictEqual(ctx.GD.ui.current(), 'settings');
    assert.ok(byTestid(ctx.document, 'music-volume'), 'music volume slider');
    assert.ok(byTestid(ctx.document, 'sfx-volume'), 'sfx volume slider');
    assert.ok(byTestid(ctx.document, 'vibration'), 'vibration toggle');
    assert.ok(byTestid(ctx.document, 'language'), 'language selector');
    assert.ok(byTestid(ctx.document, 'reset-progress'), 'reset progress button');
    assert.ok(byTestid(ctx.document, 'color-primary'), 'player color picker');
  });

  it('Editor opens the editor screen', function () {
    const editor = qa(ctx.document, '.menu-btn').find(b => b.textContent.trim() === 'Editor');
    click(editor);
    assert.strictEqual(ctx.GD.ui.current(), 'editor');
    assert.ok(byTestid(ctx.document, 'editor-canvas'), 'editor canvas present');
    assert.ok(byTestid(ctx.document, 'tool-place'), 'place tool present');
    assert.ok(byTestid(ctx.document, 'undo-btn'), 'undo present');
  });

  it('Back from settings returns to the menu', function () {
    const settings = qa(ctx.document, '.menu-btn').find(b => b.textContent.trim() === 'Settings');
    click(settings);
    click(byTestid(ctx.document, 'back'));
    assert.strictEqual(ctx.GD.ui.current(), 'menu');
  });
});
