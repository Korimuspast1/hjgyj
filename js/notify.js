import { getState, save } from './state.js';
import { emit, EV } from './bus.js';
import { SFX } from './audio.js';
import { uid, fmtTime, chatStamp } from './util.js';

let notifSeq = 1;

export function notify(n) {
  const S = getState();
  if (!S) return;
  if (S.phone.dnd && !n.priority) {
    // в режиме «не беспокоить» уведомления тихие
    pushNotif({ ...n, silent: true });
    return;
  }
  if (!S.phone.on) { pushNotif({ ...n, silent: true }); return; }
  if (!S.phone.awake || S.stage !== 'ready') { pushNotif(n); return; }
  pushNotif(n);
  if (!n.silent) {
    if (S.phone.volume.notif > 0) SFX.notif();
    if (S.phone.vibrate) vibrate();
    showHeadsUp(n);
  }
}

function pushNotif(n) {
  const S = getState();
  const notif = {
    id: n.id || uid('n'),
    app: n.app || 'system',
    appId: n.appId || n.app || 'system',
    icon: n.icon || '🔔',
    color: n.color || '#38bdf8',
    title: n.title || '',
    text: n.text || '',
    at: S.time.gameMs,
    action: n.action || null,     // {type:'app', id:'messages'} | {type:'call'}
    actions: n.actions || [],     // [{label, act}]
    persistent: !!n.persistent,
    group: n.group || null,
    silent: !!n.silent
  };
  S.notifications.unshift(notif);
  if (S.notifications.length > 30) S.notifications.length = 30;
  emit(EV.NOTIF, notif);
  save();
  return notif;
}

export function removeNotif(id) {
  const S = getState();
  const i = S.notifications.findIndex((n) => n.id === id);
  if (i >= 0) { S.notifications.splice(i, 1); emit(EV.NOTIF_CLEAR, id); save(); }
}
export function clearAllNotifs() {
  const S = getState();
  S.notifications = [];
  emit(EV.NOTIF_CLEAR, '*');
  save();
}
export function clearAppNotifs(appId) {
  const S = getState();
  S.notifications = S.notifications.filter((n) => n.appId !== appId);
  emit(EV.NOTIF_CLEAR, appId);
  save();
}
export function notifyByApp(appId) { return getState().notifications.filter((n) => n.appId === appId); }

export function vibrate(ms = 22) {
  const S = getState();
  if (!S?.phone.vibrate) return;
  const ph = document.getElementById('phone');
  if (ph) {
    ph.classList.remove('vibrate'); void ph.offsetWidth; ph.classList.add('vibrate');
  }
  const ring = document.getElementById('vibe-ring');
  if (ring) { ring.classList.remove('on'); void ring.offsetWidth; ring.classList.add('on'); }
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ---------- всплывающее уведомление (heads-up) ---------- */
let headsUpEl = null;
export function initHeadsUp() { headsUpEl = document.getElementById('heads-up'); }

function showHeadsUp(n) {
  if (!headsUpEl) return;
  const node = document.createElement('div');
  node.className = 'notif';
  node.dataset.id = n.id;
  node.innerHTML = `
    <div class="notif__ico" style="background:${n.color}">${n.icon}</div>
    <div class="notif__body">
      <div class="notif__top"><span class="notif__app">${escapeHtml(appLabel(n.appId))}</span><span class="notif__time">${fmtTime()}</span></div>
      <div class="notif__title">${escapeHtml(n.title)}</div>
      <div class="notif__text">${escapeHtml(n.text)}</div>
    </div>
    <button class="notif__x">×</button>`;
  node.addEventListener('click', (e) => {
    if (e.target.closest('.notif__x')) { dismiss(node, n.id); return; }
    dismiss(node, n.id);
    window.__openNotif?.(n);
  });
  headsUpEl.prepend(node);
  const t = setTimeout(() => dismiss(node, n.id), 4200);
  node._t = t;
  while (headsUpEl.children.length > 3) dismiss(headsUpEl.lastElementChild);
}
function dismiss(node, id) {
  if (!node || node._gone) return;
  node._gone = true;
  clearTimeout(node._t);
  node.classList.add('removing');
  setTimeout(() => node.remove(), 260);
}
export function hideAllHeadsUp() {
  if (!headsUpEl) return;
  [...headsUpEl.children].forEach((c) => dismiss(c));
}

const APP_LABELS = {
  messages: 'Сообщения', phone: 'Телефон', browser: 'Браузер', camera: 'Камера', gallery: 'Галерея',
  settings: 'Настройки', music: 'Музыка', clock: 'Часы', calc: 'Калькулятор', notes: 'Заметки',
  weather: 'Погода', bank: 'NovaBank', store: 'Nova Store', files: 'Файлы', snake: 'Змейка', system: 'Система'
};
export function appLabel(id) { return APP_LABELS[id] || id; }
export function setAppLabel(id, label) { APP_LABELS[id] = label; }

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/* ---------- SMS/служебные сообщения ---------- */
export function sysMsg(contactId, text) {
  const S = getState();
  const chat = S.messages.chats[contactId];
  if (!chat) return;
  const c = S.contacts.find((x) => x.id === contactId);
  chat.messages.push({
    id: uid('m'), dir: 'in', text, at: S.time.gameMs,
    type: 'sms', status: 'read'
  });
  chat.unread++;
  chat.lastActivity = S.time.gameMs;
  const name = contactId === 'operator' && S.phone.sim.operator
    ? S.phone.sim.operator === 'mobiline' ? 'Mobiline' : 'Telka'
    : (c?.name || c?.full || 'Сервис');
  notify({
    appId: 'messages', icon: '💬', color: '#22c55e', title: name, text,
    action: { type: 'app', id: 'messages', chat: contactId }
  });
  emit(EV.MESSAGE, { contactId });
  save();
}

/* ---------- бейджи на иконках ---------- */
export function badgeCount(appId) {
  const S = getState();
  if (appId === 'messages') {
    return Object.values(S.messages.chats).reduce((a, c) => a + (c.unread || 0), 0);
  }
  if (appId === 'phone') return S.calls.filter((c) => c.unread).length;
  if (appId === 'bank') return S.notifications.filter((n) => n.appId === 'bank').length;
  return S.notifications.filter((n) => n.appId === appId).length;
}
