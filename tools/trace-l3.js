#!/usr/bin/env node
/** Fine-grained trace of the bot through an x-range of a level. */
'use strict';
const path = require('path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'loader.js'));
const sandbox = loadGame();
const GD = sandbox.GD || sandbox.window.GD;
const gen = require(path.join(__dirname, 'gen-official-levels.js'));

const which = process.argv[2] || 'l3';
const x0 = parseFloat(process.argv[3] || '130');
const x1 = parseFloat(process.argv[4] || '150');
const makers = { l1: gen.level1, l2: gen.level2, l3: gen.level3, l4: gen.level4 };
const level = makers[which]();
const index = GD.level.buildIndex(level);

const s = GD.physics.createState();
const input = { held: false, buffer: 0 };
let steps = 0;
let nextPrint = x0;
while (s.alive && !s.finished && steps++ < 240 * 900) {
  GD.bot.decide(s, index, level, input);
  const evs = GD.physics.step(s, level, index, 1 / 240, input);
  if (s.x >= nextPrint) {
    const near = [];
    for (const o of index.query(s.x - 2, s.x + 4)) {
      const d = GD.objectdefs.getDef(o.t);
      if (d && (d.solid || d.lethal || d.trigger)) near.push(d.key + '@' + o.x + ',' + o.y);
    }
    console.log('x=' + s.x.toFixed(2) + ' y=' + s.y.toFixed(2) + ' vy=' + s.vy.toFixed(1) +
      ' g=' + s.gravity + ' og=' + (s.onGround ? 1 : 0) + ' held=' + (input.held ? 1 : 0) +
      '  [' + near.join(' ') + ']');
    nextPrint += 1;
    if (s.x > x1) break;
  }
  for (const ev of evs) {
    if (ev.type !== 'land') console.log('   >> ' + ev.type + (ev.kind ? ':' + ev.kind : '') + ' x=' + ev.x.toFixed(2) + ' y=' + ev.y.toFixed(2) + (ev.cause ? ' cause=' + ev.cause : ''));
    if (ev.type === 'death') { console.log('DEATH cause=' + ev.cause + ' at x=' + ev.x.toFixed(2)); process.exit(0); }
  }
}
