import { getState, save } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX, RING, stopAlarm } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, uid, pad2, fmtDur, dayShort, clamp } from '../util.js';
import { toast, sysDialog, switchEl } from '../ui.js';

let inst = null, tab = 'alarm', timer = null;

export function mount(root, a, params) {
  inst = { root, api: a };
  tab = params?.tab || 'alarm';
  root.className = 'app clock-app theme-dark';
  render();
  startLoop();
  return {
    onFocus() { startLoop(); },
    onBlur() { stopLoop(); },
    onBack() { if (tab !== 'alarm') { tab = 'alarm'; render(); return true; } return false; },
    onUnmount() { stopLoop(); inst = null; }
  };
}

function startLoop() { stopLoop(); timer = setInterval(() => { if (inst) tick(); }, 250); }
function stopLoop() { clearInterval(timer); timer = null; }

function tick() {
  if (!inst) return;
  const S = getState();
  const sw = S.stopwatch;
  if (sw.running) {
    const node = inst.root.querySelector('#sw-t');
    if (node) {
      const total = (Date.now() - sw.startedAt) / 1000 + sw.acc;
      const m = Math.floor(total / 60), s = Math.floor(total % 60), ms = Math.floor((total % 1) * 100);
      node.textContent = `${pad2(m)}:${pad2(s)}`;
      const msNode = inst.root.querySelector('#sw-ms');
      if (msNode) msNode.textContent = `,${pad2(ms)}`;
    }
  }
  const tm = S.timer;
  if (tm.running) {
    const left = Math.max(0, (tm.endsAt - S.time.gameMs) / 1000);
    const node = inst.root.querySelector('#tm-t');
    if (node) node.textContent = fmtDur(left);
    const ring = inst.root.querySelector('#tm-ring-fg');
    if (ring && tm.totalSec) {
      const C = 2 * Math.PI * 76;
      ring.setAttribute('stroke-dashoffset', String(C * (1 - left / tm.totalSec)));
    }
  }
  const bigT = inst.root.querySelector('#big-clock');
  if (bigT) {
    const d = new Date(S.time.gameMs);
    bigT.textContent = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    const s = inst.root.querySelector('#big-sec');
    if (s) s.textContent = pad2(d.getSeconds());
  }
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Часы' })));
  inst.root.append(bar);

  const d = new Date(S.time.gameMs);
  inst.root.append(el('div', { class: 'big-clock' },
    el('div', { class: 't' }, el('span', { id: 'big-clock', text: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }), el('span', { id: 'big-sec', style: { fontSize: '18px', opacity: '.45', marginLeft: '6px' }, text: pad2(d.getSeconds()) })),
    el('div', { class: 'd', text: d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }) + ' · Брюссель' })
  ));

  const tabs = el('div', { class: 'tabs' });
  [['alarm', '⏰ Будильники'], ['world', '🌍 Мировые'], ['timer', '⏳ Таймер'], ['sw', '⏱️ Секундомер']].forEach(([id, label]) => {
    tabs.append(el('button', { class: tab === id ? 'on' : '', text: label, onclick: () => { tab = id; SFX.tap(); render(); } }));
  });
  inst.root.append(tabs);

  const body = el('div', { class: 'appbody' });
  inst.root.append(body);
  if (tab === 'alarm') renderAlarms(body);
  else if (tab === 'world') renderWorld(body);
  else if (tab === 'timer') renderTimer(body);
  else renderStopwatch(body);
}

/* ---------------- будильники ---------------- */
function renderAlarms(body) {
  const S = getState();
  const list = el('div', { class: 'list' });
  S.alarms.forEach((a) => {
    const row = el('div', { class: 'list__row alarm-row' + (a.on ? '' : ' off') });
    const g = el('div', { class: 'grow', onclick: () => editAlarm(a) });
    g.append(el('div', { class: 'a-time', text: a.time }));
    g.append(el('div', { class: 'a-label', text: `${a.label}${a.snoozeUntil ? ' · отложен' : ''}${a.ring ? ' · 🔔 ЗВОНИТ!' : ''}` }));
    const days = el('div', { class: 'a-days' });
    for (let i = 1; i <= 7; i++) {
      const di = i % 7;
      days.append(el('i', { class: a.days.includes(di) ? 'on' : '', text: dayShort(di) }));
    }
    g.append(days);
    row.append(g);
    row.append(switchEl(a.on, (v) => {
      a.on = v; a.ring = false; a.snoozeUntil = 0;
      save(); render();
      SFX.tap();
      if (v) { unlock('alarm'); toast('⏰', 'Будильник включён', `${a.time} · ${a.label}`); }
      else stopAlarm();
    }));
    list.append(row);
  });
  body.append(list);

  body.append(el('div', { style: { padding: '14px 16px' } },
    el('button', { class: 'btn btn--primary', style: { width: '100%' }, text: '＋ Добавить будильник', onclick: () => addAlarm() })));

  body.append(el('div', { class: 'list', style: { marginTop: '8px' } },
    alarmSettingRow('🔊', 'Громкость будильника', S.phone.volume.alarm + '%', () => { pageVolume('alarm'); }),
    alarmSettingRow('📳', 'Вибрация', S.phone.vibrate ? 'включена' : 'выключена', () => { S.phone.vibrate = !S.phone.vibrate; save(); render(); toast('📳', S.phone.vibrate ? 'Вибрация включена' : 'Вибрация выключена', ''); }),
    alarmSettingRow('😴', 'Откладывать на', '9 минут', () => toast('😴', 'Кнопка «ещё 9 минут»', 'Классика. Работает максимум 3 раза, потом совесть'))
  ));
}

function alarmSettingRow(icon, title, sub, fn) {
  return el('div', { class: 'list__row', onclick: fn },
    el('div', { class: 'set-row-ico', style: { background: 'rgba(255,255,255,.08)' }, text: icon }),
    el('div', { class: 'grow' }, el('div', { class: 't1', text: title }), el('div', { class: 't2', text: sub })),
    el('div', { class: 't3', html: ICON.chevR(), style: { display: 'flex', opacity: '.4' } }));
}

function pageVolume(key) {
  const S = getState();
  const sys = document.getElementById('syslayer');
  const back = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog' });
  const sl = el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(S.phone.volume[key]), style: { marginTop: '12px' } });
  const val = el('div', { class: 'sysdialog__text', text: S.phone.volume[key] + '%' });
  sl.addEventListener('input', () => { S.phone.volume[key] = +sl.value; val.textContent = S.phone.volume[key] + '%'; save(); });
  box.append(el('div', { class: 'sysdialog__body' }, el('div', { class: 'sysdialog__title', text: 'Громкость будильника' }), val, sl));
  const acts = el('div', { class: 'sysdialog__actions' });
  acts.append(el('button', { text: 'Проверить', onclick: () => { RING.alarm('chime'); setTimeout(() => stopAlarm(), 2500); } }));
  acts.append(el('button', { class: 'primary', text: 'Готово', onclick: () => { stopAlarm(); back.remove(); render(); } }));
  box.append(acts);
  back.append(box);
  back.addEventListener('click', (e) => { if (e.target === back) { stopAlarm(); back.remove(); } });
  sys.append(back);
}

async function addAlarm() {
  const S = getState();
  const d = new Date(S.time.gameMs + 3600000);
  const res = await timePicker(`${pad2(d.getHours())}:${pad2(d.getMinutes())}`, 'Новый будильник');
  if (!res) return;
  const a = { id: uid('a'), time: res.time, label: res.label || 'Будильник', days: res.days, on: true, ring: false, snoozeUntil: 0 };
  S.alarms.push(a);
  save();
  unlock('alarm');
  toast('⏰', 'Будильник добавлен', `${a.time} · ${a.label}`);
  render();
}

async function editAlarm(a) {
  const S = getState();
  const act = await sysDialog({
    title: a.time, icon: '⏰',
    text: `${a.label}<br/>Повтор: ${a.days.map(dayShort).join(', ') || 'один раз'}`,
    buttons: [
      { label: 'Изменить', value: 'edit', cls: 'primary' },
      { label: a.on ? 'Выключить' : 'Включить', value: 'toggle' },
      { label: 'Удалить', value: 'del', cls: 'danger' },
      { label: 'Отмена', value: null }
    ]
  });
  if (act === 'toggle') { a.on = !a.on; save(); render(); return; }
  if (act === 'del') { S.alarms = S.alarms.filter((x) => x.id !== a.id); save(); render(); toast('🗑️', 'Будильник удалён', ''); return; }
  if (act === 'edit') {
    const res = await timePicker(a.time, 'Изменить будильник', a.label, a.days);
    if (!res) return;
    a.time = res.time; a.label = res.label; a.days = res.days;
    save(); render();
    toast('⏰', 'Будильник изменён', `${a.time} · ${a.label}`);
  }
}

function timePicker(initial = '07:00', title = 'Будильник', label = '', days = [1, 2, 3, 4, 5]) {
  return new Promise((resolve) => {
    const [h0, m0] = initial.split(':').map(Number);
    let h = h0, m = m0, lbl = label, dl = [...days];
    const sys = document.getElementById('syslayer');
    const back = el('div', { class: 'sysdialog-backdrop' });
    const box = el('div', { class: 'sysdialog' });

    const display = el('div', { style: { fontSize: '44px', fontWeight: '200', textAlign: 'center', fontVariantNumeric: 'tabular-nums', margin: '6px 0' } });
    const upd = () => { display.textContent = `${pad2(h)}:${pad2(m)}`; };
    upd();

    const controls = el('div', { style: { display: 'flex', justifyContent: 'center', gap: '30px', marginBottom: '10px' } });
    const stepper = (sign, isHour) => el('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
      el('button', { class: 'btn btn--tiny', text: '▲', onclick: () => { if (isHour) h = (h + sign + 24) % 24; else m = (m + sign + 60) % 60; upd(); SFX.key(); } }),
      el('div', { style: { textAlign: 'center', fontSize: '11px', opacity: '.5' }, text: isHour ? 'часы' : 'минуты' }),
      el('button', { class: 'btn btn--tiny', text: '▼', onclick: () => { if (isHour) h = (h - sign + 24) % 24; else m = (m - sign + 60) % 60; upd(); SFX.key(); } })
    );
    controls.append(stepper(1, true), stepper(-1, false));
    
    const labelInput = el('input', { class: 'sysdialog__input', placeholder: 'Название (например: Учёба)', value: lbl });
    labelInput.addEventListener('input', () => { lbl = labelInput.value; });

    const daysRow = el('div', { style: { display: 'flex', gap: '5px', justifyContent: 'center', margin: '12px 0 4px' } });
    const order = [1, 2, 3, 4, 5, 6, 0];
    order.forEach((di) => {
      const b = el('button', {
        class: 'chip' + (dl.includes(di) ? ' on' : ''),
        style: { padding: '7px 0', width: '34px', justifyContent: 'center', fontSize: '11px' },
        text: dayShort(di),
        onclick: () => {
          if (dl.includes(di)) dl = dl.filter((x) => x !== di); else dl.push(di);
          b.classList.toggle('on', dl.includes(di));
          SFX.tap();
        }
      });
      daysRow.append(b);
    });

    const presets = el('div', { style: { display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '10px', flexWrap: 'wrap' } });
    [['Через 20 мин', 20], ['Через 1 час', 60], ['Через 8 часов', 480]].forEach(([t, mins]) => {
      presets.append(el('button', { class: 'btn btn--tiny', text: t, onclick: () => {
        const d = new Date(getState().time.gameMs + mins * 60000);
        h = d.getHours(); m = d.getMinutes(); upd(); SFX.tap();
      } }));
    });

    box.append(el('div', { class: 'sysdialog__body' },
      el('div', { class: 'sysdialog__title', text: title }), display, controls, labelInput, daysRow, presets));

    const acts = el('div', { class: 'sysdialog__actions' });
    acts.append(el('button', { text: 'Отмена', onclick: () => { back.remove(); resolve(null); } }));
    acts.append(el('button', { class: 'primary', text: 'Сохранить', onclick: () => { back.remove(); resolve({ time: `${pad2(h)}:${pad2(m)}`, label: lbl, days: dl }); } }));
    box.append(acts);
    back.append(box);
    back.addEventListener('click', (e) => { if (e.target === back) { back.remove(); resolve(null); } });
    sys.append(back);
  });
}

/* ---------------- мировые часы ---------------- */
function renderWorld(body) {
  const S = getState();
  const base = new Date(S.time.gameMs);
  const wrap = el('div', { class: 'world-clock' });
  S.world_clocks.forEach((c) => {
    const d = new Date(base.getTime() + c.tz * 3600000);
    const diff = c.tz;
    wrap.append(el('div', { class: 'wc-row' },
      el('div', { style: { fontSize: '24px' }, text: c.flag }),
      el('div', { class: 'wc-c' }, el('b', { text: c.city }), el('span', { text: `${diff >= 0 ? '+' : ''}${diff} ч к вашему времени · ${d.toLocaleDateString('ru-RU', { weekday: 'short' })}` })),
      el('div', {},
        el('div', { class: 'wc-t', text: `${pad2(d.getHours())}:${pad2(d.getMinutes())}` }),
        el('div', { class: 'wc-d', text: (d.getHours() >= 21 || d.getHours() < 6) ? '🌙 ночь' : '☀️ день' }))
    ));
  });
  body.append(wrap);
  body.append(el('div', { style: { padding: '14px 16px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '＋ Добавить город', onclick: async () => {
      const res = await sysDialog({
        title: 'Мировые часы', icon: '🌍', text: 'Выберите город',
        buttons: [
          { label: '🇬🇧 Лондон (−1)', value: ['Лондон', -1, '🇬🇧'] },
          { label: '🇺🇸 Лос-Анджелес (−9)', value: ['Лос-Анджелес', -9, '🇺🇸'] },
          { label: '🇦🇪 Дубай (+2)', value: ['Дубай', 2, '🇦🇪'] },
          { label: 'Отмена', value: null }
        ]
      });
      if (!res) return;
      S.world_clocks.push({ city: res[0], tz: res[1], flag: res[2] });
      save(); render();
      toast('🌍', 'Город добавлен', res[0]);
    } })
  ));
}

/* ---------------- таймер ---------------- */
function renderTimer(body) {
  const S = getState();
  const t = S.timer;
  const left = t.running ? Math.max(0, (t.endsAt - S.time.gameMs) / 1000) : t.remainSec || 0;
  const C = 2 * Math.PI * 76;
  const ring = el('div', { class: 'timer-ring' });
  ring.innerHTML = `<svg width="180" height="180" viewBox="0 0 180 180">
    <circle class="bg" cx="90" cy="90" r="76"/>
    <circle class="fg" id="tm-ring-fg" cx="90" cy="90" r="76" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - (t.totalSec ? left / t.totalSec : 0))}"/>
  </svg>`;
  ring.append(el('b', { id: 'tm-t', text: fmtDur(left) }));
  body.append(ring);

  const btns = el('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center', padding: '10px 0 16px' } });
  btns.append(el('button', {
    class: 'btn btn--primary', style: { padding: '13px 30px' }, text: t.running ? '⏸ Пауза' : (left > 0 ? '▶ Продолжить' : '▶ Старт'),
    onclick: () => {
      if (t.running) {
        t.remainSec = Math.max(0, (t.endsAt - S.time.gameMs) / 1000);
        t.running = false; SFX.tap();
      } else {
        if (!t.totalSec) { pickTime(); return; }
        t.endsAt = S.time.gameMs + (t.remainSec || t.totalSec) * 1000;
        t.remainSec = 0;
        t.running = true; SFX.click();
      }
      save(); render();
    }
  }));
  btns.append(el('button', { class: 'btn btn--ghost', style: { padding: '13px 24px' }, text: 'Сброс', onclick: () => { t.running = false; t.totalSec = 0; t.remainSec = 0; save(); render(); } }));
  body.append(btns);

  body.append(el('div', { class: 'sect-title', text: 'Быстрый выбор' }));
  const presets = el('div', { class: 'timer-presets' });
  [[1, 'мин'], [3, 'мин'], [5, 'мин'], [10, 'мин'], [15, 'мин'], [30, 'мин'], [60, 'мин']].forEach(([v, u]) => {
    presets.append(el('button', { class: 'chip', text: `${v} ${u}`, onclick: () => { t.totalSec = v * 60; t.remainSec = v * 60; t.running = false; t.endsAt = S.time.gameMs + v * 60000; save(); SFX.tap(); render(); } }));
  });
  body.append(presets);
  body.append(el('div', { style: { padding: '0 16px 20px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '⏳ Своё время', onclick: () => pickTime() })));

  async function pickTime() {
    const res = await sysDialog({
      title: 'Установить таймер', icon: '⏳',
      text: 'Введите количество минут',
      input: { placeholder: 'например 7', value: '5' }, inputType: 'number',
      buttons: [{ label: 'Отмена', value: null }, { label: 'Установить', value: true, cls: 'primary' }]
    });
    if (res === null) return;
    const mins = clamp(parseInt(String(res), 10) || 5, 1, 599);
    t.totalSec = mins * 60; t.remainSec = mins * 60;
    t.endsAt = S.time.gameMs + mins * 60000;
    t.running = true;
    t.label = `${mins} мин`;
    save(); render();
    toast('⏳', 'Таймер запущен', `${mins} мин · уведомление придёт, даже если приложение закрыто`);
  }
}

/* ---------------- секундомер ---------------- */
function renderStopwatch(body) {
  const S = getState();
  const sw = S.stopwatch;
  const total = sw.running ? (Date.now() - sw.startedAt) / 1000 + sw.acc : sw.acc;
  body.append(el('div', { class: 'stopwatch' },
    el('div', { class: 'sw-t' }, el('span', { id: 'sw-t', text: `${pad2(Math.floor(total / 60))}:${pad2(Math.floor(total % 60))}` }), el('span', { class: 'sw-ms', id: 'sw-ms', text: `,${pad2(Math.floor((total % 1) * 100))}` }))
  ));
  const btns = el('div', { style: { display: 'flex', gap: '12px', justifyContent: 'center', paddingBottom: '16px' } });
  btns.append(el('button', {
    class: 'btn ' + (sw.running ? 'btn--ghost' : 'btn--primary'), style: { padding: '13px 30px' }, text: sw.running ? '⏸ Стоп' : '▶ Старт',
    onclick: () => {
      if (sw.running) { sw.acc += (Date.now() - sw.startedAt) / 1000; sw.running = false; }
      else { sw.startedAt = Date.now(); sw.running = true; }
      save(); render(); SFX.click();
    }
  }));
  btns.append(el('button', {
    class: 'btn btn--ghost', style: { padding: '13px 24px' }, text: sw.running ? '🏁 Круг' : 'Сброс',
    onclick: () => {
      if (sw.running) {
        const cur = (Date.now() - sw.startedAt) / 1000 + sw.acc;
        sw.laps.unshift(cur);
        if (sw.laps.length > 30) sw.laps.pop();
        toast('🏁', `Круг ${sw.laps.length}`, fmtDur(cur));
      } else { sw.acc = 0; sw.laps = []; }
      save(); render(); SFX.tap();
    }
  }));
  body.append(btns);

  if (sw.laps.length) {
    body.append(el('div', { class: 'sect-title', text: `Круги (${sw.laps.length})` }));
    const laps = el('div', { class: 'sw-laps' });
    sw.laps.forEach((l, i) => {
      const best = Math.min(...sw.laps), worst = Math.max(...sw.laps);
      laps.append(el('div', { class: 'lap' },
        el('span', { text: `Круг ${sw.laps.length - i}` }),
        el('span', { style: { color: l === best ? '#4ade80' : l === worst ? '#f87171' : 'inherit' }, text: fmtDur(l) })));
    });
    body.append(laps);
  }
}
