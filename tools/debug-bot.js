#!/usr/bin/env node
/** Debug helper: run the bot on one level and print every death in detail. */
'use strict';
const path = require('path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'loader.js'));
const sandbox = loadGame();
const GD = sandbox.GD || sandbox.window.GD;
const gen = require(path.join(__dirname, 'gen-official-levels.js'));

const which = process.argv[2] || 'l1';
const makers = { l1: gen.level1, l2: gen.level2, l3: gen.level3, l4: gen.level4 };
const level = makers[which]();
const index = GD.level.buildIndex(level);

for (let attempt = 1; attempt <= 2; attempt++) {
  const s = GD.physics.createState();
  const input = { held: false, buffer: 0 };
  let steps = 0;
  const trace = [];
  while (s.alive && !s.finished && steps++ < 240 * 600) {
    GD.bot.decide(s, index, level, input);
    const before = { x: s.x, y: s.y, vy: s.vy, g: s.gravity, held: input.held };
    const evs = GD.physics.step(s, level, index, 1 / 240, input);
    for (const ev of evs) {
      if (ev.type === 'death') {
        trace.push('DEATH cause=' + ev.cause + ' at x=' + ev.x.toFixed(2) + ' y=' + ev.y.toFixed(2) +
          ' (before: x=' + before.x.toFixed(2) + ' y=' + before.y.toFixed(2) + ' vy=' + before.vy.toFixed(2) + ' g=' + before.g + ' held=' + before.held + ')');
        for (const o of level.objects) {
          const d = GD.objectdefs.getDef(o.t);
          if (o.x > s.x - 3 && o.x < s.x + 3 && d && (d.lethal || d.solid || d.trigger)) {
            trace.push('   near: ' + d.key + ' @' + o.x + ',' + o.y + (o.r ? ' r=' + o.r : '') + (o.p ? ' p=' + o.p : ''));
          }
        }
      } else if (ev.type === 'pad' || ev.type === 'orb' || ev.type === 'portal' || ev.type === 'finish') {
        trace.push(ev.type + (ev.kind ? ':' + ev.kind : '') + (ev.style ? ':' + ev.style : '') +
          ' at x=' + ev.x.toFixed(2) + ' y=' + ev.y.toFixed(2));
      }
    }
  }
  console.log('--- attempt ' + attempt + ' ' + (s.finished ? 'FINISHED' : 'DIED') + ' at x=' + s.x.toFixed(2) + ' progress=' + (s.progress * 100).toFixed(1) + '%');
  for (const line of trace.slice(-16)) console.log('  ' + line);
  if (s.finished) break;
}
