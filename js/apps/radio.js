import { getState, save } from '../state.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX, startRadio, stopRadio, setMasterVolume } from '../audio.js';
import { notify } from '../notify.js';
import { el, clear, rndInt, hash, fmtTime } from '../util.js';
import { toast, sysDialog } from '../ui.js';
import { hasInternet, useData } from '../net.js';
import { unlock } from '../achievements.js';

let inst = null, tick = null;

export const STATIONS = [
  { id: 'nova-fm', name: 'Nova FM', freq: '101.4', genre: 'Поп / хиты', color: '#f472b6', emoji: '🎤', now: 'Dua Lipa — Levitating' },
  { id: 'retro', name: 'Ретро Волна', freq: '88.0', genre: '80-е / 90-е', color: '#fbbf24', emoji: '📻', now: 'Modern Talking — Cheri Cheri Lady' },
  { id: 'jazz', name: 'Jazz Room', freq: '92.7', genre: 'Джаз', color: '#38bdf8', emoji: '🎷', now: 'Miles Davis — So What' },
  { id: 'techno', name: 'Underground', freq: '104.9', genre: 'Техно / хаус', color: '#a78bfa', emoji: '🎛️', now: 'DJ Nova — Concrete Dreams' },
  { id: 'lofi', name: 'Lo-Fi Кафе', freq: '96.2', genre: 'Для учёбы', color: '#4ade80', emoji: '🌧️', now: 'lofi beat №1742' },
  { id: 'news', name: 'Nova News Live', freq: '107.1', genre: 'Новости', color: '#fb7185', emoji: '📰', now: 'Выпуск 17:00 · экономика' },
  { id: 'classic', name: 'Классика', freq: '99.5', genre: 'Оркестр', color: '#e2e8f0', emoji: '🎻', now: 'Шопен — Ноктюрн op.9 №2' },
  { id: 'metal', name: 'Стальной Край', freq: '106.6', genre: 'Рок / метал', color: '#94a3b8', emoji: '🤘', now: 'Metallica — One' },
  { id: 'kids', name: 'Детское радио', freq: '90.3', genre: 'Для детей', color: '#facc15', emoji: '🧸', now: 'Песенка про трактор' }
];

export function mount(root, a, params) {
  inst = { root, api: a };
  root.className = 'app radio theme-dark';
  render();
  return {
    onFocus() { startTick(); },
    onBlur() { stopTick(); },
    onUnmount() { stopTick(); inst = null; }
  };
}

function startTick() {
  stopTick();
  tick = setInterval(() => {
    const S = getState();
    if (!inst || !S.radio?.playing) return;
    S.radio.elapsed = (S.radio.elapsed || 0) + 5;
    const node = inst.root.querySelector('#rd-now');
    if (node) node.textContent = S.radio.now || '…';
    const t = inst.root.querySelector('#rd-time');
    if (t) t.textContent = fmtTime(new Date(S.time.gameMs));
  }, 5000);
}
function stopTick() { clearInterval(tick); tick = null; }

function render() {
  if (!inst) return;
  const S = getState();
  if (!S.radio) S.radio = { station: 'nova-fm', playing: false, favs: ['retro', 'lofi'], now: '', elapsed: 0, volume: 45 };
  const cur = STATIONS.find((s) => s.id === S.radio.station) || STATIONS[0];
  const net = hasInternet();
  clear(inst.root);

  const bar = el('div', { class: 'appbar', style: { background: 'transparent' } },
    el('h1', {}, el('span', { text: 'FM Радио' }), el('span', { class: 'sub', text: net.ok ? `${net.kind === 'wifi' ? 'Wi-Fi' : 'мобильные данные'} · поток 128 кбит/с` : 'нет сети' })));
  const acts = el('div', { class: 'appbar__actions' });
  const favBtn = el('button', { class: 'iconbtn', onclick: () => toggleFav(cur) });
  favBtn.innerHTML = ICON.star();
  favBtn.style.color = S.radio.favs.includes(cur.id) ? '#facc15' : '';
  acts.append(favBtn);
  bar.append(acts);
  inst.root.append(bar);

  const body = el('div', { class: 'appbody' });

  // большая ручка настройки
  const dial = el('div', { class: 'radio__dial', style: { background: `radial-gradient(120% 90% at 50% 0%, ${cur.color}33, transparent 70%)` } });
  const scale = el('div', { class: 'rd-scale' });
  for (let f = 87; f <= 108; f++) {
    const st = STATIONS.find((s) => Math.round(parseFloat(s.freq)) === f);
    scale.append(el('div', { class: 'rd-tick' + (st ? ' major' : '') + (st && st.id === cur.id ? ' cur' : ''), title: st ? st.name : `${f} МГц` },
      st ? el('span', { text: st.emoji }) : null));
  }
  dial.append(scale);
  dial.append(el('div', { class: 'rd-freq' }, el('b', { text: cur.freq }), el('span', { text: 'МГц · FM' })));
  dial.append(el('div', { class: 'rd-name', text: cur.name }));
  dial.append(el('div', { class: 'rd-genre', text: cur.genre }));
  dial.append(el('div', { class: 'rd-live', id: 'rd-live' },
    el('div', {}, el('span', { style: { opacity: '.55', fontSize: '10.5px', letterSpacing: '.08em' }, text: 'СЕЙЧАС В ЭФИРЕ' }),
      el('div', { id: 'rd-now', style: { fontSize: '14.5px', fontWeight: '600', marginTop: '4px' }, text: S.radio.playing ? (S.radio.now || cur.now) : 'нажмите ▶, чтобы включить' })),
    el('div', { class: 'rd-clock' }, el('span', { id: 'rd-time', text: fmtTime(new Date(S.time.gameMs)) }))
  ));
  dial.append(el('div', { class: 'rd-eq' + (S.radio.playing ? ' on' : '') },
    ...Array.from({ length: 16 }, (_, i) => el('i', { style: { animationDelay: (i * 0.09) + 's', height: (14 + ((hash(cur.id + i) % 30))) + 'px' } }))));
  body.append(dial);

  if (!net.ok) {
    body.append(el('div', { style: { margin: '0 16px 12px', padding: '11px 13px', borderRadius: '14px', background: 'rgba(239,68,68,.14)', border: '1px solid rgba(239,68,68,.28)', fontSize: '12px', lineHeight: '1.5' },
      text: `📡 ${net.why}. Радио — это интернет-поток, без сети не работает. ${net.fix || ''}` }));
  }

  // кнопки
  const ctrl = el('div', { class: 'radio__ctrl' });
  ctrl.append(el('button', { class: 'rd-btn', onclick: () => tune(-1) }, el('span', { html: ICON.prev(), style: { display: 'flex' } })));
  const play = el('button', { class: 'rd-btn rd-play', onclick: () => togglePlay(cur, net) });
  play.innerHTML = S.radio.playing ? ICON.pause() : ICON.play();
  ctrl.append(play);
  ctrl.append(el('button', { class: 'rd-btn', onclick: () => tune(1) }, el('span', { html: ICON.next(), style: { display: 'flex' } })));
  body.append(ctrl);

  const vol = el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', padding: '0 22px 16px' } });
  const vs = el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(S.radio.volume) });
  vs.addEventListener('input', () => { S.radio.volume = +vs.value; setMasterVolume(S.radio.volume / 100 * 0.8); save(); });
  vol.append(el('span', { html: ICON.volDown(), style: { display: 'flex', opacity: '.55' } }), vs, el('span', { html: ICON.volUp(), style: { display: 'flex', opacity: '.55' } }));
  body.append(vol);

  body.append(el('div', { class: 'sect-title', text: `Станции (${STATIONS.length})` }));
  const list = el('div', { class: 'list' });
  STATIONS.forEach((s) => {
    const on = s.id === S.radio.station && S.radio.playing;
    list.append(el('div', { class: 'list__row station' + (on ? ' on' : ''), onclick: () => pick(s, net) },
      el('div', { class: 'st-ico', style: { background: `linear-gradient(135deg,${s.color},#111)` }, text: s.emoji }),
      el('div', { class: 'grow' },
        el('div', { class: 't1', text: s.name + (S.radio.favs.includes(s.id) ? ' ★' : '') }),
        el('div', { class: 't2', text: `${s.freq} МГц · ${s.genre}` })),
      el('div', { class: 't3', text: on ? '● в эфире' : '' })
    ));
  });
  body.append(list);

  body.append(el('div', { style: { padding: '16px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: '⏰ Таймер сна (30 мин)', onclick: () => sleepTimer() })));

  inst.root.append(body);
}

function pick(s, net) {
  const S = getState();
  S.radio.station = s.id;
  save();
  SFX.tap();
  if (S.radio.playing) {
    if (!net.ok) { stopRadio(); S.radio.playing = false; toast('📡', 'Нет сети', net.why); }
    else startRadio(s.id === 'news' ? 'talk' : 'music');
  }
  render();
}

function tune(d) {
  const S = getState();
  const i = STATIONS.findIndex((s) => s.id === S.radio.station);
  pick(STATIONS[(i + d + STATIONS.length) % STATIONS.length], hasInternet());
}

function togglePlay(s, net) {
  const S = getState();
  if (S.radio.playing) {
    S.radio.playing = false;
    stopRadio();
    SFX.tap();
    notify({ appId: 'radio', icon: '📻', color: s.color, title: 'Радио на паузе', text: s.name, silent: true });
  } else {
    if (!net.ok) {
      SFX.error();
      toast('📡', 'Радио недоступно', net.why + ' ' + (net.fix || ''));
      return;
    }
    S.radio.playing = true;
    S.radio.now = randomTrack(s);
    S.radio.elapsed = 0;
    startRadio(s.id === 'news' ? 'talk' : 'music');
    setMasterVolume(S.radio.volume / 100 * 0.8);
    unlock('internet');
    useData(0.4);
    notify({
      id: 'radio-notif', appId: 'radio', icon: '📻', color: s.color, persistent: true, silent: true,
      title: `${s.name} · ${s.freq} МГц`, text: S.radio.now, action: { type: 'app', id: 'radio' },
      actions: [{ label: '⏹', act: () => { S.radio.playing = false; stopRadio(); save(); render(); } }]
    });
  }
  save();
  render();
}

function randomTrack(s) {
  const tracks = {
    'nova-fm': ['Dua Lipa — Levitating', 'The Weeknd — Blinding Lights', 'Лобода — Суперзвезда', 'Imagine Dragons — Bones'],
    retro: ['ABBA — Gimme! Gimme! Gimme!', 'Queen — Radio Ga Ga', 'Руки Вверх — Крошка моя', 'A-ha — Take On Me'],
    jazz: ['John Coltrane — Blue Train', 'Bill Evans — Waltz for Debby', 'Chet Baker — My Funny Valentine'],
    techno: ['DJ Nova — Concrete Dreams', 'Underworld — Born Slippy', 'Charlotte de Witte — Doppler'],
    lofi: ['lofi beat №' + rndInt(1000, 9999), 'дождь за окном (трек 3)', 'учёба в 3 ночи — mix'],
    news: ['Выпуск ' + fmtTime(new Date(getState().time.gameMs)) + ' · экономика', 'Погода в Брюсселе: +13°, дождь', 'Интервью с разработчиком симулятора'],
    classic: ['Шопен — Ноктюрн op.9 №2', 'Бах — Токката ре минор', 'Вивальди — Зима'],
    metal: ['Metallica — One', 'Rammstein — Du Hast', 'Iron Maiden — The Trooper'],
    kids: ['Песенка про трактор', 'Два весёлых гуся', 'Считалочка']
  };
  const list = tracks[s.id] || tracks['nova-fm'];
  return list[rndInt(0, list.length - 1)];
}

function toggleFav(s) {
  const S = getState();
  if (S.radio.favs.includes(s.id)) S.radio.favs = S.radio.favs.filter((x) => x !== s.id);
  else S.radio.favs.push(s.id);
  save(); SFX.tap();
  toast('★', S.radio.favs.includes(s.id) ? 'В избранном' : 'Убрано из избранного', s.name);
  render();
}

async function sleepTimer() {
  const res = await sysDialog({
    title: 'Таймер сна', icon: '🌙',
    text: 'Радио выключится автоматически — удобно, если засыпаете под lo-fi.',
    buttons: [
      { label: '15 минут', value: 15 }, { label: '30 минут', value: 30 },
      { label: '60 минут', value: 60 }, { label: 'Отмена', value: null }
    ]
  });
  if (!res) return;
  const S = getState();
  S.radio.sleep = res;
  save();
  toast('🌙', `Таймер сна: ${res} мин`, 'Радио выключится само');
  setTimeout(() => {
    if (getState().radio.playing) {
      getState().radio.playing = false;
      stopRadio(); save();
      notify({ appId: 'radio', icon: '🌙', color: '#a78bfa', title: 'Радио выключено', text: 'Таймер сна сработал. Спокойной ночи!', silent: true });
      if (inst) render();
    }
  }, res * 60000);
}
