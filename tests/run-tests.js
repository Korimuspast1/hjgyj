/**
 * Minimal zero-dependency test runner (describe / it / beforeEach, async
 * supported) for the game's unit and UI tests.
 *
 * Usage:  node run-tests.js            (all tests)
 *         node run-tests.js unit       (only tests/unit)
 *         node run-tests.js ui         (only tests/ui)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const groups = [];
let currentGroup = null;

global.describe = function (name, fn) {
  const g = { name, tests: [], before: [], after: [] };
  groups.push(g);
  const prev = currentGroup;
  currentGroup = g;
  fn();
  currentGroup = prev;
};
global.beforeEach = function (fn) {
  if (currentGroup) currentGroup.before.push(fn);
};
global.afterEach = function (fn) {
  if (currentGroup) currentGroup.after.push(fn);
};
global.it = function (name, fn) {
  if (!currentGroup) throw new Error('it() outside describe(): ' + name);
  currentGroup.tests.push({ name, fn });
};

const which = process.argv[2];

function loadDir(dir, tag) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.test.js')).sort();
  for (const f of files) {
    const count = groups.length;
    require(path.join(dir, f));
    for (let i = count; i < groups.length; i++) groups[i].tag = tag;
  }
}

loadDir(path.join(__dirname, 'unit'), 'unit');
loadDir(path.join(__dirname, 'ui'), 'ui');

(async () => {
  let passed = 0, failed = 0, skipped = 0;
  const failures = [];
  for (const g of groups) {
    if (which && g.tag !== which && !g.name.toLowerCase().includes(which.toLowerCase())) continue;
    console.log('\n' + g.name);
    for (const t of g.tests) {
      const label = t.name;
      if (!t.fn) { skipped++; console.log('  ○ ' + label + ' (skipped)'); continue; }
      try {
        for (const b of g.before) await b();
        await t.fn();
        passed++;
        console.log('  ✔ ' + label);
      } catch (e) {
        failed++;
        failures.push({ group: g.name, label, e });
        console.log('  ✘ ' + label);
        console.log('      ' + String(e && e.message || e).split('\n')[0]);
      } finally {
        for (const a of g.after) { try { await a(); } catch (e) { /* ignore */ } }
      }
    }
  }
  console.log('\n──────────────────────────────');
  console.log(passed + ' passed, ' + failed + ' failed' + (skipped ? ', ' + skipped + ' skipped' : ''));
  try { require('./ui/helpers').closeAll(); } catch (e) { /* ignore */ }
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) {
      console.log('\n  [' + f.group + ' › ' + f.label + ']');
      console.log(String((f.e && f.e.stack) || f.e).split('\n').slice(0, 6).map(l => '    ' + l).join('\n'));
    }
    process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error('Runner crashed:', e); process.exit(1); });
