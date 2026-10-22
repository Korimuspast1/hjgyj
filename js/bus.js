// Простая шина событий
const map = new Map();

export function on(evt, fn) {
  if (!map.has(evt)) map.set(evt, new Set());
  map.get(evt).add(fn);
  return () => off(evt, fn);
}
export function off(evt, fn) {
  map.get(evt)?.delete(fn);
}
export function emit(evt, payload) {
  map.get(evt)?.forEach((fn) => {
    try { fn(payload); } catch (e) { console.error('[bus]', evt, e); }
  });
}

export const EV = {
  STATE: 'state',
  TIME: 'time',
  NOTIF: 'notif',
  NOTIF_CLEAR: 'notif-clear',
  APP_OPEN: 'app-open',
  APP_CLOSE: 'app-close',
  SCREEN: 'screen',
  SHADE: 'shade',
  SETTINGS: 'settings',
  BATTERY: 'battery',
  NET: 'net',
  MONEY: 'money',
  ACH: 'ach',
  TASK: 'task',
  MESSAGE: 'message',
  CALL: 'call',
  PHOTO: 'photo',
  THEME: 'theme',
};
