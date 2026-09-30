/**
 * UI TESTS — level editor: palette, placement via canvas pointer events,
 * selection/props, delete, undo/redo, save/load, export/import, test-play.
 */
'use strict';
const assert = require('assert');
const { bootGame, q, qa, byTestid, click, clickAt, editorCellScreen, waitFor } = require('./helpers.js');

function menuBtn(ctx, action) {
  return q(ctx.document, '.menu-btn[data-action="' + action + '"]');
}

function openEditor(ctx) {
  click(menuBtn(ctx, 'editor'));
  return q(ctx.document, '#editor-screen');
}

/** Object count from the editor status line ("12 objects · ●"). */
function objectCount(ctx) {
  const m = q(ctx.document, '#editor-status').textContent.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : -1;
}

/** Click the editor canvas to place into grid cell (gx, gy). */
function placeAt(ctx, gx, gy) {
  const canvas = byTestid(ctx.document, 'editor-canvas');
  const p = editorCellScreen(gx, gy);
  clickAt(canvas, p.x, p.y);
}

function pickPalette(ctx, key) {
  // make sure the category containing this object type is open
  const def = ctx.GD.objectdefs.list.find(d => d.key === key);
  assert.ok(def, 'object def ' + key);
  const tab = qa(ctx.document, '.palette-tab').find(b => b.getAttribute('data-cat') === def.cat);
  if (tab && !tab.classList.contains('active')) click(tab);
  const item = byTestid(ctx.document, 'palette-' + key);
  assert.ok(item, 'palette item ' + key);
  click(item);
}

describe('editor', function () {
  let ctx;
  beforeEach(function () {
    ctx = bootGame();
    openEditor(ctx);
  });

  it('boots with toolbar, palette categories and an empty level', function () {
    assert.ok(q(ctx.document, '#editor-canvas'), 'canvas');
    for (const tool of ['place', 'select', 'delete']) {
      assert.ok(byTestid(ctx.document, 'tool-' + tool), tool + ' tool');
    }
    assert.ok(byTestid(ctx.document, 'tool-place').classList.contains('active'), 'place active by default');
    const cats = qa(ctx.document, '.palette-tab');
    assert.strictEqual(cats.length, ctx.GD.objectdefs.CATEGORIES.length, 'all categories tabbed');
    // blocks category active by default with items
    const items = qa(ctx.document, '.palette-item');
    assert.ok(items.length > 0, 'palette items rendered');
    assert.strictEqual(objectCount(ctx), 0);
  });

  it('place: palette selection + canvas click adds an object (and undo/redo)', function () {
    pickPalette(ctx, 'spike');
    assert.ok(byTestid(ctx.document, 'tool-place').classList.contains('active'), 'picking switches to place tool');
    placeAt(ctx, 15, 2);
    assert.strictEqual(objectCount(ctx), 1, 'one object placed');
    placeAt(ctx, 20, 0);
    placeAt(ctx, 25, 5);
    assert.strictEqual(objectCount(ctx), 3);

    click(byTestid(ctx.document, 'undo-btn'));
    assert.strictEqual(objectCount(ctx), 2, 'undo removes the last');
    click(byTestid(ctx.document, 'undo-btn'));
    click(byTestid(ctx.document, 'undo-btn'));
    assert.strictEqual(objectCount(ctx), 0, 'undo to empty');
    click(byTestid(ctx.document, 'redo-btn'));
    assert.strictEqual(objectCount(ctx), 1, 'redo re-adds');
  });

  it('place: drag paints multiple cells', function () {
    pickPalette(ctx, 'block_basic');
    const canvas = byTestid(ctx.document, 'editor-canvas');
    const a = editorCellScreen(10, 0), b = editorCellScreen(12, 0), c = editorCellScreen(14, 0);
    canvas.dispatchEvent(new ctx.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: a.x, clientY: a.y, button: 0 }));
    canvas.dispatchEvent(new ctx.window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: b.x, clientY: b.y, button: 0 }));
    canvas.dispatchEvent(new ctx.window.MouseEvent('pointermove', { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, button: 0 }));
    canvas.dispatchEvent(new ctx.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: c.x, clientY: c.y, button: 0 }));
    assert.strictEqual(objectCount(ctx), 3, 'drag painted 3 cells');
  });

  it('select: clicking an object selects it and shows properties', function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    click(byTestid(ctx.document, 'tool-select'));
    placeAt(ctx, 15, 2);           // same spot -> selects the object
    const props = q(ctx.document, '#editor-props');
    assert.strictEqual(props.style.display, '', 'props panel visible');
    assert.ok(byTestid(ctx.document, 'props-delete'), 'delete button');
    assert.ok(byTestid(ctx.document, 'props-copy'), 'copy button');
    // rotation buttons 0/90/180/270
    const rots = qa(props, '[data-testid^="rot-"]');
    assert.strictEqual(rots.length, 4, 'four rotation buttons');
    click(byTestid(ctx.document, 'rot-2'));
    click(byTestid(ctx.document, 'tool-select'));
    placeAt(ctx, 15, 2);
    // deleting via props removes it
    click(byTestid(ctx.document, 'props-delete'));
    assert.strictEqual(objectCount(ctx), 0);
  });

  it('delete tool removes objects', function () {
    pickPalette(ctx, 'block_basic');
    placeAt(ctx, 12, 0);
    click(byTestid(ctx.document, 'tool-delete'));
    placeAt(ctx, 12, 0);
    assert.strictEqual(objectCount(ctx), 0);
    click(byTestid(ctx.document, 'undo-btn'));
    assert.strictEqual(objectCount(ctx), 1, 'delete is undoable');
  });

  it('save persists the level; load dialog restores it', function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    click(byTestid(ctx.document, 'save-btn'));
    assert.ok(q(ctx.document, '.toast'), 'saved toast');
    const list = ctx.GD.storage.getCustomLevels();
    assert.strictEqual(list.length, 1);
    assert.ok(list[0].code.startsWith('NDL1:'));
    const savedId = list[0].id;

    // start a new level (confirm), then load the saved one back
    click(byTestid(ctx.document, 'new-btn'));
    const okBtn = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('common.ok'));
    click(okBtn);
    assert.strictEqual(objectCount(ctx), 0, 'new level is empty');

    click(byTestid(ctx.document, 'load-btn'));
    const pick = q(ctx.document, '[data-load-id="' + savedId + '"]');
    assert.ok(pick, 'saved level listed');
    click(pick);
    assert.strictEqual(objectCount(ctx), 1, 'level restored');
  });

  it('export produces a valid code; import round-trips it', function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    placeAt(ctx, 18, 3);
    click(byTestid(ctx.document, 'export-btn'));
    const ta = byTestid(ctx.document, 'export-code');
    assert.ok(ta, 'export dialog with code');
    const code = ta.value;
    assert.ok(code.startsWith('NDL1:'), 'valid code prefix');

    // close the dialog
    const close = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('common.close'));
    click(close);

    // new level, then import the code
    click(byTestid(ctx.document, 'new-btn'));
    click(qa(q(ctx.document, '.modal-overlay'), 'button').find(b => b.textContent === ctx.GD.i18n.t('common.ok')));
    click(byTestid(ctx.document, 'import-btn'));
    const imp = byTestid(ctx.document, 'import-code');
    imp.value = code;
    const doImport = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('editor.import'));
    click(doImport);
    assert.strictEqual(objectCount(ctx), 2, 'imported both objects');
  });

  it('import of corrupted code shows an error toast and keeps the level', function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    click(byTestid(ctx.document, 'import-btn'));
    const imp = byTestid(ctx.document, 'import-code');
    imp.value = 'NDL1:garbagegarbage:00000000';
    click(qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('editor.import')));
    const toast = q(ctx.document, '.toast.error');
    assert.ok(toast, 'error toast shown');
    assert.ok(toast.textContent.includes(ctx.GD.i18n.t('editor.importFailed')));
    assert.strictEqual(objectCount(ctx), 1, 'existing level untouched');
  });

  it('test-play opens the game screen and returns to the editor', async function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    click(byTestid(ctx.document, 'test-btn'));
    assert.ok(q(ctx.document, '#game-screen'), 'game screen for test play');
    assert.ok(q(ctx.document, '#game-hud'), 'HUD in test play');
    // pause -> quit returns to the editor (not the select screen)
    click(q(ctx.document, '#btn-pause'));
    const overlay = q(ctx.document, '.modal-overlay');
    assert.ok(overlay, 'pause dialog');
    const quit = qa(overlay, 'button').find(b => b.textContent === ctx.GD.i18n.t('game.quit'));
    click(quit);
    await waitFor(() => q(ctx.document, '#editor-screen'), 3000);
    assert.ok(q(ctx.document, '#editor-screen'), 'back in the editor');
    assert.strictEqual(objectCount(ctx), 1, 'level preserved through the round-trip');
  });

  it('back with unsaved changes asks for confirmation', function () {
    pickPalette(ctx, 'spike');
    placeAt(ctx, 15, 2);
    click(byTestid(ctx.document, 'editor-back'));
    const overlay = q(ctx.document, '.modal-overlay');
    assert.ok(overlay, 'unsaved-changes dialog');
    assert.ok(overlay.textContent.length > 0);
    click(qa(overlay, 'button').find(b => b.textContent === ctx.GD.i18n.t('common.ok')));
    assert.ok(q(ctx.document, '.menu-screen'), 'confirmed -> menu');
  });

  it('back without changes goes straight to the menu', function () {
    click(byTestid(ctx.document, 'editor-back'));
    assert.ok(q(ctx.document, '.menu-screen'));
    assert.strictEqual(q(ctx.document, '.modal-overlay'), null, 'no dialog needed');
  });

  it('palette category tabs switch the object list', function () {
    const spikeCat = ctx.GD.objectdefs.CATEGORIES.find(c => c.id === 'spikes').id;
    const before = qa(ctx.document, '.palette-item').map(i => i.getAttribute('data-type'));
    const spikesTab = qa(ctx.document, '.palette-tab').find(b => b.getAttribute('data-cat') === spikeCat);
    click(spikesTab);
    const after = qa(ctx.document, '.palette-item').map(i => i.getAttribute('data-type'));
    assert.notStrictEqual(before.join(','), after.join(','), 'different items after switching');
    const spikeDefs = ctx.GD.objectdefs.byCategory('spikes').map(d => String(d.id));
    assert.strictEqual(after.sort().join(','), spikeDefs.sort().join(','), 'spike category shows exactly the spikes');
  });

  it('level settings dialog edits name/difficulty and validates', function () {
    click(byTestid(ctx.document, 'settings-btn'));
    const nameInput = byTestid(ctx.document, 'level-name');
    assert.ok(nameInput, 'name input in the settings dialog');
    nameInput.value = 'Edited Name';
    const diff = byTestid(ctx.document, 'level-difficulty');
    diff.value = '3';
    const ok = qa(q(ctx.document, '.modal-overlay'), 'button')
      .find(b => b.textContent === ctx.GD.i18n.t('common.ok'));
    click(ok);
    click(byTestid(ctx.document, 'settings-btn'));
    assert.strictEqual(byTestid(ctx.document, 'level-name').value, 'Edited Name');
    assert.strictEqual(byTestid(ctx.document, 'level-difficulty').value, '3');
  });
});
