/**
 * Neon Dash — persistent storage.
 *
 * Uses localStorage when available (browser & Android WebView).  Node tests
 * inject a memory backend so save-data logic can be unit tested headlessly.
 */
/* global GD */
GD.register('storage', function (GD) {
  'use strict';

  var PREFIX = 'nd_';
  var backend = null;

  function detectBackend() {
    if (GD.__testStorage) return GD.__testStorage;      // injected by tests
    try {
      if (typeof localStorage !== 'undefined') {
        var k = '__nd_probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return localStorage;
      }
    } catch (e) { /* private mode / disabled storage */ }
    return null;
  }

  function ensure() {
    if (GD.__testStorage) { backend = GD.__testStorage; return backend; }  // test injection always wins
    if (!backend) backend = detectBackend();
    return backend;
  }

  var storage = {
    available: function () {
      var b = ensure();
      if (!b) return false;
      try {
        var k = '__nd_probe__';
        b.setItem(k, '1');
        b.removeItem(k);
        return true;
      } catch (e) { return false; }   // private mode / disabled storage
    },

    get: function (key, fallback) {
      var b = ensure();
      if (!b) return fallback;
      try {
        var raw = b.getItem(PREFIX + key);
        if (raw === null || raw === undefined) return fallback;
        return JSON.parse(raw);
      } catch (e) {
        return fallback;
      }
    },

    set: function (key, value) {
      var b = ensure();
      if (!b) return false;
      try {
        b.setItem(PREFIX + key, JSON.stringify(value));
        return true;
      } catch (e) {
        return false;
      }
    },

    remove: function (key) {
      var b = ensure();
      if (!b) return;
      try { b.removeItem(PREFIX + key); } catch (e) { /* ignore */ }
    },

    /** Remove everything stored by the game (used by "Reset Progress"). */
    clearAll: function () {
      var b = ensure();
      if (!b) return;
      try {
        var doomed = [];
        for (var i = 0; i < b.length; i++) {
          var k = b.key(i);
          if (k && k.indexOf(PREFIX) === 0) doomed.push(k);
        }
        for (i = 0; i < doomed.length; i++) b.removeItem(doomed[i]);
      } catch (e) { /* ignore */ }
    }
  };

  // ---- Settings -------------------------------------------------------------
  var DEFAULT_SETTINGS = {
    musicVol: 0.7,      // 0..1
    sfxVol: 0.9,        // 0..1
    vibration: true,
    colorPrimary: '#00e5ff',
    colorSecondary: '#ff3355',
    lang: 'en',
    serverUrl: '',      // '' = auto (same origin in browser; last saved otherwise)
    nickname: 'Player'
  };

  storage.getSettings = function () {
    var s = storage.get('settings', {});
    var out = {};
    for (var k in DEFAULT_SETTINGS) {
      out[k] = (s && s[k] !== undefined) ? s[k] : DEFAULT_SETTINGS[k];
    }
    return out;
  };

  storage.saveSettings = function (settings) {
    var merged = storage.getSettings();
    for (var k in settings) {
      if (DEFAULT_SETTINGS[k] !== undefined) merged[k] = settings[k];
    }
    storage.set('settings', merged);
    return merged;
  };

  // ---- Progress --------------------------------------------------------------
  storage.getProgress = function () { return storage.get('progress', {}); };
  storage.setLevelProgress = function (levelKey, data) {
    var p = storage.getProgress();
    p[levelKey] = data;
    storage.set('progress', p);
  };
  storage.resetProgress = function () { storage.remove('progress'); };

  // ---- Custom levels (editor slots) -------------------------------------------
  storage.getCustomLevels = function () { return storage.get('customLevels', []); };
  storage.saveCustomLevel = function (entry) {
    var list = storage.getCustomLevels();
    var now = Math.floor(Date.now() / 1000);
    entry.createdAt = entry.createdAt || now;
    entry.updatedAt = now;
    if (entry.id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === entry.id) { list[i] = entry; storage.set('customLevels', list); return entry; }
      }
    }
    entry.id = 'c' + now.toString(36) + Math.floor(Math.random() * 46656).toString(36);
    list.push(entry);
    storage.set('customLevels', list);
    return entry;
  };
  storage.deleteCustomLevel = function (id) {
    var list = storage.getCustomLevels();
    var out = list.filter(function (l) { return l.id !== id; });
    storage.set('customLevels', out);
    return out.length !== list.length;
  };

  // ---- Downloaded online levels -------------------------------------------------
  storage.getDownloads = function () { return storage.get('downloads', {}); };
  storage.saveDownload = function (levelId, entry) {
    var d = storage.getDownloads();
    d[levelId] = entry;
    storage.set('downloads', d);
  };

  return storage;
});
