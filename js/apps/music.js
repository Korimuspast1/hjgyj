import { getState, save } from '../state.js';
import { emit, EV, on } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX, startFakeMusic, stopFakeMusic, setMasterVolume } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, fmtDur, rndInt, clamp } from '../util.js';
import { toast, sysDialog } from '../ui.js';

let inst = null, uiTimer = null;

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app music theme-dark';
  render();
  return {
    onFocus() { startUiLoop(); },
    onBlur() { stopUiLoop(); },
    onBack() { return false; },
    onUnmount() { stopUiLoop(); inst = null; }
  };
}

function startUiLoop() {
  stopUiLoop();
  uiTimer = setInterval(() => {
    const S = getState();
    if (!inst) return;
    if (S.music.playing) {
      S.music.pos += 1;
      const t = curTrack();
      if (S.music.pos >= t.dur) {
        if (S.music.repeat === 'one') S.music.pos = 0;
        else next(true);
      }
      updateProgress();
      save();
    }
  }, 1000);
}
function stopUiLoop() { clearInterval(uiTimer); uiTimer = null; }

function curTrack() {
  const S = getState();
  return S.music.tracks.find((t) => t.id === S.music.trackId) || S.music.tracks[0];
}

function render() {
  if (!inst) return;
  const S = getState();
  const t = curTrack();
  clear(inst.root);

  const bar = el('div', { class: 'appbar', style: { background: 'transparent' } },
    el('h1', {}, el('span', { text: 'Музыка' }), el('span', { class: 'sub', text: `${S.music.tracks.length} треков · офлайн-библиотека` })));
  const acts = el('div', { class: 'appbar__actions' });
  const shuffleAll = el('button', { class: 'iconbtn', title: 'Перемешать всё', onclick: () => { S.music.shuffle = true; save(); playTrack(S.music.tracks[rndInt(0, S.music.tracks.length - 1)].id); toast('🔀', 'Перемешивание', 'Порядок треков случаен'); } });
  shuffleAll.innerHTML = ICON.shuffle();
  acts.append(shuffleAll);
  bar.append(acts);
  inst.root.append(bar);

  const body = el('div', { class: 'appbody' });

  // плеер
  const np = el('div', { class: 'np' });
  const cover = el('div', { class: 'np__cover' + (S.music.playing ? ' spinning' : ''), style: { background: `linear-gradient(140deg, ${t.color}, #12081f)` } });
  cover.append(el('div', { class: 'cc', text: t.emoji }));
  np.append(cover);
  np.append(el('div', { class: 'np__title', id: 'np-title', text: t.title }));
  np.append(el('div', { class: 'np__artist', id: 'np-artist', text: `${t.artist} · ${t.album}` }));

  const seek = el('div', { class: 'np__seek' });
  const sl = el('input', { class: 'slider', id: 'np-seek', type: 'range', min: '0', max: String(t.dur), value: String(Math.floor(S.music.pos)) });
  sl.addEventListener('input', () => { S.music.pos = +sl.value; updTimes(); });
  sl.addEventListener('change', () => save());
  seek.append(sl);
  np.append(seek);
  np.append(el('div', { class: 'np__times' },
    el('span', { id: 'np-cur', text: fmtDur(S.music.pos) }),
    el('span', { id: 'np-left', text: '-' + fmtDur(t.dur - S.music.pos) })));

  const ctrl = el('div', { class: 'np__ctrl' });
  const b1 = el('button', { title: 'Назад 10 сек', onclick: () => { S.music.pos = Math.max(0, S.music.pos - 10); updTimes(); save(); } });
  b1.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M11 5 4 12l7 7"/><path d="M20 5l-7 7 7 7"/></svg>`;
  const b2 = el('button', { onclick: () => prev() }); b2.innerHTML = ICON.prev();
  const playBtn = el('button', { class: 'np__play', onclick: () => toggle() });
  playBtn.innerHTML = S.music.playing ? ICON.pause() : ICON.play();
  const b3 = el('button', { onclick: () => next() }); b3.innerHTML = ICON.next();
  const b4 = el('button', { title: 'Вперёд 10 сек', onclick: () => { S.music.pos = Math.min(t.dur, S.music.pos + 10); updTimes(); save(); } });
  b4.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M13 5l7 7-7 7"/><path d="M4 5l7 7-7 7"/></svg>`;
  ctrl.append(b1, b2, playBtn, b3, b4);
  np.append(ctrl);

  const modes = el('div', { class: 'np__modes' });
  const shBtn = el('button', { class: S.music.shuffle ? 'on' : '', title: 'Перемешать', onclick: () => { S.music.shuffle = !S.music.shuffle; shBtn.classList.toggle('on', S.music.shuffle); save(); SFX.tap(); } });
  shBtn.innerHTML = ICON.shuffle();
  const rpBtn = el('button', { class: S.music.repeat !== 'off' ? 'on' : '', title: 'Повтор', text: S.music.repeat === 'one' ? '🔂' : '', onclick: () => {
    S.music.repeat = S.music.repeat === 'off' ? 'all' : S.music.repeat === 'all' ? 'one' : 'off';
    rpBtn.classList.toggle('on', S.music.repeat !== 'off');
    rpBtn.textContent = S.music.repeat === 'one' ? '🔂' : '';
    save(); SFX.tap();
  } });
  rpBtn.innerHTML = S.music.repeat === 'one' ? '' : ICON.repeat();
  modes.append(shBtn, rpBtn);
  np.append(modes);

  // громкость
  const vol = el('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', width: '100%', marginTop: '18px' } });
  const vi = el('span', { html: ICON.volDown(), style: { display: 'flex', opacity: '.6' } });
  const vs = el('input', { class: 'slider', type: 'range', min: '0', max: '100', value: String(S.phone.volume.media) });
  vs.addEventListener('input', () => {
    S.phone.volume.media = +vs.value;
    setMasterVolume(S.phone.volume.media / 100 * 0.8);
    save();
  });
  vol.append(vi, vs, el('span', { html: ICON.volUp(), style: { display: 'flex', opacity: '.6' } }));
  np.append(vol);

  body.append(np);

  // очередь
  body.append(el('div', { class: 'sect-title', text: 'Все треки' }));
  S.music.tracks.forEach((tr) => {
    const playing = tr.id === S.music.trackId && S.music.playing;
    const row = el('div', { class: 'track-row' + (playing ? ' playing' : ''), onclick: () => playTrack(tr.id) });
    row.append(el('div', { class: 'tr-cov', style: { background: `linear-gradient(135deg,${tr.color},#111)` }, text: tr.emoji }));
    const g = el('div', { style: { flex: '1', minWidth: '0' } });
    g.append(el('div', { class: 'tr-t', text: tr.title }));
    g.append(el('div', { class: 'tr-a', text: `${tr.artist} · ${tr.album}` }));
    row.append(g);
    if (playing) {
      row.append(el('div', { class: 'eq-bars' }, el('i'), el('i'), el('i'), el('i')));
    }
    row.append(el('div', { class: 'tr-d', text: fmtDur(tr.dur) }));
    body.append(row);
  });

  body.append(el('div', { style: { padding: '18px 16px 24px', fontSize: '11.5px', opacity: '.45', lineHeight: '1.6' },
    text: 'Музыка синтезируется прямо в браузере (WebAudio) — никаких внешних файлов. Подключите наушники Nova Buds Air в Настройках → Bluetooth.' }));

  inst.root.append(body);
  startUiLoop();
}

function updateProgress() {
  if (!inst) return;
  const S = getState();
  const t = curTrack();
  const sl = inst.root.querySelector('#np-seek');
  if (sl) { sl.max = String(t.dur); sl.value = String(Math.floor(S.music.pos)); }
  updTimes();
}
function updTimes() {
  const S = getState();
  const t = curTrack();
  const cur = inst?.root.querySelector('#np-cur');
  const left = inst?.root.querySelector('#np-left');
  const sl = inst?.root.querySelector('#np-seek');
  if (cur) cur.textContent = fmtDur(S.music.pos);
  if (left) left.textContent = '-' + fmtDur(Math.max(0, t.dur - S.music.pos));
  if (sl) sl.value = String(Math.floor(S.music.pos));
}

function toggle() {
  const S = getState();
  S.music.playing = !S.music.playing;
  if (S.music.playing) {
    startFakeMusic(S.music.tracks.findIndex((t) => t.id === S.music.trackId));
    setMasterVolume(S.phone.volume.media / 100 * 0.8);
    unlock('music');
    updateMediaNotif();
  } else {
    stopFakeMusic();
    notify({ appId: 'music', icon: curTrack().emoji, color: curTrack().color, title: 'Пауза', text: `${curTrack().title} · ${curTrack().artist}`, silent: true });
  }
  save();
  emit('music-changed');
  SFX.tap();
  render();
}

function playTrack(id) {
  const S = getState();
  S.music.trackId = id;
  S.music.pos = 0;
  S.music.playing = true;
  stopFakeMusic();
  startFakeMusic(S.music.tracks.findIndex((t) => t.id === id));
  setMasterVolume(S.phone.volume.media / 100 * 0.8);
  unlock('music');
  updateMediaNotif();
  save();
  emit('music-changed');
  render();
}

function next(auto = false) {
  const S = getState();
  const i = S.music.tracks.findIndex((t) => t.id === S.music.trackId);
  let n;
  if (S.music.shuffle) n = rndInt(0, S.music.tracks.length - 1);
  else n = (i + 1) % S.music.tracks.length;
  if (!auto && n === i) n = (i + 1) % S.music.tracks.length;
  S.music.trackId = S.music.tracks[n].id;
  S.music.pos = 0;
  if (S.music.playing) { stopFakeMusic(); startFakeMusic(n); }
  updateMediaNotif();
  save();
  emit('music-changed');
  render();
}
function prev() {
  const S = getState();
  if (S.music.pos > 4) { S.music.pos = 0; save(); render(); return; }
  const i = S.music.tracks.findIndex((t) => t.id === S.music.trackId);
  const n = (i - 1 + S.music.tracks.length) % S.music.tracks.length;
  S.music.trackId = S.music.tracks[n].id;
  S.music.pos = 0;
  if (S.music.playing) { stopFakeMusic(); startFakeMusic(n); }
  save(); emit('music-changed'); render();
}

function updateMediaNotif() {
  const S = getState();
  const t = curTrack();
  notify({
    id: 'media-notif', appId: 'music', icon: t.emoji, color: t.color, persistent: true, silent: true,
    title: t.title, text: `${t.artist} · ${S.music.playing ? '▶ играет' : '⏸ пауза'}`,
    action: { type: 'app', id: 'music' },
    actions: [
      { label: '⏮', act: () => prev() },
      { label: S.music.playing ? '⏸' : '▶', act: () => toggle() },
      { label: '⏭', act: () => next() }
    ]
  });
}

export function globalToggle() { toggle(); }
export function globalNext() { next(); }
export function globalPrev() { prev(); }
