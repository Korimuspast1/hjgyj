import { getState, save, completeTask } from './state.js';
import { on, EV, emit } from './bus.js';
import { api } from './api.js';
import { ICON } from './icons.js';
import { SFX, RING } from './audio.js';
import { unlock } from './achievements.js';
import { $, el, clear, fmtTime, fmtDateFull, drag, holdProgress, clamp, fmtDateShort, plural } from './util.js';
import { notifCard } from './shade.js';
import { wallpaperCss } from './home.js';
import { toast } from './ui.js';

let layer, pinLayer = null, fpHold = null;

export function initLock() {
  layer = $('#layer-lock');
  on(EV.NOTIF, () => { if (getState().phone.locked) render(); });
  on(EV.NOTIF_CLEAR, () => { if (getState().phone.locked) render(); });
  on(EV.TIME, () => { if (getState().phone.locked && getState().phone.awake) renderClockOnly(); });
  on(EV.BATTERY, () => { if (getState().phone.locked && getState().phone.awake) render(); });
  on(EV.SETTINGS, () => { if (getState().phone.locked) render(); });
}

export function render() {
  const S = getState();
  clear(layer);
  layer.style.display = S.phone.locked && S.phone.awake ? '' : 'none';
  if (!S.phone.locked || !S.phone.awake) {
    // экран разблокирован/погас — PAD больше не нужен
    if (pinLayer) { pinLayer.remove(); pinLayer = null; }
    return;
  }

  const lock = el('div', { class: 'lock' });
  lock.style.background = wallpaperCss(S.phone.lockWallpaper || S.phone.wallpaper);

  const d = new Date(S.time.gameMs);
  const clock = el('div', { class: 'lock__clock', id: 'lock-clock', text: fmtTime(d) });
  const date = el('div', { class: 'lock__date', id: 'lock-date', text: fmtDateFull(d) });
  lock.append(clock, date);

  // статус-пилюли
  const st = el('div', { class: 'lock__status' });
  const p = S.phone;
  if (p.battery.charging) st.append(el('span', { class: 'pill', text: `⚡ ${Math.round(p.battery.pct)}% · зарядка` }));
  else st.append(el('span', { class: 'pill', text: `🔋 ${Math.round(p.battery.pct)}%` }));
  if (p.wifi.ssid) st.append(el('span', { class: 'pill', text: `📶 ${p.wifi.ssid}` }));
  else if (p.sim.inserted && p.sim.operator) st.append(el('span', { class: 'pill', text: `📡 ${p.sim.operator === 'mobiline' ? 'Mobiline' : 'Telka'} 5G` }));
  else st.append(el('span', { class: 'pill', text: '✈ нет сети' }));
  if (p.dnd) st.append(el('span', { class: 'pill', text: '🌙 не беспокоить' }));
  const alarmsOn = S.alarms.filter((a) => a.on);
  if (alarmsOn.length) st.append(el('span', { class: 'pill', text: `⏰ ${alarmsOn.map((a) => a.time).join(', ')}` }));
  lock.append(st);

  // уведомления
  const nl = el('div', { class: 'lock__notifs' });
  if (!S.notifications.length) {
    nl.append(el('div', {
      style: { textAlign: 'center', opacity: '.55', fontSize: '12.5px', padding: '26px 10px' },
      text: 'Нет уведомлений'
    }));
  } else {
    S.notifications.slice(0, 8).forEach((n) => nl.append(notifCard(n)));
  }
  lock.append(nl);

  // низ
  const bottom = el('div', { class: 'lock__bottom' });
  const quick = el('div', { class: 'lock__quick' });
  const camBtn = el('button', { title: 'Камера', onclick: () => { api.unlock(true); setTimeout(() => api.openApp('camera'), 220); } });
  camBtn.innerHTML = ICON.camera();
  const flashBtn = el('button', {
    class: p.flashlight ? 'on' : '', title: 'Фонарик',
    onclick: (e) => {
      p.flashlight = !p.flashlight;
      e.currentTarget.classList.toggle('on', p.flashlight);
      $('#flash-beam')?.classList.toggle('on', p.flashlight);
      SFX.click(); save(); emit(EV.SETTINGS);
      if (p.flashlight) unlock('flash');
    }
  });
  flashBtn.innerHTML = ICON.flashlight(p.flashlight);
  quick.append(camBtn, flashBtn);
  bottom.append(quick);

  bottom.append(el('div', { class: 'lock__hint' }, el('span', { html: ICON.swipeUp(), style: { display: 'flex' }, }), el('span', { text: S.phone.user.hasPin ? 'Свайп вверх — разблокировать' : 'Свайп вверх' })));
  lock.append(bottom);

  // свайп вверх
  let sy = null;
  lock.addEventListener('pointerdown', (e) => { sy = e.clientY; lock.style.transition = 'none'; });
  lock.addEventListener('pointermove', (e) => {
    if (sy === null) return;
    const dy = clamp(e.clientY - sy, -260, 0);
    lock.style.transform = `translateY(${dy}px)`;
    lock.style.opacity = String(1 + dy / 500);
  });
  const up = (e) => {
    if (sy === null) return;
    const dy = e.clientY - sy;
    sy = null;
    lock.style.transition = 'transform .3s cubic-bezier(.3,1,.4,1), opacity .3s';
    lock.style.transform = ''; lock.style.opacity = '';
    if (dy < -58) tryUnlock();
  };
  lock.addEventListener('pointerup', up);
  lock.addEventListener('pointercancel', () => { sy = null; lock.style.transform = ''; });

  layer.append(lock);
  // PIN-пад живёт поверх экрана блокировки и переживает его перерисовку
  if (pinLayer && !pinLayer.isConnected) layer.append(pinLayer);
}

function renderClockOnly() {
  const c = $('#lock-clock'), d = $('#lock-date');
  if (c) c.textContent = fmtTime();
  if (d) d.textContent = fmtDateFull();
}

export function tryUnlock() {
  const S = getState();
  if (S.phone.user.fp) { showPin(true); return; }
  if (S.phone.user.hasPin) showPin(false);
  else doUnlock();
}

export function doUnlock() {
  const S = getState();
  if (!S.phone.locked) return;
  S.phone.locked = false;
  S.stats.unlocks++;
  save();
  layer.style.display = 'none';
  clear(layer);
  SFX.click();
  unlock('unlock');
  emit(EV.SCREEN, 'unlock');
  window.__activity?.();
}

/* ---------------- PIN-пад ---------------- */
export function showPin(fpFirst = false) {
  const S = getState();
  if (pinLayer) return;
  let entered = '';
  pinLayer = el('div', { class: 'pinpad' });

  const title = el('div', { class: 'pinpad__title', text: 'Введите PIN-код' });
  const sub = el('div', { class: 'pinpad__sub', text: `PIN по умолчанию: ${S.phone.user.pin} · его можно сменить в Настройках → Безопасность` });
  const dots = el('div', { class: 'pinpad__dots' });
  for (let i = 0; i < 4; i++) dots.append(el('i'));

  const grid = el('div', { class: 'pinpad__grid' });
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  const letters = { 2: 'АБВГ', 3: 'ДЕЖЗ', 4: 'ИЙКЛ', 5: 'МНОП', 6: 'РСТУ', 7: 'ФХЦЧ', 8: 'ШЩЪЫ', 9: 'ЬЭЮЯ' };
  keys.forEach((k) => {
    grid.append(el('button', { class: 'pinpad__key', onclick: () => press(k) }, el('span', { text: k }), el('small', { text: letters[k] || '' })));
  });
  const fpBtn = el('button', { class: 'pinpad__key ghost', title: 'Отпечаток пальца' });
  fpBtn.innerHTML = ICON.fingerprint();
  grid.append(fpBtn);
  grid.append(el('button', { class: 'pinpad__key', onclick: () => press('0') }, el('span', { text: '0' }), el('small', { text: '+' })));
  const del = el('button', { class: 'pinpad__key ghost', text: '⌫', onclick: () => { entered = entered.slice(0, -1); SFX.tap(); upd(); } });
  grid.append(del);

  pinLayer.append(title, sub, dots, grid);

  // отпечаток
  if (S.phone.user.fp) {
    const fpHint = el('div', { class: 'pinpad__fp', text: 'или удерживайте палец на сканере' });
    pinLayer.append(fpHint);
    const hold = holdProgress(fpBtn, () => {
      fpBtn.classList.remove('hold');
      SFX.click();
      closePin();
      doUnlock();
    }, 900, (p) => {
      fpBtn.style.opacity = String(0.5 + p * 0.5);
      fpBtn.style.transform = `scale(${1 + p * 0.12})`;
      fpBtn.classList.toggle('hold', p > 0.02);
      if (p === 0) { fpBtn.style.opacity = ''; fpBtn.style.transform = ''; }
    });
  }

  const cancel = el('button', { class: 'pinpad__key ghost', text: 'Отмена', style: { width: 'auto', padding: '0 18px', height: '40px', borderRadius: '20px', fontSize: '12.5px', marginTop: '4px' }, onclick: closePin });
  pinLayer.append(cancel);
  layer.append(pinLayer);

  function press(k) {
    if (entered.length >= 4) return;
    entered += k;
    SFX.key();
    upd();
    if (entered.length === 4) setTimeout(check, 130);
  }
  function upd() {
    [...dots.children].forEach((d, i) => d.classList.toggle('filled', i < entered.length));
  }
  function check() {
    if (entered === S.phone.user.pin) {
      SFX.click();
      closePin();
      doUnlock();
    } else {
      SFX.error();
      pinLayer.classList.add('err');
      S.world.pinUsed = (S.world.pinUsed || 0) + 1;
      setTimeout(() => {
        pinLayer?.classList.remove('err');
        entered = '';
        upd();
        title.textContent = 'Неверный PIN-код';
        setTimeout(() => { if (pinLayer) title.textContent = 'Введите PIN-код'; }, 1600);
      }, 420);
    }
    save();
  }
  function closePin() { pinLayer?.remove(); pinLayer = null; }
  pinLayer._close = closePin;
}

export function closePinPad() { pinLayer?._close?.(); }

/* ---------------- Недавние приложения ---------------- */
export function renderRecents() {
  const S = getState();
  const layer = $('#layer-recents');
  clear(layer);
  const wrap = el('div', { class: 'recents' });
  const list = el('div', { class: 'recents__list' });

  const items = S.recents || [];
  if (!items.length) {
    wrap.append(el('div', { class: 'recents__empty' }, el('div', {}, 'Нет недавних приложений', el('br'), el('span', { style: { fontSize: '11.5px', opacity: '.7' }, text: 'Открой что-нибудь с домашнего экрана' }))));
  } else {
    items.slice().reverse().forEach((id) => {
      const meta = window.__appMeta?.(id) || { name: id, color: '#334155', icon: '📱', emoji: true };
      const card = el('div', { class: 'rcard', onclick: () => { api.hideRecents(); api.openApp(id); } });
      const head = el('div', { class: 'rcard__head' });
      head.append(el('div', { class: 'ic', style: { background: meta.color }, html: meta.emoji ? meta.icon : meta.icon }));
      head.append(el('b', { text: meta.name }));
      head.append(el('button', {
        text: '×', title: 'Закрыть',
        onclick: (e) => { e.stopPropagation(); api.killApp(id); renderRecents(); }
      }));
      card.append(head);
      card.append(el('div', { class: 'rcard__body', text: window.__appSnapshot?.(id) || `${meta.name} · свернуто` }));
      list.append(card);
    });
    wrap.append(list);
  }
  if (items.length) {
    const foot = el('div', { class: 'recents__foot' });
    foot.append(el('button', { class: 'btn btn--ghost', text: 'Очистить всё', onclick: () => { api.clearRecents(); renderRecents(); } }));
    wrap.append(foot);
  }
  layer.append(wrap);
}

export function hideRecentsLayer() {
  $('#layer-recents').hidden = true;
}
