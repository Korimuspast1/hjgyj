import { emit, EV } from './bus.js';

export const SAVE_KEY = 'nova-x5-pro-save-v1';

export const OPERATORS = {
  mobiline: {
    id: 'mobiline', name: 'Mobiline', color: '#ef4444',
    tariff: 'Безлимит+', price: 12.0, gb: Infinity, minutes: 500, sms: 200,
    desc: 'Безлимитный интернет, 500 минут, 200 SMS. 12,00 € / месяц',
    ussd: 'Баланс: {bal} €\nПакет: безлимит интернет\nМинут осталось: {min}\nSMS: {sms}\nТариф «Безлимит+»'
  },
  telka: {
    id: 'telka', name: 'Telka', color: '#22c55e',
    tariff: 'Старт 15', price: 8.0, gb: 15, minutes: 300, sms: 100,
    desc: '15 ГБ, 300 минут, 100 SMS. 8,00 € / месяц',
    ussd: 'Баланс: {bal} €\nОстаток: {gb} ГБ / {min} мин\nSMS: {sms}\nТариф «Старт 15»'
  },
  none: { id: 'none', name: 'Нет оператора', color: '#64748b' }
};

export const WIFI_NETWORKS = [
  { ssid: 'Home_Nova_5G', pass: 'kotenok2024', signal: 4, secured: true, freq: '5 ГГц' },
  { ssid: 'Home_Nova_2.4G', pass: 'kotenok2024', signal: 4, secured: true, freq: '2.4 ГГц' },
  { ssid: 'TP-LINK_A4F2', pass: '12345678', signal: 3, secured: true, freq: '2.4 ГГц' },
  { ssid: 'Coffee_Free_WiFi', pass: '', signal: 2, secured: false, freq: '2.4 ГГц' },
  { ssid: 'ROSTELECOM_9C1', pass: 'Qwerty2024', signal: 2, secured: true, freq: '5 ГГц' },
  { ssid: 'FBI_Surveillance_Van', pass: 'nope', signal: 1, secured: true, freq: '2.4 ГГц' }
];

export const BT_DEVICES = [
  { id: 'bh1', name: 'Nova Buds Air', type: 'Наушники', icon: '🎧', battery: 78, paired: false },
  { id: 'sp2', name: 'JBL GO Mini', type: 'Колонка', icon: '🔊', battery: 61, paired: false },
  { id: 'watch', name: 'Nova Watch SE', type: 'Часы', icon: '⌚', battery: 44, paired: false },
  { id: 'car', name: 'Моя машина', type: 'Авто', icon: '🚗', battery: null, paired: false }
];

export const WALLPAPERS = [
  { id: 'nebula', name: 'Туманность', css: 'radial-gradient(120% 90% at 20% 10%, #4c1d95 0%, #1e1b4b 40%, #020617 100%)' },
  { id: 'ocean', name: 'Океан', css: 'linear-gradient(160deg,#0ea5e9 0%,#1e3a8a 45%,#0f172a 100%)' },
  { id: 'sunset', name: 'Закат', css: 'linear-gradient(180deg,#f97316 0%,#db2777 45%,#312e81 100%)' },
  { id: 'forest', name: 'Лес', css: 'linear-gradient(165deg,#052e16 0%,#14532d 40%,#022c22 100%)' },
  { id: 'mono', name: 'Графит', css: 'linear-gradient(160deg,#1f2937,#030712)' },
  { id: 'candy', name: 'Конфетка', css: 'linear-gradient(150deg,#f472b6,#a78bfa 45%,#38bdf8)' },
  { id: 'aurora', name: 'Сияние', css: 'radial-gradient(90% 60% at 70% 0%, #06b6d4 0%, transparent 55%), radial-gradient(80% 60% at 10% 30%, #8b5cf6 0%, transparent 60%), linear-gradient(180deg,#0b1020,#020617)' },
  { id: 'lava', name: 'Лава', css: 'radial-gradient(80% 60% at 50% 100%, #dc2626 0%, #7c2d12 40%, #0c0a09 100%)' },
  { id: 'mint', name: 'Мята', css: 'linear-gradient(160deg,#d1fae5,#5eead4 55%,#0f766e)' }
];

export const ACCENTS = [
  { id: 'blue', name: 'Синий', hex: '#38bdf8' },
  { id: 'violet', name: 'Фиолет', hex: '#a78bfa' },
  { id: 'green', name: 'Зелёный', hex: '#4ade80' },
  { id: 'orange', name: 'Оранжевый', hex: '#fb923c' },
  { id: 'pink', name: 'Розовый', hex: '#f472b6' },
  { id: 'red', name: 'Красный', hex: '#f87171' }
];

export const RINGTONES = [
  { id: 'nova', name: 'Nova (по умолчанию)' },
  { id: 'beep', name: 'Короткий сигнал' },
  { id: 'chime', name: 'Перезвон' },
  { id: 'retro', name: 'Ретро-телефон' },
  { id: 'silent', name: 'Без звука' }
];

export const FONTS = [
  { id: 'small', name: 'Мелкий', scale: 0.92 },
  { id: 'normal', name: 'Обычный', scale: 1 },
  { id: 'large', name: 'Крупный', scale: 1.09 },
  { id: 'huge', name: 'Очень крупный', scale: 1.2 }
];

// ---------- контакты ----------
export function makeContacts() {
  return [
    { id: 'mom', name: 'Мама', full: 'Ольга Петровна', phone: '+32 471 22 08 14', color: '#f472b6', initials: 'М', role: 'Мама', fav: true, messenger: true, arc: 0, online: 'была 5 мин назад' },
    { id: 'kirill', name: 'Кирилл', full: 'Кирилл Бондарь', phone: '+32 477 90 31 55', color: '#38bdf8', initials: 'К', role: 'Лучший друг', fav: true, messenger: true, arc: 0, online: 'в сети' },
    { id: 'anya', name: 'Аня', full: 'Аня Соколова', phone: '+32 465 11 74 02', color: '#a78bfa', initials: 'А', role: 'в сети', messenger: true, arc: 0, online: 'в сети' },
    { id: 'dad', name: 'Папа', full: 'Игорь Соколов', phone: '+32 471 55 90 33', color: '#fb923c', initials: 'П', role: 'Папа', messenger: true, arc: 0, online: 'был 2 ч назад' },
    { id: 'bank', name: 'NovaBank', full: 'NovaBank Сервис', phone: '5225', color: '#4ade80', initials: '🏦', role: 'Сервисный номер', service: true, messenger: false, arc: 0, online: '' },
    { id: 'operator', name: null, full: null, phone: null, color: '#22c55e', initials: '📶', role: 'Оператор', service: true, messenger: false, arc: 0, online: '', sms: true, nameKey: 'operator' },
    { id: 'shop', name: 'TechShop', full: 'TechShop — ваш заказ', phone: '8800', color: '#22d3ee', initials: '🛒', role: 'Магазин', service: true, messenger: false, arc: 0, online: '' },
    { id: 'spam', name: null, full: '+7 999 000-13-13', phone: '+79990001313', color: '#94a3b8', initials: '?', role: 'Неизвестный', service: true, messenger: false, arc: 0, online: '', spam: true }
  ];
}

// ---------- чаты ----------
function mkChat(id) {
  return { id, messages: [], unread: 0, pinned: false, muted: false, draft: '', step: 0, typing: false, lastActivity: 0 };
}

export function defaultState() {
  const now = new Date();
  // старт игры: сегодня 16:20
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 20, 0);
  const contacts = makeContacts();
  const chats = {};
  contacts.forEach((c) => { chats[c.id] = mkChat(c.id); });

  return {
    version: 1,
    createdAt: Date.now(),
    // --- мир/сюжет ---
    stage: 'box', // box | opened | film | simtray | simin | tariff | poweron | booting | setup | ready
    world: {
      boxOpened: false,
      filmPeeled: false,
      trayOut: false,
      simInTray: false,
      trayIn: false,
      simOperator: null,
      phoneOutOfBox: false,
      chargerPlugged: false,
      lampOn: false,
      mugSipped: false,
      walletSeen: false,
      routerSeen: false,
      simTariffPaid: false,
      needTariff: false,
      pinUsed: 0
    },
    // --- время ---
    time: { gameMs: start.getTime(), startedAt: Date.now(), speed: 60 }, // 1 реальная секунда = 60 игровых (1 минута)
    // --- деньги ---
    money: 150.0,
    // --- телефон ---
    phone: {
      on: false,
      awake: false,
      locked: true,
      setupDone: false,
      setupStep: 0,
      name: 'NOVA X5 Pro',
      user: { name: 'Владелец', pin: '1234', hasPin: true, fp: false, fpPrints: 0, face: false },
      lang: 'ru',
      theme: 'dark',
      accent: 'blue',
      wallpaper: 'nebula',
      lockWallpaper: 'nebula',
      fontScale: 'normal',
      brightness: 78,
      autoBrightness: false,
      screenTimeout: 120,
      nightLight: false,
      showPercent: true,
      showNumber: true,
      touchSound: true,
      ringtone: 'nova',
      sleepMode: false,
      devMode: false,
      nfc: false,
      printing: false,
      hotspotPass: 'nova1234',
      lockWallpaper: 'nebula',
      appNotifs: {},
      pin2: '0000',
      notifPreview: true,
      volume: { media: 55, ring: 70, alarm: 80, notif: 60 },
      vibrate: true,
      dnd: false,
      airplane: false,
      rotation: true,
      flashlight: false,
      hotspot: false,
      battery: { pct: 74, charging: false, health: 100, cycles: 3, temp: 31.4, saver: false },
      wifi: { on: false, ssid: null, remembered: [] },
      bt: { on: false, connected: null, devices: BT_DEVICES.map((d) => ({ ...d })) },
      data: { on: false, usedGb: 0, roaming: false, limitGb: 15, minutesUsed: 0, smsUsed: 0 },
      sim: { inserted: false, operator: null, number: null, iccid: null, imei: '356938035643809', signal: 0, netType: '5G' },
      storage: { total: 256, photos: 0.04, apps: 12.8, media: 3.2, system: 28.4 },
      notifications: { allowed: true, style: 'banner', preview: 'always' },
      about: { model: 'NOVA X5 Pro', os: 'NovaOS 15', build: 'NX5P.251021.004', kernel: '6.1.87-nova', cpu: 'Nova Titan G3 · 8 ядер', ram: '12 ГБ', refresh: 120 },
      lastShutdownReason: null,
      firstBootAt: null,
      uptimeSec: 0
    },
    // --- данные приложений ---
    messages: { chats },
    contacts,
    calls: [],           // история звонков
    recents: [],         // недавние приложения
    photos: [],          // галерея
    notes: [
      { id: 'n1', title: 'Пароль от Wi-Fi', body: 'Роутер в коридоре.\nПароль написан на наклейке снизу: kotenok2024\n\nНе забыть сменить (потом).', updated: start.getTime() - 86400000, color: '#facc15', pinned: true }
    ],
    alarms: [
      { id: 'a1', time: '07:30', label: 'Учёба', days: [1, 2, 3, 4, 5], on: false, ring: false, snoozeUntil: 0 },
      { id: 'a2', time: '09:00', label: 'Выспаться', days: [6, 0], on: false, ring: false, snoozeUntil: 0 }
    ],
    world_clocks: [
      { city: 'Брюссель', tz: 0, flag: '🇧🇪' },
      { city: 'Киев', tz: 1, flag: '🇺🇦' },
      { city: 'Нью-Йорк', tz: -6, flag: '🇺🇸' },
      { city: 'Токио', tz: 7, flag: '🇯🇵' }
    ],
    timer: { running: false, endsAt: 0, totalSec: 0, remainSec: 0, label: 'Таймер' },
    radio: { station: 'nova-fm', playing: false, favs: ['retro', 'lofi'], now: '', elapsed: 0, volume: 45 },
    recorder: { recording: false, startedAt: 0, paused: false, quality: 'high' },
    recordings: [],
    stopwatch: { running: false, startedAt: 0, acc: 0, laps: [] },
    calcHistory: [],
    music: {
      playing: false, trackId: 't1', pos: 0, shuffle: false, repeat: 'off', volume: 55, queue: [],
      tracks: [
        { id: 't1', title: 'Ночной трафик', artist: 'SYNTHWAVE BRUSSELS', album: 'Neon District', dur: 214, emoji: '🌆', color: '#7c3aed' },
        { id: 't2', title: 'Пиксели и дождь', artist: 'Lo-Fi Kitten', album: 'Study Beats', dur: 178, emoji: '🌧️', color: '#0ea5e9' },
        { id: 't3', title: 'Мама звонит', artist: 'DJ Батарея', album: '1%', dur: 143, emoji: '🪫', color: '#ef4444' },
        { id: 't4', title: 'Симулятор жизни', artist: 'NOVA SOUND', album: 'X5 Pro EP', dur: 236, emoji: '📱', color: '#22c55e' },
        { id: 't5', title: 'Свитч на 120 Гц', artist: 'Hz Collective', album: 'Smooth', dur: 195, emoji: '⚡', color: '#f59e0b' },
        { id: 't6', title: 'Шторка вниз', artist: 'Notification Crew', album: 'Badge 99+', dur: 167, emoji: '🔔', color: '#f472b6' }
      ]
    },
    weather: { city: 'Брюссель', temp: 14, seed: Math.floor(Math.random() * 10000) },
    bank: {
      balance: 137.42, card: '4514 61•• •••• 7723',
      transactions: [
        { id: 'x1', title: 'TechShop — NOVA X5 Pro', cat: 'Покупки', amount: -899.0, at: start.getTime() - 3 * 3600000, icon: '📱' },
        { id: 'x2', title: 'Зарплата', cat: 'Поступления', amount: 1240.0, at: start.getTime() - 5 * 86400000, icon: '💼' },
        { id: 'x3', title: 'Кофейня «Пар»', cat: 'Кафе', amount: -4.8, at: start.getTime() - 26 * 3600000, icon: '☕' },
        { id: 'x4', title: 'Метро Брюссель', cat: 'Транспорт', amount: -2.6, at: start.getTime() - 30 * 3600000, icon: '🚇' }
      ]
    },
    store: { installed: [], featured: 'snake' },
    browser: { home: 'nova://start', history: [], tabs: [{ id: 1, url: 'nova://start', title: 'Новая вкладка' }], activeTab: 0, bookmarks: ['nova-search.net', 'novanews.io', 'techshop.online'] },
    gallery: { album: 'all' },
    files: [
      { id: 'f1', name: 'Nova_Catalog_2026.pdf', folder: 'Загрузки', size: 3.4, kind: 'doc', at: start.getTime() - 2 * 86400000, text: 'Каталог NOVA 2026\n\nX5 Pro — 899 €\nX5 — 649 €\nX5 Lite — 399 €\n\nВесной обещают X6. Не верьте.' },
      { id: 'f2', name: 'oboi_neon.jpg', folder: 'Загрузки', size: 2.1, kind: 'photo', at: start.getTime() - 5 * 86400000, text: 'Картинка 1080×2400. Красивая, но в галерею не попала — лежит в загрузках.' },
      { id: 'f3', name: 'ringtone_nova.mp3', folder: 'Загрузки', size: 1.2, kind: 'audio', at: start.getTime() - 6 * 86400000 },
      { id: 'f4', name: 'chek_kofe.pdf', folder: 'Документы', size: 0.1, kind: 'doc', at: start.getTime() - 26 * 3600000, text: 'Кофейня «Пар»\nКапучино 0,4 — 4,80 €\nОплата картой •••• 7723\nПриходите ещё!' }
    ],
    // --- уведомления ---
    notifications: [],
    // --- прогресс ---
    tasks: [
      { id: 't1', text: 'Открыть коробку с телефоном', done: false, group: 'setup' },
      { id: 't2', text: 'Снять защитную плёнку с экрана', done: false, group: 'setup' },
      { id: 't3', text: 'Достать скрепку и открыть SIM-лоток', done: false, group: 'setup' },
      { id: 't4', text: 'Положить SIM-карту в лоток и вставить обратно', done: false, group: 'setup' },
      { id: 't5', text: 'Выбрать оператора и тариф', done: false, group: 'setup' },
      { id: 't6', text: 'Включить телефон (зажать кнопку питания)', done: false, group: 'setup' },
      { id: 't7', text: 'Пройти первоначальную настройку', done: false, group: 'setup' },
      { id: 't8', text: 'Подключиться к Wi-Fi', done: false, group: 'net' },
      { id: 't9', text: 'Прочитать первое сообщение', done: false, group: 'msg' },
      { id: 't10', text: 'Ответить маме в мессенджере', done: false, group: 'msg' },
      { id: 't11', text: 'Открыть шторку уведомлений', done: false, group: 'sys' },
      { id: 't12', text: 'Сделать фото на камеру', done: false, group: 'cam' },
      { id: 't13', text: 'Зайти в интернет через браузер', done: false, group: 'net' },
      { id: 't14', text: 'Позвонить кому-нибудь', done: false, group: 'call' },
      { id: 't15', text: 'Поставить телефон на зарядку', done: false, group: 'bat' }
    ],
    achievements: {},
    stats: { msgsSent: 0, msgsRecv: 0, photos: 0, calls: 0, callSec: 0, dataMb: 0, screenOns: 0, unlocks: 0, purchases: 0, snakeBest: 0 },
    flags: { customWall: { home: false, lock: false } }, // произвольные сюжетные флаги
    hintsShown: {},
    lastSave: 0
  };
}

// ---------------- хранилище ----------------
let S = null;
let saveTimer = null;

export function getState() { return S; }

export function initState(fresh = false) {
  let raw = null;
  try { raw = localStorage.getItem(SAVE_KEY); } catch (e) { /* приватный режим */ }
  if (!fresh && raw) {
    try {
      const parsed = JSON.parse(raw);
      S = mergeDeep(defaultState(), parsed);
      // динамические поля не сохраняем
      S.phone.battery.charging = false;
      S.phone.flashlight = false;
      S.notifications = (S.notifications || []).slice(0, 24);
      return { loaded: true };
    } catch (e) {
      console.warn('Сейв повреждён, начинаем заново', e);
    }
  }
  S = defaultState();
  return { loaded: false };
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

export function save() {
  if (!S) return;
  S.lastSave = Date.now();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* quota */ }
  }, 250);
}

export function touch() { emit(EV.STATE, S); save(); }

export function mergeDeep(base, over) {
  if (over === null || over === undefined) return base;
  if (Array.isArray(base) || Array.isArray(over)) return over === undefined ? base : over;
  if (typeof base !== 'object' || typeof over !== 'object') return over === undefined ? base : over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = mergeDeep(base[k], over[k]);
  return out;
}

// ---------------- удобные селекторы ----------------
export const P = () => S.phone;

export function contactById(id) { return S.contacts.find((c) => c.id === id); }
export function contactByPhone(phone) {
  const norm = (phone || '').replace(/[^\d+]/g, '');
  return S.contacts.find((c) => (c.phone || '').replace(/[^\d+]/g, '') === norm);
}
export function displayName(c) {
  if (!c) return 'Неизвестный';
  if (c.id === 'operator') return S.phone.sim.operator ? OPERATORS[S.phone.sim.operator].name : 'Оператор';
  return c.name || c.full || c.phone;
}
export function task(id) { return S.tasks.find((t) => t.id === id); }
export function completeTask(id) {
  const t = task(id);
  if (t && !t.done) { t.done = true; emit(EV.TASK, t); save(); }
}
