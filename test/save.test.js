import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeGame, deserializeGame, encodeBytes, decodeBytes } from '../src/save.js';
import { makeColonyGame, addWorkers } from './helpers.js';

/** Serialised form without fields that legitimately change on load or with wall-clock time. */
function normalised(game) {
  const data = JSON.parse(JSON.stringify(serializeGame(game)));
  data.savedAt = '';
  data.stats.tickMs = 0;
  // Paths are recomputed on load, so their cached goal fields reset.
  for (const list of [data.ants, data.enemies]) {
    for (const e of list) {
      e.pathGoalX = -1;
      e.pathGoalY = -1;
    }
  }
  return data;
}

test('base64 round trip for typed arrays', () => {
  const src = Uint8Array.from([0, 1, 2, 250, 255]);
  assert.deepEqual(Array.from(decodeBytes(encodeBytes(src))), Array.from(src));
});

test('save and load reproduce the same state and keep running identically', () => {
  const g = makeColonyGame(21);
  addWorkers(g, 25);
  g.applyTool('leaf', 200, 52);
  for (let t = 0; t < 300; t++) g.step();

  const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(g))));
  assert.deepEqual(normalised(loaded), normalised(g));
  assert.equal(loaded.ants.length, g.ants.length);

  for (let t = 0; t < 100; t++) {
    g.step();
    loaded.step();
  }
  assert.equal(loaded.ants.length, g.ants.length);
  assert.equal(loaded.tick, g.tick);
});

test('loaded queens are linked to their colony again', () => {
  const g = makeColonyGame(22);
  const loaded = deserializeGame(JSON.parse(JSON.stringify(serializeGame(g))));
  assert.ok(loaded.colonies[0].queen);
  assert.equal(loaded.colonies[0].queen.role, 'queen');
  assert.ok(loaded.ants.includes(loaded.colonies[0].queen));
});

test('unknown save versions are rejected', () => {
  const data = serializeGame(makeColonyGame(23));
  data.version = 999;
  assert.throws(() => deserializeGame(data), /Unsupported save version/);
});

test('mismatched world size is rejected', () => {
  const data = serializeGame(makeColonyGame(24));
  data.world.width = 10;
  assert.throws(() => deserializeGame(data), /world size/);
});
