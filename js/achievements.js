import { getState, save } from './state.js';
import { emit, EV } from './bus.js';
import { SFX } from './audio.js';

export const ACHIEVEMENTS = [
  { id: 'unbox', icon: '📦', name: 'Распаковка', desc: 'Открыть коробку с новым телефоном' },
  { id: 'film', icon: '✨', name: 'Свежий экран', desc: 'Снять защитную плёнку одним движением' },
  { id: 'sim', icon: '📶', name: 'Поехали!', desc: 'Установить SIM-карту' },
  { id: 'tariff', icon: '💳', name: 'Абонент', desc: 'Выбрать оператора и тариф' },
  { id: 'boot', icon: '⚡', name: 'Первый запуск', desc: 'Включить телефон впервые' },
  { id: 'setup', icon: '🧭', name: 'Готов к работе', desc: 'Пройти первоначальную настройку' },
  { id: 'wifi', icon: '📡', name: 'Домашняя сеть', desc: 'Подключиться к Wi-Fi' },
  { id: 'unlock', icon: '🔓', name: 'Разблокировано', desc: 'Разблокировать экран' },
  { id: 'shade', icon: '🔔', name: 'Шторка', desc: 'Открыть панель уведомлений' },
  { id: 'qs', icon: '🎛️', name: 'Переключатель', desc: 'Воспользоваться быстрой настройкой' },
  { id: 'msg', icon: '💬', name: 'Первое сообщение', desc: 'Отправить сообщение в мессенджере' },
  { id: 'chat10', icon: '🗣️', name: 'Болтун', desc: 'Отправить 10 сообщений' },
  { id: 'mom', icon: '❤️', name: 'Хороший сын', desc: 'Ответить маме' },
  { id: 'call', icon: '📞', name: 'Алло', desc: 'Совершить первый звонок' },
  { id: 'photo', icon: '📸', name: 'Фотограф', desc: 'Сделать первое фото' },
  { id: 'photo10', icon: '🖼️', name: 'Альбом', desc: 'Сделать 10 фото' },
  { id: 'selfie', icon: '🤳', name: 'Селфи', desc: 'Сфотографировать себя на фронтальную камеру' },
  { id: 'video', icon: '🎥', name: 'Режиссёр', desc: 'Записать видео' },
  { id: 'internet', icon: '🌐', name: 'В сети', desc: 'Открыть сайт в браузере' },
  { id: 'search', icon: '🔎', name: 'Искатель', desc: 'Что-то поискать в Nova Search' },
  { id: 'shop', icon: '🛒', name: 'Шопоголик', desc: 'Купить что-то в TechShop' },
  { id: 'bank', icon: '🏦', name: 'Финансист', desc: 'Отправить перевод' },
  { id: 'music', icon: '🎵', name: 'Меломан', desc: 'Включить музыку' },
  { id: 'alarm', icon: '⏰', name: 'Ранняя пташка', desc: 'Поставить будильник' },
  { id: 'note', icon: '📝', name: 'Память', desc: 'Создать заметку' },
  { id: 'snake', icon: '🐍', name: 'Змеелов', desc: 'Набрать 20 очков в змейке' },
  { id: 'charge', icon: '🔌', name: 'На проводе', desc: 'Подключить зарядку' },
  { id: 'fullcharge', icon: '🔋', name: '100%', desc: 'Зарядить телефон полностью' },
  { id: 'dead', icon: '🪫', name: 'Разрядился', desc: 'Довести батарею до нуля' },
  { id: 'flash', icon: '🔦', name: 'Фонарик', desc: 'Включить фонарик' },
  { id: 'airplane', icon: '✈️', name: 'В полёте', desc: 'Включить режим полёта' },
  { id: 'dnd', icon: '🌙', name: 'Тишина', desc: 'Включить «не беспокоить»' },
  { id: 'dark', icon: '🌑', name: 'Ночной режим', desc: 'Переключить тему оформления' },
  { id: 'wall', icon: '🎨', name: 'Дизайнер', desc: 'Сменить обои' },
  { id: 'fp', icon: '👆', name: 'Отпечаток', desc: 'Зарегистрировать отпечаток пальца' },
  { id: 'spam', icon: '🚫', name: 'Бдительность', desc: 'Заблокировать спам-номер' },
  { id: 'install', icon: '📲', name: 'Установка', desc: 'Установить приложение из Nova Store' },
  { id: 'reboot', icon: '🔄', name: 'Перезагрузка', desc: 'Перезагрузить телефон' },
  { id: 'night', icon: '🌃', name: 'Полуночник', desc: 'Сидеть в телефоне после 00:00' },
  { id: 'rich', icon: '💰', name: 'Транжира', desc: 'Потратить 100 € в интернете' }
];

export function unlock(id, titleOverride, descOverride) {
  const S = getState();
  if (!S || S.achievements[id]) return false;
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  S.achievements[id] = Date.now();
  save();
  emit(EV.ACH, { id, a });
  SFX.achieve();
  window.__toast?.(a?.icon || '🏆', titleOverride || a?.name || 'Достижение', descOverride || a?.desc || '');
  return true;
}

export function has(id) { return !!getState()?.achievements[id]; }
export function progress() {
  const S = getState();
  const got = Object.keys(S.achievements).length;
  return { got, total: ACHIEVEMENTS.length };
}
