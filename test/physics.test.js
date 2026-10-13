import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, CELL } from '../src/world.js';
import { stepPhysics, stepCaveIns } from '../src/physics.js';
import { Random } from '../src/utils.js';

const noHooks = { occupiedAt: () => false, onCrush() {}, onDrown() {}, onCollapse() {} };

function box(w, h) {
  const world = new World(w, h);
  world.type.fill(CELL.EMPTY);
  for (let x = 0; x < w; x++) {
    world.setIndex(world.index(x, 0), CELL.GLASS);
    world.setIndex(world.index(x, h - 1), CELL.GLASS);
  }
  for (let y = 0; y < h; y++) {
    world.setIndex(world.index(0, y), CELL.GLASS);
    world.setIndex(world.index(w - 1, y), CELL.GLASS);
  }
  return world;
}

test('a loose sand grain falls into empty space below', () => {
  const w = box(12, 12);
  w.setIndex(w.index(6, 3), CELL.SAND, 255);
  stepPhysics(w, new Random(1), noHooks, 1);
  assert.equal(w.typeAt(6, 3), CELL.EMPTY);
  assert.equal(w.typeAt(6, 4), CELL.SAND);
});

test('sand does not fall into a chamber it sits above (thick ceiling)', () => {
  const w = box(12, 12);
  for (let x = 1; x <= 10; x++) for (let y = 2; y <= 9; y++) w.setIndex(w.index(x, y), CELL.SAND, 255);
  for (let x = 4; x <= 7; x++) for (let y = 6; y <= 7; y++) w.setIndex(w.index(x, y), CELL.CHAMBER);
  for (let tick = 1; tick <= 30; tick++) stepPhysics(w, new Random(tick), noHooks, tick);
  for (let x = 4; x <= 7; x++) for (let y = 6; y <= 7; y++) assert.equal(w.typeAt(x, y), CELL.CHAMBER);
});

test('a thin ceiling over a chamber may cave in (cave-ins are allowed to fill voids)', () => {
  const w = box(12, 12);
  for (let x = 1; x <= 10; x++) for (let y = 5; y <= 9; y++) w.setIndex(w.index(x, y), CELL.SAND, 255);
  for (let x = 4; x <= 7; x++) w.setIndex(w.index(x, 6), CELL.CHAMBER);
  let collapses = 0;
  const hooks = { ...noHooks, onCollapse: () => collapses++ };
  for (let tick = 1; tick <= 200; tick++) stepPhysics(w, new Random(tick), hooks, tick);
  assert.ok(collapses > 0);
});

test('water falls and reports drowning of an occupant', () => {
  const w = box(12, 12);
  w.setIndex(w.index(6, 2), CELL.WATER, 255);
  let drowned = -1;
  const hooks = { ...noHooks, occupiedAt: (i) => i === w.index(6, 3), onDrown: (i) => (drowned = i) };
  stepPhysics(w, new Random(2), hooks, 1);
  assert.equal(w.typeAt(6, 3), CELL.WATER);
  assert.equal(drowned, w.index(6, 3));
});

test('unsupported sand eventually collapses and reports it', () => {
  const w = box(12, 12);
  w.setIndex(w.index(6, 5), CELL.SAND, 255); // in mid-air: no solid neighbours
  let collapses = 0;
  const hooks = { ...noHooks, onCollapse: () => collapses++ };
  for (let t = 1; t <= 60 && collapses === 0; t++) stepCaveIns(w, new Random(t), hooks);
  assert.ok(collapses >= 1);
});

test('food falls but never slides sideways', () => {
  const w = box(12, 12);
  w.setIndex(w.index(6, 3), CELL.FOOD, 6, 1);
  stepPhysics(w, new Random(5), noHooks, 1);
  assert.equal(w.typeAt(6, 4), CELL.FOOD);
  assert.equal(w.typeAt(6, 3), CELL.EMPTY);
});
