import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { CELL, ANT_PASSABLE } from '../src/world.js';
import { makeColonyGame, addWorkers, emptyWorld } from './helpers.js';

test('a new game is empty: no ants, enemies, food or brood', () => {
  const g = new Game(1);
  assert.equal(g.ants.length, 0);
  assert.equal(g.enemies.length, 0);
  assert.equal(g.brood.length, 0);
  assert.equal(g.world.countTypes().Food, 0);
});

test('the queen spawns with a chamber and a shaft to the surface', () => {
  const g = makeColonyGame(3);
  const queen = g.colonies[0].queen;
  assert.ok(queen && queen.alive && queen.role === 'queen');
  const counts = g.world.countTypes();
  assert.ok(counts.Chamber > 10);
  assert.ok(counts.Tunnel > 0);
});

test('spawning a second queen is refused', () => {
  const g = makeColonyGame(3);
  assert.equal(g.spawnQueen(200, 120), false);
});

test('killAnt marks the ant dead and removeDead drops it from the list', () => {
  const g = makeColonyGame(4);
  addWorkers(g, 3);
  const victim = g.ants[1];
  g.killAnt(victim, 'test');
  g.step();
  assert.ok(!g.ants.includes(victim));
});

test('applyTool paints terrain and erasing restores air', () => {
  const g = new Game(5);
  g.ui.tool = 'rock';
  g.ui.brush = 0;
  g.applyTool('rock', 100, 100);
  assert.equal(g.world.typeAt(100, 100), CELL.ROCK);
  g.eraseAt(100, 100);
  assert.equal(g.world.typeAt(100, 100), CELL.EMPTY);
});

test('integration: 100 ants run 1000 ticks without crashing and keep invariants', () => {
  const g = makeColonyGame(11);
  const placed = addWorkers(g, 100);
  assert.ok(placed >= 90, `only ${placed} ants placed`);
  // Some food on the surface so foraging can start.
  g.applyTool('seed', 200, 52);
  g.applyTool('leaf', 300, 52);
  for (let t = 0; t < 1000; t++) g.step();
  assert.equal(g.tick, 1000);
  for (const ant of g.ants) {
    if (!ant.alive) continue;
    assert.ok(g.world.inBounds(ant.x, ant.y));
    assert.ok(ANT_PASSABLE[g.world.typeAt(ant.x, ant.y)], `ant on impassable cell ${g.world.typeAt(ant.x, ant.y)}`);
  }
  assert.ok(g.colonies[0].stats.born >= 100);
});

test('enemies hunt and fight: a raider next to a worker causes damage', () => {
  const g = emptyWorld(new Game(9));
  for (let x = 1; x <= 478; x++) for (let y = 60; y <= 268; y++) g.world.setCell(x, y, CELL.SAND, 255);
  for (let x = 100; x <= 110; x++) g.world.setCell(x, 59, CELL.EMPTY);
  g.refreshSurface();
  const worker = g.spawnAnt(1, 105, 58, 'worker');
  const raider = g.spawnEnemy('raider', 106, 58);
  const startHp = worker.hp;
  for (let t = 0; t < 40; t++) g.step();
  assert.ok(worker.hp < startHp || !worker.alive || raider.hp < raider.maxHp);
});
