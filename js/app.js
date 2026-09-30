'use strict';

/* ============================================================
   CaseArena — логика приложения
   Кликер → баланс → кейсы → рулетка → инвентарь → продажа
   ============================================================ */

/* ---------------- Утилиты ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const round2 = (n) => Math.round(n * 100) / 100;

function money(n) {
  if (!isFinite(n)) return '$0';
  if (n >= 10000) return '$' + Math.round(n).toLocaleString('ru-RU');
  const v = round2(n);
  return '$' + (+v.toFixed(2)).toLocaleString('ru-RU');
}

function hash01(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

const rand = (a, b) => a + Math.random() * (b - a);

function pickWeighted(entries) {
  let sum = 0;
  for (const [, w] of entries) sum += w;
  let r = Math.random() * sum;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Заглушка, если картинка скина не загрузилась (кастомный SVG) */
const PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 90"><rect width="120" height="90" rx="10" fill="#171e2c"/><g fill="none" stroke="#33405a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="42" y="24" width="36" height="27" rx="4"/><path d="M42 33h36"/><rect x="54" y="28.5" width="12" height="9" rx="2"/></g></svg>'
  );

const imgTag = (src, cls = '', alt = '') =>
  `<img ${cls ? `class="${cls}" ` : ''}src="${esc(src || PLACEHOLDER)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;

/* ============================================================
   КОНСТАНТЫ
   ============================================================ */
const SAVE_KEY = 'casearena-save-v1';

/* Уровни редкости (tier) — как в CS2, с ценовыми диапазонами (игровая валюта) */
const TIERS = [
  { name: 'Обычное качество',      color: '#b0c3d9', range: [0.8, 4] },
  { name: 'Промышленное качество', color: '#5e98d9', range: [2.5, 12] },
  { name: 'Армейское качество',    color: '#4b69ff', range: [8, 45] },
  { name: 'Запрещённое',           color: '#8847ff', range: [32, 160] },
  { name: 'Засекреченное',         color: '#d32ce6', range: [130, 700] },
  { name: 'Тайное',                color: '#eb4b4d', range: [550, 3400] },
  { name: '★ Ножи',                color: '#eb4b4d', range: [2800, 28000] },
  { name: '★ Перчатки',            color: '#eb4b4d', range: [3500, 36000] },
  { name: 'Контрабанда',           color: '#e4ae39', range: [9000, 65000] },
];

/* Износ */
const WEARS = [
  { name: 'Прямо с завода',          short: 'FN', max: 0.07, mult: 1.7 },
  { name: 'Немного поношенное',      short: 'MW', max: 0.15, mult: 1.35 },
  { name: 'После полевых испытаний', short: 'FT', max: 0.38, mult: 1.0 },
  { name: 'Поношенное',              short: 'WW', max: 0.45, mult: 0.8 },
  { name: 'Закалённое в боях',       short: 'BS', max: 1.0,  mult: 0.65 },
];

const ST_MULT = 1.9;   // множитель цены StatTrak™
const SV_MULT = 1.5;   // множитель цены сувенирных
const ST_CHANCE = 0.1; // шанс StatTrak™ из обычного кейса
const SV_CHANCE = 0.06;// шанс сувенирной версии

/* Определения кейсов: tiers — вес редкости в дропе */
const CASE_DEFS = [
  { id: 'starter', name: 'Кейс новичка', icon: 'case', accent: '#8b94a7',
    desc: 'Простые скины для старта. Дёшево и сердито.',
    tiers: { 0: 55, 1: 30, 2: 15 }, margin: 1.1 },
  { id: 'army', name: 'Армейский кейс', icon: 'shield', accent: '#5e98d9',
    desc: 'Армейское качество и шанс на Запрещённое.',
    tiers: { 2: 78, 3: 20, 4: 2 }, margin: 1.18 },
  { id: 'pistol', name: 'Пистолетный кейс', icon: 'pistol', accent: '#4b69ff',
    desc: 'Только пистолеты: от Glock-18 до Desert Eagle.',
    classes: ['pistol'], tiers: { 0: 35, 1: 22, 2: 25, 3: 12, 4: 5, 5: 0.9, 6: 0.1 }, margin: 1.2 },
  { id: 'smg', name: 'Кейс «Скорострел»', icon: 'speed', accent: '#3dd68c',
    desc: 'Пистолеты-пулемёты — ураганная скорострельность.',
    classes: ['smg'], tiers: { 1: 14, 2: 52, 3: 21, 4: 10, 5: 2.7, 6: 0.3 }, margin: 1.2 },
  { id: 'heavy', name: 'Тяжёлый кейс', icon: 'ammo', accent: '#c96a4a',
    desc: 'Дробовики и пулемёты — тяжёлая артиллерия.',
    classes: ['heavy'], tiers: { 1: 18, 2: 50, 3: 21, 4: 8.5, 5: 2.3, 6: 0.2 }, margin: 1.2 },
  { id: 'rifle', name: 'Винтовочный кейс', icon: 'rifle', accent: '#ff9f1a',
    desc: 'AK-47, M4A4 и другие винтовки. Есть шанс на M4A4 | Howl!',
    classes: ['rifle'], tiers: { 2: 55, 3: 26, 4: 13, 5: 5.4, 6: 0.55, 8: 0.05 }, margin: 1.2 },
  { id: 'sniper', name: 'Снайперский кейс', icon: 'crosshair', accent: '#37c8e8',
    desc: 'AWP, SSG 08, SCAR-20 и G3SG1. Здесь живёт Dragon Lore.',
    classes: ['sniper'], tiers: { 2: 50, 3: 26, 4: 14, 5: 8.7, 6: 0.8 }, margin: 1.22 },
  { id: 'restricted', name: 'Запрещённый кейс', icon: 'lock', accent: '#8847ff',
    desc: 'Запрещённое качество и выше.',
    tiers: { 3: 76, 4: 20, 5: 4 }, margin: 1.22 },
  { id: 'classified', name: 'Засекреченный кейс', icon: 'eye', accent: '#d32ce6',
    desc: 'Засекреченное, Тайное и шанс на нож.',
    tiers: { 4: 74, 5: 21, 6: 5 }, margin: 1.24 },
  { id: 'covert', name: 'Тайный кейс', icon: 'star', accent: '#eb4b4d',
    desc: 'Тайное качество, ножи и микрошанс на Howl. Для счастливчиков.',
    tiers: { 5: 87, 6: 12.5, 8: 0.5 }, margin: 1.25 },
  { id: 'stattrak', name: 'StatTrak™ кейс', icon: 'gauge', accent: '#ffb84d',
    desc: 'Каждый дроп со счётчиком StatTrak™.',
    forceST: true, tiers: { 2: 52, 3: 30, 4: 13, 5: 4.6, 6: 0.4 }, margin: 1.18 },
  { id: 'souvenir', name: 'Сувенирный кейс', icon: 'gift', accent: '#ffd23f',
    desc: 'Сувенирные версии скинов с турниров. Даже Dragon Lore.',
    svOnly: true, tiers: { 1: 18, 2: 47, 3: 23, 4: 9, 5: 2.7, 6: 0.3 }, margin: 1.18 },
  { id: 'knife', name: 'Кейс «Ножи»', icon: 'knife', accent: '#eb4b4d',
    desc: 'Только ножи. 100% нож. Да, это легально.',
    tiers: { 6: 100 }, margin: 1.16 },
  { id: 'gloves', name: 'Кейс «Перчатки»', icon: 'glove', accent: '#eb4b4d',
    desc: 'Экстраординарные перчатки — от Sport до Specialist.',
    tiers: { 7: 100 }, margin: 1.16 },
  { id: 'gold', name: 'Золотой кейс', icon: 'crown', accent: '#ffd23f',
    desc: 'Только топ: Тайное, ножи, перчатки и Howl.',
    tiers: { 5: 44, 6: 34, 7: 19, 8: 3 }, margin: 1.22 },
];

/* Рулетка */
const ROUL_CFG = { CARDS: 62, WIN_INDEX: 52, DURATION: 6800 };

/* ============================================================
   СОСТОЯНИЕ
   ============================================================ */
function defaultState() {
  return {
    v: 1,
    balance: 250,
    clickLevel: 0,
    critLevel: 0,
    autoLevel: 0,
    fast: false,
    sound: true,
    welcomed: false,
    seq: 1,
    inventory: [],   // {u, s, f, st, sv, p, ts}
    recent: [],      // {s, p, f, st, sv, ts}
    stats: { clicks: 0, opened: 0, earnedClicks: 0, earnedAuto: 0, sold: 0, best: null },
  };
}

let state = (() => {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    const merged = Object.assign(base, saved);
    merged.stats = Object.assign(defaultState().stats, saved.stats || {});
    merged.inventory = Array.isArray(saved.inventory) ? saved.inventory : [];
    merged.recent = Array.isArray(saved.recent) ? saved.recent : [];
    return merged;
  } catch {
    return base;
  }
})();

let saveTimer = null;
function save() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    doSave();
  }, 500);
}
function doSave() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch { /* приватный режим — играем без сохранения */ }
}
window.addEventListener('beforeunload', doSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') doSave();
});

/* ============================================================
   ЭКОНОМИКА КЛИКЕРА
   ============================================================ */
function clickPower(L = state.clickLevel) {
  return Math.max(1, Math.round((1 + 0.55 * L) * Math.pow(1.09, L)));
}
function critChance(L = state.critLevel) {
  return Math.min(0.45, 0.03 + 0.012 * L);
}
function autoRate(L = state.autoLevel) {
  return L <= 0 ? 0 : Math.round(5 * Math.pow(1.42, L - 1));
}

const UPGRADES = [
  {
    id: 'clickLevel', name: 'Сила клика', icon: 'cursor', max: 60,
    cost: (L) => Math.round(75 * Math.pow(1.42, L)),
    desc: (L) => `Сейчас <b>${money(clickPower(L))}</b> за клик → станет <b>${money(clickPower(L + 1))}</b>`,
  },
  {
    id: 'critLevel', name: 'Шанс крита', icon: 'bolt', max: 30,
    cost: (L) => Math.round(150 * Math.pow(1.55, L)),
    desc: (L) => `Сейчас <b>${(critChance(L) * 100).toFixed(1)}%</b> → <b>${(critChance(L + 1) * 100).toFixed(1)}%</b> (крит даёт ×10)`,
  },
  {
    id: 'autoLevel', name: 'Дроп-ферма', icon: 'coins', max: 40,
    cost: (L) => Math.round(400 * Math.pow(1.45, L)),
    desc: (L) => `Сейчас <b>${money(autoRate(L))}/сек</b> → станет <b>${money(autoRate(L + 1))}/сек</b> пассивно`,
  },
];

/* ============================================================
   ЦЕНООБРАЗОВАНИЕ СКИНОВ
   ============================================================ */
const basePriceCache = new Map();

function basePrice(skin) {
  let v = basePriceCache.get(skin.id);
  if (v === undefined) {
    const [lo, hi] = TIERS[skin.t].range;
    // детерминированная «рыночная цена» каждого скина: дешёвых больше
    v = lo + Math.pow(hash01('base:' + skin.id), 1.5) * (hi - lo);
    basePriceCache.set(skin.id, v);
  }
  return v;
}

function wearIndex(f) {
  for (let i = 0; i < WEARS.length; i++) if (f < WEARS[i].max) return i;
  return WEARS.length - 1;
}

function canWear(skin) {
  return skin.a !== null && skin.b !== null && skin.b > skin.a;
}

function priceOf(skin, f, st, sv) {
  let m = 1, q = 1;
  if (f !== null && f !== undefined && canWear(skin)) {
    const wi = wearIndex(f);
    const w = WEARS[wi];
    m = w.mult;
    const lo = wi ? WEARS[wi - 1].max : 0;
    q = 1 - 0.22 * ((f - lo) / (w.max - lo || 1)); // ниже float внутри износа — дороже
  }
  let p = basePrice(skin) * m * q;
  if (st) p *= ST_MULT;
  if (sv) p *= SV_MULT;
  return Math.max(0.05, round2(p));
}

function midFloat(skin) {
  return canWear(skin) ? (skin.a + skin.b) / 2 : null;
}

function niceRound(v) {
  if (v < 10) return Math.round(v * 10) / 10;
  if (v < 100) return Math.round(v);
  if (v < 1000) return Math.round(v / 5) * 5;
  if (v < 10000) return Math.round(v / 25) * 25;
  if (v < 100000) return Math.round(v / 100) * 100;
  return Math.round(v / 500) * 500;
}

/* ============================================================
   ДАННЫЕ И КЕЙСЫ
   ============================================================ */
let SKINS = [];
let SKIN_BY_ID = new Map();
let CASES = [];

function buildCases() {
  CASES = CASE_DEFS.map((def) => {
    const pool = SKINS.filter(
      (s) =>
        (def.forceST ? s.st === 1 : true) &&
        (def.svOnly ? s.sv === 1 : true) &&
        (!def.classes || def.classes.includes(s.cl)) &&
        def.tiers[s.t] !== undefined
    );

    // группируем по редкости
    const groups = new Map();
    for (const s of pool) {
      if (!groups.has(s.t)) groups.set(s.t, []);
      groups.get(s.t).push(s);
    }

    const tierEntries = []; // {tier, weight, weighted:[[skin,w]]}
    let ev = 0;
    let totalW = 0;
    for (const key of Object.keys(def.tiers)) {
      const t = +key;
      const w = def.tiers[t];
      const arr = groups.get(t);
      if (!arr || !arr.length) continue;
      // внутри редкости дешёвые скины выпадают чаще
      const hi = TIERS[t].range[1];
      let sw = 0, sep = 0;
      const weighted = arr.map((s) => {
        const wt = Math.pow(hi / basePrice(s), 0.45);
        sw += wt;
        sep += wt * priceOf(s, midFloat(s), false, false);
        return [s, wt];
      });
      tierEntries.push({ tier: t, weight: w, weighted });
      totalW += w;
      ev += w * (sep / sw);
    }
    ev /= totalW || 1;

    // ожидаемые множители StatTrak/сувенира
    let mod = 1;
    if (def.forceST) mod *= ST_MULT;
    else mod *= 1 + ST_CHANCE * (ST_MULT - 1);
    if (def.svOnly) mod *= SV_MULT;
    else mod *= 1 + SV_CHANCE * (SV_MULT - 1);

    const price = niceRound(ev * mod * def.margin);
    return { ...def, pool, tierEntries, totalW, ev: ev * mod, price, count: pool.length };
  }).filter((c) => c.count > 0);
}

function rollSkin(c) {
  const tier = pickWeighted(c.tierEntries.map((te) => [te, te.weight]));
  return pickWeighted(tier.weighted); // entries = [[skin, weight], ...] → вернёт скин
}

function rollDrop(c) {
  const skin = rollSkin(c);
  const f = canWear(skin) ? rand(skin.a, skin.b) : (skin.a ?? null);
  let st = false, sv = false;
  if (c.svOnly) {
    sv = true;
  } else if (c.forceST) {
    st = true;
  } else {
    if (skin.st === 1 && Math.random() < ST_CHANCE) st = true;
    else if (skin.sv === 1 && Math.random() < SV_CHANCE) sv = true;
  }
  return { skin, f, st, sv, price: priceOf(skin, f, st, sv) };
}

/* ============================================================
   ЗВУК (WebAudio, синтез на лету)
   ============================================================ */
const sfx = (() => {
  let ctx = null;
  function ensure() {
    if (!state.sound) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC(); } catch { return null; }
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.08, delay = 0, slide = 0) {
    const c = ensure();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  const bank = {
    click: () => tone(660 + Math.random() * 120, 0.055, 'triangle', 0.045),
    crit: () => { tone(520, 0.09, 'square', 0.055); tone(1180, 0.16, 'square', 0.05, 0.05); },
    buy: () => { tone(620, 0.08, 'triangle', 0.07); tone(930, 0.12, 'triangle', 0.07, 0.08); },
    sell: () => { tone(1080, 0.07, 'triangle', 0.07); tone(1560, 0.13, 'triangle', 0.07, 0.06); },
    error: () => tone(150, 0.2, 'sawtooth', 0.05),
    open: () => tone(240, 0.6, 'sawtooth', 0.03, 0, 620),
    win: () => { tone(587, 0.12, 'triangle', 0.08); tone(784, 0.16, 'triangle', 0.08, 0.1); },
    winMid: () => { tone(587, 0.11, 'triangle', 0.08); tone(784, 0.11, 'triangle', 0.08, 0.09); tone(1175, 0.2, 'triangle', 0.08, 0.18); },
    winBig: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.24, 'triangle', 0.09, i * 0.09)); tone(2093, 0.4, 'sine', 0.05, 0.5); },
  };
  return (name) => {
    try { bank[name] && bank[name](); } catch { /* no sound — не беда */ }
  };
})();

/* ============================================================
   ТОСТЫ / ДИАЛОГИ
   ============================================================ */
function toast(msg, type = 'ok') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  const icon = type === 'error' ? 'warn' : type === 'ok' ? 'check' : 'info';
  el.innerHTML = `<svg class="icon"><use href="#i-${icon}"/></svg><span>${esc(msg)}</span>`;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 320);
  }, 2600);
}

function confirmDialog(text, okLabel = 'Да') {
  return new Promise((resolve) => {
    const overlay = $('#confirmOverlay');
    $('#confirmText').textContent = text;
    $('#confirmYes').textContent = okLabel;
    overlay.classList.remove('hidden');
    const done = (val) => {
      overlay.classList.add('hidden');
      $('#confirmYes').onclick = null;
      $('#confirmNo').onclick = null;
      resolve(val);
    };
    $('#confirmYes').onclick = () => done(true);
    $('#confirmNo').onclick = () => done(false);
  });
}

/* ============================================================
   БАЛАНС
   ============================================================ */
let shownBalance = state.balance;

function addBalance(v) {
  state.balance = Math.max(0, round2(state.balance + v));
  save();
}

function pulseBalance(mode = 'pulse') {
  const box = $('#balanceBox');
  box.classList.remove('pulse', 'deny');
  void box.offsetWidth;
  box.classList.add(mode);
}

function balanceLoop() {
  if (Math.abs(shownBalance - state.balance) >= 0.005) {
    shownBalance += (state.balance - shownBalance) * 0.16;
    if (Math.abs(shownBalance - state.balance) < 0.01) shownBalance = state.balance;
    $('#balanceValue').textContent = money(shownBalance);
  }
  requestAnimationFrame(balanceLoop);
}

/* ============================================================
   РЕНДЕР: ШАПКА / ГЕРОЙ
   ============================================================ */
function invValue() {
  return state.inventory.reduce((s, i) => s + i.p, 0);
}

function renderHeader() {
  $('#invBadge').textContent = state.inventory.length;
  $('#balanceValue').textContent = money(shownBalance);
}

function renderHero() {
  const best = state.stats.best;
  const bestSkin = best && SKIN_BY_ID.get(best.s);
  $('#heroStats').innerHTML = `
    <div class="hero-stat"><b>${state.stats.opened.toLocaleString('ru-RU')}</b><span>кейсов открыто</span></div>
    <div class="hero-stat"><b>${money(invValue())}</b><span>стоимость инвентаря</span></div>
    <div class="hero-stat best">
      ${bestSkin ? imgTag(bestSkin.g, '', bestSkin.n) : ''}
      <b>${bestSkin ? esc(bestSkin.n) : '—'}</b>
      <span>лучший дроп ${best ? '• ' + money(best.p) : ''}</span>
    </div>`;
}

function renderRecent() {
  const wrap = $('#recentWrap');
  if (!state.recent.length) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  $('#recentList').innerHTML = state.recent
    .map((it) => {
      const s = SKIN_BY_ID.get(it.s);
      if (!s) return '';
      const wi = it.f !== null && it.f !== undefined ? wearIndex(it.f) : null;
      return `<div class="recent-item" style="--rc:${TIERS[s.t].color}" title="${esc(s.n)}${wi !== null ? ' (' + WEARS[wi].short + ')' : ''}">
        ${imgTag(s.g, '', s.n)}
        <div class="r-name">${esc(s.n)}</div>
        <div class="r-price">${money(it.p)}</div>
      </div>`;
    })
    .join('');
}

/* ============================================================
   РЕНДЕР: КЕЙСЫ
   ============================================================ */
function caseCardHTML(c) {
  const dots = c.tierEntries
    .map(
      (te) =>
        `<span class="dot" style="--rc:${TIERS[te.tier].color}" title="${esc(TIERS[te.tier].name)}"></span>`
    )
    .join('');
  return `<article class="case-card" data-case="${c.id}" style="--ac:${c.accent}">
    <div class="case-icon"><svg class="icon"><use href="#i-${c.icon}"/></svg></div>
    <h3 class="case-name">${esc(c.name)}</h3>
    <p class="case-desc">${esc(c.desc)}</p>
    <div class="case-dots">${dots}<span class="case-count">${c.count} скинов</span></div>
    <div class="case-foot">
      <span class="case-price"><svg class="icon"><use href="#i-coin"/></svg>${money(c.price)}</span>
      <button class="btn btn-sm" data-open="${c.id}">Открыть</button>
    </div>
  </article>`;
}

function renderCases() {
  $('#casesGrid').innerHTML = CASES.map(caseCardHTML).join('');
}

function pctStr(w) {
  const p = w * 100;
  if (p < 0.1) return '<0.1%';
  return (p < 1 ? p.toFixed(2) : p.toFixed(1)).replace('.', ',') + '%';
}

function showCaseModal(id) {
  const c = CASES.find((x) => x.id === id);
  if (!c) return;
  CURRENT_CASE = c.id;
  const modal = $('#caseOverlay .case-modal');
  modal.style.setProperty('--ac', c.accent);
  $('#cmIcon').innerHTML = `<svg class="icon"><use href="#i-${c.icon}"/></svg>`;
  $('#cmName').textContent = c.name;
  $('#cmDesc').textContent = `${c.desc} Внутри ${c.count} скинов.`;

  const maxW = Math.max(...c.tierEntries.map((te) => te.weight));
  $('#cmOdds').innerHTML = c.tierEntries
    .slice()
    .sort((a, b) => b.tier - a.tier)
    .map(
      (te) => `<div class="odds-row" style="--rc:${TIERS[te.tier].color}">
        <div class="odds-label"><i></i>${esc(TIERS[te.tier].name)}</div>
        <div class="odds-bar"><div class="odds-fill" style="width:${Math.max(2, (te.weight / maxW) * 100)}%"></div></div>
        <div class="odds-val">${pctStr(te.weight / c.totalW)}</div>
      </div>`
    )
    .join('');

  $('#cmPool').innerHTML = c.tierEntries
    .slice()
    .sort((a, b) => b.tier - a.tier)
    .map((te) => {
      const sample = te.weighted.slice().sort(() => Math.random() - 0.5).slice(0, 10);
      return `<div class="pool-tier" style="--rc:${TIERS[te.tier].color}">
        <div class="pool-label">${esc(TIERS[te.tier].name)} — ${te.weighted.length}</div>
        <div class="pool-items">
          ${sample.map(([s]) => `<div class="pool-item" title="${esc(s.n)}">${imgTag(s.g, '', s.n)}<span>${esc(s.n)}</span></div>`).join('')}
          ${te.weighted.length > sample.length ? `<span class="pool-more">и ещё ${te.weighted.length - sample.length}…</span>` : ''}
        </div>
      </div>`;
    })
    .join('');

  $('#cmOpenBtn').innerHTML = `<svg class="icon"><use href="#i-case"/></svg><span>Открыть за ${money(c.price)}</span>`;
  $('#caseOverlay').classList.remove('hidden');
}

/* ============================================================
   ОТКРЫТИЕ КЕЙСА И РУЛЕТКА
   ============================================================ */
let CURRENT_CASE = null;
let CURRENT_SELL = null;
const ROUL = { active: false, done: false, target: 0, timer: null, case_: null, item: null, drop: null };

function openCaseById(id) {
  const c = CASES.find((x) => x.id === id);
  if (c) openCase(c);
}

function openCase(c) {
  if (ROUL.active) return;
  if (state.balance < c.price) {
    toast('Недостаточно средств! Заработай на вкладке «Заработок»', 'error');
    sfx('error');
    pulseBalance('deny');
    return;
  }
  addBalance(-c.price);
  const drop = rollDrop(c);
  const item = {
    u: state.seq++,
    s: drop.skin.id,
    f: drop.f,
    st: drop.st,
    sv: drop.sv,
    p: drop.price,
    ts: Date.now(),
  };
  state.inventory.push(item);
  state.stats.opened++;
  if (!state.stats.best || drop.price > state.stats.best.p) {
    state.stats.best = { s: drop.skin.id, p: drop.price };
  }
  state.recent.unshift({ s: item.s, p: item.p, f: item.f, st: item.st, sv: item.sv, ts: item.ts });
  if (state.recent.length > 12) state.recent.length = 12;
  save();

  renderHeader();
  renderHero();
  renderRecent();
  renderInventory();
  renderClickerStats();

  if (state.fast) {
    finishOpen(c, item, drop);
  } else {
    runRoulette(c, item, drop);
  }
}

function roulCardHTML(skin, wearShort) {
  return `<div class="rou-card" style="--rc:${TIERS[skin.t].color}">
    ${imgTag(skin.g, '', skin.n)}
    <div class="rou-name">${esc(skin.n)}</div>
    <div class="rou-wear">${wearShort || ''}</div>
  </div>`;
}

function runRoulette(c, item, drop) {
  ROUL.active = true;
  ROUL.done = false;
  ROUL.case_ = c;
  ROUL.item = item;
  ROUL.drop = drop;

  $('#roulCaseName').textContent = c.name;
  $('#roulClose').disabled = true;
  const track = $('#roulTrack');
  track.style.transition = 'none';
  track.style.transform = 'translateX(0px)';

  const cards = [];
  for (let i = 0; i < ROUL_CFG.CARDS; i++) cards.push(rollSkin(c));
  cards[ROUL_CFG.WIN_INDEX] = drop.skin;
  track.innerHTML = cards
    .map((s) => roulCardHTML(s, s === drop.skin && drop.f !== null ? WEARS[wearIndex(drop.f)].short : ''))
    .join('');

  $('#roulOverlay').classList.remove('hidden');
  sfx('open');

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const first = track.firstElementChild;
      if (!first) return;
      const gap = parseFloat(getComputedStyle(track).gap) || 0;
      const step = first.offsetWidth + gap;
      const winEl = track.children[ROUL_CFG.WIN_INDEX];
      const windowEl = $('#roulWindow');
      const jitter = rand(-step * 0.3, step * 0.3);
      ROUL.target = -(winEl.offsetLeft + winEl.offsetWidth / 2 - (windowEl.offsetLeft + windowEl.clientWidth / 2) + jitter);

      void track.offsetWidth; // reflow, чтобы анимация запустилась заново
      track.style.transition = `transform ${ROUL_CFG.DURATION}ms cubic-bezier(.11,.72,.07,1)`;
      track.style.transform = `translateX(${ROUL.target}px)`;
      ROUL.timer = setTimeout(() => roulFinish(), ROUL_CFG.DURATION + 150);
    });
  });
}

function roulFinish() {
  if (!ROUL.active || ROUL.done) return;
  ROUL.done = true;
  clearTimeout(ROUL.timer);
  const winEl = $('#roulTrack').children[ROUL_CFG.WIN_INDEX];
  if (winEl) winEl.classList.add('won');
  winSound(ROUL.drop.skin.t);
  setTimeout(() => {
    $('#roulOverlay').classList.add('hidden');
    $('#roulClose').disabled = false;
    ROUL.active = false;
    finishOpen(ROUL.case_, ROUL.item, ROUL.drop);
  }, 620);
}

function winSound(tier) {
  if (tier >= 5) sfx('winBig');
  else if (tier >= 4) sfx('winMid');
  else sfx('win');
}

function finishOpen(c, item, drop) {
  const s = drop.skin;
  const tier = TIERS[s.t];
  const modal = $('#winModal');
  modal.style.setProperty('--rc', tier.color);
  modal.classList.toggle('big', s.t >= 5);
  $('#winTier').textContent = tier.name;
  $('#winImg').innerHTML = imgTag(s.g, '', s.n);
  $('#winName').textContent = s.n;
  const wi = drop.f !== null && drop.f !== undefined ? wearIndex(drop.f) : null;
  $('#winSub').textContent =
    (wi !== null ? WEARS[wi].name + ' • float ' + drop.f.toFixed(4) : 'Без износа') +
    ' • ' + c.name;
  $('#winBadges').innerHTML =
    (drop.st ? '<span class="badge st">StatTrak™</span>' : '') +
    (drop.sv ? '<span class="badge sv">Сувенирный</span>' : '');
  $('#winPrice').textContent = money(drop.price);
  $('#winSellBtn').innerHTML = `<svg class="icon"><use href="#i-tag"/></svg><span>Продать за ${money(drop.price)}</span>`;
  CURRENT_SELL = item;
  $('#winOverlay').classList.remove('hidden');
  if (state.fast) winSound(s.t);
}

/* ============================================================
   ИНВЕНТАРЬ
   ============================================================ */
const invState = { q: '', sort: 'new', page: 1, perPage: 120 };

function invFiltered() {
  let arr = state.inventory.slice();
  if (invState.q) {
    const q = invState.q.toLowerCase();
    arr = arr.filter((it) => (SKIN_BY_ID.get(it.s)?.n || '').toLowerCase().includes(q));
  }
  const sorters = {
    new: (a, b) => b.ts - a.ts,
    old: (a, b) => a.ts - b.ts,
    priceDesc: (a, b) => b.p - a.p,
    priceAsc: (a, b) => a.p - b.p,
    tierDesc: (a, b) => (SKIN_BY_ID.get(b.s)?.t ?? 0) - (SKIN_BY_ID.get(a.s)?.t ?? 0) || b.p - a.p,
  };
  arr.sort(sorters[invState.sort] || sorters.new);
  return arr;
}

function invCardHTML(it) {
  const s = SKIN_BY_ID.get(it.s);
  if (!s) return '';
  const c = TIERS[s.t].color;
  const wi = it.f !== null && it.f !== undefined ? wearIndex(it.f) : null;
  return `<div class="inv-card" style="--rc:${c}">
    <div class="inv-img">${imgTag(s.g, '', s.n)}</div>
    <div class="inv-tier" style="color:${c}">${esc(TIERS[s.t].name)}</div>
    <div class="inv-name" title="${esc(s.n)}">${esc(s.n)}</div>
    <div class="inv-meta">
      ${wi !== null ? `<span class="wear" title="${esc(WEARS[wi].name)}">${WEARS[wi].short} ${it.f.toFixed(3)}</span>` : '<span class="wear">без износа</span>'}
      ${it.st ? '<span class="badge st">ST™</span>' : ''}
      ${it.sv ? '<span class="badge sv">СУВ</span>' : ''}
    </div>
    <div class="inv-foot">
      <span class="inv-price">${money(it.p)}</span>
      <button class="btn-sell" data-sell="${it.u}"><svg class="icon"><use href="#i-tag"/></svg>Продать</button>
    </div>
  </div>`;
}

function renderInventory() {
  const arr = invFiltered();
  const grid = $('#invGrid');
  const empty = $('#invEmpty');
  $('#invTotal').textContent = money(invValue()) + ` • ${state.inventory.length} предм.`;
  $('#invBadge').textContent = state.inventory.length;

  if (!state.inventory.length) {
    grid.innerHTML = '';
    empty.classList.add('show');
    $('#invMoreBtn').classList.add('hidden');
    return;
  }
  empty.classList.remove('show');
  const show = arr.slice(0, invState.page * invState.perPage);
  grid.innerHTML = show.map(invCardHTML).join('');
  $('#invMoreBtn').classList.toggle('hidden', show.length >= arr.length);
}

function sellItem(uid, silent = false) {
  const i = state.inventory.findIndex((x) => x.u === uid);
  if (i < 0) return 0;
  const it = state.inventory[i];
  state.inventory.splice(i, 1);
  addBalance(it.p);
  state.stats.sold = round2(state.stats.sold + it.p);
  if (!silent) {
    const s = SKIN_BY_ID.get(it.s);
    toast(`Продано: ${s ? s.n : 'скин'} за ${money(it.p)}`, 'ok');
    sfx('sell');
    pulseBalance();
  }
  save();
  renderInventory();
  renderHero();
  renderClickerStats();
  return it.p;
}

async function sellAll(filterFn = null) {
  if (!state.inventory.length) {
    toast('Инвентарь пуст', 'error');
    return;
  }
  const toSell = filterFn ? state.inventory.filter(filterFn) : state.inventory.slice();
  if (!toSell.length) {
    toast('Нечего продавать', 'error');
    return;
  }
  const sum = round2(toSell.reduce((s, i) => s + i.p, 0));
  const ok = await confirmDialog(
    `Продать ${toSell.length} ${toSell.length === 1 ? 'предмет' : 'предметов'} за ${money(sum)}?`,
    'Продать'
  );
  if (!ok) return;
  const uids = new Set(toSell.map((i) => i.u));
  state.inventory = state.inventory.filter((i) => !uids.has(i.u));
  addBalance(sum);
  state.stats.sold = round2(state.stats.sold + sum);
  invState.page = 1;
  save();
  renderInventory();
  renderHero();
  renderClickerStats();
  sfx('sell');
  pulseBalance();
  toast(`Продано ${toSell.length} предметов на ${money(sum)}`, 'ok');
}

/* ============================================================
   КЛИКЕР
   ============================================================ */
function renderClickMeta() {
  $('#perClick').textContent = money(clickPower());
  $('#critVal').textContent = (critChance() * 100).toFixed(1) + '%';
  $('#passiveVal').textContent = money(autoRate()) + '/сек';
}

function renderUpgrades() {
  $('#upgradesList').innerHTML = UPGRADES.map((u) => {
    const L = state[u.id] || 0;
    const maxed = L >= u.max;
    const cost = maxed ? 0 : u.cost(L);
    return `<div class="up-card ${maxed ? 'maxed' : ''}">
      <div class="up-icon"><svg class="icon"><use href="#i-${u.icon}"/></svg></div>
      <div class="up-body">
        <div class="up-name">${u.name}<span class="up-lvl">ур. ${L}</span></div>
        <div class="up-desc">${u.desc(L)}</div>
      </div>
      ${maxed
        ? '<button class="btn btn-ghost btn-sm" disabled>МАКС</button>'
        : `<button class="btn btn-sm" data-buy="${u.id}" data-cost="${cost}"><svg class="icon"><use href="#i-coin"/></svg>${money(cost)}</button>`}
    </div>`;
  }).join('');
}

function updateUpgradesAffordability() {
  $$('#upgradesList [data-buy]').forEach((b) => {
    b.disabled = state.balance < +b.dataset.cost;
  });
}

function renderClickerStats() {
  $('#clickerStats').innerHTML = `
    <div class="cs-item"><span>Кликов сделано</span><b>${state.stats.clicks.toLocaleString('ru-RU')}</b></div>
    <div class="cs-item"><span>Заработано кликами</span><b>${money(state.stats.earnedClicks)}</b></div>
    <div class="cs-item"><span>Заработано фермой</span><b>${money(state.stats.earnedAuto)}</b></div>
    <div class="cs-item"><span>Продано скинов на</span><b>${money(state.stats.sold)}</b></div>
    <div class="cs-item"><span>Кейсов открыто</span><b>${state.stats.opened.toLocaleString('ru-RU')}</b></div>
    <div class="cs-item"><span>В инвентаре</span><b>${money(invValue())}</b></div>`;
}

function spawnFloater(x, y, gain, crit) {
  const stage = $('#clickStage');
  const rect = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'floater' + (crit ? ' crit' : '');
  el.textContent = (crit ? 'КРИТ! ' : '') + '+' + money(gain);
  el.style.left = (x - rect.left) + 'px';
  el.style.top = (y - rect.top) + 'px';
  stage.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

/* ============================================================
   ЗВУК ВКЛ/ВЫКЛ
   ============================================================ */
function updateSoundIcon() {
  $('#soundBtn').innerHTML = `<svg class="icon"><use href="#i-${state.sound ? 'sound' : 'sound-off'}"/></svg>`;
}

/* ============================================================
   СОБЫТИЯ
   ============================================================ */
function bindTabs() {
  $('#tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
  document.addEventListener('click', (e) => {
    const goto = e.target.closest('[data-goto]');
    if (goto) switchTab(goto.dataset.goto);
  });
}

function switchTab(name) {
  $$('.tab-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab-page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + name));
  if (name === 'inventory') renderInventory();
  if (name === 'clicker') {
    renderUpgrades();
    updateUpgradesAffordability();
    renderClickerStats();
    renderClickMeta();
  }
}

function bindHeader() {
  $('#soundBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    save();
    updateSoundIcon();
    toast(state.sound ? 'Звук включён' : 'Звук выключен', 'info');
  });
}

function bindClicker() {
  $('#clickBtn').addEventListener('click', (e) => {
    const power = clickPower();
    const crit = Math.random() < critChance();
    const gain = round2(power * (crit ? 10 : 1));
    addBalance(gain);
    state.stats.clicks++;
    state.stats.earnedClicks = round2(state.stats.earnedClicks + gain);
    spawnFloater(e.clientX || 0, e.clientY || 0, gain, crit);
    sfx(crit ? 'crit' : 'click');
    const btn = $('#clickBtn');
    btn.classList.remove('pressed');
    void btn.offsetWidth;
    btn.classList.add('pressed');
    renderClickMeta();
    updateUpgradesAffordability();
  });

  $('#upgradesList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-buy]');
    if (!btn || btn.disabled) return;
    const def = UPGRADES.find((u) => u.id === btn.dataset.buy);
    const L = state[def.id] || 0;
    const cost = def.cost(L);
    if (state.balance < cost) {
      toast('Недостаточно средств для апгрейда', 'error');
      sfx('error');
      pulseBalance('deny');
      return;
    }
    addBalance(-cost);
    state[def.id] = L + 1;
    save();
    sfx('buy');
    toast(`${def.name}: уровень ${L + 1}!`, 'ok');
    renderUpgrades();
    updateUpgradesAffordability();
    renderClickMeta();
    renderClickerStats();
  });

  $('#resetBtn').addEventListener('click', async () => {
    const ok = await confirmDialog('Сбросить весь прогресс? Баланс, апгрейды и инвентарь будут удалены безвозвратно.', 'Сбросить');
    if (!ok) return;
    try { localStorage.removeItem(SAVE_KEY); } catch {}
    window.location.reload();
  });
}

function bindInventory() {
  $('#invSearch').addEventListener('input', (e) => {
    invState.q = e.target.value.trim();
    invState.page = 1;
    renderInventory();
  });
  $('#invSort').addEventListener('change', (e) => {
    invState.sort = e.target.value;
    invState.page = 1;
    renderInventory();
  });
  $('#invGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-sell]');
    if (btn) sellItem(+btn.dataset.sell);
  });
  $('#invMoreBtn').addEventListener('click', () => {
    invState.page++;
    renderInventory();
  });
  $('#sellAllBtn').addEventListener('click', () => sellAll());
  $('#sellJunkBtn').addEventListener('click', () => sellAll((it) => it.p <= 50));
}

function bindCases() {
  $('#casesGrid').addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-open]');
    if (openBtn) {
      openCaseById(openBtn.dataset.open);
      return;
    }
    const card = e.target.closest('.case-card');
    if (card) showCaseModal(card.dataset.case);
  });
  $('#cmOpenBtn').addEventListener('click', () => {
    $('#caseOverlay').classList.add('hidden');
    openCaseById(CURRENT_CASE);
  });
}

function bindModals() {
  // закрытие по крестику и по клику на фон
  $$('.overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-close]')) ov.classList.add('hidden');
    });
  });
  $('#winSellBtn').addEventListener('click', () => {
    if (CURRENT_SELL) sellItem(CURRENT_SELL.u);
    CURRENT_SELL = null;
    $('#winOverlay').classList.add('hidden');
  });
  $('#winKeepBtn').addEventListener('click', () => {
    CURRENT_SELL = null;
    $('#winOverlay').classList.add('hidden');
    toast('Предмет добавлен в инвентарь', 'ok');
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $$('.overlay:not(.hidden)').forEach((ov) => ov.classList.add('hidden'));
    }
  });
}

function bindRoulette() {
  $('#roulSkip').addEventListener('click', () => {
    if (!ROUL.active || ROUL.done) return;
    const track = $('#roulTrack');
    const cur = getComputedStyle(track).transform;
    track.style.transition = 'none';
    track.style.transform = cur === 'none' ? 'translateX(0px)' : cur;
    void track.offsetWidth;
    track.style.transition = 'transform 380ms cubic-bezier(.3,.7,.4,1)';
    track.style.transform = `translateX(${ROUL.target}px)`;
    clearTimeout(ROUL.timer);
    ROUL.timer = setTimeout(() => roulFinish(), 400);
  });
  $('#roulClose').addEventListener('click', () => {
    if (ROUL.active) return;
    $('#roulOverlay').classList.add('hidden');
  });
  $('#fastOpenChk').addEventListener('change', (e) => {
    state.fast = e.target.checked;
    save();
  });
}

/* ============================================================
   ЦИКЛЫ
   ============================================================ */
function startLoops() {
  // пассивный доход
  setInterval(() => {
    const r = autoRate();
    if (r > 0) {
      const gain = r / 5;
      addBalance(gain);
      state.stats.earnedAuto = round2(state.stats.earnedAuto + gain);
    }
  }, 200);

  // обновление доступности апгрейдов и статистики
  setInterval(() => {
    updateUpgradesAffordability();
    if ($('#page-clicker').classList.contains('active')) renderClickerStats();
  }, 1000);

  requestAnimationFrame(balanceLoop);
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
function loaderError() {
  const loader = $('#loader');
  loader.classList.add('loader-error');
  $('.loader-text', loader).textContent = 'Не удалось загрузить данные скинов (data/skins.json). Проверьте файл и обновите страницу.';
  $('.loader-bar', loader).remove();
}

async function init() {
  bindTabs();
  bindHeader();
  bindClicker();
  bindInventory();
  bindCases();
  bindModals();
  bindRoulette();

  let data;
  try {
    const res = await fetch('data/skins.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    loaderError();
    return;
  }

  SKINS = data.skins || [];
  SKIN_BY_ID = new Map(SKINS.map((s) => [s.id, s]));
  buildCases();

  $('#skinCount').textContent = SKINS.length.toLocaleString('ru-RU');
  $('#caseCount').textContent = CASES.length;
  $('#fastOpenChk').checked = !!state.fast;
  updateSoundIcon();
  renderCases();
  renderInventory();
  renderUpgrades();
  updateUpgradesAffordability();
  renderClickMeta();
  renderClickerStats();
  renderHero();
  renderRecent();
  renderHeader();

  $('#loader').classList.add('hidden');
  startLoops();

  if (!state.welcomed) {
    state.welcomed = true;
    save();
    toast('Добро пожаловать! Кликай на монету, зарабатывай и открывай кейсы', 'info');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* Отладочный доступ (используется в тестах) */
window.__app = {
  get state() { return state; },
  get cases() { return CASES; },
  get skins() { return SKINS; },
  get roul() { return ROUL; },
  openCaseById,
  rollDrop,
  priceOf,
  sellItem,
  sellAll,
  buildCases,
  switchTab,
};
