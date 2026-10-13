#!/usr/bin/env node
/**
 * Builds assets/atlas.png and assets/atlas.json from the procedural sprites in
 * src/sprites.js. Run with `npm run build:atlas`.
 *
 * The PNG is written with a tiny built-in encoder (zlib + CRC32) so the build
 * needs no npm packages. The browser loads the atlas when it exists and falls
 * back to generating the same sprites at runtime when it does not.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { buildSheet } from '../src/sprites.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** CRC-32 as used by PNG chunks. */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    crc ^= buf[n];
    for (let k = 0; k < 8; k++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

/** Encodes RGBA pixels as a PNG file (8-bit, colour type 6). */
export function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function main() {
  const sheet = buildSheet();
  const outDir = join(root, 'assets');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'atlas.png'), encodePng(sheet.width, sheet.height, sheet.rgba));
  writeFileSync(
    join(outDir, 'atlas.json'),
    JSON.stringify({ image: 'atlas.png', width: sheet.width, height: sheet.height, frames: sheet.frames }, null, 2) + '\n',
  );
  console.log(`Wrote assets/atlas.png (${sheet.width}x${sheet.height}, ${Object.keys(sheet.frames).length} sprites)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
