import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeColonyGame, addWorkers } from './helpers.js';

/**
 * Performance guard. The target is 60 FPS with at least 100 ants on a mid laptop,
 * so one simulation tick must stay far below the 50 ms budget of a 20 Hz tick.
 * The threshold is generous so the test does not flake on slow CI machines.
 */
test('200 ants: average tick time stays well inside the 20 Hz budget', () => {
  const g = makeColonyGame(31);
  const placed = addWorkers(g, 200);
  assert.ok(placed >= 180, `only ${placed} ants placed`);
  for (let t = 0; t < 50; t++) g.step(); // warm-up
  const ticks = 300;
  const start = performance.now();
  for (let t = 0; t < ticks; t++) g.step();
  const avg = (performance.now() - start) / ticks;
  console.log(`  200 ants: ${avg.toFixed(2)} ms per tick, ${g.ants.length} living`);
  assert.ok(avg < 25, `average tick ${avg.toFixed(2)} ms is too slow`);
});
