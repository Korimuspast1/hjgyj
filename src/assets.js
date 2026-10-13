/**
 * Sprite assets, generated from src/sprites.js when the game starts.
 *
 * The code is the only source of sprite art. assets/atlas.png is still written by
 * `npm run build:atlas` for external use, but the game does not load it: a stale
 * or cached copy of the PNG and JSON can disagree with each other and show
 * garbled icons and ants. Generating the sprites takes a few milliseconds.
 */
import { buildSheet } from './sprites.js';

/**
 * @typedef {object} Assets
 * @property {CanvasImageSource} image atlas image
 * @property {Object<string, {x:number,y:number,w:number,h:number}>} frames sprite rectangles
 */

/**
 * Builds the sprite atlas in memory. Async so the call site stays unchanged.
 * @returns {Promise<Assets>}
 */
export async function loadAssets() {
  return generatedAssets();
}

/** Builds the atlas in memory from the sprite code. */
export function generatedAssets() {
  const sheet = buildSheet();
  const canvas = document.createElement('canvas');
  canvas.width = sheet.width;
  canvas.height = sheet.height;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(sheet.width, sheet.height);
  imageData.data.set(sheet.rgba);
  ctx.putImageData(imageData, 0, 0);
  return { image: canvas, frames: sheet.frames };
}

/**
 * Draws a named sprite with its top-left corner at (x, y).
 * Unknown names fall back to the 'missing' sprite.
 * @param {CanvasRenderingContext2D} ctx
 * @param {Assets} assets
 * @param {string} name
 * @param {number} x
 * @param {number} y
 */
export function drawSprite(ctx, assets, name, x, y) {
  const f = assets.frames[name] || assets.frames.missing;
  if (!f) return;
  ctx.drawImage(assets.image, f.x, f.y, f.w, f.h, x, y, f.w, f.h);
}

/** Size of a named sprite in pixels. */
export function spriteSize(assets, name) {
  const f = assets.frames[name] || assets.frames.missing;
  return f ? { w: f.w, h: f.h } : { w: 8, h: 8 };
}
