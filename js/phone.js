import { getState, save, completeTask } from './state.js';
import { on, EV, emit } from './bus.js';
import { api } from './api.js';
import { APPS, appMeta } from './registry.js';
import { ICON } from './icons.js';
import { SFX, RING, stopAllLoops, setMasterVolume, unlockAudio } from './audio.js';
import { unlock } from './achievements.js';
import { $, el, clear, clamp, holdProgress, fmtDur, onLongPress, sleep } from './util.js';
import { notify, vibrate, hideAllHeadsUp } from './notify.js';
import { initStatusbar, render as renderStatus } from './statusbar.js';
import { initShade, openShade, closeShade, toggleShade, isShadeOpen, applyBrightness as applyShadeBright } from './shade.js';
import { initHome, render as renderHome, closeDrawer, isDrawerOpen, applyTheme } from './home.js';
import { initLock, render as renderLock, tryUnlock, doUnlock, closePinPad, renderRecents, hideRecentsLayer } from './lock.js';
import { bootSequence, shutdownSequence } from './boot.js';
import { startSetupWizard, setupActive } from './setup.js';
import { toast, sysDialog, sysConfirm } from './ui.js';

/* ======================= СОСТОЯНИЕ ПРИЛОЖЕНИЙ ======================= */
const running = new Map(); // id -> {el, inst, meta}
let stack = [];            // порядок фокуса (последний — активный)
let appsLayer = null;
let homeBar = null;
let currentParams = {};

export function initPhone() {
  appsLayer = $('#layer-apps');

  // home-bar
  homeBar = el('div', { class: 'home-bar' });
  $('#screen').append(homeBar);

  initStatusbar();
  initShade();
  initHome();
  initLock();
  bindHardware();
  bindGestures();
  bindKeyboard();
  applyTheme();
  applyShadeBright();
  renderStatus();
  refreshLockState();
}

/* ======================= API ДЛЯ ОСТАЛЬНЫХ МОДУЛЕЙ ======================= */
Object.assign(api, {
  openApp, closeApp, goHome, back, screenOn, screenOff, wake,
  lock, unlock: doUnlock, toggleShade, openShade, closeShade,
  reboot, powerOff, powerOn, showRecents, hideRecents, killApp, clearRecents,
  currentApp: () => (stack.length ? stack[stack.length - 1] : null),
  appMeta,
  notify,
  refreshHome: renderHome,
  refreshStatus: renderStatus,
  setTheme: () => { applyTheme(); renderHome(); },
  openNotif,
  requestPin: askPinForChange,
  toggleMusic: toggleMusic
});

window.__appMeta = appMeta;
window.__notify = notify;
window.__toast = toast;
window.__ach = unlock;
window.__activity = activity;
window.__wake = wake;
window.__screenOff = screenOff;
window.__powerOff = (reason) => shutdownSequence(reason);
window.__powerOn = () => { renderWorldSafe(); };
window.__powerMenu = powerMenu;
window.__openNotif = openNotif;
window.__topAppBg = () => {
  const id = api.currentApp();
  if (!id) return getState().phone.theme === 'light' ? 'light' : 'dark';
  const inst = running.get(id);
  return inst?.inst?.light ? 'light' : 'dark';
};

function renderWorldSafe() { window.__renderWorld?.(); }

function activity() {
  window.__activityPing?.();
  const S = getState();
  if (!S.phone.awake && S.phone.on) screenOn();
}

/* ======================= ЗАПУСК ПРИЛОЖЕНИЙ ======================= */
export async function openApp(id, params = {}, anim = {}) {
  const S = getState();
  if (!S.phone.on) return;
  if (S.stage !== 'ready') {
    // самовосстановление: телефон включён, но настройка не завершена —
    // возвращаем мастера настройки вместо «мёртвого» домашнего экрана
    if (!S.phone.setupDone && !setupActive()) startSetupWizard(S.flags.setupStep || 0);
    return;
  }
  if (!S.phone.awake) { screenOn(); await sleep(260); }
  if (S.phone.locked) { tryUnlock(); await sleep(320); if (S.phone.locked) return; }

  closeDrawer();
  hideRecents();
  closeShade();

  let rec = running.get(id);
  if (!rec) {
    const meta = APPS[id];
    if (!meta) { toast('❓', 'Приложение не найдено', id); return; }
    const node = el('div', { class: 'app', dataset: { app: id } });
    if (anim.ox) { node.style.setProperty('--ox', anim.ox); node.style.setProperty('--oy', anim.oy); }
    appsLayer.append(node);
    let mod;
    try { mod = await meta.mod(); } catch (e) { console.error(e); node.remove(); return; }
    const localApi = {
      back, close: () => closeApp(id), openApp, notify, toast,
      state: getState, save, emit, on,
      root: node, appId: id,
      screenOff, wake
    };
    let inst = {};
    try {
      inst = mod.mount(node, localApi, params) || {};
    } catch (e) {
      console.error('mount', id, e);
      clear(node);
      node.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🛠️' }), 'Приложение внезапно закрылось. Попробуй открыть его ещё раз.'));
    }
    rec = { el: node, inst, meta };
    running.set(id, rec);
    S.recents = S.recents || [];
    if (!S.recents.includes(id)) S.recents.push(id);
    if (S.recents.length > 8) S.recents.shift();
  } else {
    rec.inst.onFocus?.(params);
  }

  stack = stack.filter((x) => x !== id);
  stack.push(id);
  focusTop();
  currentParams = params;
  save();
  emit(EV.APP_OPEN, id);
}

export function focusTop() {
  running.forEach((rec, id) => {
    const top = stack[stack.length - 1] === id;
    rec.el.style.zIndex = top ? '20' : '10';
    rec.el.style.pointerEvents = top ? 'auto' : 'none';
    rec.el.style.filter = top ? '' : 'brightness(.7)';
    if (!top) rec.inst.onBlur?.();
  });
  refreshLockState();
}

export function closeApp(id) {
  const rec = running.get(id);
  if (!rec) { goHome(); return; }
  SFX.close();
  rec.inst.onUnmount?.();
  rec.el.classList.add('closing');
  setTimeout(() => { rec.el.remove(); running.delete(id); }, 190);
  stack = stack.filter((x) => x !== id);
  const S = getState();
  S.recents = (S.recents || []).filter((x) => x !== id);
  focusTop();
  save();
  emit(EV.APP_CLOSE, id);
}

export function killApp(id) {
  const rec = running.get(id);
  if (rec) { rec.inst.onUnmount?.(); rec.el.remove(); running.delete(id); }
  stack = stack.filter((x) => x !== id);
  const S = getState();
  S.recents = (S.recents || []).filter((x) => x !== id);
  focusTop();
  save();
}
export function clearRecents() {
  [...running.keys()].forEach((id) => killApp(id));
  const S = getState();
  S.recents = [];
  save();
  toast('🧹', 'Память очищена', 'Все фоновые приложения закрыты');
}

export function goHome() {
  const S = getState();
  if (!S.phone.awake) return;
  closeDrawer();
  hideRecents();
  closeShade();
  closePinPad();
  stack.forEach((id) => running.get(id)?.inst.onBlur?.());
  stack = [];
  focusTop();
  renderHome();
  SFX.tap();
}

export function back() {
  const S = getState();
  if (isShadeOpen()) { closeShade(); return; }
  if (isDrawerOpen()) { closeDrawer(); return; }
  if ($('#layer-recents') && !$('#layer-recents').hidden) { hideRecents(); return; }
  if (S.phone.locked) { closePinPad(); return; }
  const id = stack[stack.length - 1];
  if (!id) { return; }
  const rec = running.get(id);
  const handled = rec?.inst?.onBack?.();
  if (!handled) closeApp(id);
  else SFX.back();
}

export function showRecents() {
  const S = getState();
  if (!S.phone.awake || S.phone.locked) return;
  closeShade();
  const layer = $('#layer-recents');
  layer.hidden = false;
  renderRecents();
  SFX.shade();
}
export function hideRecents() {
  const layer = $('#layer-recents');
  if (layer && !layer.hidden) { layer.hidden = true; SFX.tap(); }
}

/* ======================= ЭКРАН ======================= */
export function screenOn(force = false) {
  const S = getState();
  if (!S.phone.on) return;
  if (S.phone.battery.pct <= 0 && !S.phone.battery.charging) return;
  if (S.phone.awake && !force) return;
  S.phone.awake = true;
  S.stats.screenOns++;
  $('#screen').classList.add('awake');
  unlockAudio();
  SFX.click();
  applyShadeBright();
  refreshLockState();
  renderStatus();
  save();
  emit(EV.SCREEN, 'on');
  activity();
}

export function screenOff() {
  const S = getState();
  if (!S.phone.awake) return;
  S.phone.awake = false;
  S.phone.locked = true;
  $('#screen').classList.remove('awake');
  closeShade(); closeDrawer(); hideRecents(); hideAllHeadsUp(); closePinPad();
  SFX.click();
  save();
  emit(EV.SCREEN, 'off');
}

export function wake() {
  const S = getState();
  if (!S.phone.on) return;
  screenOn(true);
  renderLock();
}

export function lock() {
  const S = getState();
  S.phone.locked = true;
  refreshLockState();
  save();
}

export function refreshLockState() {
  const S = getState();
  const layer = $('#layer-lock');
  const shouldShow = S.phone.awake && S.phone.locked && S.stage === 'ready';
  layer.style.display = shouldShow ? '' : 'none';
  homeBar.style.display = (S.phone.awake && !S.phone.locked && S.stage === 'ready') ? '' : 'none';
  homeBar.classList.toggle('dark', S.phone.theme === 'light' && !api.currentApp());
  if (shouldShow) renderLock();
  else { clear(layer); }
}

/* ======================= ПИТАНИЕ ======================= */
export async function powerOn() {
  const S = getState();
  if (S.phone.on) return;
  if (S.phone.battery.pct <= 0 && !S.phone.battery.charging) {
    toast('🪫', 'Батарея разряжена', 'Подключи зарядный кабель со стола');
    showDeadScreen();
    return;
  }
  await bootSequence();
  S.phone.on = true;
  S.phone.awake = true;
  S.phone.locked = S.phone.setupDone && S.phone.user.hasPin;
  $('#screen').classList.add('awake');
  hideDeadScreen();
  save();
  renderWorldSafe();

  if (!S.phone.setupDone) {
    SFX.boot();
    await sleep(300);
    startSetupWizard();
  } else {
    SFX.boot();
    refreshLockState();
    renderHome();
    renderStatus();
    emit(EV.SCREEN, 'on');
  }
  window.__afterPower?.();
}

export async function powerOff(reason = 'Выключение') {
  const S = getState();
  if (!S.phone.on) return;
  await shutdownSequence(reason);
  S.phone.on = false;
  S.phone.awake = false;
  $('#screen').classList.remove('awake');
  running.forEach((rec, id) => { rec.inst.onUnmount?.(); rec.el.remove(); });
  running.clear(); stack = [];
  stopAllLoops();
  save();
  showDeadScreen(reason === 'Батарея разряжена' ? 'battery' : 'off');
}

export async function reboot() {
  const S = getState();
  unlock('reboot');
  toast('🔄', 'Перезагрузка', 'NovaOS перезапускается…');
  running.forEach((rec, id) => { rec.inst.onUnmount?.(); rec.el.remove(); });
  running.clear(); stack = [];
  S.phone.on = false; S.phone.awake = false;
  $('#screen').classList.remove('awake');
  save();
  await shutdownSequence('Перезагрузка');
  await powerOn();
}

function showDeadScreen(kind = 'off') {
  hideDeadScreen();
  const screen = $('#screen');
  const d = el('div', { class: 'dead-screen', id: 'dead-screen' });
  const inner = el('div', { class: 'ds-in' });
  if (kind === 'battery') {
    inner.append(el('div', { class: 'big', text: '🪫' }));
    inner.append(el('div', { html: 'Батарея разряжена<br/>Подключите зарядное устройство' }));
  } else {
    inner.append(el('div', { class: 'big', text: '⏻' }));
    inner.append(el('div', { html: 'Телефон выключен<br/>Зажмите кнопку питания справа' }));
  }
  d.append(inner);
  screen.append(d);
}
export function hideDeadScreen() { $('#dead-screen')?.remove(); }

/* ======================= ФИЗИЧЕСКИЕ КНОПКИ ======================= */
function bindHardware() {
  const power = $('#hw-power');
  // после удержания браузер может дослать click — гасим его, но только короткий промежуток,
  // иначе следующее настоящее нажатие (например, после меню питания) будет проглочено
  let longFiredAt = 0;
  const hp = holdProgress(power, () => {
    longFiredAt = Date.now();
    powerMenu();
  }, 900);
  power.addEventListener('click', () => {
    if (Date.now() - longFiredAt < 800) { longFiredAt = 0; return; }
    const S = getState();
    unlockAudio();
    if (!S.phone.on) { powerOn(); return; }
    if (S.phone.awake) screenOff(); else screenOn(true);
  });

  // громкость
  const volUp = $('#hw-volup'), volDown = $('#hw-voldown');
  volUp.addEventListener('click', () => changeVolume(+8));
  volDown.addEventListener('click', () => changeVolume(-8));
  let volHudTimer = null;
  function changeVolume(d) {
    const S = getState();
    unlockAudio();
    const target = stack.length && !S.phone.locked ? 'media' : 'ring';
    S.phone.volume[target] = clamp(S.phone.volume[target] + d, 0, 100);
    if (target === 'media' && S.music.playing) setMasterVolume(S.phone.volume.media / 100 * 0.8);
    SFX.tap();
    showVolHud(target);
    save();
    clearTimeout(volHudTimer);
    volHudTimer = setTimeout(() => $('#vol-hud').classList.remove('show'), 1400);
  }
  function showVolHud(kind) {
    const S = getState();
    const hud = $('#vol-hud');
    const v = S.phone.volume[kind];
    clear(hud);
    const ic = el('div');
    ic.innerHTML = v === 0 ? ICON.volMute() : v < 40 ? ICON.volDown() : ICON.volUp();
    hud.append(ic);
    hud.append(el('div', { class: 'vol-hud__track' }, el('div', { class: 'vol-hud__fill', style: { height: v + '%' } })));
    hud.append(el('div', { class: 'vol-hud__num', text: `${kind === 'media' ? 'Медиа' : 'Звонок'} ${v}` }));
    hud.classList.add('show');
  }
}

export async function powerMenu() {
  const S = getState();
  if (!S.phone.on) { powerOn(); return; }
  const sys = $('#syslayer');
  const back = el('div', { class: 'power-menu' });
  const inner = el('div', { class: 'power-menu__inner' });
  const btn = (label, icon, fn) => {
    const b = el('button', { onclick: () => { back.remove(); SFX.click(); fn(); } });
    const i = el('span', { html: icon, style: { display: 'flex', width: '22px' } });
    b.append(i, el('span', { text: label }));
    return b;
  };
  inner.append(
    btn('Перезагрузить', ICON.refresh(), () => reboot()),
    btn('Выключить', ICON.power(), () => powerOff('Выключение')),
    btn('Экстренный вызов', ICON.phone(), () => emergencyCall()),
    btn('Отмена', ICON.close(), () => {})
  );
  back.append(inner);
  back.addEventListener('click', (e) => { if (e.target === back) back.remove(); });
  sys.append(back);
  vibrate(30);
}

async function emergencyCall() {
  await sysDialog({
    title: 'Экстренный вызов',
    icon: '🚨',
    text: '112 — единый европейский номер экстренных служб.<br/><br/>Вызов работает даже без SIM-карты и при нулевом балансе.<br/><br/><i>Это игра — не звоните по-настоящему без необходимости.</i>',
    buttons: [{ label: 'Закрыть', value: false }, { label: '112', value: true, cls: 'danger' }]
  }).then((v) => {
    if (v) {
      toast('🚨', '112', 'Оператор: «Слушаю вас?» … Вы положили трубку. Всё в порядке.');
      notify({ appId: 'phone', icon: '🚨', color: '#ef4444', title: 'Экстренный вызов 112', text: 'Вызов завершён · 00:07' });
    }
  });
}

/* ======================= ЖЕСТЫ ======================= */
function bindGestures() {
  const screen = $('#screen');
  // свайп от левого края — назад
  let edgeStart = null;
  const edge = $('#gesture-edge');
  edge.addEventListener('pointerdown', (e) => { edgeStart = { x: e.clientX, y: e.clientY }; });
  window.addEventListener('pointerup', (e) => {
    if (!edgeStart) return;
    const dx = e.clientX - edgeStart.x;
    const dy = Math.abs(e.clientY - edgeStart.y);
    edgeStart = null;
    if (dx > 60 && dy < 90) back();
  });

  // нижний жест: свайп вверх — домой, вверх и подержать — недавние
  const home = $('#gesture-home');
  let hsy = null, hTimer = null, hMoved = false;
  home.addEventListener('pointerdown', (e) => {
    hsy = e.clientY; hMoved = false;
    hTimer = setTimeout(() => { if (hsy !== null) { hMoved = true; showRecents(); } }, 420);
  });
  home.addEventListener('pointermove', (e) => {
    if (hsy === null) return;
    if (hsy - e.clientY > 60) { clearTimeout(hTimer); if (!hMoved) { hMoved = true; goHome(); hsy = null; } }
  });
  home.addEventListener('pointerup', () => {
    clearTimeout(hTimer);
    if (!hMoved && hsy !== null) goHome();
    hsy = null; hMoved = false;
  });
  home.addEventListener('pointercancel', () => { clearTimeout(hTimer); hsy = null; });
}

function bindKeyboard() {
  window.addEventListener('keydown', (e) => {
    const S = getState();
    if (!S || S.stage === 'box') return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    switch (e.key) {
      case 'Escape': back(); break;
      case ' ': e.preventDefault(); if (S.phone.awake && !S.phone.locked) goHome(); break;
      case 'n': case 'N': case 'т': case 'Т': if (S.phone.awake) toggleShade(); break;
      case 'l': case 'L': case 'д': case 'Д': if (S.phone.on) (S.phone.awake ? screenOff() : screenOn()); break;
      case 'Home': goHome(); break;
    }
  });
}

/* ======================= ОТКРЫТИЕ УВЕДОМЛЕНИЯ ======================= */
function openNotif(n) {
  closeShade();
  if (n.action?.type === 'app') {
    openApp(n.action.id, n.action.params || (n.action.chat ? { chat: n.action.chat } : {}));
  } else if (n.action?.type === 'url') {
    openApp('browser', { url: n.action.url });
  } else if (n.action?.type === 'call') {
    openApp('phone', { call: n.action.id });
  } else if (n.appId && APPS[n.appId]) {
    openApp(n.appId);
  }
}

/* ======================= СМЕНА PIN ======================= */
async function askPinForChange() {
  const S = getState();
  const cur = await sysDialog({
    title: 'Текущий PIN-код', icon: '🔐', text: 'Введите текущий PIN (по умолчанию 1234)',
    input: { placeholder: '••••', maxlength: 4, value: '' }, inputType: 'password',
    buttons: [{ label: 'Отмена', value: null }, { label: 'Далее', value: true, cls: 'primary' }]
  });
  if (cur === null || cur === false) return false;
  if (String(cur) !== S.phone.user.pin) { SFX.error(); toast('❌', 'Неверный PIN', 'Попробуйте ещё раз'); return false; }
  const next = await sysDialog({
    title: 'Новый PIN-код', icon: '🔢', text: '4 цифры. Не используйте 0000 — так же, как и раньше.',
    input: { placeholder: '••••', maxlength: 4 }, inputType: 'password',
    buttons: [{ label: 'Отмена', value: null }, { label: 'Сохранить', value: true, cls: 'primary' }]
  });
  if (!next || !/^\d{4}$/.test(String(next))) { if (next !== null) toast('❌', 'Нужно 4 цифры', ''); return false; }
  S.phone.user.pin = String(next);
  save();
  toast('🔐', 'PIN изменён', 'Теперь разблокировка по новому коду');
  return true;
}

/* ======================= МУЗЫКА (глобально) ======================= */
export function toggleMusic() {
  const S = getState();
  S.music.playing = !S.music.playing;
  if (S.music.playing) {
    window.__startFakeMusic?.();
    setMasterVolume(S.phone.volume.media / 100 * 0.8);
    unlock('music');
  } else {
    window.__stopFakeMusic?.();
  }
  save();
  emit('music-changed');
  renderHome();
}
