import { getState, save, completeTask, clearSave, WIFI_NETWORKS, WALLPAPERS, ACCENTS, FONTS, RINGTONES, OPERATORS } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, fmtMoney, fmtSize, fmtTime, fmtDur, pad2, clamp, plural, hash, rndInt, uid } from '../util.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';
import { row, switchEl, chev } from '../ui.js';
import { connectWifi, disconnectWifi, forgetWifi, wifiList, dataLeft, hasInternet } from '../net.js';
import { applyBrightness } from '../shade.js';
import { applyTheme } from '../home.js';

let inst = null, page = 'main', searchQ = '';

export function mount(root, a, params) {
  inst = { root, api: a };
  page = params?.page || 'main';
  root.className = 'app settings';
  applyAppTheme();
  render();
  return {
    get light() { return getState().phone.theme === 'light'; },
    onFocus(p) { if (p?.page) { page = p.page; render(); } },
    onBack() {
      if (page !== 'main') { page = 'main'; render(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function applyAppTheme() {
  const light = getState().phone.theme === 'light';
  inst.root.className = 'app settings ' + (light ? 'theme-light' : 'theme-dark');
  inst.root.style.setProperty('--app-bg', light ? '#f2f4f9' : '#0b0f1a');
  inst.root.style.setProperty('--app-ink', light ? '#111827' : '#e8edf7');
}

function render() {
  if (!inst) return;
  applyAppTheme();
  clear(inst.root);
  const S = getState();
  const bar = el('div', { class: 'appbar' });
  if (page !== 'main') {
    const back = el('button', { class: 'iconbtn', onclick: () => { page = 'main'; SFX.back(); render(); } });
    back.innerHTML = ICON.back();
    bar.append(back);
  }
  bar.append(el('h1', {}, el('span', { text: PAGES[page]?.title || 'Настройки' })));
  const searchBtn = el('button', { class: 'iconbtn', onclick: () => { page = 'search'; render(); } });
  searchBtn.innerHTML = ICON.search();
  bar.append(el('div', { class: 'appbar__actions' }, searchBtn));
  inst.root.append(bar);

  const body = el('div', { class: 'appbody' });
  inst.root.append(body);
  PAGES[page].render(body);
}

/* =========================================================
   СТРАНИЦЫ
   ========================================================= */
const PAGES = {
  main: { title: 'Настройки', render: renderMain },
  search: { title: 'Поиск настроек', render: renderSearch },
  network: { title: 'Сеть и интернет', render: renderNetwork },
  wifi: { title: 'Wi-Fi', render: renderWifi },
  sim: { title: 'SIM-карта и тариф', render: renderSim },
  connect: { title: 'Подключение устройств', render: renderConnect },
  display: { title: 'Экран и оформление', render: renderDisplay },
  wallpaper: { title: 'Обои', render: renderWallpaper },
  sound: { title: 'Звук и вибрация', render: renderSound },
  notifs: { title: 'Уведомления', render: renderNotifs },
  battery: { title: 'Батарея', render: renderBattery },
  storage: { title: 'Память', render: renderStorage },
  security: { title: 'Безопасность', render: renderSecurity },
  wellbeing: { title: 'Цифровое благополучие', render: renderWellbeing },
  apps: { title: 'Приложения', render: renderApps },
  about: { title: 'О телефоне', render: renderAbout },
  system: { title: 'Система', render: renderSystem }
};

/* ---------- главная ---------- */
function renderMain(body) {
  const S = getState();
  const p = S.phone;

  body.append(el('div', { class: 'settings__hero', onclick: () => { page = 'about'; render(); } },
    el('div', { class: 'sh-av', text: '🙂' }),
    el('div', {},
      el('b', { text: p.user.name || 'Владелец' }),
      el('span', { text: `${p.about.model} · NovaOS ${p.about.os.split(' ')[1]}` }))
  ));

  // плитка батареи
  const b = p.battery;
  const battCard = el('div', { class: 'batt-card' + (b.pct <= 20 ? ' low' : ''), onclick: () => { page = 'battery'; render(); } });
  battCard.append(
    el('div', { class: 'bc-top' },
      el('div', { class: 'bc-pct', text: `${Math.round(b.pct)}%` }),
      el('div', { class: 'bc-state', text: b.charging ? '⚡ зарядка' : b.pct > 80 ? 'почти полный' : b.pct > 40 ? 'нормально' : b.pct > 15 ? 'садится' : 'критично' })),
    el('div', { class: 'bc-eta', text: b.charging ? `до 100% ≈ ${Math.ceil((100 - b.pct) / 0.6)} мин` : `осталось ≈ ${Math.floor(b.pct / 3.2)} ч ${Math.round((b.pct / 3.2 % 1) * 60)} мин` })
  );
  body.append(battCard);

  const tiles = el('div', { class: 'set-tile' });
  const tile = (icon, title, sub, pg) => tiles.append(el('div', { class: 'st', onclick: () => { page = pg; SFX.tap(); render(); } },
    el('div', { style: { fontSize: '19px', marginBottom: '5px' }, text: icon }),
    el('b', { text: title }), el('span', { text: sub })));
  tile('📶', 'Сеть', p.wifi.ssid ? p.wifi.ssid : (p.sim.operator ? OPERATORS[p.sim.operator].name : 'нет SIM'), 'network');
  tile('🔗', 'Устройства', p.bt.on ? (p.bt.connected ? 'подключено' : 'Bluetooth вкл') : 'выключено', 'connect');
  tile('🎨', 'Экран', p.theme === 'dark' ? 'тёмная тема' : 'светлая тема', 'display');
  tile('🔔', 'Уведомления', `${S.notifications.length} активных`, 'notifs');

  body.append(tiles);

  const groups = [
    ['Сеть и интернет', '🌐', `${p.wifi.ssid ? 'Wi-Fi: ' + p.wifi.ssid : 'Wi-Fi выкл'} · ${p.data.on ? 'мобильные данные вкл' : 'данные выкл'}`, 'network'],
    ['Подключение устройств', '🔗', p.bt.on ? 'Bluetooth включён' : 'Bluetooth выключен', 'connect'],
    ['Приложения и уведомления', '📲', `${15 + S.store.installed.length} приложений`, 'apps'],
    ['Батарея', '🔋', `${Math.round(b.pct)}% · ${b.charging ? 'зарядка' : 'не заряжается'}`, 'battery'],
    ['Память', '💾', `занято ${usedGb().toFixed(1)} ГБ из ${p.storage.total} ГБ`, 'storage'],
    ['Звук и вибрация', '🔊', `звонок ${p.volume.ring}% · медиа ${p.volume.media}%`, 'sound'],
    ['Экран и оформление', '🎨', `яркость ${p.brightness}% · ${p.theme === 'dark' ? 'тёмная' : 'светлая'} тема`, 'display'],
    ['Обои', '🖼️', 'домашний экран и блокировка', 'wallpaper'],
    ['Безопасность', '🔐', (p.user.hasPin ? 'PIN установлен' : 'без блокировки') + (p.user.fp ? ' + отпечаток' : ''), 'security'],
    ['Цифровое благополучие', '🧘', `экран включался ${S.stats.screenOns} раз`, 'wellbeing'],
    ['Система', '⚙️', 'язык, обновление, сброс', 'system'],
    ['О телефоне', 'ℹ️', `${p.about.model} · ${p.about.build}`, 'about']
  ];
  const list = el('div', { class: 'list', style: { marginTop: '6px' } });
  groups.forEach(([t, i, s, pg]) => {
    list.append(row({ icon: i, iconBg: 'rgba(255,255,255,.09)', title: t, sub: s, right: chev(), onClick: () => { page = pg; SFX.tap(); render(); } }));
  });
  body.append(list);

  body.append(el('div', { style: { padding: '18px 16px 26px', fontSize: '11.5px', opacity: '.45', textAlign: 'center' }, text: `NovaOS ${p.about.os.split(' ')[1]} · сборка ${p.about.build} · аптайм ${fmtDur(p.uptimeSec)}` }));
}

function usedGb() {
  const S = getState();
  const st = S.phone.storage;
  return st.apps + st.system + st.media + st.photos + S.photos.reduce((a, p) => a + p.sizeMb, 0) / 1024;
}

/* ---------- поиск ---------- */
const SEARCHABLE = [
  ['Wi-Fi', 'wifi', 'вайфай сеть интернет пароль'],
  ['Мобильные данные', 'network', 'интернет трафик сим'],
  ['SIM-карта и тариф', 'sim', 'оператор номер imei тариф'],
  ['Bluetooth', 'connect', 'наушники устройства'],
  ['Яркость', 'display', 'экран светлость'],
  ['Тёмная тема', 'display', 'ночной режим оформление'],
  ['Обои', 'wallpaper', 'фон картинка заставка'],
  ['Размер шрифта', 'display', 'текст крупный'],
  ['Громкость звонка', 'sound', 'звонок мелодия'],
  ['Рингтон', 'sound', 'мелодия вызова'],
  ['Вибрация', 'sound', 'вибро'],
  ['Уведомления', 'notifs', 'баннер всплывающие'],
  ['Батарея', 'battery', 'заряд экономия'],
  ['Память', 'storage', 'хранилище гигабайты очистить'],
  ['PIN-код', 'security', 'пароль блокировка'],
  ['Отпечаток пальца', 'security', 'биометрия сканер'],
  ['Цифровое благополучие', 'wellbeing', 'время экран родительский контроль'],
  ['Приложения', 'apps', 'установленные'],
  ['Язык', 'system', 'русский english'],
  ['Сброс настроек', 'system', 'заводские удалить всё'],
  ['О телефоне', 'about', 'imei версия модель'],
  ['Режим полёта', 'network', 'самолёт авиа'],
  ['Фонарик', 'display', 'свет'],
  ['Точка доступа', 'network', 'хотспот раздать']
];
function renderSearch(body) {
  const input = el('input', { class: 'sysdialog__input', placeholder: 'Поиск по настройкам…', style: { margin: '6px 14px 12px', width: 'calc(100% - 28px)' } });
  const res = el('div', { class: 'list' });
  const upd = () => {
    const q = input.value.trim().toLowerCase();
    clear(res);
    const found = SEARCHABLE.filter(([t, , k]) => !q || t.toLowerCase().includes(q) || k.includes(q));
    found.forEach(([title, pg, k]) => {
      res.append(row({ icon: '🔎', iconBg: 'rgba(56,189,248,.16)', title, sub: pg, right: chev(), onClick: () => { page = pg; SFX.tap(); render(); } }));
    });
    if (!found.length) res.append(el('div', { class: 'empty', text: 'Ничего не найдено' }));
  };
  input.addEventListener('input', upd);
  body.append(input, res);
  upd();
  setTimeout(() => input.focus(), 60);
}

/* ---------- сеть ---------- */
function renderNetwork(body) {
  const S = getState();
  const p = S.phone;

  body.append(el('div', { class: 'batt-card', style: { background: hasInternet().ok ? 'linear-gradient(135deg,rgba(74,222,128,.16),rgba(56,189,248,.1))' : 'linear-gradient(135deg,rgba(251,191,36,.16),rgba(239,68,68,.1))' } },
    el('div', { class: 'bc-top' },
      el('div', { class: 'bc-pct', style: { fontSize: '20px' }, text: hasInternet().ok ? '✅ Интернет есть' : '⚠️ Нет интернета' }),
      el('div', { class: 'bc-state', text: hasInternet().ok ? (hasInternet().kind === 'wifi' ? 'через Wi-Fi' : 'через мобильную сеть') : hasInternet().why })
  )));

  const list = el('div', { class: 'list' });
  list.append(row({
    icon: '✈️', iconBg: 'rgba(148,163,184,.2)', title: 'Режим полёта', sub: 'Отключает все беспроводные сети',
    right: switchEl(p.airplane, (v) => {
      p.airplane = v;
      if (v) { p.wifi.on = false; p.wifi.ssid = null; p.bt.on = false; p.data.on = false; unlock('airplane'); }
      else if (p.sim.inserted) p.data.on = true;
      save(); emit(EV.NET); emit(EV.SETTINGS); render();
      toast('✈️', v ? 'Режим полёта включён' : 'Режим полёта выключен', v ? 'Сеть, Wi-Fi и Bluetooth отключены' : 'Сеть восстановлена');
    })
  }));
  list.append(row({
    icon: '📶', iconBg: 'rgba(56,189,248,.2)', title: 'Wi-Fi', sub: p.wifi.on ? (p.wifi.ssid ? `подключено к ${p.wifi.ssid}` : 'включён, сеть не выбрана') : 'выключен',
    right: chev(), onClick: () => { page = 'wifi'; SFX.tap(); render(); }
  }));
  list.append(row({
    icon: '📡', iconBg: 'rgba(74,222,128,.2)', title: 'Мобильные данные',
    sub: p.sim.inserted ? (p.data.on ? `включены · ${OPERATORS[p.sim.operator]?.name}` : 'выключены') : 'нет SIM-карты',
    right: switchEl(p.data.on && p.sim.inserted, (v) => {
      if (!p.sim.inserted) { SFX.error(); toast('📵', 'Нет SIM-карты', 'Установите SIM: скрепка → лоток → SIM → задвинуть'); return; }
      p.data.on = v; save(); emit(EV.NET); render();
      toast('📡', v ? 'Мобильный интернет включён' : 'Мобильный интернет выключен', v ? `${OPERATORS[p.sim.operator].name} · 5G` : '');
    })
  }));
  list.append(row({
    icon: '🔥', iconBg: 'rgba(251,146,60,.2)', title: 'Точка доступа', sub: p.hotspot ? 'NOVA-X5-Pro · раздача включена' : 'выключена',
    right: switchEl(p.hotspot, (v) => {
      if (!p.data.on) { SFX.error(); toast('🔥', 'Нужен мобильный интернет', 'Сначала включите передачу данных'); return; }
      p.hotspot = v; save(); render();
      toast('🔥', v ? 'Точка доступа включена' : 'Точка доступа выключена', v ? 'SSID: NOVA-X5-Pro · пароль: 12345678' : '');
    })
  }));
  body.append(list);

  const dl = dataLeft();
  if (dl && !dl.infinite) {
    body.append(el('div', { class: 'sect-title', text: 'Расход трафика' }));
    body.append(el('div', { class: 'batt-card' },
      el('div', { style: { fontSize: '13px', marginBottom: '8px' }, text: `${dl.used.toFixed(2)} ГБ из ${dl.limit} ГБ` }),
      el('div', { class: 'usage-bar' },
        el('i', { style: { width: clamp(dl.used / dl.limit * 100, 0, 100) + '%', background: '#38bdf8' } }),
        el('i', { style: { flex: '1', background: 'rgba(255,255,255,.08)' } })),
      el('div', { class: 'usage-legend' }, el('span', {}, el('i', { style: { background: '#38bdf8' } }), `осталось ${dl.left.toFixed(1)} ГБ`))
    ));
  }

  body.append(el('div', { class: 'sect-title', text: 'SIM' }));
  const l2 = el('div', { class: 'list' });
  l2.append(row({ icon: '💳', iconBg: 'rgba(34,211,238,.2)', title: p.sim.operator ? OPERATORS[p.sim.operator].name : 'SIM не установлена', sub: p.sim.number || 'установите SIM-карту', right: chev(), onClick: () => { page = 'sim'; render(); } }));
  body.append(l2);
}

/* ---------- Wi-Fi ---------- */
function renderWifi(body) {
  const S = getState();
  const p = S.phone;

  body.append(row({
    icon: '📶', iconBg: 'rgba(56,189,248,.2)', title: 'Wi-Fi', sub: p.wifi.on ? 'сканирование…' : 'выключен',
    right: switchEl(p.wifi.on, (v) => { p.wifi.on = v; if (!v) p.wifi.ssid = null; save(); emit(EV.NET); render(); })
  }));

  if (!p.wifi.on) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '📴' }), 'Wi-Fi выключен', el('br'), el('span', { style: { fontSize: '12px' }, text: 'Включите переключатель выше или плитку в шторке' })));
    return;
  }
  if (p.airplane) body.append(el('div', { class: 'no-signal-banner', text: '✈️ Режим полёта блокирует Wi-Fi' }));

  if (p.wifi.ssid) {
    body.append(el('div', { class: 'sect-title', text: 'Текущая сеть' }));
    const net = WIFI_NETWORKS.find((n) => n.ssid === p.wifi.ssid);
    const card = el('div', { class: 'batt-card' });
    card.append(
      el('div', { style: { fontSize: '15px', fontWeight: '700' }, text: p.wifi.ssid }),
      el('div', { style: { fontSize: '12px', opacity: '.7', marginTop: '4px' }, text: `Подключено · ${net?.freq || '5 ГГц'} · сигнал ${'█'.repeat(net?.signal || 3)} · IP 192.168.1.${rnd(20, 200)} · скорость до ${net?.ssid.includes('5G') ? 480 : 96} Мбит/с` }),
      el('div', { style: { display: 'flex', gap: '8px', marginTop: '12px' } },
        el('button', { class: 'btn btn--ghost', style: { flex: '1', padding: '8px' }, text: 'Отключиться', onclick: () => { disconnectWifi(); render(); } }),
        el('button', { class: 'btn btn--ghost', style: { flex: '1', padding: '8px' }, text: 'Забыть сеть', onclick: async () => { if (await sysConfirm('Забыть сеть?', `${p.wifi.ssid} будет удалена из сохранённых.`, 'Забыть', true)) { forgetWifi(p.wifi.ssid); render(); } } }))
    );
    body.append(card);
  }

  body.append(el('div', { class: 'sect-title', text: 'Доступные сети' }));
  const list = el('div', { class: 'list' });
  wifiList().forEach((n) => {
    const connected = p.wifi.ssid === n.ssid;
    list.append(row({
      icon: '📶', iconBg: connected ? 'rgba(74,222,128,.2)' : 'rgba(255,255,255,.08)',
      title: n.ssid + (n.secured ? ' 🔒' : ''),
      sub: `${n.freq} · сигнал ${'█'.repeat(n.signal)}${'░'.repeat(4 - n.signal)} · ${connected ? 'подключено' : (S.phone.wifi.remembered.some(r => r.ssid === n.ssid) ? 'сохранена' : 'не подключено')}`,
      right: connected ? el('span', { style: { fontSize: '12px', color: '#4ade80' }, text: '✓' }) : chev(),
      onClick: () => connectWifi(n).then(() => render())
    }));
  });
  body.append(list);

  body.append(el('div', { class: 'sect-title', text: 'Дополнительно' }));
  const adv = el('div', { class: 'list' });
  adv.append(row({ icon: '🔄', title: 'Сканировать заново', sub: 'Обновить список сетей', right: chev(), onClick: () => { SFX.tap(); toast('📶', 'Поиск сетей…', 'Найдено ' + WIFI_NETWORKS.length + ' сетей'); render(); } }));
  adv.append(row({ icon: '🌐', title: 'Автоподключение', sub: 'Подключаться к сохранённым сетям', right: switchEl(true, () => toast('🌐', 'Автоподключение', 'Работает всегда — в этой игре только одна домашняя сеть')) }));
  adv.append(row({ icon: '🔗', title: 'Добавить сеть вручную', sub: 'SSID и тип шифрования', right: chev(), onClick: () => manualWifi() }));
  body.append(adv);

  function rnd(a, b) { return Math.floor(a + Math.random() * (b - a)); }
}

async function manualWifi() {
  const res = await sysDialog({
    title: 'Добавить сеть', icon: '📶',
    text: 'Введите SSID (название сети)',
    input: { placeholder: 'MyNetwork' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Добавить', value: true, cls: 'primary' }]
  });
  if (!res) return;
  toast('📶', 'Сеть добавлена', `${res} · но она не существует в этом мире`);
}

/* ---------- SIM ---------- */
function renderSim(body) {
  const S = getState();
  const p = S.phone;
  const op = p.sim.operator ? OPERATORS[p.sim.operator] : null;

  if (!op) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '📵' }),
      'SIM-карта не установлена', el('br'),
      el('span', { style: { fontSize: '12px', lineHeight: '1.7' }, text: 'Возьмите скрепку со стола → нажмите в отверстие на правой грани → положите SIM в лоток → задвиньте лоток → выберите тариф' })));
    return;
  }
  body.append(el('div', { class: 'bank__card', style: { margin: '10px 14px', background: `linear-gradient(135deg, ${op.color}, #0f172a)` } },
    el('div', { class: 'bc-bank', text: op.name }),
    el('div', { class: 'bc-sum', style: { fontSize: '23px' }, text: p.sim.number }),
    el('div', { class: 'bc-num', text: `Тариф «${op.tariff}» · ${op.price.toFixed(2)} €/день` })
  ));

  const dl = dataLeft();
  const list = el('div', { class: 'list' });
  list.append(row({ icon: '📊', iconBg: 'rgba(56,189,248,.18)', title: 'Остатки по пакету', sub: dl?.infinite ? 'Интернет: безлимит' : `Интернет: ${dl?.left.toFixed(1)} ГБ из ${dl?.limit} ГБ`, right: chev(), onClick: () => ussd('*100#') }));
  list.append(row({ icon: '⏱️', iconBg: 'rgba(74,222,128,.18)', title: 'Минуты', sub: `использовано ${p.data.minutesUsed || 0} из ${op.minutes}`, right: null }));
  list.append(row({ icon: '💬', iconBg: 'rgba(250,204,21,.18)', title: 'SMS', sub: `в пакете ${op.sms} сообщений`, right: null }));
  list.append(row({ icon: '🌍', iconBg: 'rgba(167,139,250,.18)', title: 'Роуминг', sub: p.data.roaming ? 'включён · 5 €/день' : 'выключен (вы в Брюсселе)', right: switchEl(!!p.data.roaming, (v) => { p.data.roaming = v; save(); render(); toast('🌍', v ? 'Роуминг включён' : 'Роуминг выключен', v ? 'Списывается 5 € в день' : ''); }) }));
  list.append(row({ icon: '📞', iconBg: 'rgba(34,197,94,.18)', title: 'Определитель номера', sub: 'показывать свой номер', right: switchEl(p.showNumber !== false, (v) => { p.showNumber = v; save(); toast('📞', v ? 'Номер виден' : 'Номер скрыт', v ? '' : 'Абоненты увидят «Неизвестный»'); }) }));
  list.append(row({ icon: '🔢', iconBg: 'rgba(255,255,255,.08)', title: 'USSD-команды', sub: '*100# баланс · *111# услуги', right: chev(), onClick: () => ussdMenu() }));
  body.append(list);

  body.append(el('div', { class: 'sect-title', text: 'Технические данные' }));
  const t = el('div', { class: 'list' });
  t.append(row({ icon: '🆔', title: 'ICCID', sub: p.sim.iccid }));
  t.append(row({ icon: '📟', title: 'IMEI', sub: p.sim.imei }));
  t.append(row({ icon: '📡', title: 'Тип сети', sub: '5G / LTE / UMTS (авто)', right: chev(), onClick: () => netTypeMenu() }));
  t.append(row({ icon: '📶', title: 'Уровень сигнала', sub: `${p.sim.signal} из 4 · ${p.signalDbm || -85} дБм` }));
  body.append(t);
}

async function ussdMenu() {
  const res = await sysDialog({
    title: 'USSD-команды', icon: '🔢',
    text: 'Выберите команду',
    buttons: [
      { label: '*100# баланс', value: '*100#' },
      { label: '*111# услуги', value: '*111#' },
      { label: '#31# скрыть номер', value: '#31#' },
      { label: 'Отмена', value: null }
    ]
  });
  if (res) ussd(res);
}

async function ussd(code) {
  const S = getState();
  const op = OPERATORS[S.phone.sim.operator];
  if (!op) return;
  await sysDialog({
    title: `${op.name}: ответ сети`, icon: '📟',
    text: op.ussd
      .replace('{bal}', S.bank.balance.toFixed(2))
      .replace('{min}', String(Math.max(0, (op.minutes || 0) - (S.phone.data.minutesUsed || 0))))
      .replace('{sms}', String(op.sms || 0))
      .replace('{gb}', String(Math.max(0, (S.phone.data.limitGb - S.phone.data.usedGb)).toFixed(1)))
      .replace(/\n/g, '<br/>')
  });
}

async function netTypeMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Тип сети', icon: '📡',
    text: 'Текущий: 5G/LTE (автоматически)',
    buttons: [
      { label: '5G (быстро, ест батарею)', value: '5g' },
      { label: 'LTE (оптимально)', value: 'lte' },
      { label: '3G (экономия)', value: '3g' },
      { label: 'Отмена', value: null }
    ]
  });
  if (!res) return;
  S.phone.sim.netType = res;
  S.phone.sim.signal = res === '5g' ? 4 : res === 'lte' ? 3 : 2;
  save(); emit(EV.NET); render();
  toast('📡', 'Тип сети изменён', res.toUpperCase() + (res === '5g' ? ' · батарея садится быстрее' : res === '3g' ? ' · интернет медленный' : ''));
}

/* ---------- подключения ---------- */
function renderConnect(body) {
  const S = getState();
  const p = S.phone;
  body.append(row({
    icon: '🔵', iconBg: 'rgba(59,130,246,.2)', title: 'Bluetooth', sub: p.bt.on ? (p.bt.connected ? 'подключено: ' + p.bt.connected : 'поиск устройств…') : 'выключен',
    right: switchEl(p.bt.on, (v) => { p.bt.on = v; if (!v) p.bt.connected = null; save(); render(); })
  }));
  if (!p.bt.on) { body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🔵' }), 'Bluetooth выключен')); return; }

  body.append(el('div', { class: 'sect-title', text: 'Доступные устройства' }));
  const list = el('div', { class: 'list' });
  p.bt.devices.forEach((d) => {
    const conn = p.bt.connected === d.name;
    list.append(row({
      icon: d.icon, iconBg: conn ? 'rgba(74,222,128,.2)' : 'rgba(255,255,255,.08)',
      title: d.name + (d.id === 'bh1' && !d.owned ? ' (в магазине)' : ''),
      sub: `${d.type}${d.battery ? ' · ' + d.battery + '%' : ''} · ${conn ? 'подключено' : d.paired ? 'сопряжено' : 'не сопряжено'}`,
      right: conn ? el('span', { style: { color: '#4ade80', fontSize: '12px' }, text: '✓' }) : chev(),
      onClick: () => pairDevice(d)
    }));
  });
  body.append(list);

  const extra = el('div', { class: 'list', style: { marginTop: '10px' } });
  extra.append(row({ icon: '📲', iconBg: 'rgba(255,255,255,.08)', title: 'NFC', sub: 'бесконтактная оплата', right: switchEl(p.nfc !== false, (v) => { p.nfc = v; save(); toast('📲', v ? 'NFC включён' : 'NFC выключен', v ? 'Можно платить телефоном (в игре негде)' : ''); }) }));
  extra.append(row({ icon: '🖨️', iconBg: 'rgba(255,255,255,.08)', title: 'Печать', sub: 'принтеры не найдены', right: chev(), onClick: () => toast('🖨️', 'Поиск принтеров…', 'Ничего не найдено. Как всегда.') }));
  extra.append(row({ icon: '📤', iconBg: 'rgba(255,255,255,.08)', title: 'Передать файл', sub: 'Android Beam (не работает с 2019)', right: chev(), onClick: () => toast('📤', 'Android Beam', 'Функцию выпилили, а настройку оставили. Классика.') }));
  body.append(extra);
}

async function pairDevice(d) {
  const S = getState();
  const p = S.phone;
  if (d.id === 'bh1' && !d.owned) {
    toast('🎧', 'Наушники не куплены', 'Nova Buds Air продаются в TechShop за 49,90 € — откройте браузер → techshop.online');
    api.openApp('browser', { url: 'techshop.online/item/buds' });
    return;
  }
  if (p.bt.connected === d.name) {
    p.bt.connected = null; save(); render();
    toast('🔵', 'Отключено', d.name);
    return;
  }
  await sysDialog({ title: 'Сопряжение', icon: d.icon, text: `Поиск устройства «${d.name}»…<br/><br/>Код подтверждения: <b>${rndInt(100000, 999999)}</b>`, buttons: [{ label: 'Отмена', value: false }, { label: 'Сопрячь', value: true, cls: 'primary' }] }).then((ok) => {
    if (!ok) return;
    d.paired = true;
    p.bt.connected = d.name;
    save(); render();
    SFX.notif();
    toast('🔵', 'Подключено', `${d.name} · ${d.type}${d.battery ? ' · заряд ' + d.battery + '%' : ''}`);
    if (d.id === 'bh1') {
      notify({ appId: 'music', icon: '🎧', color: '#a78bfa', title: 'Наушники подключены', text: 'Nova Buds Air · музыка будет играть в наушниках', action: { type: 'app', id: 'music' } });
    }
  });
}

/* ---------- экран ---------- */
function renderDisplay(body) {
  const S = getState();
  const p = S.phone;

  body.append(el('div', { class: 'sect-title', text: 'Яркость' }));
  const br = el('div', { style: { padding: '0 16px 6px', display: 'flex', alignItems: 'center', gap: '12px' } });
  const sunSmall = el('span', { html: ICON.brightness(), style: { display: 'flex', opacity: '.6' } });
  const slider = el('input', { class: 'slider', type: 'range', min: '5', max: '100', value: String(p.brightness) });
  slider.addEventListener('input', () => { p.brightness = +slider.value; p.autoBrightness = false; applyBrightness(); save(); pct.textContent = p.brightness + '%'; });
  const pct = el('span', { style: { fontSize: '12px', opacity: '.7', minWidth: '34px' }, text: p.brightness + '%' });
  br.append(sunSmall, slider, pct);
  body.append(br);
  body.append(row({ icon: '🌗', title: 'Автояркость', sub: 'подстраиваться под освещение', right: switchEl(p.autoBrightness, (v) => { p.autoBrightness = v; save(); applyBrightness(); render(); }) }));

  body.append(el('div', { class: 'sect-title', text: 'Тема оформления' }));
  const themeRow = el('div', { style: { display: 'flex', gap: '10px', padding: '4px 16px 12px' } });
  [['dark', '🌙 Тёмная'], ['light', '☀️ Светлая']].forEach(([id, label]) => {
    themeRow.append(el('button', {
      class: 'chip' + (p.theme === id ? ' on' : ''), style: { flex: '1', justifyContent: 'center', padding: '11px' }, text: label,
      onclick: () => { p.theme = id; save(); if (id === 'dark') unlock('dark'); emit(EV.THEME, id); applyBrightness(); render(); applyTheme(); SFX.tap(); }
    }));
  });
  body.append(themeRow);

  body.append(el('div', { class: 'sect-title', text: 'Цвет акцента' }));
  const colors = el('div', { class: 'color-row' });
  ACCENTS.forEach((a) => {
    colors.append(el('div', {
      class: 'color-dot' + (p.accent === a.id ? ' sel' : ''), style: { background: a.hex }, title: a.name,
      onclick: () => { p.accent = a.id; save(); applyTheme(); render(); emit(EV.THEME); SFX.tap(); }
    }));
  });
  body.append(colors);

  body.append(el('div', { class: 'sect-title', text: 'Размер шрифта' }));
  const fonts = el('div', { style: { display: 'flex', gap: '8px', padding: '0 16px 10px' } });
  FONTS.forEach((f) => fonts.append(el('button', {
    class: 'chip' + (p.fontScale === f.id ? ' on' : ''), style: { flex: '1', justifyContent: 'center', fontSize: (11 * f.scale) + 'px' }, text: f.name,
    onclick: () => { p.fontScale = f.id; save(); applyTheme(); render(); }
  })));
  body.append(fonts);
  body.append(el('div', { class: 'font-preview', text: 'Так выглядит текст в интерфейсе. Сообщения, меню и уведомления станут крупнее или мельче.' }));

  body.append(el('div', { class: 'sect-title', text: 'Прочее' }));
  const list = el('div', { class: 'list' });
  list.append(row({ icon: '🖼️', iconBg: 'rgba(167,139,250,.2)', title: 'Обои', sub: 'домашний экран и блокировка', right: chev(), onClick: () => { page = 'wallpaper'; render(); } }));
  list.append(row({ icon: '⏳', iconBg: 'rgba(56,189,248,.2)', title: 'Автоблокировка экрана', sub: `${p.screenTimeout ?? 90} сек бездействия`, right: chev(), onClick: () => timeoutMenu() }));
  list.append(row({ icon: '📱', iconBg: 'rgba(74,222,128,.2)', title: 'Частота обновления', sub: `${p.about.refresh} Гц`, right: chev(), onClick: () => refreshMenu() }));
  list.append(row({ icon: '🌙', iconBg: 'rgba(251,191,36,.2)', title: 'Ночной свет', sub: p.nightLight ? 'включён — экран теплее' : 'выключен', right: switchEl(!!p.nightLight, (v) => { p.nightLight = v; save(); applyNightLight(); toast('🌙', v ? 'Ночной свет включён' : 'Ночной свет выключен', v ? 'Меньше синего — легче заснуть' : ''); }) }));
  list.append(row({ icon: '🔍', iconBg: 'rgba(255,255,255,.08)', title: 'Показывать процент заряда', sub: 'в статус-баре', right: switchEl(p.showPercent !== false, (v) => { p.showPercent = v; save(); emit(EV.SETTINGS); }) }));
  list.append(row({ icon: '📐', iconBg: 'rgba(255,255,255,.08)', title: 'Размер экрана', sub: 'DPI 440 · плотность 2.75', right: chev(), onClick: () => toast('📐', 'Размер экрана', 'Менять некуда: телефон один и тот же') }));
  body.append(list);
}

function applyNightLight() {
  const S = getState();
  const veil = document.getElementById('brightness-veil');
  if (!veil) return;
  veil.style.background = S.phone.nightLight ? 'rgba(255,140,0,.16)' : '#000';
  applyBrightness();
}

async function timeoutMenu() {
  const S = getState();
  const opts = [15, 30, 60, 90, 300, 1800];
  const res = await sysDialog({
    title: 'Автоблокировка', icon: '⏳',
    text: 'Через сколько секунд гасить экран',
    buttons: opts.slice(0, 3).map((o) => ({ label: `${o} сек`, value: o })).concat([{ label: 'Ещё…', value: 'more' }, { label: 'Отмена', value: null }])
  });
  let v = res;
  if (res === 'more') {
    v = await sysDialog({ title: 'Автоблокировка', icon: '⏳', text: 'Долгие значения', buttons: opts.slice(3).map((o) => ({ label: o >= 60 ? `${Math.floor(o / 60)} мин` : `${o} сек`, value: o })).concat([{ label: 'Отмена', value: null }]) });
  }
  if (!v) return;
  S.phone.screenTimeout = v;
  save(); render();
  toast('⏳', 'Автоблокировка', v >= 60 ? `${Math.floor(v / 60)} мин` : `${v} сек`);
}

async function refreshMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Частота обновления', icon: '📱',
    text: 'Выше — плавнее, но ест батарею',
    buttons: [{ label: '120 Гц — плавно', value: 120 }, { label: '90 Гц — баланс', value: 90 }, { label: '60 Гц — экономия', value: 60 }, { label: 'Отмена', value: null }]
  });
  if (!res) return;
  S.phone.about.refresh = res;
  save(); render();
  toast('📱', `${res} Гц`, res === 120 ? 'Максимальная плавность. Батарея грустит.' : res === 60 ? 'Экономия заряда включена' : 'Золотая середина');
}

/* ---------- обои ---------- */
function renderWallpaper(body) {
  const S = getState();
  const p = S.phone;
  [['wallpaper', 'Домашний экран'], ['lockWallpaper', 'Экран блокировки']].forEach(([key, label]) => {
    body.append(el('div', { class: 'sect-title', text: label }));
    const grid = el('div', { class: 'wall-grid' });
    WALLPAPERS.forEach((w) => {
      grid.append(el('div', {
        class: 'wall-item' + (p[key] === w.id ? ' sel' : ''), style: { background: w.css }, title: w.name,
        onclick: () => {
          p[key] = w.id; save(); emit(EV.THEME); api.refreshHome(); render();
          SFX.tap(); unlock('wall');
          toast('🖼️', 'Обои изменены', `${w.name} · ${label.toLowerCase()}`);
        }
      }));
    });
    // своё фото из галереи
    if (S.photos.length) {
      const last = S.photos[S.photos.length - 1];
      grid.append(el('div', {
        class: 'wall-item' + (String(p[key]).startsWith('custom') ? ' sel' : ''),
        style: { background: '#1e293b', display: 'grid', placeItems: 'center', overflow: 'hidden' },
        title: 'Моё фото',
        onclick: () => pickPhotoWall(key, label)
      }, el('span', { style: { fontSize: '11px', textAlign: 'center', opacity: '.8' }, text: '📷\nиз галереи' })));
    }
    body.append(grid);
  });
}

async function pickPhotoWall(key, label) {
  const S = getState();
  const list = S.photos.slice(-6).reverse();
  const res = await sysDialog({
    title: 'Выберите фото', icon: '📷',
    text: list.map((p, i) => `${i + 1}. ${p.sceneName} · ${fmtTime(new Date(p.at))}`).join('<br/>'),
    input: { placeholder: 'Номер фото' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Поставить', value: true, cls: 'primary' }]
  });
  if (res === null || res === false) return;
  const n = parseInt(String(res), 10);
  const p = list[isNaN(n) ? 0 : clamp(n - 1, 0, list.length - 1)];
  if (!p) return;
  S.flags.customWall = S.flags.customWall || {};
  S.flags.customWall[key === 'wallpaper' ? 'home' : 'lock'] = `url("data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}") center/cover no-repeat`;
  S.phone[key] = 'custom:' + p.id;
  save(); emit(EV.THEME); api.refreshHome(); render();
  unlock('wall');
  toast('🖼️', 'Обои из фото', `${label}: ${p.sceneName}`);
}

/* ---------- звук ---------- */
function renderSound(body) {
  const S = getState();
  const p = S.phone;
  const vol = (label, key, icon) => {
    const wrap = el('div', { style: { padding: '10px 16px' } });
    const head = el('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '7px' } },
      el('span', { text: `${icon} ${label}` }), el('span', { style: { opacity: '.6', fontVariantNumeric: 'tabular-nums' }, text: p.volume[key] + '%' }));
    const sl = el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(p.volume[key]) });
    sl.addEventListener('input', () => {
      p.volume[key] = +sl.value;
      head.lastChild.textContent = p.volume[key] + '%';
      save();
    });
    sl.addEventListener('change', () => { SFX.notif(); });
    wrap.append(head, sl);
    return wrap;
  };
  body.append(vol('Медиа', 'media', '🎵'));
  body.append(vol('Звонок', 'ring', '📞'));
  body.append(vol('Уведомления', 'notif', '🔔'));
  body.append(vol('Будильник', 'alarm', '⏰'));

  const list = el('div', { class: 'list', style: { marginTop: '8px' } });
  list.append(row({ icon: '🎼', iconBg: 'rgba(251,146,60,.2)', title: 'Рингтон', sub: RINGTONES.find((r) => r.id === (p.ringtone || 'nova'))?.name, right: chev(), onClick: () => ringtoneMenu() }));
  list.append(row({ icon: '📳', iconBg: 'rgba(255,255,255,.08)', title: 'Вибрация', sub: p.vibrate ? 'включена' : 'выключена', right: switchEl(p.vibrate, (v) => { p.vibrate = v; save(); if (v) window.__vibrate?.(30); }) }));
  list.append(row({ icon: '⌨️', iconBg: 'rgba(255,255,255,.08)', title: 'Звук касания', sub: 'щелчки при нажатии', right: switchEl(p.touchSound !== false, (v) => { p.touchSound = v; save(); if (v) SFX.tap(); }) }));
  list.append(row({ icon: '🔊', iconBg: 'rgba(255,255,255,.08)', title: 'Проверить динамик', sub: 'короткий тест', right: chev(), onClick: () => { SFX.notif(); toast('🔊', 'Тест динамика', 'Если вы услышали звук — динамик работает'); } }));
  list.append(row({ icon: '🎧', iconBg: 'rgba(167,139,250,.2)', title: 'Наушники', sub: p.bt.connected ? 'подключены: ' + p.bt.connected : 'не подключены', right: chev(), onClick: () => { page = 'connect'; render(); } }));
  body.append(list);
}

async function ringtoneMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Рингтон', icon: '🎼',
    text: 'Выберите мелодию звонка',
    buttons: RINGTONES.map((r) => ({ label: r.name, value: r.id })).concat([{ label: 'Отмена', value: null }])
  });
  if (!res) return;
  S.phone.ringtone = res;
  save(); render();
  SFX.notif();
  toast('🎼', 'Рингтон изменён', RINGTONES.find((r) => r.id === res).name);
}

/* ---------- уведомления ---------- */
function renderNotifs(body) {
  const S = getState();
  const p = S.phone;
  body.append(row({ icon: '🔔', iconBg: 'rgba(56,189,248,.2)', title: 'Уведомления', sub: p.notifications.allowed ? 'разрешены' : 'запрещены полностью', right: switchEl(p.notifications.allowed !== false, (v) => { p.notifications.allowed = v; save(); toast('🔔', v ? 'Уведомления включены' : 'Уведомления выключены', v ? '' : 'Вы ничего не узнаете. Спокойно.'); }) }));
  body.append(row({ icon: '🌙', iconBg: 'rgba(148,163,184,.2)', title: 'Не беспокоить', sub: p.dnd ? 'включён — всё тихо' : 'выключен', right: switchEl(p.dnd, (v) => { p.dnd = v; save(); emit(EV.SETTINGS); render(); if (v) unlock('dnd'); toast('🌙', v ? 'Режим «не беспокоить»' : 'Уведомления снова приходят', v ? 'Только будильник сможет вас разбудить' : ''); }) }));

  body.append(el('div', { class: 'sect-title', text: 'Приложения' }));
  const apps = [
    ['messages', '💬', 'Сообщения'], ['phone', '📞', 'Телефон'], ['bank', '🏦', 'NovaBank'],
    ['store', '🛍️', 'Nova Store'], ['music', '🎵', 'Музыка'], ['weather', '🌤️', 'Погода'],
    ['browser', '🌐', 'Браузер'], ['system', '⚙️', 'Система']
  ];
  const list = el('div', { class: 'list' });
  apps.forEach(([id, ico, name]) => {
    const cfg = p.appNotifs?.[id] || { allow: true, sound: true, banner: true, badge: true };
    list.append(row({
      icon: ico, iconBg: 'rgba(255,255,255,.08)', title: name,
      sub: cfg.allow ? (cfg.banner ? 'баннеры + звук' : 'тихо, в шторке') : 'запрещено',
      right: switchEl(cfg.allow, (v) => {
        p.appNotifs = p.appNotifs || {};
        p.appNotifs[id] = { ...cfg, allow: v };
        save(); render();
        toast(v ? '🔔' : '🔕', `${name}: уведомления ${v ? 'включены' : 'выключены'}`, '');
      })
    }));
  });
  body.append(list);

  body.append(el('div', { class: 'sect-title', text: 'Сейчас в шторке' }));
  body.append(el('div', { style: { padding: '0 16px 10px', fontSize: '12.5px', opacity: '.7' }, text: `${S.notifications.length} ${plural(S.notifications.length, ['уведомление', 'уведомления', 'уведомлений'])}` }));
  body.append(row({ icon: '🧹', iconBg: 'rgba(239,68,68,.16)', title: 'Очистить все уведомления', sub: 'сразу, без вопросов', right: chev(), onClick: () => { window.__clearNotifs?.(); render(); toast('🧹', 'Уведомления очищены', 'Тишина и покой'); } }));
}

/* ---------- батарея ---------- */
function renderBattery(body) {
  const S = getState();
  const p = S.phone;
  const b = p.battery;
  const C = 2 * Math.PI * 34;

  const ring = el('div', { class: 'batt-ring' + (b.pct <= 20 ? ' low' : '') });
  ring.innerHTML = `<svg width="74" height="74" viewBox="0 0 74 74">
    <circle class="bg" cx="37" cy="37" r="34"/>
    <circle class="fg" cx="37" cy="37" r="34" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - b.pct / 100)}"/>
  </svg>`;
  ring.append(el('b', { text: Math.round(b.pct) + '%' }));
  body.append(ring);
  body.append(el('div', { style: { textAlign: 'center', fontSize: '12.5px', opacity: '.7', paddingBottom: '10px' }, text: b.charging ? `⚡ Зарядка · ${Math.ceil((100 - b.pct) / 0.6)} мин до 100%` : `Осталось ≈ ${Math.floor(b.pct / 3.2)} ч ${Math.round((b.pct / 3.2 % 1) * 60)} мин` }));

  const list = el('div', { class: 'list' });
  list.append(row({ icon: '🔋', iconBg: 'rgba(74,222,128,.2)', title: 'Экономия заряда', sub: p.saver ? 'включена — яркость ниже, фон ограничен' : 'выключена', right: switchEl(!!p.saver, (v) => { p.saver = v; save(); applyBrightness(); render(); emit(EV.SETTINGS); toast('🔋', v ? 'Экономия включена' : 'Экономия выключена', v ? 'Экран тусклее, фоновые данные ограничены' : ''); }) }));
  list.append(row({ icon: '🌡️', iconBg: 'rgba(251,146,60,.2)', title: 'Температура', sub: `${b.temp.toFixed(1)} °C ${b.temp > 36 ? '— горячо!' : '— в норме'}` }));
  list.append(row({ icon: '❤️', iconBg: 'rgba(239,68,68,.16)', title: 'Состояние батареи', sub: `Ёмкость ${b.health}% · циклов: ${b.cycles}` }));
  list.append(row({ icon: '⚡', iconBg: 'rgba(250,204,21,.2)', title: 'Быстрая зарядка 33 Вт', sub: S.world.chargerPlugged ? 'кабель подключён' : 'подключите кабель со стола', right: chev(), onClick: () => toast('⚡', 'Зарядка', S.world.chargerPlugged ? 'Идёт со скоростью ~0.8% в секунду' : 'Кликните по зарядному кабелю на столе') }));
  body.append(list);

  body.append(el('div', { class: 'sect-title', text: 'Расход за сегодня' }));
  const usage = [
    ['Экран', 46, '#38bdf8'], ['Интернет и связь', 18, '#a78bfa'], ['Камера', 12, '#f472b6'],
    ['Игры', 9, '#4ade80'], ['Фоновые процессы', 8, '#facc15'], ['Система', 7, '#94a3b8']
  ];
  body.append(el('div', { style: { padding: '0 16px' } },
    el('div', { class: 'usage-bar' }, usage.map(([n, v, c]) => el('i', { style: { width: v + '%', background: c } }))),
    el('div', { class: 'usage-legend' }, usage.map(([n, v, c]) => el('span', {}, el('i', { style: { background: c } }), `${n} ${v}%`)))
  ));

  body.append(el('div', { class: 'sect-title', text: 'Приложения-прожоры' }));
  const gluttons = el('div', { class: 'list' });
  [['🎥', 'Камера', '24% · экран и обработка фото'], ['🌐', 'Браузер', '19% · интернет и вкладки'], ['🐍', 'Змейка', '12% · рекорды не даются бесплатно'], ['💬', 'Сообщения', '11% · вы много переписываетесь'], ['🎵', 'Музыка', '8% · фоновое воспроизведение']].forEach(([i, t, s]) => {
    gluttons.append(row({ icon: i, iconBg: 'rgba(255,255,255,.08)', title: t, sub: s, right: chev(), onClick: () => toast('🔋', t, 'Ограничить фоновую активность? Приложение обидится.') }));
  });
  body.append(gluttons);
}

/* ---------- память ---------- */
function renderStorage(body) {
  const S = getState();
  const p = S.phone;
  const st = p.storage;
  const photosGb = st.photos + S.photos.reduce((a, x) => a + x.sizeMb, 0) / 1024;
  const used = st.apps + st.system + st.media + photosGb;
  const free = Math.max(0, st.total - used);
  const seg = [['Система', st.system, '#64748b'], ['Приложения', st.apps, '#38bdf8'], ['Фото и видео', photosGb, '#f472b6'], ['Музыка и медиа', st.media, '#a78bfa'], ['Свободно', free, 'rgba(255,255,255,.1)']];

  body.append(el('div', { style: { textAlign: 'center', padding: '14px 16px 6px' } },
    el('div', { style: { fontSize: '27px', fontWeight: '300' }, text: `${used.toFixed(1)} ГБ` }),
    el('div', { style: { fontSize: '12px', opacity: '.6' }, text: `из ${st.total} ГБ · свободно ${free.toFixed(1)} ГБ` })
  ));
  body.append(el('div', { style: { padding: '0 16px' } },
    el('div', { class: 'storage-bar' }, seg.map(([n, v, c]) => el('i', { style: { width: (v / st.total * 100) + '%', background: c } }))),
    el('div', { class: 'usage-legend', style: { marginTop: '10px' } }, seg.map(([n, v, c]) => el('span', {}, el('i', { style: { background: c } }), `${n} ${v.toFixed(1)} ГБ`)))
  ));

  body.append(el('div', { class: 'sect-title', text: 'Категории' }));
  const list = el('div', { class: 'list' });
  list.append(row({ icon: '📷', iconBg: 'rgba(244,114,181,.2)', title: 'Фото и видео', sub: `${S.photos.length} ${plural(S.photos.length, ['файл', 'файла', 'файлов'])} · ${fmtSize(S.photos.reduce((a, x) => a + x.sizeMb, 0) * 1024)}`, right: chev(), onClick: () => api.openApp('gallery') }));
  list.append(row({ icon: '📲', iconBg: 'rgba(56,189,248,.2)', title: 'Приложения', sub: `${15 + S.store.installed.length} установлено`, right: chev(), onClick: () => { page = 'apps'; render(); } }));
  list.append(row({ icon: '🎵', iconBg: 'rgba(167,139,250,.2)', title: 'Музыка', sub: `${S.music.tracks.length} треков · 6 офлайн`, right: chev(), onClick: () => api.openApp('music') }));
  list.append(row({ icon: '📁', iconBg: 'rgba(251,191,36,.2)', title: 'Файлы и загрузки', sub: `${(S.files || []).length} файлов`, right: chev(), onClick: () => api.openApp('files') }));
  list.append(row({ icon: '💬', iconBg: 'rgba(74,222,128,.2)', title: 'Кэш сообщений', sub: fmtSize(Object.values(S.messages.chats).reduce((a, c) => a + c.messages.length * 0.02, 0) * 1024), right: chev(), onClick: async () => {
    if (await sysConfirm('Очистить кэш?', 'Сообщения останутся, но временные файлы удалятся.', 'Очистить')) {
      toast('🧹', 'Кэш очищен', 'Освобождено 42,7 МБ (магия)');
    }
  } }));
  body.append(list);

  body.append(el('div', { style: { padding: '14px 16px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '🧹 Очистить всё лишнее', onclick: async () => {
      if (await sysConfirm('Умная очистка', 'Система удалит временные файлы, дубликаты фото и кэш браузера.', 'Очистить')) {
        p.storage.media = Math.max(0.4, p.storage.media - 0.8);
        save(); render();
        toast('🧹', 'Очищено 812 МБ', 'Телефон дышит свободнее');
      }
    } })
  ));
}

/* ---------- безопасность ---------- */
function renderSecurity(body) {
  const S = getState();
  const p = S.phone;
  body.append(row({ icon: '🔐', iconBg: 'rgba(56,189,248,.2)', title: 'Блокировка экрана', sub: p.user.hasPin ? `PIN-код (${p.user.pin})` : 'нет', right: chev(), onClick: () => pinMenu() }));
  body.append(row({ icon: '👆', iconBg: 'rgba(74,222,128,.2)', title: 'Отпечаток пальца', sub: p.user.fp ? 'зарегистрирован 1 отпечаток' : 'не настроен', right: switchEl(p.user.fp, (v) => { if (v) fpEnroll(); else { p.user.fp = false; save(); render(); toast('👆', 'Отпечаток удалён', 'Теперь только PIN'); } }) }));
  body.append(row({ icon: '🙂', iconBg: 'rgba(167,139,250,.2)', title: 'Фейсконтроль', sub: p.user.face ? 'лицо зарегистрировано' : 'не настроен', right: switchEl(p.user.face, (v) => { if (v) faceEnroll(); else { p.user.face = false; save(); render(); } }) }));

  body.append(el('div', { class: 'sect-title', text: 'Приватность' }));
  const list = el('div', { class: 'list' });
  list.append(row({ icon: '👁️', iconBg: 'rgba(255,255,255,.08)', title: 'Показывать текст уведомлений', sub: p.notifications.preview === 'always' ? 'всегда' : 'только после разблокировки', right: chev(), onClick: async () => {
    const r = await sysDialog({ title: 'Предпросмотр уведомлений', icon: '👁️', text: '', buttons: [{ label: 'Всегда', value: 'always' }, { label: 'После разблокировки', value: 'locked' }, { label: 'Отмена', value: null }] });
    if (r) { p.notifications.preview = r; save(); render(); }
  } }));
  list.append(row({ icon: '🔒', iconBg: 'rgba(255,255,255,.08)', title: 'Блокировка SIM-карты (PIN2)', sub: 'выключена', right: switchEl(false, () => toast('🔒', 'PIN2', 'Если забудете — телефон превратится в кирпич. Не надо.')) }));
  list.append(row({ icon: '🛡️', iconBg: 'rgba(74,222,128,.2)', title: 'Google Play Защита (ну почти)', sub: 'угроз не найдено', right: chev(), onClick: () => toast('🛡️', 'Проверка безопасности', 'Просканировано 15 приложений. Угроз нет. Кроме змейки — она опасна для продуктивности.') }));
  list.append(row({ icon: '🕵️', iconBg: 'rgba(255,255,255,.08)', title: 'Разрешения приложений', sub: 'камера, микрофон, геолокация', right: chev(), onClick: () => permissions() }));
  body.append(list);
}

async function permissions() {
  await sysDialog({
    title: 'Разрешения', icon: '🕵️',
    text: '📷 Камера: Камера, Галерея, Сообщения<br/>🎙️ Микрофон: Диктофон, Телефон, Сообщения<br/>📍 Геолокация: Погода, Карты, Браузер<br/>👤 Контакты: Телефон, Сообщения<br/><br/>Всё честно: приложения просят то, что им нужно.',
    buttons: [{ label: 'Понятно', value: true, cls: 'primary' }]
  });
}

async function pinMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Блокировка экрана', icon: '🔐',
    text: `Текущий способ: ${S.phone.user.hasPin ? 'PIN-код' : 'нет'}`,
    buttons: [
      { label: S.phone.user.hasPin ? 'Изменить PIN' : 'Задать PIN', value: 'change', cls: 'primary' },
      { label: 'Отключить блокировку', value: 'off', cls: 'danger' },
      { label: 'Отмена', value: null }
    ]
  });
  if (res === 'change') {
    const ok = await api.requestPin();
    if (ok) render();
  } else if (res === 'off') {
    if (await sysConfirm('Отключить блокировку?', 'Любой сможет разблокировать телефон свайпом. Как в 2011-м.', 'Отключить', true)) {
      S.phone.user.hasPin = false; save(); render();
      toast('🔓', 'Блокировка отключена', 'Теперь достаточно свайпа');
    }
  }
}

async function fpEnroll() {
  const S = getState();
  const res = await sysDialog({
    title: 'Отпечаток пальца', icon: '👆',
    text: 'Приложите палец к сканеру 5 раз.<br/><br/>1… 2… 3… 4… 5…<br/><br/>Готово? Сохранить отпечаток?',
    buttons: [{ label: 'Отмена', value: false }, { label: 'Сохранить', value: true, cls: 'primary' }]
  });
  if (!res) { render(); return; }
  S.phone.user.fp = true;
  S.phone.user.hasPin = S.phone.user.hasPin || true;
  save(); render();
  unlock('fp');
  SFX.notif();
  toast('👆', 'Отпечаток сохранён', 'Теперь разблокировка: удерживайте кнопку отпечатка на экране блокировки');
}

async function faceEnroll() {
  const S = getState();
  const res = await sysDialog({
    title: 'Фейсконтроль', icon: '🙂',
    text: 'Посмотрите в камеру и медленно поверните голову.<br/><br/>⚠️ Работает в темноте плохо и обманывается фотографией. Но это игра.',
    buttons: [{ label: 'Отмена', value: false }, { label: 'Зарегистрировать', value: true, cls: 'primary' }]
  });
  if (!res) { render(); return; }
  S.phone.user.face = true;
  save(); render();
  toast('🙂', 'Лицо зарегистрировано', 'Разблокировка взглядом включена');
}

/* ---------- благополучие ---------- */
function renderWellbeing(body) {
  const S = getState();
  const p = S.phone;
  const mins = Math.round(p.uptimeSec / 60 * 60);
  body.append(el('div', { style: { textAlign: 'center', padding: '18px 16px 8px' } },
    el('div', { style: { fontSize: '40px', fontWeight: '200' }, text: fmtDur(p.uptimeSec) }),
    el('div', { style: { fontSize: '12px', opacity: '.6', marginTop: '4px' }, text: 'времени с включённым экраном' })
  ));

  const stats = [
    ['🔓', 'Разблокировок', S.stats.unlocks],
    ['🔔', 'Уведомлений получено', S.stats.msgsRecv + S.notifications.length],
    ['💬', 'Сообщений отправлено', S.stats.msgsSent],
    ['📞', 'Звонков', S.stats.calls],
    ['📸', 'Фото сделано', S.stats.photos],
    ['📶', 'Трафика, МБ', Math.round(S.stats.dataMb)],
    ['🛒', 'Покупок', S.stats.purchases || 0],
    ['🐍', 'Рекорд в змейке', S.stats.snakeBest || 0]
  ];
  const grid = el('div', { class: 'set-tile' });
  stats.forEach(([i, t, v]) => grid.append(el('div', { class: 'st', style: { textAlign: 'center' } },
    el('div', { style: { fontSize: '18px' }, text: i }),
    el('b', { style: { fontSize: '17px' }, text: String(v) }),
    el('span', { text: t }))));
  body.append(grid);

  const list = el('div', { class: 'list', style: { marginTop: '10px' } });
  list.append(row({ icon: '⏰', iconBg: 'rgba(251,146,60,.2)', title: 'Таймер приложений', sub: 'лимит на змейку: 2 часа (шутка)', right: switchEl(false, () => toast('⏰', 'Лимит', 'Вы сами решаете, когда остановиться. Наверное.')) }));
  list.append(row({ icon: '🌙', iconBg: 'rgba(148,163,184,.2)', title: 'Режим сна', sub: 'с 23:00 до 07:00 — экран ч/б', right: switchEl(!!p.sleepMode, (v) => { p.sleepMode = v; save(); toast('🌙', v ? 'Режим сна включён' : 'Режим сна выключен', v ? 'После 23:00 уведомления станут тише' : ''); }) }));
  list.append(row({ icon: '🧘', iconBg: 'rgba(45,212,191,.2)', title: 'Дыхательная пауза', sub: '1 минута без уведомлений', right: chev(), onClick: () => breathe() }));
  body.append(list);
}

async function breathe() {
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog', style: { textAlign: 'center' } });
  const circle = el('div', { style: { width: '110px', height: '110px', margin: '10px auto', borderRadius: '50%', background: 'radial-gradient(circle,#38bdf8,#1e3a8a)', transition: 'transform 4s ease-in-out', opacity: '.85' } });
  const txt = el('div', { style: { fontSize: '13px', opacity: '.75' }, text: 'Вдох…' });
  box.append(el('div', { class: 'sysdialog__body' }, el('div', { class: 'sysdialog__title', text: 'Дышите' }), circle, txt));
  const acts = el('div', { class: 'sysdialog__actions' });
  acts.append(el('button', { text: 'Закончить', onclick: close }));
  box.append(acts);
  back.append(box);
  document.getElementById('syslayer').append(back);
  let i = 0;
  const iv = setInterval(() => {
    i++;
    const inhale = i % 2 === 1;
    circle.style.transform = inhale ? 'scale(1.25)' : 'scale(0.85)';
    txt.textContent = inhale ? 'Вдох…' : 'Выдох…';
  }, 4000);
  function close() { clearInterval(iv); back.remove(); toast('🧘', 'Пауза завершена', 'Уведомления никуда не делись, но вы молодцы'); }
}

/* ---------- приложения ---------- */
function renderApps(body) {
  const S = getState();
  const list = el('div', { class: 'list' });
  const all = Object.entries(window.__appsList?.() || {});
  all.forEach(([id, meta]) => {
    list.append(row({
      icon: meta.emoji ? meta.icon : '📱', iconBg: meta.color, title: meta.name,
      sub: `${(10 + hash(id) % 90)} МБ · ${hash(id) % 2 ? 'работает в фоне' : 'остановлено'}`,
      right: chev(),
      onClick: () => appInfo(id, meta)
    }));
  });
  body.append(list);
  body.append(el('div', { style: { padding: '14px 16px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '🛍️ Открыть Nova Store', onclick: () => api.openApp('store') })));
}

async function appInfo(id, meta) {
  const S = getState();
  const size = (6 + hash(id) % 140);
  const res = await sysDialog({
    title: meta.name, icon: meta.emoji ? meta.icon : '📱',
    text: `Версия 1.${hash(id) % 9}.${hash(id) % 20}<br/>Размер: ${size} МБ<br/>Установлено: сегодня<br/>Разрешения: ${(hash(id) % 3) + 1}`,
    buttons: [
      { label: 'Открыть', value: 'open', cls: 'primary' },
      { label: 'Очистить кэш', value: 'cache' },
      { label: 'Удалить', value: 'del', cls: 'danger' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (res === 'open') api.openApp(id);
  if (res === 'cache') { toast('🧹', 'Кэш очищен', `${meta.name}: освобождено ${(hash(id) % 90) + 4} МБ`); }
  if (res === 'del') {
    if (['messages', 'phone', 'browser', 'camera', 'settings'].includes(id)) {
      toast('🚫', 'Нельзя удалить', 'Системное приложение. NovaOS против.');
      return;
    }
    if (await sysConfirm('Удалить приложение?', `${meta.name} будет удалено вместе с данными.`, 'Удалить', true)) {
      S.store.installed = S.store.installed.filter((x) => x !== id);
      save();
      api.refreshHome();
      toast('🗑️', 'Приложение удалено', meta.name);
      render();
    }
  }
}

/* ---------- о телефоне ---------- */
let buildTaps = 0;
function renderAbout(body) {
  const S = getState();
  const p = S.phone;
  body.append(el('div', { style: { textAlign: 'center', padding: '18px 16px' } },
    el('div', { style: { fontSize: '40px' }, text: '📱' }),
    el('div', { style: { fontSize: '21px', fontWeight: '700', marginTop: '6px' }, text: p.about.model }),
    el('div', { style: { fontSize: '12px', opacity: '.6' }, text: p.about.os })
  ));

  const rows = [
    ['Имя устройства', p.user.name || 'Владелец'],
    ['Модель', p.about.model],
    ['Версия NovaOS', p.about.os],
    ['Номер сборки', p.about.build],
    ['Ядро', p.about.kernel],
    ['Процессор', p.about.cpu],
    ['Оперативная память', p.about.ram],
    ['Встроенная память', p.storage.total + ' ГБ'],
    ['Частота экрана', p.about.refresh + ' Гц'],
    ['IMEI', p.sim.imei],
    ['Серийный номер', 'NX5P' + hash(p.sim.imei).toString(36).toUpperCase().slice(0, 10)],
    ['MAC-адрес Wi-Fi', 'a4:cf:12:9b:7e:' + (hash('mac') % 90 + 10)],
    ['IP-адрес', p.wifi.ssid ? '192.168.1.' + (hash(p.wifi.ssid) % 200 + 20) : '—'],
    ['SIM-карта', p.sim.operator ? `${OPERATORS[p.sim.operator].name} · ${p.sim.number}` : 'не установлена'],
    ['Время работы', fmtDur(p.uptimeSec)],
    ['Первое включение', p.firstBootAt ? fmtTime(new Date(p.firstBootAt)) : '—'],
    ['Уровень защиты', 'IP68 (погружение до 1,5 м, 30 мин)'],
    ['Сертификация', 'CE · RoHS · вымышленный стандарт Nova']
  ];
  const list = el('div', { class: 'list' });
  rows.forEach(([k, v], i) => {
    list.append(row({ title: k, sub: String(v), right: k === 'Номер сборки' ? chev() : null, onClick: k === 'Номер сборки' ? () => buildTap() : null }));
  });
  body.append(list);
  body.append(el('div', { style: { padding: '16px', textAlign: 'center', fontSize: '11.5px', opacity: '.45' }, text: 'NOVA Electronics © 2026 · Сделано с любовью к симуляторам' }));

  function buildTap() {
    buildTaps++;
    SFX.key();
    if (buildTaps === 5) toast('🛠️', 'Ещё чуть-чуть…', 'Продолжайте нажимать на номер сборки');
    if (buildTaps >= 7) {
      buildTaps = 0;
      S.phone.devMode = true;
      save();
      unlock('reboot');
      notify({ appId: 'system', icon: '🛠️', color: '#a78bfa', title: 'Режим разработчика включён', text: 'Вы нашли пасхалку! Доступны отладочные функции в разделе «Система».', priority: true });
      toast('🛠️', 'Режим разработчика включён', 'Загляните в Настройки → Система');
    }
  }
}

/* ---------- система ---------- */
function renderSystem(body) {
  const S = getState();
  const p = S.phone;
  const list = el('div', { class: 'list' });
  list.append(row({ icon: '🌐', iconBg: 'rgba(56,189,248,.2)', title: 'Язык и ввод', sub: { ru: 'Русский', uk: 'Українська', en: 'English', nl: 'Nederlands', fr: 'Français' }[p.lang] || 'Русский', right: chev(), onClick: () => langMenu() }));
  list.append(row({ icon: '🕒', iconBg: 'rgba(251,191,36,.2)', title: 'Дата и время', sub: `${fmtTime(new Date(S.time.gameMs))} · автоопределение`, right: chev(), onClick: () => timeMenu() }));
  list.append(row({ icon: '💾', iconBg: 'rgba(74,222,128,.2)', title: 'Резервное копирование', sub: `последнее: ${S.lastSave ? new Date(S.lastSave).toLocaleTimeString('ru-RU') : 'не было'}`, right: chev(), onClick: () => { save(); toast('💾', 'Резервная копия создана', 'Прогресс сохранён в этом браузере'); } }));
  list.append(row({ icon: '🔄', iconBg: 'rgba(167,139,250,.2)', title: 'Обновление системы', sub: `NovaOS ${p.about.os.split(' ')[1]} · актуальная`, right: chev(), onClick: () => checkUpdate() }));
  list.append(row({ icon: '🔁', iconBg: 'rgba(239,68,68,.16)', title: 'Сброс', sub: 'вернуть телефон к заводским настройкам', right: chev(), onClick: () => resetPhone() }));
  body.append(list);

  if (p.devMode) {
    body.append(el('div', { class: 'sect-title', text: '🛠️ Режим разработчика' }));
    const dev = el('div', { class: 'list' });
    dev.append(row({ icon: '⏩', title: 'Скорость времени', sub: `1 реальная секунда = ${S.time.speed} игровых секунд`, right: chev(), onClick: () => speedMenu() }));
    dev.append(row({ icon: '🔋', title: 'Батарея', sub: `${p.battery.pct.toFixed(2)}% · ${p.battery.charging ? 'зарядка' : 'разряд'}`, right: chev(), onClick: () => battMenu() }));
    dev.append(row({ icon: '⏭️', title: 'Пропустить 8 часов', sub: 'быстро перемотать ночь', right: chev(), onClick: () => { window.__advance?.(8); toast('⏩', 'Прошло 8 часов', 'Надеюсь, вы поспали'); } }));
    dev.append(row({ icon: '💬', title: 'Спровоцировать сообщение', sub: 'случайный контакт напишет', right: chev(), onClick: () => { window.__randomAmbient?.(); } }));
    dev.append(row({ icon: '📞', title: 'Входящий звонок', sub: 'кто-то позвонит прямо сейчас', right: chev(), onClick: () => { window.__randomCall?.(); } }));
    dev.append(row({ icon: '💶', title: 'Деньги', sub: `кошелёк ${fmtMoney(S.money)} · карта ${fmtMoney(S.bank.balance)}`, right: chev(), onClick: () => moneyMenu() }));
    body.append(dev);
  }
}

async function langMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Язык системы', icon: '🌐',
    text: 'Полный перевод доступен только для русского — остальные языки в игре декоративные.',
    buttons: [
      { label: '🇷🇺 Русский', value: 'ru', cls: 'primary' },
      { label: '🇺🇦 Українська', value: 'uk' },
      { label: '🇬🇧 English', value: 'en' },
      { label: 'Отмена', value: null }
    ]
  });
  if (!res) return;
  S.phone.lang = res; save(); render();
  toast('🌐', 'Язык изменён', res === 'ru' ? 'Русский' : 'Переведено 3% интерфейса. Но настроение отличное');
}

async function timeMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Дата и время', icon: '🕒',
    text: `Сейчас в игре: ${new Date(S.time.gameMs).toLocaleString('ru-RU')}<br/>Часовой пояс: Европа/Брюссель (UTC+2)`,
    buttons: [
      { label: 'Авто (по сети)', value: 'auto', cls: 'primary' },
      { label: '⏩ +1 час', value: '+1' },
      { label: '⏪ −1 час', value: '-1' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (res === '+1') window.__advance?.(1);
  if (res === '-1') window.__advance?.(-1);
  if (res) { render(); }
}

async function speedMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Скорость игрового времени', icon: '⏩',
    text: `Сейчас: 1 реальная секунда = ${S.time.speed} игровых секунд (${S.time.speed / 60} игровых минут)`,
    buttons: [
      { label: '×30 (медленно)', value: 30 },
      { label: '×60 (обычно)', value: 60, cls: 'primary' },
      { label: '×180 (быстро)', value: 180 },
      { label: '×600 (день за минуту)', value: 600 }
    ]
  });
  if (res) { window.__setSpeed?.(res); render(); toast('⏩', 'Скорость времени', `1 сек = ${res} игровых секунд`); }
}

async function battMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Батарея (отладка)', icon: '🔋',
    text: `Заряд: ${S.phone.battery.pct.toFixed(2)}%<br/>Температура: ${S.phone.battery.temp.toFixed(1)} °C<br/>Кабель: ${S.world.chargerPlugged ? 'подключён' : 'нет'}`,
    buttons: [
      { label: '100%', value: 100 }, { label: '50%', value: 50 }, { label: '15%', value: 15 }, { label: '0%', value: 0, cls: 'danger' }
    ]
  });
  if (res === null || res === undefined) return;
  S.phone.battery.pct = res;
  save(); render(); emit(EV.BATTERY, S.phone.battery);
  toast('🔋', 'Заряд изменён', res + '%');
}

async function moneyMenu() {
  const S = getState();
  const res = await sysDialog({
    title: 'Деньги (отладка)', icon: '💶',
    text: `Наличные: ${fmtMoney(S.money)}<br/>Карта: ${fmtMoney(S.bank.balance)}`,
    buttons: [
      { label: '+50 € на карту', value: 'card' },
      { label: '+50 € наличными', value: 'cash' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (res === 'card') { S.bank.balance += 50; toast('💳', '+50 €', 'Зачислено на карту'); }
  if (res === 'cash') { S.money += 50; toast('💶', '+50 €', 'Положено в кошелёк'); }
  if (res) { save(); emit(EV.MONEY); render(); }
}

async function checkUpdate() {
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog' });
  box.append(el('div', { class: 'sysdialog__body' },
    el('div', { class: 'sysdialog__ico', text: '🔄' }),
    el('div', { class: 'sysdialog__title', text: 'Проверка обновлений…' }),
    el('div', { class: 'boot__spinner' })
  ));
  back.append(box);
  document.getElementById('syslayer').append(back);
  await new Promise((r) => setTimeout(r, 1800));
  back.remove();
  const res = await sysDialog({
    title: 'NovaOS 15.0.1 доступна!', icon: '📦',
    text: 'Размер: 1,2 ГБ<br/><br/>Что нового:<br/>• Шторка теперь открывается на 12% приятнее<br/>• Змейка стала плавнее на экранах 120 Гц<br/>• Исправлена ошибка, из-за которой будильник звонил слишком честно<br/>• Улучшена анимация снятия защитной плёнки',
    buttons: [{ label: 'Позже', value: false }, { label: 'Установить', value: true, cls: 'primary' }]
  });
  if (!res) return;
  const overlay = el('div', { class: 'sysdialog-backdrop' });
  const box2 = el('div', { class: 'sysdialog' });
  const prog = el('div', { class: 'boot__bar', style: { width: '100%', marginTop: '14px' } }, el('i', { style: { width: '0%' } }));
  const lbl = el('div', { class: 'sysdialog__text', text: 'Загрузка…' });
  box2.append(el('div', { class: 'sysdialog__body' }, el('div', { class: 'sysdialog__title', text: 'Обновление системы' }), lbl, prog));
  overlay.append(box2);
  document.getElementById('syslayer').append(overlay);
  const steps = ['Загрузка…', 'Установка…', 'Оптимизация приложений…', 'Перезагрузка…'];
  for (let i = 0; i < steps.length; i++) {
    lbl.textContent = steps[i];
    prog.firstChild.style.width = `${(i + 1) / steps.length * 100}%`;
    await new Promise((r) => setTimeout(r, 1100));
  }
  overlay.remove();
  getState().phone.about.build = 'NX5P.251021.005';
  getState().phone.about.os = 'NovaOS 15.0.1';
  save();
  toast('✅', 'Система обновлена', 'NovaOS 15.0.1 · сборка NX5P.251021.005');
  notify({ appId: 'system', icon: '✅', color: '#4ade80', title: 'Обновление установлено', text: 'NovaOS 15.0.1 — шторка стала приятнее на 12%' });
  render();
}

async function resetPhone() {
  const S = getState();
  const r1 = await sysDialog({
    title: 'Сброс до заводских?', icon: '⚠️',
    text: 'Будут удалены:<br/>• все сообщения и фото<br/>• настройки и аккаунты<br/>• установленные приложения<br/><br/>Телефон вернётся в состояние «только из коробки»: снова коробка, плёнка, SIM-карта и мастер настройки.',
    buttons: [{ label: 'Отмена', value: false }, { label: 'Сбросить всё', value: true, cls: 'danger' }]
  });
  if (!r1) return;
  const r2 = await sysDialog({
    title: 'Точно сбросить?', icon: '🗑️',
    text: 'Это действие нельзя отменить. Прогресс игры будет потерян, и вы начнёте с распаковки.',
    input: { placeholder: 'введите СБРОС' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Сбросить', value: true, cls: 'danger' }]
  });
  if (!r2 || String(r2).trim().toUpperCase() !== 'СБРОС') { toast('❌', 'Не подтверждено', 'Нужно было ввести слово СБРОС'); return; }
  clearSave();
  location.reload();
}
