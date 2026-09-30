/**
 * Neon Dash — level encoding ("level codes").
 *
 * Export/import format, version 1:
 *
 *   NDL1:<base64url(payload)>:<crc32-hex-of-payload>
 *
 *   payload  = "1;name;author;song;theme;difficulty;length;object;object;..."
 *   object   = "t.x.y" | "t.x.y.r" | "t.x.y.r.p"     (all base-36 integers)
 *              t = type id, (x,y) = grid position, r = rotation 0..3,
 *              p = packed movement/variant parameter
 *
 * The base-36 token form keeps codes compact (a 300-object level is ~2 KB);
 * the outer base64url wrapper + CRC-32 checksum makes copy/paste robust and
 * lets the importer reject corrupted data with a precise error message.
 */
/* global GD */
GD.register('encoding', function (GD) {
  'use strict';

  var MAGIC = 'NDL1';
  var PAYLOAD_VERSION = 1;

  var encoding = {};

  /** Level model -> payload string (the "1;name;..." form). */
  encoding.encodePayload = function (level) {
    GD.level.validate(level);
    var u = GD.util;
    var parts = [
      String(PAYLOAD_VERSION),
      u.sanitizeName(level.name, GD.level.MAX_NAME),
      u.sanitizeName(level.author, GD.level.MAX_NAME),
      u.toBase36(level.songId),
      u.toBase36(level.themeId),
      u.toBase36(level.difficulty),
      u.toBase36(level.length)
    ];
    for (var i = 0; i < level.objects.length; i++) {
      var o = level.objects[i];
      // Rotation is omitted when 0 — but ONLY when there is no param after it,
      // otherwise field positions would be ambiguous.
      var rot = o.r || 0;
      var par = o.p || 0;
      parts.push(
        u.toBase36(o.t) + '.' + u.toBase36(o.x) + '.' + u.toBase36(o.y) +
        (par ? '.' + u.toBase36(rot) + '.' + u.toBase36(par) : (rot ? '.' + u.toBase36(rot) : ''))
      );
    }
    return parts.join(';');
  };

  /** Payload string -> new level model. Throws on any malformed input. */
  encoding.decodePayload = function (payload) {
    if (typeof payload !== 'string' || !payload.length) throw new Error('Empty level code');
    var parts = payload.split(';');
    if (parts.length < 7) throw new Error('Level code is truncated');
    var u = GD.util;
    var version = parseInt(parts[0], 10);
    if (version !== PAYLOAD_VERSION) {
      throw new Error('Unsupported level code version ' + parts[0]);
    }
    var objects = [];
    for (var i = 7; i < parts.length; i++) {
      var tok = parts[i];
      if (!tok) continue;
      var f = tok.split('.');
      if (f.length < 3 || f.length > 5) throw new Error('Malformed object token "' + tok + '"');
      var obj = {
        t: u.fromBase36(f[0]),
        x: u.fromBase36(f[1]),
        y: u.fromBase36(f[2])
      };
      if (f.length >= 4 && f[3] !== '') obj.r = u.fromBase36(f[3]);
      if (f.length >= 5 && f[4] !== '') obj.p = u.fromBase36(f[4]);
      objects.push(obj);
    }
    var level = {
      name: u.sanitizeName(parts[1], GD.level.MAX_NAME),
      author: u.sanitizeName(parts[2], GD.level.MAX_NAME),
      songId: u.fromBase36(parts[3]),
      themeId: u.fromBase36(parts[4]),
      difficulty: u.fromBase36(parts[5]),
      length: u.fromBase36(parts[6]),
      objects: objects
    };
    if (!level.name) throw new Error('Level code has no name');
    try {
      GD.level.validate(level);
    } catch (e) {
      throw new Error('Invalid level data: ' + e.message);
    }
    return level;
  };

  /** Level model -> full shareable code (magic + base64 + checksum). */
  encoding.encode = function (level) {
    var payload = encoding.encodePayload(level);
    return MAGIC + ':' + GD.util.b64encode(payload) + ':' +
      GD.util.crc32(payload).toString(16).padStart(8, '0');
  };

  /**
   * Full code -> level model.  Verifies the magic and the checksum before
   * parsing, so random/corrupted strings fail fast with a clear message.
   */
  encoding.decode = function (code) {
    if (typeof code !== 'string') throw new Error('Level code must be a string');
    code = code.trim();
    if (!code) throw new Error('Empty level code');
    var segments = code.split(':');
    if (segments.length !== 3) {
      throw new Error('Not a Neon Dash level code (expected NDL1:...:...)');
    }
    if (segments[0] !== MAGIC) {
      throw new Error('Unknown level code header "' + segments[0] + '"');
    }
    var checksum = segments[2].toLowerCase();
    if (!/^[0-9a-f]{8}$/.test(checksum)) throw new Error('Corrupted checksum in level code');
    var payload;
    try {
      payload = GD.util.b64decode(segments[1]);
    } catch (e) {
      throw new Error('Corrupted level data (bad encoding)');
    }
    var actual = GD.util.crc32(payload).toString(16).padStart(8, '0');
    if (actual !== checksum) {
      throw new Error('Corrupted level data (checksum mismatch)');
    }
    try {
      return encoding.decodePayload(payload);
    } catch (e) {
      throw new Error('Corrupted level data: ' + e.message);
    }
  };

  /** Quick structural test used by editors / upload forms. */
  encoding.looksLikeCode = function (s) {
    return typeof s === 'string' && s.trim().indexOf(MAGIC + ':') === 0;
  };

  return encoding;
});
