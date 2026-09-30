/**
 * Neon Dash — collision geometry.
 *
 * Pure functions: axis-aligned boxes, triangles (spikes), circles (saws/mines)
 * and the classification of player-vs-solid contacts into LAND / CRUSH / TOUCH.
 * No state, no DOM — 100% unit-testable.
 */
/* global GD */
GD.register('collision', function () {
  'use strict';

  var collision = {};

  /** Box: {x, y, w, h} with (x,y) = bottom-left. */
  function Box(x, y, w, h) {
    return { x: x, y: y, w: w, h: h };
  }
  collision.Box = Box;

  collision.aabbOverlap = function (a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  };

  /** Signed overlap depth between two boxes (positive when overlapping). */
  collision.aabbOverlapDepth = function (a, b) {
    var dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    var dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    return { x: dx, y: dy };
  };

  /**
   * Point-in-triangle (barycentric technique).
   * tri = {ax,ay, bx,by, cx,cy} counter-clockwise or clockwise.
   */
  collision.pointInTriangle = function (px, py, tri) {
    var d1 = (px - tri.bx) * (tri.ay - tri.by) - (tri.ax - tri.bx) * (py - tri.by);
    var d2 = (px - tri.cx) * (tri.by - tri.cy) - (tri.bx - tri.cx) * (py - tri.cy);
    var d3 = (px - tri.ax) * (tri.cy - tri.ay) - (tri.cx - tri.ax) * (py - tri.ay);
    var hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
    var hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
    return !(hasNeg && hasPos);
  };

  /**
   * Triangle (spike) vs box, with a shrink factor applied to the box first —
   * spikes use forgiving hitboxes exactly like Geometry Dash.
   * tri = {x, y, w, h, dir} where dir: 0=point up, 1=right, 2=down, 3=left.
   */
  collision.triBoxOverlap = function (tri, box, shrink) {
    shrink = shrink || 0;
    var b = Box(box.x + shrink, box.y + shrink, box.w - 2 * shrink, box.h - 2 * shrink);
    if (!collision.aabbOverlap(tri, b)) return false;
    // Build the triangle. Base spans the full width; tip is centred.
    var x0 = tri.x, x1 = tri.x + tri.w, xm = tri.x + tri.w / 2;
    var y0 = tri.y, y1 = tri.y + tri.h, ym = tri.y + tri.h / 2;
    var T;
    if (tri.dir === 0)      T = { ax: x0, ay: y0, bx: x1, by: y0, cx: xm, cy: y1 };
    else if (tri.dir === 2) T = { ax: x0, ay: y1, bx: x1, by: y1, cx: xm, cy: y0 };
    else if (tri.dir === 1) T = { ax: x0, ay: y0, bx: x0, by: y1, cx: x1, cy: ym };
    else                    T = { ax: x1, ay: y0, bx: x1, by: y1, cx: x0, cy: ym };
    // Test the four box corners against the triangle, plus the triangle
    // centroid against the box — together these catch every overlap for
    // these convex, similarly-shaped shapes.
    var pts = [
      [b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]
    ];
    for (var i = 0; i < pts.length; i++) {
      if (collision.pointInTriangle(pts[i][0], pts[i][1], T)) return true;
    }
    var gx = (T.ax + T.bx + T.cx) / 3, gy = (T.ay + T.by + T.cy) / 3;
    if (gx >= b.x && gx <= b.x + b.w && gy >= b.y && gy <= b.y + b.h) return true;
    // Edge midpoints too (catches thin spikes through box centres).
    pts = [
      [b.x + b.w / 2, b.y], [b.x + b.w / 2, b.y + b.h],
      [b.x, b.y + b.h / 2], [b.x + b.w, b.y + b.h / 2]
    ];
    for (i = 0; i < pts.length; i++) {
      if (collision.pointInTriangle(pts[i][0], pts[i][1], T)) return true;
    }
    return false;
  };

  /** Circle vs box. circle = {x, y, r} with (x,y) = centre. */
  collision.circleBoxOverlap = function (c, box) {
    var nx = Math.max(box.x, Math.min(c.x, box.x + box.w));
    var ny = Math.max(box.y, Math.min(c.y, box.y + box.h));
    var dx = c.x - nx, dy = c.y - ny;
    return dx * dx + dy * dy <= c.r * c.r;
  };

  /** Two circles. */
  collision.circleOverlap = function (a, b) {
    var dx = a.x - b.x, dy = a.y - b.y, rr = a.r + b.r;
    return dx * dx + dy * dy <= rr * rr;
  };

  /**
   * Classify a player contact with a solid block (Geometry Dash rules):
   *
   *   'land'  — the player approached the walkable face from the correct side
   *             while moving towards it -> snap on top of it
   *   'crush' — the player ran into a wall / underside -> death
   *   'none'  — boxes do not overlap
   *
   * gravity: +1 normal (walk on top of blocks), -1 inverted (walk under).
   */
  collision.classifySolid = function (player, prevBottom, block, gravity, landTolerance) {
    landTolerance = landTolerance === undefined ? 0.14 : landTolerance;
    var depth = collision.aabbOverlapDepth(player, block);
    if (depth.x <= 0 || depth.y <= 0) return 'none';
    if (gravity > 0) {
      // Walking on top of the block: previous frame the player's feet were at
      // or above the block surface (within tolerance) OR penetration is tiny.
      var top = block.y + block.h;
      if (prevBottom >= top - landTolerance || (player.y > top - landTolerance && depth.y <= landTolerance + 0.02)) {
        return 'land';
      }
    } else {
      var bottom = block.y;
      if (prevBottom + player.h <= bottom + landTolerance || (player.y + player.h < bottom + landTolerance && depth.y <= landTolerance + 0.02)) {
        return 'land';
      }
    }
    return 'crush';
  };

  return collision;
});
