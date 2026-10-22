import { getState, save, completeTask, OPERATORS, WIFI_NETWORKS } from './state.js';
import { emit, EV } from './bus.js';
import { SFX } from './audio.js';
import { unlock } from './achievements.js';
import { el, clear, sleep, rndInt } from './util.js';
import { toast } from './ui.js';
import { notify } from './notify.js';
import { $ } from './util.js';

export function wifiList() {
  // «сканирование»: уровень сигнала чуть плавает
  return WIFI_NETWORKS.map((n) => ({ ...n, signal: Math.max(1, Math.min(4, n.signal + (Math.random() < 0.18 ? -1 : 0))) }));
}

export function hasInternet() {
  const S = getState();
  const p = S.phone;
  if (!p.on) return { ok: false, why: 'Телефон выключен' };
  if (p.airplane) return { ok: false, why: 'Включён режим полёта', fix: 'airplane' };
  if (p.wifi.on && p.wifi.ssid) return { ok: true, kind: 'wifi', name: p.wifi.ssid };
  if (p.data.on && p.sim.inserted && p.sim.operator) {
    const op = OPERATORS[p.sim.operator];
    if (op.gb !== Infinity && p.data.usedGb >= p.data.limitGb) {
      return { ok: false, why: 'Пакет интернета закончился', fix: 'data' };
    }
    return { ok: true, kind: 'data', name: op.name };
  }
  if (!p.sim.inserted) return { ok: false, why: 'Нет SIM-карты и нет Wi-Fi', fix: 'sim' };
  if (!p.wifi.on && !p.data.on) return { ok: false, why: 'Wi-Fi и мобильные данные выключены', fix: 'toggles' };
  if (p.wifi.on && !p.wifi.ssid) return { ok: false, why: 'Wi-Fi включён, но сеть не выбрана', fix: 'wifi' };
  return { ok: false, why: 'Нет подключения к интернету', fix: 'toggles' };
}

export function connectionLabel() {
  const r = hasInternet();
  if (!r.ok) return 'нет сети';
  return r.kind === 'wifi' ? `Wi-Fi · ${r.name}` : `${OPERATORS[getState().phone.sim.operator]?.name || ''} · 5G`;
}

/* ---------------- Wi-Fi ---------------- */
export async function connectWifi(net, opts = {}) {
  const S = getState();
  const p = S.phone;
  if (p.airplane) { toast('✈️', 'Режим полёта', 'Сначала выключите режим полёта в шторке'); return false; }
  if (!p.wifi.on) { p.wifi.on = true; save(); emit(EV.SETTINGS); }

  const overlay = netOverlay(`Подключение к ${net.ssid}`);
  await sleep(rndInt(700, 1500));

  if (net.secured) {
    const remembered = p.wifi.remembered.find((r) => r.ssid === net.ssid);
    const pass = opts.pass ?? remembered?.pass;
    if (!pass) {
      overlay.close();
      const entered = await askWifiPass(net);
      if (entered === null) return false;
      return connectWifi(net, { ...opts, pass: entered });
    }
    if (pass !== net.pass) {
      overlay.close();
      SFX.error();
      toast('🔒', 'Неверный пароль', `Сеть ${net.ssid} отклонила подключение. Подсказка: пароль на роутере.`);
      return false;
    }
  }

  overlay.setText('Получение IP-адреса…');
  await sleep(500);
  p.wifi.ssid = net.ssid;
  if (net.secured && !p.wifi.remembered.some((r) => r.ssid === net.ssid)) {
    p.wifi.remembered.push({ ssid: net.ssid, pass: opts.pass || net.pass });
  }
  if (net.pass === undefined) { /* открытая сеть */ }
  save();
  overlay.close();
  SFX.notif();
  unlock('wifi');
  completeTask('t8');
  toast('📶', 'Wi-Fi подключён', `${net.ssid} · ${net.freq} · скорость до ${net.ssid.includes('5G') ? 480 : 96} Мбит/с`);
  emit(EV.NET);
  emit(EV.SETTINGS);
  return true;
}

function askWifiPass(net) {
  return new Promise((resolve) => {
    const sys = $('#syslayer');
    const back = el('div', { class: 'sysdialog-backdrop' });
    const box = el('div', { class: 'sysdialog' });
    const input = el('input', { class: 'sysdialog__input', type: 'password', placeholder: 'Пароль сети' });
    box.append(el('div', { class: 'sysdialog__body' },
      el('div', { class: 'sysdialog__ico', text: '🔒' }),
      el('div', { class: 'sysdialog__title', text: net.ssid }),
      el('div', { class: 'sysdialog__text', text: 'Введите пароль. Он написан на наклейке роутера (кликните по роутеру на столе).' }),
      input
    ));
    const acts = el('div', { class: 'sysdialog__actions' });
    acts.append(el('button', { text: 'Отмена', onclick: () => { back.remove(); resolve(null); } }));
    acts.append(el('button', { class: 'primary', text: 'Подключиться', onclick: () => { back.remove(); resolve(input.value); } }));
    box.append(acts);
    back.append(box);
    back.addEventListener('click', (e) => { if (e.target === back) { back.remove(); resolve(null); } });
    sys.append(back);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { back.remove(); resolve(input.value); } });
    setTimeout(() => input.focus(), 70);
  });
}

export function disconnectWifi() {
  const S = getState();
  const name = S.phone.wifi.ssid;
  S.phone.wifi.ssid = null;
  save();
  emit(EV.NET); emit(EV.SETTINGS);
  if (name) toast('📶', 'Wi-Fi отключён', `Сеть ${name} забыта до следующего подключения`);
}

export function forgetWifi(ssid) {
  const S = getState();
  S.phone.wifi.remembered = S.phone.wifi.remembered.filter((r) => r.ssid !== ssid);
  if (S.phone.wifi.ssid === ssid) S.phone.wifi.ssid = null;
  save(); emit(EV.NET);
}

/* ---------------- мобильные данные ---------------- */
export function useData(mb) {
  const S = getState();
  const p = S.phone;
  if (!p.data.on && !(p.wifi.on && p.wifi.ssid)) return;
  const viaWifi = p.wifi.on && p.wifi.ssid;
  if (viaWifi) return; // Wi-Fi безлимитный
  const gb = mb / 1024;
  p.data.usedGb += gb;
  S.stats.dataMb += mb;
  const op = OPERATORS[p.sim.operator];
  if (op && op.gb !== Infinity && p.data.usedGb >= p.data.limitGb && !S.flags.dataLimitHit) {
    S.flags.dataLimitHit = true;
    notify({ appId: 'system', icon: '📵', color: '#f97316', title: 'Пакет интернета закончился', text: `${op.name}: ${p.data.limitGb} ГБ израсходованы. Скорость ограничена до 64 кбит/с.`, priority: true });
  }
  save();
  emit(EV.NET);
}

export function dataLeft() {
  const S = getState();
  const op = OPERATORS[S.phone.sim.operator];
  if (!op) return null;
  if (op.gb === Infinity) return { infinite: true };
  return { used: S.phone.data.usedGb, limit: op.gb, left: Math.max(0, op.gb - S.phone.data.usedGb) };
}

/* ---------------- оверлей «подключение» ---------------- */
export function netOverlay(text) {
  const sys = $('#syslayer');
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog' });
  const spinner = el('div', { class: 'boot__spinner', style: { margin: '10px auto 14px' } });
  const t = el('div', { class: 'sysdialog__text', text });
  box.append(el('div', { class: 'sysdialog__body' }, spinner, t));
  back.append(box);
  sys.append(back);
  return {
    setText: (v) => { t.textContent = v; },
    close: () => back.remove()
  };
}
