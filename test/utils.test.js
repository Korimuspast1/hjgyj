import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Random, hash2, clamp, chebyshev, manhattan, lineCells } from '../src/utils.js';

test('Random is deterministic for the same seed', () => {
  const a = new Random(123);
  const b = new Random(123);
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
});

test('Random.next stays in [0,1) and int(n) in [0,n)', () => {
  const r = new Random(7);
  for (let i = 0; i < 5000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
    const n = r.int(9);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 9);
  }
});

test('Random.range respects bounds and chance is roughly calibrated', () => {
  const r = new Random(99);
  let hits = 0;
  for (let i = 0; i < 20000; i++) {
    const v = r.range(2, 5);
    assert.ok(v >= 2 && v < 5);
    if (r.chance(0.25)) hits++;
  }
  assert.ok(Math.abs(hits / 20000 - 0.25) < 0.02);
});

test('hash2 is deterministic and in [0,1)', () => {
  assert.equal(hash2(3, 4), hash2(3, 4));
  for (let x = 0; x < 50; x++) {
    const h = hash2(x, 7);
    assert.ok(h >= 0 && h < 1);
  }
});

test('clamp, chebyshev, manhattan', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(chebyshev(0, 0, 3, -4), 4);
  assert.equal(manhattan(0, 0, 3, -4), 7);
});

test('lineCells includes both endpoints and is connected', () => {
  const cells = lineCells(0, 0, 5, 2);
  assert.deepEqual(cells[0], [0, 0]);
  assert.deepEqual(cells[cells.length - 1], [5, 2]);
  for (let i = 1; i < cells.length; i++) {
    assert.ok(chebyshev(cells[i][0], cells[i][1], cells[i - 1][0], cells[i - 1][1]) === 1);
  }
});
