// Procedural sound effects (WebAudio, no assets)
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.55;
    this.muted = false;
    this.noiseBuf = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 1.2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
    return true;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }

  _noise(dur, gain, filterType, freq, q = 1) {
    if (!this.ensure()) return null;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType; flt.frequency.value = freq; flt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.02);
    return { src, flt, g, t };
  }

  _tone(freq, dur, gain, type = 'square', slideTo = null) {
    if (!this.ensure()) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  // --- public sounds ---
  gunshot(kind = 'pistol') {
    const cfg = { pistol: [0.34, 0.55, 1400], shotgun: [0.55, 0.8, 900], rifle: [0.42, 0.7, 1800] }[kind] || [0.34, 0.55, 1400];
    this._noise(cfg[0], cfg[1], 'lowpass', cfg[2]);
    this._tone(kind === 'shotgun' ? 90 : 140, 0.22, 0.35, 'triangle', 45);
  }
  dryFire() { this._noise(0.05, 0.25, 'highpass', 2600); }
  reload() { this._noise(0.07, 0.3, 'bandpass', 1800, 6); setTimeout(() => this._noise(0.09, 0.3, 'bandpass', 1200, 6), 120); }
  swing() { this._noise(0.16, 0.22, 'bandpass', 700, 2.5); }
  hitFlesh() { this._noise(0.14, 0.4, 'lowpass', 520); this._tone(80, 0.1, 0.2, 'sine', 50); }
  hitMetal() { this._tone(1800, 0.09, 0.16, 'square', 900); this._noise(0.08, 0.2, 'highpass', 3200); }
  zombieDie() { this._tone(150, 0.5, 0.22, 'sawtooth', 60); this._noise(0.4, 0.22, 'lowpass', 600); }
  growl() { this._tone(70 + Math.random() * 30, 0.55, 0.14, 'sawtooth', 45); }
  zombieAlert() { this._tone(200, 0.35, 0.2, 'sawtooth', 420); }
  footstep(sprint) { this._noise(0.07, sprint ? 0.16 : 0.07, 'lowpass', 420); }
  glass() { this._noise(0.3, 0.28, 'highpass', 4200); this._tone(3400, 0.14, 0.1, 'square', 2400); }
  wood() { this._noise(0.18, 0.3, 'bandpass', 900, 3); }
  pickup() { this._tone(660, 0.07, 0.13, 'square'); setTimeout(() => this._tone(920, 0.07, 0.11, 'square'), 60); }
  eat() { this._noise(0.25, 0.18, 'lowpass', 700); }
  drink() { this._noise(0.3, 0.16, 'bandpass', 500, 2); }
  heal() { this._tone(520, 0.12, 0.12, 'sine'); setTimeout(() => this._tone(780, 0.16, 0.1, 'sine'), 110); }
  door() { this._noise(0.22, 0.24, 'bandpass', 420, 2); }
  ui() { this._tone(440, 0.04, 0.07, 'square'); }
  levelUp() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 0.12, 'triangle'), i * 110)); }
  playerHurt() { this._tone(220, 0.22, 0.22, 'sawtooth', 120); this._noise(0.2, 0.25, 'lowpass', 700); }
  molotov() { this._noise(0.7, 0.4, 'lowpass', 1100); }

  // looping rain
  startRain() {
    if (!this.ensure() || this.rain) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = this.ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 1400; flt.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.value = 0.0;
    g.gain.setTargetAtTime(0.16, this.ctx.currentTime, 1.2);
    src.connect(flt); flt.connect(g); g.connect(this.master);
    src.start();
    this.rain = { src, g };
  }

  stopRain() {
    if (!this.rain) return;
    try {
      this.rain.g.gain.setTargetAtTime(0.0, this.ctx.currentTime, 0.6);
      this.rain.src.stop(this.ctx.currentTime + 2);
    } catch (e) { /* already stopped */ }
    this.rain = null;
  }
}
