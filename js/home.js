import { getState, save, completeTask, WALLPAPERS, ACCENTS, FONTS } from './state.js';
import { on, EV, emit } from './bus.js';
import { api } from './api.js';
import { APPS, HOME_LAYOUT, DOCK, appMeta } from './registry.js';
import { ICON } from './icons.js';
import { SFX } from './audio.js';
import { $, el, clear, onLongPress, clamp, fmtTime, pad2, plural } from './util.js';
import { badgeCount } from './notify.js';
import { today, hours } from './weather.js';
import { toast } from './ui.js';
import { unlock } from './achievements.js';

let homeLayer, page = 0, drawerOpen = false;
let pages = [];

export function initHome() {
  homeLayer = $('#layer-home');
  on(EV.STATE, () => { if (isHomeVisible()) render(); });
  on(EV.MESSAGE, () => render());
  on(EV.NOTIF, () => render());
  on(EV.NOTIF_CLEAR, () => render());
  on(EV.THEME, () => { render(); applyTheme(); });
  on(EV.TIME, () => { if (isHomeVisible()) tickWidgets(); });
  on('music-changed', () => { if (isHomeVisible()) render(); });

  // жесты на домашнем экране
  let sx = null, sy = null, sy2 = null;
  homeLayer.addEventListener('pointerdown', (e) => {
    const S = getState();
    if (!S.phone.awake || S.phone.locked) return;
    sx = e.clientX; sy = e.clientY;
    const r = homeLayer.getBoundingClientRect();
    sy2 = (r.bottom - e.clientY) < 40 ? e.clientY : null;
  });
  homeLayer.addEventListener('pointerup', (e) => {
    const S = getState();
    if (!S.phone.awake || S.phone.locked) { sx = null; return; }
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) nextPage(); else prevPage();
      return;
    }
    if (sy2 !== null && dy < -60) { openDrawer(); sy2 = null; }
  });
  homeLayer.addEventListener('pointercancel', () => { sx = null; });

  onLongPress(homeLayer, () => {
    const S = getState();
    if (!S.phone.awake || S.phone.locked || api.currentApp?.()) return;
    homeLongPress();
  }, null, 620);

  applyTheme();
  render();
}

export function isHomeVisible() {
  const S = getState();
  return S.phone.awake && !S.phone.locked && !api.currentApp?.() && S.stage === 'ready';
}

export function applyTheme() {
  const S = getState();
  const p = S.phone;
  const screen = $('#screen');
  screen?.classList.toggle('theme-light', p.theme === 'light');
  screen?.classList.toggle('theme-dark', p.theme !== 'light');
  const accent = ACCENTS.find((a) => a.id === p.accent)?.hex || '#38bdf8';
  document.documentElement.style.setProperty('--accent-app', accent);
  document.documentElement.style.setProperty('--phone-accent', accent);
  const f = FONTS.find((x) => x.id === p.fontScale)?.scale ?? 1;
  screen?.style.setProperty('font-size', (16 * f) + 'px');
  document.getElementById('phone')?.style.setProperty('--phone-accent', accent);
}

export function wallpaperCss(id) {
  return WALLPAPERS.find((w) => w.id === id)?.css || WALLPAPERS[0].css;
}

/* ======================= РЕНДЕР ======================= */
export function render() {
  const S = getState();
  if (S.stage !== 'ready' || !S.phone.setupDone) return;
  clear(homeLayer);

  const home = el('div', { class: 'home' });
  home.style.background = wallpaperCss(S.phone.wallpaper);

  // строка поиска
  const search = el('div', { class: 'home__search', onclick: () => openDrawer(true) });
  search.innerHTML = ICON.search();
  search.append(el('span', { text: 'Поиск приложений и в интернете' }));
  home.append(search);

  // страницы
  const pagesWrap = el('div', { class: 'home__pages' });
  pages = HOME_LAYOUT.map((items, idx) => {
    const pg = el('div', { class: 'home__page', dataset: { idx: String(idx) } });
    pg.style.transform = `translateX(${(idx - page) * 100}%)`;
    pg.style.opacity = idx === page ? '1' : '0';
    items.forEach((it) => {
      if (it.type === 'widget') {
        if (it.id === 'weather') pg.append(weatherWidget());
        if (it.id === 'music' && S.music.playing) pg.append(musicWidget());
      } else if (it.type === 'app') {
        const meta = APPS[it.id];
        if (!meta) return;
        if (meta.storeOnly && !S.store.installed.includes(it.id)) return;
        pg.append(iconEl(it.id, meta));
      } else if (it.type === 'folder') {
        pg.append(folderEl(it));
      }
    });
    pagesWrap.append(pg);
    return pg;
  });
  home.append(pagesWrap);

  // точки
  const dots = el('div', { class: 'home__dots' });
  HOME_LAYOUT.forEach((_, i) => {
    dots.append(el('i', { class: i === page ? 'on' : '', onclick: () => gotoPage(i) }));
  });
  dots.append(el('i', { class: '', title: 'Все приложения', text: '⋯', style: { background: 'none', fontSize: '13px', lineHeight: '1', color: '#fff', width: '14px' }, onclick: () => openDrawer() }));
  home.append(dots);

  // док
  const dock = el('div', { class: 'home__dock' });
  DOCK.forEach((id) => dock.append(iconEl(id, APPS[id], true)));
  home.append(dock);

  homeLayer.append(home);
  if (drawerOpen) openDrawer(drawerOpen === 'focus');
}

function iconEl(id, meta, inDock = false) {
  const S = getState();
  const n = el('div', { class: 'hicon', dataset: { app: id } });
  const img = el('div', { class: 'hicon__img', style: { background: meta.color } });
  if (meta.emoji) img.append(el('span', { class: 'emoji', text: meta.icon }));
  else img.innerHTML = meta.icon;
  n.append(img);
  n.append(el('div', { class: 'hicon__name', text: meta.name }));

  const count = badgeCount(id);
  if (count > 0) {
    n.append(el('div', { class: 'hicon__badge' },
      el('div', { class: 'badge', text: count > 99 ? '99+' : String(count) })));
  }
  n.addEventListener('click', (e) => {
    const r = n.getBoundingClientRect();
    const sr = $('#screen').getBoundingClientRect();
    SFX.open();
    window.__activity?.();
    api.openApp(id, {}, { ox: `${((r.left + r.width / 2 - sr.left) / sr.width) * 100}%`, oy: `${((r.top + r.height / 2 - sr.top) / sr.height) * 100}%` });
  });
  onLongPress(n, () => appContextMenu(id, meta), null, 520);
  return n;
}

function folderEl(f) {
  const n = el('div', { class: 'hicon' });
  const box = el('div', { class: 'hicon__img' });
  const inner = el('div', { class: 'hicon__folder' });
  f.items.slice(0, 9).forEach((id) => {
    const m = appMeta(id);
    inner.append(el('div', { class: 'fi', style: { background: m.color }, text: m.emoji ? m.icon : '' , html: m.emoji ? '' : m.icon }));
  });
  box.append(inner);
  n.append(box, el('div', { class: 'hicon__name', text: f.name }));
  n.addEventListener('click', () => toast('📁', f.name, 'Папка откроется в следующей версии NovaOS'));
  return n;
}

/* ---------- виджеты ---------- */
function weatherWidget() {
  const t = today();
  const night = new Date(getState().time.gameMs).getHours() >= 21 || new Date(getState().time.gameMs).getHours() < 6;
  const w = el('div', { class: 'home__widget', onclick: () => api.openApp('weather') });
  w.append(el('div', { class: 'w-ico', text: night && t.cond.id === 'sun' ? '🌙' : t.cond.icon }));
  const mid = el('div');
  mid.append(el('div', { class: 'w-temp', text: `${t.temp}°` }));
  mid.append(el('div', { class: 'w-city', text: t.city }));
  w.append(mid);
  const right = el('div', { class: 'w-right' });
  right.append(el('div', { text: t.cond.name }));
  right.append(el('div', { text: `макс ${t.max}° · мин ${t.min}°` }));
  right.append(el('div', { text: `💨 ${t.wind} м/с · 💧 ${t.hum}%` }));
  w.append(right);
  return w;
}

function musicWidget() {
  const S = getState();
  const t = S.music.tracks.find((x) => x.id === S.music.trackId) || S.music.tracks[0];
  const w = el('div', { class: 'home__widget w-music', onclick: () => api.openApp('music') });
  w.append(el('div', {
    class: 'w-ico', text: t.emoji,
    style: { width: '46px', height: '46px', borderRadius: '13px', background: `linear-gradient(135deg,${t.color},#111)`, display: 'grid', placeItems: 'center', fontSize: '23px' }
  }));
  const mid = el('div');
  mid.append(el('div', { class: 'w-title', text: t.title }));
  mid.append(el('div', { class: 'w-artist', text: t.artist }));
  w.append(mid);
  const btns = el('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } });
  const playBtn = el('button', {
    style: { width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center' },
    onclick: (e) => { e.stopPropagation(); api.toggleMusic?.(); render(); }
  });
  playBtn.innerHTML = S.music.playing ? ICON.pause() : ICON.play();
  playBtn.querySelector('svg').setAttribute('style', 'width:18px;height:18px');
  btns.append(playBtn);
  w.append(btns);
  return w;
}

function tickWidgets() {
  const S = getState();
  if (!isHomeVisible()) return;
  // обновляем время в виджетах/доме (перерисовка раз в игровую минуту)
}

/* ---------- страницы ---------- */
export function gotoPage(i) {
  page = clamp(i, 0, HOME_LAYOUT.length - 1);
  pages.forEach((pg, idx) => {
    pg.style.transform = `translateX(${(idx - page) * 100}%)`;
    pg.style.opacity = idx === page ? '1' : '0';
  });
  const dots = homeLayer.querySelectorAll('.home__dots i');
  dots.forEach((d, idx) => d.classList.toggle('on', idx === page));
  SFX.tap();
}
export const nextPage = () => gotoPage(page + 1);
export const prevPage = () => gotoPage(page - 1);

/* ---------- меню приложений ---------- */
export function openDrawer(focusSearch = false) {
  if (drawerOpen) return;
  drawerOpen = focusSearch ? 'focus' : true;
  const S = getState();
  const d = el('div', { class: 'drawer' });
  const searchBox = el('div', { class: 'drawer__search' });
  searchBox.innerHTML = ICON.search();
  const input = el('input', { type: 'text', placeholder: 'Поиск приложений' });
  searchBox.append(input);
  d.append(searchBox);
  const grid = el('div', { class: 'drawer__grid' });
  d.append(grid);

  const list = () => {
    const q = input.value.trim().toLowerCase();
    clear(grid);
    const all = Object.entries(APPS)
      .filter(([id, m]) => !m.storeOnly || S.store.installed.includes(id))
      .filter(([id, m]) => !q || m.name.toLowerCase().includes(q))
      .sort((a, b) => a[1].name.localeCompare(b[1].name, 'ru'));
    let letter = '';
    all.forEach(([id, m]) => {
      const l = m.name[0].toUpperCase();
      if (l !== letter) { letter = l; grid.append(el('div', { class: 'drawer__letter', text: letter })); }
      grid.append(iconEl(id, m));
    });
    if (!all.length) grid.append(el('div', { class: 'empty', style: { gridColumn: 'span 4' }, text: `Ничего не нашлось по запросу «${input.value}»` }));
  };
  input.addEventListener('input', list);
  list();

  d.addEventListener('pointerdown', (e) => { if (e.target === d) closeDrawer(); });
  homeLayer.append(d);
  if (focusSearch === 'focus') setTimeout(() => input.focus(), 60);
  SFX.open();
}
export function closeDrawer() {
  drawerOpen = false;
  homeLayer.querySelector('.drawer')?.remove();
}
export function isDrawerOpen() { return !!drawerOpen; }

/* ---------- контекстные меню ---------- */
function appContextMenu(id, meta) {
  const S = getState();
  const sys = $('#syslayer');
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog', style: { maxWidth: '260px' } });
  box.append(el('div', { class: 'sysdialog__body' },
    el('div', { class: 'sysdialog__ico', text: meta.emoji ? meta.icon : '📱' }),
    el('div', { class: 'sysdialog__title', text: meta.name })
  ));
  const acts = el('div', { class: 'sysdialog__actions sysdialog__actions--stack', style: { display: 'flex', flexDirection: 'column', padding: '4px 10px 12px' } });
  const item = (label, fn) => acts.append(el('button', {
    text: label, style: { textAlign: 'left', padding: '11px 12px', borderRadius: '11px', fontSize: '13.4px' },
    onclick: () => { close(); fn(); },
    onmouseenter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,.08)',
    onmouseleave: (e) => e.currentTarget.style.background = 'none'
  }));
  item('Открыть', () => api.openApp(id));
  item('О приложении', () => api.openApp('store', { detail: id }));
  if (S.store.installed.includes(id)) item('Удалить', async () => {
    S.store.installed = S.store.installed.filter((x) => x !== id);
    save(); render();
    toast('🗑️', `${meta.name} удалено`, 'Место освобождено');
  });
  box.append(acts);
  back.append(box);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  sys.append(back);
  SFX.tap();
  vibrateShort();
  function close() { back.remove(); }
}

function vibrateShort() {
  const S = getState();
  if (!S.phone.vibrate) return;
  const ph = $('#phone');
  ph?.classList.remove('vibrate'); void ph?.offsetWidth; ph?.classList.add('vibrate');
}

function homeLongPress() {
  const sys = $('#syslayer');
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog' });
  box.append(el('div', { class: 'sysdialog__body' },
    el('div', { class: 'sysdialog__title', text: 'Домашний экран' }),
    el('div', { class: 'sysdialog__text', text: 'Что настроить?' })
  ));
  const acts = el('div', { class: 'sysdialog__actions sysdialog__actions--stack', style: { display: 'flex', flexDirection: 'column', padding: '4px 10px 12px' } });
  const item = (label, fn) => acts.append(el('button', {
    text: label, style: { textAlign: 'left', padding: '12px', borderRadius: '11px', fontSize: '13.6px' },
    onclick: () => { close(); fn(); },
    onmouseenter: (e) => e.currentTarget.style.background = 'rgba(255,255,255,.08)',
    onmouseleave: (e) => e.currentTarget.style.background = 'none'
  }));
  item('🎨 Обои', () => api.openApp('settings', { page: 'wallpaper' }));
  item('🌗 Тема и шрифт', () => api.openApp('settings', { page: 'display' }));
  item('🎛️ Быстрые настройки', () => api.openApp('settings'));
  item('ℹ️ О телефоне', () => api.openApp('settings', { page: 'about' }));
  box.append(acts);
  back.append(box);
  back.addEventListener('click', (e) => { if (e.target === back) close(); });
  sys.append(back);
  SFX.tap(); vibrateShort();
  function close() { back.remove(); }
}

/* ---------------- динамическая установка приложений ---------------- */
export function registerInstalledApp(catalogItem) {
  if (APPS[catalogItem.id]) return APPS[catalogItem.id];
  const meta = {
    name: catalogItem.name,
    color: `linear-gradient(135deg, ${catalogItem.color}, #1e293b)`,
    icon: catalogItem.emoji,
    emoji: true,
    storeOnly: true,
    mod: () => import('./apps/generic.js')
  };
  APPS[catalogItem.id] = meta;
  HOME_LAYOUT[1].push({ type: 'app', id: catalogItem.id });
  return meta;
}
