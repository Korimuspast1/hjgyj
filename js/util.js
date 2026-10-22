import { getState } from './state.js';

/* ---------------- DOM ---------------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids.flat(9)) {
    if (kid === null || kid === undefined || kid === false) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return n;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

export function onLongPress(node, onLong, onClick, ms = 520) {
  let timer = null, fired = false, sx = 0, sy = 0, active = false;
  const start = (e) => {
    if (active) return;                 // защита от дублей (pointer + mouse)
    active = true;
    fired = false;
    const p = e.touches ? e.touches[0] : e;
    sx = p.clientX; sy = p.clientY;
    timer = setTimeout(() => { fired = true; if (navigator.vibrate) navigator.vibrate(14); onLong?.(e); }, ms);
  };
  const move = (e) => {
    if (!active) return;
    const p = e.touches ? e.touches[0] : e;
    if (Math.abs(p.clientX - sx) > 12 || Math.abs(p.clientY - sy) > 12) { clearTimeout(timer); timer = null; }
  };
  const end = (e) => {
    if (!active) return;
    active = false;
    clearTimeout(timer); timer = null;
    if (!fired && onClick) { onClick(e); }
    if (fired) e.preventDefault?.();
  };
  const cancel = () => { active = false; clearTimeout(timer); timer = null; };
  // pointer-события покрывают мышь, палец и стилус; mouse/touch — запасной вариант
  node.addEventListener('pointerdown', start);
  node.addEventListener('pointermove', move);
  node.addEventListener('pointerup', end);
  node.addEventListener('pointercancel', cancel);
  node.addEventListener('mousedown', start);
  node.addEventListener('touchstart', start, { passive: true });
  node.addEventListener('mousemove', move);
  node.addEventListener('touchmove', move, { passive: true });
  node.addEventListener('mouseup', end);
  node.addEventListener('mouseleave', cancel);
  node.addEventListener('touchend', end);
  node.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function holdProgress(node, onDone, ms = 1100, onTick) {
  let raf = null, t0 = 0, active = false;
  const step = (t) => {
    if (!active) return;
    const p = Math.min(1, (t - t0) / ms);
    onTick?.(p);
    if (p >= 1) { active = false; onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  const start = (e) => {
    if (active) return;
    e.preventDefault?.();
    active = true; t0 = performance.now();
    raf = requestAnimationFrame(step);
  };
  const cancel = () => { if (!active) return; active = false; cancelAnimationFrame(raf); onTick?.(0); };
  node.addEventListener('pointerdown', start);
  node.addEventListener('touchstart', start, { passive: false });
  node.addEventListener('mousedown', start);
  ['pointerup', 'pointercancel', 'mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((ev) => node.addEventListener(ev, cancel));
  return { cancel };
}

export function drag(node, handlers) {
  let dragging = false, sx = 0, sy = 0, id = null;
  node.addEventListener('pointerdown', (e) => {
    dragging = true; sx = e.clientX; sy = e.clientY; id = e.pointerId;
    node.setPointerCapture?.(id);
    handlers.start?.(e, sx, sy);
  });
  node.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    handlers.move?.(e, e.clientX - sx, e.clientY - sy);
  });
  const up = (e) => {
    if (!dragging) return;
    dragging = false;
    handlers.end?.(e, e.clientX - sx, e.clientY - sy);
  };
  node.addEventListener('pointerup', up);
  node.addEventListener('pointercancel', up);
}

/* ---------------- формат ---------------- */
export const pad2 = (n) => String(Math.floor(Math.abs(n))).padStart(2, '0');

export function fmtMoney(n) {
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}
export function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${pad2(m)}:${pad2(s)}`;
}
export function fmtSize(mb) {
  if (mb >= 1024) return (mb / 1024).toFixed(2) + ' ГБ';
  return mb.toFixed(mb < 10 ? 2 : 0) + ' МБ';
}

const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const DAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/* ---------------- игровое время ---------------- */
export function gameDate() { return new Date(getState().time.gameMs); }
export function fmtTime(d = gameDate()) { return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; }
export function fmtDateFull(d = gameDate()) { return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function fmtDateShort(d = gameDate()) { return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`; }
export function fmtDayShort(d = gameDate()) { return `${DAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`; }
export function monthName(m) { return MONTHS_NOM[m]; }
export function dayShort(i) { return DAYS_SHORT[i]; }

export function timeAgo(ms) {
  const diff = Math.max(0, getState().time.gameMs - ms);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} дн назад`;
  return fmtDateShort(new Date(ms));
}
export function chatStamp(ms) {
  const d = new Date(ms);
  const now = gameDate();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return fmtTime(d);
  const yest = new Date(now.getTime() - 86400000);
  if (d.toDateString() === yest.toDateString()) return 'вчера';
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
}

export function isNight(d = gameDate()) { const h = d.getHours(); return h >= 21 || h < 6; }
export function partOfDay(d = gameDate()) {
  const h = d.getHours() + d.getMinutes() / 60;
  if (h < 5) return 'night';
  if (h < 8) return 'dawn';
  if (h < 17) return 'day';
  if (h < 20.5) return 'sunset';
  return 'night';
}

/* ---------------- прочее ---------------- */
export const rnd = (a, b) => a + Math.random() * (b - a);
export const rndInt = (a, b) => Math.floor(rnd(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function plural(n, forms) {
  // [1, 2, 5] -> минута, минуты, минут
  const n10 = n % 10, n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return forms[0];
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
  return forms[2];
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
