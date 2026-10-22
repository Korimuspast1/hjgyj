import { getState, save, OPERATORS, completeTask } from './state.js';
import { emit, EV, on } from './bus.js';
import { SFX, RING, stopAlarm } from './audio.js';
import { pad2, fmtTime, rndInt, pick } from './util.js';

let lastReal = 0;
let running = false;

export function startClock() {
  if (running) return;
  running = true;
  lastReal = performance.now();
  requestAnimationFrame(loop);
}

function loop(now) {
  if (!running) return;
  const dtReal = Math.min(2000, now - lastReal) / 1000; // сек
  lastReal = now;
  const S = getState();
  if (!S) { requestAnimationFrame(loop); return; }

  // игровое время
  const before = S.time.gameMs;
  S.time.gameMs += dtReal * 1000 * S.time.speed;
  if (S.phone.on) S.phone.uptimeSec += dtReal;

  tickBattery(dtReal);
  tickSignal(dtReal);
  tickWorld(before, S.time.gameMs);

  emit(EV.TIME, { dtReal, gameMs: S.time.gameMs });
  requestAnimationFrame(loop);
}

export function setSpeed(x) {
  const S = getState();
  S.time.speed = x;
  save();
}

export function advance(hours) {
  const S = getState();
  S.time.gameMs += hours * 3600 * 1000;
  tickWorld(S.time.gameMs - hours * 3600 * 1000, S.time.gameMs);
  emit(EV.TIME, { dtReal: 0, gameMs: S.time.gameMs });
}

/* ---------------- БАТАРЕЯ ---------------- */
let battSaveAcc = 0;
function tickBattery(dtReal) {
  const S = getState();
  const b = S.phone.battery;
  const world = S.world;
  b.charging = !!world.chargerPlugged;

  if (b.charging) {
    if (!S.flags.chargeStarted) { S.flags.chargeStarted = true; }
    const rate = b.pct < 50 ? 0.85 : b.pct < 80 ? 0.5 : 0.22; // %/сек
    const before = b.pct;
    b.pct = Math.min(100, b.pct + rate * dtReal);
    b.temp = Math.min(39, b.temp + dtReal * 0.03);
    [20, 50, 80, 100].forEach((m) => {
      if (before < m && b.pct >= m) {
        emit('battery-milestone', m);
        if (m === 100) {
          window.__ach?.('fullcharge', '100%', 'Батарея полностью заряжена');
          completeTask('t15');
        }
      }
    });
    if (b.pct >= 3 && S.stage === 'dead') reviveFromDead();
  } else {
    S.flags.chargeStarted = false;
    b.temp = Math.max(28, b.temp - dtReal * 0.02);
    let drain = 0.035; // %/сек базово
    if (S.phone.awake) drain += 0.05;
    if (window.__batteryHeavy) drain += 0.16;
    if (S.phone.data.on && S.phone.sim.inserted) drain += 0.02;
    if (S.phone.wifi.on) drain += 0.008;
    if (S.phone.bt.on) drain += 0.008;
    if (S.phone.flashlight) drain += 0.09;
    if (S.phone.airplane) drain -= 0.03;
    if (S.music.playing) drain += 0.03;
    if (window.__inCall) drain += 0.1;
    b.pct = Math.max(0, b.pct - Math.max(0.006, drain) * dtReal);
    if (b.pct <= 15 && !S.flags.lowWarned) {
      S.flags.lowWarned = true;
      window.__notify?.({ app: 'system', icon: '🪫', title: 'Низкий заряд', text: 'Осталось 15%. Подключите зарядное устройство.', color: '#ef4444' });
    }
    if (b.pct <= 5 && !S.flags.critWarned) {
      S.flags.critWarned = true;
      window.__notify?.({ app: 'system', icon: '🪫', title: 'Критический заряд 5%', text: 'Телефон скоро выключится. Подключите кабель со стола!', color: '#ef4444', persistent: true });
    }
    if (b.pct > 20) { S.flags.lowWarned = false; S.flags.critWarned = false; }
    if (b.pct <= 0) shutdownFromBattery();
  }
  battSaveAcc += dtReal;
  if (battSaveAcc > 5) { battSaveAcc = 0; save(); }
  emit(EV.BATTERY, b);
}

function shutdownFromBattery() {
  const S = getState();
  if (S.stage === 'dead') return;
  S.stage = 'dead';
  S.phone.on = false; S.phone.awake = false;
  S.phone.lastShutdownReason = 'battery';
  stopAlarm();
  window.__powerOff?.('Батарея разряжена');
  window.__notify?.({ app: 'system', icon: '🪫', title: 'Телефон выключился', text: 'Батарея села. Подключите USB-C кабель со стола.', color: '#ef4444', persistent: true });
}

function reviveFromDead() {
  const S = getState();
  if (S.stage !== 'dead') return;
  S.stage = 'ready';
  S.phone.lastShutdownReason = null;
  window.__powerOn?.();
  window.__toast?.('🔌', 'Заряд пошёл', 'Телефон ожил — держи кнопку питания, чтобы включить');
}

export function isCharging() { return getState().phone.battery.charging; }

/* ---------------- СЕТЬ ---------------- */
let sigAcc = 0;
function tickSignal(dt) {
  const S = getState();
  const sim = S.phone.sim;
  sigAcc += dt;
  if (sigAcc < 3) return;
  sigAcc = 0;
  if (!sim.inserted || S.phone.airplane || !S.phone.on) { sim.signal = 0; return; }
  const base = sim.operator === 'mobiline' ? 3.4 : 2.8;
  const h = new Date(S.time.gameMs).getHours();
  const nightBoost = (h >= 0 && h < 6) ? 0.6 : 0;
  sim.signal = Math.max(1, Math.min(4, Math.round(base + nightBoost + rndInt(-1, 1))));
  emit(EV.NET, sim);
}

/* ---------------- МИР: события по игровому времени ---------------- */
const fired = new Set();
function tickWorld(before, after) {
  const S = getState();
  const bd = new Date(before), ad = new Date(after);
  if (bd.getDate() === ad.getDate() && bd.getHours() === ad.getHours()) return;

  const key = (h, m) => `${ad.toDateString()}|${h}:${m}`;

  // новый день
  if (bd.getDate() !== ad.getDate()) {
    dailyRollover(ad);
  }

  // ежемесячная (ежедневная для игры) абонплата
  if (ad.getHours() === 9 && bd.getHours() !== 9) {
    chargeTariff();
  }

  // сюжетные сообщения по времени
  scheduleByHour(ad);
  save();
}

function dailyRollover(d) {
  const S = getState();
  S.weather.seed = (S.weather.seed + 7919) % 100000;
  S.flags.todayStr = d.toDateString();
  window.__daily?.(d);
}

function chargeTariff() {
  const S = getState();
  const op = S.phone.sim.operator;
  if (!op || !OPERATORS[op]) return;
  const price = OPERATORS[op].price;
  if (S.flags.tariffChargedDay === new Date(S.time.gameMs).toDateString()) return;
  S.flags.tariffChargedDay = new Date(S.time.gameMs).toDateString();
  S.bank.balance -= price;
  S.bank.transactions.unshift({
    id: 'tx' + Date.now(), title: `${OPERATORS[op].name} — абонплата`, cat: 'Связь',
    amount: -price, at: S.time.gameMs, icon: '📶'
  });
  window.__notify?.({
    app: 'bank', icon: '🏦', title: `${OPERATORS[op].name}: списание ${price.toFixed(2)} €`,
    text: `Ежедневная абонплата по тарифу «${OPERATORS[op].tariff}»`, color: '#4ade80'
  });
  window.__sysMsg?.('bank', `Списано ${price.toFixed(2)} € за связь. Баланс карты: ${S.bank.balance.toFixed(2)} €`);
  save();
}

function scheduleByHour(d) {
  const S = getState();
  const h = d.getHours();
  const day = d.getDay();
  const k = (x) => `${d.toDateString()}-${x}`;

  if (S.stage !== 'ready' || !S.phone.setupDone) return;

  if (h === 8 && !fired.has(k('news8'))) {
    fired.add(k('news8'));
    window.__sysMsg?.('operator', S.phone.sim.operator
      ? `Доброе утро! Ваш пакет обновлён. Остаток: ${S.phone.sim.operator === 'telka' ? (S.phone.data.limitGb - S.phone.data.usedGb).toFixed(1) + ' ГБ' : '∞ ГБ'}.`
      : 'Доброе утро! У вас не установлена SIM-карта.');
  }
  if (h === 11 && day !== 0 && !fired.has(k('kir11'))) {
    fired.add(k('kir11'));
    window.__botMsg?.('kirill', pick([
      'ты уже накатал фоток на новый телефон? скинь хоть одну 😄',
      'го вечером в змейку? я поставил рекорд 42, попробуй перебить',
      'скинул тебе мем в галерею... ну то есть хотел скинуть, интернет не даёт 😅'
    ]));
  }
  if (h === 13 && !fired.has(k('mom13'))) {
    fired.add(k('mom13'));
    window.__botMsg?.('mom', pick([
      'Ты пообедал? Не сиди на одном телефоне 🙂',
      'Как там твой новый телефон? Покажешь, когда приедешь?',
      'Купил себе что-нибудь вкусное? Деньги ещё есть?'
    ]));
  }
  if (h === 17 && !fired.has(k('shop17'))) {
    fired.add(k('shop17'));
    window.__sysMsg?.('shop', pick([
      'Скидка 15% на чехлы и защитные стёкла до конца дня! Заходите в techshop.online',
      'Новинка: беспроводная зарядка Nova MagPad — 24,90 €. Успейте заказать!'
    ]));
  }
  if (h === 20 && !fired.has(k('spam20'))) {
    fired.add(k('spam20'));
    window.__botMsg?.('spam', '🎉 ПОЗДРАВЛЯЕМ! Вы стали 1 000 000-м пользователем! Заберите iPhone бесплатно: bit.ly/prize-nova');
  }
  if (h === 22 && !fired.has(k('anya22'))) {
    fired.add(k('anya22'));
    window.__botMsg?.('anya', pick([
      'не спится. что делаешь?',
      'смотри какое небо сегодня 🌙',
      'ты уже настроил свой новый телефон? расскажи как он'
    ]));
  }
  if (h === 7 && !fired.has(k('dad7'))) {
    fired.add(k('dad7'));
    window.__botMsg?.('dad', pick([
      'Доброе утро. Зарядка телефона на столе, не забудь.',
      'Проверь баланс, вчера приходила абонплата.'
    ]));
  }
}

/* ---------------- БУДИЛЬНИКИ ---------------- */
let alarmCheckAcc = 0;
on(EV.TIME, ({ dtReal }) => {
  const S = getState();
  alarmCheckAcc += dtReal;
  if (alarmCheckAcc < 1) return;
  alarmCheckAcc = 0;
  const now = new Date(S.time.gameMs);
  const hhmm = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const dow = now.getDay();

  for (const a of S.alarms) {
    if (!a.on) continue;
    if (a.ring) continue;
    if (a.snoozeUntil && S.time.gameMs >= a.snoozeUntil) {
      a.snoozeUntil = 0;
      triggerAlarm(a);
      continue;
    }
    if (a.time === hhmm && a.days.includes(dow)) {
      if (a.lastRingKey === S.time.gameMs.toString().slice(0, -5)) continue;
      a.lastRingKey = S.time.gameMs.toString().slice(0, -5);
      triggerAlarm(a);
    }
  }

  // таймер
  if (S.timer.running && S.time.gameMs >= S.timer.endsAt) {
    S.timer.running = false;
    emit('timer-done');
    window.__notify?.({ app: 'clock', icon: '⏱️', title: 'Таймер закончился', text: S.timer.label || '00:00', color: '#f97316' });
    RING.alarm('chime');
    setTimeout(() => stopAlarm(), 4000);
  }
});

function triggerAlarm(a) {
  const S = getState();
  a.ring = true;
  emit('alarm-ring', a);
  SFX.notif();
  window.__wake?.();
  save();
}

export function stopAlarmRing(a) {
  if (!a) return;
  a.ring = false; a.snoozeUntil = 0; a.on = true;
  stopAlarm();
  emit('alarm-stop', a);
  save();
}
export function snoozeAlarm(a, minutes = 9) {
  a.ring = false;
  a.snoozeUntil = getState().time.gameMs + minutes * 60000;
  stopAlarm();
  emit('alarm-stop', a);
  window.__toast?.('😴', 'Отложено', `Будильник «${a.label}» зазвонит через ${minutes} мин`);
  save();
}

/* ---------------- авто-выключение экрана ---------------- */
let screenIdle = 0;
export function activityPing() { screenIdle = 0; }
on(EV.TIME, ({ dtReal }) => {
  const S = getState();
  if (!S.phone.awake) return;
  screenIdle += dtReal;
  const timeout = S.phone.screenTimeout ?? 90;
  if (screenIdle > timeout) {
    screenIdle = 0;
    window.__screenOff?.();
  }
});

export function fmtGameTime(ms) {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
