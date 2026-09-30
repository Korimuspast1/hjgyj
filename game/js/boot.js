/**
 * Neon Dash — application bootstrap.
 *
 * Owns the shared canvas, the animated main-menu background (scrolling
 * scene with a bouncing demo cube), platform helpers (music/vibration via
 * the Android bridge when available), and the Android back-button flow.
 */
/* global GD */
GD.register('app', function (GD) {
  'use strict';

  var HAS_WINDOW = typeof window !== 'undefined';

  var app = {};

  var canvas = null;
  var ctx = null;
  var menuRaf = null;
  var menuTime = 0;
  var menuCube = { y: 3, vy: 0 };
  var currentSong = null;
  var booted = false;

  /** Server URL baked into the build (set in index.html before scripts load). */
  GD.DEFAULT_SERVER_URL = (HAS_WINDOW && window.ND_CONFIG && window.ND_CONFIG.serverUrl) || '';

  // ------------------------------------------------------------ platform
  app.vibrate = function (pattern) {
    var s = GD.storage.getSettings();
    if (!s.vibration) return;
    try {
      if (window.AndroidBridge && window.AndroidBridge.vibrate) {
        window.AndroidBridge.vibrate(typeof pattern === 'number' ? pattern : 80);
      } else if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (e) { /* ignore */ }
  };

  app.playMusic = function (song) {
    currentSong = song;
    GD.audio.unlock();
    GD.audio.startMusic(song);
  };

  app.stopMusic = function () {
    GD.audio.stopMusic();
  };

  /** Called by the Android shell when the app returns to the foreground. */
  app.onResumeFromBackground = null;

  // ------------------------------------------------------- menu background
  var menuCamX = 0;

  app.startMenuBackground = function () {
    if (!ctx) return function () {};
    stopMenuBackground();
    var lastT = 0;
    function frame(now) {
      menuRaf = requestAnimationFrame(frame);
      if (!lastT) lastT = now;
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      menuTime += dt;
      menuCamX += dt * 4;

      // demo cube bounce
      menuCube.vy -= 60 * dt;
      menuCube.y += menuCube.vy * dt;
      if (menuCube.y <= 0) {
        menuCube.y = 0;
        menuCube.vy = 21;
      }

      var w = canvas.clientWidth || window.innerWidth || 800;
      var h = canvas.clientHeight || window.innerHeight || 480;
      var dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      var settings = GD.storage.getSettings();
      GD.background.draw(ctx, w, h, menuCamX, menuTime, 0, 'menu', h * GD.levelrenderer.DEFAULT_GROUND_FRAC, false);

      // bouncing cube above the ground line
      var ppu = h / GD.levelrenderer.VIEW_UNITS;
      var groundY = h * GD.levelrenderer.DEFAULT_GROUND_FRAC;
      var cubeSize = ppu * 0.9;
      var cubeX = w * 0.5 - cubeSize / 2;
      var cubeY = groundY - cubeSize - menuCube.y * ppu;
      var sprite = GD.playericon.get({
        primary: settings.colorPrimary, secondary: settings.colorSecondary
      });
      ctx.save();
      ctx.translate(cubeX + cubeSize / 2, cubeY + cubeSize / 2);
      var airT = menuCube.y > 0.05;
      if (airT) ctx.rotate(menuTime * 6);
      else {
        var snap = Math.round(menuTime * 6 / (Math.PI / 2)) * (Math.PI / 2);
        ctx.rotate(snap);
      }
      ctx.drawImage(sprite, -cubeSize / 2, -cubeSize / 2, cubeSize, cubeSize);
      ctx.restore();
    }
    menuRaf = requestAnimationFrame(frame);
    return stopMenuBackground;
  };

  function stopMenuBackground() {
    if (menuRaf) { cancelAnimationFrame(menuRaf); menuRaf = null; }
  }
  app.hideMenuBackground = stopMenuBackground;

  // ------------------------------------------------------------- back button
  function registerAndroidBack() {
  if (!HAS_WINDOW) return;
  window.onAndroidBack = function () {
    var overlay = document.querySelector('.modal-overlay');
    if (overlay) { overlay.remove(); return; }
    var screen = GD.ui.current();
    if (screen === 'game') {
      var pauseBtn = document.getElementById('btn-pause');
      if (pauseBtn) pauseBtn.click();   // exists only while the game screen is mounted
      return;
    }
    if (screen && screen !== 'menu') {
      GD.ui.show('menu');
      return;
    }
    if (window.AndroidBridge && window.AndroidBridge.exitApp) {
      window.AndroidBridge.exitApp();
    }
  };
  }
  registerAndroidBack();

  // ------------------------------------------------------------------ boot
  function resizeCanvas() {
    if (!canvas) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round((window.innerWidth || 800) * dpr);
    canvas.height = Math.round((window.innerHeight || 480) * dpr);
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }

  app.boot = function () {
    if (booted) return;
    booted = true;

    if (typeof document === 'undefined') return;
    canvas = document.getElementById('game-canvas');
    if (canvas && canvas.getContext) {
      ctx = canvas.getContext('2d');
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // settings -> audio
    var s = GD.storage.getSettings();
    GD.i18n.setLanguage(s.lang || 'en');
    GD.audio.setMusicVolume(s.musicVol);
    GD.audio.setSfxVolume(s.sfxVol);
    GD.net.resolveBaseUrl(s.serverUrl || undefined);

    // website embed mode: ?play=<levelId> starts the shared player
    var params = HAS_WINDOW && window.URLSearchParams
      ? new URLSearchParams(location.search) : { get: function () { return null; } };
    if (params.get('play')) {
      window.ND_WEBPLAY = { levelId: params.get('play') };
    }

    GD.ui.show('menu');

    // unlock audio on the very first gesture anywhere
    var unlock = function () {
      GD.audio.unlock();
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);

    // Android lifecycle — the shell calls these via evaluateJavascript
    window.onAndroidPause = function () {
      if (typeof app.onResumeFromBackground === 'function') app.onResumeFromBackground();
    };
    window.onAndroidResume = function () { /* reserved */ };
  };

  /** Re-sequence hook used by tests. */
  app._resetForTests = function () { booted = false; };

  return app;
});
