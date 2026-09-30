/**
 * Смоук-тест CaseArena: запускает сайт в jsdom и прогоняет основные сценарии.
 *   node tools/smoke/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

const vc = new VirtualConsole();
vc.on('jsdomError', (e) => console.error('  [jsdomError]', e.message, e.detail && e.detail.message ? '→ ' + e.detail.message : ''));
vc.on('error', (...a) => console.error('  [console.error]', ...a));

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const data = fs.readFileSync(path.join(ROOT, 'data/skins.json'), 'utf8');

// Встраиваем app.js инлайном, чтобы jsdom его выполнил
// (замена через функцию, чтобы $ в коде не интерпретировались)
const inject = `<script>${appJs.replace(/<\/script>/g, '<\\/script>')}</script>`;
const inlined = html.replace('<script src="js/app.js"></script>', () => inject);

const dom = new JSDOM(inlined, {
  url: 'http://localhost/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.fetch = (url) => {
      if (String(url).includes('skins.json')) {
        return Promise.resolve({ ok: true, json: async () => JSON.parse(data) });
      }
      return Promise.reject(new Error('сеть недоступна в тесте: ' + url));
    };
    window.confirm = () => true;
  },
});

const { window } = dom;
const { document } = window;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log('  ✓', name); }
  else { failed++; console.error('  ✗ ПРОВАЛ:', name); }
}

console.log('— Загрузка приложения —');
await sleep(400);
const app = window.__app;
assert(!!app, 'window.__app доступен');
assert(app.skins.length === 1974, `скинов загружено: ${app.skins.length}`);
assert(document.querySelectorAll('#casesGrid .case-card').length === app.cases.length, `карточек кейсов: ${app.cases.length}`);
assert(app.cases.length === 15, `кейсов: ${app.cases.length} (ожидалось 15)`);

console.log('— Кейсы и цены —');
for (const c of app.cases) {
  assert(c.count > 0 && c.price > 0, `${c.name}: ${c.count} скинов, цена ${c.price.toFixed ? c.price.toFixed(2) : c.price}`);
}
console.table(app.cases.map(c => ({ кейс: c.name, скинов: c.count, цена: c.price, EV: Math.round(c.ev * 100) / 100 })));

// Проверка дропов: 200 роллов на каждый кейс
let rollErrors = 0, knifeCaseDrops = 0;
for (const c of app.cases) {
  for (let i = 0; i < 200; i++) {
    const d = app.rollDrop(c);
    if (!d.skin || !(d.price > 0) || !isFinite(d.price)) rollErrors++;
    if (!c.pool.includes(d.skin)) rollErrors++;
    if (d.f !== null && (d.f < 0 || d.f > 1.001)) rollErrors++;
  }
}
assert(rollErrors === 0, `3000 роллов дропа без ошибок (ошибок: ${rollErrors})`);
const knifeCase = app.cases.find(c => c.id === 'knife');
for (let i = 0; i < 50; i++) {
  if (app.rollDrop(knifeCase).skin.cl === 'knife') knifeCaseDrops++;
}
assert(knifeCaseDrops === 50, 'ножевой кейс даёт только ножи');

// Детерминированность цен
const s0 = app.skins[100];
assert(app.priceOf(s0, 0.2, false, false) === app.priceOf(s0, 0.2, false, false), 'цена детерминирована');
assert(app.priceOf(s0, 0.01, false, false) > app.priceOf(s0, 0.36, false, false), 'FN дороже FT');

console.log('— Кликер —');
const st = app.state;
st.balance = 250;
const clickBtn = document.getElementById('clickBtn');
for (let i = 0; i < 50; i++) clickBtn.click();
await sleep(50);
assert(st.balance >= 300, `после 50 кликов баланс ${st.balance.toFixed(2)} (>= 300 с учётом критов)`);

// Покупка апгрейда
st.balance = 1000;
document.querySelector('[data-buy="clickLevel"]').click();
await sleep(30);
assert(st.clickLevel === 1 && st.balance < 1000, `апгрейд куплен (ур. ${st.clickLevel}, баланс ${st.balance.toFixed(2)})`);

console.log('— Открытие кейса (быстрое) —');
st.fast = true;
st.balance = 5000;
const invBefore = st.inventory.length;
app.openCaseById('starter');
await sleep(100);
assert(st.inventory.length === invBefore + 1, 'предмет добавлен в инвентарь');
assert(!document.getElementById('winOverlay').classList.contains('hidden'), 'модалка выигрыша показана');
const wonName = document.getElementById('winName').textContent;
const wonPrice = st.inventory[st.inventory.length - 1].p;
console.log(`    Дроп: ${wonName} за $${wonPrice}`);
assert(wonName.length > 2, 'название скина в модалке');

// Продажа из модалки
document.getElementById('winSellBtn').click();
await sleep(50);
assert(st.inventory.length === invBefore, 'после продажи предмет удалён из инвентаря');
assert(st.stats.sold > 0, `статистика продаж: $${st.stats.sold.toFixed(2)}`);

// StatTrak-кейс: все дропы со счётчиком
st.balance = 100000;
let stDrops = 0;
for (let i = 0; i < 30; i++) {
  const d = app.rollDrop(app.cases.find(c => c.id === 'stattrak'));
  if (d.st) stDrops++;
}
assert(stDrops === 30, `StatTrak-кейс: ${stDrops}/30 дропов со счётчиком`);

// Сувенирный кейс
let svDrops = 0;
for (let i = 0; i < 30; i++) {
  if (app.rollDrop(app.cases.find(c => c.id === 'souvenir')).sv) svDrops++;
}
assert(svDrops === 30, `Сувенирный кейс: ${svDrops}/30 сувенирных`);

console.log('— Инвентарь и продажа —');
st.balance = 1000000;
for (let i = 0; i < 8; i++) app.openCaseById('gold');
await sleep(150);
document.getElementById('winKeepBtn').click(); // закрываем модалку последнего дропа
assert(st.inventory.length === 8, `в инвентаре ${st.inventory.length} предметов`);
const spent = 8 * app.cases.find(c => c.id === 'gold').price;
const balBeforeSelling = st.balance;
const dropsSum = st.inventory.reduce((a, b) => a + b.p, 0);
assert(Math.abs((1000000 - st.balance) - spent) < 0.01, `списано ровно ${spent} за 8 кейсов`);
app.switchTab('inventory');
await sleep(30);
const sellButtons = document.querySelectorAll('#invGrid [data-sell]');
assert(sellButtons.length === 8, `карточек в инвентаре: ${sellButtons.length}`);
sellButtons[0].click(); // продажа одного
await sleep(30);
assert(st.inventory.length === 7, 'продажа одного предмета работает');

// Продать всё (через confirm)
document.getElementById('sellAllBtn').click();
await sleep(30);
document.getElementById('confirmYes').click();
await sleep(60);
assert(st.inventory.length === 0, 'продать всё: инвентарь пуст');
assert(st.balance >= balBeforeSelling + dropsSum - 0.01, `баланс вырос на сумму дропов (${st.balance.toFixed(2)})`);

console.log('— Рулетка с анимацией —');
st.fast = false;
st.balance = 100000;
app.openCaseById('rifle');
await sleep(300);
assert(!document.getElementById('roulOverlay').classList.contains('hidden'), 'оверлей рулетки показан');
assert(document.querySelectorAll('#roulTrack .rou-card').length === 62, 'в ленте 62 карточки');
console.log('    ROUL до пропуска:', JSON.stringify({ active: app.roul.active, done: app.roul.done, target: app.roul.target }));
// Пропустить анимацию (400мс переход + 620мс пауза перед модалкой)
document.getElementById('roulSkip').click();
await sleep(1500);
console.log('    ROUL после пропуска:', JSON.stringify({ active: app.roul.active, done: app.roul.done }));
assert(document.getElementById('roulOverlay').classList.contains('hidden'), 'рулетка завершилась после пропуска');
assert(!document.getElementById('winOverlay').classList.contains('hidden'), 'выигрыш показан после рулетки');
document.getElementById('winKeepBtn').click();
await sleep(30);

console.log('— Сохранение —');
const saved = JSON.parse(window.localStorage.getItem('casearena-save-v1'));
assert(saved && typeof saved.balance === 'number', 'прогресс записан в localStorage');
assert(saved.stats.opened >= 10, `открытий зафиксировано: ${saved.stats.opened}`);

console.log(`\nИТОГ: ${passed} прошло, ${failed} провалено`);
window.close();
process.exit(failed ? 1 : 0);
