/**
 * Neon Dash — the level editor.
 *
 * Tools: place / select / delete / copy, undo & redo (command stack),
 * zoom & pan (buttons, wheel, pinch, two-finger pan), grid with ghost
 * preview, per-object properties (rotation + movement), level settings
 * (name / theme / song / difficulty / length), save & load slots,
 * playtest, and export / import of NDL1 level codes.
 */
/* global GD */
GD.register('editor', function (GD) {
  'use strict';

  var ui = GD.ui;
  var t = function (k) { return GD.i18n.t(k); };
  var el = ui.el;

  var TOOLS = ['place', 'select', 'delete'];

  ui.registerScreen('editor', function (root, params) {
    params = params || {};

    var settings = GD.storage.getSettings();
    var level = null;
    var editingId = params.loadId || null;   // storage id when editing a saved level
    var dirty = false;

    // ---- working state ------------------------------------------------------
    var tool = 'place';
    var currentTypeId = 20;                  // spike by default
    var placeRot = 0;
    var placeMove = { amp: 0, period: 2, phase: 0, axis: 0 };
    var selected = null;
    var undoStack = [];
    var redoStack = [];
    var cam = new GD.levelrenderer.Camera();
    cam.x = 10;
    cam.y = 3;
    cam.zoom = 0.8;
    var editorTime = 0;                      // frozen-ish clock for animations
    var testSession = null;                  // when playtesting

    // ---- load level ---------------------------------------------------------
    if (params.levelCode) {
      try { level = GD.encoding.decode(params.levelCode); }
      catch (e) { level = GD.level.create('Untitled', settings.nickname); }
    } else if (editingId) {
      var saved = GD.storage.getCustomLevels().filter(function (l) { return l.id === editingId; })[0];
      if (saved) {
        try { level = GD.encoding.decode(saved.code); } catch (e) { /* fallthrough */ }
      }
    }
    if (!level) {
      level = GD.level.create('Untitled', settings.nickname || 'Player');
    }

    // ------------------------------------------------------------------ DOM
    var canvas = el('canvas.editor-canvas#editor-canvas', { 'data-testid': 'editor-canvas' });
    var ctx = canvas.getContext ? canvas.getContext('2d') : null;

    // toolbar
    var toolBtns = {};
    var toolbar = el('div.editor-toolbar#editor-toolbar');
    TOOLS.forEach(function (tl) {
      var b = el('button.btn.btn-small.tool-btn', {
        type: 'button', 'data-tool': tl, 'data-testid': 'tool-' + tl,
        title: t('editor.' + (tl === 'place' ? 'place' : tl === 'select' ? 'select' : 'delete')),
        text: tl === 'place' ? '✚' : (tl === 'select' ? '⬉' : '✖')
      });
      b.addEventListener('click', function () { setTool(tl); });
      toolBtns[tl] = b;
      toolbar.appendChild(b);
    });
    toolbar.appendChild(el('span.toolbar-sep'));
    var copyBtn = el('button.btn.btn-small', { type: 'button', 'data-testid': 'copy-btn', title: t('editor.copy'), text: '⧉' });
    copyBtn.addEventListener('click', copySelection);
    var undoBtn = el('button.btn.btn-small', { type: 'button', 'data-testid': 'undo-btn', title: t('editor.undo'), text: '↶' });
    undoBtn.addEventListener('click', function () { undo(); });
    var redoBtn = el('button.btn.btn-small', { type: 'button', 'data-testid': 'redo-btn', title: t('editor.redo'), text: '↷' });
    redoBtn.addEventListener('click', function () { redo(); });
    var zoomIn = el('button.btn.btn-small', { type: 'button', 'data-testid': 'zoom-in', title: t('editor.zoomIn'), text: '＋' });
    zoomIn.addEventListener('click', function () { zoomBy(1.25); });
    var zoomOut = el('button.btn.btn-small', { type: 'button', 'data-testid': 'zoom-out', title: t('editor.zoomOut'), text: '－' });
    zoomOut.addEventListener('click', function () { zoomBy(0.8); });
    toolbar.appendChild(copyBtn);
    toolbar.appendChild(undoBtn);
    toolbar.appendChild(redoBtn);
    toolbar.appendChild(zoomIn);
    toolbar.appendChild(zoomOut);

    // top menu
    var menuBar = el('div.editor-menubar#editor-menubar',
      el('button.btn.btn-small.btn-back', {
        type: 'button', 'data-testid': 'editor-back', text: '◀ ' + t('common.back'),
        onclick: function () { exitEditor(); }
      }),
      el('button.btn.btn-small.btn-primary', {
        type: 'button', 'data-testid': 'save-btn', text: '💾 ' + t('editor.save'),
        onclick: function () { saveLevel(); }
      }),
      el('button.btn.btn-small', {
        type: 'button', 'data-testid': 'load-btn', text: '📂 ' + t('editor.load'),
        onclick: function () { loadDialog(); }
      }),
      el('button.btn.btn-small', {
        type: 'button', 'data-testid': 'new-btn', text: '✧ ' + t('editor.new'),
        onclick: function () { newDialog(); }
      }),
      el('button.btn.btn-small.btn-play', {
        type: 'button', 'data-testid': 'test-btn', text: '▶ ' + t('editor.test'),
        onclick: function () { testLevel(); }
      }),
      el('button.btn.btn-small', {
        type: 'button', 'data-testid': 'export-btn', text: '⇧ ' + t('editor.export'),
        onclick: function () { exportDialog(); }
      }),
      el('button.btn.btn-small', {
        type: 'button', 'data-testid': 'import-btn', text: '⇩ ' + t('editor.import'),
        onclick: function () { importDialog(); }
      }),
      el('button.btn.btn-small', {
        type: 'button', 'data-testid': 'settings-btn', text: '⚙ ' + t('editor.settings'),
        onclick: function () { settingsDialog(); }
      }));

    // palette (categories + object thumbnails)
    var paletteTabs = el('div.palette-tabs#palette-tabs');
    var paletteList = el('div.palette-list#palette-list');
    var activeCat = 'blocks';

    // properties panel (selected object)
    var propsPanel = el('div.editor-props#editor-props');
    propsPanel.style.display = 'none';

    var statusText = el('span.editor-status#editor-status', { text: '' });

    var wrap = el('div.screen.editor-screen#editor-screen',
      menuBar,
      el('div.editor-body',
        toolbar,
        canvas,
        el('div.editor-palette#editor-palette', paletteTabs, paletteList)),
      propsPanel,
      el('div.editor-footer', statusText));
    root.appendChild(wrap);

    // ------------------------------------------------------------ palette
    function renderPaletteTabs() {
      paletteTabs.innerHTML = '';
      GD.objectdefs.CATEGORIES.forEach(function (cat) {
        var b = el('button.palette-tab' + (cat.id === activeCat ? ' active' : ''), {
          type: 'button', 'data-cat': cat.id, text: cat.name, style: { color: cat.color }
        });
        b.addEventListener('click', function () {
          activeCat = cat.id;
          renderPaletteTabs();
          renderPalette();
          GD.audio.play('click');
        });
        paletteTabs.appendChild(b);
      });
    }

    function renderPalette() {
      paletteList.innerHTML = '';
      GD.objectdefs.byCategory(activeCat).forEach(function (d) {
        var thumb = el('canvas.palette-thumb');
        thumb.width = 56; thumb.height = 56;
        var tc = thumb.getContext ? thumb.getContext('2d') : null;
        if (tc) {
          var sprite = GD.sprites.get(d.id, 0, level.themeId);
          var scale = Math.min(48 / sprite.width, 48 / sprite.height);
          var w = sprite.width * scale, h = sprite.height * scale;
          tc.drawImage(sprite, (56 - w) / 2, (56 - h) / 2, w, h);
        }
        var item = el('button.palette-item' + (d.id === currentTypeId ? ' active' : ''), {
          type: 'button', 'data-type': d.id, 'data-testid': 'palette-' + d.key,
          title: d.name
        }, thumb, el('span.palette-name', { text: d.name }));
        item.addEventListener('click', function () {
          currentTypeId = d.id;
          setTool('place');
          renderPalette();
        });
        paletteList.appendChild(item);
      });
    }

    // ------------------------------------------------------------- commands
    function pushCommand(cmd) {
      undoStack.push(cmd);
      if (undoStack.length > 200) undoStack.shift();
      redoStack.length = 0;
      dirty = true;
      updateButtons();
    }

    function undo() {
      var cmd = undoStack.pop();
      if (!cmd) return;
      cmd.undo();
      redoStack.push(cmd);
      dirty = true;
      updateButtons();
      GD.audio.play('back');
      renderProps();
    }

    function redo() {
      var cmd = redoStack.pop();
      if (!cmd) return;
      cmd.do();
      undoStack.push(cmd);
      dirty = true;
      updateButtons();
      GD.audio.play('click');
      renderProps();
    }

    function updateButtons() {
      undoBtn.disabled = undoStack.length === 0;
      redoBtn.disabled = redoStack.length === 0;
      copyBtn.disabled = !selected;
      statusText.textContent = level.objects.length + ' ' + t('select.objects').toLowerCase() +
        '  ·  ' + (dirty ? '●' : '✓');
    }

    // -------------------------------------------------------------- objects
    function objectAt(gx, gy) {
      // topmost first
      for (var i = level.objects.length - 1; i >= 0; i--) {
        var o = level.objects[i];
        var d = GD.objectdefs.getDef(o.t);
        if (!d) continue;
        var box = GD.physics.objectBox(o, editorTime);
        if (gx >= box.x && gx <= box.x + box.w && gy >= box.y && gy <= box.y + box.h) return o;
      }
      return null;
    }

    function placeAt(gx, gy) {
      var d = GD.objectdefs.getDef(currentTypeId);
      if (!d) return;
      if (gx < 0 || gx > GD.objectdefs.MAX_X) return;
      // y is the bottom row the object occupies
      var y = Math.max(0, Math.min(GD.objectdefs.MAX_Y + 1 - Math.ceil(d.h), Math.round(gy - d.h / 2)));
      var obj = {
        t: currentTypeId,
        x: Math.round(gx - d.w / 2),
        y: y,
        r: placeRot
      };
      if (d.moving) {
        obj.p = GD.objectdefs.packMovement(placeMove.amp, placeMove.period, placeMove.phase, placeMove.axis);
      }
      if (obj.x < 0) obj.x = 0;
      if (obj.y < 0) obj.y = 0;
      level.objects.push(obj);
      pushCommand({
        do: function () { level.objects.push(obj); },
        undo: function () {
          var i = level.objects.indexOf(obj);
          if (i >= 0) level.objects.splice(i, 1);
        }
      });
      GD.audio.play('place');
    }

    function deleteObject(obj) {
      var i = level.objects.indexOf(obj);
      if (i < 0) return;
      level.objects.splice(i, 1);
      if (selected === obj) { selected = null; renderProps(); }
      pushCommand({
        do: function () {
          var j = level.objects.indexOf(obj);
          if (j < 0) level.objects.push(obj);
        },
        undo: function () {
          var j = level.objects.indexOf(obj);
          if (j >= 0) level.objects.splice(j, 1);
          else level.objects.push(obj);
        }
      });
      GD.audio.play('delete');
    }

    function copySelection() {
      if (!selected) return;
      var d = GD.objectdefs.getDef(selected.t);
      var clone = {
        t: selected.t,
        x: Math.min(GD.objectdefs.MAX_X, selected.x + (d ? d.w : 1)),
        y: selected.y, r: selected.r || 0, p: selected.p || 0
      };
      level.objects.push(clone);
      selected = clone;
      pushCommand({
        do: function () { level.objects.push(clone); },
        undo: function () {
          var i = level.objects.indexOf(clone);
          if (i >= 0) level.objects.splice(i, 1);
        }
      });
      setTool('select');
      GD.audio.play('place');
    }

    // ------------------------------------------------------- properties panel
    function renderProps() {
      propsPanel.innerHTML = '';
      if (!selected) { propsPanel.style.display = 'none'; return; }
      var d = GD.objectdefs.getDef(selected.t);
      if (!d) { selected = null; return; }
      propsPanel.style.display = '';

      propsPanel.appendChild(el('div.props-title', { text: d.name }));

      // rotation
      var rotWrap = el('div.props-row');
      rotWrap.appendChild(el('label', { text: t('editor.rotation') + ': ' }));
      for (var r = 0; r < 4; r++) {
        (function (rr) {
          var b = el('button.btn.btn-small' + ((selected.r || 0) === rr ? ' btn-primary' : ''), {
            type: 'button', 'data-testid': 'rot-' + rr, text: (rr * 90) + '°'
          });
          b.addEventListener('click', function () {
            var old = selected.r || 0;
            var obj = selected;
            pushCommand({
              do: function () { obj.r = rr; },
              undo: function () { obj.r = old; }
            });
            obj.r = rr;
            renderProps();
          });
          rotWrap.appendChild(b);
        })(r);
      }
      propsPanel.appendChild(rotWrap);

      // movement (moving types only)
      if (d.moving) {
        var m = GD.objectdefs.unpackMovement(selected.p || 0);
        var ampLabel = el('label'), periodLabel = el('label'), phaseLabel = el('label');
        function applyMove(next) {
          var obj = selected;
          var oldP = obj.p || 0;
          var p = GD.objectdefs.packMovement(next.amp, next.period, next.phase, next.axis);
          pushCommand({
            do: function () { obj.p = p; },
            undo: function () { obj.p = oldP; }
          });
          obj.p = p;
          renderProps();
        }
        var ampSlider = el('input.slider', { type: 'range', min: '0', max: '15', value: String(m.amp), 'data-testid': 'move-amp' });
        ampSlider.addEventListener('change', function () {
          applyMove({ amp: parseInt(ampSlider.value, 10), period: m.period, phase: m.phase, axis: m.axis });
        });
        ampLabel.textContent = t('editor.moving.amp') + ': ' + m.amp;
        ampSlider.addEventListener('input', function () { ampLabel.textContent = t('editor.moving.amp') + ': ' + ampSlider.value; });
        propsPanel.appendChild(el('div.props-row', ampLabel, ampSlider));

        var periodSlider = el('input.slider', { type: 'range', min: '1', max: '63', value: String(Math.round(m.period * 8)), 'data-testid': 'move-period' });
        periodLabel.textContent = t('editor.moving.period') + ': ' + m.period.toFixed(2);
        periodSlider.addEventListener('input', function () {
          periodLabel.textContent = t('editor.moving.period') + ': ' + (parseInt(periodSlider.value, 10) / 8).toFixed(2);
        });
        periodSlider.addEventListener('change', function () {
          applyMove({ amp: m.amp, period: parseInt(periodSlider.value, 10) / 8, phase: m.phase, axis: m.axis });
        });
        propsPanel.appendChild(el('div.props-row', periodLabel, periodSlider));

        var axisBtn = el('button.btn.btn-small', { type: 'button', 'data-testid': 'move-axis', text: t('editor.moving.axis') + ': ' + (m.axis ? t('editor.moving.vertical') : t('editor.moving.horizontal')) });
        axisBtn.addEventListener('click', function () {
          applyMove({ amp: m.amp, period: m.period, phase: m.phase, axis: m.axis ? 0 : 1 });
        });
        propsPanel.appendChild(el('div.props-row', axisBtn));
        void phaseLabel;
      }

      propsPanel.appendChild(el('div.props-row',
        el('button.btn.btn-small.btn-danger', {
          type: 'button', 'data-testid': 'props-delete', text: t('common.delete'),
          onclick: function () { deleteObject(selected); }
        }),
        el('button.btn.btn-small.btn-secondary', {
          type: 'button', 'data-testid': 'props-copy', text: t('editor.copy'),
          onclick: copySelection
        })));
    }

    // ------------------------------------------------------------- dialogs
    function settingsDialog() {
      var nameInput = el('input.text-input', { type: 'text', value: level.name, maxlength: '24', 'data-testid': 'level-name' });
      var themeSel = el('select.select', { 'data-testid': 'level-theme' });
      GD.level.THEMES.forEach(function (th) {
        var o = el('option', { value: th.id, text: th.name });
        if (th.id === level.themeId) o.selected = true;
        themeSel.appendChild(o);
      });
      var songSel = el('select.select', { 'data-testid': 'level-song' });
      GD.level.SONGS.forEach(function (sg) {
        var o = el('option', { value: sg.id, text: sg.name + ' (' + sg.bpm + ' BPM)' });
        if (sg.id === level.songId) o.selected = true;
        songSel.appendChild(o);
      });
      var diffSel = el('select.select', { 'data-testid': 'level-difficulty' });
      GD.level.DIFFICULTIES.forEach(function (df) {
        var o = el('option', { value: df.id, text: df.name + ' (' + df.stars + '★)' });
        if (df.id === level.difficulty) o.selected = true;
        diffSel.appendChild(o);
      });
      var lengthInput = el('input.text-input', {
        type: 'number', min: String(GD.level.MIN_LENGTH), max: String(GD.level.MAX_LENGTH),
        value: String(level.length), 'data-testid': 'level-length'
      });

      themeSel.addEventListener('change', function () {
        level.themeId = parseInt(themeSel.value, 10);
        GD.sprites.clearCache();
        renderPalette();
      });

      ui.dialog(t('editor.settings'),
        el('div.settings-form',
          el('div.props-row', el('label', { text: t('editor.levelName') }), nameInput),
          el('div.props-row', el('label', { text: t('editor.theme') }), themeSel),
          el('div.props-row', el('label', { text: t('editor.song') }), songSel),
          el('div.props-row', el('label', { text: t('editor.difficulty') }), diffSel),
          el('div.props-row', el('label', { text: t('editor.length') }), lengthInput)),
        [
          {
            label: t('common.ok'), cls: 'btn-primary', onClick: function () {
              level.name = GD.util.sanitizeName(nameInput.value, GD.level.MAX_NAME) || 'Untitled';
              level.themeId = parseInt(themeSel.value, 10) || 0;
              level.songId = parseInt(songSel.value, 10) || 0;
              level.difficulty = parseInt(diffSel.value, 10) || 0;
              level.length = GD.util.clamp(parseInt(lengthInput.value, 10) || 120,
                GD.level.MIN_LENGTH, GD.level.MAX_LENGTH);
              try {
                GD.level.validate(level);
                dirty = true;
              } catch (e) {
                ui.toast(e.message, 'error');
              }
              GD.sprites.clearCache();
              renderPalette();
            }
          }
        ]);
    }

    function saveLevel() {
      try {
        GD.level.validate(level);
      } catch (e) {
        ui.toast(e.message, 'error');
        return;
      }
      var code = GD.encoding.encode(level);
      var entry = GD.storage.saveCustomLevel({
        id: editingId || undefined,
        name: level.name,
        code: code
      });
      editingId = entry.id;
      dirty = false;
      updateButtons();
      ui.toast(t('editor.saved'));
      GD.audio.play('click');
    }

    function loadDialog() {
      var levels = GD.storage.getCustomLevels();
      var box = el('div.upload-list');
      if (!levels.length) box.appendChild(el('p.empty-note', { text: t('editor.noLevels') }));
      levels.forEach(function (entry) {
        box.appendChild(el('button.btn.btn-secondary.upload-pick', {
          type: 'button', 'data-load-id': entry.id, text: '📂 ' + entry.name,
          onclick: function () {
            try {
              level = GD.encoding.decode(entry.code);
              editingId = entry.id;
              undoStack.length = 0;
              redoStack.length = 0;
              selected = null;
              dirty = false;
              renderProps();
              renderPalette();
              updateButtons();
              ui.toast(t('editor.saved'));
              document.querySelector('.modal-overlay').remove();
            } catch (e) {
              ui.toast(t('editor.importFailed') + ': ' + e.message, 'error');
            }
          }
        }));
      });
      ui.dialog(t('editor.load') + ' — ' + t('editor.myLevels'), box, [
        { label: t('common.cancel'), cls: 'btn-secondary', onClick: null }
      ]);
    }

    function newDialog() {
      ui.confirm(t('editor.new'), t('editor.deleteLevel'), function () {
        level = GD.level.create('Untitled', GD.storage.getSettings().nickname || 'Player');
        editingId = null;
        undoStack.length = 0;
        redoStack.length = 0;
        selected = null;
        dirty = false;
        renderProps();
        updateButtons();
      });
    }

    function exportDialog() {
      if (!level.objects.length) {
        ui.toast(t('editor.empty'));
        return;
      }
      var code;
      try {
        GD.level.validate(level);
        code = GD.encoding.encode(level);
      } catch (e) {
        ui.toast(e.message, 'error');
        return;
      }
      var ta = el('textarea.code-area', { 'data-testid': 'export-code', readonly: 'readonly' });
      ta.value = code;
      var copyBtn2 = el('button.btn.btn-small.btn-primary', { type: 'button', text: t('common.copy') });
      copyBtn2.addEventListener('click', function () {
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* older webviews */ }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function () {}, function () {});
        }
        // Android share sheet
        if (window.AndroidBridge && window.AndroidBridge.shareText) {
          window.AndroidBridge.shareText(code, level.name);
        }
        ui.toast(t('common.copied'));
      });
      ui.dialog(t('editor.exportPrompt'), el('div', ta, copyBtn2), [
        { label: t('common.close'), cls: 'btn-secondary', onClick: null }
      ]);
    }

    function importDialog() {
      var ta = el('textarea.code-area', { 'data-testid': 'import-code', placeholder: 'NDL1:...' });
      ui.dialog(t('editor.import'), el('div',
        el('p.modal-text', { text: t('editor.importPrompt') }), ta), [
        {
          label: t('editor.import'), cls: 'btn-primary', keep: false, onClick: function () {
            try {
              level = GD.encoding.decode(ta.value);
              editingId = null;
              undoStack.length = 0;
              redoStack.length = 0;
              selected = null;
              dirty = true;
              renderPalette();
              updateButtons();
              ui.toast('✔ ' + level.name);
            } catch (e) {
              ui.toast(t('editor.importFailed') + ': ' + e.message, 'error');
            }
          }
        },
        { label: t('common.cancel'), cls: 'btn-secondary', onClick: null }
      ]);
    }

    function exitEditor() {
      if (dirty && level.objects.length) {
        ui.confirm(t('common.close'), t('editor.unsaved'), function () {
          ui.show('menu');
        });
      } else {
        ui.show('menu');
      }
    }

    function testLevel() {
      var testLevel;
      try {
        GD.level.validate(level);
        testLevel = GD.encoding.decode(GD.encoding.encode(level)); // deep copy via code
      } catch (e) {
        ui.toast(e.message, 'error');
        return;
      }
      GD.audio.unlock();
      ui.show('game', {
        level: testLevel,
        fromEditor: true,
        onExit: function () { ui.show('editor', { loadId: editingId, levelCode: GD.encoding.encode(level) }); }
      });
    }

    // ------------------------------------------------------------- input
    function setTool(tl) {
      tool = tl;
      Object.keys(toolBtns).forEach(function (k) {
        toolBtns[k].classList.toggle('active', k === tl);
      });
      if (tl !== 'select') { selected = null; renderProps(); }
    }

    var pointers = {};     // active pointer events by id
    var panLast = null;
    var pinchDist = 0;
    var lastCell = null;
    var dragMoved = false;

    function canvasPos(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top,
               w: rect.width, h: rect.height };
    }

    function gridPos(e) {
      var p = canvasPos(e);
      var w = canvas.clientWidth || canvas.width || 800;
      var h = canvas.clientHeight || canvas.height || 480;
      var world = cam.screenToWorld(p.x, p.y, w, h);
      return { gx: world.x, gy: world.y };
    }

    canvas.addEventListener('pointerdown', function (e) {
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
      pointers[e.pointerId] = e;
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        // pinch start
        var a = pointers[ids[0]], b = pointers[ids[1]];
        pinchDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        return;
      }
      dragMoved = false;
      if (tool === 'place') {
        var g = gridPos(e);
        lastCell = { x: Math.round(g.gx), y: Math.round(g.gy) };
        placeAt(g.gx, g.gy);
      } else if (tool === 'select') {
        var g2 = gridPos(e);
        selected = objectAt(g2.gx, g2.gy);
        renderProps();
        updateButtons();
        if (selected) GD.audio.play('click');
        panLast = { x: e.clientX, y: e.clientY, moved: false, obj: selected,
                    objX: selected ? selected.x : 0, objY: selected ? selected.y : 0 };
      } else if (tool === 'delete') {
        var g3 = gridPos(e);
        lastCell = { x: Math.round(g3.gx), y: Math.round(g3.gy) };
        var obj = objectAt(g3.gx, g3.gy);
        if (obj) deleteObject(obj);
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!pointers[e.pointerId]) return;
      pointers[e.pointerId] = e;
      var ids = Object.keys(pointers);
      if (ids.length === 2 && pinchDist > 0) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        zoomBy(d / pinchDist);
        pinchDist = d;
        return;
      }
      if (tool === 'select' && panLast && panLast.obj) {
        // drag the selected object
        var g = gridPos(e);
        var nx = Math.max(0, Math.round(g.gx - 0.5));
        var ny = Math.max(0, Math.min(GD.objectdefs.MAX_Y, Math.round(g.gy - 0.5)));
        if (nx !== panLast.obj.x || ny !== panLast.obj.y) {
          panLast.obj.x = nx; panLast.obj.y = ny;
          panLast.moved = true;
          dirty = true;
        }
        return;
      }
      if (tool === 'place' || tool === 'delete') {
        var g2 = gridPos(e);
        var cell = { x: Math.round(g2.gx), y: Math.round(g2.gy) };
        if (lastCell && (cell.x !== lastCell.x || cell.y !== lastCell.y)) {
          lastCell = cell;
          dragMoved = true;
          if (tool === 'place') placeAt(g2.gx, g2.gy);
          else {
            var obj = objectAt(g2.gx, g2.gy);
            if (obj) deleteObject(obj);
          }
        }
        return;
      }
      // select tool with empty space: pan
      if (panLast && !panLast.obj) {
        panCamera(e.clientX - panLast.x, e.clientY - panLast.y);
        panLast.x = e.clientX; panLast.y = e.clientY;
      }
    });

    function endPointer(e) {
      delete pointers[e.pointerId];
      if (Object.keys(pointers).length < 2) pinchDist = 0;
      if (panLast && panLast.moved && panLast.obj) {
        // finalize the drag as an undoable command
        var obj = panLast.obj;
        var from = { x: panLast.objX, y: panLast.objY };
        var to = { x: obj.x, y: obj.y };
        pushCommand({
          do: function () { obj.x = to.x; obj.y = to.y; },
          undo: function () { obj.x = from.x; obj.y = from.y; }
        });
      }
      panLast = null;
      lastCell = null;
    }
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.1 : 0.9);
    }, { passive: false });

    function panCamera(dx, dy) {
      var w = canvas.clientWidth || 800;
      var h = canvas.clientHeight || 480;
      var ppu = cam.ppu(w, h);
      cam.x -= dx / ppu;
      cam.y += dy / ppu;
      cam.x = Math.max(-2, cam.x);
      cam.y = GD.util.clamp(cam.y, -1, GD.objectdefs.LEVEL_HEIGHT);
    }

    function zoomBy(f) {
      cam.zoom = GD.util.clamp(cam.zoom * f, 0.25, 3);
    }

    document.addEventListener('keydown', editorKeys);
    function editorKeys(e) {
      if (ui.current() !== 'editor') return;
      var tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
      else if (e.code === 'KeyR') { placeRot = (placeRot + 1) % 4; ui.toast(t('editor.rotation') + ': ' + (placeRot * 90) + '°'); }
      else if (e.code === 'Delete' || e.code === 'Backspace') { if (selected) deleteObject(selected); }
      else if (e.code === 'KeyP') setTool('place');
      else if (e.code === 'KeyS') setTool('select');
      else if (e.code === 'KeyD') setTool('delete');
    }

    // ------------------------------------------------------------- render
    function resize() {
      if (!canvas) return;
      var w = wrap.clientWidth || 800;
      var h = wrap.clientHeight || 480;
      var dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    var rafId = null;
    var lastT = 0;
    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (!lastT) lastT = now;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      editorTime += dt;
      render();
    }

    function render() {
      if (!ctx) return;
      var dpr = window.devicePixelRatio || 1;
      var w = canvas.width / dpr, h = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      GD.background.draw(ctx, w, h, cam.x, editorTime, level.themeId, 'editor',
        h * GD.levelrenderer.DEFAULT_GROUND_FRAC, false);

      ctx.save();
      cam.apply(ctx, w, h);

      // ground row shading + grid
      var ppu = cam.ppu(w, h);
      drawGrid(ctx, w, h, ppu);

      GD.levelrenderer.drawLevel(ctx, level, cam, w, h, editorTime, {
        selected: selected ? [selected] : []
      });

      // ghost preview
      if (tool === 'place') {
        var d = GD.objectdefs.getDef(currentTypeId);
        if (d) {
          var sprite = GD.sprites.get(currentTypeId, placeRot, level.themeId);
          var box = { w: d.w, h: d.h };
          ctx.globalAlpha = 0.5;
          ctx.drawImage(sprite, Math.round(cam.x - 2), 0.3, box.w + 0.7, box.h + 0.7);
          ctx.globalAlpha = 1;
        }
      }
      ctx.restore();
    }

    function drawGrid(ctx, w, h, ppu) {
      var x0 = cam.x - (w * 0.32) / ppu;
      var x1 = cam.x + (w * 0.68) / ppu;
      var lw = 1 / ppu;
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.lineWidth = lw;
      ctx.beginPath();
      for (var gx = Math.floor(x0); gx <= Math.ceil(x1); gx++) {
        ctx.moveTo(gx, 0); ctx.lineTo(gx, GD.objectdefs.LEVEL_HEIGHT);
      }
      for (var gy = 0; gy <= GD.objectdefs.LEVEL_HEIGHT; gy++) {
        ctx.moveTo(x0, gy); ctx.lineTo(x1, gy);
      }
      ctx.stroke();
      // ceiling line
      ctx.strokeStyle = 'rgba(255,80,80,0.35)';
      ctx.beginPath();
      ctx.moveTo(x0, GD.objectdefs.LEVEL_HEIGHT); ctx.lineTo(x1, GD.objectdefs.LEVEL_HEIGHT);
      ctx.stroke();
    }

    // ------------------------------------------------------------- start
    renderPaletteTabs();
    renderPalette();
    setTool('place');
    updateButtons();
    rafId = requestAnimationFrame(frame);

    return function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('keydown', editorKeys);
    };
  });

  return {};
});
