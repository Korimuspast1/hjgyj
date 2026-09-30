/**
 * UNIT TESTS — level model: creation, validation, spatial index.
 */
'use strict';
const assert = require('assert');
const { loadGame } = require('../loader.js');

const sb = loadGame();
const GD = sb.GD;
const L = GD.level;

describe('level', function () {

  it('create() makes a sane empty level', function () {
    const lv = L.create('My Level', 'Me');
    assert.strictEqual(lv.objects.length, 0);
    assert.ok(lv.length >= 30 && lv.length <= 5000);
    assert.doesNotThrow(() => L.validate(lv));
  });

  it('create() sanitizes names', function () {
    // Level-code separators must be neutralised (they would corrupt the
    // share-code payload); rendering is XSS-safe via textContent.
    const lv = L.create('a;b#c\nd', '');
    assert.ok(!/[;|#\n]/.test(lv.name), 'separators replaced: ' + JSON.stringify(lv.name));
    assert.strictEqual(lv.name.trim(), lv.name, 'trimmed');
    assert.ok(lv.name.length > 0, 'never empty');
    assert.ok(lv.author.length > 0);
    const long = L.create('x'.repeat(500), 'y'.repeat(500));
    assert.ok(long.name.length <= 24 && long.author.length <= 24, 'length capped');
  });

  it('validate() rejects bad levels with helpful messages', function () {
    assert.throws(() => L.validate(null), /not an object/);
    assert.throws(() => L.validate({}), /name missing/);
    const noAuthor = L.create('x'); delete noAuthor.author;
    assert.throws(() => L.validate(noAuthor), /author/);
    const bad = (fn) => { const lv = L.create('x', 'y'); fn(lv); return lv; };
    assert.throws(() => L.validate(bad(lv => { lv.name = 'x'.repeat(200); })), /too long/);
    assert.throws(() => L.validate(bad(lv => { lv.songId = 99; })), /song/);
    assert.throws(() => L.validate(bad(lv => { lv.themeId = 99; })), /theme/);
    assert.throws(() => L.validate(bad(lv => { lv.difficulty = 9; })), /difficulty/);
    assert.throws(() => L.validate(bad(lv => { lv.length = 1; })), /length/);
    assert.throws(() => L.validate(bad(lv => { lv.objects = 'nope'; })), /objects missing/);
    assert.throws(() => L.validate(bad(lv => { lv.objects.push({ t: 9999, x: 5, y: 0 }); })), /Unknown object type/);
    assert.throws(() => L.validate(bad(lv => { lv.objects.push({ t: 1, x: 1.5, y: 0 }); })), /Invalid x/);
    assert.throws(() => L.validate(bad(lv => { lv.objects.push({ t: 1, x: 5, y: -1 }); })), /Invalid y/);
    assert.throws(() => L.validate(bad(lv => { lv.objects.push({ t: 1, x: 5, y: 0, r: 7 }); })), /rotation/);
    assert.throws(() => L.validate(bad(lv => { lv.objects.push({ t: 1, x: 5, y: 0, p: 99999 }); })), /param/);
  });

  it('validate() accepts objects up to 32 units past the end', function () {
    const lv = L.create('x', 'y');
    lv.objects.push({ t: 1, x: lv.length + 31, y: 0 });
    assert.doesNotThrow(() => L.validate(lv));
    lv.objects.push({ t: 1, x: lv.length + 33, y: 0 });
    assert.throws(() => L.validate(lv), /beyond the level end/);
  });

  it('buildIndex: query returns objects near a column', function () {
    const lv = L.create('x', 'y');
    lv.objects = [
      { t: 1, x: 10, y: 0 },
      { t: 1, x: 11, y: 0 },
      { t: 1, x: 50, y: 0 },
      { t: 20, x: 12, y: 3 }
    ];
    const idx = L.buildIndex(lv);
    const near = idx.query(9, 13);
    assert.strictEqual(near.length, 3, 'three objects around x=10-12');
    const far = idx.query(48, 52);
    assert.strictEqual(far.length, 1);
    const none = idx.query(100, 110);
    assert.strictEqual(none.length, 0);
  });

  it('objectBox footprints account for rotation and movement', function () {
    const P = GD.physics;
    const b0 = P.objectBox({ t: 1, x: 10, y: 2 }, 0);   // 1x1 block
    assert.strictEqual(b0.w, 1); assert.strictEqual(b0.h, 1);
    const plat = P.objectBox({ t: 13, x: 10, y: 2 }, 0); // 2x0.3 platform
    assert.strictEqual(plat.w, 2); assert.strictEqual(plat.h, 0.3);
    const rot = P.objectBox({ t: 13, x: 10, y: 2, r: 1 }, 0); // rotated 90deg
    assert.strictEqual(rot.w, 0.3); assert.strictEqual(rot.h, 2);
    // moving saw: offset grows with time (axis 0 = horizontal)
    const p = GD.objectdefs.packMovement(4, 2, 0, 0);
    const at0 = P.objectBox({ t: 33, x: 20, y: 0, p: p }, 0);
    const atQuarter = P.objectBox({ t: 33, x: 20, y: 0, p: p }, 0.5);
    const atFull = P.objectBox({ t: 33, x: 20, y: 0, p: p }, 2);
    assert.ok(Math.abs(at0.x - 20) < 0.01, 'starts at rest position');
    assert.ok(Math.abs(atQuarter.x - 24) < 0.01, 'quarter period later it swept +amp, x=' + atQuarter.x);
    assert.ok(Math.abs(atFull.x - 20) < 0.01, 'full period later it is back, x=' + atFull.x);
  });

  it('objectdefs: every def is well-formed', function () {
    const seen = new Set();
    for (const def of GD.objectdefs.list) {
      assert.ok(def.id > 0 && !seen.has(def.id), 'unique id: ' + def.id);
      seen.add(def.id);
      assert.ok(def.key && def.name, 'named');
      assert.ok(def.w > 0 && def.h > 0, 'has size');
      assert.ok(def.cat, 'has category');
      if (def.hitbox) {
        assert.ok(['tri', 'tri2', 'circle', 'box'].includes(def.hitbox.type), 'hitbox type');
      }
      assert.strictEqual(GD.objectdefs.getDef(def.id).id, def.id);
    }
    assert.ok(GD.objectdefs.list.length >= 50, 'large asset library, got ' + GD.objectdefs.list.length);
    assert.ok(GD.objectdefs.CATEGORIES.length >= 7, 'categories');
  });

  it('movement pack/unpack round-trips', function () {
    const cases = [[3, 2, 0, 0], [5, 1.5, 1, 1], [10, 4, 2, 0], [2, 0.5, 3, 1]];
    for (const [amp, period, phase, axis] of cases) {
      const p = GD.objectdefs.packMovement(amp, period, phase, axis);
      const m = GD.objectdefs.unpackMovement(p);
      assert.strictEqual(m.amp, amp);
      assert.strictEqual(m.axis, axis);
    }
  });
});

describe('rng', function () {
  it('same seed -> same sequence', function () {
    const a = GD.rng.createRandom(GD.rng.seedFromString('neon'));
    const b = GD.rng.createRandom(GD.rng.seedFromString('neon'));
    for (let i = 0; i < 50; i++) assert.strictEqual(a(), b());
  });
  it('different seeds -> different sequences', function () {
    const a = GD.rng.createRandom(GD.rng.seedFromString('neon'));
    const b = GD.rng.createRandom(GD.rng.seedFromString('dash'));
    const seq = Array.from({ length: 10 }, () => a() === b());
    assert.ok(seq.some(x => !x));
  });
  it('values are in [0, 1)', function () {
    const r = GD.rng.createRandom(12345);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      assert.ok(v >= 0 && v < 1);
    }
  });
  it('roughly uniform', function () {
    const r = GD.rng.createRandom(42);
    let buckets = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) buckets[Math.min(3, Math.floor(r() * 4))]++;
    for (const b of buckets) assert.ok(b > 800 && b < 1200, 'bucket=' + b);
  });
});

describe('i18n', function () {
  it('every language defines exactly the same key set as English', function () {
    const en = GD.i18n.keySet('en');
    assert.ok(en.length >= 40, 'substantial dictionary, got ' + en.length);
    for (const lang of GD.i18n.SUPPORTED) {
      const keys = GD.i18n.keySet(lang.code);
      assert.deepStrictEqual(keys, en, 'key set mismatch in ' + lang.code);
    }
  });
  it('setLanguage + t translate and fall back to English', function () {
    assert.strictEqual(GD.i18n.setLanguage('zz'), false);
    const ok = GD.i18n.setLanguage('en');
    assert.strictEqual(ok, true);
    const enText = GD.i18n.t('menu.play');
    const other = GD.i18n.SUPPORTED.find(l => l.code !== 'en');
    GD.i18n.setLanguage(other.code);
    const otherText = GD.i18n.t('menu.play');
    assert.strictEqual(typeof enText, 'string');
    assert.ok(enText.length > 0);
    // Spanish/German either translate or fall back — never leak the key
    assert.ok(otherText !== 'menu.play', 'key must resolve, got raw key');
    GD.i18n.setLanguage('en');
    assert.strictEqual(GD.i18n.t('nonexistent.key.xyz'), 'nonexistent.key.xyz', 'unknown keys echo');
  });
});

describe('storage', function () {
  beforeEach(function () {
    GD.__testStorage = makeMem();
  });
  afterEach(function () { GD.__testStorage = null; });
  function makeMem() {
    const mem = new Map();
    return {
      getItem: k => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: k => mem.delete(k),
      key: i => Array.from(mem.keys())[i],
      length: mem.size
    };
  }

  it('settings default and merge', function () {
    const s = GD.storage.getSettings();
    assert.strictEqual(s.lang, 'en');
    assert.ok(s.musicVol >= 0 && s.musicVol <= 1);
    assert.ok(s.sfxVol >= 0 && s.sfxVol <= 1);
    assert.strictEqual(s.vibration, true);
    GD.storage.saveSettings({ lang: 'es' });
    const s2 = GD.storage.getSettings();
    assert.strictEqual(s2.lang, 'es');
    assert.strictEqual(s2.nickname, s.nickname, 'unrelated key keeps default');
    GD.storage.saveSettings({ evil: 1 });       // unknown keys are dropped
    assert.strictEqual(GD.storage.getSettings().evil, undefined);
  });

  it('custom levels: save, update, delete', function () {
    const a = GD.storage.saveCustomLevel({ name: 'A', code: 'NDL1:x' });
    assert.ok(a.id, 'assigned id');
    GD.storage.saveCustomLevel({ name: 'B', code: 'NDL1:y' });
    assert.strictEqual(GD.storage.getCustomLevels().length, 2);
    const updated = GD.storage.saveCustomLevel({ id: a.id, name: 'A2', code: 'NDL1:z' });
    assert.strictEqual(updated.id, a.id);
    const list = GD.storage.getCustomLevels();
    assert.strictEqual(list.length, 2, 'update in place, not append');
    assert.strictEqual(list.find(l => l.id === a.id).name, 'A2');
    assert.strictEqual(GD.storage.deleteCustomLevel(a.id), true);
    assert.strictEqual(GD.storage.getCustomLevels().length, 1);
    assert.strictEqual(GD.storage.deleteCustomLevel('nope'), false);
  });

  it('survives a missing backend (private mode)', function () {
    GD.__testStorage = { getItem: () => { throw new Error('blocked'); },
                         setItem: () => { throw new Error('blocked'); },
                         removeItem: () => {} };
    assert.strictEqual(GD.storage.available(), false);
    assert.strictEqual(GD.storage.get('settings', 'fallback'), 'fallback');
    assert.strictEqual(GD.storage.set('x', 1), false);
    assert.doesNotThrow(() => GD.storage.getSettings());
  });
});

describe('official levels', function () {
  it('there are exactly 4 official levels and they decode', function () {
    const list = GD.official.levels;
    assert.strictEqual(list.length, 4);
    for (const entry of list) {
      const lv = GD.encoding.decode(entry.code);
      assert.strictEqual(lv.name, entry.name);
      assert.ok(lv.objects.length > 40, entry.id + ' has objects');
      assert.ok(lv.length >= 200 && lv.length <= 420, entry.id + ' length ' + lv.length);
    }
  });

  it('the verification bot completes every official level', function () {
    for (const entry of GD.official.levels) {
      const lv = GD.encoding.decode(entry.code);
      const res = GD.bot.simulate(lv, 5);
      assert.ok(res.completed, entry.name + ' must be completable: ' + JSON.stringify(res));
      assert.strictEqual(res.progress, 1);
      assert.ok(res.attempts <= 5);
    }
  });

  it('difficulty order and stars increase', function () {
    const list = GD.official.levels;
    for (let i = 1; i < list.length; i++) {
      assert.ok(list[i].difficulty >= list[i - 1].difficulty, 'non-decreasing difficulty');
      assert.ok(list[i].stars > list[i - 1].stars, 'increasing stars');
    }
  });
});
