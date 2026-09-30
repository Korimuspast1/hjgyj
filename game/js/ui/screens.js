/**
 * Neon Dash — screens: main menu, gameplay, settings, dialogs.
 *
 * All screens are plain DOM (inside #ui-root) rendered above the game canvas.
 * DOM-based UI keeps the whole app testable headlessly (tests/ui) and makes
 * text localisation trivial.
 *
 * Main menu layout mirrors Geometry Dash: big logo, three buttons
 * (Play / Settings / Editor), animated background with a bouncing cube.
 */
/* global GD */
GD.register('ui', function (GD) {
  'use strict';

  var ui = {};
  var t = function (k) { return GD.i18n.t(k); };

  // ------------------------------------------------------------------ utils
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  ui.esc = esc;

  /** Create an element.  spec = 'div.class1#theid', attrs object, children. */
  function el(spec, attrs) {
    var parts = spec.split('.');
    var node = document.createElement(parts[0].indexOf('#') >= 0 ? parts[0].split('#')[0] : (parts[0] || 'div'));
    var classes = [];
    for (var i = 1; i < parts.length; i++) {
      var seg = parts[i].split('#');
      if (seg[0]) classes.push(seg[0]);
      if (seg[1]) node.id = seg[1];
    }
    if (classes.length) node.className = classes.join(' ');
    var firstChild = 1;
    // Only treat `attrs` as attributes when it is a plain object — a node,
    // array or string in that position is a child (common convenience).
    if (attrs && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs)) {
      firstChild = 2;
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') {
          for (var s in v) node.style[s] = v[s];
        } else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2), v);
        } else {
          node.setAttribute(k, v);
        }
      }
    }
    for (var i2 = firstChild; i2 < arguments.length; i2++) {
      var c = arguments[i2];
      if (c === null || c === undefined) continue;
      if (Array.isArray(c)) {
        for (var j = 0; j < c.length; j++) if (c[j]) node.appendChild(c[j]);
      } else if (typeof c === 'string') {
        node.appendChild(document.createTextNode(c));
      } else {
        node.appendChild(c);
      }
    }
    return node;
  }
  ui.el = el;

  // --------------------------------------------------------------- dialogs
  var activeOverlay = null;

  function closeOverlay() {
    if (activeOverlay) {
      activeOverlay.remove();
      activeOverlay = null;
    }
  }

  /** Modal with title, content node and buttons [{label, class, onClick, keep}]. */
  ui.dialog = function (title, contentNode, buttons) {
    closeOverlay();
    var btns = (buttons || []).map(function (b) {
      return el('button.btn.' + (b.cls || 'btn-primary'), {
        type: 'button', text: b.label,
        onclick: function () {
          if (!b.keep) closeOverlay();
          if (b.onClick) b.onClick();
        }
      });
    });
    var box = el('div.modal-box',
      el('h2.modal-title', { text: title }),
      contentNode,
      el('div.modal-buttons', btns));
    activeOverlay = el('div.modal-overlay', { role: 'dialog' }, box);
    activeOverlay.addEventListener('click', function (e) {
      if (e.target === activeOverlay) closeOverlay();
    });
    document.getElementById('ui-root').appendChild(activeOverlay);
    return box;
  };

  ui.confirm = function (title, message, onYes) {
    ui.dialog(title, el('p.modal-text', { text: message }), [
      { label: t('common.cancel'), cls: 'btn-secondary', onClick: null },
      { label: t('common.ok'), cls: 'btn-danger', onClick: onYes }
    ]);
  };

  var toastTimer = null;
  ui.toast = function (message, kind) {
    var root = document.getElementById('ui-root');
    var old = root.querySelector('.toast');
    if (old) old.remove();
    var node = el('div.toast.' + (kind || 'info'), { text: message });
    root.appendChild(node);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.add('gone'); }, 2200);
    setTimeout(function () { node.remove(); }, 2800);
  };

  // -------------------------------------------------------- screen manager
  var currentScreen = null;
  var currentCleanup = null;

  ui.current = function () { return currentScreen; };

  ui.show = function (name, params) {
    if (currentCleanup) { currentCleanup(); currentCleanup = null; }
    closeOverlay();
    var root = document.getElementById('ui-root');
    root.innerHTML = '';
    currentScreen = name;
    var fn = SCREENS[name];
    if (!fn) throw new Error('Unknown screen: ' + name);
    currentCleanup = fn(root, params || {}) || null;
    GD.app && GD.app.onScreenChanged && GD.app.onScreenChanged(name);
  };

  var SCREENS = {};
  ui.registerScreen = function (name, fn) { SCREENS[name] = fn; };

  // ------------------------------------------------------------- main menu
  ui.registerScreen('menu', function (root) {
    var settings = GD.storage.getSettings();
    GD.i18n.setLanguage(settings.lang || 'en');

    var playBtn = el('button.menu-btn.btn-play', {
      type: 'button', 'data-action': 'play', 'aria-label': t('menu.play'),
      onclick: function () { GD.audio.unlock(); GD.audio.play('click'); ui.show('select'); }
    }, el('span.menu-btn-icon.icon-play'), el('span.menu-btn-label', { text: t('menu.play') }));

    var settingsBtn = el('button.menu-btn.btn-settings', {
      type: 'button', 'data-action': 'settings', 'aria-label': t('menu.settings'),
      onclick: function () { GD.audio.unlock(); GD.audio.play('click'); ui.show('settings'); }
    }, el('span.menu-btn-icon.icon-settings'), el('span.menu-btn-label', { text: t('menu.settings') }));

    var editorBtn = el('button.menu-btn.btn-editor', {
      type: 'button', 'data-action': 'editor', 'aria-label': t('menu.editor'),
      onclick: function () { GD.audio.unlock(); GD.audio.play('click'); ui.show('editor'); }
    }, el('span.menu-btn-icon.icon-editor'), el('span.menu-btn-label', { text: t('menu.editor') }));

    root.appendChild(el('div.screen.menu-screen',
      el('div.menu-logo',
        el('h1.logo-neon', { text: 'NEON' }),
        el('h1.logo-dash', { text: 'DASH' })),
      el('div.menu-buttons', playBtn, settingsBtn, editorBtn),
      el('div.menu-footer',
        el('span', { text: t('menu.version') + ' ' + GD.VERSION + '  ·  ' + t('menu.tagline') }))
    ));

    // Animated background: scrolling scene + bouncing demo cube.
    var stop = GD.app.startMenuBackground();
    return stop;
  });

  // -------------------------------------------------------------- settings
  ui.registerScreen('settings', function (root) {
    var s = GD.storage.getSettings();
    var dirty = {};

    function slider(id, label, value, onInput) {
      var valEl = el('span.setting-value', { text: Math.round(value * 100) + '%' });
      var input = el('input.slider', {
        type: 'range', min: '0', max: '100', value: Math.round(value * 100),
        'data-testid': id
      });
      input.addEventListener('input', function () {
        var v = parseInt(input.value, 10) / 100;
        valEl.textContent = input.value + '%';
        onInput(v);
      });
      return el('div.setting-row',
        el('label.setting-label', { text: label }),
        input, valEl);
    }

    function colorRow(id, label, hex, onPick) {
      var swatches = [];
      var hues = [185, 200, 120, 60, 30, 0, 300, 265];
      var current = el('span.color-current', { 'data-testid': id });
      current.style.background = hex;
      for (var i = 0; i < hues.length; i++) {
        (function (hue) {
          var sw = el('button.color-swatch', {
            type: 'button', 'data-hue': hue,
            style: { background: GD.util.hsvToHex(hue, 1, 1) }
          });
          sw.addEventListener('click', function () {
            var chosen = GD.util.hsvToHex(hue, 1, 1);
            current.style.background = chosen;
            onPick(chosen);
            GD.audio.play('click');
          });
          swatches.push(sw);
        })(hues[i]);
      }
      // free hue slider
      var hueSlider = el('input.slider.hue-slider', { type: 'range', min: '0', max: '359', value: '185' });
      hueSlider.addEventListener('input', function () {
        var chosen = GD.util.hsvToHex(parseInt(hueSlider.value, 10), 1, 1);
        current.style.background = chosen;
        onPick(chosen);
      });
      return el('div.setting-row.color-row',
        el('label.setting-label', { text: label }),
        el('div.color-picker', current, el('div.color-swatches', swatches), hueSlider));
    }

    var musicSlider = slider('music-volume', t('settings.music'), s.musicVol, function (v) {
      dirty.musicVol = v; GD.audio.setMusicVolume(v);
    });
    var sfxSlider = slider('sfx-volume', t('settings.sfx'), s.sfxVol, function (v) {
      dirty.sfxVol = v; GD.audio.setSfxVolume(v);
      if (v > 0) GD.audio.play('click');
    });

    var vibToggle = el('input.toggle', { type: 'checkbox', 'data-testid': 'vibration' });
    vibToggle.checked = !!s.vibration;
    vibToggle.addEventListener('change', function () {
      dirty.vibration = vibToggle.checked;
      if (vibToggle.checked) GD.app.vibrate(80);
    });

    var langSelect = el('select.select', { 'data-testid': 'language' });
    GD.i18n.SUPPORTED.forEach(function (lang) {
      var o = el('option', { value: lang.code, text: lang.name });
      if (lang.code === (s.lang || 'en')) o.selected = true;
      langSelect.appendChild(o);
    });
    langSelect.addEventListener('change', function () {
      dirty.lang = langSelect.value;
      GD.i18n.setLanguage(langSelect.value);
      ui.toast(t('settings.title'));
      ui.show('settings'); // re-render in the new language
    });

    var colorPrimary = colorRow('color-primary', t('settings.playerColor'), s.colorPrimary, function (hex) {
      dirty.colorPrimary = hex;
    });
    var colorSecondary = colorRow('color-secondary', t('settings.secondaryColor'), s.colorSecondary, function (hex) {
      dirty.colorSecondary = hex;
    });

    var nickInput = el('input.text-input', {
      type: 'text', maxlength: '16', value: s.nickname || 'Player', 'data-testid': 'nickname'
    });
    nickInput.addEventListener('change', function () { dirty.nickname = nickInput.value.trim() || 'Player'; });

    var serverInput = el('input.text-input', {
      type: 'url', value: s.serverUrl || '', placeholder: 'https://…', 'data-testid': 'server-url'
    });
    serverInput.addEventListener('change', function () {
      dirty.serverUrl = serverInput.value.trim().replace(/\/+$/, '');
      GD.net.resolveBaseUrl(dirty.serverUrl || undefined);
    });

    var preview = el('canvas.icon-preview', { width: 84, height: 84, 'data-testid': 'icon-preview' });

    function drawPreview() {
      var ctx = preview.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, 84, 84);
      var sprite = GD.playericon.get({
        primary: dirty.colorPrimary || s.colorPrimary,
        secondary: dirty.colorSecondary || s.colorSecondary
      });
      ctx.drawImage(sprite, 0, 0, 84, 84);
    }

    // redraw the preview whenever a colour is picked
    function colorPicker(id, labelKey, key) {
      return colorRow(id, t('settings.' + labelKey), s[key], function (hex) {
        dirty[key] = hex;
        drawPreview();
      });
    }
    var colorPrimary = colorPicker('color-primary', 'playerColor', 'colorPrimary');
    var colorSecondary = colorPicker('color-secondary', 'secondaryColor', 'colorSecondary');

    var resetBtn = el('button.btn.btn-danger', {
      type: 'button', 'data-testid': 'reset-progress', text: t('settings.resetProgress')
    });
    resetBtn.addEventListener('click', function () {
      ui.confirm(t('settings.resetProgress'), t('settings.resetConfirm'), function () {
        GD.storage.resetProgress();
        GD.app.vibrate(200);
        ui.toast(t('settings.resetDone'));
      });
    });

    var testVib = el('button.btn.btn-secondary', { type: 'button', text: t('settings.testVibration') });
    testVib.addEventListener('click', function () { GD.app.vibrate(150); });

    var save = function () {
      var merged = GD.storage.saveSettings(dirty);
      GD.audio.setMusicVolume(merged.musicVol);
      GD.audio.setSfxVolume(merged.sfxVol);
      GD.net.resolveBaseUrl(merged.serverUrl || undefined);
    };

    var backBtn = el('button.btn.btn-back', {
      type: 'button', 'data-testid': 'back', text: '◀ ' + t('common.back'),
      onclick: function () {
        save();
        GD.audio.play('back');
        ui.show('menu');
      }
    });

    root.appendChild(el('div.screen.settings-screen#settings-screen',
      el('h2.screen-title', { text: t('settings.title') }),
      el('div.settings-scroll',
        musicSlider,
        sfxSlider,
        el('div.setting-row', el('label.setting-label', { text: t('settings.vibration') }),
          el('div.toggle-wrap', vibToggle, testVib)),
        el('div.setting-row', el('label.setting-label', { text: t('settings.language') }), langSelect),
        el('div.preview-wrap', preview),
        colorPrimary,
        colorSecondary,
        el('div.setting-row', el('label.setting-label', { text: t('settings.nickname') }), nickInput),
        el('div.setting-row.server-row', el('label.setting-label', { text: t('settings.server') }), serverInput),
        el('div.danger-zone', resetBtn)
      ),
      el('div.screen-footer', backBtn)
    ));
    drawPreview();

    return function () { save(); };
  });

  // ------------------------------------------------------------- gameplay
  /**
   * params: {
   *   level, storageKey?, levelKey?, report?, onExit(), fromEditor?
   * }
   */
  ui.registerScreen('game', function (root, params) {
    var level = params.level;
    var settings = GD.storage.getSettings();
    var colours = { primary: settings.colorPrimary, secondary: settings.colorSecondary };
    var song = GD.level.SONGS[level.songId] || GD.level.SONGS[0];

    var canvas = document.getElementById('game-canvas');
    var ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;

    var session = new GD.gameplay.GameSession(level, {
      storageKey: params.storageKey || null,
      levelKey: params.levelKey || null,
      report: params.report || null,
      onEvent: handleEvent
    });

    var cam = new GD.levelrenderer.Camera();
    var particles = new GD.levelrenderer.Particles();
    var trail = [];
    var jumps = 0;
    var paused = false;
    var rafId = null;
    var lastTime = 0;
    var acc = 0;

    // ---- HUD ---------------------------------------------------------------
    var progressBar = el('div.hud-progress-bar#hud-progress-bar');
    var progressFill = el('div.hud-progress-fill#hud-progress-fill');
    progressBar.appendChild(progressFill);
    var progressText = el('span.hud-progress-text#hud-progress-text', { text: '0%' });
    var attemptText = el('span.hud-attempt#hud-attempt',
      { text: t('game.attempt') + ' ' + (session.attempt + 1) });
    var pauseBtn = el('button.hud-btn.hud-pause#btn-pause', {
      type: 'button', 'aria-label': t('game.paused'), text: 'II'
    });
    var hud = el('div.hud#game-hud', progressBar, progressText, attemptText, pauseBtn);
    hud.style.display = 'none';

    pauseBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      togglePause();
    });

    root.appendChild(hud);
    root.appendChild(el('div.screen.game-screen#game-screen'));

    function handleEvent(ev, sess) {
      if (ev.type === 'jump') {
        jumps++;
        particles.spawn({ x: ev.x, y: ev.y + (sess.state.gravity > 0 ? 0 : 1), vx: -2, vy: 1, life: 0.3, size: 0.2, color: '#ffffff', gravity: 10 });
      } else if (ev.type === 'death') {
        particles.burst(ev.x + 0.5, ev.y + 0.5, colours.primary, 26, 11);
        particles.burst(ev.x + 0.5, ev.y + 0.5, colours.secondary, 14, 8);
        cam.shake = 1;
        GD.audio.play('death');
        GD.audio.duck();
        GD.app.vibrate(120);
      } else if (ev.type === 'finish') {
        particles.burst(ev.x, ev.y + 0.5, '#ffd94a', 40, 13);
        GD.audio.play('win');
        GD.app.vibrate([60, 60, 120]);
        setTimeout(showWin, 400);
      } else if (ev.type === 'portal') {
        particles.burst(ev.x + 0.5, ev.y + 0.5, ev.kind === 'gravity' ? '#4ab6ff' : '#5cf28a', 16, 7);
        GD.audio.play('portal');
      } else if (ev.type === 'pad') {
        particles.burst(ev.x + 0.5, ev.y + 0.5, ev.style === 'pink' ? '#ff7bd5' : '#ffd94a', 12, 6);
        GD.audio.play('pad');
      } else if (ev.type === 'orb') {
        particles.burst(ev.x + 0.5, ev.y + 0.5, ev.style === 'yellow' ? '#ffd94a' : '#ff7bd5', 14, 7);
        GD.audio.play('orb');
      }
    }

    function showWin() {
      var stats = el('div.win-stats',
        el('div.win-stat', el('span.win-stat-value', { text: String(session.attempt + 1) }),
          el('span.win-stat-label', { text: t('game.attempt') })),
        el('div.win-stat', el('span.win-stat-value', { text: String(jumps) }),
          el('span.win-stat-label', { text: 'Jumps' })),
        el('div.win-stat', el('span.win-stat-value', { text: '100%' }),
          el('span.win-stat-label', { text: t('game.progress') })));

      var levelName = level.name;
      ui.dialog(t('game.complete') + ' — ' + levelName, stats, [
        {
          label: t('game.restart'), cls: 'btn-secondary', onClick: function () {
            restart();
          }
        },
        {
          label: t('common.close'), cls: 'btn-primary', onClick: function () {
            exit();
          }
        }
      ]);
      GD.app.stopMusic();
    }

    function restart() {
      session.mode = 'playing';
      session.resetAttempt(false);
      session.state.progress = 0;
      jumps = 0;
      trail.length = 0;
      particles.clear();
      attemptText.textContent = t('game.attempt') + ' ' + (session.attempt + 1);
      paused = false;
      hud.style.display = '';
      GD.app.playMusic(song);
    }

    function exit() {
      GD.app.stopMusic();
      if (params.onExit) params.onExit();
      else ui.show('select');
    }

    function togglePause() {
      if (session.mode === 'finished') return;
      paused = !paused;
      GD.audio.play('click');
      if (paused) {
        GD.app.stopMusic();
        ui.dialog(t('game.paused'),
          el('p.modal-text', { text: t('game.pausedHint') }), [
            { label: t('game.resume'), cls: 'btn-primary', onClick: function () { togglePause(); } },
            { label: t('game.restart'), cls: 'btn-secondary', onClick: function () { paused = false; restart(); } },
            { label: t('game.quit'), cls: 'btn-danger', onClick: exit }
          ]);
      } else {
        closeOverlay();
        GD.app.playMusic(song);
      }
    }

    // ---- input --------------------------------------------------------------
    function onPointerDown(e) {
      if (paused || session.mode === 'finished') return;
      if (e.target && e.target.closest && e.target.closest('.hud-btn, .modal-overlay, button')) return;
      e.preventDefault();
      session.press();
    }
    function onPointerUp() { session.release(); }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('keydown', onKeyDown);

    function onKeyDown(e) {
      if (e.repeat) return;
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (!paused) session.press();
      } else if (e.code === 'Escape' || e.code === 'KeyP') {
        togglePause();
      }
    }
    document.addEventListener('keyup', onKeyUp);
    function onKeyUp(e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') session.release();
    }

    // auto-pause when the app goes to the background
    function onVisibility() {
      if (document.hidden && !paused && session.mode === 'playing') togglePause();
    }
    document.addEventListener('visibilitychange', onVisibility);
    GD.app.onResumeFromBackground = function () {
      if (!paused && session.mode === 'playing') togglePause();
    };

    // ---- loop ----------------------------------------------------------------
    function frame(now) {
      rafId = requestAnimationFrame(frame);
      if (!lastTime) lastTime = now;
      var dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (!paused && session.mode !== 'finished') {
        acc += dt;
        var stepDt = 1 / 120;
        while (acc >= stepDt) {
          session.update(stepDt);
          acc -= stepDt;
        }
        particles.update(dt);
        updateTrail();
      }
      updateCamera(dt);
      render(now / 1000);
      updateHud();
    }

    function updateTrail() {
      var st = session.state;
      if (session.mode === 'playing' && st.alive) {
        trail.push({ x: st.x, y: st.y, rot: st.rot });
        if (trail.length > 14) trail.shift();
      }
    }

    function updateCamera(dt) {
      var st = session.state;
      cam.x = st.x + 1.2;
      var targetY = st.gravity < 0
        ? GD.util.clamp(st.y - 3, 0, 4)
        : (st.y > 4 ? st.y - 4 : 0);
      cam.y = GD.util.approach(cam.y, targetY, 6, dt);
      cam.shake = Math.max(0, cam.shake - dt * 3);
    }

    function render(time) {
      if (!ctx) return;
      var w = canvas.width / (window.devicePixelRatio || 1);
      var h = canvas.height / (window.devicePixelRatio || 1);
      var dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // background+ground with ground line at 80% height
      GD.background.draw(ctx, w, h, cam.x, time, level.themeId, 'game', h * GD.levelrenderer.DEFAULT_GROUND_FRAC, session.state.gravity < 0);

      ctx.save();
      cam.apply(ctx, w, h);

      GD.levelrenderer.drawLevel(ctx, level, cam, w, h, session.state.time, {});
      GD.levelrenderer.drawTrail(ctx, trail, colours);

      var st = session.state;
      if (st.alive || session.mode === 'finished') {
        GD.levelrenderer.drawPlayer(ctx, st, colours);
      }
      particles.draw(ctx);
      ctx.restore();

      // vignette
      var vg = ctx.createRadialGradient(w / 2, h / 2, h * 0.4, w / 2, h / 2, h * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.25)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    function updateHud() {
      var pct = Math.round(session.state.progress * 100);
      progressFill.style.width = pct + '%';
      progressText.textContent = pct + '%';
    }

    // ---- start -----------------------------------------------------------------
    hud.style.display = '';
    GD.app.hideMenuBackground();
    GD.app.playMusic(song);
    rafId = requestAnimationFrame(frame);

    // attempt label should update on respawn
    var prevAttempt = session.attempt;
    var hudWatch = setInterval(function () {
      if (session.attempt !== prevAttempt) {
        prevAttempt = session.attempt;
        attemptText.textContent = t('game.attempt') + ' ' + (session.attempt + 1);
      }
      if (session.mode === 'finished') attemptText.textContent = t('game.attempt') + ' ' + (session.attempt + 1);
    }, 100);

    return function cleanup() {
      if (rafId) cancelAnimationFrame(rafId);
      clearInterval(hudWatch);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      document.removeEventListener('visibilitychange', onVisibility);
      GD.app.onResumeFromBackground = null;
      GD.app.stopMusic();
    };
  });

  return ui;
});
