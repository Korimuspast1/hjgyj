import { getState, save } from '../state.js';
import { el, clear, clamp } from '../util.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { toast, sysDialog } from '../ui.js';

let inst = null, roll = 0, pitch = 0, target = { x: 0, y: 0 }, raf = null, drag = false, cal = { x: 0, y: 0 }, mode = 'bubble';

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app level-app theme-dark';
  render();
  loop();
  if (window.DeviceOrientationEvent) window.addEventListener('deviceorientation', onOrient);
  return {
    onBlur() { cancelAnimationFrame(raf); raf = null; },
    onFocus() { if (!raf) loop(); },
    onUnmount() { cancelAnimationFrame(raf); raf = null; window.removeEventListener('deviceorientation', onOrient); inst = null; }
  };
}

function onOrient(e) {
  if (e.gamma === null) return;
  target.x = clamp(e.gamma, -45, 45);
  target.y = clamp((e.beta || 0) - 45, -45, 45);
}

function loop() {
  if (!inst) return;
  roll += (target.x - roll) * 0.18;
  pitch += (target.y - pitch) * 0.18;
  const lvlRoll = inst.root.querySelector('#lvl-roll');
  const lvlPitch = inst.root.querySelector('#lvl-pitch');
  const bubble = inst.root.querySelector('#lvl-bubble');
  const surface = inst.root.querySelector('#lvl-surface');
  if (lvlRoll) lvlRoll.textContent = (roll - cal.x).toFixed(1) + '°';
  if (lvlPitch) lvlPitch.textContent = (pitch - cal.y).toFixed(1) + '°';
  const flat = Math.abs(roll - cal.x) < 0.6 && Math.abs(pitch - cal.y) < 0.6;
  if (bubble) {
    const rx = clamp((roll - cal.x) / 45, -1, 1);
    const ry = clamp((pitch - cal.y) / 45, -1, 1);
    bubble.style.transform = `translate(${rx * 44}%, ${ry * 44}%)`;
    bubble.classList.toggle('center', flat);
  }
  if (surface) surface.classList.toggle('flat', flat);
  const tubeB = inst.root.querySelector('#tube-bubble');
  if (tubeB) {
    tubeB.style.left = `calc(50% + ${clamp((roll - cal.x) / 45, -1, 1) * 40}%)`;
    tubeB.classList.toggle('center', Math.abs(roll - cal.x) < 0.8);
  }
  const needle = inst.root.querySelector('#needle');
  if (needle) needle.style.transform = `rotate(${clamp((roll - cal.x) * 2, -90, 90)}deg)`;
  raf = requestAnimationFrame(loop);
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Уровень' }), el('span', { class: 'sub', text: 'гироскоп + акселерометр' })));
  const acts = el('div', { class: 'appbar__actions' });
  const calBtn = el('button', { class: 'iconbtn', title: 'Калибровать', onclick: () => { cal.x = roll; cal.y = pitch; SFX.click(); toast('🎯', 'Калибровка выполнена', 'Текущее положение принято за ноль'); } });
  calBtn.innerHTML = ICON.refresh();
  const helpBtn = el('button', { class: 'iconbtn', onclick: () => help() });
  helpBtn.innerHTML = ICON.help();
  acts.append(calBtn, helpBtn);
  bar.append(acts);
  inst.root.append(bar);

  const body = el('div', { class: 'appbody', style: { textAlign: 'center' } });

  // режимы
  const tabs = el('div', { class: 'tabs' });
  [['bubble', '⚪ Пузырёк'], ['tube', '🫧 Ампула'], ['dial', '🧭 Циферблат']].forEach(([id, label]) => {
    tabs.append(el('button', { class: mode === id ? 'on' : '', text: label, onclick: () => { mode = id; SFX.tap(); render(); } }));
  });
  body.append(tabs);

  if (mode === 'bubble') {
    const surface = el('div', { class: 'lvl-surface', id: 'lvl-surface' });
    surface.append(el('div', { class: 'lvl-ring' }));
    surface.append(el('div', { class: 'lvl-ring inner' }));
    surface.append(el('div', { class: 'lvl-cross' }));
    surface.append(el('div', { class: 'lvl-bubble', id: 'lvl-bubble' }));
    body.append(surface);
  } else if (mode === 'tube') {
    const tube = el('div', { class: 'lvl-tube' });
    for (let i = 0; i < 11; i++) tube.append(el('div', { class: 'tk' + (i === 5 ? ' mid' : '') }));
    tube.append(el('div', { class: 'lvl-tube-bubble', id: 'tube-bubble' }));
    body.append(tube);
    body.append(el('div', { style: { fontSize: '11.5px', opacity: '.5', marginTop: '8px' }, text: 'Пузырёк в центре между двумя рисками — поверхность ровная' }));
  } else {
    const dial = el('div', { class: 'lvl-dial' });
    for (let i = 0; i < 24; i++) {
      const t = el('div', { class: 'dl-tick' + (i % 6 === 0 ? ' major' : '') });
      t.style.transform = `rotate(${i * 15}deg) translateY(-72px)`;
      dial.append(t);
    }
    dial.append(el('div', { class: 'dl-needle', id: 'needle' }));
    dial.append(el('div', { class: 'dl-hub' }));
    body.append(dial);
  }

  const nums = el('div', { class: 'lvl-nums' });
  nums.append(el('div', { class: 'ln' }, el('span', { text: 'КРЕН' }), el('b', { id: 'lvl-roll', text: '0.0°' })));
  nums.append(el('div', { class: 'ln' }, el('span', { text: 'НАКЛОН' }), el('b', { id: 'lvl-pitch', text: '0.0°' })));
  body.append(nums);

  body.append(el('div', { style: { padding: '6px 20px 14px' } },
    el('div', { class: 'lvl-pad', id: 'lvl-pad' },
      el('span', { text: 'Держите область и двигайте палец/мышь — телефон «наклоняется»' }))));

  body.append(el('div', { class: 'list', style: { textAlign: 'left' } },
    el('div', { class: 'list__row', onclick: () => testSensor() },
      el('div', { class: 'set-row-ico', style: { background: 'rgba(56,189,248,.16)' }, text: '📡' }),
      el('div', { class: 'grow' }, el('div', { class: 't1', text: 'Датчики' }), el('div', { class: 't2', text: 'акселерометр, гироскоп, магнитометр' })), chev()),
    el('div', { class: 'list__row', onclick: () => { cal = { x: 0, y: 0 }; target = { x: 0, y: 0 }; roll = 0; pitch = 0; SFX.tap(); toast('🎯', 'Сброс калибровки', ''); } },
      el('div', { class: 'set-row-ico', style: { background: 'rgba(250,204,21,.16)' }, text: '🔄' }),
      el('div', { class: 'grow' }, el('div', { class: 't1', text: 'Сбросить калибровку' })), chev())
  ));

  inst.root.append(body);

  const pad = body.querySelector('#lvl-pad');
  const move = (e) => {
    if (!drag) return;
    const r = pad.getBoundingClientRect();
    const cx = (e.touches ? e.touches[0].clientX : e.clientX) - (r.left + r.width / 2);
    const cy = (e.touches ? e.touches[0].clientY : e.clientY) - (r.top + r.height / 2);
    target.x = clamp(cx / (r.width / 2) * 45, -45, 45);
    target.y = clamp(cy / (r.height / 2) * 30, -30, 30);
  };
  pad.addEventListener('pointerdown', (e) => { drag = true; pad.setPointerCapture?.(e.pointerId); move(e); });
  pad.addEventListener('pointermove', move);
  pad.addEventListener('pointerup', () => { drag = false; target = { x: 0, y: 0 }; });
  pad.addEventListener('pointercancel', () => { drag = false; target = { x: 0, y: 0 }; });
}

function chev() { return el('div', { class: 't3', html: ICON.chevR(), style: { display: 'flex', opacity: '.35' } }); }

async function testSensor() {
  await sysDialog({
    title: 'Датчики движения', icon: '📡',
    text: 'Акселерометр LSM6DSO — <b>работает</b><br/>Гироскоп 3-осевой — <b>работает</b><br/>Магнитометр AK09918 — <b>работает</b><br/>Барометр — <b>работает</b> (1013 гПа)<br/>Датчик Холла — <b>работает</b><br/><br/>На компьютере вместо наклона телефона используйте область управления внизу экрана.',
    buttons: [{ label: 'Понятно', value: true, cls: 'primary' }]
  });
}

async function help() {
  await sysDialog({
    title: 'Как пользоваться уровнем', icon: '🫧',
    text: 'Положите телефон на поверхность. Когда пузырёк окажется ровно в центре (он станет зелёным), поверхность горизонтальна.<br/><br/>Кнопка ⟳ в шапке принимает текущее положение за ноль — так можно проверить, ровная ли сама поверхность, на которой вы стоите.',
    buttons: [{ label: 'Закрыть', value: true, cls: 'primary' }]
  });
}
