import { getState, save, completeTask, displayName, contactByPhone, OPERATORS } from '../state.js';
import { emit, EV, on } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX, RING, stopRing, stopBusy } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify, vibrate } from '../notify.js';
import { $, el, clear, uid, fmtTime, fmtDur, timeAgo, pick, rndInt, onLongPress, plural, pad2 } from '../util.js';
import { avatar, toast, sysDialog } from '../ui.js';
import { hasInternet } from '../net.js';

let inst = null, tab = 'calls', dialNum = '';
let callState = null; // {number, name, dir, startedAt, timer, muted, speaker, node}

export function mount(root, a, params) {
  inst = { root, api: a };
  root.className = 'app theme-dark phone-app';
  root.classList.toggle('theme-light', getState().phone.theme === 'light');
  if (params?.dial) { dialNum = params.dial; tab = 'keypad'; }
  render();
  if (params?.call) startCall(params.call, 'out');
  return {
    light: getState().phone.theme === 'light',
    onFocus(p) { if (p?.dial) { dialNum = p.dial; tab = 'keypad'; render(); } },
    onBack() {
      if (callState) { endCall(); return true; }
      if (tab !== 'calls') { tab = 'calls'; render(); return true; }
      if (dialNum) { dialNum = ''; render(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);
  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Телефон' })));
  const acts = el('div', { class: 'appbar__actions' });
  const moreBtn = el('button', { class: 'iconbtn', onclick: () => phoneMenu() });
  moreBtn.innerHTML = ICON.more();
  acts.append(moreBtn);
  bar.append(acts);
  inst.root.append(bar);

  const tabs = el('div', { class: 'tabs' });
  [['calls', 'Недавние'], ['contacts', 'Контакты'], ['keypad', 'Клавиатура']].forEach(([id, label]) => {
    tabs.append(el('button', { class: tab === id ? 'on' : '', text: label, onclick: () => { tab = id; SFX.tap(); render(); } }));
  });
  inst.root.append(tabs);

  const body = el('div', { class: 'appbody' });
  inst.root.append(body);

  if (!S.phone.sim.inserted) {
    body.append(el('div', { class: 'no-signal-banner', html: '📵 Нет SIM-карты — звонки недоступны. Установите SIM: скрепка → лоток → SIM-карта.' }));
  } else if (S.phone.airplane) {
    body.append(el('div', { class: 'no-signal-banner', html: '✈️ Режим полёта включён — сеть недоступна.' }));
  }

  if (tab === 'calls') renderCalls(body);
  else if (tab === 'contacts') renderContacts(body);
  else renderKeypad(body);
}

/* ---------------- недавние ---------------- */
function renderCalls(body) {
  const S = getState();
  if (!S.calls.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '📞' }), 'История пуста', el('br'), el('span', { style: { fontSize: '11.5px' }, text: 'Наберите номер на вкладке «Клавиатура»' })));
    return;
  }
  const rowWrap = el('div', { class: 'list' });
  S.calls.slice().reverse().forEach((call) => {
    const c = contactByPhone(call.number);
    const row = el('div', { class: 'list__row call-row' + (call.dir === 'missed' ? ' missed' : '') });
    row.append(avatar(c || { initials: '?', color: '#64748b', name: call.name }));
    const g = el('div', { class: 'grow' });
    g.append(el('div', { class: 't1', text: call.name || (c ? displayName(c) : call.number) }));
    const dirIcon = call.dir === 'out' ? '↗' : call.dir === 'in' ? '↙' : '✕';
    g.append(el('div', { class: 'c-type', text: `${dirIcon} ${call.dir === 'out' ? 'Исходящий' : call.dir === 'in' ? 'Входящий' : 'Пропущенный'} · ${call.duration ? fmtDur(call.duration) : 'без ответа'} · ${timeAgo(call.at)}` }));
    row.append(g);
    const cb = el('button', { class: 'iconbtn', style: { color: '#22c55e' }, onclick: (e) => { e.stopPropagation(); startCall(call.number, 'out'); } });
    cb.innerHTML = ICON.phone();
    row.append(cb);
    row.addEventListener('click', () => callDetail(call));
    rowWrap.append(row);
  });
  body.append(rowWrap);

  const clr = el('div', { style: { padding: '14px' } }, el('button', {
    class: 'btn btn--ghost', style: { width: '100%' }, text: 'Очистить историю',
    onclick: async () => {
      const ok = await sysDialog({ title: 'Очистить историю?', text: 'Все записи о звонках будут удалены.', buttons: [{ label: 'Отмена', value: false }, { label: 'Очистить', value: true, cls: 'danger' }] });
      if (ok) { S.calls = []; save(); render(); }
    }
  }));
  body.append(clr);
}

async function callDetail(call) {
  const act = await sysDialog({
    title: call.name || call.number, icon: call.dir === 'missed' ? '✕' : '📞',
    text: `<b>${call.number}</b><br/>${call.dir === 'out' ? 'Исходящий' : call.dir === 'in' ? 'Входящий' : 'Пропущенный'} вызов<br/>${fmtTime(new Date(call.at))} · ${call.duration ? fmtDur(call.duration) : 'без ответа'}`,
    buttons: [
      { label: '📞 Позвонить', value: 'call', cls: 'primary' },
      { label: '💬 Написать', value: 'msg' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (act === 'call') startCall(call.number, 'out');
  if (act === 'msg') {
    const c = contactByPhone(call.number);
    api.openApp('messages', { chat: c?.id || 'kirill' });
  }
}

/* ---------------- контакты ---------------- */
function renderContacts(body) {
  const S = getState();
  const list = S.contacts.filter((c) => c.phone);
  const favs = list.filter((c) => c.fav);
  const others = list.filter((c) => !c.fav);

  if (favs.length) {
    body.append(el('div', { class: 'sect-title', text: 'Избранные' }));
    favs.forEach((c) => body.append(contactRow(c)));
  }
  body.append(el('div', { class: 'sect-title', text: `Все контакты (${list.length})` }));
  others.forEach((c) => body.append(contactRow(c)));

  body.append(el('div', { class: 'sect-title', text: 'Экстренные' }));
  [['112', 'Единый экстренный', '🚨'], ['101', 'Пожарная', '🚒'], ['103', 'Скорая', '🚑'], ['102', 'Полиция', '🚓']].forEach(([n, l, i]) => {
    body.append(el('div', { class: 'list__row', onclick: () => startCall(n, 'out') },
      el('div', { class: 'set-row-ico', style: { background: 'rgba(239,68,68,.18)' }, text: i }),
      el('div', { class: 'grow' }, el('div', { class: 't1', text: n }), el('div', { class: 't2', text: l }))));
  });

  const fab = el('button', { class: 'fab', title: 'Новый контакт', onclick: () => newContact() });
  fab.innerHTML = ICON.add();
  inst.root.append(fab);
}

function contactRow(c) {
  const row = el('div', { class: 'list__row' });
  row.append(avatar(c));
  const g = el('div', { class: 'grow' });
  g.append(el('div', { class: 't1', text: displayName(c) }));
  g.append(el('div', { class: 't2', text: `${c.phone}${c.role ? ' · ' + c.role : ''}` }));
  row.append(g);
  const msgBtn = el('button', { class: 'iconbtn', onclick: (e) => { e.stopPropagation(); api.openApp('messages', { chat: c.id }); } });
  msgBtn.innerHTML = ICON.chat();
  const callBtn = el('button', { class: 'iconbtn', style: { color: '#22c55e' }, onclick: (e) => { e.stopPropagation(); startCall(c.phone, 'out'); } });
  callBtn.innerHTML = ICON.phone();
  row.append(msgBtn, callBtn);
  row.addEventListener('click', () => startCall(c.phone, 'out'));
  return row;
}

async function newContact() {
  const res = await sysDialog({
    title: 'Новый контакт', icon: '👤',
    text: 'Имя и номер (через пробел или запятую)',
    input: { placeholder: 'Например: Пиццерия 8800123' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Сохранить', value: true, cls: 'primary' }]
  });
  if (!res) return;
  const [name, ...rest] = String(res).trim().split(/\s+/);
  const phone = rest.join(' ') || `+32 4${rndInt(60, 99)} ${rndInt(10, 99)} ${rndInt(10, 99)} ${rndInt(10, 99)}`;
  const S = getState();
  const id = 'c' + uid();
  S.contacts.push({
    id, name, full: name, phone, color: `hsl(${rndInt(0, 360)} 70% 60%)`,
    initials: name.slice(0, 1).toUpperCase(), role: 'Мой контакт', messenger: true, arc: 0, online: ''
  });
  S.messages.chats[id] = { id, messages: [], unread: 0, pinned: false, muted: false, draft: '', step: 0, typing: false, lastActivity: 0 };
  save();
  toast('👤', 'Контакт сохранён', `${name} · ${phone}`);
  render();
}

/* ---------------- клавиатура ---------------- */
const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
function renderKeypad(body) {
  const S = getState();
  const c = dialNum ? contactByPhone(dialNum) : null;
  const num = el('div', { class: 'dial-num' + (c ? ' match' : ''), text: dialNum || '' });
  if (c) num.textContent = `${displayName(c)} · ${dialNum}`;
  body.append(num);

  if (dialNum.startsWith('*') || dialNum.startsWith('#')) {
    body.append(el('div', { style: { textAlign: 'center', fontSize: '11.5px', opacity: '.6', padding: '0 20px 8px' }, text: 'USSD-команда. Нажмите «вызов» — команда отправится оператору.' }));
  }

  const pad = el('div', { class: 'dialpad' });
  KEYS.forEach(([k, l], i) => {
    pad.append(el('button', { onclick: () => { pressKey(k, i); } }, el('b', { text: k }), el('small', { text: l })));
  });
  body.append(pad);

  const actions = el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '30px', padding: '12px 0 8px' } });
  const callBtn = el('button', {
    class: 'callbtn answer', style: { width: '62px', height: '62px' },
    onclick: () => { if (dialNum) startCall(dialNum, 'out'); else toast('📞', 'Введите номер', 'Наберите номер или USSD-команду, например *100#'); }
  });
  callBtn.innerHTML = ICON.phone();
  actions.append(callBtn);
  if (dialNum) {
    const del = el('button', { class: 'iconbtn', style: { width: '44px', height: '44px' }, onclick: () => { dialNum = dialNum.slice(0, -1); SFX.tap(); render(); } });
    del.innerHTML = ICON.back();
    actions.append(del);
  }
  body.append(actions);
}

function pressKey(k, i) {
  SFX.dtmf(i);
  dialNum += k;
  const num = inst?.root.querySelector('.dial-num');
  if (num) {
    const c = contactByPhone(dialNum);
    num.className = 'dial-num' + (c ? ' match' : '');
    num.textContent = c ? `${displayName(c)} · ${dialNum}` : dialNum;
  } else render();
}

async function phoneMenu() {
  const act = await sysDialog({
    title: 'Телефон', icon: '📞',
    text: getState().phone.sim.operator ? `${OPERATORS[getState().phone.sim.operator].name} · ${getState().phone.sim.number}` : 'SIM-карта не установлена',
    buttons: [
      { label: '⚙️ Настройки связи', value: 'set' },
      { label: '📊 Статистика', value: 'stats' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (act === 'set') api.openApp('settings', { page: 'network' });
  if (act === 'stats') {
    const S = getState();
    await sysDialog({
      title: 'Статистика вызовов', icon: '📊',
      text: `Всего звонков: <b>${S.stats.calls}</b><br/>В разговоре: <b>${fmtDur(S.stats.callSec)}</b><br/>Пропущено: <b>${S.calls.filter((c) => c.dir === 'missed').length}</b>`
    });
  }
}

/* =========================================================
   ЗВОНКИ
   ========================================================= */
export function startCall(number, dir = 'out') {
  const S = getState();
  if (callState) return;

  // USSD
  if (dir === 'out' && (number.startsWith('*') || number.startsWith('#'))) { ussd(number); return; }

  if (!S.phone.sim.inserted || S.phone.airplane || !S.phone.sim.signal) {
    SFX.error();
    toast('📵', 'Нет сети', !S.phone.sim.inserted ? 'Установите SIM-карту' : S.phone.airplane ? 'Выключите режим полёта' : 'Сигнал пропал — попробуйте позже');
    return;
  }
  const c = contactByPhone(number);
  if (c?.blocked) { toast('⛔', 'Номер заблокирован', 'Разблокируйте его в информации о контакте'); return; }

  const name = c ? displayName(c) : (SERVICES[number]?.name || number);
  showCallScreen({ number, name, dir, contact: c });
}

const SERVICES = {
  '112': { name: 'Экстренная служба', reply: '112: «Служба спасения, слушаю. Это симулятор — настоящая помощь не требуется?»' },
  '5225': { name: 'NovaBank', ivr: ['Баланс карты', 'Заблокировать карту', 'Курс валют', 'Оператор'] },
  '1111': { name: 'Mobiline', ivr: ['Остаток по пакету', 'Тарифы и услуги', 'Обещанный платёж', 'Оператор'] },
  '2222': { name: 'Telka', ivr: ['Остаток по пакету', 'Тарифы и услуги', 'Обещанный платёж', 'Оператор'] },
  '8800': { name: 'TechShop', ivr: ['Статус заказа', 'Каталог и скидки', 'Возврат товара', 'Оператор'] },
  '1000': { name: 'Справочная', reply: 'Справочная: «Мы знаем всё, но сегодня не наш день. Попробуйте поиск в браузере.»' },
  '4444': { name: 'Платный контент', reply: '⚠️ С вашего счёта списано 9,99 € за SMS-подписку «Гороскоп на каждый час». Отписка: СТОП на 4444.' }
};

function showCallScreen(info) {
  const S = getState();
  stopRing();
  const sys = $('#syslayer');
  const node = el('div', { class: 'callscr' });
  callState = { ...info, node, startedAt: null, seconds: 0, muted: false, speaker: false, interval: null, ended: false };
  window.__inCall = true;

  const c = info.contact || { initials: '?', color: '#64748b', name: info.name };
  node.append(el('div', { style: { marginTop: '10px' } }, avatar(c, 'lg')));
  node.append(el('div', { class: 'callscr__name', text: info.name }));
  node.append(el('div', { class: 'callscr__num', text: info.number }));
  const stateEl = el('div', { class: 'callscr__state', text: info.dir === 'out' ? 'Вызов…' : 'Соединение…' });
  node.append(stateEl);
  const timerEl = el('div', { class: 'callscr__timer', text: '' });
  node.append(timerEl);
  node.append(el('div', { class: 'callscr__spacer' }));

  // панель в разговоре
  const grid = el('div', { class: 'callscr__grid' });
  const mk = (label, svg, fn, key) => {
    const b = el('button', { onclick: () => { SFX.tap(); callState[key] = !callState[key]; b.classList.toggle('on', callState[key]); fn?.(callState[key]); } });
    const ci = el('div', { class: 'ci' }); ci.innerHTML = svg;
    b.append(ci, el('span', { text: label }));
    return b;
  };
  grid.append(mk('Без звука', ICON.volMute(), () => {}, 'muted'));
  grid.append(mk('Клавиатура', ICON.keypad(), () => toast('⌨️', 'DTMF', 'Тоны набираются, но собеседник их игнорирует'), 'keypad'));
  grid.append(mk('Динамик', ICON.speaker(), () => {}, 'speaker'));
  grid.append(mk('Удержание', ICON.pause(), () => { stateEl.textContent = callState.hold ? 'Удержание…' : 'В разговоре'; }, 'hold'));
  grid.append(mk('Видео', ICON.video(), () => toast('📹', 'Видеозвонок', 'Собеседник отказался: «я не в форме»')),
    'video');
  grid.append(mk('Запись', ICON.mic(), () => toast('🎙️', 'Запись вызова', 'Записано 0 секунд: собеседник против')), 'rec');
  node.append(grid);

  const main = el('div', { class: 'callscr__main' });
  const hang = el('button', { class: 'callbtn decline', onclick: () => endCall() });
  hang.innerHTML = ICON.phoneOff();
  main.append(hang);
  node.append(main);

  sys.append(node);

  if (info.dir === 'out') {
    RING.dialing();
    vibrate(20);
    const answerDelay = rndInt(2600, 6000);
    callState.ringTimeout = setTimeout(() => {
      if (callState?.ended) return;
      stopBusy();
      connectCall(stateEl, timerEl);
    }, answerDelay);
  } else {
    // входящий: собеседник уже в трубке — соединяем сразу
    callState.answerTimeout = setTimeout(() => {
      if (callState?.ended) return;
      connectCall(stateEl, timerEl);
    }, 700);
  }
}

function connectCall(stateEl, timerEl) {
  const S = getState();
  callState.startedAt = S.time.gameMs;
  callState.realStart = Date.now();
  node_state(stateEl);
  stateEl.textContent = callState.hold ? 'Удержание…' : 'В разговоре';
  $('#layer-apps').classList.add('incall');
  callState.node.classList.add('incall');
  SFX.click();

  callState.interval = setInterval(() => {
    if (!callState) return;
    callState.seconds = Math.floor((Date.now() - callState.realStart) / 1000);
    timerEl.textContent = fmtDur(callState.seconds);
  }, 500);

  // ответ собеседника
  setTimeout(() => {
    if (!callState || callState.ended) return;
    const txt = callReply(callState.number, callState.name);
    toast('📞', callState.name, txt, 6500);
  }, 1400);
}
function node_state() {}

function callReply(number, name) {
  const S = getState();
  const svc = SERVICES[number];
  if (svc?.reply) return svc.reply;
  if (svc?.ivr) return `${svc.name}: «Выберите раздел в меню ниже»`;
  const lines = {
    mom: 'Мама: «Сынок! Наконец-то позвонил. Я тут борщ… алло? Плохо слышно, у тебя что, новый телефон?»',
    kirill: 'Кирилл: «Алло! Ну чё, рекорд побил? Я тут пельмени варю, заходи в змейку, потом перезвоню.»',
    anya: 'Аня: «Ой, привет… неожиданно 🙂 Ты с нового телефона звонишь? Голос как из студии.»',
    dad: 'Папа: «Да. Слушаю. …Понял. Перезвоню.» (короткие гудки)',
    spam: 'Автоинформатор: «Ваша яхта ждёт вас! Нажмите 1, чтобы подтвердить доставку…» (вы сбросили)'
  };
  const c = contactByPhone(number);
  if (c && lines[c.id]) return lines[c.id];
  return pick([
    `${name}: «Алло? Вы кто? Номер незнакомый…»`,
    '«Аппарат вызываемого абонента выключен или находится вне зоны действия сети»',
    '«Извините, я за рулём. Перезвоню.»',
    'Долгие гудки… и никто не ответил.'
  ]);
}

export function endCall() {
  const S = getState();
  if (!callState) return;
  const cs = callState;
  cs.ended = true;
  clearTimeout(cs.ringTimeout);
  clearTimeout(cs.answerTimeout);
  clearInterval(cs.interval);
  stopBusy(); stopRing();
  window.__inCall = false;
  const duration = cs.seconds || 0;
  if (cs.startedAt) {
    S.calls.push({ id: uid('call'), number: cs.number, name: cs.name, dir: cs.dir, at: cs.startedAt, duration });
    S.stats.calls++;
    S.stats.callSec += duration;
    completeTask('t14');
    unlock('call');
    // расход минут
    const op = OPERATORS[S.phone.sim.operator];
    if (op && op.minutes !== Infinity) {
      S.phone.data.minutesUsed = (S.phone.data.minutesUsed || 0) + Math.max(1, Math.round(duration / 60));
    }
  }
  cs.node?.remove();
  callState = null;
  RING.hangup();
  save();
  emit(EV.STATE);
  if (inst && tab === 'calls') render();
  if (duration > 0) toast('📞', 'Вызов завершён', `${cs.name} · ${fmtDur(duration)}`);
}

async function ussd(code) {
  const S = getState();
  const op = OPERATORS[S.phone.sim.operator];
  if (!op) { toast('📵', 'Команда не выполнена', 'Нет SIM-карты'); return; }

  const sys = $('#syslayer');
  const back = el('div', { class: 'ussd' });
  const box = el('div', { class: 'ussd__box' });
  box.append(
    el('div', { class: 'u-t', text: code }),
    el('div', { class: 'u-b', text: 'Отправка запроса…' }),
    el('div', { class: 'boot__spinner', style: { margin: '16px auto 0' } })
  );
  back.append(box);
  sys.append(back);
  SFX.dtmf(0);
  vibrate(15);

  await new Promise((r) => setTimeout(r, rndInt(900, 1600)));
  back.remove();

  let text;
  if (code === '*100#' || code === '*100') {
    text = op.ussd
      .replace('{bal}', S.bank.balance.toFixed(2))
      .replace('{min}', String(Math.max(0, (op.minutes || 0) - (S.phone.data.minutesUsed || 0))))
      .replace('{sms}', String(op.sms || 0))
      .replace('{gb}', String(Math.max(0, (S.phone.data.limitGb - S.phone.data.usedGb)).toFixed(1)));
  } else if (code === '*111#') {
    text = 'Услуги:\n1. Безлимит на соцсети — 2 €/день\n2. Роуминг ЕС — 5 €/день\n3. Антиспам — бесплатно\n\nОтветьте SMS с номером услуги на 1111.';
  } else if (code === '#31#') {
    text = 'Антиопределитель включён на один вызов.\nТеперь вы «Неизвестный абонент».\nУслуга платная: 0,50 €.';
    S.bank.balance -= 0.5;
  } else if (code === '*111*1#') {
    text = 'Подключено: «Безлимит на соцсети».\nСписание 2,00 € в день.\nОтключение: *111*1*0#';
  } else {
    text = `Команда ${code} не поддерживается.\n\nДоступные команды:\n*100# — баланс и остатки\n*111# — услуги\n*111*1# — безлимит на соцсети\n#31# — скрыть номер`;
  }
  await sysDialog({
    title: `${op.name}: ответ сети`, icon: '📟',
    text: text.replace(/\n/g, '<br/>'),
    buttons: [{ label: 'Закрыть', value: true, cls: 'primary' }]
  });
  save();
  emit(EV.STATE);
}

/* =========================================================
   ВХОДЯЩИЕ ЗВОНКИ
   ========================================================= */
let incomingNode = null;

export function incomingCall(contactId) {
  const S = getState();
  if (callState || incomingNode) return;
  if (S.phone.dnd || S.phone.airplane) return;
  const c = S.contacts.find((x) => x.id === contactId);
  if (!c || c.blocked) return;

  RING.incoming(S.phone.ringtone || 'nova');
  vibrate(60);
  const sys = $('#syslayer');
  const node = el('div', { class: 'callscr' });
  node.append(el('div', { style: { marginTop: '10px' } }, avatar(c, 'lg')));
  node.append(el('div', { class: 'callscr__name', text: displayName(c) }));
  node.append(el('div', { class: 'callscr__num', text: c.phone }));
  node.append(el('div', { class: 'callscr__state', text: 'Входящий вызов…' }));
  node.append(el('div', { class: 'callscr__spacer' }));

  const main = el('div', { class: 'callscr__main' });
  const decline = el('button', { class: 'callbtn decline', onclick: () => finish(false) });
  decline.innerHTML = ICON.phoneOff();
  const answer = el('button', { class: 'callbtn answer', onclick: () => finish(true) });
  answer.innerHTML = ICON.phone();
  main.append(decline, answer);
  node.append(main);
  sys.append(node);
  incomingNode = node;
  window.__wake?.();

  const autoEnd = setTimeout(() => finish(false), 22000);

  function finish(accepted) {
    clearTimeout(autoEnd);
    stopRing();
    node.remove();
    incomingNode = null;
    if (accepted) {
      startCall(c.phone, 'in');
    } else {
      S.calls.push({ id: uid('call'), number: c.phone, name: displayName(c), dir: 'missed', at: S.time.gameMs, duration: 0, unread: true });
      notify({
        appId: 'phone', icon: '📵', color: '#ef4444', title: `Пропущенный вызов · ${displayName(c)}`,
        text: `${c.phone} · ${fmtTime(new Date(S.time.gameMs))}`,
        action: { type: 'app', id: 'phone', params: { call: c.phone } }
      });
      save();
      emit(EV.STATE);
      // голосовое сообщение
      setTimeout(() => {
        window.__botMsg?.(c.id, `📵 Я звонил(а), ты не взял. Перезвони, когда сможешь.`);
      }, 6000);
    }
  }
}

let ambientCallAcc = 0;
export function ambientCallTick(dtReal) {
  const S = getState();
  if (S.stage !== 'ready' || !S.phone.sim.inserted || !S.phone.setupDone) return;
  ambientCallAcc += dtReal;
  if (ambientCallAcc < 90) return;
  ambientCallAcc = 0;
  if (Math.random() > 0.12) return;
  if (S.phone.dnd) return;
  incomingCall(pick(['mom', 'kirill', 'dad', 'anya', 'spam']));
}

on(EV.STATE, () => { if (inst && !callState) render(); });
