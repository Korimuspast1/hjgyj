import { getState, save } from './state.js';
import { on, EV, emit } from './bus.js';
import { ICON } from './icons.js';
import { fmtTime, pad2, clamp } from './util.js';
import { SFX } from './audio.js';

let bar = null;

export function initStatusbar() {
  bar = document.getElementById('statusbar');
  on(EV.TIME, throttleRender);
  on(EV.BATTERY, render);
  on(EV.NET, render);
  on(EV.SETTINGS, render);
  on(EV.NOTIF, render);
  on(EV.NOTIF_CLEAR, render);
  on(EV.STATE, render);
  render();
}

let lastMin = -1, acc = 0;
function throttleRender() {
  const S = getState();
  const m = new Date(S.time.gameMs).getHours() * 60 + new Date(S.time.gameMs).getMinutes();
  if (m !== lastMin) { lastMin = m; render(); }
}

export function render() {
  if (!bar) return;
  const S = getState();
  const p = S.phone;
  const d = new Date(S.time.gameMs);
  const showClock = p.awake && p.locked === false ? false : true;

  // левая часть: время + иконки «тихих» режимов
  const left = [];
  left.push(`<span class="sb-time">${pad2(d.getHours())}:${pad2(d.getMinutes())}</span>`);
  if (p.dnd) left.push(`<span class="sb-icon">${ICON.dnd()}</span>`);
  const ringingAlarm = S.alarms.some((a) => a.on);
  if (ringingAlarm) left.push(`<span class="sb-icon" style="opacity:.8">${ICON.alarm()}</span>`);

  // правая часть
  const right = [];
  if (p.bt.on) right.push(`<span class="sb-icon">${ICON.bt()}</span>`);
  if (p.airplane) right.push(`<span class="sb-icon">${ICON.airplane()}</span>`);
  else if (p.wifi.on && p.wifi.ssid) right.push(`<span class="sb-icon">${ICON.wifi(wifiLevel())}</span>`);
  else if (p.wifi.on) right.push(`<span class="sb-icon off">${ICON.wifi(0)}</span>`);

  if (!p.airplane && p.sim.inserted && p.sim.operator) {
    right.push(`<span class="sb-icon">${ICON.signal(p.sim.signal)}</span>`);
    right.push(`<span class="sb-icon" style="font-size:9.5px;opacity:.85;letter-spacing:.04em">5G</span>`);
  } else if (!p.airplane) {
    right.push(`<span class="sb-icon off">${ICON.signalCross()}</span>`);
  }
  if (p.data.on && p.sim.inserted && !p.wifi.ssid) right.push(`<span class="sb-icon">${ICON.data()}</span>`);
  if (p.flashlight) right.push(`<span class="sb-icon">${ICON.flashlight(true)}</span>`);
  if (p.hotspot) right.push(`<span class="sb-icon">${ICON.hotspot()}</span>`);

  const b = p.battery;
  const bw = clamp(b.pct, 0, 100);
  const cls = b.charging ? 'charging' : bw <= 15 ? 'low' : '';
  right.push(`
    <span class="sb-batt ${cls}">
      <span class="sb-batt__num">${Math.round(bw)}${p.showPercent !== false ? '%' : ''}</span>
      <span class="sb-batt__shell">
        <span class="sb-batt__fill" style="width:${(bw / 100) * 18}px"></span>
        ${b.charging ? '<span class="sb-batt__bolt">⚡</span>' : ''}
      </span>
    </span>`);

  bar.innerHTML = `<div class="sb-left">${left.join('')}</div><div class="sb-right">${right.join('')}</div>`;

  // цвет иконок: на светлом фоне — тёмные
  const light = shouldUseDarkIcons();
  bar.classList.toggle('dark-icons', light);
  bar.classList.toggle('light-icons', !light);
}

function wifiLevel() {
  const S = getState();
  if (!S.phone.wifi.ssid) return 0;
  const net = (window.__wifiList?.() || []).find((n) => n.ssid === S.phone.wifi.ssid);
  return net ? net.signal : 3;
}

function shouldUseDarkIcons() {
  const S = getState();
  if (!S.phone.awake) return false;
  if (S.phone.locked) return false;
  const top = window.__topAppBg?.();
  return top === 'light';
}

export function hideStatusbar(v) { bar?.classList.toggle('hidden', v); }
