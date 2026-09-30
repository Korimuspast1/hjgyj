/**
 * UNIT TESTS — level encoding (the shareable "level code" format).
 */
'use strict';
const assert = require('assert');
const { loadGame } = require('../loader.js');

const sb = loadGame();
const GD = sb.GD;

describe('encoding', function () {
  function sampleLevel() {
    return {
      name: 'Test Level', author: 'Tester', songId: 2, themeId: 3,
      difficulty: 4, length: 200,
      objects: [
        { t: 20, x: 10, y: 0 },
        { t: 20, x: 12, y: 0, r: 2 },
        { t: 1, x: 20, y: 3 },
        { t: 33, x: 30, y: 1, r: 0, p: GD.objectdefs.packMovement(3, 2.5, 0.25, 1) },
        { t: 55, x: 40, y: 5 }
      ]
    };
  }

  it('round-trips a level exactly', function () {
    const code = GD.encoding.encode(sampleLevel());
    assert.ok(code.startsWith('NDL1:'), 'has magic');
    const back = GD.encoding.decode(code);
    const orig = sampleLevel();
    assert.strictEqual(back.name, orig.name);
    assert.strictEqual(back.author, orig.author);
    assert.strictEqual(back.songId, orig.songId);
    assert.strictEqual(back.themeId, orig.themeId);
    assert.strictEqual(back.difficulty, orig.difficulty);
    assert.strictEqual(back.length, orig.length);
    assert.strictEqual(back.objects.length, orig.objects.length);
    for (let i = 0; i < orig.objects.length; i++) {
      assert.strictEqual(back.objects[i].t, orig.objects[i].t);
      assert.strictEqual(back.objects[i].x, orig.objects[i].x);
      assert.strictEqual(back.objects[i].y, orig.objects[i].y);
      assert.strictEqual(back.objects[i].r || 0, orig.objects[i].r || 0);
      assert.strictEqual(back.objects[i].p || 0, orig.objects[i].p || 0);
    }
  });

  it('is stable (same level -> same code)', function () {
    const a = GD.encoding.encode(sampleLevel());
    const b = GD.encoding.encode(sampleLevel());
    assert.strictEqual(a, b);
  });

  it('rejects corrupted data: bad checksum', function () {
    const code = GD.encoding.encode(sampleLevel());
    const parts = code.split(':');
    const flipped = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'A' ? 'B' : 'A');
    assert.throws(() => GD.encoding.decode('NDL1:' + flipped + ':' + parts[2]),
      /checksum mismatch/);
  });

  it('rejects corrupted data: truncated payload', function () {
    const code = GD.encoding.encode(sampleLevel());
    const parts = code.split(':');
    const cut = parts[1].slice(0, Math.max(1, parts[1].length - 5));
    const payload = GD.util.b64decode(cut);
    const crc = GD.util.crc32(payload).toString(16).padStart(8, '0');
    assert.throws(() => GD.encoding.decode('NDL1:' + cut + ':' + crc),
      /Corrupted|Invalid|truncated|Malformed/);
  });

  it('rejects garbage strings with clear errors', function () {
    assert.throws(() => GD.encoding.decode(''), /Empty/);
    assert.throws(() => GD.encoding.decode('hello world'), /Not a Neon Dash/);
    assert.throws(() => GD.encoding.decode('XXX1:aaaa:deadbeef'), /Unknown level code header/);
    assert.throws(() => GD.encoding.decode('NDL1:!!!:00000000'), /Corrupted/);
    assert.throws(() => GD.encoding.decode('NDL1:aaaa:zzzz'), /checksum/);
  });

  it('rejects unknown object types inside a valid checksum', function () {
    const payload = '1;Evil;Tester;0;0;0;50;zz.5.0';
    const crc = GD.util.crc32(payload).toString(16).padStart(8, '0');
    assert.throws(() => GD.encoding.decode('NDL1:' + GD.util.b64encode(payload) + ':' + crc),
      /Invalid level data/);
  });

  it('handles rotation-0-with-param ambiguity correctly', function () {
    // r = 0 but p != 0 must decode p as the 4th field (documented pitfall)
    const level = sampleLevel();
    level.objects = [{ t: 28, x: 5, y: 0, r: 0, p: 12345 }];
    const back = GD.encoding.decode(GD.encoding.encode(level));
    assert.strictEqual(back.objects[0].p, 12345);
    assert.strictEqual(back.objects[0].r || 0, 0);
  });

  it('looksLikeCode detects the prefix', function () {
    const code = GD.encoding.encode(sampleLevel());
    assert.strictEqual(GD.encoding.looksLikeCode(code), true);
    assert.strictEqual(GD.encoding.looksLikeCode('junk'), false);
    assert.strictEqual(GD.encoding.looksLikeCode(' NDL1:x:y'), true);
  });

  it('compacts: codes stay small', function () {
    const level = sampleLevel();
    level.length = 600;
    for (let i = 0; i < 300; i++) level.objects.push({ t: 20, x: 100 + i, y: 0 });
    const code = GD.encoding.encode(level);
    assert.ok(code.length < 6000, '300-object level < 6 KB, got ' + code.length);
  });
});
