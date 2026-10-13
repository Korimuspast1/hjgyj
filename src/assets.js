/**
 * Sprite assets. The browser prefers the pre-built atlas (assets/atlas.png +
 * atlas.json). If that is missing, the same sprites are generated at runtime
 * from src/sprites.js, so the game still runs from a plain file server.
 */
import { buildSheet } from './sprites.js';

/**
 * @typedef {object} Assets
 * @property {CanvasImageSource} image atlas image
 * @property {Object<string, {x:number,y:number,w:number,h:number}>} frames sprite rectangles
 */

/**
 * Loads the atlas, falling back to procedural sprites.
 * @returns {Promise<Assets>}
 */
export async function loadAssets() {
  try {
    const res = await fetch('assets/atlas.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`atlas.json: HTTP ${res.status}`);
    const meta = await res.json();
    const image = await loadImage(`assets/${meta.image}`);
    return { image, frames: meta.frames };
  } catch (err) {
    console.info('Using procedural sprites:', err.message);
    return generatedAssets();
  }
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

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
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
