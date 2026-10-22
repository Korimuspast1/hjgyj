/* jsdom-обвязка для прогона игры «NOVA X5 Pro» без браузера.
   Поднимает index.html, подставляет недостающие в jsdom API (WebAudio, pointer-события,
   performance, localStorage), затем импортирует js/main.js — игра запускается как в браузере.

   Экспортирует: window D state api S wait log ev q qa click dragIt errors
   Все JS-ошибки игры собираются в массив `errors`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

export const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('JSDOM_ERROR: ' + (e.stack || e.message)));
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));
vc.on('warn', () => {});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost/',
  virtualConsole: vc
});
export const window = dom.window;
export const D = window.document;

/* ---------------- полифилы ---------------- */
function setProp(obj, key, val) {
  try { obj[key] = val; } catch { Object.defineProperty(obj, key, { value: val, configurable: true, writable: true }); }
}
if (!window.matchMedia) setProp(window, 'matchMedia', () => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));
if (!window.requestAnimationFrame) setProp(window, 'requestAnimationFrame', (cb) => setTimeout(() => cb(Date.now()), 16));
if (!window.cancelAnimationFrame) setProp(window, 'cancelAnimationFrame', (id) => clearTimeout(id));
window.HTMLElement.prototype.setPointerCapture = function () {};
window.HTMLElement.prototype.releasePointerCapture = function () {};
window.HTMLElement.prototype.scrollIntoView = function () {};
Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', { get() { return 390; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', { get() { return 844; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', { get() { return 390; }, configurable: true });
Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', { get() { return 844; }, configurable: true });
window.Element.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 844, width: 390, height: 844 };
};
window.navigator.vibrate = () => true;
setProp(window.navigator, 'clipboard', { writeText: async () => {} });

/* WebAudio: полностью синтетический, чтобы не тянуть звук в тесты */
class FakeParam {
  constructor(v) { this.value = v; }
  setValueAtTime() { return this; }
  exponentialRampToValueAtTime() { return this; }
  linearRampToValueAtTime() { return this; }
  cancelScheduledValues() { return this; }
  setTargetAtTime() { return this; }
}
const fakeNode = (extra = {}) => ({ connect() { return this; }, disconnect() {}, start() {}, stop() {}, ...extra });
class FakeAudioContext {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = fakeNode(); }
  resume() { return Promise.resolve(); }
  suspend() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
  createOscillator() { return fakeNode({ type: 'sine', frequency: new FakeParam(440), detune: new FakeParam(0), onended: null }); }
  createGain() { return fakeNode({ gain: new FakeParam(1) }); }
  createBiquadFilter() { return fakeNode({ type: 'lowpass', frequency: new FakeParam(1000), Q: new FakeParam(1), detune: new FakeParam(0) }); }
  createBufferSource() { return fakeNode({ buffer: null, loop: false, playbackRate: new FakeParam(1) }); }
  createBuffer(ch, len, rate) { return { numberOfChannels: ch, length: len, sampleRate: rate, duration: len / (rate || 44100), getChannelData: () => new Float32Array(len) }; }
  createDynamicsCompressor() { return fakeNode({ threshold: new FakeParam(0), knee: new FakeParam(0), ratio: new FakeParam(1), attack: new FakeParam(0), release: new FakeParam(0), reduction: 0 }); }
  createStereoPanner() { return fakeNode({ pan: new FakeParam(0) }); }
  createWaveShaper() { return fakeNode({ curve: null, oversample: 'none' }); }
  createDelay() { return fakeNode({ delayTime: new FakeParam(0) }); }
  createConvolver() { return fakeNode({ buffer: null }); }
  createAnalyser() { return fakeNode({ fftSize: 2048, frequencyBinCount: 1024, getByteFrequencyData() {}, getByteTimeDomainData() {} }); }
  createMediaElementSource() { return fakeNode(); }
}
setProp(window, 'AudioContext', FakeAudioContext);
setProp(window, 'webkitAudioContext', FakeAudioContext);

/* localStorage в памяти */
const store = new Map();
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i],
    get length() { return store.size; }
  },
  configurable: true
});

/* Глобалы: код игры обращается к ним напрямую.
   Event/CustomEvent обязаны быть jsdom-овскими, иначе dispatchEvent(new Event(...)) падает. */
const G = {
  window, document: window.document, navigator: window.navigator, localStorage: window.localStorage,
  requestAnimationFrame: window.requestAnimationFrame, cancelAnimationFrame: window.cancelAnimationFrame,
  Event: window.Event, CustomEvent: window.CustomEvent, KeyboardEvent: window.KeyboardEvent,
  PointerEvent: window.PointerEvent || window.MouseEvent, UIEvent: window.UIEvent,
  HTMLElement: window.HTMLElement, Element: window.Element, Node: window.Node, MouseEvent: window.MouseEvent,
  getComputedStyle: window.getComputedStyle, AudioContext: FakeAudioContext, matchMedia: window.matchMedia
};
for (const [k, v] of Object.entries(G)) {
  try { global[k] = v; } catch { Object.defineProperty(global, k, { value: v, configurable: true, writable: true }); }
}
const perfStub = { now: () => Date.now(), timeOrigin: Date.now() };
for (const tgt of [global, window]) {
  try { Object.defineProperty(tgt, 'performance', { value: perfStub, configurable: true, writable: true }); } catch {}
}

/* ---------------- запуск игры ---------------- */
await import('file://' + path.join(ROOT, 'js/main.js'));
await new Promise((r) => setTimeout(r, 320));

export const state = await import('file://' + path.join(ROOT, 'js/state.js'));
export const api = (await import('file://' + path.join(ROOT, 'js/api.js'))).api;
export const S = () => state.getState();
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const log = (...a) => console.log(...a);
export const ev = (n, t, o = {}) => {
  if (!n) throw new Error('ev(): элемент не найден для события «' + t + '»');
  return n.dispatchEvent(new window.MouseEvent(t, { bubbles: true, cancelable: true, ...o }));
};
export const q = (s) => D.querySelector(s);
export const qa = (s) => (typeof s === 'string' ? [...D.querySelectorAll(s)] : [...s]);
export const click = (sel) => { const n = typeof sel === 'string' ? q(sel) : sel; if (!n) return false; ev(n, 'click'); return true; };
export function dragIt(sel, dx, dy) {
  const n = typeof sel === 'string' ? q(sel) : sel;
  if (!n) return false;
  ev(n, 'pointerdown', { clientX: 200, clientY: 400, pointerId: 1 });
  ev(window, 'pointermove', { clientX: 200 + dx, clientY: 400 + dy, pointerId: 1 });
  ev(n, 'pointermove', { clientX: 200 + dx, clientY: 400 + dy, pointerId: 1 });
  ev(window, 'pointerup', { clientX: 200 + dx, clientY: 400 + dy, pointerId: 1 });
  ev(n, 'pointerup', { clientX: 200 + dx, clientY: 400 + dy, pointerId: 1 });
  return true;
}
/* длинное нажатие (для контекстных меню и удержания кнопок) */
export async function longPress(sel, ms = 900) {
  const n = typeof sel === 'string' ? q(sel) : sel;
  if (!n) return false;
  ev(n, 'pointerdown', { clientX: 150, clientY: 400, pointerId: 1 });
  await wait(ms);
  ev(n, 'pointerup', { clientX: 150, clientY: 400, pointerId: 1 });
  await wait(400);
  return true;
}
export const mod = async (rel) => import('file://' + path.join(ROOT, rel));
