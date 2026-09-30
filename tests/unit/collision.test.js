/**
 * UNIT TESTS — collision geometry.
 */
'use strict';
const assert = require('assert');
const { loadGame } = require('../loader.js');

const sb = loadGame();
const GD = sb.GD;
const C = GD.collision;

describe('collision', function () {

  it('aabbOverlap detects overlaps and non-overlaps', function () {
    assert.strictEqual(C.aabbOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 0.5, y: 0.5, w: 1, h: 1 }), true);
    assert.strictEqual(C.aabbOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 0, w: 1, h: 1 }), false, 'touching edges are not overlapping');
    assert.strictEqual(C.aabbOverlap({ x: 0, y: 0, w: 1, h: 1 }, { x: 2, y: 2, w: 1, h: 1 }), false);
  });

  it('pointInTriangle works for all windings', function () {
    const up = { ax: 0, ay: 0, bx: 2, by: 0, cx: 1, cy: 2 };
    assert.strictEqual(C.pointInTriangle(1, 0.5, up), true);
    assert.strictEqual(C.pointInTriangle(1, 1.9, up), true);
    assert.strictEqual(C.pointInTriangle(1, 2.1, up), false);
    assert.strictEqual(C.pointInTriangle(-0.1, 0.5, up), false);
    assert.strictEqual(C.pointInTriangle(0.01, 0.01, up), true);
  });

  it('triBoxOverlap: jumping over a spike must NOT collide (regression)', function () {
    // Player bottom at 1.1 above a ground spike whose tip is at y=1:
    // the boxes overlap in x/y but the triangle must not hit the player.
    const spike = { x: 10, y: 0, w: 1, h: 1, dir: 0 };
    const player = { x: 9.7, y: 1.1, w: 0.5, h: 0.5 };
    assert.strictEqual(C.triBoxOverlap(spike, player, 0.06), false,
      'player above the spike tip must be safe');
  });

  it('triBoxOverlap: landing on a spike kills', function () {
    const spike = { x: 10, y: 0, w: 1, h: 1, dir: 0 };
    const player = { x: 9.8, y: 0.3, w: 0.5, h: 0.5 };
    assert.strictEqual(C.triBoxOverlap(spike, player, 0.06), true);
  });

  it('triBoxOverlap: rotated spikes point the right way', function () {
    // dir=2 (pointing down, ceiling spike): hitting it from below kills,
    // standing above its tip (on the ceiling) is safe.
    const spike = { x: 10, y: 13, w: 1, h: 1, dir: 2 };
    assert.strictEqual(C.triBoxOverlap(spike, { x: 9.8, y: 13.4, w: 0.5, h: 0.5 }, 0.06), true);
    assert.strictEqual(C.triBoxOverlap(spike, { x: 9.8, y: 11.9, w: 0.5, h: 0.5 }, 0.06), false);
  });

  it('circleBoxOverlap', function () {
    const box = { x: 0, y: 0, w: 2, h: 2 };
    assert.strictEqual(C.circleBoxOverlap({ x: 2.5, y: 1, r: 0.9 }, box), true);
    assert.strictEqual(C.circleBoxOverlap({ x: 3, y: 1, r: 0.9 }, { x: 0, y: 0, w: 1, h: 2 }), false);
    assert.strictEqual(C.circleBoxOverlap({ x: 1, y: 1, r: 0.1 }, box), true);
  });

  it('classifySolid: landing on top vs crashing into a wall', function () {
    const block = { x: 10, y: 0, w: 1, h: 1 };
    // sinking 0.01 into the top from above (previous frame feet were above)
    assert.strictEqual(C.classifySolid({ x: 9.5, y: 0.99, w: 1, h: 1 }, 1.05, block, 1), 'land');
    // running into the side of a raised block
    assert.strictEqual(C.classifySolid({ x: 9.2, y: 0, w: 1, h: 1 }, 0, block, 1), 'crush');
    // inverted gravity: walking on a block's underside (penetrating bottom face)
    assert.strictEqual(C.classifySolid({ x: 9.5, y: -0.99, w: 1, h: 1 }, -0.95, block, -1), 'land');
    // no overlap
    assert.strictEqual(C.classifySolid({ x: 5, y: 0, w: 1, h: 1 }, 0, block, 1), 'none');
  });

  it('classifySolid: corner clipping is forgiving (GD-style)', function () {
    const block = { x: 10, y: 0, w: 1, h: 1 };
    // sinking just 0.1 into the block corner while moving over it -> land
    assert.strictEqual(C.classifySolid({ x: 9.5, y: 0.92, w: 1, h: 1 }, 0.98, block, 1), 'land');
  });
});
