// Синтезированные звуки через WebAudio (без внешних файлов)
let ctx = null;
let master = null;
const loops = new Map();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function unlockAudio() { ac(); }

export function setMasterVolume(v) {
  if (master) master.gain.value = Math.max(0, Math.min(1, v));
}

function env(node, t0, a, d, peak = 0.3) {
  const g = ac().createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  node.connect(g);
  g.connect(master);
  return g;
}

function tone({ freq = 440, type = 'sine', dur = 0.16, vol = 0.22, delay = 0, glide = 0 }) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(30, glide), t0 + dur);
  env(o, t0, 0.008, dur, vol);
  o.start(t0); o.stop(t0 + dur + 0.06);
}

function noise({ dur = 0.1, vol = 0.18, delay = 0, lp = 2400 }) {
  const c = ac(); if (!c) return;
  const t0 = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  src.connect(f);
  env(f, t0, 0.004, dur, vol);
  src.start(t0); src.stop(t0 + dur + 0.05);
}

/* ---------- системные звуки ---------- */
export const SFX = {
  tap: () => tone({ freq: 1500, type: 'triangle', dur: 0.035, vol: 0.05 }),
  click: () => { tone({ freq: 900, type: 'square', dur: 0.04, vol: 0.06 }); noise({ dur: 0.03, vol: 0.05, lp: 4000 }); },
  back: () => tone({ freq: 620, type: 'sine', dur: 0.07, vol: 0.09, glide: 420 }),
  open: () => { tone({ freq: 520, type: 'sine', dur: 0.09, vol: 0.1 }); tone({ freq: 780, type: 'sine', dur: 0.1, vol: 0.07, delay: 0.05 }); },
  close: () => { tone({ freq: 700, type: 'sine', dur: 0.08, vol: 0.08 }); tone({ freq: 460, type: 'sine', dur: 0.1, vol: 0.07, delay: 0.04 }); },
  shade: () => noise({ dur: 0.14, vol: 0.06, lp: 1600 }),
  notif: () => { tone({ freq: 880, type: 'sine', dur: 0.1, vol: 0.16 }); tone({ freq: 1320, type: 'sine', dur: 0.16, vol: 0.13, delay: 0.09 }); },
  msgIn: () => { tone({ freq: 1180, type: 'sine', dur: 0.07, vol: 0.13 }); tone({ freq: 1560, type: 'sine', dur: 0.09, vol: 0.1, delay: 0.06 }); },
  msgOut: () => tone({ freq: 740, type: 'sine', dur: 0.06, vol: 0.09 }),
  error: () => { tone({ freq: 300, type: 'sawtooth', dur: 0.12, vol: 0.1 }); tone({ freq: 220, type: 'sawtooth', dur: 0.16, vol: 0.1, delay: 0.1 }); },
  shutter: () => { noise({ dur: 0.045, vol: 0.28, lp: 6000 }); noise({ dur: 0.05, vol: 0.16, lp: 3000, delay: 0.075 }); },
  recStart: () => tone({ freq: 1000, type: 'square', dur: 0.06, vol: 0.1 }),
  powerOn: () => { [440, 587, 740, 988].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.3, vol: 0.12, delay: i * 0.11 })); },
  powerOff: () => { [740, 587, 440, 330].forEach((f, i) => tone({ freq: f, type: 'sine', dur: 0.26, vol: 0.1, delay: i * 0.1 })); },
  boot: () => { tone({ freq: 392, type: 'sine', dur: 0.5, vol: 0.1 }); tone({ freq: 523, type: 'sine', dur: 0.6, vol: 0.1, delay: 0.2 }); tone({ freq: 659, type: 'sine', dur: 0.9, vol: 0.09, delay: 0.42 }); },
  plug: () => tone({ freq: 1200, type: 'sine', dur: 0.07, vol: 0.12, glide: 1800 }),
  unplug: () => tone({ freq: 900, type: 'sine', dur: 0.09, vol: 0.1, glide: 500 }),
  tray: () => { noise({ dur: 0.12, vol: 0.1, lp: 2000 }); noise({ dur: 0.1, vol: 0.08, lp: 1200, delay: 0.14 }); },
  film: () => noise({ dur: 0.6, vol: 0.07, lp: 900 }),
  coin: () => { tone({ freq: 1200, type: 'square', dur: 0.06, vol: 0.07 }); tone({ freq: 1800, type: 'square', dur: 0.09, vol: 0.06, delay: 0.06 }); },
  achieve: () => { [660, 880, 1170, 1560].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.12, delay: i * 0.08 })); },
  dtmf: (i) => {
    const pairs = [[941, 1336], [697, 1209], [697, 1336], [697, 1477], [770, 1209], [770, 1336], [770, 1477], [852, 1209], [852, 1336], [852, 1477], [941, 1209], [941, 1477]];
    const [a, b] = pairs[i] || [770, 1336];
    tone({ freq: a, type: 'sine', dur: 0.13, vol: 0.11 });
    tone({ freq: b, type: 'sine', dur: 0.13, vol: 0.11 });
  },
  key: () => tone({ freq: 1700, type: 'sine', dur: 0.03, vol: 0.045 }),
  snakeEat: () => tone({ freq: 1400, type: 'square', dur: 0.05, vol: 0.08, glide: 2100 }),
  snakeDie: () => { tone({ freq: 400, type: 'sawtooth', dur: 0.4, vol: 0.12, glide: 80 }); }
};

/* ---------- мелодии (звонки/будильник) ---------- */
function seqLoop(key, notes, gap) {
  stopLoop(key);
  let i = 0;
  const play = () => {
    notes.forEach((n, k) => {
      if (n) tone({ freq: n, type: 'sine', dur: 0.22, vol: 0.16, delay: k * 0.2 });
    });
    i++;
    loops.set(key, setTimeout(play, notes.length * 200 + gap));
  };
  play();
}
export function stopLoop(key) {
  if (loops.has(key)) { clearTimeout(loops.get(key)); loops.delete(key); }
}
export function stopAllLoops() { [...loops.keys()].forEach(stopLoop); }

export const RING = {
  incoming: (style = 'nova') => {
    if (style === 'silent') return;
    const sets = {
      nova: [[659, 784, 988], [988, 784, 659]],
      beep: [[1046], [0]],
      chime: [[523, 659, 784, 1046], [0]],
      retro: [[880, 0, 880, 0], [0]]
    };
    const n = sets[style] || sets.nova;
    seqLoop('ring', n, 1800);
  },
  alarm: (style = 'nova') => {
    if (style === 'silent') return;
    seqLoop('alarm', [[880, 1174, 880, 1174], [1318, 1174, 880, 0]], 900);
  },
  busy: () => { seqLoop('busy', [[480, 0], [0, 0]], 400); },
  dialing: () => { seqLoop('dialing', [[440, 0], [0, 0]], 700); },
  hangup: () => { tone({ freq: 620, type: 'sine', dur: 0.09, vol: 0.09 }); tone({ freq: 480, type: 'sine', dur: 0.14, vol: 0.09, delay: 0.1 }); }
};
export const stopRing = () => stopLoop('ring');
export const stopAlarm = () => stopLoop('alarm');
export const stopBusy = () => { stopLoop('busy'); stopLoop('dialing'); };

/* ---------- «музыка» в плеере: лёгкий синтезированный бит ---------- */
let musicTimer = null, musicStep = 0;
export function startFakeMusic(seed = 0) {
  stopFakeMusic();
  musicStep = 0;
  const bass = [110, 110, 146.8, 130.8];
  const lead = [440, 523.3, 659.3, 587.3, 523.3, 440, 392, 440];
  musicTimer = setInterval(() => {
    const c = ac(); if (!c) return;
    const i = musicStep++;
    tone({ freq: bass[Math.floor(i / 4) % bass.length], type: 'triangle', dur: 0.24, vol: 0.055 });
    if (i % 2 === 0) tone({ freq: lead[(i / 2 + seed) % lead.length], type: 'sine', dur: 0.2, vol: 0.035 });
    if (i % 4 === 2) noise({ dur: 0.05, vol: 0.02, lp: 6000 });
  }, 260);
}
export function stopFakeMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }

/* ---------- радио: непрерывный поток (синтез + лёгкий шум эфира) ---------- */
let radioTimer = null, radioStep = 0;
export function startRadio(kind = 'music') {
  stopRadio();
  radioStep = 0;
  const chords = kind === 'talk'
    ? [[196], [220], [174.6], [196]]
    : [[220, 277.2, 329.6], [196, 246.9, 293.7], [174.6, 220, 261.6], [196, 246.9, 329.6]];
  radioTimer = setInterval(() => {
    const c = ac(); if (!c) return;
    const ch = chords[radioStep % chords.length];
    ch.forEach((f, k) => tone({ freq: f, type: kind === 'talk' ? 'sawtooth' : 'sine', dur: 0.6, vol: 0.022, delay: k * 0.02 }));
    if (kind === 'music' && radioStep % 2 === 0) noise({ dur: 0.04, vol: 0.012, lp: 5000 });
    if (radioStep % 8 === 7) noise({ dur: 0.12, vol: 0.008, lp: 900 }); // «помехи эфира»
    radioStep++;
  }, 700);
}
export function stopRadio() { if (radioTimer) { clearInterval(radioTimer); radioTimer = null; } }

/* ---------- диктофон: мягкий гул записи ---------- */
let recTimer = null, recStep = 0;
export function startRecording(quality = 'high') {
  stopRecording();
  recStep = 0;
  recTimer = setInterval(() => {
    const c = ac(); if (!c) return;
    const f = 180 + Math.sin(recStep / 6) * 90;
    tone({ freq: f, type: 'sine', dur: 0.16, vol: quality === 'high' ? 0.012 : 0.008 });
    if (recStep % 6 === 0) noise({ dur: 0.03, vol: 0.006, lp: 1800 });
    recStep++;
  }, 190);
}
export function stopRecording() { if (recTimer) { clearInterval(recTimer); recTimer = null; } }
