import { getState, save } from './state.js';
import { on, EV } from './bus.js';
import { el, clear, fmtTime } from './util.js';
import { RING, stopAlarm, SFX } from './audio.js';
import { stopAlarmRing, snoozeAlarm } from './time.js';
import { $ } from './util.js';

let node = null;

export function initAlarmUI() {
  on('alarm-ring', (a) => showAlarm(a));
  on('alarm-stop', () => hide());
}

function showAlarm(a) {
  const S = getState();
  hide();
  // будильник может разбудить телефон
  if (S.phone.on && !S.phone.awake) window.__wake?.();
  RING.alarm('nova');
  const sys = $('#syslayer');
  node = el('div', { class: 'alarm-full' });
  node.append(
    el('div', { class: 'af-ico', text: '⏰' }),
    el('div', { class: 'af-time', text: a.time }),
    el('div', { class: 'af-label', text: a.label || 'Будильник' }),
    el('div', { style: { fontSize: '12px', opacity: '.5' }, text: fmtTime(new Date(S.time.gameMs)) + ' · ' + new Date(S.time.gameMs).toLocaleDateString('ru-RU') })
  );
  const btns = el('div', { class: 'af-btns' });
  btns.append(el('button', { class: 'snooze', text: '😴 Ещё 9 мин', onclick: () => { SFX.tap(); snoozeAlarm(a); } }));
  btns.append(el('button', { class: 'stop', text: 'Выключить', onclick: () => { SFX.click(); stopAlarmRing(a); } }));
  node.append(btns);
  node.append(el('div', { style: { fontSize: '11px', opacity: '.4', marginTop: '10px' }, text: 'Сон +1 час · настроение −10' }));
  sys.append(node);
  window.__vibrate?.(60);
}

function hide() {
  stopAlarm();
  node?.remove();
  node = null;
}
