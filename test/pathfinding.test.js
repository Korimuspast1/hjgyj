import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World, CELL } from '../src/world.js';
import { Pathfinder } from '../src/pathfinding.js';

/** 30x12 world: sand everywhere, with a tunnel corridor on row 6. */
function corridorWorld() {
  const w = new World(30, 12);
  w.type.fill(CELL.SAND);
  for (let x = 0; x < 30; x++) {
    w.setIndex(w.index(x, 0), CELL.GLASS);
    w.setIndex(w.index(x, 11), CELL.GLASS);
  }
  for (let y = 0; y < 12; y++) {
    w.setIndex(w.index(0, y), CELL.GLASS);
    w.setIndex(w.index(29, y), CELL.GLASS);
  }
  for (let x = 2; x <= 27; x++) w.setIndex(w.index(x, 6), CELL.TUNNEL);
  return w;
}

test('finds a straight path along a tunnel corridor', () => {
  const w = corridorWorld();
  const pf = new Pathfinder(w);
  const path = pf.find(3, 6, 20, 6);
  assert.ok(Array.isArray(path));
  assert.equal(path[path.length - 1], w.index(20, 6));
  assert.equal(path.length, 17);
});

test('path is 8-connected and never crosses solid cells', () => {
  const w = corridorWorld();
  // Open a side branch so the path must turn.
  for (let y = 3; y <= 6; y++) w.setIndex(w.index(10, y), CELL.TUNNEL);
  const pf = new Pathfinder(w);
  const path = pf.find(3, 6, 10, 3); // goal is the side branch (tunnel)
  assert.ok(path && path.length > 0);
  let prev = w.index(3, 6);
  for (const i of path) {
    const dx = Math.abs(w.xOf(i) - w.xOf(prev));
    const dy = Math.abs(w.yOf(i) - w.yOf(prev));
    assert.ok(dx <= 1 && dy <= 1 && dx + dy > 0);
    assert.ok(w.canAntEnter(w.xOf(i), w.yOf(i)), `cell ${w.xOf(i)},${w.yOf(i)} is not passable`);
    prev = i;
  }
});

test('returns null when the goal is unreachable', () => {
  const w = corridorWorld();
  w.setIndex(w.index(15, 6), CELL.ROCK); // cut the corridor
  const pf = new Pathfinder(w);
  assert.equal(pf.find(3, 6, 20, 6), null);
});

test('respects the node budget', () => {
  const w = corridorWorld();
  const pf = new Pathfinder(w);
  assert.equal(pf.find(3, 6, 20, 6, { maxNodes: 2 }), null);
});

test('goal radius counts as arrival: no steps are needed inside the radius', () => {
  const w = corridorWorld();
  const pf = new Pathfinder(w);
  const path = pf.find(3, 6, 6, 6, { radius: 3 });
  assert.ok(Array.isArray(path));
  assert.equal(path.length, 0);
});
