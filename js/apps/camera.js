import { getState, save, completeTask } from '../state.js';
import { emit, EV, on } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { $, el, clear, uid, fmtTime, rndInt, pick, clamp, partOfDay, fmtDateShort } from '../util.js';
import { toast, sysDialog } from '../ui.js';

let inst = null;
let mode = 'photo', front = false, zoom = 1, sceneIdx = 0, grid = false, flashMode = 'auto', timerMode = 0;
let recording = false, recStart = 0, recTimer = null, focusTimer = null;

const SCENES = [
  { id: 'desk', name: 'Стол с коробкой' },
  { id: 'window', name: 'Вид из окна' },
  { id: 'plant', name: 'Фикус Геннадий' },
  { id: 'mug', name: 'Кофе' },
  { id: 'city', name: 'Улица' },
  { id: 'sky', name: 'Небо' }
];

export function mount(root, a, params) {
  inst = { root, api: a, shareTo: params?.shareTo || null };
  root.className = 'app camera';
  render();
  window.__batteryHeavy = true;
  return {
    onFocus() { window.__batteryHeavy = true; },
    onBlur() { stopRecording(true); window.__batteryHeavy = false; },
    onBack() {
      if (recording) { stopRecording(); return true; }
      return false;
    },
    onUnmount() {
      stopRecording(true);
      window.__batteryHeavy = false;
      inst = null;
    }
  };
}

/* =========================================================
   СЦЕНЫ (SVG-видоискатель)
   ========================================================= */
function sceneSvg(sceneId, opts = {}) {
  const S = getState();
  const pod = opts.pod || partOfDay();
  const isFront = opts.front;
  if (isFront) return selfieSvg(pod);
  const scenes = { desk: deskScene, window: windowScene, plant: plantScene, mug: mugScene, city: cityScene, sky: skyScene };
  const fn = scenes[sceneId] || deskScene;
  return fn(pod);
}

function skyPalette(pod) {
  switch (pod) {
    case 'dawn': return ['#fca5a5', '#fdba74', '#fde68a'];
    case 'day': return ['#38bdf8', '#7dd3fc', '#e0f2fe'];
    case 'sunset': return ['#7c2d12', '#f97316', '#fcd34d'];
    default: return ['#0b1026', '#1e293b', '#334155'];
  }
}

function starsSvg(pod, n = 30) {
  if (pod !== 'night') return '';
  let s = '';
  for (let i = 0; i < n; i++) {
    s += `<circle cx="${(i * 37) % 400}" cy="${(i * 23) % 220}" r="${(i % 3) * 0.5 + 0.7}" fill="#fff" opacity="${0.3 + (i % 5) * 0.14}"/>`;
  }
  return s;
}

function deskScene(pod) {
  const [s1, s2, s3] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s2}"/><stop offset="1" stop-color="${s1}" stop-opacity=".55"/></linearGradient>
      <linearGradient id="desk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a3b"/><stop offset="1" stop-color="#5b3a24"/></linearGradient>
      <linearGradient id="boxg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3350"/><stop offset="1" stop-color="#151a2b"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="400" height="720" fill="url(#wall)"/>
    ${starsSvg(pod)}
    <rect y="420" width="400" height="300" fill="url(#desk)"/>
    <rect y="416" width="400" height="8" fill="#a4714c" opacity=".7"/>
    <g>
      <rect x="42" y="300" width="150" height="128" rx="10" fill="url(#boxg)"/>
      <rect x="42" y="300" width="150" height="34" rx="10" fill="#39415f"/>
      <text x="117" y="323" font-family="Segoe UI,Arial" font-size="15" letter-spacing="5" fill="#8ee9ff" text-anchor="middle">NOVA</text>
      <text x="117" y="360" font-family="Segoe UI,Arial" font-size="9" letter-spacing="2" fill="#8fa0c0" text-anchor="middle">X5 Pro · 256 ГБ</text>
      <rect x="60" y="378" width="114" height="6" rx="3" fill="#0f1424" opacity=".7"/>
    </g>
    <g transform="translate(238,352)">
      <rect x="0" y="0" width="76" height="66" rx="8" fill="#f1f5f9"/>
      <rect x="8" y="10" width="26" height="19" rx="3" fill="#f6d77a" stroke="#a8801d"/>
      <text x="38" y="48" font-family="Segoe UI,Arial" font-size="10" fill="#334155">SIM</text>
    </g>
    <g transform="translate(230,300)">
      <rect x="0" y="14" width="66" height="42" rx="9" fill="#e2e8f0"/>
      <rect x="10" y="22" width="8" height="18" rx="2" fill="#94a3b8"/>
      <rect x="26" y="22" width="8" height="18" rx="2" fill="#94a3b8"/>
      <path d="M66 40 q34 -6 44 -22" stroke="#1f2937" stroke-width="5" fill="none"/>
    </g>
    <g transform="translate(96,238)">
      <rect x="0" y="34" width="46" height="40" rx="6" fill="#e2e8f0"/>
      <ellipse cx="23" cy="38" rx="17" ry="5" fill="#3b2a1e"/>
      <path d="M46 46 q16 0 16 12 q0 12 -16 12" stroke="#cbd5e1" stroke-width="5" fill="none"/>
      <path d="M16 24 q-4 -12 2 -20 M28 24 q-4 -12 2 -20" stroke="#fff" stroke-width="3" opacity=".45" fill="none"/>
    </g>
    <ellipse cx="200" cy="640" rx="220" ry="60" fill="url(#glow)"/>
    <text x="200" y="690" font-family="Segoe UI,Arial" font-size="11" fill="#ffffff" opacity=".35" text-anchor="middle">NOVA X5 Pro · 108 МП · f/1.7</text>
  </svg>`;
}

function windowScene(pod) {
  const [s1, s2, s3] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset=".6" stop-color="${s2}"/><stop offset="1" stop-color="${s3}"/></linearGradient>
    </defs>
    <rect width="400" height="720" fill="#1a2138"/>
    <rect x="26" y="46" width="348" height="600" rx="12" fill="url(#sky)"/>
    ${starsSvg(pod, 40)}
    ${pod === 'night' ? '<circle cx="300" cy="140" r="34" fill="#f8fafc" opacity=".95"/><circle cx="286" cy="132" r="30" fill="' + s2 + '"/>' : ''}
    ${pod === 'day' || pod === 'dawn' ? '<circle cx="106" cy="150" r="38" fill="#fff7cf" opacity=".95"/>' : ''}
    ${pod === 'sunset' ? '<circle cx="200" cy="470" r="52" fill="#fff1c9" opacity=".95"/>' : ''}
    <g fill="#e2e8f0" opacity=".8">
      <ellipse cx="120" cy="230" rx="46" ry="16"/><ellipse cx="150" cy="222" rx="34" ry="14"/>
      <ellipse cx="290" cy="300" rx="52" ry="15"/><ellipse cx="262" cy="292" rx="30" ry="12"/>
    </g>
    <g fill="#0f172a" opacity=".85">
      <rect x="40" y="480" width="56" height="166"/><rect x="106" y="440" width="44" height="206"/>
      <rect x="160" y="510" width="70" height="136"/><rect x="240" y="420" width="50" height="226"/>
      <rect x="300" y="486" width="62" height="160"/>
    </g>
    <g fill="#fcd34d" opacity="${pod === 'night' ? .9 : .25}">
      ${Array.from({ length: 26 }).map((_, i) => `<rect x="${54 + (i * 47) % 300}" y="${470 + (i * 29) % 150}" width="9" height="12"/>`).join('')}
    </g>
    <rect x="196" y="46" width="8" height="600" fill="#2c3450"/>
    <rect x="26" y="330" width="348" height="8" fill="#2c3450"/>
    <rect x="10" y="640" width="380" height="24" rx="6" fill="#39415f"/>
    <g transform="translate(52,588)"><rect x="0" y="24" width="46" height="32" rx="6" fill="#b4643c"/>
      <path d="M23 24 q-16 -26 -6 -50 q12 18 6 50 M23 24 q16 -26 6 -50 q-12 18 -6 50 M23 26 q-2 -34 0 -54 q2 20 0 54" fill="#4ade80"/>
    </g>
  </svg>`;
}

function plantScene(pod) {
  const [s1, s2] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="bg2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s2}" stop-opacity=".5"/><stop offset="1" stop-color="#1f2937"/></linearGradient>
    <radialGradient id="sp"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="720" fill="url(#bg2)"/>
    <ellipse cx="200" cy="300" rx="240" ry="260" fill="url(#sp)"/>
    <rect y="560" width="400" height="160" fill="#5b3a24"/>
    <g transform="translate(200,560)">
      <path d="M-58 0 h116 l-14 108 a10 10 0 0 1 -10 8 h-68 a10 10 0 0 1 -10 -8 z" fill="#b4643c"/>
      <path d="M-58 0 h116 v16 h-116 z" fill="#8a4a2b"/>
      <g fill="#22c55e">
        <path d="M0 0 C -70 -60 -96 -150 -54 -214 C -22 -168 -6 -96 0 0" opacity=".95"/>
        <path d="M0 0 C 70 -66 96 -160 52 -222 C 20 -172 6 -96 0 0" opacity=".85"/>
        <path d="M0 0 C -16 -100 -6 -190 6 -258 C 22 -186 20 -92 0 0" fill="#16a34a"/>
        <path d="M0 0 C -104 -30 -150 -92 -140 -152 C -84 -124 -32 -66 0 0" opacity=".7"/>
        <path d="M0 0 C 104 -34 152 -96 142 -156 C 86 -128 34 -66 0 0" opacity=".65"/>
      </g>
      <g stroke="#15803d" stroke-width="3" fill="none" opacity=".5">
        <path d="M0 -6 C -30 -66 -44 -130 -40 -186"/><path d="M0 -6 C 30 -70 44 -134 40 -190"/><path d="M0 -6 C 4 -80 8 -150 6 -226"/>
      </g>
    </g>
    <text x="200" y="694" font-family="Segoe UI,Arial" font-size="12" fill="#fff" opacity=".3" text-anchor="middle">фикус «Геннадий» · 3 года в семье</text>
  </svg>`;
}

function mugScene(pod) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs><radialGradient id="mg"><stop offset="0" stop-color="#fde68a" stop-opacity=".38"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="720" fill="#2b2118"/>
    <rect y="470" width="400" height="250" fill="#6b4630"/>
    <ellipse cx="200" cy="330" rx="230" ry="230" fill="url(#mg)"/>
    <g transform="translate(140,330)">
      <path d="M0 20 h120 v96 a24 24 0 0 1 -24 24 h-72 a24 24 0 0 1 -24 -24 z" fill="#e2e8f0"/>
      <ellipse cx="60" cy="22" rx="60" ry="16" fill="#f8fafc"/>
      <ellipse cx="60" cy="24" rx="48" ry="12" fill="#3b2a1e"/>
      <ellipse cx="46" cy="21" rx="16" ry="5" fill="#6b4a33" opacity=".8"/>
      <path d="M120 52 q36 0 36 30 q0 30 -36 30" stroke="#cbd5e1" stroke-width="12" fill="none"/>
      <g stroke="#fff" stroke-width="5" opacity=".35" fill="none" stroke-linecap="round">
        <path d="M40 -8 q-14 -26 0 -52 q14 -26 0 -50"/>
        <path d="M74 -8 q-14 -26 0 -52 q14 -26 0 -50"/>
      </g>
    </g>
    <text x="200" y="694" font-family="Segoe UI,Arial" font-size="12" fill="#fff" opacity=".3" text-anchor="middle">кофе остывает со скоростью 1 уведомление/мин</text>
  </svg>`;
}

function cityScene(pod) {
  const [s1, s2, s3] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="cs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset="1" stop-color="${s3}"/></linearGradient></defs>
    <rect width="400" height="720" fill="url(#cs)"/>
    ${starsSvg(pod, 24)}
    <g fill="#1f2937" opacity=".55">
      <rect x="0" y="330" width="70" height="240"/><rect x="80" y="290" width="52" height="280"/>
      <rect x="142" y="350" width="86" height="220"/><rect x="238" y="270" width="60" height="300"/>
      <rect x="308" y="330" width="92" height="240"/>
    </g>
    <g fill="#0f172a">
      <rect x="0" y="440" width="400" height="280"/>
    </g>
    <g fill="#fcd34d" opacity="${pod === 'night' ? .85 : .2}">
      ${Array.from({ length: 40 }).map((_, i) => `<rect x="${10 + (i * 31) % 380}" y="${340 + (i * 41) % 200}" width="8" height="11"/>`).join('')}
    </g>
    <path d="M0 596 H400" stroke="#f8fafc" stroke-width="5" stroke-dasharray="26 22" opacity=".65"/>
    <g>
      <rect x="60" y="536" width="86" height="46" rx="10" fill="#dc2626"/><rect x="72" y="520" width="56" height="22" rx="9" fill="#7f1d1d"/>
      <circle cx="82" cy="586" r="12" fill="#111827"/><circle cx="126" cy="586" r="12" fill="#111827"/>
      <rect x="230" y="546" width="110" height="40" rx="10" fill="#2563eb"/><rect x="248" y="528" width="66" height="22" rx="9" fill="#1e3a8a"/>
      <circle cx="256" cy="590" r="12" fill="#111827"/><circle cx="314" cy="590" r="12" fill="#111827"/>
    </g>
    <g opacity=".9"><rect x="180" y="410" width="12" height="90" fill="#374151"/><circle cx="186" cy="404" r="10" fill="${pod === 'night' ? '#fef08a' : '#9ca3af'}"/></g>
    <text x="200" y="694" font-family="Segoe UI,Arial" font-size="12" fill="#fff" opacity=".35" text-anchor="middle">ул. Симуляторная · Брюссель</text>
  </svg>`;
}

function skyScene(pod) {
  const [s1, s2, s3] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s1}"/><stop offset=".55" stop-color="${s2}"/><stop offset="1" stop-color="${s3}"/></linearGradient></defs>
    <rect width="400" height="720" fill="url(#sk)"/>
    ${starsSvg(pod, 60)}
    ${pod === 'night' ? '<circle cx="292" cy="176" r="52" fill="#f8fafc"/><circle cx="272" cy="162" r="46" fill="' + s2 + '"/>' : '<circle cx="112" cy="176" r="56" fill="#fff8d6" opacity=".95"/>'}
    <g fill="#fff" opacity="${pod === 'night' ? .18 : .82}">
      <ellipse cx="150" cy="330" rx="76" ry="26"/><ellipse cx="196" cy="316" rx="52" ry="22"/>
      <ellipse cx="300" cy="440" rx="86" ry="24"/><ellipse cx="266" cy="428" rx="46" ry="20"/>
      <ellipse cx="88" cy="530" rx="64" ry="20"/>
    </g>
    <g opacity=".55" fill="#fff">
      <path d="M240 214 l14 0 -7 26z"/><path d="M262 226 l10 0 -5 20z"/>
    </g>
    <text x="200" y="694" font-family="Segoe UI,Arial" font-size="12" fill="${pod === 'night' ? '#93c5fd' : '#0f172a'}" opacity=".4" text-anchor="middle">${pod === 'night' ? 'ночное небо · выдержка 4 с' : 'небо · ISO 100 · f/1.7'}</text>
  </svg>`;
}

function selfieSvg(pod) {
  const [s1, s2] = skyPalette(pod);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 720" preserveAspectRatio="xMidYMid slice">
    <defs><linearGradient id="rb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${s2}"/><stop offset="1" stop-color="#1e293b"/></linearGradient>
    <radialGradient id="rg"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="400" height="720" fill="url(#rb)"/>
    <ellipse cx="200" cy="330" rx="200" ry="230" fill="url(#rg)"/>
    <g transform="translate(200,360)">
      <ellipse cx="0" cy="180" rx="150" ry="80" fill="#334155"/>
      <path d="M-92 200 q92 -80 184 0 z" fill="#475569"/>
      <ellipse cx="0" cy="20" rx="86" ry="100" fill="#f1c9a5"/>
      <path d="M-88 -20 q10 -108 88 -104 q78 4 88 104 q-24 -50 -88 -46 q-64 -4 -88 46z" fill="#3f2a1d"/>
      <g fill="#2b1d13"><ellipse cx="-32" cy="16" rx="9" ry="11"/><ellipse cx="32" cy="16" rx="9" ry="11"/></g>
      <g fill="#fff" opacity=".85"><circle cx="-29" cy="12" r="3"/><circle cx="35" cy="12" r="3"/></g>
      <path d="M-46 -6 q14 -12 28 -2 M18 -8 q14 -10 28 2" stroke="#3f2a1d" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-8 40 q8 10 16 0" stroke="#d9a077" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-26 68 q26 22 52 0" stroke="#b4553f" stroke-width="6" fill="none" stroke-linecap="round"/>
      <ellipse cx="-58" cy="52" rx="14" ry="9" fill="#f4a08c" opacity=".45"/>
      <ellipse cx="58" cy="52" rx="14" ry="9" fill="#f4a08c" opacity=".45"/>
    </g>
    <g transform="translate(296,506) rotate(-18)">
      <rect x="0" y="0" width="74" height="146" rx="14" fill="#0f172a" stroke="#475569" stroke-width="3"/>
      <rect x="8" y="10" width="58" height="126" rx="9" fill="#1e293b"/>
      <circle cx="37" cy="20" r="4" fill="#0b1020"/>
    </g>
    <text x="200" y="700" font-family="Segoe UI,Arial" font-size="12" fill="#fff" opacity=".4" text-anchor="middle">фронтальная 32 МП · портретный режим</text>
  </svg>`;
}

/* =========================================================
   РЕНДЕР
   ========================================================= */
function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const view = el('div', { class: 'cam__view' });
  const scene = el('div', { class: 'cam__scene' });
  const svgStr = sceneSvg(SCENES[sceneIdx].id, { front, pod: partOfDay() });
  scene.innerHTML = svgStr;
  scene.style.transform = `scale(${zoom})`;
  scene.style.transformOrigin = 'center';
  view.append(scene);

  const gridEl = el('div', { class: 'cam__grid' + (grid ? ' on' : '') });
  view.append(gridEl);

  const focus = el('div', { class: 'cam__focus' });
  view.append(focus);

  // верхняя панель
  const top = el('div', { class: 'cam__top' });
  const closeBtn = el('button', { title: 'Закрыть камеру', onclick: () => api.back() });
  closeBtn.innerHTML = ICON.close();
  top.append(closeBtn);
  const flashBtn = el('button', { class: flashMode === 'on' ? 'on' : '', title: 'Вспышка: ' + flashMode, text: flashMode === 'on' ? '⚡' : flashMode === 'torch' ? '🔦' : flashMode === 'off' ? '⚡̸' : 'А' });
  flashBtn.addEventListener('click', () => {
    const order = ['auto', 'on', 'off', 'torch'];
    flashMode = order[(order.indexOf(flashMode) + 1) % order.length];
    SFX.tap(); render();
  });
  top.append(flashBtn);
  top.append(el('div', { class: 'spacer' }));
  const gridBtn = el('button', { class: grid ? 'on' : '', title: 'Сетка', text: '⊞', onclick: () => { grid = !grid; SFX.tap(); render(); } });
  top.append(gridBtn);
  const sceneBtn = el('button', { title: 'Сменить объект съёмки', text: '🎞️', onclick: () => { sceneIdx = (sceneIdx + 1) % SCENES.length; SFX.tap(); toast('🎞️', SCENES[sceneIdx].name, ''); render(); } });
  top.append(sceneBtn);
  const timerBtn = el('button', { class: timerMode ? 'on' : '', title: 'Таймер', text: timerMode ? `${timerMode}с` : '⏱', onclick: () => { timerMode = timerMode === 0 ? 3 : timerMode === 3 ? 10 : 0; SFX.tap(); render(); } });
  top.append(timerBtn);
  view.append(top);

  // зум
  const zoomBar = el('div', { class: 'cam__zoom' });
  [0.5, 1, 2, 5].forEach((z) => {
    zoomBar.append(el('button', { class: zoom === z ? 'on' : '', text: z === 0.5 ? '0.5×' : z + '×', onclick: () => { zoom = z; SFX.tap(); render(); } }));
  });
  view.append(zoomBar);

  // тап-фокус
  view.addEventListener('click', (e) => {
    if (e.target.closest('button')) return;
    const r = view.getBoundingClientRect();
    focus.style.left = (e.clientX - r.left) + 'px';
    focus.style.top = (e.clientY - r.top) + 'px';
    focus.classList.remove('show'); void focus.offsetWidth; focus.classList.add('show');
    SFX.tap();
  });

  if (recording) {
    const hud = el('div', { class: 'cam__rec-hud' });
    hud.append(el('i'));
    hud.append(el('span', { id: 'rec-time', text: '00:00' }));
    hud.append(el('span', { style: { opacity: '.6' }, id: 'rec-size', text: '0,0 МБ' }));
    view.append(hud);
  }

  inst.root.append(view);

  // режимы
  const modes = el('div', { class: 'cam__modes' });
  [['portrait', 'ПОРТРЕТ'], ['photo', 'ФОТО'], ['video', 'ВИДЕО'], ['night', 'НОЧЬ'], ['pano', 'ПАНОРАМА'], ['pro', 'ПРО']]
    .sort((a, b) => ['pano', 'night', 'portrait', 'photo', 'video', 'pro'].indexOf(a[0]) - ['pano', 'night', 'portrait', 'photo', 'video', 'pro'].indexOf(b[0]))
    .forEach(([id, label]) => {
      modes.append(el('button', { class: mode === id ? 'on' : '', text: label, onclick: () => { mode = id; SFX.tap(); render(); } }));
    });
  inst.root.append(modes);

  // нижняя панель
  const bottom = el('div', { class: 'cam__bottom' });
  const thumb = el('div', { class: 'cam__thumb', onclick: () => api.openApp('gallery') });
  const last = S.photos[S.photos.length - 1];
  if (last) thumb.innerHTML = last.svg;
  else thumb.innerHTML = `<div style="display:grid;place-items:center;height:100%;font-size:17px;opacity:.5">🖼️</div>`;
  bottom.append(thumb);

  const shutter = el('button', { class: 'cam__shutter' + (recording ? ' rec' : ''), onclick: () => mode === 'video' ? toggleRecording() : capture() });
  bottom.append(shutter);

  const flip = el('button', { class: 'cam__flip', onclick: () => { front = !front; SFX.click(); render(); } });
  flip.innerHTML = ICON.refresh();
  bottom.append(flip);
  inst.root.append(bottom);

  // инфо о режиме
  const info = el('div', { style: { position: 'absolute', left: '12px', bottom: '120px', fontSize: '10.5px', color: '#fff', opacity: '.55', zIndex: 4, textShadow: '0 1px 4px #000' } });
  info.textContent = `${modeLabel()} · ${SCENES[sceneIdx].name} · ${front ? 'фронт 32 МП' : 'основная 108 МП'} · ${fmtTime()}`;
  inst.root.append(info);

  if (recording) startRecTicker();
}

function modeLabel() {
  return { photo: 'Фото', portrait: 'Портрет', video: 'Видео', night: 'Ночь', pano: 'Панорама', pro: 'Про' }[mode];
}

function startRecTicker() {
  clearInterval(recTimer);
  recTimer = setInterval(() => {
    if (!recording) { clearInterval(recTimer); return; }
    const sec = Math.floor((Date.now() - recStart) / 1000);
    const t = inst?.root.querySelector('#rec-time');
    const sz = inst?.root.querySelector('#rec-size');
    if (t) t.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
    if (sz) sz.textContent = (sec * 2.4).toFixed(1).replace('.', ',') + ' МБ';
  }, 400);
}

/* =========================================================
   СЪЁМКА
   ========================================================= */
async function capture() {
  const S = getState();
  if (timerMode) {
    for (let i = timerMode; i > 0; i--) {
      toast('⏱️', String(i), '', 900);
      SFX.key();
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  const fx = el('div', { class: 'cam__flashfx go' });
  inst.root.append(fx);
  setTimeout(() => fx.remove(), 500);
  SFX.shutter();
  if (flashMode === 'on' || flashMode === 'torch') {
    document.getElementById('flash-beam')?.classList.add('on');
    setTimeout(() => { if (!S.phone.flashlight) document.getElementById('flash-beam')?.classList.remove('on'); }, 400);
  }

  const svg = sceneSvg(SCENES[sceneIdx].id, { front, pod: mode === 'night' ? 'night' : partOfDay() });
  const photo = {
    id: uid('p'),
    svg,
    at: S.time.gameMs,
    mode: mode,
    front,
    scene: SCENES[sceneIdx].id,
    sceneName: SCENES[sceneIdx].name,
    zoom,
    flash: flashMode,
    pod: mode === 'night' ? 'night' : partOfDay(),
    sizeMb: +(1.6 + Math.random() * 3.4).toFixed(1),
    iso: mode === 'night' ? rndInt(1600, 6400) : rndInt(50, 400),
    exp: mode === 'night' ? '4 с' : `1/${rndInt(120, 2000)}`,
    f: zoom > 2 ? '2.4' : front ? '2.2' : '1.7',
    caption: ''
  };
  addPhoto(photo);

  if (inst.shareTo) {
    const ok = await sysDialog({
      title: 'Отправить фото?', icon: '📤',
      text: `Фото «${photo.sceneName}» готово. Отправить в чат?`,
      buttons: [{ label: 'В галерею', value: false }, { label: '📤 Отправить', value: true, cls: 'primary' }]
    });
    if (ok) {
      const { sharePhotoTo } = await import('./messages.js');
      sharePhotoTo(inst.shareTo, photo);
      api.openApp('messages', { chat: inst.shareTo });
      return;
    }
  }
  render();
}

export function addPhoto(photo) {
  const S = getState();
  S.photos.push(photo);
  S.stats.photos++;
  S.phone.storage.photos += photo.sizeMb / 1024;
  save();
  emit(EV.PHOTO, photo);
  completeTask('t12');
  unlock('photo');
  if (S.stats.photos >= 10) unlock('photo10');
  if (photo.front) unlock('selfie');
  if (photo.mode === 'video') unlock('video');
  return photo;
}

function toggleRecording() {
  const S = getState();
  if (!recording) {
    recording = true;
    recStart = Date.now();
    SFX.recStart();
    $('#punch-camera')?.classList.add('rec');
    window.__batteryHeavy = true;
    toast('🎥', 'Запись началась', 'Красная точка сверху означает, что камера пишет');
  } else {
    stopRecording();
  }
  render();
}

function stopRecording(silent = false) {
  const S = getState();
  if (!recording) return;
  const dur = Math.max(1, Math.floor((Date.now() - recStart) / 1000));
  recording = false;
  clearInterval(recTimer);
  $('#punch-camera')?.classList.remove('rec');
  SFX.click();
  const svg = sceneSvg(SCENES[sceneIdx].id, { front, pod: partOfDay() });
  const photo = {
    id: uid('v'), svg, at: S.time.gameMs, mode: 'video', front,
    scene: SCENES[sceneIdx].id, sceneName: SCENES[sceneIdx].name, zoom, flash: flashMode,
    pod: partOfDay(), sizeMb: +(dur * 2.4).toFixed(1), duration: dur, video: true,
    iso: rndInt(100, 800), exp: '1/60', f: '1.7', caption: ''
  };
  addPhoto(photo);
  if (!silent) toast('🎥', 'Видео сохранено', `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')} · ${photo.sizeMb.toFixed(1).replace('.', ',')} МБ · 1080p 30fps`);
  unlock('video');
}

/* ======================= ЭКСПОРТЫ ======================= */
export function sharePhoto(photo, contactId) {
  return import('./messages.js').then((m) => m.sharePhotoTo(contactId, photo));
}
