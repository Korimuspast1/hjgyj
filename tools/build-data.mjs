#!/usr/bin/env node
/**
 * Собирает компактный датасет всех скинов CS2 для сайта CaseArena.
 *
 * Источник данных: ByMykel/CSGO-API (https://github.com/ByMykel/CSGO-API)
 *   — полная открытая база всех скинов CS2: названия, оружие, редкость,
 *     диапазоны float, поддержка StatTrak/Souvenir и ссылки на картинки
 *     (официальный CDN Steam).
 *
 * Использование:
 *   node tools/build-data.mjs [входной skins.json] [выход data/skins.json]
 */
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2] ?? '/tmp/skins_raw.json';
const OUT = process.argv[3] ?? path.join(process.cwd(), 'data', 'skins.json');

/* ---------- Сопоставление редкости с уровнем (tier) ---------- */
const RARITY_TIER = {
  'Consumer Grade': 0,
  'Industrial Grade': 1,
  'Mil-Spec Grade': 2,
  'Restricted': 3,
  'Classified': 4,
  'Covert': 5,
  'Extraordinary': 7,   // перчатки
  'Contraband': 8,      // M4A4 | Howl
};

/* ---------- Классы оружия (для тематических кейсов) ---------- */
const WEAPON_CLASS = {
  // пистолеты
  'Glock-18': 'pistol', 'USP-S': 'pistol', 'P2000': 'pistol', 'P250': 'pistol',
  'Five-SeveN': 'pistol', 'Tec-9': 'pistol', 'CZ75-Auto': 'pistol',
  'Dual Berettas': 'pistol', 'Desert Eagle': 'pistol', 'R8 Revolver': 'pistol',
  // ПП
  'MAC-10': 'smg', 'MP9': 'smg', 'MP7': 'smg', 'MP5-SD': 'smg',
  'UMP-45': 'smg', 'P90': 'smg', 'PP-Bizon': 'smg',
  // винтовки
  'AK-47': 'rifle', 'M4A4': 'rifle', 'M4A1-S': 'rifle', 'Galil AR': 'rifle',
  'FAMAS': 'rifle', 'SG 553': 'rifle', 'AUG': 'rifle',
  // снайперские
  'AWP': 'sniper', 'SSG 08': 'sniper', 'SCAR-20': 'sniper', 'G3SG1': 'sniper',
  // тяжёлое
  'Nova': 'heavy', 'XM1014': 'heavy', 'MAG-7': 'heavy', 'Sawed-Off': 'heavy',
  'M249': 'heavy', 'Negev': 'heavy',
};

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const slug = (str) =>
  str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'skin';

/* ---------- Чтение и преобразование ---------- */
const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const skins = [];
const seen = new Set();
let skipped = 0;

for (const s of raw) {
  const tier = RARITY_TIER[s.rarity?.name];
  const weaponName = s.weapon?.name ?? 'Unknown';
  if (tier === undefined) { skipped++; continue; }

  const isKnife = s.category?.name === 'Knives';
  const isGlove = s.category?.name === 'Gloves';
  // Ножи в API имеют редкость Covert — переносим их в отдельный уровень 6
  const t = isKnife ? 6 : tier;
  const cl = isKnife ? 'knife' : isGlove ? 'glove' : (WEAPON_CLASS[weaponName] ?? 'other');

  // «Ванильные» ножи без раскраски (★ Karambit и т.п.) — тоже включаем
  const name = s.name ?? `${weaponName} | ${s.pattern?.name ?? ''}`;
  if (seen.has(name)) continue; // фазы Doppler/Gamma Doppler объединяем в один скин
  seen.add(name);

  skins.push({
    id: slug(name),
    n: name,
    t,
    cl,
    a: num(s.min_float),
    b: num(s.max_float),
    st: s.stattrak ? 1 : 0,
    sv: s.souvenir ? 1 : 0,
    g: s.image || null,
  });
}

skins.sort((x, y) => x.n.localeCompare(y.n, 'en'));

/* ---------- Статистика ---------- */
const byTier = {}, byClass = {};
for (const s of skins) {
  byTier[s.t] = (byTier[s.t] ?? 0) + 1;
  byClass[s.cl] = (byClass[s.cl] ?? 0) + 1;
}

/* ---------- Запись ---------- */
const payload = {
  version: 1,
  source: 'ByMykel/CSGO-API',
  generated: new Date().toISOString().slice(0, 10),
  count: skins.length,
  skins,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(payload));

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✓ Записано ${skins.length} скинов → ${OUT} (${kb} КБ)`);
console.log('Пропущено записей:', skipped);
console.log('По редкости (tier):', JSON.stringify(byTier));
console.log('По классам:', JSON.stringify(byClass));
