/**
 * UI TESTS — settings screen: controls, persistence, language switch.
 */
'use strict';
const assert = require('assert');
const { bootGame, q, qa, byTestid, click } = require('./helpers.js');

describe('settings screen', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
  });
  afterEach(function () {
    try { ctx.GD.__testStorage = null; } catch (e) { /* ignore */ }
  });

  it('shows all controls with defaults from storage', function () {
    click(q(ctx.document, '.menu-btn[data-action="settings"]'));
    const screen = q(ctx.document, '#settings-screen');
    assert.ok(screen, 'settings screen mounted');
    assert.strictEqual(byTestid(ctx.document, 'music-volume').value, '70');
    assert.strictEqual(byTestid(ctx.document, 'sfx-volume').value, '90');
    assert.strictEqual(byTestid(ctx.document, 'vibration').checked, true);
    assert.strictEqual(byTestid(ctx.document, 'language').value, 'en');
    assert.strictEqual(byTestid(ctx.document, 'nickname').value, 'Player');
    assert.ok(q(ctx.document, '[data-testid="icon-preview"]'), 'player icon preview');
    assert.ok(qa(ctx.document, '.color-swatch').length >= 8, 'colour swatches');
  });

  it('changing sliders persists after Back', function () {
    click(q(ctx.document, '.menu-btn[data-action="settings"]'));
    const music = byTestid(ctx.document, 'music-volume');
    music.value = '20';
    music.dispatchEvent(new ctx.window.Event('input', { bubbles: true }));
    const sfx = byTestid(ctx.document, 'sfx-volume');
    sfx.value = '100';
    sfx.dispatchEvent(new ctx.window.Event('input', { bubbles: true }));
    const vib = byTestid(ctx.document, 'vibration');
    vib.checked = false;
    vib.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));
    const nick = byTestid(ctx.document, 'nickname');
    nick.value = 'NeonFox';
    nick.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));

    click(byTestid(ctx.document, 'back'));

    const saved = JSON.parse(ctx.window.localStorage.getItem('nd_settings'));
    assert.strictEqual(saved.musicVol, 0.2);
    assert.strictEqual(saved.sfxVol, 1);
    assert.strictEqual(saved.vibration, false);
    assert.strictEqual(saved.nickname, 'NeonFox');
    // the menu is back
    assert.ok(q(ctx.document, '#menu-screen') || q(ctx.document, '.menu-screen'));
  });

  it('language switch re-renders the screen in Spanish', function () {
    click(q(ctx.document, '.menu-btn[data-action="settings"]'));
    const sel = byTestid(ctx.document, 'language');
    sel.value = 'es';
    sel.dispatchEvent(new ctx.window.Event('change', { bubbles: true }));
    const title = q(ctx.document, '.screen-title');
    assert.strictEqual(title.textContent, 'Ajustes');
    assert.strictEqual(ctx.GD.i18n.language, 'es');
    // persisted on back
    click(byTestid(ctx.document, 'back'));
    const saved = JSON.parse(ctx.window.localStorage.getItem('nd_settings'));
    assert.strictEqual(saved.lang, 'es');
  });

  it('reset progress asks for confirmation and wipes progress', function () {
    ctx.GD.storage.setLevelProgress('official:l1', { best: 0.5, attempts: 9, completed: false });
    click(q(ctx.document, '.menu-btn[data-action="settings"]'));
    click(byTestid(ctx.document, 'reset-progress'));
    let overlay = q(ctx.document, '.modal-overlay');
    assert.ok(overlay, 'confirmation dialog shown');
    assert.ok(overlay.textContent.includes(ctx.GD.i18n.t('settings.resetConfirm')));
    // "OK" is the danger confirm button
    const okBtn = qa(overlay, 'button').find(b => b.textContent === ctx.GD.i18n.t('common.ok'));
    assert.ok(okBtn, 'OK button present');
    click(okBtn);
    assert.strictEqual(ctx.GD.storage.getProgress()['official:l1'], undefined, 'progress wiped');
    assert.ok(q(ctx.document, '.toast'), 'toast confirmation');
  });
});
