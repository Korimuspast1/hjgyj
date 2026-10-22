import { getState, save, completeTask, WIFI_NETWORKS, WALLPAPERS } from './state.js';
import { emit, EV } from './bus.js';
import { api } from './api.js';
import { ICON } from './icons.js';
import { SFX } from './audio.js';
import { unlock } from './achievements.js';
import { $, el, clear, sleep, holdProgress, clamp, rndInt } from './util.js';
import { notify } from './notify.js';
import { toast } from './ui.js';
import { wallpaperCss } from './home.js';
import { connectWifi } from './net.js';

const STEPS = ['welcome', 'lang', 'wifi', 'data', 'fp', 'pin', 'personal', 'done'];
let idx = 0, root = null, wifiSel = null, pendingPass = null;

export function startSetupWizard(fromStep = 0) {
  const S = getState();
  S.stage = 'setup';
  idx = fromStep;
  const sys = $('#syslayer');
  clear(sys);
  root = el('div', { class: 'setup' });
  root.append(el('div', { class: 'setup__bg' }));
  sys.append(root);
  renderStep();
}

function stepsBar() {
  const n = el('div', { class: 'setup__steps' });
  STEPS.slice(0, -1).forEach((_, i) => n.append(el('i', { class: i <= idx ? 'done' : '' })));
  return n;
}

function renderStep() {
  const S = getState();
  clear(root);
  root.append(el('div', { class: 'setup__bg' }));
  const body = el('div', { class: 'setup__body' });
  const foot = el('div', { class: 'setup__foot' });
  body.append(stepsBar());

  const next = (label = 'Далее', fn = () => { idx++; renderStep(); }) =>
    foot.append(el('button', { class: 'btn btn--primary btn--big', text: label, onclick: () => { SFX.click(); fn(); } }));
  const skip = (label = 'Пропустить') =>
    foot.append(el('button', { class: 'btn btn--ghost btn--big', text: label, onclick: () => { SFX.tap(); idx++; renderStep(); } }));

  const step = STEPS[idx];

  /* ---------- 1. приветствие ---------- */
  if (step === 'welcome') {
    body.append(
      el('div', { class: 'setup__ico', text: '📱' }),
      el('h2', { text: 'Добро пожаловать!' }),
      el('p', { class: 'lead', text: 'Это ваш новый NOVA X5 Pro. Давайте настроим его за пару минут: язык, интернет, блокировка экрана и отпечаток пальца.' }),
      el('div', { class: 'opt', style: { cursor: 'default' } },
        el('div', { class: 'o-ico', text: '🧠' }),
        el('div', { class: 'o-t' }, el('b', { text: 'Nova Titan G3' }), el('span', { text: '8 ядер · 12 ГБ ОЗУ · 256 ГБ памяти' }))),
      el('div', { class: 'opt', style: { cursor: 'default' } },
        el('div', { class: 'o-ico', text: '📷' }),
        el('div', { class: 'o-t' }, el('b', { text: 'Камера 108 МП' }), el('span', { text: 'Три модуля: основной, ультраширокий, теле' }))),
      el('div', { class: 'opt', style: { cursor: 'default' } },
        el('div', { class: 'o-ico', text: '🔋' }),
        el('div', { class: 'o-t' }, el('b', { text: '5000 мА·ч' }), el('span', { text: 'Быстрая зарядка 33 Вт' })))
    );
    next('Начать настройку');
  }

  /* ---------- 2. язык ---------- */
  else if (step === 'lang') {
    body.append(el('div', { class: 'setup__ico', text: '🌐' }), el('h2', { text: 'Выберите язык' }), el('p', { class: 'lead', text: 'Язык интерфейса и клавиатуры.' }));
    const langs = [
      { id: 'ru', n: 'Русский', s: 'Россия · Беларусь · Казахстан' },
      { id: 'uk', n: 'Українська', s: 'Україна' },
      { id: 'en', n: 'English', s: 'United States' },
      { id: 'nl', n: 'Nederlands', s: 'België' },
      { id: 'fr', n: 'Français', s: 'France' }
    ];
    let sel = S.phone.lang || 'ru';
    langs.forEach((l) => {
      const o = el('div', { class: 'opt' + (l.id === sel ? ' sel' : ''), onclick: () => {
        sel = l.id;
        [...body.querySelectorAll('.opt')].forEach((x) => { x.classList.remove('sel'); x.querySelector('.o-chk').textContent = ''; });
        o.classList.add('sel'); o.querySelector('.o-chk').textContent = '✓';
        SFX.tap();
      } },
        el('div', { class: 'o-ico', text: { ru: '🇷🇺', uk: '🇺🇦', en: '🇬🇧', nl: '🇧🇪', fr: '🇫🇷' }[l.id] }),
        el('div', { class: 'o-t' }, el('b', { text: l.n }), el('span', { text: l.s })),
        el('div', { class: 'o-chk', text: l.id === sel ? '✓' : '' }));
      body.append(o);
    });
    next('Далее', () => {
      S.phone.lang = sel;
      if (sel !== 'ru') toast('🌐', 'Язык интерфейса', 'Перевод пока доступен только для русского — остальное в следующем обновлении NovaOS');
      save(); idx++; renderStep();
    });
  }

  /* ---------- 3. Wi-Fi ---------- */
  else if (step === 'wifi') {
    body.append(el('div', { class: 'setup__ico', text: '📶' }), el('h2', { text: 'Подключитесь к Wi-Fi' }), el('p', { class: 'lead', text: 'Рядом найдены сети. Пароль от домашней написан на роутере — на столе справа.' }));
    const list = el('div');
    const render = () => {
      clear(list);
      WIFI_NETWORKS.forEach((n) => {
        const row = el('div', { class: 'wifi-row' + (wifiSel === n.ssid ? ' sel' : ''), onclick: () => pick(n) });
        const ic = el('span', { html: n.secured ? ICON.wifi(n.signal) : ICON.wifi(n.signal), style: { display: 'flex' } });
        row.append(ic);
        row.append(el('div', { class: 'w-name-wrap' },
          el('div', { class: 'w-name', text: n.ssid }),
          el('div', { class: 'w-meta', text: `${n.freq} · сигнал ${'█'.repeat(n.signal)}${'░'.repeat(4 - n.signal)}${n.secured ? ' · 🔒 защищена' : ' · открытая'}` })));
        list.append(row);
      });
    };
    const pick = async (n) => {
      wifiSel = n.ssid;
      render();
      SFX.tap();
      if (n.secured) {
        const res = await promptPass(n);
        if (res === null) { wifiSel = null; render(); return; }
      pendingPass = { ssid: n.ssid, pass: res };
      }
    };
    body.append(list);
    render();
    skip('Настроить позже');
    next('Подключиться', async () => {
      if (!wifiSel) { idx++; renderStep(); return; }
      const n = WIFI_NETWORKS.find((x) => x.ssid === wifiSel);
      await connectWifi(n, { pass: pendingPass?.pass });
      idx++; renderStep();
    });
  }

  /* ---------- 4. Мобильные данные ---------- */
  else if (step === 'data') {
    const S2 = getState();
    const hasSim = S2.phone.sim.inserted && S2.phone.sim.operator;
    body.append(
      el('div', { class: 'setup__ico', text: hasSim ? '📡' : '📵' }),
      el('h2', { text: 'Мобильный интернет' }),
      hasSim
        ? el('p', { class: 'lead', text: `SIM-карта ${S2.phone.sim.number} распознана. Включить передачу данных? Пакет: ${S2.phone.data.limitGb >= 999 ? 'безлимит' : S2.phone.data.limitGb + ' ГБ'}.` })
        : el('p', { class: 'lead', text: 'SIM-карта не обнаружена. Мобильный интернет недоступен — его можно включить позже, когда установите SIM.' })
    );
    if (hasSim) {
      const o = el('div', { class: 'opt sel' },
        el('div', { class: 'o-ico', text: '📶' }),
        el('div', { class: 'o-t' }, el('b', { text: 'Передача данных' }), el('span', { text: '4G/5G · расход из пакета оператора' })),
        el('div', { class: 'o-chk', text: '✓' }));
      let on = true;
      o.addEventListener('click', () => {
        on = !on;
        o.classList.toggle('sel', on);
        o.querySelector('.o-chk').textContent = on ? '✓' : '';
        SFX.tap();
      });
      body.append(o);
      next('Далее', () => { S2.phone.data.on = on; save(); idx++; renderStep(); });
    } else {
      next('Понятно');
    }
  }

  /* ---------- 5. отпечаток ---------- */
  else if (step === 'fp') {
    body.append(el('div', { class: 'setup__ico', text: '👆' }), el('h2', { text: 'Отпечаток пальца' }),
      el('p', { class: 'lead', text: 'Приложите палец к сканеру 5 раз, чтобы разблокировать телефон одним касанием.' }));
    const sensor = el('div', { class: 'fp-sensor' });
    sensor.innerHTML = ICON.fingerprint();
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    ring.setAttribute('viewBox', '0 0 120 120');
    ring.setAttribute('class', 'fp-ring');
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', '58');
    const C = 2 * Math.PI * 58;
    c.setAttribute('stroke-dasharray', String(C));
    c.setAttribute('stroke-dashoffset', String(C));
    ring.append(c);
    sensor.append(ring);
    const counter = el('p', { class: 'lead', style: { textAlign: 'center' }, text: 'Касаний: 0 из 5' });
    body.append(sensor, counter);
    let count = 0;
    const press = () => {
      if (count >= 5) return;
      count++;
      SFX.tap();
      counter.textContent = `Касаний: ${count} из 5`;
      c.setAttribute('stroke-dashoffset', String(C * (1 - count / 5)));
      if (count >= 5) {
        sensor.classList.add('done');
        counter.textContent = '✅ Отпечаток сохранён!';
        S.phone.user.fp = true;
        save();
        unlock('fp');
      }
    };
    sensor.addEventListener('pointerdown', press);
    skip('Пропустить');
    next('Далее');
  }

  /* ---------- 6. PIN ---------- */
  else if (step === 'pin') {
    body.append(el('div', { class: 'setup__ico', text: '🔐' }), el('h2', { text: 'Блокировка экрана' }),
      el('p', { class: 'lead', text: 'Задайте PIN-код из 4 цифр. Для игры по умолчанию уже стоит 1234 — можно оставить его.' }));
    const pad = el('div', { class: 'pinpad__grid', style: { margin: '10px auto' } });
    const dots = el('div', { class: 'pinpad__dots', style: { justifyContent: 'center' } });
    for (let i = 0; i < 4; i++) dots.append(el('i'));
    let entered = '';
    const upd = () => [...dots.children].forEach((d, i) => d.classList.toggle('filled', i < entered.length));
    const key = (k) => el('button', { class: 'pinpad__key', style: { width: '64px', height: '64px', fontSize: '22px' }, onclick: () => {
      if (entered.length >= 4) return;
      entered += k; SFX.key(); upd();
      if (entered.length === 4) { S.phone.user.pin = entered; S.phone.user.hasPin = true; save(); toast('🔐', 'PIN установлен', `Код: ${entered} — запомните его!`); setTimeout(() => { idx++; renderStep(); }, 700); }
    } }, el('span', { text: k }));
    ['1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach((k) => pad.append(key(k)));
    pad.append(el('button', { class: 'pinpad__key ghost', style: { width: '64px', height: '64px', fontSize: '11px' }, text: 'Сброс', onclick: () => { entered = ''; upd(); } }));
    pad.append(key('0'));
    pad.append(el('button', { class: 'pinpad__key ghost', style: { width: '64px', height: '64px', fontSize: '20px' }, text: '⌫', onclick: () => { entered = entered.slice(0, -1); upd(); SFX.tap(); } }));
    body.append(dots, pad);
    skip('Оставить 1234');
    next('Далее');
  }

  /* ---------- 7. персонализация ---------- */
  else if (step === 'personal') {
    body.append(el('div', { class: 'setup__ico', text: '🎨' }), el('h2', { text: 'Сделайте его своим' }),
      el('p', { class: 'lead', text: 'Выберите обои и тему. Всё это потом меняется в Настройках → Экран.' }));
    const nameInput = el('input', { class: 'sysdialog__input', style: { marginBottom: '14px' }, placeholder: 'Ваше имя (для профиля)', value: S.phone.user.name === 'Владелец' ? '' : S.phone.user.name });
    body.append(nameInput);

    const walls = el('div', { class: 'wall-grid' });
    let sel = S.phone.wallpaper;
    WALLPAPERS.forEach((w) => {
      const item = el('div', { class: 'wall-item' + (w.id === sel ? ' sel' : ''), style: { background: w.css }, title: w.name, onclick: () => {
        sel = w.id;
        [...walls.children].forEach((c) => c.classList.remove('sel'));
        item.classList.add('sel');
        SFX.tap();
      } });
      walls.append(item);
    });
    body.append(walls);

    const themeRow = el('div', { style: { display: 'flex', gap: '9px', margin: '16px 0' } });
    let theme = S.phone.theme;
    ['dark', 'light'].forEach((t) => {
      const b = el('button', {
        class: 'chip' + (t === theme ? ' on' : ''), text: t === 'dark' ? '🌙 Тёмная' : '☀️ Светлая',
        onclick: () => { theme = t; [...themeRow.children].forEach((x) => x.classList.remove('on')); b.classList.add('on'); SFX.tap(); }
      });
      themeRow.append(b);
    });
    body.append(themeRow);

    next('Завершить', () => {
      S.phone.wallpaper = sel;
      S.phone.lockWallpaper = sel;
      S.phone.theme = theme;
      if (nameInput.value.trim()) S.phone.user.name = nameInput.value.trim().slice(0, 24);
      save();
      emit(EV.THEME, theme);
      idx++; renderStep();
    });
  }

  /* ---------- 8. готово ---------- */
  else if (step === 'done') {
    body.append(
      el('div', { class: 'setup__ico', text: '🎉' }),
      el('h2', { text: 'Всё готово!' }),
      el('p', { class: 'lead', text: 'NOVA X5 Pro настроен и готов к работе. Сообщения уже пришли — мама волнуется.' })
    );
    const summary = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } });
    const line = (i, t, v) => summary.append(el('div', { class: 'opt', style: { cursor: 'default' } },
      el('div', { class: 'o-ico', text: i }),
      el('div', { class: 'o-t' }, el('b', { text: t }), el('span', { text: v }))));
    line('📶', 'SIM-карта', S.phone.sim.operator ? `${S.phone.sim.operator === 'mobiline' ? 'Mobiline' : 'Telka'} · ${S.phone.sim.number}` : 'не установлена');
    line('📡', 'Wi-Fi', S.phone.wifi.ssid || 'не подключён');
    line('🔐', 'Блокировка', (S.phone.user.hasPin ? `PIN ${S.phone.user.pin}` : 'нет') + (S.phone.user.fp ? ' + отпечаток' : ''));
    line('🎨', 'Оформление', `${S.phone.theme === 'dark' ? 'Тёмная тема' : 'Светлая тема'}`);
    body.append(summary);
    next('На домашний экран →', () => finishSetup());
  }

  root.append(body, foot);
}

async function promptPass(n) {
  return new Promise((resolve) => {
    const sys = $('#syslayer');
    const back = el('div', { class: 'sysdialog-backdrop' });
    const box = el('div', { class: 'sysdialog' });
    const input = el('input', { class: 'sysdialog__input', type: 'password', placeholder: 'Пароль' });
    box.append(el('div', { class: 'sysdialog__body' },
      el('div', { class: 'sysdialog__ico', text: '🔒' }),
      el('div', { class: 'sysdialog__title', text: n.ssid }),
      el('div', { class: 'sysdialog__text', text: 'Сеть защищена паролем. Подсказка: он написан на роутере.' }),
      input
    ));
    const acts = el('div', { class: 'sysdialog__actions' });
    acts.append(el('button', { text: 'Отмена', onclick: () => { back.remove(); resolve(null); } }));
    acts.append(el('button', { class: 'primary', text: 'Подключиться', onclick: () => { back.remove(); resolve(input.value); } }));
    box.append(acts);
    back.append(box);
    sys.append(back);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { back.remove(); resolve(input.value); } });
    setTimeout(() => input.focus(), 80);
  });
}

async function finishSetup() {
  const S = getState();
  S.phone.setupDone = true;
  S.phone.locked = false;
  S.phone.awake = true;
  S.stage = 'ready';
  if (!S.phone.firstBootAt) S.phone.firstBootAt = S.time.gameMs;
  save();
  clear(root);
  root.remove();
  root = null;
  unlock('setup');
  unlock('boot');
  completeTask('t6'); completeTask('t7');
  if (S.phone.wifi.ssid) { completeTask('t8'); unlock('wifi'); }
  api.refreshHome();
  api.refreshStatus();
  emit(EV.SCREEN, 'on');
  toast('🎉', 'Настройка завершена', 'Телефон готов. Свайп сверху — шторка уведомлений');

  // первые сообщения приходят через пару секунд
  window.__startStory?.();
}

export function setupActive() { return !!root; }
