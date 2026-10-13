import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSheet, buildSpecs, rasterize, PALETTE, PALETTE_KEYS } from '../src/sprites.js';
import { TOOLS } from '../src/tools.js';
import { ROLE_LABELS } from '../src/ant.js';

test('palette has at most 32 colours and valid hex values', () => {
  assert.ok(PALETTE_KEYS.length <= 32);
  for (const hex of Object.values(PALETTE)) assert.match(hex, /^#[0-9a-f]{6}$/);
});

test('every tool icon exists in the atlas', () => {
  const sheet = buildSheet();
  for (const tool of TOOLS) assert.ok(sheet.frames[tool.icon], `missing icon ${tool.icon}`);
});

test('every ant role has walk frames', () => {
  const sheet = buildSheet();
  for (const role of Object.keys(ROLE_LABELS)) {
    if (role === 'queen') continue;
    assert.ok(sheet.frames[`ant_${role}_0`], `missing ant_${role}_0`);
    assert.ok(sheet.frames[`ant_${role}_1`], `missing ant_${role}_1`);
  }
});

test('atlas frames are inside the atlas and do not overlap', () => {
  const sheet = buildSheet();
  const boxes = Object.values(sheet.frames);
  for (const f of boxes) {
    assert.ok(f.x >= 0 && f.y >= 0 && f.x + f.w <= sheet.width && f.y + f.h <= sheet.height);
  }
  for (let a = 0; a < boxes.length; a++) {
    for (let b = a + 1; b < boxes.length; b++) {
      const A = boxes[a];
      const B = boxes[b];
      const overlap = A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h;
      assert.ok(!overlap, 'sprite frames overlap');
    }
  }
});

test('sprites are not empty and have an ink outline', () => {
  const specs = buildSpecs();
  const grid = rasterize(specs.ant_worker_0);
  assert.ok(grid.some((c) => c !== null));
  assert.ok(grid.some((c) => c === 'ink'));
});
