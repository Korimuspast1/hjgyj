import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, CELL, FOOD_KIND } from '../src/world.js';
import { SURFACE_Y } from '../src/config.js';

test('formicarium starts with glass walls, air above and sand below', () => {
  const w = new World();
  w.resetToFormicarium();
  assert.equal(w.typeAt(0, 100), CELL.GLASS);
  assert.equal(w.typeAt(w.width - 1, 100), CELL.GLASS);
  assert.equal(w.typeAt(100, 0), CELL.GLASS);
  assert.equal(w.typeAt(100, w.height - 1), CELL.GLASS);
  assert.equal(w.typeAt(100, SURFACE_Y - 1), CELL.EMPTY);
  assert.equal(w.typeAt(100, SURFACE_Y), CELL.SAND);
  const counts = w.countTypes();
  assert.equal(counts.Food, 0);
  assert.equal(counts.Tunnel, 0);
  assert.equal(counts.Chamber, 0);
  assert.equal(counts.Water, 0);
});

test('out-of-bounds reads behave like glass', () => {
  const w = new World(10, 10);
  assert.equal(w.typeAt(-1, 3), CELL.GLASS);
  assert.equal(w.typeAt(3, 10), CELL.GLASS);
});

test('canAntEnter rejects water and solid cells, allows tunnels', () => {
  const w = new World(10, 10);
  w.resetToFormicarium();
  w.setCell(5, 5, CELL.WATER);
  assert.equal(w.canAntEnter(5, 5), false);
  w.setCell(5, 5, CELL.TUNNEL);
  assert.equal(w.canAntEnter(5, 5), true);
  w.setCell(4, 4, CELL.SAND);
  w.setCell(5, 4, CELL.EMPTY);
  assert.equal(w.canAntEnter(5, 4), true);
});

test('setIndex clears moisture for non-soil and stores food kind', () => {
  const w = new World(10, 10);
  w.setIndex(12, CELL.FOOD, 6, FOOD_KIND.SUGAR);
  assert.equal(w.subtype[12], FOOD_KIND.SUGAR);
  assert.equal(w.density[12], 6);
});
