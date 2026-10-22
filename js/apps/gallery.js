import { getState, save, WALLPAPERS } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { el, clear, fmtTime, fmtDateShort, fmtSize, chatStamp, plural } from '../util.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';
import { avatar } from '../ui.js';
import { displayName } from '../state.js';
import { unlock } from '../achievements.js';

let inst = null, album = 'all', openId = null, shareTo = null;

export function mount(root, a, params) {
  inst = { root, api: a };
  shareTo = params?.shareTo || null;
  root.className = 'app theme-dark gallery';
  root.classList.toggle('theme-light', getState().phone.theme === 'light');
  if (shareTo) album = 'all';
  render();
  return {
    light: getState().phone.theme === 'light',
    onBack() {
      if (openId) { openId = null; render(); return true; }
      if (album !== 'all') { album = 'all'; render(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function photos() {
  const S = getState();
  let list = S.photos.slice();
  if (album === 'video') list = list.filter((p) => p.video);
  if (album === 'selfie') list = list.filter((p) => p.front);
  if (album === 'fav') list = list.filter((p) => p.fav);
  if (album === 'night') list = list.filter((p) => p.pod === 'night');
  return list.reverse();
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  if (openId) { renderView(openId); return; }

  const bar = el('div', { class: 'appbar' },
    el('h1', {}, el('span', { text: shareTo ? 'Выберите фото' : 'Галерея' }),
      el('span', { class: 'sub', text: `${S.photos.length} ${plural(S.photos.length, ['файл', 'файла', 'файлов'])} · ${fmtSize(S.photos.reduce((a, p) => a + p.sizeMb, 0))}` })));
  if (shareTo) {
    const c = S.contacts.find((x) => x.id === shareTo);
    const cancel = el('button', { class: 'btn btn--tiny', text: 'Отмена', onclick: () => api.back() });
    bar.append(el('div', { class: 'appbar__actions' }, cancel));
  }
  inst.root.append(bar);

  const tabs = el('div', { class: 'tabs' });
  [['all', 'Все'], ['photo', 'Фото'], ['video', 'Видео'], ['selfie', 'Селфи'], ['fav', 'Избранное']].forEach(([id, label]) => {
    tabs.append(el('button', { class: album === id ? 'on' : '', text: label, onclick: () => { album = id; SFX.tap(); render(); } }));
  });
  inst.root.append(tabs);

  const body = el('div', { class: 'appbody' });
  const list = photos();
  if (!list.length) {
    body.append(el('div', { class: 'empty' },
      el('span', { class: 'big', text: '📷' }),
      'Здесь пока пусто', el('br'),
      el('span', { style: { fontSize: '12px' }, text: 'Откройте «Камеру» и сделайте первый снимок — там есть 6 объектов съёмки и 6 режимов' })));
  } else {
    const grid = el('div', { class: 'gal-grid' });
    list.forEach((p) => {
      const item = el('div', { class: 'gal-item' + (p.video ? ' video' : '') });
      item.innerHTML = p.svg;
      if (p.fav) item.append(el('div', { class: 'gi-tag', text: '★' }));
      else item.append(el('div', { class: 'gi-tag', text: p.mode === 'night' ? '🌙' : p.front ? '🤳' : fmtTime(new Date(p.at)) }));
      item.addEventListener('click', () => { SFX.tap(); openId = p.id; render(); });
      grid.append(item);
    });
    body.append(grid);
  }
  inst.root.append(body);
}

function renderView(id) {
  const S = getState();
  const p = S.photos.find((x) => x.id === id);
  if (!p) { openId = null; render(); return; }
  const v = el('div', { class: 'gal-view' });

  const top = el('div', { class: 'gal-view__top' });
  const back = el('button', { class: 'iconbtn', onclick: () => { openId = null; SFX.back(); render(); } });
  back.innerHTML = ICON.back();
  top.append(back);
  top.append(el('b', { text: p.caption || `${p.sceneName}` }));
  const fav = el('button', { class: 'iconbtn', style: p.fav ? { color: '#facc15' } : {}, onclick: () => { p.fav = !p.fav; save(); render(); } });
  fav.innerHTML = ICON.star();
  top.append(fav);
  const more = el('button', { class: 'iconbtn', onclick: () => photoMenu(p) });
  more.innerHTML = ICON.more();
  top.append(more);
  v.append(top);

  const img = el('div', { class: 'gal-view__img' });
  const holder = el('div', { style: { width: '100%', height: '100%', display: 'grid', placeItems: 'center' } });
  holder.innerHTML = p.svg;
  img.append(holder);
  v.append(img);

  v.append(el('div', { class: 'gal-view__info', html:
    `${fmtTime(new Date(p.at))} · ${fmtDateShort(new Date(p.at))} · ${p.sizeMb.toFixed(1).replace('.', ',')} МБ<br/>` +
    `${p.mode === 'video' ? `🎥 видео ${Math.floor((p.duration || 0) / 60)}:${String((p.duration || 0) % 60).padStart(2, '0')} · 1080p 30fps` : `${p.front ? '🤳 фронтальная 32 МП' : '📷 108 МП'} · f/${p.f} · ISO ${p.iso} · ${p.exp}`}<br/>` +
    `режим «${({ photo: 'Фото', portrait: 'Портрет', video: 'Видео', night: 'Ночь', pano: 'Панорама', pro: 'Про' })[p.mode] || 'Фото'}» · зум ${p.zoom}× · ${p.pod === 'night' ? 'ночь' : p.pod === 'day' ? 'день' : p.pod === 'sunset' ? 'закат' : 'рассвет'}`
  }));

  const acts = el('div', { class: 'gal-view__actions' });
  const act = (svg, label, fn) => {
    const b = el('button', { onclick: fn });
    b.innerHTML = svg;
    b.append(el('span', { text: label }));
    return b;
  };
  acts.append(act(ICON.share(), 'Отправить', () => sharePhoto(p)));
  acts.append(act(ICON.gallery(), 'На обои', () => setAsWallpaper(p)));
  acts.append(act(ICON.edit(), 'Подпись', () => captionPhoto(p)));
  acts.append(act(ICON.trash(), 'Удалить', () => delPhoto(p)));
  v.append(acts);

  inst.root.append(v);
}

async function photoMenu(p) {
  const act = await sysDialog({
    title: p.sceneName, icon: '🖼️',
    text: `${fmtSize(p.sizeMb)} · ${fmtTime(new Date(p.at))}<br/>${p.caption || 'без подписи'}`,
    buttons: [
      { label: 'ℹ️ Свойства', value: 'info' },
      { label: '📋 Скопировать подпись', value: 'copy' },
      { label: '🖨️ Печать', value: 'print' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (act === 'info') await sysDialog({ title: 'Свойства файла', icon: 'ℹ️', text: `IMG_${p.id.slice(-6).toUpperCase()}.jpg<br/>Размер: ${p.sizeMb.toFixed(1)} МБ<br/>Разрешение: ${p.front ? '3264 × 2448' : '12032 × 9024'}<br/>ISO: ${p.iso} · Выдержка: ${p.exp} · Диафрагма: f/${p.f}<br/>Дата: ${new Date(p.at).toLocaleString('ru-RU')}` });
  if (act === 'copy') { toast('📋', 'Скопировано', p.caption || p.sceneName); }
  if (act === 'print') { toast('🖨️', 'Печать…', 'Принтер не найден. Как и в реальной жизни.'); }
}

async function sharePhoto(p) {
  const S = getState();
  if (shareTo) {
    const { sharePhotoTo } = await import('./messages.js');
    sharePhotoTo(shareTo, p);
    api.openApp('messages', { chat: shareTo });
    return;
  }
  const list = S.contacts.filter((c) => c.phone || c.messenger);
  const res = await sysDialog({
    title: 'Отправить фото', icon: '📤',
    text: list.slice(0, 6).map((c, i) => `${i + 1}. ${displayName(c)}`).join('<br/>'),
    input: { placeholder: 'Имя контакта' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Отправить', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const c = list.find((x) => displayName(x).toLowerCase().includes(q)) || list[0];
  const { sharePhotoTo } = await import('./messages.js');
  sharePhotoTo(c.id, p);
  api.openApp('messages', { chat: c.id });
}

async function setAsWallpaper(p) {
  const S = getState();
  const act = await sysDialog({
    title: 'Поставить на обои', icon: '🎨',
    text: 'Куда применить это изображение?',
    buttons: [
      { label: 'Домашний экран', value: 'home', cls: 'primary' },
      { label: 'Экран блокировки', value: 'lock', cls: 'primary' },
      { label: 'Оба', value: 'both', cls: 'primary' },
      { label: 'Отмена', value: null }
    ]
  });
  if (!act) return;
  const css = `url("data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}") center/cover no-repeat`;
  if (act === 'home' || act === 'both') {
    S.phone.wallpaper = 'custom:' + p.id;
    S.flags.customWall = S.flags.customWall || {};
    S.flags.customWall.home = css;
  }
  if (act === 'lock' || act === 'both') {
    S.phone.lockWallpaper = 'custom:' + p.id;
    S.flags.customWall = S.flags.customWall || {};
    S.flags.customWall.lock = css;
  }
  save();
  emit(EV.THEME);
  api.refreshHome();
  unlock('wall');
  toast('🎨', 'Обои обновлены', 'Ваше фото теперь на экране');
}

async function captionPhoto(p) {
  const res = await sysDialog({
    title: 'Подпись к фото', icon: '✏️',
    input: { placeholder: 'Например: мой новый телефон', value: p.caption || '' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Сохранить', value: true, cls: 'primary' }]
  });
  if (res === null || res === false) return;
  p.caption = String(res).slice(0, 60);
  save(); render();
  toast('✏️', 'Подпись сохранена', p.caption);
}

async function delPhoto(p) {
  const ok = await sysDialog({
    title: 'Удалить файл?', icon: '🗑️',
    text: `${p.sceneName} · ${p.sizeMb.toFixed(1)} МБ<br/>Действие необратимо.`,
    buttons: [{ label: 'Отмена', value: false }, { label: 'Удалить', value: true, cls: 'danger' }]
  });
  if (!ok) return;
  const S = getState();
  S.photos = S.photos.filter((x) => x.id !== p.id);
  S.phone.storage.photos = Math.max(0, S.phone.storage.photos - p.sizeMb / 1024);
  save();
  openId = null;
  render();
  SFX.click();
  toast('🗑️', 'Файл удалён', `Освобождено ${p.sizeMb.toFixed(1)} МБ`);
}
