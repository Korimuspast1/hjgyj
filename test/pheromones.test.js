import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../src/world.js';
import { Pheromones, LAYER } from '../src/pheromones.js';
import { PHEROMONE_MAX } from '../src/config.js';

function openWorld() {
  const w = new World(20, 20);
  w.resetToFormicarium();
  w.type.fill(0); // all air, glass border
  for (let x = 0; x < 20; x++) { w.setIndex(w.index(x, 0), 6); w.setIndex(w.index(x, 19), 6); }
  for (let y = 0; y < 20; y++) { w.setIndex(w.index(0, y), 6); w.setIndex(w.index(19, y), 6); }
  return w;
}

test('deposit adds and caps at PHEROMONE_MAX', () => {
  const p = new Pheromones(20, 20);
  const i = 5 * 20 + 5;
  p.deposit(LAYER.FOOD, i, 60);
  p.deposit(LAYER.FOOD, i, 60);
  assert.equal(p.get(LAYER.FOOD, i), PHEROMONE_MAX);
  assert.equal(p.get(LAYER.HOME, i), 0);
});

test('evaporation multiplies by 0.99 on ticks without diffusion', () => {
  const w = openWorld();
  const p = new Pheromones(20, 20);
  const i = 10 * 20 + 10;
  p.deposit(LAYER.HOME, i, 10);
  p.update(w); // updates=0 -> diffusion tick
  p.deposit(LAYER.HOME, i, 0);
  const before = p.get(LAYER.HOME, i);
  p.update(w); // updates=1 -> no diffusion; only evaporation
  assert.ok(Math.abs(p.get(LAYER.HOME, i) - before * 0.99) < 1e-4);
});

test('diffusion spreads to neighbours and first tick matches the formula', () => {
  const w = openWorld();
  const p = new Pheromones(20, 20);
  const i = 10 * 20 + 10;
  p.deposit(LAYER.DANGER, i, 10);
  p.update(w);
  // centre: (10 + 0.05*(0 - 4*10)) * 0.99 = 7.92; neighbour: 0.05*10 * 0.99 = 0.495
  assert.ok(Math.abs(p.get(LAYER.DANGER, i) - 7.92) < 1e-4);
  assert.ok(Math.abs(p.get(LAYER.DANGER, i + 1) - 0.495) < 1e-4);
});

test('solid cells and the border never hold pheromone', () => {
  const w = openWorld();
  const p = new Pheromones(20, 20);
  p.deposit(LAYER.EXPLORE, 0, 50); // glass border
  w.setIndex(10 * 20 + 10, 1); // sand
  p.deposit(LAYER.EXPLORE, 10 * 20 + 10, 50);
  p.update(w);
  assert.equal(p.get(LAYER.EXPLORE, 0), 0);
  assert.equal(p.get(LAYER.EXPLORE, 10 * 20 + 10), 0);
});

test('tiny values are cleared so the field does not hold dust forever', () => {
  const w = openWorld();
  const p = new Pheromones(20, 20);
  p.deposit(LAYER.HOME, 10 * 20 + 10, 0.01);
  p.update(w);
  assert.equal(p.get(LAYER.HOME, 10 * 20 + 10), 0);
});

test('empty layers are skipped and stay inactive', () => {
  const w = openWorld();
  const p = new Pheromones(20, 20);
  p.update(w);
  assert.deepEqual(Array.from(p.active), [0, 0, 0, 0]);
});
