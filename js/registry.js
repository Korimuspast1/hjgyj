import { ICON } from './icons.js';

// Реестр приложений: id → мета + путь к модулю
export const APPS = {
  messages: {
    name: 'Сообщения', color: 'linear-gradient(135deg,#22c55e,#15803d)', icon: ICON.chat(), dock: true,
    mod: () => import('./apps/messages.js')
  },
  phone: {
    name: 'Телефон', color: 'linear-gradient(135deg,#4ade80,#166534)', icon: ICON.phone(), dock: true,
    mod: () => import('./apps/phone.js')
  },
  browser: {
    name: 'Браузер', color: 'linear-gradient(135deg,#60a5fa,#1d4ed8)', icon: ICON.globe(), dock: true,
    mod: () => import('./apps/browser.js')
  },
  camera: {
    name: 'Камера', color: 'linear-gradient(135deg,#475569,#0f172a)', icon: ICON.camera(), dock: true,
    mod: () => import('./apps/camera.js')
  },
  gallery: { name: 'Галерея', color: 'linear-gradient(135deg,#f472b6,#7c3aed)', icon: ICON.gallery(), mod: () => import('./apps/gallery.js') },
  settings: { name: 'Настройки', color: 'linear-gradient(135deg,#64748b,#1e293b)', icon: ICON.settings(), mod: () => import('./apps/settings.js') },
  music: { name: 'Музыка', color: 'linear-gradient(135deg,#fb7185,#7c3aed)', icon: ICON.play(), mod: () => import('./apps/music.js') },
  clock: { name: 'Часы', color: 'linear-gradient(135deg,#f97316,#7c2d12)', icon: ICON.clock(), mod: () => import('./apps/clock.js') },
  calc: { name: 'Калькулятор', color: 'linear-gradient(135deg,#94a3b8,#334155)', icon: ICON.calc(), mod: () => import('./apps/calc.js') },
  notes: { name: 'Заметки', color: 'linear-gradient(135deg,#facc15,#a16207)', icon: ICON.note(), mod: () => import('./apps/notes.js') },
  weather: { name: 'Погода', color: 'linear-gradient(135deg,#38bdf8,#1e40af)', icon: ICON.weather(), mod: () => import('./apps/weather.js') },
  bank: { name: 'NovaBank', color: 'linear-gradient(135deg,#34d399,#065f46)', icon: ICON.bank(), mod: () => import('./apps/bank.js') },
  store: { name: 'Nova Store', color: 'linear-gradient(135deg,#22d3ee,#0e7490)', icon: ICON.store(), mod: () => import('./apps/store.js') },
  files: { name: 'Файлы', color: 'linear-gradient(135deg,#fbbf24,#92400e)', icon: ICON.files(), mod: () => import('./apps/files.js') },
  snake: { name: 'Змейка', color: 'linear-gradient(135deg,#84cc16,#365314)', icon: '🐍', emoji: true, mod: () => import('./apps/snake.js') },
  radio: { name: 'Радио', color: 'linear-gradient(135deg,#c084fc,#581c87)', icon: '📻', emoji: true, mod: () => import('./apps/radio.js') },
  recorder: { name: 'Диктофон', color: 'linear-gradient(135deg,#f87171,#7f1d1d)', icon: ICON.mic(), mod: () => import('./apps/recorder.js') },
  level: { name: 'Уровень', color: 'linear-gradient(135deg,#fde047,#854d0e)', icon: '📐', emoji: true, mod: () => import('./apps/level.js') }
};

// Раскладка домашнего экрана
export const HOME_LAYOUT = [
  [
    { type: 'widget', id: 'weather' },
    { type: 'app', id: 'messages' }, { type: 'app', id: 'phone' }, { type: 'app', id: 'browser' }, { type: 'app', id: 'camera' },
    { type: 'app', id: 'gallery' }, { type: 'app', id: 'music' }, { type: 'app', id: 'bank' }, { type: 'app', id: 'weather' },
    { type: 'app', id: 'clock' }, { type: 'app', id: 'calc' }, { type: 'app', id: 'notes' }, { type: 'app', id: 'settings' }
  ],
  [
    { type: 'widget', id: 'music' },
    { type: 'app', id: 'store' }, { type: 'app', id: 'files' }, { type: 'app', id: 'snake' }, { type: 'app', id: 'radio' },
    { type: 'app', id: 'recorder' }, { type: 'app', id: 'level' }
  ]
];
export const DOCK = ['phone', 'messages', 'browser', 'camera'];

// Каталог Nova Store (в том числе «декоративные» приложения)
export const STORE_CATALOG = [
  { id: 'snake', name: 'Змейка Nova', cat: 'Игры', price: 0, rating: 4.6, size: 12, emoji: '🐍', color: '#84cc16', desc: 'Классика. Собирай пиксели, расти, не врезайся в себя.' },
  { id: 'level', name: 'Уровень', cat: 'Инструменты', price: 0, rating: 4.1, size: 6, emoji: '📐', color: '#fde047', desc: 'Пузырьковый уровень. Ровно вешать полки.' },
  { id: 'radio', name: 'Радио FM', cat: 'Музыка', price: 0, rating: 3.9, size: 18, emoji: '📻', color: '#c084fc', desc: '6 станций и немного помех, как в 2004-м.' },
  { id: 'recorder', name: 'Диктофон', cat: 'Инструменты', price: 0, rating: 4.3, size: 22, emoji: '🎙️', color: '#f87171', desc: 'Записывай голосовые заметки прямо в браузере.' },
  { id: 'nova-mail', name: 'Nova Почта', cat: 'Общение', price: 0, rating: 4.2, size: 44, emoji: '✉️', color: '#38bdf8', desc: 'Почта с умной сортировкой и 147 письмами о скидках.' },
  { id: 'maps', name: 'Карты Брюсселя', cat: 'Путешествия', price: 0, rating: 4.0, size: 96, emoji: '🗺️', color: '#4ade80', desc: 'Оффлайн-карты, пробки и 3 маршрута до дома.' },
  { id: 'translate', name: 'Переводчик', cat: 'Инструменты', price: 0, rating: 4.7, size: 31, emoji: '🌍', color: '#22d3ee', desc: 'Переводит с любого языка на «ну ты понял».' },
  { id: 'fit', name: 'Nova Фитнес', cat: 'Здоровье', price: 0, rating: 3.8, size: 58, emoji: '🏃', color: '#fb923c', desc: 'Считает шаги, даже когда ты лежишь.' },
  { id: 'pizza', name: 'Пицца 24/7', cat: 'Еда', price: 0, rating: 4.5, size: 27, emoji: '🍕', color: '#ef4444', desc: 'Доставка за 30 минут или пицца в подарок.' },
  { id: 'taxi', name: 'Nova Taxi', cat: 'Транспорт', price: 0, rating: 4.1, size: 39, emoji: '🚕', color: '#facc15', desc: 'Машина приедет через 4 минуты. Наверное.' },
  { id: 'chess', name: 'Шахматы', cat: 'Игры', price: 1.99, rating: 4.8, size: 15, emoji: '♟️', color: '#94a3b8', desc: 'Играй с ботом, который поддавливается.' },
  { id: 'photo-editor', name: 'Фоторедактор Pro', cat: 'Фото', price: 3.49, rating: 4.4, size: 120, emoji: '🎨', color: '#a78bfa', desc: '48 фильтров и один, который действительно нужен.' },
  { id: 'medit', name: 'Спокойствие', cat: 'Здоровье', price: 2.99, rating: 4.9, size: 88, emoji: '🧘', color: '#2dd4bf', desc: 'Дыши. Вдох. Выдох. Уведомления подождут.' },
  { id: 'crypto', name: 'NovaCoin Кошелёк', cat: 'Финансы', price: 0, rating: 2.1, size: 64, emoji: '🪙', color: '#f59e0b', desc: 'Крипта растёт. Или падает. Мы не знаем.' },
  { id: 'vpn', name: 'VPN Быстрый', cat: 'Инструменты', price: 4.99, rating: 3.2, size: 41, emoji: '🛡️', color: '#6366f1', desc: 'Меняет страну на «Нидерланды» и всё.' },
  { id: 'game2048', name: '2048', cat: 'Игры', price: 0, rating: 4.6, size: 9, emoji: '🔢', color: '#f97316', desc: 'Соединяй плитки до победного.' },
  { id: 'karaoke', name: 'Караоке', cat: 'Развлечения', price: 0, rating: 3.5, size: 210, emoji: '🎤', color: '#ec4899', desc: '10 000 песен. Соседи будут в курсе.' },
  { id: 'astro', name: 'Гороскоп дня', cat: 'Развлечения', price: 0, rating: 2.8, size: 14, emoji: '🔮', color: '#8b5cf6', desc: 'Сегодня вам повезёт. Источник: звёзды.' },
  { id: 'battery-doc', name: 'Доктор Батареи', cat: 'Инструменты', price: 1.49, rating: 4.0, size: 19, emoji: '🩺', color: '#10b981', desc: 'Покажет, что батарея в порядке. За деньги.' }
];

export function appMeta(id) {
  return APPS[id] || { name: id, color: 'linear-gradient(135deg,#64748b,#334155)', icon: ICON.info(), emoji: false };
}
