import { getState, save, completeTask, WIFI_NETWORKS } from './state.js';
import { on, EV, emit } from './bus.js';
import { api } from './api.js';
import { ICON } from './icons.js';
import { SFX } from './audio.js';
import { unlock } from './achievements.js';
import { $, el, clear, fmtTime, fmtDateFull, clamp, drag, pad2 } from './util.js';
import { removeNotif, clearAllNotifs, vibrate, appLabel } from './notify.js';
import { toast, sysDialog } from './ui.js';

let shade, panel, backdrop, open = false, prog = 0;

export function initShade() {
  shade = $('#shade');
  backdrop = el('div', { class: 'shade__backdrop' });
  panel = el('div', { class: 'shade__panel' });
  shade.append(backdrop, panel);

  // перетаскивание панели
  let dragging = false;
  const startDrag = (y) => { dragging = true; shade.style.transition = 'none'; };
  backdrop.addEventListener('click', () => close());

  document.getElementById('statusbar').addEventListener('pointerdown', (e) => {
    const S = getState();
    if (!S.phone.awake || S.stage !== 'ready') return;
    startDrag(e.clientY);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const h = shade.clientHeight || 640;
    prog = clamp(e.clientY / (h * 0.55), 0, 1);
    apply();
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    shade.style.transition = '';
    if (prog > 0.45) openShade(); else close();
  });

  // свайп сверху по экрану
  const screen = $('#screen');
  let sy = null;
  screen.addEventListener('pointerdown', (e) => {
    const S = getState();
    if (!S.phone.awake || S.stage !== 'ready') { sy = null; return; }
    const r = screen.getBoundingClientRect();
    sy = (e.clientY - r.top) < 40 ? e.clientY : null;
  });
  screen.addEventListener('pointermove', (e) => {
    if (sy === null) return;
    const dy = e.clientY - sy;
    if (dy > 34) { sy = null; openShade(); }
  });
  screen.addEventListener('pointerup', () => { sy = null; });

  on(EV.NOTIF, () => { if (open) render(); });
  on(EV.NOTIF_CLEAR, () => { if (open) render(); });
  on(EV.TIME, () => { if (open) renderMini(); });
  on(EV.SETTINGS, () => { if (open) render(); });
  on(EV.BATTERY, () => { if (open) renderMini(); });
  on(EV.NET, () => { if (open) render(); });
}

function apply() {
  panel.style.transform = `translateY(${(-1 + prog) * 100}%)`;
  backdrop.style.opacity = String(prog * 0.9);
  if (prog > 0.02) shade.classList.add('open');
}

export function openShade() {
  const S = getState();
  if (!S.phone.awake) return;
  open = true; prog = 1;
  shade.classList.add('open');
  shade.style.transition = '';
  render();
  apply();
  SFX.shade();
  completeTask('t11');
  unlock('shade');
  window.__activity?.();
}
export function closeShade() { close(); }
export function toggleShade() { open ? close() : openShade(); }
export function isShadeOpen() { return open; }

function close() {
  if (!open) { prog = 0; apply(); shade.classList.remove('open'); return; }
  open = false;
  shade.style.transition = 'transform .3s cubic-bezier(.3,1,.4,1)';
  prog = 0;
  panel.style.transition = 'transform .32s cubic-bezier(.3,1,.4,1)';
  backdrop.style.transition = 'opacity .3s';
  apply();
  setTimeout(() => { shade.classList.remove('open'); panel.style.transition = ''; backdrop.style.transition = ''; }, 330);
  SFX.shade();
}

/* ======================= РЕНДЕР ======================= */
const TILES = [
  { id: 'data', label: 'Интернет', icon: () => ICON.data(), get: (p) => p.data.on && p.sim.inserted && !!p.sim.operator,
    disabled: (p) => !p.sim.inserted || p.airplane,
    set: (p, v) => { p.data.on = v; if (v) p.airplane = false; } },
  { id: 'wifi', label: 'Wi-Fi', icon: () => ICON.wifi(3), get: (p) => p.wifi.on, disabled: (p) => p.airplane,
    set: (p, v) => { p.wifi.on = v; if (!v) p.wifi.ssid = null; } },
  { id: 'bt', label: 'Bluetooth', icon: () => ICON.bt(), get: (p) => p.bt.on, disabled: (p) => p.airplane,
    set: (p, v) => { p.bt.on = v; if (!v) p.bt.connected = null; } },
  { id: 'airplane', label: 'В самолёте', icon: () => ICON.airplane(), get: (p) => p.airplane,
    set: (p, v) => {
      p.airplane = v;
      if (v) { p.wifi.on = false; p.wifi.ssid = null; p.bt.on = false; p.data.on = false; unlock('airplane'); }
      else if (p.sim.inserted) p.data.on = true;
    } },
  { id: 'dnd', label: 'Не беспокоить', icon: () => ICON.dnd(), get: (p) => p.dnd, set: (p, v) => { p.dnd = v; if (v) unlock('dnd'); } },
  { id: 'flash', label: 'Фонарик', icon: () => ICON.flashlight(true), get: (p) => p.flashlight,
    set: (p, v) => { p.flashlight = v; document.getElementById('flash-beam')?.classList.toggle('on', v); if (v) { unlock('flash'); toast('🔦', 'Фонарик включён', 'Свет падает на стол — батарея садится быстрее'); } } },
  { id: 'rotate', label: 'Автоповорот', icon: () => ICON.rotate(), get: (p) => p.rotation, set: (p, v) => { p.rotation = v; } },
  { id: 'dark', label: 'Тёмная тема', icon: () => ICON.moon(), get: (p) => p.theme === 'dark',
    set: (p, v) => { p.theme = v ? 'dark' : 'light'; if (v) unlock('dark'); emit(EV.THEME, p.theme); } },
  { id: 'hotspot', label: 'Точка доступа', icon: () => ICON.hotspot(), get: (p) => p.hotspot,
    disabled: (p) => !p.data.on || p.airplane,
    set: (p, v) => { p.hotspot = v; if (v) toast('📡', 'Точка доступа включена', 'Сеть: NOVA-X5-Pro · пароль: 12345678'); } },
  { id: 'saver', label: 'Экономия', icon: () => ICON.batterySaver(), get: (p) => !!p.saver,
    set: (p, v) => { p.saver = v; toast('🔋', v ? 'Экономия заряда включена' : 'Экономия выключена', v ? 'Экран темнее, фоновые данные ограничены' : ''); } },
  { id: 'loc', label: 'Геолокация', icon: () => ICON.location(), get: (p) => p.location !== false, set: (p, v) => { p.location = v; } },
  { id: 'silent', label: 'Без звука', icon: () => ICON.volMute(), get: (p) => p.volume.ring === 0,
    set: (p, v) => { p.volume.ring = v ? 0 : (p.lastRing ?? 70); p.lastRing = p.volume.ring || 70; } }
];

function render() {
  const S = getState();
  const p = S.phone;
  clear(panel);
  panel.append(el('div', { class: 'shade__handle' }));

  const scroll = el('div', { class: 'shade__scroll' });

  // шапка
  const head = el('div', { class: 'shade__head' });
  const clockWrap = el('div');
  clockWrap.append(el('div', { class: 'shade__clock', id: 'shade-clock', text: fmtTime() }));
  clockWrap.append(el('div', { class: 'shade__date', id: 'shade-date', text: fmtDateFull() }));
  head.append(clockWrap);
  const batt = el('div', { class: 'shade__batt-mini', id: 'shade-batt' });
  head.append(batt);
  const acts = el('div', { class: 'shade__head-actions' });
  acts.append(iconBtn(ICON.settings(), () => { close(); api.openApp('settings'); }));
  acts.append(iconBtn(ICON.power(), () => { close(); window.__powerMenu?.(); }));
  head.append(acts);
  scroll.append(head);
  renderBattMini(batt);

  // быстрые настройки
  const grid = el('div', { class: 'qs-grid' });
  TILES.forEach((t) => {
    const isOn = !!t.get(p);
    const dis = t.disabled?.(p);
    const tile = el('div', {
      class: 'qs-tile' + (isOn ? ' on' : '') + (dis ? ' disabled' : ''),
      title: t.label,
      onclick: () => {
        if (dis) {
          SFX.error();
          if (t.id === 'data') toast('📶', 'Нет SIM-карты', 'Установи SIM-карту: скрепка → лоток → SIM');
          return;
        }
        t.set(p, !isOn);
        SFX.tap();
        vibrate(10);
        unlock('qs');
        save();
        emit(EV.SETTINGS, t.id);
        render();
      }
    });
    tile.innerHTML = t.icon();
    tile.append(el('span', { text: t.label }));
    if (t.id === 'wifi' && p.wifi.ssid) tile.append(el('i', { class: 'dot' }));
    if (t.id === 'data' && p.data.on) tile.append(el('i', { class: 'dot' }));
    grid.append(tile);
  });
  scroll.append(grid);

  // яркость
  const br = el('div', { class: 'qs-slider' });
  br.innerHTML = ICON.brightness();
  const brInput = el('input', { class: 'slider', type: 'range', min: '5', max: '100', value: String(p.brightness) });
  brInput.addEventListener('input', () => {
    p.brightness = +brInput.value;
    p.autoBrightness = false;
    applyBrightness();
    save();
    unlock('qs');
  });
  br.append(brInput);
  const autoBtn = el('button', {
    class: 'chip' + (p.autoBrightness ? ' on' : ''), text: 'A', title: 'Автояркость',
    style: { flex: '0 0 auto', width: '32px', height: '32px', padding: '0', justifyContent: 'center' },
    onclick: () => { p.autoBrightness = !p.autoBrightness; save(); render(); }
  });
  br.append(autoBtn);
  scroll.append(br);

  // громкость
  const vol = el('div', { class: 'qs-slider' });
  vol.innerHTML = p.volume.ring === 0 ? ICON.volMute() : ICON.volUp();
  const volInput = el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(p.volume.ring) });
  volInput.addEventListener('input', () => {
    p.volume.ring = +volInput.value;
    p.volume.media = Math.max(p.volume.media, p.volume.ring);
    save();
    vol.querySelector('svg')?.remove();
    vol.insertAdjacentHTML('afterbegin', p.volume.ring === 0 ? ICON.volMute() : ICON.volUp());
  });
  vol.append(volInput);
  scroll.append(vol);

  // уведомления
  scroll.append(el('div', { class: 'shade__divider' }));
  const sec = el('div', { class: 'shade__sec' });
  sec.append(el('b', { text: `Уведомления (${S.notifications.length})` }));
  if (S.notifications.length) {
    sec.append(el('button', { text: 'Очистить всё', onclick: () => { clearAllNotifs(); SFX.tap(); render(); } }));
  }
  scroll.append(sec);

  if (!S.notifications.length) {
    scroll.append(el('div', { class: 'empty', style: { padding: '24px 10px' } },
      el('span', { class: 'big', text: '🌙' }), 'Нет уведомлений. Пока тишина — и это прекрасно.'));
  } else {
    S.notifications.forEach((n) => scroll.append(notifCard(n)));
  }

  panel.append(scroll);
}

function renderMini() {
  const c = $('#shade-clock', panel), d = $('#shade-date', panel), b = $('#shade-batt', panel);
  if (c) c.textContent = fmtTime();
  if (d) d.textContent = fmtDateFull();
  if (b) renderBattMini(b);
}
function renderBattMini(node) {
  const S = getState();
  const bt = S.phone.battery;
  clear(node);
  node.append(
    el('span', { text: `${Math.round(bt.pct)}%` }),
    el('span', { text: bt.charging ? '⚡ зарядка' : `${etaText(bt.pct)}`, style: { opacity: '.6', fontSize: '10.5px' } })
  );
}
function etaText(pct) {
  if (pct > 80) return 'почти полный';
  if (pct > 40) return 'ещё походит';
  if (pct > 15) return 'садится';
  return 'скоро сядет';
}

export function notifCard(n, opts = {}) {
  const S = getState();
  const card = el('div', { class: 'notif', dataset: { id: n.id } });
  card.append(el('div', { class: 'notif__ico', style: { background: n.color || '#38bdf8' }, text: n.icon || '🔔' }));
  const body = el('div', { class: 'notif__body' });
  const top = el('div', { class: 'notif__top' },
    el('span', { class: 'notif__app', text: appLabel(n.appId) }),
    el('span', { class: 'notif__time', text: fmtTime(new Date(n.at)) }));
  body.append(top);
  if (n.title) body.append(el('div', { class: 'notif__title', text: n.title }));
  if (n.text) body.append(el('div', { class: 'notif__text', text: n.text }));
  if (n.actions?.length) {
    const acts = el('div', { class: 'notif__actions' });
    n.actions.forEach((a) => acts.append(el('button', {
      text: a.label,
      onclick: (e) => { e.stopPropagation(); a.act?.(); }
    })));
    body.append(acts);
  }
  card.append(body);
  const x = el('button', { class: 'notif__x', text: '×', onclick: (e) => { e.stopPropagation(); dismiss(); } });
  card.append(x);
  card.addEventListener('click', () => {
    dismiss();
    api.openNotif(n);
  });

  function dismiss() {
    card.classList.add('removing');
    setTimeout(() => { removeNotif(n.id); if (open) render(); }, 240);
    SFX.tap();
  }
  return card;
}

function iconBtn(svg, onclick) {
  const b = el('button', { class: 'iconbtn', onclick });
  b.innerHTML = svg;
  return b;
}

export function applyBrightness() {
  const S = getState();
  const veil = $('#brightness-veil');
  if (!veil) return;
  let b = S.phone.brightness;
  if (S.phone.autoBrightness) {
    const d = new Date(S.time.gameMs).getHours();
    const night = d >= 22 || d < 7;
    b = night ? 32 : 78;
  }
  if (S.phone.saver) b = Math.min(b, 55);
  veil.style.opacity = String(clamp((100 - b) / 100, 0, 0.72) * 0.85);
}
