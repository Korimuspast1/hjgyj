/**
 * Neon Dash — shared math / encoding utilities.
 * Pure functions only, so they are trivially unit-testable in Node.
 */
/* global GD */
GD.register('util', function () {
  'use strict';

  var util = {};

  util.clamp = function (v, lo, hi) {
    return v < lo ? lo : (v > hi ? hi : v);
  };

  util.lerp = function (a, b, t) {
    return a + (b - a) * t;
  };

  /** Frame-rate independent exponential approach. */
  util.approach = function (current, target, rate, dt) {
    var t = 1 - Math.exp(-rate * dt);
    return current + (target - current) * t;
  };

  util.sign = function (v) {
    return v < 0 ? -1 : (v > 0 ? 1 : 0);
  };

  /** Base-36 encode a non-negative integer (used by the level format). */
  util.toBase36 = function (n) {
    if (typeof n !== 'number' || !isFinite(n) || n < 0 || Math.floor(n) !== n) {
      throw new Error('toBase36 expects a non-negative integer, got ' + n);
    }
    return n.toString(36);
  };

  util.fromBase36 = function (s) {
    if (!/^[0-9a-z]+$/.test(s)) {
      throw new Error('fromBase36: invalid token "' + s + '"');
    }
    var n = parseInt(s, 36);
    if (!isFinite(n) || n < 0) {
      throw new Error('fromBase36: invalid value for "' + s + '"');
    }
    return n;
  };

  /** CRC-32 (IEEE), hex string output — checksum for level codes. */
  var CRC_TABLE = (function () {
    var table = new Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c >>> 0;
    }
    return table;
  })();

  util.crc32 = function (str) {
    str = String(str);
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < str.length; i++) {
      crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ str.charCodeAt(i)) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  };

  /** URL-safe base64 (RFC 4648 §5) without padding — used to wrap level codes. */
  util.b64encode = function (str) {
    str = unescape(encodeURIComponent(String(str)));
    var out = '';
    for (var i = 0; i < str.length; i += 3) {
      var b0 = str.charCodeAt(i);
      var b1 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
      var b2 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
      out += util._B64[b0 >> 2];
      out += util._B64[((b0 & 3) << 4) | (isNaN(b1) ? 0 : (b1 >> 4))];
      if (!isNaN(b1)) {
        out += util._B64[((b1 & 15) << 2) | (isNaN(b2) ? 0 : (b2 >> 6))];
      }
      if (!isNaN(b2)) {
        out += util._B64[b2 & 63];
      }
    }
    return out;
  };

  util.b64decode = function (s) {
    s = String(s);
    if (s.length % 4 === 1 || /[^A-Za-z0-9_-]/.test(s)) {
      throw new Error('b64decode: invalid input');
    }
    var str = '';
    var i = 0;
    // Translate alphabet then decode in 4-char groups; short tail handled per char.
    while (i < s.length) {
      var c0 = util._B64I[s.charAt(i++)];
      var c1 = util._B64I[s.charAt(i++)];
      if (c0 === undefined || c1 === undefined) throw new Error('b64decode: invalid input');
      str += String.fromCharCode((c0 << 2) | (c1 >> 4));
      if (i < s.length) {
        var c2 = util._B64I[s.charAt(i++)];
        if (c2 === undefined) throw new Error('b64decode: invalid input');
        str += String.fromCharCode(((c1 & 15) << 4) | (c2 >> 2));
        if (i < s.length) {
          var c3 = util._B64I[s.charAt(i++)];
          if (c3 === undefined) throw new Error('b64decode: invalid input');
          str += String.fromCharCode(((c2 & 3) << 6) | c3);
        }
      }
    }
    return decodeURIComponent(escape(str));
  };

  util._B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  util._B64I = (function () {
    var map = {};
    for (var i = 0; i < util._B64.length; i++) map[util._B64.charAt(i)] = i;
    return map;
  })();

  /** Escape a string for interpolation into level name fields (no ; | # allowed). */
  util.sanitizeName = function (s, maxLen) {
    s = String(s == null ? '' : s).replace(/[;|#\r\n\t]/g, ' ').trim();
    return s.slice(0, maxLen == null ? 24 : maxLen);
  };

  util.formatNumber = function (n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
  };

  util.formatDuration = function (secs) {
    secs = Math.max(0, Math.floor(secs));
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };

  /** h in [0,360), s,v in [0,1] -> '#rrggbb' */
  util.hsvToHex = function (h, s, v) {
    h = ((h % 360) + 360) % 360;
    var c = v * s;
    var x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    var m = v - c;
    var r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    var to255 = function (q) { return Math.round((q + m) * 255); };
    var hex = function (q) { var h2 = to255(q).toString(16); return h2.length === 1 ? '0' + h2 : h2; };
    return '#' + hex(r) + hex(g) + hex(b);
  };

  return util;
});
