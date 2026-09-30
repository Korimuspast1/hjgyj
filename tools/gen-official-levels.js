#!/usr/bin/env node
/**
 * Generates game/js/levels/official.js — the four built-in levels, stored as
 * NDL1 level codes (the same format users share & upload), and verifies with
 * the physics bot that every level is completable before writing the file.
 *
 * Usage:  node tools/gen-official-levels.js [--no-bot]
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { loadGame } = require(path.join(__dirname, '..', 'tests', 'loader.js'));

const sandbox = loadGame();
const GD = sandbox.GD || sandbox.window.GD;

const B = GD.levelbuild.Builder;

// Spacing discipline (verified by the bot below):
//   - consecutive jumpable hazards are >= 6 units apart (>= 8 at 2x, >= 10 at 3x)
//     so the player lands, re-times and re-jumps comfortably
//   - staircases rise in 1-block steps with >= 4 wide landings
//   - moving hazards on the bot path oscillate horizontally (vertical movers
//     are available in the editor; they need human timing)

// ============================================================ Level 1 =======
// Neon Genesis — Easy. Classic single spikes, plateaus, one pad, one orb.
function level1() {
  const b = new B('Neon Genesis', 'NeonDash', { songId: 0, themeId: 0, difficulty: 0, length: 235 });
  b.spike(12); b.spike(20); b.spike(28);
  b.deco(64, 8, 4); b.deco(71, 14, 6); b.deco(64, 24, 4);
  b.spike(36); b.spike(37);
  // small plateau to hop onto
  b.block(44, 0, 'basic'); b.block(45, 0, 'basic'); b.block(46, 0, 'basic'); b.block(47, 0, 'basic');
  b.spike(54);
  b.spike(60); b.spike(61);
  // yellow pad launch over a spike field
  b.pad(66, 0, 'yellow');
  b.spikeRow(68, 70);
  b.spike(80);
  b.spike(88); b.spike(89); b.spike(90);
  // orb section: jump + tap the orb mid-air to extend
  b.spikeRow(112, 117);
  b.orb(114, 2, 'yellow');
  b.deco(75, 114, 4); b.deco(62, 113, 3);
  b.saw(126, 0);
  b.spike(134); b.spike(140);
  b.spike(146); b.spike(147);
  // staircase up (1-block steps), then drop back down
  for (let x = 152; x <= 156; x++) b.block(x, 0, 'brick');
  for (let x = 158; x <= 164; x++) { b.block(x, 0, 'brick'); b.block(x, 1, 'brick'); }
  b.spike(172); b.spike(178);
  b.spike(186); b.spike(187);
  b.saw(195, 0);
  b.spike(202);
  b.spike(208); b.spike(209);
  b.spike(215); b.spike(221);
  b.deco(71, 130, 8); b.deco(70, 160, 7); b.deco(74, 200, 5); b.deco(60, 90, 3);
  b.deco(73, 100, 6);
  return b.build();
}

// ============================================================ Level 2 =======
// Circuit Breaker — Normal. Speed portal, gravity flip onto the ceiling,
// corridor with clipped jumps, moving saw.
function level2() {
  const b = new B('Circuit Breaker', 'NeonDash', { songId: 1, themeId: 3, difficulty: 1, length: 300 });
  b.spike(14); b.spike(20); b.spike(26);
  b.spike(32); b.spike(33);
  b.spike(40); b.spike(41); b.spike(42);
  b.saw(48, 0); b.saw(54, 0);
  b.spike(62); b.spike(63);
  // speed up!
  b.portal('speed2', 70);
  b.spike(78);
  b.spike(86); b.spike(87);
  b.spike(94); b.spike(95); b.spike(96);
  // flip gravity — run on the ceiling
  b.portal('gravUp', 102);
  b.spike(120, 13, 2); b.spike(128, 13, 2);
  b.spike(130, 13, 2); b.spike(131, 13, 2);
  // upside-down staircase (hanging from the ceiling, 1-block steps)
  for (let x = 138; x <= 145; x++) b.block(x, 13, 'circuit');
  for (let x = 146; x <= 149; x++) { b.block(x, 13, 'circuit'); b.block(x, 12, 'circuit'); }
  // ...and back down
  b.portal('gravDown', 152, 11);
  b.portal('speed1', 165);
  // orb bridge over spikes
  b.spikeRow(172, 176);
  b.orb(174, 2, 'yellow');
  // pad launch
  b.pad(182, 0, 'yellow');
  b.spikeRow(184, 186);
  // sweeping saw — wait for the gap
  b.movingSaw(196, 0, 2, 6, 0, 0);
  // low corridor: jump gets clipped by the ceiling, small spikes only
  for (let x = 204; x <= 208; x++) b.block(x, 4, 'metal');
  b.spikeSmall(206, 0);
  b.spike(216); b.spike(217);
  b.spike(224);
  b.spike(230); b.spike(231);
  b.saw(238, 0);
  b.spike(244);
  b.mine(250, 0);
  b.spike(256); b.spike(257);
  b.spike(264);
  b.spike(270); b.spike(271); b.spike(272);
  b.deco(69, 108, 6); b.deco(70, 148, 7); b.deco(73, 190, 5);
  b.deco(60, 100, 4); b.deco(71, 260, 6);
  return b.build();
}

// ============================================================ Level 3 =======
// Voltage — Hard. Gravity play, saw gauntlets, orb chains, mines.
function level3() {
  const b = new B('Voltage', 'NeonDash', { songId: 2, themeId: 2, difficulty: 2, length: 340 });
  b.spike(12); b.spike(18);
  b.spike(24); b.spike(25);
  b.saw(32, 0);
  b.spike(38); b.spike(39); b.spike(40);
  b.saw(47, 0, 'medium');
  b.spike(54); b.spike(60);
  // orb chain across a long spike field
  b.spikeRow(68, 77);
  b.orb(70, 2, 'yellow');
  b.orb(74, 3, 'yellow');
  // flip to ceiling — hazards hang from the roof
  b.portal('gravUp', 88);
  b.spike(104, 13, 2);
  b.saw(110, 13);
  b.spike(116, 13, 2); b.spike(117, 13, 2);
  b.mine(123, 13);
  b.spike(129, 13, 2);
  // upside-down stairs (support runs right up to the next step)
  for (let x = 136; x <= 145; x++) b.block(x, 13, 'metal');
  for (let x = 146; x <= 149; x++) { b.block(x, 13, 'metal'); b.block(x, 12, 'metal'); }
  b.portal('gravDown', 153, 11);
  // back on the ground: pad + orb combo
  b.pad(166, 0, 'yellow');
  b.spikeRow(168, 173);
  b.orb(170, 3, 'yellow');
  b.saw(180, 0);
  b.spike(186); b.spike(192);
  b.movingSaw(197, 0, 2, 6, 0, 0);
  b.spike(206); b.spike(207);
  // corridor with clipped jumps
  for (let x = 214; x <= 220; x++) b.block(x, 4, 'stone');
  b.spikeSmall(217, 0);
  b.spike(228); b.spike(234);
  b.spike(240); b.spike(241); b.spike(242);
  b.saw(249, 0, 'medium');
  b.spike(256); b.spike(262);
  b.mine(268, 0); b.mine(273, 0);
  b.spike(279); b.spike(280);
  b.saw(287, 0);
  b.spike(294); b.spike(295); b.spike(296);
  b.pad(303, 0, 'yellow');
  b.spikeRow(305, 307);
  b.spike(316); b.spike(322);
  b.spike(330); b.spike(331);
  b.deco(69, 90, 5); b.deco(74, 200, 7); b.deco(60, 300, 6);
  return b.build();
}

// ============================================================ Level 4 =======
// Hyperdrive — Insane. Everything, fast, tight.
function level4() {
  const b = new B('Hyperdrive', 'NeonDash', { songId: 3, themeId: 4, difficulty: 4, length: 400 });
  b.spike(12); b.spike(18); b.spike(24);
  b.spike(30); b.spike(31);
  b.saw(38, 0);
  b.spike(44); b.spike(45); b.spike(46);
  b.saw(53, 0, 'medium');
  b.portal('speed2', 60);
  b.spike(68);
  b.spike(76); b.spike(77);
  b.spike(84); b.spike(85); b.spike(86);
  b.saw(93, 0);
  b.pad(101, 0, 'yellow');
  b.spikeRow(103, 106);
  // flip to the ceiling at high speed
  b.portal('gravUp', 118);
  b.spike(134, 13, 2); b.spike(142, 13, 2);
  b.saw(150, 13);
  b.spike(158, 13, 2); b.spike(159, 13, 2);
  b.mine(166, 13);
  b.movingSaw(173, 13, 2, 6, 0, 0);
  b.spike(182, 13, 2);
  // upside-down stairs, then back down
  for (let x = 192; x <= 199; x++) b.block(x, 13, 'glow');
  for (let x = 200; x <= 203; x++) { b.block(x, 13, 'glow'); b.block(x, 12, 'glow'); }
  b.portal('gravDown', 207, 11);
  // full speed!
  b.portal('speed3', 220);
  b.spike(230);
  b.spike(240); b.spike(241);
  b.saw(251, 0);
  b.spike(262); b.spike(263); b.spike(264);
  b.pad(275, 0, 'yellow');
  b.spikeRow(277, 282);
  b.portal('speed1', 295);
  b.spike(304); b.spike(310);
  b.saw(317, 0);
  b.spike(324); b.spike(325);
  b.mine(332, 0); b.mine(337, 0);
  b.spike(344); b.spike(345); b.spike(346);
  b.movingSaw(354, 0, 2, 6, 0, 0);
  b.spike(364); b.spike(370);
  b.saw(378, 0, 'big');
  b.spike(386); b.spike(387);
  return b.build();
}

// ================================================================ main ======
const builders = [
  { id: 'l1', make: level1 },
  { id: 'l2', make: level2 },
  { id: 'l3', make: level3 },
  { id: 'l4', make: level4 }
];

function generate(verbose) {
  const runBot = verbose ? process.argv.indexOf('--no-bot') === -1 : true;
  const out = [];
  let ok = true;

  for (const { id, make } of builders) {
    const level = make();
    let botResult = null;
    if (runBot) {
      botResult = GD.bot.simulate(level, 4);
      if (!botResult.completed) {
        ok = false;
        console.error('BOT FAILED on "' + level.name + '" — stuck at x=' +
          botResult.stuckAt + ' progress=' + (botResult.progress * 100).toFixed(1) + '%');
      }
    }
    const code = GD.encoding.encode(level);
    const roundTrip = GD.encoding.decode(code);
    if (roundTrip.name !== level.name || roundTrip.objects.length !== level.objects.length) {
      throw new Error('Round-trip failed for ' + level.name);
    }
    const stars = GD.level.DIFFICULTIES[level.difficulty].stars;
    if (verbose) {
      console.log((botResult && botResult.completed ? 'OK  ' : '    ') + level.name +
        '  objects=' + level.objects.length + ' length=' + level.length +
        ' stars=' + stars + (botResult ? ' botAttempts=' + botResult.attempts : ''));
    }
    out.push({ id: id, name: level.name, author: level.author, difficulty: level.difficulty, stars: stars, code: code });
  }
  return { ok, out };
}

module.exports = { generate, builders, level1, level2, level3, level4 };

if (require.main === module) {
  const { ok, out } = generate(true);
  if (!ok) {
    console.error('\nRefusing to write official.js — fix the levels above first.');
    process.exit(1);
  }
  const file = [
    '/**',
    ' * Neon Dash — official levels (GENERATED FILE — do not edit by hand).',
    ' * Generated by tools/gen-official-levels.js.  Each level is stored as an',
    ' * NDL1 level code — the exact format users share, import and upload —',
    ' * and is verified completable by the physics bot before shipping.',
    ' */',
    '/* global GD */',
    'GD.register(\'official\', function () {',
    '  \'use strict\';',
    '  return { levels: ' + JSON.stringify(out, null, 2) + ' };',
    '});',
    ''
  ].join('\n');
  fs.writeFileSync(path.join(__dirname, '..', 'game', 'js', 'levels', 'official.js'), file);
  console.log('\nWrote game/js/levels/official.js');
}
