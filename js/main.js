/* =====================================================================
   NOVA X5 Pro — симулятор смартфона
   main.js: точка входа. Инициализирует все системы, связывает
   глобальные хуки (window.__*), запускает игровое время и ambient-жизнь.
   ===================================================================== */

import { getState, initState, hasSave, save, clearSave, OPERATORS, completeTask } from './state.js';
import { on, EV, emit } from './bus.js';
import { api } from './api.js';
import { $, el, clear, fmtMoney, fmtTime, fmtDur, fmtDateShort, partOfDay, pad2, pick, rndInt, plural, clamp } from './util.js';
import { ICON } from './icons.js';
import { SFX, startFakeMusic, stopFakeMusic, setMasterVolume, unlockAudio } from './audio.js';
import { startClock, setSpeed, advance, activityPing } from './time.js';
import { initDesk, renderWorld, updateSky, hintForStage, openTariffChooser } from './desk.js';
import { startSetupWizard } from './setup.js';
import { initPhone, openApp, closeApp, goHome, back, powerOn } from './phone.js';
import { initAlarmUI } from './alarmui.js';
import { initToast, toast, coachmark, hideCoach, sysDialog, sysConfirm, worldModal } from './ui.js';
import { initHeadsUp, notify, clearAllNotifs, sysMsg, vibrate } from './notify.js';
import { unlock, ACHIEVEMENTS, progress } from './achievements.js';
import { render as renderHome, applyTheme } from './home.js';
import { tryUnlock } from './lock.js';
import { render as renderStatus } from './statusbar.js';
import { applyBrightness } from './shade.js';
import { wifiList, hasInternet, connectionLabel } from './net.js';
import { APPS, appMeta, STORE_CATALOG } from './registry.js';
import { today } from './weather.js';
import { startStory, ambientTick, botSay } from './apps/messages.js';
import { ambientCallTick, incomingCall } from './apps/phone.js';
import { addPhoto } from './apps/camera.js';

/* =====================================================================
   ГЛОБАЛЬНЫЕ ХУКИ
   ===================================================================== */
window.__renderWorld = renderWorld;
window.__activityPing = activityPing;
window.__startStory = startStory;
window.__botMsg = (id, text, opts) => botSay(id, text, opts);
window.__sysMsg = sysMsg;
window.__vibrate = vibrate;
window.__wifiList = wifiList;
window.__clearNotifs = () => { clearAllNotifs(); renderStatus(); };
window.__advance = advance;
window.__setSpeed = setSpeed;
window.__startFakeMusic = () => {
  const S = getState();
  const i = S.music.tracks.findIndex((t) => t.id === S.music.trackId);
  startFakeMusic(i < 0 ? 0 : i);
  setMasterVolume(S.phone.volume.media / 100 * 0.8);
};
window.__stopFakeMusic = stopFakeMusic;
window.__randomAmbient = () => { ambientTick(9999); };
window.__randomCall = () => {
  const S = getState();
  if (window.__inCall || S.phone.dnd) { toast('📵', 'Нельзя позвонить', 'Идёт звонок или включён режим «не беспокоить»'); return; }
  incomingCall(pick(['mom', 'kirill', 'dad', 'anya', 'spam']));
};

window.__afterPower = () => {
  hintForStage();
  renderWorld();
  updateSky();
  renderHud();
  // подсказка после включения
  const S = getState();
  if (S.phone.setupDone && !S.hintsShown.afterBoot) {
    S.hintsShown.afterBoot = true;
    save();
    setTimeout(() => toast('📱', 'Телефон включён', 'Свайп вниз от строки состояния — шторка уведомлений'), 1200);
  }
};

/* список приложений (для Настройки → Приложения) */
window.__appsList = () => {
  const S = getState();
  const out = {};
  Object.keys(APPS).forEach((id) => {
    const m = appMeta(id);
    const cat = STORE_CATALOG.find((x) => x.id === id);
    const installed = !APPS[id].mod ? true : (!cat || S.store.installed.includes(id) || id === 'snake' || id === 'radio' || id === 'recorder' || id === 'level');
    out[id] = {
      name: m.name,
      icon: cat?.emoji && APPS[id].emoji ? cat.emoji : (typeof m.icon === 'string' && m.icon.length < 4 ? m.icon : '📱'),
      color: m.color,
      size: cat?.size || 30 + (id.length * 7) % 60,
      system: !cat,
      installed
    };
  });
  return out;
};

/* «снимок» приложения для карточек недавних */
window.__appSnapshot = (id) => {
  const S = getState();
  switch (id) {
    case 'messages': {
      const unread = Object.values(S.messages.chats).reduce((a, c) => a + (c.unread || 0), 0);
      return unread ? `${unread} непрочитанных сообщений` : 'Нет новых сообщений';
    }
    case 'phone': return `Журнал: ${S.calls.length} ${plural(S.calls.length, ['звонок', 'звонка', 'звонков'])}`;
    case 'browser': {
      const t = S.browser.tabs[S.browser.activeTab];
      return t ? `Вкладка: ${t.title || t.url}` : 'Нет вкладок';
    }
    case 'camera': return `${S.photos.length} ${plural(S.photos.length, ['фото', 'фото', 'фото'])} в памяти`;
    case 'gallery': return `${S.photos.length} файлов · ${(S.phone.storage.photos).toFixed(2)} МБ`;
    case 'music': {
      const t = S.music.tracks.find((x) => x.id === S.music.trackId);
      return t ? `${S.music.playing ? '▶' : '⏸'} ${t.artist} — ${t.title}` : 'Библиотека пуста';
    }
    case 'clock': {
      const on = S.alarms.filter((a) => a.on).length;
      const t = S.timer.running ? ` · таймер ${fmtDur(Math.max(0, (S.timer.endsAt - S.time.gameMs) / 1000))}` : '';
      return `${on} ${plural(on, ['будильник', 'будильника', 'будильников'])} включено${t}`;
    }
    case 'calc': return S.calcHistory.length ? `Последнее: ${S.calcHistory[0].e} ${S.calcHistory[0].r}` : 'История пуста';
    case 'notes': return `${S.notes.length} ${plural(S.notes.length, ['заметка', 'заметки', 'заметок'])}`;
    case 'weather': { const t = today(); return `${t.city}: ${t.temp}° · ${t.cond.name}`; }
    case 'bank': return `Баланс ${fmtMoney(S.bank.balance)} · ${S.bank.transactions.length} операций`;
    case 'store': return `Установлено ${S.store.installed.length} из ${STORE_CATALOG.length}`;
    case 'files': return `Занято ${(S.phone.storage.apps + S.phone.storage.system + S.phone.storage.media + S.phone.storage.photos).toFixed(1)} ГБ из ${S.phone.storage.total} ГБ`;
    case 'snake': return `Рекорд: ${S.stats.snakeBest || 0} очков`;
    case 'radio': return S.radio.playing ? `В эфире: ${S.radio.station}` : 'Радио выключено';
    case 'recorder': return `${S.recordings.length} ${plural(S.recordings.length, ['запись', 'записи', 'записей'])}`;
    case 'level': return 'Пузырьковый уровень';
    case 'settings': return `NovaOS · ${S.phone.about.build}`;
    default: return `${appMeta(id).name} · свернуто`;
  }
};
/* остальные api-поля, которые phone.js не закрывает */
Object.assign(api, {
  hasInternet,
  connectionLabel,
  signalBars: () => getState().phone.sim.signal,
  spend: (amount, reason = 'Покупка') => {
    const S = getState();
    if (S.money < amount) {
      SFX.error();
      toast('💸', 'Не хватает наличных', `Нужно ${fmtMoney(amount)}, в кошельке ${fmtMoney(S.money)}. Пополните карту в NovaBank или внесите наличные.`);
      return false;
    }
    S.money -= amount;
    S.stats.spent = (S.stats.spent || 0) + amount;
    if (S.stats.spent >= 100) unlock('rich');
    save();
    emit(EV.MONEY);
    renderHud();
    return true;
  },
  earn: (amount, reason = 'Поступление') => {
    const S = getState();
    S.money += amount;
    S.bank.transactions.unshift({ id: 'tx' + Date.now(), title: reason, cat: 'Поступления', amount, at: S.time.gameMs, icon: '💶' });
    save();
    emit(EV.MONEY);
    renderHud();
    SFX.coin();
  },
  botSay,
  incomingCall,
  addPhoto,
  openTariff: () => import('./desk.js').then((m) => m.openTariffChooser()),
  setOperator: (opId) => import('./desk.js').then((m) => m.activateSim(opId)),
  playMusic: () => { const S = getState(); if (!S.music.playing) api.toggleMusic?.(); },
  stopMusic: () => { const S = getState(); if (S.music.playing) api.toggleMusic?.(); }
});

/* =====================================================================
   ИГРОВОЙ ЦИКЛ: ambient-события, HUD, небо
   ===================================================================== */
let lastAmbient = performance.now();
let lastHud = 0;
let lastSky = 0;

function mainLoop(now) {
  const dt = Math.min(3000, now - lastAmbient) / 1000;
  lastAmbient = now;
  const S = getState();
  if (S) {
    ambientTick(dt);
    ambientCallTick(dt);
    if (now - lastHud > 500) { lastHud = now; renderHud(); }
    if (now - lastSky > 4000) { lastSky = now; updateSky(); }
  }
  requestAnimationFrame(mainLoop);
}

/* дневные события (time.js вызывает window.__daily каждый игровой день) */
window.__daily = (d) => {
  const S = getState();
  if (S.stage !== 'ready') return;
  const day = d.toLocaleDateString('ru-RU');
  if (S.flags.todayStr === day) return;
  S.flags.todayStr = day;
  save();
  if (!S.phone.setupDone) return;

  const hour = new Date(S.time.gameMs).getHours();
  setTimeout(() => {
    if (hour >= 5 && hour < 12) {
      botSay('mom', pick(['Доброе утро! Ты позавтракал?', 'Утро! Не забудь зарядку для телефона 😄', 'Проснулся? Хорошего дня!']), { delay: 700 });
    } else if (hour >= 22) {
      botSay('kirill', pick(['ты ещё не спишь? я вот нет', 'ночная смена началась 🌙', 'го в змейку играть, я на 240 очках']), { delay: 700 });
    } else {
      botSay('anya', pick(['как дела?', 'скинь фотку стола, хочу посмотреть', 'я тут подумала… может в кино?']), { delay: 700 });
    }
  }, 2500);
};

/* =====================================================================
   HUD (правая панель мира)
   ===================================================================== */
function renderHud() {
  const S = getState();
  if (!S) return;
  const money = $('#hud-money');
  if (money) money.textContent = fmtMoney(S.money);

  const batt = $('#hud-batt');
  if (batt) {
    const b = S.phone.battery;
    batt.textContent = S.phone.on ? `${Math.round(b.pct)}%${b.charging ? ' ⚡' : ''}` : 'выключен';
    batt.style.color = b.pct < 15 ? '#f87171' : b.pct < 35 ? '#fbbf24' : '';
  }

  const net = $('#hud-net');
  if (net) {
    if (!S.phone.sim.inserted && !S.phone.wifi.ssid) net.textContent = S.phone.airplane ? '✈️ авиарежим' : 'нет SIM';
    else net.textContent = connectionLabel();
  }

  const d = new Date(S.time.gameMs);
  const t = $('#hud-time');
  if (t) t.textContent = fmtTime(d);
  const day = $('#hud-day');
  if (day) day.textContent = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });

  const tasks = $('#hud-tasks');
  if (tasks) {
    clear(tasks);
    S.tasks.filter((x) => !x.done).slice(0, 6).forEach((x) => {
      tasks.append(el('li', { text: x.text }));
    });
    if (!S.tasks.some((x) => !x.done)) tasks.append(el('li', { class: 'done', text: '✨ Все задачи выполнены!' }));
  }

  const achWrap = $('#hud-ach');
  const achCount = $('#hud-ach-count');
  const p = progress();
  if (achCount) achCount.textContent = `${p.got}/${p.total}`;
  if (achWrap) {
    clear(achWrap);
    ACHIEVEMENTS.filter((a) => S.achievements[a.id]).slice(-8).reverse().forEach((a) => {
      achWrap.append(el('div', { class: 'ach-chip', title: a.desc }, el('span', { text: a.icon }), el('b', { text: a.name })));
    });
    if (!p.got) achWrap.append(el('div', { class: 'ach-empty', text: 'Пока пусто — снимите плёнку с экрана 😉' }));
  }
}

/* =====================================================================
   ПОМОЩЬ / СБРОС
   ===================================================================== */
function helpModal() {
  worldModal(`
    <div class="help-grid">
      <div><b>1. Распаковка.</b> Кликните по коробке → вытащите телефон (тяните вверх) → снимите плёнку (тяните за ярлычок).</div>
      <div><b>2. SIM-карта.</b> Возьмите скрепку со стола → нажмите отверстие на правой грани → перетащите SIM в лоток → задвиньте лоток → выберите оператора.</div>
      <div><b>3. Питание.</b> Зажмите кнопку справа на корпусе (~1 сек). Короткое нажатие — включить/выключить экран.</div>
      <div><b>4. Жесты.</b> Свайп сверху — шторка уведомлений. Свайп снизу — домой / недавние приложения. Esc — назад.</div>
      <div><b>5. Интернет.</b> Нужен Wi-Fi <code>Home_Nova_5G</code> (пароль на роутере и в заметке) или мобильные данные с SIM.</div>
      <div><b>6. Деньги.</b> Наличные в кошельке на столе, карта в приложении NovaBank. Тариф оператора списывает деньги каждый день.</div>
      <div><b>7. Батарея.</b> Разряжается от экрана, камеры, звонков и интернета. Кабель USB-C лежит на столе.</div>
      <div><b>8. Прогресс.</b> Справа — задачи и достижения. Всё сохраняется автоматически в вашем браузере.</div>
    </div>
    <p class="help-note">Секрет: в Настройки → О телефоне нажмите 7 раз на «Номер сборки».</p>
  `, 'Как играть');
}

async function resetGame() {
  const ok = await sysConfirm('Сбросить игру?',
    'Всё сохранение будет удалено: фото, переписки, покупки, достижения. Телефон снова окажется в закрытой коробке.',
    'Сбросить всё', true);
  if (!ok) return;
  stopFakeMusic();
  clearSave();
  location.reload();
}

/* =====================================================================
   СТАРТ
   ===================================================================== */
function startGame(fresh) {
  initState(fresh);
  const S = getState();

  // мир
  $('#intro').classList.add('gone');
  setTimeout(() => { $('#intro').style.display = 'none'; }, 620);
  $('#game').hidden = false;

  initDesk();
  initToast();
  initHeadsUp();
  initPhone();
  initAlarmUI();

  // события шины → обновление мира/HUD
  on(EV.STATE, () => { renderHud(); renderWorld(); });
  on(EV.MONEY, renderHud);
  on(EV.ACH, renderHud);
  on(EV.TASK, renderHud);
  on(EV.BATTERY, renderHud);
  on(EV.NET, () => { renderHud(); renderStatus(); });
  on(EV.TIME, () => { renderStatus(); });

  // первый пользовательский жест — разблокировать WebAudio
  const kick = () => { unlockAudio(); window.removeEventListener('pointerdown', kick); };
  window.addEventListener('pointerdown', kick);

  // HUD-кнопки
  $('#btn-hud-help')?.addEventListener('click', helpModal);
  $('#btn-hud-reset')?.addEventListener('click', resetGame);

  startClock();
  renderWorld();
  updateSky();
  renderHud();
  hintForStage();

  // восстановить состояние телефона после перезагрузки страницы
  if (S.phone.on) {
    $('#screen').classList.add('awake');
    applyTheme();
    applyBrightness();
    renderStatus();
    if (!S.phone.awake) S.phone.awake = true;
    if (S.phone.setupDone) {
      S.stage = 'ready';
      renderHome();
      tryUnlock();
      if (S.music.playing) window.__startFakeMusic();
    } else {
      // Телефон включён, но мастер настройки не завершён (страницу перезагрузили
      // посреди настройки). Без этого пользователь увидел бы «живой» домашний
      // экран, который не отвечает на нажатия, — возвращаем мастер настройки.
      renderHome();
      setTimeout(async () => {
        const St = getState();
        if (!St.phone.on || St.phone.setupDone || St.stage === 'ready') return;
        if (St.stage === 'tariff') { try { await openTariffChooser(); } catch (e) { /* пользователь решит позже */ } }
        if (!getState().phone.setupDone && getState().stage !== 'ready') {
          startSetupWizard(clamp(getState().flags.setupStep | 0, 0, 7));
        }
      }, 700);
    }
  }
  if (S.stage === 'ready' && S.phone.setupDone && !S.flags.storyStarted) {
    setTimeout(() => startStory(), 1500);
  }

  requestAnimationFrame(mainLoop);
  save();

  setTimeout(() => {
    if (S.stage === 'box') coachmark('Добро пожаловать! Ты только что купил NOVA X5 Pro. Кликни по коробке на столе.', $('#prop-box'));
  }, 700);
}

function boot() {
  const cont = $('#btn-continue');
  if (hasSave()) {
    cont.hidden = false;
    cont.addEventListener('click', () => { SFX.tap(); startGame(false); });
  } else {
    cont.hidden = true;
  }
  $('#btn-new').addEventListener('click', async () => {
    SFX.tap();
    if (hasSave()) {
      const ok = await sysConfirm('Начать заново?', 'Текущее сохранение будет удалено: все фото, переписки и покупки пропадут.', 'Начать заново', true);
      if (!ok) return;
      clearSave();
    }
    startGame(true);
  });

  // клавиша H — помощь, даже до старта
  window.addEventListener('keydown', (e) => {
    if (e.key === 'h' || e.key === 'H' || e.key === 'р' || e.key === 'Р') {
      if (!$('#game').hidden && !document.querySelector('.sysdialog-backdrop')) helpModal();
    }
  });
}

boot();
