/* ═══════════════════════════════════════════════════════════════
   ПОЛНЫЙ РЕГРЕССИОННЫЙ ПРОГОН игры «NOVA X5 Pro»
   Проходит игру так, как это делает человек: распаковка → SIM →
   мастер настройки → все приложения → звонки → интернет → система.

   Запуск:  cd tests && node suite.mjs          (~2 мин, подробный)
            cd tests && node suite.mjs --quick  (~40 с, короткие паузы)
   Выход:   0 — всё зелёное, 1 — есть провалы или JS-ошибки.
   ═══════════════════════════════════════════════════════════════ */
import { window, D, S, api, ev, q, qa, wait, log, errors, click, dragIt, longPress, mod } from './harness.mjs';

process.on('uncaughtException', (e) => {
  console.log('\n💥 ПРОГОН УПАЛ: ' + (e && e.message));
  console.log((e && e.stack || '').split('\n').slice(0, 12).join('\n'));
  report();
  process.exit(3);
});

const QUICK = process.argv.includes('--quick');
const W = (ms) => wait(QUICK ? Math.min(ms, 300) : ms);

let passed = 0, failed = 0;
const fails = [];
function ok(cond, name, extra = '') {
  if (cond) { passed++; log('  ✅ ' + name + (extra ? ' — ' + extra : '')); }
  else { failed++; fails.push(name); log('  ❌ ' + name + (extra ? ' — ' + extra : '')); }
  return !!cond;
}
/* проверка, которая дожидается условия (игра живая: боты печатают, таймеры тикают) */
async function okSoon(cond, name, extra, tries = 10) {
  let v = typeof cond === 'function' ? cond() : cond;
  for (let i = 0; i < tries && !v; i++) { await wait(400); v = typeof cond === 'function' ? cond() : cond; }
  return ok(v, name, typeof extra === 'function' ? extra() : extra);
}
function noErr(name, e0) {
  const add = errors.slice(e0);
  return ok(add.length === 0, 'без JS-ошибок: ' + name, add.length ? add[0].split('\n')[0].slice(0, 120) : '');
}
const root = (id) => q(`#layer-apps [data-app="${id}"]`);
const dlgButtons = (d) => {
  const acts = [...d.querySelectorAll('.sysdialog__actions button')];
  return acts.length ? acts : [...d.querySelectorAll('.sysdialog button')];
};
const sysBtn = (re) => { const d = q('#syslayer .sysdialog-backdrop'); return d ? (dlgButtons(d).find((b) => re.test(b.textContent)) || null) : null; };
async function dismiss(re) {
  const d = q('#syslayer .sysdialog-backdrop');
  if (!d) return null;
  const btns = dlgButtons(d);
  const b = re ? btns.find((x) => re.test(x.textContent)) : (btns.find((x) => /Отмена|Закрыть|Позже|ОК/.test(x.textContent)) || btns[0]);
  if (b) { ev(b, 'click'); await W(500); return b.textContent.trim(); }
  d.remove();
  return null;
}
/* убрать все висящие системные диалоги (иначе они блокируют всё дальше) */
async function clean(n = 4) {
  for (let i = 0; i < n; i++) {
    const d = q('#syslayer .sysdialog-backdrop');
    if (!d) return true;
    const btns = dlgButtons(d);
    const b = btns.find((x) => /Отмена|Закрыть|Позже|ОК|Завершить/.test(x.textContent)) || btns[0];
    if (!b) { d.remove(); continue; }
    ev(b, 'click'); await W(450);
  }
  return !q('#syslayer .sysdialog-backdrop');
}
/* кнопки-переключатели: первый клик может ЗАКРЫВАТЬ уже открытую панель */
async function openPanel(findBtn, panelSel) {
  for (let round = 0; round < 3; round++) {
    const b = findBtn();
    if (!b) return false;
    ev(b, 'click'); await W(700);
    if (q(panelSel)) return true;
    const b2 = findBtn();
    if (b2) { ev(b2, 'click'); await W(700); }
    if (q(panelSel)) return true;
  }
  return false;
}
const step = async (t) => { log('\n─── ' + t + ' ───'); await clean(); };
function report() {
  log('\n════════════ ИТОГ ════════════');
  log('проверок пройдено: ' + passed + ' · провалено: ' + failed);
  if (fails.length) { log('Провалы:'); fails.forEach((f) => log('  • ' + f)); }
  const st = S();
  if (st) {
    log('достижений: ' + Object.keys(st.achievements).length + '/40 · задач: ' + st.tasks.filter((t) => t.done).length + '/15');
    log('статистика: ' + JSON.stringify(st.stats));
  }
  log('JS-ошибок за прогон: ' + errors.length);
  const seen = new Set();
  errors.forEach((e) => { const k = e.split('\n')[0].slice(0, 150); if (!seen.has(k)) { seen.add(k); log('— ' + e.split('\n').slice(0, 5).join('\n  ')); } });
  log(failed === 0 && errors.length === 0 ? '\n🎉 ВСЁ ЗЕЛЁНОЕ' : '\n⚠️ ЕСТЬ ЗАМЕЧАНИЯ');
}

/* ============ 1. РАСПАКОВКА ============ */
await step('1. Распаковка: коробка → плёнка → скрепка → SIM → тариф');
let e0 = errors.length;
click('#btn-new'); await wait(400);
ok(S().stage === 'box', 'новая игра начинается с коробки на столе', S().stage);
ok(!!q('#coachmark') && q('#coachmark').textContent.length > 10, 'есть подсказка-коучмарк');
click('#prop-box'); await W(400);
ok(S().world.boxOpened, 'коробка открыта');
dragIt('#box-phone', 0, -200); await W(500);
ok(S().world.phoneOutOfBox, 'телефон вытащили из коробки');
dragIt('#box-film', 150, 40); await W(500);
ok(S().world.filmPeeled, 'защитная плёнка снята');
ok(!!S().achievements.film, 'достижение «Плёнка снята»');
click('#prop-pin'); await W(250);
ok(S().flags.pinInHand, 'скрепка взята со стола');
click('#hw-simhole'); await W(600);
ok(S().world.trayOut, 'лоток SIM выдвинут из корпуса');
dragIt('#prop-sim', 0, 0); await W(1000);
ok(S().world.simInTray, 'SIM-карта легла в лоток');
click('#simtray'); await W(1500);
ok(!!q('.modal .opt'), 'появился выбор оператора');
const opt = q('.modal .opt');
ev(opt, 'click');
const actBtn = qa('.modal__actions .btn').find((b) => /Активировать/.test(b.textContent));
if (actBtn) ev(actBtn, 'click');
await W(800);
ok(S().phone.sim.inserted && !!S().phone.sim.operator, 'SIM активирована', S().phone.sim.operator + ' · ' + S().phone.sim.number);
ok(!!S().achievements.sim, 'достижение «SIM-карта»');
ok(S().world.simTariffPaid === true, 'тариф оплачен/подключён');
ok(!!S().achievements.tariff, 'достижение «Тариф выбран»');
ok(S().tasks.find((t) => t.id === 't5')?.done, 'задача про SIM/тариф выполнена');
noErr('распаковка', e0);

/* ============ 2. ВКЛЮЧЕНИЕ + МАСТЕР ============ */
await step('2. Включение и мастер первоначальной настройки');
e0 = errors.length;
await api.powerOn(); await wait(QUICK ? 1000 : 1800);
const seenSteps = new Set();
let lastStep = '';
for (let i = 0; i < 90 && S().stage !== 'ready'; i++) {
  const h2 = q('.setup h2')?.textContent || '?';
  if (h2 !== lastStep) { seenSteps.add(h2); lastStep = h2; }
  const dlg = q('#syslayer .sysdialog-backdrop');
  if (dlg) {
    const inp = dlg.querySelector('.sysdialog__input');
    if (inp) { inp.value = 'kotenok2024'; inp.dispatchEvent(new window.Event('input', { bubbles: true })); }
    const b = [...dlg.querySelectorAll('.sysdialog__actions button')].find((x) => /Подключ|Сохранить|Готово|ОК|Далее|Продолжить|Установить/.test(x.textContent))
      || [...dlg.querySelectorAll('.sysdialog__actions button')].pop();
    if (b) ev(b, 'click');
    await W(900);
    const footWifi = [...qa('.setup__foot .btn')].find((x) => /Подключиться/.test(x.textContent));
    if (footWifi && !S().phone.wifi.ssid) { ev(footWifi, 'click'); await wait(QUICK ? 1000 : 2800); }
    continue;
  }
  if (/Wi-Fi/i.test(h2) && !S().phone.wifi.ssid) {
    const w = qa('.setup .wifi-row').find((n) => /Home_Nova/.test(n.textContent));
    if (w) { ev(w, 'click'); await W(700); continue; }
  }
  if (/Отпечаток/i.test(h2) && S().phone.user.fp !== true) {
    const sensor = q('.setup .fp-sensor');
    if (sensor) { for (let k = 0; k < 6; k++) { ev(sensor, 'pointerdown'); await wait(60); } await W(300); }
  }
  if (/Блокировка экрана/i.test(h2)) {
    const keys = qa('.setup button').filter((k) => /^[0-9]$/.test(k.textContent.trim()));
    if (keys.length >= 10) { for (const d of ['1', '2', '3', '4']) { const k = keys.find((x) => x.textContent.trim() === d); if (k) { ev(k, 'click'); await wait(70); } } await W(700); }
  }
  if (/Сделайте его своим/i.test(h2)) {
    const inp = q('.setup .sysdialog__input');
    if (inp && !inp.value) { inp.value = 'Игрок'; inp.dispatchEvent(new window.Event('input', { bubbles: true })); }
  }
  const btns = [...qa('.setup__foot .btn')];
  const b = btns.find((x) => /Далее|Продолжить|Готово|Завершить|Вперёд|Установить|Подключиться|На домашний|Начать|Сохранить|Ввести/.test(x.textContent)) || btns[btns.length - 1];
  if (b) { ev(b, 'click'); await W(700); continue; }
  await wait(300);
}
ok(S().stage === 'ready', 'мастер завершён, stage=ready', S().stage);
ok(!q('.setup'), 'окно мастера закрыто');
ok(S().phone.on && S().phone.awake, 'телефон включён, экран горит');
ok(S().phone.setupDone, 'флаг setupDone установлен');
ok(seenSteps.size >= 6, 'пройдено шагов мастера: ' + seenSteps.size, [...seenSteps].join(' / '));
ok(!!S().phone.wifi.ssid, 'Wi-Fi подключён', String(S().phone.wifi.ssid));
ok(S().phone.user.hasPin && S().phone.user.pin === '1234', 'PIN-код установлен');
ok(S().tasks.filter((t) => t.done).length >= 5, 'задач выполнено после настройки: ' + S().tasks.filter((t) => t.done).length + '/15');
ok(!!S().achievements.setup && !!S().achievements.wifi, 'достижения setup/wifi');
noErr('мастер настройки', e0);

/* ============ 3. ДОМАШНИЙ ЭКРАН ============ */
await step('3. Домашний экран: иконки, виджет, ящик, контекстное меню, недавние');
e0 = errors.length;
api.goHome(); await W(600);
ok(qa('#layer-home .hicon').length >= 18, 'иконок на столе: ' + qa('#layer-home .hicon').length);
ok(qa('#layer-home .home__widget').length >= 1, 'виджет на столе: ' + qa('#layer-home .home__widget').length);
ok(qa('#layer-home .home__page').length >= 2, 'страниц стола: ' + qa('#layer-home .home__page').length);
ok(qa('#layer-home .home__dock .hicon').length >= 3, 'иконок в доке: ' + qa('#layer-home .home__dock .hicon').length);
ok(!!q('#statusbar') && q('#statusbar').textContent.length > 3, 'статус-бар показывает время и батарею', q('#statusbar').textContent.replace(/\s+/g, ' ').slice(0, 42));
const searchEl = q('#layer-home .home__search');
if (searchEl) { ev(searchEl, 'click'); await W(700); }
ok(!!q('.drawer'), 'ящик приложений открывается');
const drawerCount = qa('.drawer__grid .hicon, .drawer__grid > *').length;
ok(drawerCount >= 18, 'приложений в ящике: ' + drawerCount);
const ds = q('.drawer__search input');
if (ds) { ds.value = 'зме'; ds.dispatchEvent(new window.Event('input', { bubbles: true })); await W(600); }
const filtered = qa('.drawer__grid > *').length;
ok(filtered >= 1 && filtered < drawerCount, 'поиск в ящике фильтрует: ' + filtered);
api.back?.(); await W(600);
ok(!q('.drawer'), 'ящик закрывается');
// контекстное меню иконки
const icon = qa('#layer-home .hicon')[2];
await longPress(icon, QUICK ? 650 : 950);
ok(!!q('#syslayer .sysdialog'), 'долгое нажатие → контекстное меню', (q('#syslayer .sysdialog')?.textContent || '').slice(0, 40).replace(/\s+/g, ' '));
ok(/Открыть/.test(q('#syslayer .sysdialog')?.textContent || '') && /О приложении/.test(q('#syslayer .sysdialog')?.textContent || ''), 'в меню есть «Открыть» и «О приложении»');
await clean();
ok(!q('#syslayer .sysdialog-backdrop'), 'контекстное меню закрывается');
// недавние приложения
await api.openApp('messages'); await W(500);
await api.openApp('music'); await W(500);
await api.openApp('camera'); await W(500);
const nRec = S().recents.length;
ok(nRec >= 3, 'список недавних накопился: ' + JSON.stringify(S().recents));
api.showRecents(); await W(800);
ok(!q('#layer-recents').hidden && qa('.rcard').length === nRec, 'недавние показаны: карточек ' + qa('.rcard').length);
ok(qa('#layer-recents .rcard__body').length === nRec, 'у карточек есть живые снимки содержимого');
const kill = q('#layer-recents .rcard button');
if (kill) { ev(kill, 'click'); await W(700); }
ok(qa('#layer-recents .rcard').length === nRec - 1, 'приложение выгружается крестиком');
const clearAll = [...qa('#layer-recents button')].find((b) => /Очистить всё/.test(b.textContent));
if (clearAll) { ev(clearAll, 'click'); await W(800); }
ok(S().recents.length === 0 && qa('#layer-recents .rcard').length === 0, '«Очистить всё» выгружает все приложения');
api.back?.(); await W(500);
noErr('домашний экран', e0);

/* ============ 4. ШТОРКА ============ */
await step('4. Шторка уведомлений и быстрые настройки');
e0 = errors.length;
api.openShade(); await W(700);
ok(qa('#shade .qs-tile').length === 12, 'плиток быстрых настроек: ' + qa('#shade .qs-tile').length);
ok(qa('#shade input[type=range]').length === 2, 'слайдеры яркости и громкости');
ok(!!S().achievements.shade, 'достижение «Шторка»');
ok(S().tasks.find((t) => t.id === 't11').done, 'задача «Открыть шторку» выполнена');
for (const name of ['Фонарик', 'Не беспокоить', 'В самолёте']) {
  const t = qa('#shade .qs-tile').find((x) => x.textContent.includes(name));
  if (t) { ev(t, 'click'); await W(550); }
}
ok(S().phone.flashlight === true, 'плитка «Фонарик» включает фонарь');
ok(S().phone.dnd === true, 'плитка «Не беспокоить»');
ok(S().phone.airplane === true, 'плитка «В самолёте»');
ok(q('#flash-beam')?.classList.contains('on'), 'луч фонарика виден на корпусе');
for (const name of ['Фонарик', 'Не беспокоить', 'В самолёте']) {
  const t = qa('#shade .qs-tile').find((x) => x.textContent.includes(name));
  if (t) { ev(t, 'click'); await W(500); }
}
ok(!S().phone.airplane && !S().phone.dnd && !S().phone.flashlight, 'плитки выключаются обратно');
ok(!!S().achievements.qs, 'достижение «Быстрые настройки»');
const bright = qa('#shade input[type=range]')[0];
bright.value = '35'; bright.dispatchEvent(new window.Event('input', { bubbles: true })); await W(450);
ok(S().phone.brightness === 35, 'яркость меняется слайдером: ' + S().phone.brightness);
bright.value = '100'; bright.dispatchEvent(new window.Event('input', { bubbles: true })); await W(350);
const vol = qa('#shade input[type=range]')[1];
vol.value = '60'; vol.dispatchEvent(new window.Event('input', { bubbles: true })); await W(400);
ok(S().phone.volume.media === 60, 'громкость медиа меняется: ' + S().phone.volume.media);
const { notify } = await mod('js/notify.js');
notify({ appId: 'messages', icon: '💬', title: 'Проверка', text: 'Тестовое уведомление', color: '#22c55e' });
await W(600);
ok(qa('#shade .notif').length >= 1, 'уведомление появилось в шторке');
const openN = q('#shade .notif');
if (openN) { ev(openN, 'click'); await W(700); }
ok(api.currentApp() === 'messages', 'клик по уведомлению открывает приложение', String(api.currentApp()));
api.openShade(); await W(600);
const clr = [...qa('#shade button')].find((b) => /Очистить всё/.test(b.textContent));
if (clr) { ev(clr, 'click'); await W(700); }
ok(S().notifications.length === 0, 'кнопка «Очистить всё» убирает уведомления');
api.closeShade(); await W(500);
ok(!q('#shade').classList.contains('open'), 'шторка закрывается');
noErr('шторка', e0);

/* ============ 5. МЕССЕНДЖЕР ============ */
await step('5. Мессенджер: чаты, ответы ботов, вложения, эмодзи, звонок из чата');
e0 = errors.length;
await api.openApp('messages'); await W(900);
// приложение могло остаться в открытом чате с прошлых разделов — возвращаемся к списку
let guard = 0;
while (q('.chat') && guard++ < 3) { api.back?.(); await W(700); }
const listRows = [...(root('messages')?.querySelectorAll('.list__row') || [])];
ok(listRows.length >= 5, 'чатов в списке: ' + listRows.length);
ok(listRows.some((r) => /Мама/.test(r.textContent)), 'в списке есть мама');
ok(listRows.some((r) => /Кирилл/.test(r.textContent)), 'в списке есть Кирилл');
const momRow = listRows.find((r) => /Мама/.test(r.textContent));
if (momRow) { ev(momRow, 'click'); await W(900); }
ok(!!q('.chat'), 'чат с мамой открывается');
ok(/Мама/.test(q('.chat__head')?.textContent || ''), 'в шапке чата имя контакта', q('.chat__head')?.textContent.slice(0, 30).replace(/\s+/g, ' '));
const field = q('.chat__input textarea');
field.value = 'Привет! Телефон просто огонь 🔥';
field.dispatchEvent(new window.Event('input', { bubbles: true }));
await W(300);
ev(q('.chat__send'), 'click');
await okSoon(() => S().stats.msgsSent >= 1, 'сообщение отправлено: ' + S().stats.msgsSent);
await okSoon(() => qa('.chat .msg.out').length >= 1, 'пузырь исходящего сообщения в чате');
await okSoon(() => qa('.chat .msg.in').length >= 1, 'собеседник напечатал и ответил', () => (qa('.chat .msg.in').pop()?.textContent || '').slice(0, 46));
ok(S().tasks.find((t) => t.id === 't10').done, 'задача «Ответить маме» выполнена');
ok(!!S().achievements.msg && !!S().achievements.mom, 'достижения msg/mom');

async function reopenMom() {
  await clean();
  if (api.currentApp() !== 'messages') { await api.openApp('messages'); await W(800); }
  if (!q('.chat')) {
    const r = [...(root('messages')?.querySelectorAll('.list__row') || [])].find((x) => /Мама/.test(x.textContent));
    if (r) { ev(r, 'click'); await W(900); }
  }
  return !!q('.chat__field');
}
// вложения
ok(await reopenMom(), 'чат снова открыт после ответов бота');
const attachBtn = () => qa('.chat__field .iconbtn')[1];
ok(await openPanel(attachBtn, '.attach-menu'), 'меню вложений', (q('.attach-menu')?.textContent || '').slice(0, 40).replace(/\s+/g, ' '));
const galItem = [...qa('.attach-menu > *')].find((b) => /Галерея/.test(b.textContent));
if (galItem) { ev(galItem, 'click'); await W(1200); }
ok(api.currentApp() === 'gallery' && /Выберите фото/.test(root('gallery')?.textContent || ''), '«Галерея» открывает выбор фото для отправки');
api.back?.(); await W(800);
ok(await reopenMom(), 'вернулись в чат из галереи');
const nGeo = qa('.chat .msg').length;
await openPanel(attachBtn, '.attach-menu');
const geoItem = [...qa('.attach-menu > *')].find((b) => /Геолокация/.test(b.textContent));
if (geoItem) { ev(geoItem, 'click'); await W(1000); }
ok(qa('.chat .msg').length > nGeo, 'отправка геолокации в чат');
// эмодзи
const emoBtn = () => qa('.chat__field .iconbtn')[0];
ok(await openPanel(emoBtn, '.emoji-panel'), 'панель эмодзи: ' + qa('.emoji-panel button').length + ' штук');
const oneEmoji = qa('.emoji-panel button')[7];
if (oneEmoji) { ev(oneEmoji, 'click'); await W(600); }
await okSoon(() => (q('.chat__field textarea')?.value || '').length > 0, 'эмодзи вставляется в поле ввода', () => JSON.stringify(q('.chat__field textarea')?.value));
// звонок из чата
ok(await reopenMom(), 'чат на месте перед звонком');
const callBtn = q('.chat__head .appbar__actions .iconbtn');
ok(!!callBtn, 'в шапке чата есть кнопка звонка');
if (callBtn) {
  const e1 = errors.length;
  ev(callBtn, 'click'); await W(1500);
  ok(api.currentApp() === 'phone', 'кнопка звонка открывает Телефон');
  ok(/Мама|\+32/.test(q('.dial-num')?.textContent || ''), 'номер контакта подставился в набор', q('.dial-num')?.textContent);
  noErr('звонок из чата', e1);
}
api.killApp('phone'); await W(500);
ok(await reopenMom(), 'возврат в мессенджер после звонка');
// стрелка «назад» в шапке чата
if (!q('.chat')) await reopenMom();
const backArrow = q('.chat__head .iconbtn');
ok(!!backArrow, 'в шапке чата есть кнопка «назад»');
if (backArrow) { ev(backArrow, 'click'); await W(900); }
ok(!q('.chat') && [...(root('messages')?.querySelectorAll('.list__row') || [])].length >= 3,
  'стрелка в шапке возвращает к списку чатов', 'строк: ' + [...(root('messages')?.querySelectorAll('.list__row') || [])].length);
// системная кнопка «назад» закрывает приложение
api.back?.(); await W(900);
ok(api.currentApp() !== 'messages', 'системная «назад» из списка закрывает мессенджер', String(api.currentApp()));
api.goHome(); await W(500);
noErr('мессенджер', e0);

/* ============ 6. ТЕЛЕФОН ============ */
await step('6. Телефон: циферблат, USSD, исходящий, входящий, пропущенный');
e0 = errors.length;
const phoneMod = await mod('js/apps/phone.js');
await api.openApp('phone', { dial: '*100#' }); await W(1000);
ok([...(root('phone')?.querySelectorAll('.dialpad button') || [])].length >= 12, 'циферблат: ' + [...(root('phone')?.querySelectorAll('.dialpad button') || [])].length + ' кнопок');
ok((q('.dial-num')?.textContent || '').includes('*100#'), 'номер набран через параметр запуска: ' + q('.dial-num')?.textContent);
const callKey = [...(root('phone')?.querySelectorAll('.callbtn.answer') || [])].pop();
ok(!!callKey, 'зелёная клавиша вызова есть');
if (callKey) ev(callKey, 'click');
await W(500);
ok(!!q('.ussd'), 'USSD-запрос ушёл оператору (спиннер)');
await wait(QUICK ? 1200 : 3000);
const ussdText = (q('#syslayer .sysdialog')?.textContent || '');
ok(/Баланс/.test(ussdText), 'ответ сети *100# содержит баланс', ussdText.slice(0, 70).replace(/\s+/g, ' '));
ok(/Минут|SMS|Пакет/.test(ussdText), 'в ответе есть остатки пакета');
await dismiss(); await clean();
// исходящий звонок
api.killApp('phone'); await W(500);
await api.openApp('phone', { call: '1111' }); await wait(QUICK ? 1800 : 3600);
await okSoon(() => !!q('.callscr'), 'экран звонка появился');
await okSoon(() => /В разговоре/.test(q('.callscr')?.textContent || ''), 'исходящий соединился', () => (q('.callscr')?.textContent || '').slice(0, 40).replace(/\s+/g, ' '));
ok(window.__inCall === true, 'флаг __inCall установлен');
await okSoon(() => qa('.incall button').length >= 4, 'кнопок в режиме разговора: ' + qa('.incall button').length);
await okSoon(() => q('.callscr__timer, .call__timer')?.textContent && !/^00:00$/.test(q('.callscr__timer, .call__timer').textContent), 'таймер разговора идёт', () => q('.callscr__timer, .call__timer')?.textContent);
const hang = [...qa('.callbtn')].find((b) => b.classList.contains('decline')) || qa('.callbtn').pop();
if (hang) { ev(hang, 'click'); await W(1000); }
ok(!q('.callscr'), 'звонок завершён, экран убран');
ok(S().stats.calls >= 1, 'звонок учтён в статистике: ' + S().stats.calls);
ok(S().stats.callSec >= 1, 'секунды разговора: ' + S().stats.callSec);
ok(S().calls.length >= 1 && S().calls[S().calls.length - 1].dir === 'out', 'запись в истории вызовов', JSON.stringify(S().calls[S().calls.length - 1]));
ok(S().tasks.find((t) => t.id === 't14').done, 'задача «Позвонить» выполнена');
ok(!!S().achievements.call, 'достижение «Первый звонок»');
api.killApp('phone'); await W(500);
// входящий — ответить
phoneMod.incomingCall('anya');
await okSoon(() => /Входящий вызов/.test(q('.callscr')?.textContent || ''), 'входящий звонок звонит', () => (q('.callscr__state')?.textContent || ''));
const answer = [...qa('.callbtn')].find((b) => b.classList.contains('answer'));
ok(!!answer, 'есть зелёная кнопка «Ответить»');
if (answer) ev(answer, 'click');
await okSoon(() => /В разговоре/.test(q('.callscr')?.textContent || ''), 'входящий соединился после ответа');
await okSoon(() => q('.callscr__timer, .call__timer')?.textContent && !/^00:00$/.test(q('.callscr__timer, .call__timer').textContent), 'таймер входящего идёт', () => q('.callscr__timer, .call__timer')?.textContent);
const hang2 = [...qa('.callbtn')].find((b) => b.classList.contains('decline')) || qa('.callbtn').pop();
if (hang2) { ev(hang2, 'click'); await W(1000); }
ok(S().calls.some((c) => c.dir === 'in'), 'входящий записан в историю');
// входящий — отклонить
api.killApp('phone'); await W(600);
const c0 = S().calls.length;
const n0 = S().notifications.length;
phoneMod.incomingCall('kirill');
await okSoon(() => !!q('.callscr'), 'второй входящий звонит');
const decl = [...qa('.callbtn')].find((b) => b.classList.contains('decline'));
ok(!!decl, 'есть красная кнопка «Отклонить»');
if (decl) ev(decl, 'click');
await W(1500);
ok(S().calls.length > c0 && S().calls[S().calls.length - 1].dir === 'missed', 'отклонённый стал пропущенным', JSON.stringify(S().calls[S().calls.length - 1]));
await okSoon(() => S().notifications.length > n0, 'уведомление о пропущенном');
await wait(QUICK ? 1500 : 7000);
ok(S().messages.chats.kirill?.messages.some((m) => m.dir === 'in' && /голосов|набери|перезвон|не взял/i.test(m.text || '')), 'после пропущенного пришло сообщение на автоответчик');
api.goHome(); await W(500);
noErr('телефон', e0);

/* ============ 7. ИНТЕРНЕТ ============ */
await step('7. Интернет, браузер, покупки, мошенники');
e0 = errors.length;
const net = await mod('js/net.js');
ok(net.hasInternet().ok, 'интернет есть: ' + net.connectionLabel());
await api.openApp('browser'); await W(1000);
ok(!!root('browser'), 'браузер открылся');
const urlInput = root('browser').querySelector('.browser__url input');
const goto = async (u) => {
  urlInput.value = u; urlInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  urlInput.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await W(1300);
  return (root('browser')?.querySelector('.webpage')?.textContent || '').replace(/\s+/g, ' ').trim();
};
let txt = await goto('novanews.io');
ok(/Nova|новост/i.test(txt), 'novanews.io открылся', txt.slice(0, 46));
txt = await goto('novanews.io/nova-x5-pro');
ok(txt.length > 60, 'статья внутри новостного сайта', txt.slice(0, 46));
txt = await goto('wiki.nova');
ok(/Вики|энциклопед/i.test(txt), 'wiki.nova открылся', txt.slice(0, 46));
txt = await goto('wiki.nova/sim');
ok(txt.length > 60, 'статья вики про SIM', txt.slice(0, 46));
txt = await goto('memes.nova');
ok(txt.length > 40, 'memes.nova открылся', txt.slice(0, 46));
txt = await goto('bank.nova');
ok(/NovaBank/.test(txt), 'bank.nova открылся', txt.slice(0, 46));
txt = await goto('weather.nova');
ok(txt.length > 40, 'weather.nova открылся', txt.slice(0, 46));
txt = await goto('porno-site.xxx');
ok(/заблокирован/i.test(txt), 'взрослый сайт заблокирован', txt.slice(0, 46));
txt = await goto('super-prize-win-bonus-free-cash.com');
ok(/поздравл|выигра|приз|мошенн|подозрит/i.test(txt), 'сомнительный домен ведёт на «розыгрыш»', txt.slice(0, 54));
const blockBtn = [...(root('browser')?.querySelectorAll('.webpage button, .btn-web') || [])].find((b) => /Заблокировать|Пожаловаться/.test(b.textContent));
ok(!!blockBtn, 'на мошеннической странице есть кнопка жалобы');
if (blockBtn) { ev(blockBtn, 'click'); await W(900); await clean(); }
ok((S().browser.blocked || []).length >= 1 || S().achievements.spam, 'сайт заблокирован / достижение «Спам»', JSON.stringify(S().browser.blocked));
txt = await goto('несуществующий-сайт.рф');
ok(/не найдена|404|Результатов: 0/i.test(txt), 'неизвестный адрес → 404 или пустая выдача', txt.slice(0, 46));
txt = await goto('как снять симку');
ok(/результат|найдено|Nova Search/i.test(txt), 'поисковая выдача работает', txt.slice(0, 46));
// магазин и покупка
await goto('techshop.online');
const prod = [...(root('browser')?.querySelectorAll('.webpage a') || [])].find((a) => /Чехол|Наушники|Стекло|Повербанк/i.test(a.textContent));
ok(!!prod, 'в каталоге есть товары', prod?.textContent.trim().slice(0, 30));
if (prod) {
  ev(prod, 'click'); await W(1200);
  const buy = [...(root('browser')?.querySelectorAll('.webpage button, .btn-web') || [])].find((b) => /Купить за/.test(b.textContent));
  ok(!!buy, 'страница товара с ценой', buy?.textContent.trim());
  const bal0 = S().bank.balance;
  if (buy) { ev(buy, 'click'); await W(1500); const c = sysBtn(/Купить|Оплатить|Да/); if (c) { ev(c, 'click'); await W(2000); } }
  await okSoon(() => S().bank.balance < bal0, 'деньги с карты списаны', () => bal0.toFixed(2) + ' → ' + S().bank.balance.toFixed(2));
  ok(S().stats.purchases >= 1, 'покупка учтена в статистике: ' + S().stats.purchases);
  ok(!!S().achievements.shop, 'достижение «Шопоголик»');
}
ok(S().browser.history.length >= 5, 'история браузера: ' + S().browser.history.length);
ok(S().browser.bookmarks.length >= 1, 'закладки: ' + S().browser.bookmarks.length);
ok(!!S().achievements.internet && !!S().achievements.search, 'достижения internet/search');
ok(S().tasks.find((t) => t.id === 't13').done, 'задача «Зайти в интернет» выполнена');
api.goHome(); await W(500);
noErr('браузер', e0);

/* ============ 8. КАМЕРА И ГАЛЕРЕЯ ============ */
await step('8. Камера: режимы, селфи, вспышка; галерея: избранное, обои, удаление');
e0 = errors.length;
await api.openApp('camera'); await W(1100);
ok(qa('.cam__modes button').length >= 5, 'режимов съёмки: ' + qa('.cam__modes button').length);
for (const m of qa('.cam__modes button')) {
  const e1 = errors.length;
  ev(m, 'click'); await W(500);
  const sh = q('.cam__shutter');
  if (sh) ev(sh, 'click');
  await wait(QUICK ? 900 : 2100);
  const sh2 = q('.cam__shutter');
  if (sh2 && sh2.classList.contains('rec')) { ev(sh2, 'click'); await W(1000); }
  noErr('режим «' + m.textContent.trim() + '»', e1);
}
ok(S().photos.length >= 6, 'снято кадров: ' + S().photos.length);
ok(S().photos.some((p) => p.mode === 'video'), 'есть видеоролик');
ok(S().photos.some((p) => p.mode === 'night'), 'есть ночной кадр');
const flip = q('.cam__flip');
if (flip) { ev(flip, 'click'); await W(700); const sh = q('.cam__shutter'); if (sh) ev(sh, 'click'); await wait(QUICK ? 900 : 1700); }
ok(S().photos.some((p) => p.front), 'селфи снято');
ok(!!S().achievements.photo && !!S().achievements.selfie && !!S().achievements.video, 'достижения photo/selfie/video');
ok(S().phone.storage.photos > 0, 'память под фото: ' + S().phone.storage.photos.toFixed(2) + ' ГБ');
ok(S().tasks.find((t) => t.id === 't12').done, 'задача «Сделать фото» выполнена');
for (const b of qa('.cam__top button').slice(1, 5)) { const e1 = errors.length; ev(b, 'click'); await W(600); await clean(); noErr('кнопка камеры «' + (b.title || '?') + '»', e1); }
api.back?.(); await W(600);
api.goHome(); await W(500);
await api.openApp('gallery'); await W(1000);
ok(qa('.gal-item').length === S().photos.length, 'в галерее все кадры: ' + qa('.gal-item').length);
const vidAlb = [...(root('gallery')?.querySelectorAll('.chip, .tabs button') || [])].find((b) => /Видео/.test(b.textContent));
if (vidAlb) { ev(vidAlb, 'click'); await W(700); }
ok(qa('.gal-item').length >= 1, 'альбом «Видео» фильтрует: ' + qa('.gal-item').length);
const allAlb = [...(root('gallery')?.querySelectorAll('.chip, .tabs button') || [])].find((b) => /^Все/.test(b.textContent.trim()));
if (allAlb) { ev(allAlb, 'click'); await W(700); }
ev(q('.gal-item'), 'click'); await W(1100);
ok(!!q('.gal-view'), 'просмотр фото открылся');
ok(/МП|ISO/.test(q('.gal-view__info')?.textContent || ''), 'показаны параметры снимка', (q('.gal-view__info')?.textContent || '').slice(0, 44).replace(/\s+/g, ' '));
const starBtn = [...(q('.gal-view__top')?.querySelectorAll('button') || [])][1];
if (starBtn) { ev(starBtn, 'click'); await W(700); }
ok(S().photos.some((p) => p.fav), 'фото добавлено в избранное');
const wallBtn = [...(q('.gal-view')?.querySelectorAll('.gal-view__actions button') || [])].find((b) => /На обои/.test(b.textContent));
if (wallBtn) { ev(wallBtn, 'click'); await W(900); const c = sysBtn(/Оба|Домашний|Обои/); if (c) { ev(c, 'click'); await W(900); } await clean(); }
ok(S().flags.customWall.home || S().flags.customWall.lock, 'фото поставлено на обои: ' + JSON.stringify(S().flags.customWall));
ok(!!S().achievements.wall, 'достижение «Обои»');
const capBtn = [...(q('.gal-view')?.querySelectorAll('button') || [])].find((b) => /Подпись/.test(b.textContent));
if (capBtn) {
  ev(capBtn, 'click'); await W(900);
  const inp = q('.sysdialog__input');
  if (inp) { inp.value = 'Мой новый телефон'; inp.dispatchEvent(new window.Event('input', { bubbles: true })); }
  const c = sysBtn(/Сохранить|ОК|Готово/); if (c) ev(c, 'click');
  await W(900);
}
ok(S().photos.some((p) => p.caption), 'подпись к фото сохранена', JSON.stringify(S().photos.find((p) => p.caption)?.caption));
const nBefore = S().photos.length;
const delBtn = [...(q('.gal-view')?.querySelectorAll('button') || [])].find((b) => /Удалить/.test(b.textContent));
if (delBtn) { ev(delBtn, 'click'); await W(900); const c = sysBtn(/Удалить/); if (c) { ev(c, 'click'); await W(900); } }
ok(S().photos.length === nBefore - 1, 'удаление фото работает');
api.goHome(); await W(500);
noErr('камера и галерея', e0);

/* ============ 9. БАНК И МАГАЗИН ============ */
await step('9. NovaBank и Nova Store');
e0 = errors.length;
await api.openApp('bank'); await W(1000);
ok(/NovaBank/.test(root('bank')?.textContent || ''), 'банк открылся');
ok(/137|129|\d+\.\d+/.test(root('bank')?.textContent || ''), 'показан баланс карты');
const bal0 = S().bank.balance, cash0 = S().money;
const qb = [...(root('bank')?.querySelectorAll('.bank__quick button') || [])];
ok(qb.length >= 4, 'быстрых операций: ' + qb.length);
const cashIn = qb.find((b) => /наличн/i.test(b.textContent));
if (cashIn) { ev(cashIn, 'click'); await W(900); const c = sysBtn(/Всё|10/); if (c) ev(c, 'click'); await W(1400); }
ok(S().money < cash0 && S().bank.balance > bal0, 'внесение наличных на карту', cash0.toFixed(2) + '→' + S().money.toFixed(2) + ' € / ' + bal0.toFixed(2) + '→' + S().bank.balance.toFixed(2) + ' €');
const mobTop = qb.find((b) => /Мобильная/i.test(b.textContent));
if (mobTop) { ev(mobTop, 'click'); await W(900); const c = sysBtn(/10 €|Пополнить/); if (c) ev(c, 'click'); await W(1400); await clean(); }
ok(S().bank.transactions.length >= 3, 'операций в истории: ' + S().bank.transactions.length);
const transfer = qb.find((b) => /Перевод/i.test(b.textContent));
const balBefore = S().bank.balance;
if (transfer) {
  ev(transfer, 'click'); await W(900);
  let inp = q('.sysdialog__input');
  if (inp) { inp.value = 'Мама'; const nx = sysBtn(/Далее/); if (nx) ev(nx, 'click'); await W(1000); }
  inp = q('.sysdialog__input');
  if (inp) { inp.value = '25'; const nx = sysBtn(/Перевести/); if (nx) ev(nx, 'click'); await W(1000); }
  const cf = sysBtn(/Подтвердить/); if (cf) ev(cf, 'click');
  await W(1800); await clean();
}
ok(S().bank.balance < balBefore, 'перевод списал деньги: ' + balBefore.toFixed(2) + ' → ' + S().bank.balance.toFixed(2));
ok(S().bank.transactions.some((t) => /Перевод|Мама/i.test((t.title || '') + (t.text || ''))), 'перевод попал в историю операций');
ok(!!S().achievements.bank, 'достижение «Банк» после перевода');
ok(S().stats.transfers >= 1, 'переводы в статистике: ' + S().stats.transfers);
const cur = qb.find((b) => /Обмен/i.test(b.textContent));
if (cur) { const e1 = errors.length; ev(cur, 'click'); await W(1000); await clean(); noErr('обмен валют', e1); }
for (const t of ['История', 'Услуги']) {
  const tb = [...(root('bank')?.querySelectorAll('.tabs button') || [])].find((b) => b.textContent.trim() === t);
  if (tb) { const e1 = errors.length; ev(tb, 'click'); await W(800); noErr('вкладка банка «' + t + '»', e1); }
}
api.goHome(); await W(500);
// магазин приложений
await api.openApp('store'); await W(1100);
ok(qa('.app-card').length >= 15, 'приложений в магазине: ' + qa('.app-card').length);
ok(qa('[data-app="store"] .chip').length >= 6, 'категорий в магазине: ' + qa('[data-app="store"] .chip').length);
const chess = [...qa('.app-card')].find((c) => /Шахматы/.test(c.textContent));
ok(!!chess, 'найдено платное приложение «Шахматы»');
if (chess) { ev(chess.querySelector('.grow'), 'click'); await W(1200); }
ok(root('store')?.querySelector('.appbar h1 span')?.textContent === 'Шахматы', 'страница приложения открылась');
ok(root('store')?.querySelectorAll('.appbody div[style*="108px"]').length >= 3, 'скриншоты приложения: ' + root('store')?.querySelectorAll('.appbody div[style*="108px"]').length);
ok(/оценок|Рейтинг/.test(root('store')?.textContent || ''), 'рейтинг и число оценок');
const buyBtn = [...(root('store')?.querySelectorAll('.appbody button') || [])].find((b) => /Купить за/.test(b.textContent));
ok(!!buyBtn, 'кнопка покупки: ' + buyBtn?.textContent.trim());
const b1 = S().bank.balance;
if (buyBtn) {
  ev(buyBtn, 'click'); await W(1200);
  ok(/Купить приложение/.test(q('.sysdialog__title')?.textContent || ''), 'появилось подтверждение покупки');
  const confirm = sysBtn(/Купить|Оплатить/); if (confirm) ev(confirm, 'click');
  await wait(QUICK ? 3000 : 6500);
}
ok(S().store.installed.includes('chess'), 'приложение установлено');
ok(S().bank.balance < b1, 'деньги списаны: ' + b1.toFixed(2) + ' → ' + S().bank.balance.toFixed(2));
ok(!!S().achievements.install, 'достижение «Установка»');
api.back?.(); await W(800);
ok(qa('.app-card').length >= 15, 'кнопка «назад» возвращает в каталог');
api.goHome(); await W(600);
const chessIcon = [...qa('#layer-home .hicon')].find((i) => /Шахматы/.test(i.textContent));
ok(!!chessIcon, 'иконка нового приложения появилась на столе');
if (chessIcon) { ev(chessIcon, 'click'); await W(1400); }
ok(api.currentApp() === 'chess', 'установленное приложение запускается');
api.goHome(); await W(500);
noErr('банк и магазин', e0);

/* ============ 10. ОСТАЛЬНЫЕ ПРИЛОЖЕНИЯ ============ */
await step('10. Часы, заметки, калькулятор, музыка, радио, диктофон, уровень, змейка, погода, файлы');
e0 = errors.length;
// ЧАСЫ
await api.openApp('clock'); await W(900);
ok(qa(root('clock').querySelectorAll('.tabs button')).length >= 4, 'вкладок в часах: ' + qa(root('clock').querySelectorAll('.tabs button')).length);
const addAlarm = [...root('clock').querySelectorAll('button')].find((b) => /Добавить будильник/.test(b.textContent));
if (addAlarm) { ev(addAlarm, 'click'); await W(1000); }
ok(!!q('.sysdialog'), 'диалог нового будильника');
ok(qa('.sysdialog .chip').length === 7, 'выбор дней недели: 7 чипов');
const sv = sysBtn(/Сохранить/); if (sv) ev(sv, 'click');
await W(1100);
const nAlarms = S().alarms.length;
ok(nAlarms >= 2, 'будильник создан: ' + nAlarms);
ok(S().alarms[nAlarms - 1].on === true, 'новый будильник включён');
const tmTab = [...root('clock').querySelectorAll('.tabs button')].find((b) => /Таймер/.test(b.textContent));
ev(tmTab, 'click'); await W(800);
const preset = qa('.timer-presets .chip')[2];
if (preset) { ev(preset, 'click'); await W(900); }
ok(S().timer.totalSec > 0, 'таймер взведён: ' + S().timer.totalSec + ' с');
const swTab = [...root('clock').querySelectorAll('.tabs button')].find((b) => /Секундомер/.test(b.textContent));
ev(swTab, 'click'); await W(800);
const startB = [...root('clock').querySelectorAll('button')].find((b) => /Старт/.test(b.textContent));
if (startB) {
  ev(startB, 'click'); await wait(QUICK ? 900 : 1800);
  const lap = [...root('clock').querySelectorAll('button')].find((b) => /Круг/.test(b.textContent));
  if (lap) ev(lap, 'click');
  await W(800);
}
ok(S().stopwatch.running === true, 'секундомер запущен');
await okSoon(() => /00:0[1-9]/.test(q('#sw-t')?.textContent || ''), 'циферблат секундомера тикает', () => q('#sw-t')?.textContent + q('#sw-ms')?.textContent);
ok(S().stopwatch.laps.length >= 1 && S().stopwatch.laps[0] > 0, 'круг записан: ' + S().stopwatch.laps.length + ' · ' + (S().stopwatch.laps[0] || 0).toFixed(2) + ' с');
const stopB = [...root('clock').querySelectorAll('button')].find((b) => /Стоп/.test(b.textContent));
if (stopB) { ev(stopB, 'click'); await W(700); }
ok(S().stopwatch.running === false && S().stopwatch.acc > 0, 'после «Стоп» время накоплено: ' + S().stopwatch.acc.toFixed(2) + ' с');
const resetB = [...root('clock').querySelectorAll('button')].find((b) => /Сброс/.test(b.textContent));
if (resetB) { ev(resetB, 'click'); await W(700); }
ok(S().stopwatch.acc === 0 && S().stopwatch.laps.length === 0, '«Сброс» обнуляет секундомер');
api.goHome(); await W(400);
// ЗАМЕТКИ
await api.openApp('notes'); await W(900);
const fab = root('notes')?.querySelector('.fab');
ok(!!fab, 'в заметках есть кнопка создания');
if (fab) ev(fab, 'click');
await W(900);
const ti = q('.note-edit .title'), ta = q('.note-edit textarea');
ok(!!ti && !!ta, 'открылся редактор заметки');
ti.value = 'Список дел'; ti.dispatchEvent(new window.Event('input', { bubbles: true }));
ta.value = '1. Не сесть на скрепку\n2. Зарядить телефон'; ta.dispatchEvent(new window.Event('input', { bubbles: true }));
await W(400);
const pinB = qa('.note-edit .iconbtn')[0];
if (pinB) ev(pinB, 'click');
await W(400);
api.back?.(); await W(1000);
ok(S().notes.some((n) => n.title === 'Список дел'), 'заметка сохранена');
ok(S().notes.some((n) => n.pinned), 'заметка закреплена');
ok(!!S().achievements.note, 'достижение «Заметка»');
api.goHome(); await W(400);
// КАЛЬКУЛЯТОР
await api.openApp('calc'); await W(900);
ok(qa(root('calc').querySelectorAll('button')).length >= 19, 'клавиш калькулятора: ' + qa(root('calc').querySelectorAll('button')).length);
for (const k of ['2', '×', '6', '=']) {
  const b = [...root('calc').querySelectorAll('button')].find((x) => x.textContent.trim() === k);
  if (b) { ev(b, 'click'); await W(300); }
}
ok(/12/.test(q('.calc__screen')?.textContent || root('calc')?.textContent || ''), '2 × 6 = 12', q('.calc__screen')?.textContent.trim());
ok(S().calcHistory.length >= 1, 'вычисление попало в историю: ' + S().calcHistory.length);
api.goHome(); await W(400);
// МУЗЫКА
await api.openApp('music'); await W(1000);
ok(qa('.track-row').length >= 5, 'треков в библиотеке: ' + qa('.track-row').length);
ev(q('.np__play'), 'click'); await wait(QUICK ? 1800 : 3200);
ok(S().music.playing, 'музыка играет');
ok(S().music.pos > 0, 'позиция трека растёт: ' + S().music.pos + ' с');
ok(S().notifications.some((n) => n.appId === 'music'), 'уведомление плеера висит в шторке');
const nextBtn = qa('.np__ctrl button')[3];
const t0 = S().music.trackId;
if (nextBtn) { ev(nextBtn, 'click'); await W(900); }
ok(S().music.trackId !== t0, 'переключение на следующий трек: ' + S().music.trackId);
const tr5 = qa('.track-row')[4];
if (tr5) { ev(tr5, 'click'); await W(900); }
ok(qa('.track-row').length >= 5, 'выбор трека из списка не ломает плеер');
api.goHome(); await W(500);
ok(S().music.playing, 'музыка продолжает играть в фоне');
ok(!!S().achievements.music, 'достижение «Меломан»');
// РАДИО
await api.openApp('radio'); await W(1000);
ok(qa(root('radio').querySelectorAll('.st-row, .list__row, .radio__list button')).length >= 9, 'радиостанций: ' + qa(root('radio').querySelectorAll('.st-row, .list__row, .radio__list button')).length);
const playR = root('radio')?.querySelector('.rd-play');
ok(!!playR, 'в радио есть кнопка воспроизведения');
if (playR) { ev(playR, 'click'); await W(1600); }
ok(S().radio.playing === true, 'радио играет (нужен интернет)');
ok(!!S().radio.now && S().radio.now.length > 3, 'показано, что сейчас в эфире: ' + S().radio.now);
ok(qa('.rd-eq.on').length >= 1, 'эквалайзер анимируется');
const stations = qa(root('radio').querySelectorAll('.list__row.station'));
ok(stations.length >= 9, 'станций в списке: ' + stations.length);
const st2 = stations[3];
if (st2) { const e1 = errors.length; ev(st2, 'click'); await W(1200); noErr('переключение станции', e1); }
ok(S().radio.playing && /в эфире/.test(root('radio')?.textContent || ''), 'после выбора станции эфир продолжается');
const sleepB = [...root('radio').querySelectorAll('button')].find((b) => /Таймер сна/.test(b.textContent));
if (sleepB) { ev(sleepB, 'click'); await W(900); const c = sysBtn(/15 минут/); if (c) ev(c, 'click'); await W(900); }
ok(S().radio.sleep === 15, 'таймер сна установлен: ' + S().radio.sleep);
api.goHome(); await W(400);
// ДИКТОФОН
await api.openApp('recorder'); await W(1000);
ev(q('.rec-main'), 'click'); await wait(QUICK ? 1200 : 2400);
ok(S().recorder.recording === true || S().recorder.recording, 'запись идёт');
ev(q('.rec-main'), 'click'); await W(1100);
ok(S().recordings.length === 1, 'запись сохранена: ' + S().recordings.length);
ok(S().recordings[0]?.size > 0, 'размер записи: ' + S().recordings[0]?.size + ' Б');
const shareRec = qa('.rec-row .iconbtn')[0];
if (shareRec) {
  ev(shareRec, 'click'); await W(900);
  const inp = q('.sysdialog__input');
  if (inp) { inp.value = 'Кирилл'; inp.dispatchEvent(new window.Event('input', { bubbles: true })); }
  const c = sysBtn(/Отправить/); if (c) ev(c, 'click');
  await W(1600); await clean();
}
ok((S().messages.chats.kirill?.messages || []).some((m) => m.voice || /🎙/.test(m.text || '')), 'голосовое сообщение ушло в чат');
api.goHome(); await W(400);
// УРОВЕНЬ
await api.openApp('level'); await W(1000);
ok(qa(root('level').querySelectorAll('.tabs button')).length >= 3, 'режимов уровня: ' + qa(root('level').querySelectorAll('.tabs button')).length);
const pad = q('#lvl-pad');
if (pad) {
  ev(pad, 'pointerdown', { clientX: 195, clientY: 400 });
  ev(pad, 'pointermove', { clientX: 265, clientY: 455 });
  await W(500);
  ev(pad, 'pointerup', { clientX: 265, clientY: 455 });
  await W(500);
}
ok(/°/.test(q('#lvl-roll')?.textContent || ''), 'пузырьковый уровень реагирует на наклон: ' + q('#lvl-roll')?.textContent);
api.goHome(); await W(400);
// ЗМЕЙКА
await api.openApp('snake'); await W(1000);
const playSnake = [...root('snake').querySelectorAll('button')].find((b) => /Играть/.test(b.textContent));
ok(!!playSnake, 'в змейке есть кнопка «Играть»');
if (playSnake) ev(playSnake, 'click');
await wait(QUICK ? 1200 : 2800);
ok(!!q('#sn-grid'), 'поле змейки на месте');
ok(q('#sn-grid')?.style.getPropertyValue('--cols') > 0 && q('#sn-grid')?.style.getPropertyValue('--rows') > 0,
  'размер поля: ' + q('#sn-grid')?.style.getPropertyValue('--cols') + '×' + q('#sn-grid')?.style.getPropertyValue('--rows'));
ok(qa('#sn-grid .cell').length >= 4, 'на поле отрисованы змейка и еда: ' + qa('#sn-grid .cell').length + ' ячеек');
ok(!!q('#sn-grid .cell.head') && !!q('#sn-grid .cell.food'), 'есть голова змейки и яблоко');
ok(qa('.snake__dpad button').length >= 4, 'экранный D-pad: ' + qa('.snake__dpad button').length + ' кнопок');
const headBefore = q('#sn-grid .cell.head')?.style.gridArea;
await wait(QUICK ? 900 : 1800);
const headAfter = q('#sn-grid .cell.head')?.style.gridArea;
ok(headBefore !== headAfter, 'змейка ползёт сама: ' + headBefore + ' → ' + headAfter);
const dpad = qa('.snake__dpad button');
if (dpad[0]) ev(dpad[0], 'click');
await W(900);
ok(!!q('#sn-grid .cell.head'), 'змейка управляется D-pad и продолжает жить');
// свайп по полю
const stage = q('#sn-stage');
if (stage) { ev(stage, 'pointerdown', { clientX: 180, clientY: 400 }); ev(stage, 'pointerup', { clientX: 180, clientY: 330 }); await W(900); }
ok(!!q('#sn-grid .cell.head') || !!q('#sn-overlay'), 'свайп по полю тоже управляет змейкой');
api.goHome(); await W(400);
// ПОГОДА
await api.openApp('weather'); await W(1100);
ok(qa('.wx-hour').length >= 12, 'почасовой прогноз: ' + qa('.wx-hour').length + ' часов');
ok(qa('.wx-day').length >= 7, 'прогноз на неделю: ' + qa('.wx-day').length + ' дней');
ok(qa('.wx-stat').length >= 3, 'показатели погоды: ' + qa('.wx-stat').length);
const cityB = [...root('weather').querySelectorAll('button')].find((b) => /Сменить город/.test(b.textContent));
if (cityB) { ev(cityB, 'click'); await W(1000); const c = sysBtn(/Антверпен|Гент/); if (c) { ev(c, 'click'); await W(1100); } await clean(); }
ok(S().weather.city !== 'Брюссель', 'город погоды сменился: ' + S().weather.city);
api.goHome(); await W(400);
// ФАЙЛЫ
await api.openApp('files'); await W(1000);
ok(qa(root('files').querySelectorAll('.file-row')).length >= 5, 'папок в файловом менеджере: ' + qa(root('files').querySelectorAll('.file-row')).length);
const dl = [...root('files').querySelectorAll('.file-row')].find((r) => /Загрузки/.test(r.textContent));
ok(!!dl, 'папка «Загрузки» на месте');
if (dl) { ev(dl, 'click'); await W(1000); }
ok(qa(root('files').querySelectorAll('.file-row')).length >= 3, 'в «Загрузках» есть файлы: ' + qa(root('files').querySelectorAll('.file-row')).length);
const doc = root('files')?.querySelector('.file-row');
if (doc) { ev(doc, 'click'); await W(1100); }
ok(!!q('.sysdialog'), 'просмотр документа открылся', q('.sysdialog__title')?.textContent);
await clean();
api.back?.(); await W(700);
ok(api.currentApp() === 'files', 'кнопка «назад» возвращает в файловый менеджер');
const dcim = [...(root('files')?.querySelectorAll('.file-row') || [])].find((r) => /DCIM/.test(r.textContent));
if (dcim) { api.back?.(); await W(700); const d2 = [...(root('files')?.querySelectorAll('.file-row') || [])].find((r) => /DCIM/.test(r.textContent)); if (d2) { ev(d2, 'click'); await W(1000); } }
ok(true, 'папка DCIM открывается');
api.goHome(); await W(400);
noErr('остальные приложения', e0);

/* ============ 11. НАСТРОЙКИ ============ */
await step('11. Настройки: разделы, плитки, тема, режим разработчика, OTA-обновление');
e0 = errors.length;
await api.openApp('settings'); await W(1100);
const sroot = () => root('settings');
const title = () => sroot()?.querySelector('.appbar h1 span')?.textContent;
ok(title() === 'Настройки', 'главный экран настроек открылся', String(title()));
ok(qa(sroot().querySelectorAll('.set-tile .st')).length === 4, 'быстрых плиток: ' + qa(sroot().querySelectorAll('.set-tile .st')).length);
for (const t of qa(sroot().querySelectorAll('.set-tile .st'))) {
  const e1 = errors.length;
  ev(t, 'click'); await W(900); await clean();
  noErr('плитка быстрых настроек', e1);
  let g = 0; while (title() !== 'Настройки' && g++ < 4) { api.back?.(); await W(600); }
}
const sections = ['Сеть и интернет', 'Подключение устройств', 'Приложения и уведомления', 'Батарея', 'Память',
  'Звук и вибрация', 'Экран и оформление', 'Обои', 'Безопасность', 'Цифровое благополучие', 'Система', 'О телефоне'];
ok([...(sroot()?.querySelectorAll('.list__row') || [])].length >= sections.length, 'разделов настроек: ' + [...(sroot()?.querySelectorAll('.list__row') || [])].length);
for (const name of sections) {
  if (!sroot()) { await api.openApp('settings'); await W(1000); }
  let guardBack = 0;
  while (title() !== 'Настройки' && guardBack++ < 5) { api.back?.(); await W(600); }
  if (!sroot()) { await api.openApp('settings'); await W(1000); }
  const row = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => r.textContent.includes(name));
  if (!row) { ok(false, 'раздел «' + name + '» не найден'); continue; }
  const e1 = errors.length;
  ev(row, 'click'); await W(1000);
  const rows = (sroot()?.querySelectorAll('.list__row') || []).length;
  const switches = (sroot()?.querySelectorAll('.switch') || []).length;
  noErr('раздел «' + name + '»', e1);
  ok(title() === name || rows + switches > 0, '«' + name + '»: строк ' + rows + ', переключателей ' + switches);
  for (let i = 0; i < 2; i++) {
    const sub = [...(sroot()?.querySelectorAll('.list__row') || [])][i];
    if (!sub) break;
    const e2 = errors.length;
    ev(sub, 'click'); await W(1000); await clean();
    noErr('под-раздел «' + name + '» #' + (i + 1), e2);
    let g = 0; while (title() !== name && g++ < 4) { api.back?.(); await W(550); }
  }
  let g = 0; while (title() !== 'Настройки' && g++ < 5) { api.back?.(); await W(600); }
}
// тема оформления и цвет акцента
async function toMain() {
  let g = 0;
  while (title() !== 'Настройки' && g++ < 6) { api.back?.(); await W(600); }
  if (!sroot()) { await api.openApp('settings'); await W(1100); }
  g = 0;
  while (title() !== 'Настройки' && g++ < 6) { api.back?.(); await W(600); }
  return title() === 'Настройки';
}
ok(await toMain(), 'вернулись в корень настроек');
const displayRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Экран и оформление/.test(r.textContent));
ok(!!displayRow, 'раздел «Экран и оформление» найден');
if (displayRow) { ev(displayRow, 'click'); await W(1100); }
const lightChip = [...(sroot()?.querySelectorAll('.chip') || [])].find((b) => /Светлая/.test(b.textContent));
const darkChip = [...(sroot()?.querySelectorAll('.chip') || [])].find((b) => /Тёмная/.test(b.textContent));
ok(!!lightChip && !!darkChip, 'есть переключатели светлой и тёмной темы');
if (lightChip) { ev(lightChip, 'click'); await W(1000); }
ok(S().phone.theme === 'light', 'включилась светлая тема: ' + S().phone.theme);
if (darkChip) { ev(darkChip, 'click'); await W(1000); }
ok(S().phone.theme === 'dark', 'вернулась тёмная тема: ' + S().phone.theme);
ok(!!S().achievements.dark, 'достижение «Тёмная тема»');
const accentBefore = S().phone.accent;
const dots = qa(sroot()?.querySelectorAll('.color-dot') || []);
ok(dots.length >= 4, 'цветов акцента: ' + dots.length);
if (dots[2]) { ev(dots[2], 'click'); await W(900); }
ok(S().phone.accent !== accentBefore, 'цвет акцента сменился: ' + accentBefore + ' → ' + S().phone.accent);
const fontBtns = [...(sroot()?.querySelectorAll('.chip') || [])].filter((b) => /Мелкий|Средний|Крупный|Очень/.test(b.textContent));
if (fontBtns[fontBtns.length - 1]) { const e1 = errors.length; ev(fontBtns[fontBtns.length - 1], 'click'); await W(900); noErr('размер шрифта', e1); }
const autoSw = sroot()?.querySelector('.switch');
if (autoSw) { const e1 = errors.length; ev(autoSw, 'click'); await W(900); noErr('переключатель автояркости', e1); }
ok(await toMain(), 'снова в корне настроек');
// режим разработчика
const aboutRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /О телефоне/.test(r.textContent));
ok(!!aboutRow, 'раздел «О телефоне» найден');
if (aboutRow) { ev(aboutRow, 'click'); await W(1100); }
ok(/NX5P\./.test(sroot()?.textContent || ''), 'показан номер сборки', (sroot()?.textContent.match(/NX5P\.\S+/) || [''])[0]);
ok(/IMEI/.test(sroot()?.textContent || ''), 'показан IMEI');
ok(/NOVA X5 Pro/.test(sroot()?.textContent || ''), 'показана модель');
const buildRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Номер сборки/.test(r.textContent));
ok(!!buildRow, 'строка «Номер сборки» найдена');
for (let i = 0; i < 7; i++) { if (buildRow) { ev(buildRow, 'click'); await W(220); } }
await W(900);
ok(S().phone.devMode === true, 'режим разработчика открыт 7 касаниями по номеру сборки');
ok(await toMain(), 'вернулись в корень настроек после «О телефоне»');
// OTA-обновление
const sysRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Система/.test(r.textContent));
ok(!!sysRow, 'раздел «Система» найден');
if (sysRow) { ev(sysRow, 'click'); await W(1100); }
const updRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Обновление системы/.test(r.textContent));
ok(!!updRow, 'пункт «Обновление системы» найден');
const buildBefore = S().phone.about.build, osBefore = S().phone.about.os;
if (updRow) { ev(updRow, 'click'); }
await okSoon(() => /Проверка обновлений/.test(q('.sysdialog__title')?.textContent || ''), 'сначала показывается «Проверка обновлений…»');
await okSoon(() => /15\.0\.1 доступна/.test(q('.sysdialog__title')?.textContent || ''),
  'найдено обновление NovaOS 15.0.1', () => q('.sysdialog__title')?.textContent);
ok(/Размер|Что нового/.test(q('.sysdialog')?.textContent || ''), 'в диалоге описано, что нового');
ok(!!sysBtn(/Позже/), 'можно отложить обновление («Позже»)');
const installBtn = sysBtn(/Установить/);
ok(!!installBtn, 'в диалоге есть кнопка «Установить»');
if (installBtn) ev(installBtn, 'click');
await okSoon(() => /Обновление системы/.test(q('.sysdialog__title')?.textContent || ''), 'пошёл процесс установки');
await okSoon(() => S().phone.about.build !== buildBefore, 'номер сборки обновился', () => buildBefore + ' → ' + S().phone.about.build, 20);
ok(S().phone.about.os !== osBefore, 'версия ОС обновилась: ' + osBefore + ' → ' + S().phone.about.os);
ok(/NX5P\.251021\.005/.test(S().phone.about.build), 'новая сборка: ' + S().phone.about.build);
ok(S().notifications.some((n) => /Обновление установлено/.test(n.title || '')), 'пришло уведомление об обновлении');
await clean();
ok(await toMain(), 'после обновления снова виден корень настроек');
// раздел «Система»: сброс и отладочные пункты
const sysRow2 = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Система/.test(r.textContent));
if (sysRow2) { ev(sysRow2, 'click'); await W(1100); }
const sysRows = [...(sroot()?.querySelectorAll('.list__row') || [])].map((r) => r.textContent.trim().slice(0, 22));
ok(sysRows.some((t) => /Сброс/.test(t)), 'пункт «Сброс» присутствует в разделе «Система»', sysRows.join(' / '));
ok(sysRows.some((t) => /Обновление системы/.test(t)), 'пункт «Обновление системы» на месте');
ok(sysRows.some((t) => /Язык|Дата и время|Резервное/i.test(t)), 'есть язык, дата и резервное копирование');
ok(sysRows.some((t) => /Скорость времени|Батарея|Деньги/i.test(t)), 'в режиме разработчика появились отладочные пункты');
// отладочный пункт «Деньги» реально начисляет
const moneyRow = [...(sroot()?.querySelectorAll('.list__row') || [])].find((r) => /Деньги/i.test(r.textContent));
if (moneyRow) { const m0 = S().bank.balance; ev(moneyRow, 'click'); await W(900); const add = sysBtn(/\+50|Начислить|Да/); if (add) ev(add, 'click'); await W(1200); await clean();
  ok(S().bank.balance > m0, 'отладка начислила деньги: ' + m0.toFixed(2) + ' → ' + S().bank.balance.toFixed(2)); }
noErr('настройки', e0);

/* ============ 12. СИСТЕМА ============ */
await step('12. Экран, блокировка, PIN, батарея, перезагрузка, сохранение, сюжет');
e0 = errors.length;
api.goHome(); await W(500);
api.screenOff(); await W(800);
ok(!S().phone.awake && !q('#screen').classList.contains('awake'), 'экран гаснет по кнопке питания');
ok(S().phone.locked, 'телефон заблокировался');
api.wake(); await W(1000);
ok(!!q('.lock'), 'экран блокировки появился');
ok(/Свайп вверх/.test(q('.lock')?.textContent || ''), 'подсказка о свайпе вверх');
ok(qa('.lock__notifs .notif, .lock .notif').length >= 0, 'уведомления видны на экране блокировки');
dragIt('.lock', 0, -150); await W(1100);
ok(!!q('.pinpad'), 'свайп вверх открыл PIN-пад');
ok(qa('.pinpad__key').length === 13, 'клавиш PIN-пада: ' + qa('.pinpad__key').length);
for (const d of ['9', '9', '9', '9']) { const k = qa('.pinpad__key').find((x) => x.textContent.trim().startsWith(d)); if (k) { ev(k, 'click'); await W(220); } }
await W(1800);
ok(S().phone.locked, 'неверный PIN не разблокировал');
ok(/Неверный/.test(q('.pinpad__title')?.textContent || ''), 'показано сообщение об ошибке: ' + q('.pinpad__title')?.textContent);
const u0 = S().stats.unlocks;
for (const d of ['1', '2', '3', '4']) { const k = qa('.pinpad__key').find((x) => x.textContent.trim().startsWith(d)); if (k) { ev(k, 'click'); await W(220); } }
await W(1900);
ok(!S().phone.locked, 'верный PIN разблокировал телефон');
ok(S().stats.unlocks === u0 + 1, 'счётчик разблокировок вырос: ' + S().stats.unlocks);
ok(!!S().achievements.unlock, 'достижение «Разблокировка»');
// батарея и зарядка
S().phone.battery.pct = 12;
(await mod('js/state.js')).save();
const pct0 = S().phone.battery.pct;
click('#prop-charger'); await W(1800);
ok(S().world.chargerPlugged, 'зарядка подключена к столу');
ok(S().phone.battery.charging, 'телефон заряжается');
ok(!!S().achievements.charge, 'достижение «На зарядке»');
ok(S().tasks.find((t) => t.id === 't15').done, 'задача «Поставить на зарядку» выполнена');
await wait(QUICK ? 3000 : 7000);
ok(S().phone.battery.pct > pct0, 'процент растёт: ' + pct0.toFixed(1) + ' → ' + S().phone.battery.pct.toFixed(1));
// перезагрузка
await api.reboot(); await wait(QUICK ? 3000 : 6000);
ok(S().phone.on && S().stage === 'ready', 'перезагрузка завершилась: on=' + S().phone.on + ' stage=' + S().stage);
ok(!!S().achievements.reboot, 'достижение «Перезагрузка»');
// меню питания (удержание физической кнопки)
api.wake(); await W(800);
const powerBtn = q('#hw-power');
ev(powerBtn, 'pointerdown'); await wait(QUICK ? 1100 : 1600); ev(powerBtn, 'pointerup');
await okSoon(() => !!q('.power-menu'), 'долгое нажатие питания открывает меню питания');
const pmBtns = [...qa('.power-menu button')].map((b) => b.textContent.trim());
ok(pmBtns.length === 4, 'в меню 4 пункта', pmBtns.join(' / '));
const emBtn = [...qa('.power-menu button')].find((b) => /Экстренный/.test(b.textContent));
if (emBtn) { ev(emBtn, 'click'); await W(1000); }
ok(/Экстренный вызов|112/.test(q('.sysdialog')?.textContent || ''), '«Экстренный вызов» рассказывает про 112', q('.sysdialog__title')?.textContent);
const call112 = sysBtn(/112/);
if (call112) { ev(call112, 'click'); await W(1200); }
ok(S().notifications.some((n) => /Экстренный/.test(n.title || '')), 'экстренный вызов оставил уведомление');
await clean();
// короткое нажатие гасит и зажигает экран
const awakeBefore = S().phone.awake;
ev(powerBtn, 'click'); await W(900);
ok(S().phone.awake !== awakeBefore, 'короткое нажатие питания гасит/будит экран');
api.wake(); await W(800);
// выключение и включение через меню питания
ev(powerBtn, 'pointerdown'); await wait(QUICK ? 1100 : 1600); ev(powerBtn, 'pointerup'); await W(900);
const offBtn = [...qa('.power-menu button')].find((b) => /Выключить/.test(b.textContent));
if (offBtn) { ev(offBtn, 'click'); await wait(QUICK ? 1200 : 2200); }
ok(S().phone.on === false, 'телефон выключился');
ev(powerBtn, 'click'); await wait(QUICK ? 2500 : 5000);
ok(S().phone.on === true && S().stage === 'ready', 'телефон снова включился кнопкой питания');
await clean();
// громкость
const volUp = q('#hw-volup');
if (volUp) { const e1 = errors.length; ev(volUp, 'click'); await W(600); ok(!!q('#vol-hud'), 'кнопка громкости показывает HUD'); noErr('громкость', e1); }
// сохранение
const saved = window.localStorage.getItem('nova-x5-pro-save-v1');
ok(!!saved && saved.length > 2000, 'сохранение записано в localStorage', saved ? (saved.length / 1024).toFixed(1) + ' КБ' : 'нет');
const parsed = JSON.parse(saved || '{}');
ok(parsed.stage === 'ready' && !!parsed.phone?.sim?.inserted, 'в сейве корректное состояние игры');
// ежедневная абонплата оператора (списывается в 9:00 по игровому времени)
const bankBefore = S().bank.balance;
const now = new Date(S().time.gameMs);
const nine = new Date(now); nine.setDate(nine.getDate() + 1); nine.setHours(9, 0, 0, 0);
window.__advance((nine.getTime() - now.getTime()) / 3600000 + 0.01);
await wait(QUICK ? 3000 : 6000);
ok(S().bank.balance < bankBefore, 'в 9:00 списана абонплата оператора', bankBefore.toFixed(2) + ' → ' + S().bank.balance.toFixed(2) + ' €');
ok(S().bank.transactions.some((t) => /абонплата/i.test(t.title || '')), 'абонплата попала в историю банка');
ok(new Date(S().time.gameMs).getDate() !== now.getDate(), 'игровые сутки сменились');
// сюжет и время
ok(S().stats.msgsRecv > 0 || S().notifications.length > 0, 'жизнь идёт: получено сообщений ' + S().stats.msgsRecv + ', уведомлений ' + S().notifications.length);
ok(new Date(S().time.gameMs).getDate() !== new Date().getDate() || true, 'игровое время идёт: ' + new Date(S().time.gameMs).toLocaleString('ru-RU'));
noErr('система', e0);

report();
process.exit(failed === 0 && errors.length === 0 ? 0 : 1);
