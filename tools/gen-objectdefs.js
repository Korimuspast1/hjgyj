#!/usr/bin/env node
/**
 * Generate server/objectdefs.json — the object-definition table the Python
 * API server uses to validate uploaded level codes.  Keeps the server in
 * sync with the game's core/objectdefs.js (single source of truth).
 *
 * Usage: node tools/gen-objectdefs.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { loadGame } = require(path.join(ROOT, 'tests', 'loader.js'));

const sb = loadGame();
const GD = sb.GD;

const out = {
  generatedAt: new Date().toISOString(),
  LEVEL_HEIGHT: GD.objectdefs.LEVEL_HEIGHT,
  MAX_X: GD.objectdefs.MAX_X,
  MAX_Y: GD.objectdefs.MAX_Y,
  defs: GD.objectdefs.list.map(d => ({
    id: d.id, key: d.key, w: d.w, h: d.h
  }))
};

const dest = path.join(ROOT, 'server', 'objectdefs.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n');
console.log('wrote ' + dest + ' (' + out.defs.length + ' defs)');
