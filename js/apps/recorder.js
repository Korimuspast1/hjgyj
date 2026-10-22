import { getState, save } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX, startRecording, stopRecording } from '../audio.js';
import { notify } from '../notify.js';
import { el, clear, uid, fmtDur, fmtSize, fmtTime, fmtDateShort, timeAgo, clamp } from '../util.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';
import { unlock } from '../achievements.js';

let inst = null, tick = null, waveTimer = null;

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app recorder theme-dark';
  const S = getState();
  if (!S.recordings) S.recordings = [];
  render();
  return {
    onFocus() { startWave(); },
    onBlur() { stopWave(); },
    onBack() { if (S.recorder?.recording) { return true; } return false; },
    onUnmount() { stopWave(); inst = null; }
  };
}

function startWave() {
  stopWave();
  waveTimer = setInterval(() => {
    if (!inst) return;
    const bars = inst.root.querySelectorAll('.wave i');
    bars.forEach((b) => { b.style.height = (10 + Math.random() * 74) + '%'; });
    const t = inst.root.querySelector('#rec-t');
    const S = getState();
    if (S.recorder?.recording && t) {
      const sec = (S.time.gameMs - S.recorder.startedAt) / 1000;
      t.textContent = fmtDur(sec);
      const sz = inst.root.querySelector('#rec-size');
      if (sz) sz.textContent = fmtSize(sec * 96000 / 8);
    }
  }, 110);
}
function stopWave() { clearInterval(waveTimer); waveTimer = null; }

function render() {
  if (!inst) return;
  const S = getState();
  if (!S.recorder) S.recorder = { recording: false, startedAt: 0, paused: false, quality: 'high' };
  clear(inst.root);

  const bar = el('div', { class: 'appbar' },
    el('h1', {}, el('span', { text: 'Диктофон' }), el('span', { class: 'sub', text: `${S.recordings.length} записей` })));
  const acts = el('div', { class: 'appbar__actions' });
  const qBtn = el('button', { class: 'iconbtn', onclick: () => quality() });
  qBtn.innerHTML = ICON.settings();
  acts.append(qBtn);
  bar.append(acts);
  inst.root.append(bar);

  const body = el('div', { class: 'appbody' });

  // экран записи
  const rec = el('div', { class: 'rec-panel' + (S.recorder.recording ? ' on' : '') });
  const wave = el('div', { class: 'wave' + (S.recorder.recording ? ' live' : '') });
  for (let i = 0; i < 42; i++) wave.append(el('i', { style: { height: S.recorder.recording ? '50%' : '6%', animationDelay: (i * 0.03) + 's' } }));
  rec.append(wave);
  rec.append(el('div', { class: 'rec-time', id: 'rec-t', text: S.recorder.recording ? fmtDur((S.time.gameMs - S.recorder.startedAt) / 1000) : '00:00' }));
  rec.append(el('div', { style: { fontSize: '11.5px', opacity: '.55', marginTop: '4px' } },
    el('span', { id: 'rec-size', text: '0 КБ' }),
    el('span', { text: S.recorder.recording ? ` · ${S.recorder.quality === 'high' ? 'высокое качество · 96 кбит/с' : 'экономия · 32 кбит/с'}` : ' · готов к записи' })));
  body.append(rec);

  const ctrl = el('div', { class: 'rec-ctrl' });
  const main = el('button', { class: 'rec-main' + (S.recorder.recording ? ' stop' : ''), onclick: () => S.recorder.recording ? stopRec() : startRec() });
  main.append(el('span', { text: S.recorder.recording ? '■' : '●' }));
  ctrl.append(main);
  body.append(ctrl);
  body.append(el('div', { style: { textAlign: 'center', fontSize: '11.5px', opacity: '.5', paddingBottom: '12px' }, text: S.recorder.recording ? 'Нажмите ■, чтобы остановить и сохранить' : 'Нажмите ●, чтобы начать запись' }));

  body.append(el('div', { class: 'sect-title', text: 'Записи' }));
  if (!S.recordings.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🎙️' }), 'Записей нет', el('br'), el('span', { style: { fontSize: '12px' }, text: 'Запишите голосовое и отправьте его в чат — адресат ответит' })));
  } else {
    const list = el('div', { class: 'list' });
    S.recordings.forEach((r) => {
      list.append(el('div', { class: 'list__row rec-row' },
        el('div', { class: 'rr-play', onclick: () => playRec(r) }, el('span', { text: r.playing ? '❚❚' : '▶' })),
        el('div', { class: 'grow', onclick: () => playRec(r) },
          el('div', { class: 't1', text: r.name }),
          el('div', { class: 't2', text: `${fmtTime(new Date(r.at))} · ${fmtDateShort(new Date(r.at))} · ${fmtDur(r.dur)} · ${fmtSize(r.size)}` }),
          el('div', { class: 'rr-bar' }, el('i', { style: { width: (r.progress || 0) + '%' } }))),
        el('button', { class: 'iconbtn', onclick: () => shareRec(r) }, el('span', { html: ICON.share(), style: { display: 'flex' } })),
        el('button', { class: 'iconbtn', onclick: () => delRec(r) }, el('span', { html: ICON.trash(), style: { display: 'flex' } }))
      ));
    });
    body.append(list);
  }

  inst.root.append(body);
  startWave();
}

async function startRec() {
  const S = getState();
  S.recorder.recording = true;
  S.recorder.startedAt = S.time.gameMs;
  S.recorder.paused = false;
  startRecording(S.recorder.quality);
  save();
  SFX.recStart();
  window.__batteryHeavy = (window.__batteryHeavy || 0) + 1;
  render();
  toast('🎙️', 'Запись начата', 'Микрофон активен · батарея расходуется быстрее');
}

async function stopRec() {
  const S = getState();
  const sec = Math.max(1, (S.time.gameMs - S.recorder.startedAt) / 1000);
  const bytesPerSec = S.recorder.quality === 'high' ? 12000 : 4000;
  const r = {
    id: uid('rec'),
    name: `Запись ${new Date(S.time.gameMs).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
    dur: Math.round(sec),
    size: Math.round(sec * bytesPerSec),
    at: S.time.gameMs,
    quality: S.recorder.quality,
    progress: 0
  };
  S.recordings.unshift(r);
  S.recorder.recording = false;
  S.phone.storage.media += r.size / 1024 / 1024 / 1024;
  stopRecording();
  window.__batteryHeavy = Math.max(0, (window.__batteryHeavy || 1) - 1);
  save();
  SFX.click();
  render();
  toast('🎙️', 'Запись сохранена', `${r.name} · ${fmtDur(r.dur)} · ${fmtSize(r.size)}`);
  unlock('video');
}

function playRec(r) {
  const S = getState();
  const wasPlaying = r.playing;
  S.recordings.forEach((x) => { x.playing = false; });
  r.playing = !wasPlaying;
  if (r.playing) {
    SFX.tap();
    let p = 0;
    const iv = setInterval(() => {
      p += 4;
      r.progress = clamp(p, 0, 100);
      const bar = inst?.root.querySelector('.rr-bar i');
      if (bar && inst) {
        // обновляем только нужную строку
        const rows = [...inst.root.querySelectorAll('.rec-row')];
        const idx = S.recordings.indexOf(r);
        const row = rows[idx];
        if (row) row.querySelector('.rr-bar i').style.width = p + '%';
        row.querySelector('.rr-play span').textContent = '❚❚';
      }
      if (p >= 100) {
        clearInterval(iv);
        r.playing = false; r.progress = 0;
        if (inst) render();
      }
    }, r.dur * 10);
  } else {
    r.progress = 0;
    if (inst) render();
  }
  save();
}

async function shareRec(r) {
  const S = getState();
  const list = S.contacts.filter((c) => c.messenger).slice(0, 6);
  const res = await sysDialog({
    title: 'Отправить запись', icon: '🎙️',
    text: `${r.name} · ${fmtDur(r.dur)}<br/><br/>Кому отправить голосовое?`,
    input: { placeholder: list.map((c) => c.name).join(', ') },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Отправить', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const c = list.find((x) => (x.name || '').toLowerCase().includes(q)) || list[0];
  const { pushMessage } = await import('./messages.js');
  pushMessage(c.id, 'out', `🎙️ Голосовое сообщение · ${fmtDur(r.dur)}`);
  SFX.click();
  toast('📤', 'Голосовое отправлено', c.name);
  setTimeout(() => window.__botMsg?.(c.id, 'прослушал(а) твоё голосовое 🎧'), 3500);
  api.openApp('messages', { chat: c.id });
}

async function delRec(r) {
  const ok = await sysConfirm('Удалить запись?', `${r.name} · ${fmtDur(r.dur)}`, 'Удалить', true);
  if (!ok) return;
  const S = getState();
  S.recordings = S.recordings.filter((x) => x.id !== r.id);
  save(); render();
  toast('🗑️', 'Запись удалена', r.name);
}

async function quality() {
  const S = getState();
  const res = await sysDialog({
    title: 'Качество записи', icon: '⚙️',
    text: S.recorder.quality === 'high'
      ? 'Текущее: <b>высокое</b> (96 кбит/с, ~43 МБ/час)'
      : 'Текущее: <b>экономия</b> (32 кбит/с, ~14 МБ/час)',
    buttons: [
      { label: 'Высокое качество', value: 'high', cls: S.recorder.quality === 'high' ? 'primary' : '' },
      { label: 'Экономия памяти', value: 'low', cls: S.recorder.quality === 'low' ? 'primary' : '' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (!res) return;
  S.recorder.quality = res;
  save(); render();
  toast('⚙️', 'Качество изменено', res === 'high' ? 'Высокое · 96 кбит/с' : 'Экономия · 32 кбит/с');
}
