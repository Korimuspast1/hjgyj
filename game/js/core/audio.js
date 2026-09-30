/**
 * Neon Dash — procedural audio engine (WebAudio).
 *
 * All music and sound effects are SYNTHESISED at runtime — the game ships
 * with zero audio files, so it stays tiny, avoids any licensing issues and
 * every level can have its own deterministic soundtrack (seeded per song).
 *
 * Structure:
 *   - SFX: short one-shot synths (click, death, portal, pad, orb, win...).
 *   - Music: a 16-step tracker driven by a lookahead scheduler; each song
 *     (see level.SONGS) deterministically generates bass / lead / drum
 *     patterns from its seed using core/rng.js.
 *
 * The engine degrades gracefully: with no AudioContext (unit tests, silent
 * devices) every call becomes a no-op.
 */
/* global GD */
GD.register('audio', function (GD) {
  'use strict';

  var ctx = null;
  var masterGain = null, musicGain = null, sfxGain = null;
  var musicVol = 0.7, sfxVol = 0.9;
  var unlocked = false;

  var A = {};

  A.available = function () { return !!ctx; };

  /** Create/attach the context. Safe to call repeatedly. */
  A.init = function () {
    if (ctx) return true;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = musicVol;
      musicGain.connect(masterGain);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = sfxVol;
      sfxGain.connect(masterGain);
    } catch (e) {
      ctx = null;
      return false;
    }
    return true;
  };

  /** Must be called from a user gesture (mobile autoplay policy). */
  A.unlock = function () {
    if (!A.init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    unlocked = true;
  };

  A.setMusicVolume = function (v) {
    musicVol = GD.util.clamp(v, 0, 1);
    if (musicGain) musicGain.gain.value = musicVol;
  };

  A.setSfxVolume = function (v) {
    sfxVol = GD.util.clamp(v, 0, 1);
    if (sfxGain) sfxGain.gain.value = sfxVol;
  };

  // ----------------------------------------------------------------- SFX ----
  function env(node, t0, attack, peak, decay) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
    node.connect(g);
    return g;
  }

  function tone(opts) {
    if (!ctx || sfxVol <= 0) return;
    var t0 = ctx.currentTime + 0.001;
    var osc = ctx.createOscillator();
    osc.type = opts.type || 'square';
    osc.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.slide);
    var g = env(osc, t0, opts.attack || 0.005, opts.gain || 0.2, opts.decay || 0.15);
    g.connect(sfxGain);
    osc.start(t0);
    osc.stop(t0 + (opts.attack || 0.005) + (opts.decay || 0.15) + 0.05);
  }

  function noise(opts) {
    if (!ctx || sfxVol <= 0) return;
    var t0 = ctx.currentTime + 0.001;
    var len = Math.floor(ctx.sampleRate * (opts.dur || 0.2));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    if (opts.filter) {
      var f = ctx.createBiquadFilter();
      f.type = opts.filter;
      f.frequency.setValueAtTime(opts.cutoff || 1000, t0);
      if (opts.cutoff1) f.frequency.exponentialRampToValueAtTime(Math.max(10, opts.cutoff1), t0 + (opts.dur || 0.2));
      src.connect(f);
      var g = env(f, t0, opts.attack || 0.003, opts.gain || 0.25, opts.dur || 0.2);
      g.connect(sfxGain);
    } else {
      var g2 = env(src, t0, opts.attack || 0.003, opts.gain || 0.25, opts.dur || 0.2);
      g2.connect(sfxGain);
    }
    src.start(t0);
  }

  A.sfx = {
    click:   function () { tone({ type: 'square',   f0: 660,  f1: 880, slide: 0.03, gain: 0.12, decay: 0.07 }); },
    back:    function () { tone({ type: 'square',   f0: 550,  f1: 330, slide: 0.05, gain: 0.10, decay: 0.09 }); },
    place:   function () { tone({ type: 'triangle', f0: 880,  f1: 990, slide: 0.02, gain: 0.15, decay: 0.05 }); },
    delete:  function () { tone({ type: 'triangle', f0: 440,  f1: 220, slide: 0.05, gain: 0.15, decay: 0.08 }); },
    jump:    function () { /* GD has no jump sound by design — keep it silent */ },
    pad:     function () { tone({ type: 'square', f0: 330, f1: 1180, slide: 0.12, gain: 0.16, decay: 0.16 }); },
    orb:     function () { tone({ type: 'sine',   f0: 520, f1: 1040, slide: 0.08, gain: 0.22, decay: 0.12 });
                          tone({ type: 'square', f0: 1040, f1: 1560, slide: 0.08, gain: 0.08, decay: 0.10 }); },
    portal:  function () { tone({ type: 'sawtooth', f0: 200, f1: 1600, slide: 0.25, gain: 0.10, decay: 0.28 });
                          tone({ type: 'sine',     f0: 800, f1: 2400, slide: 0.25, gain: 0.06, decay: 0.30 }); },
    death:   function () { noise({ filter: 'lowpass', cutoff: 2400, cutoff1: 120, dur: 0.35, gain: 0.5 });
                          tone({ type: 'sawtooth', f0: 400, f1: 40, slide: 0.4, gain: 0.25, decay: 0.4 }); },
    win:     function () {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
      for (var i = 0; i < notes.length; i++) {
        (function (f, d) {
          setTimeout(function () {
            tone({ type: 'square', f0: f, gain: 0.16, decay: 0.25 });
            tone({ type: 'triangle', f0: f * 2, gain: 0.07, decay: 0.2 });
          }, d);
        })(notes[i], i * 110);
      }
    },
    complete: function () { A.sfx.win(); }
  };

  /** Fire an sfx by name, e.g. GD.audio.play('click'). */
  A.play = function (name) {
    if (!ctx || !unlocked) return;
    var fn = A.sfx[name];
    if (fn) fn();
  };

  // --------------------------------------------------------------- Music ----
  // A song is generated deterministically from its seed: chord progression,
  // bassline, lead arpeggio and drum pattern, then looped by the scheduler.
  var SCALE = [0, 3, 5, 7, 10];          // minor pentatonic
  var PROGRESSIONS = [
    [0, -4, -2, -7],   // i  VI  V   III-ish
    [0, 0, -4, -2],
    [0, 3, -2, -4],
    [0, -2, -4, -7]
  ];

  function noteHz(semi) {
    return 440 * Math.pow(2, (semi - 69) / 12);
  }

  function generateSong(song) {
    var rand = GD.rng.createRandom('song:' + song.seed);
    var root = 45 + rand.int(7);                     // A2..E3
    var prog = rand.pick(PROGRESSIONS);
    var bars = 8;
    var stepsPerBar = 16;
    var songData = {
      bpm: song.bpm,
      root: root,
      prog: prog,
      bars: bars,
      stepsPerBar: stepsPerBar,
      bass: [], lead: [], kick: [], snare: [], hat: [], arp: []
    };
    for (var bar = 0; bar < bars; bar++) {
      var chordRoot = root + prog[bar % prog.length];
      var bassBar = [], leadBar = [], kickBar = [], snareBar = [], hatBar = [];
      var style = rand();
      for (var s = 0; s < stepsPerBar; s++) {
        // Drums: four-on-the-floor kick with variations, snare on 4/12, hats on 8ths
        kickBar.push(s % 4 === 0 || (style > 0.6 && s === 14) ? 1 : 0);
        snareBar.push(s === 4 || s === 12 ? 1 : 0);
        hatBar.push(s % 2 === 0 ? 1 : (s % 2 === 1 && rand() < 0.3 ? 0.5 : 0));
        // Bass: root-driven 8th note groove with occasional octave/fifth
        if (s % 2 === 0) {
          var bNote = chordRoot;
          if (rand() < 0.22) bNote += rand() < 0.5 ? 12 : 7;
          bassBar.push(bNote);
        } else {
          bassBar.push(rand() < 0.3 ? chordRoot : null);
        }
        // Lead: sparse pentatonic melody on off-steps
        if (rand() < 0.45) {
          var degree = rand.int(SCALE.length);
          var oct = rand() < 0.35 ? 24 : 12;
          leadBar.push(chordRoot + SCALE[degree] + oct);
        } else {
          leadBar.push(null);
        }
      }
      songData.bass.push(bassBar);
      songData.lead.push(leadBar);
      songData.kick.push(kickBar);
      songData.snare.push(snareBar);
      songData.hat.push(hatBar);
    }
    return songData;
  }

  var music = {
    songData: null,
    step: 0,
    nextStepTime: 0,
    timer: null,
    playing: false,
    delayNode: null
  };

  function stepDur() { return 60 / music.songData.bpm / 4; }

  function scheduleStep(stepIdx, t) {
    var sd = music.songData;
    var bar = Math.floor(stepIdx / sd.stepsPerBar) % sd.bars;
    var s = stepIdx % sd.stepsPerBar;

    // kick
    if (sd.kick[bar][s]) {
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(160, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.10);
      g.gain.setValueAtTime(0.55, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(musicGain);
      o.start(t); o.stop(t + 0.16);
    }
    // snare
    if (sd.snare[bar][s]) {
      var len = Math.floor(ctx.sampleRate * 0.16);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      var src = ctx.createBufferSource(); src.buffer = buf;
      var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1600;
      var gn = ctx.createGain();
      gn.gain.setValueAtTime(0.30, t);
      gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(hp); hp.connect(gn); gn.connect(musicGain);
      src.start(t);
    }
    // hat
    var hv = sd.hat[bar][s];
    if (hv) {
      var hl = Math.floor(ctx.sampleRate * 0.05);
      var hb = ctx.createBuffer(1, hl, ctx.sampleRate);
      var hd = hb.getChannelData(0);
      for (var j = 0; j < hl; j++) hd[j] = Math.random() * 2 - 1;
      var hs = ctx.createBufferSource(); hs.buffer = hb;
      var hh = ctx.createBiquadFilter(); hh.type = 'highpass'; hh.frequency.value = 7000;
      var hg = ctx.createGain();
      hg.gain.setValueAtTime(0.10 * hv, t);
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      hs.connect(hh); hh.connect(hg); hg.connect(musicGain);
      hs.start(t);
    }
    // bass
    var bn = sd.bass[bar][s];
    if (bn !== null && bn !== undefined) {
      var bo = ctx.createOscillator(), bf = ctx.createBiquadFilter(), bg = ctx.createGain();
      bo.type = 'sawtooth';
      bo.frequency.value = noteHz(bn);
      bf.type = 'lowpass';
      bf.frequency.setValueAtTime(320, t);
      bf.frequency.exponentialRampToValueAtTime(120, t + stepDur() * 0.9);
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(0.22, t + 0.01);
      bg.gain.exponentialRampToValueAtTime(0.001, t + stepDur() * 0.95);
      bo.connect(bf); bf.connect(bg); bg.connect(musicGain);
      bo.start(t); bo.stop(t + stepDur());
    }
    // lead (with a feedback delay for that neon feel)
    var ln = sd.lead[bar][s];
    if (ln !== null && ln !== undefined) {
      var lo = ctx.createOscillator(), lg = ctx.createGain();
      lo.type = 'square';
      lo.frequency.value = noteHz(ln);
      lg.gain.setValueAtTime(0.0001, t);
      lg.gain.linearRampToValueAtTime(0.09, t + 0.008);
      lg.gain.exponentialRampToValueAtTime(0.001, t + stepDur() * 0.9);
      lo.connect(lg); lg.connect(musicGain);
      if (music.delayNode) lg.connect(music.delayNode);
      lo.start(t); lo.stop(t + stepDur());
    }
  }

  function scheduler() {
    if (!music.playing || !ctx) return;
    var LOOKAHEAD = 0.14;
    while (music.nextStepTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(music.step, music.nextStepTime);
      music.nextStepTime += stepDur();
      music.step++;
    }
  }

  /** Start the given song (see level.SONGS). Restarts if already playing. */
  A.startMusic = function (songMeta) {
    if (!ctx || musicVol <= 0) return;
    if (!unlocked) return;
    A.stopMusic();
    if (!music.delayNode) {
      music.delayNode = ctx.createDelay(1.0);
      music.delayNode.delayTime.value = 0.23;
      var fb = ctx.createGain(); fb.gain.value = 0.30;
      var wet = ctx.createGain(); wet.gain.value = 0.35;
      music.delayNode.connect(fb); fb.connect(music.delayNode);
      music.delayNode.connect(wet); wet.connect(musicGain);
    }
    music.songData = generateSong(songMeta);
    music.step = 0;
    music.nextStepTime = ctx.currentTime + 0.06;
    music.playing = true;
    music.timer = setInterval(scheduler, 30);
  };

  A.stopMusic = function () {
    music.playing = false;
    if (music.timer) { clearInterval(music.timer); music.timer = null; }
  };

  /** Duck the music briefly (used on death). */
  A.duck = function () {
    if (!ctx || !musicGain) return;
    var t = ctx.currentTime;
    musicGain.gain.cancelScheduledValues(t);
    musicGain.gain.setValueAtTime(musicVol, t);
    musicGain.gain.linearRampToValueAtTime(musicVol * 0.15, t + 0.05);
    musicGain.gain.linearRampToValueAtTime(musicVol, t + 0.6);
  };

  return A;
});
