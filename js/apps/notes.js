import { getState, save } from '../state.js';
import { emit, EV } from '../bus.js';
import { el, clear, uid, timeAgo, fmtTime, fmtDateShort } from '../util.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';
import { api } from '../api.js';

let inst = null, editing = null, query = '';

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app notes theme-dark';
  root.classList.toggle('theme-light', getState().phone.theme === 'light');
  render();
  return {
    light: getState().phone.theme === 'light',
    onBack() {
      if (editing) { saveNote(); return true; }
      if (query) { query = ''; render(); return true; }
      return false;
    },
    onUnmount() { if (editing) saveNote(); inst = null; }
  };
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Заметки' }), el('span', { class: 'sub', text: `${S.notes.length} шт.` })));
  const acts = el('div', { class: 'appbar__actions' });
  const sBtn = el('button', { class: 'iconbtn', onclick: () => { const inp = inst.root.querySelector('#nq'); inp?.focus(); inp?.scrollIntoView(); } });
  sBtn.innerHTML = ICON.search();
  const addBtn = el('button', { class: 'iconbtn', onclick: () => createNote() });
  addBtn.innerHTML = ICON.plus();
  acts.append(sBtn, addBtn);
  bar.append(acts);
  inst.root.append(bar);

  const searchBox = el('div', { class: 'set-search' });
  searchBox.innerHTML = ICON.search();
  const input = el('input', { id: 'nq', placeholder: 'Поиск по заметкам', value: query });
  input.addEventListener('input', () => { query = input.value.trim().toLowerCase(); renderBody(); });
  searchBox.append(input);
  inst.root.append(searchBox);

  const body = el('div', { class: 'appbody', id: 'notes-body' });
  inst.root.append(body);
  renderBody();

  const fab = el('button', { class: 'fab', style: { background: 'linear-gradient(135deg,#facc15,#a16207)', color: '#1a1405' }, onclick: () => createNote() });
  fab.innerHTML = ICON.edit();
  inst.root.append(fab);
}

function renderBody() {
  const S = getState();
  const body = inst.root.querySelector('#notes-body');
  if (!body) return;
  clear(body);
  let list = S.notes.slice();
  if (query) list = list.filter((n) => (n.title + ' ' + n.body).toLowerCase().includes(query));
  list.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.updated - a.updated);
  if (!list.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '📝' }),
      query ? `Ничего не нашлось по «${query}»` : 'Заметок нет', el('br'),
      el('span', { style: { fontSize: '12px' }, text: query ? '' : 'Нажмите ＋ и запишите пароль от Wi-Fi, чтобы не забыть' })));
    return;
  }
  list.forEach((n) => {
    const card = el('div', { class: 'note-card', onclick: () => openNote(n.id) });
    card.append(el('b', { text: (n.pinned ? '📌 ' : '') + (n.title || 'Без названия') }));
    if (n.body) card.append(el('p', { text: n.body }));
    card.append(el('div', { class: 'nc-date', text: `${timeAgo(n.updated)} · ${n.body.length} симв.` }));
    body.append(card);
  });
}

function createNote() {
  const S = getState();
  const n = { id: uid('n'), title: '', body: '', updated: S.time.gameMs, color: '#facc15', pinned: false };
  S.notes.unshift(n);
  save();
  editing = n.id;
  renderEditor(n);
  SFX.tap();
}

function openNote(id) {
  const S = getState();
  const n = S.notes.find((x) => x.id === id);
  if (!n) return;
  editing = id;
  renderEditor(n);
  SFX.tap();
}

function renderEditor(n) {
  clear(inst.root);
  const ed = el('div', { class: 'note-edit' });
  const bar = el('div', { class: 'appbar' });
  const back = el('button', { class: 'iconbtn', onclick: () => saveNote() });
  back.innerHTML = ICON.back();
  bar.append(back);
  bar.append(el('h1', {}, el('span', { style: { fontSize: '14px', opacity: '.7' }, text: `Изменено ${timeAgo(n.updated)}` })));
  const acts = el('div', { class: 'appbar__actions' });
  const pinBtn = el('button', { class: 'iconbtn', style: n.pinned ? { color: '#facc15' } : {}, onclick: () => { n.pinned = !n.pinned; save(); pinBtn.style.color = n.pinned ? '#facc15' : ''; SFX.tap(); toast('📌', n.pinned ? 'Заметка закреплена' : 'Откреплена', ''); } });
  pinBtn.innerHTML = ICON.pin();
  const shareBtn = el('button', { class: 'iconbtn', onclick: () => shareNote(n) });
  shareBtn.innerHTML = ICON.share();
  const delBtn = el('button', { class: 'iconbtn', onclick: () => delNote(n) });
  delBtn.innerHTML = ICON.trash();
  acts.append(pinBtn, shareBtn, delBtn);
  bar.append(acts);
  ed.append(bar);

  const title = el('input', { class: 'title', placeholder: 'Заголовок', value: n.title });
  title.addEventListener('input', () => { n.title = title.value; });
  ed.append(title);

  const ta = el('textarea', { placeholder: 'Начните писать…', value: n.body });
  ta.addEventListener('input', () => { n.body = ta.value; });
  ed.append(ta);

  const foot = el('div', { style: { padding: '8px 16px 22px', display: 'flex', gap: '8px', alignItems: 'center', fontSize: '11px', opacity: '.55' } });
  foot.append(el('span', { id: 'ncount', text: `${n.body.length} симв.` }));
  const colors = ['#facc15', '#f472b6', '#38bdf8', '#4ade80', '#a78bfa', '#fb923c'];
  const cw = el('div', { style: { marginLeft: 'auto', display: 'flex', gap: '6px' } });
  colors.forEach((c) => cw.append(el('div', {
    style: { width: '20px', height: '20px', borderRadius: '50%', background: c, cursor: 'pointer', border: n.color === c ? '2px solid #fff' : '2px solid transparent' },
    onclick: () => { n.color = c; save(); SFX.tap(); [...cw.children].forEach((x, i) => x.style.border = colors[i] === c ? '2px solid #fff' : '2px solid transparent'); }
  })));
  foot.append(cw);
  ed.append(foot);

  ta.addEventListener('input', () => { inst.root.querySelector('#ncount').textContent = `${ta.value.length} симв.`; });
  inst.root.append(ed);
  setTimeout(() => (n.title ? ta : title).focus(), 80);
}

function saveNote() {
  const S = getState();
  if (!editing) { render(); return; }
  const n = S.notes.find((x) => x.id === editing);
  editing = null;
  if (n) {
    if (!n.title && !n.body) {
      S.notes = S.notes.filter((x) => x.id !== n.id);
    } else {
      n.updated = S.time.gameMs;
      unlock('note');
    }
  }
  save();
  render();
}

async function delNote(n) {
  const ok = await sysConfirm('Удалить заметку?', n.title || 'Без названия', 'Удалить', true);
  if (!ok) return;
  const S = getState();
  S.notes = S.notes.filter((x) => x.id !== n.id);
  editing = null;
  save(); render();
  toast('🗑️', 'Заметка удалена', '');
}

async function shareNote(n) {
  const S = getState();
  const list = S.contacts.filter((c) => c.messenger || c.phone).slice(0, 6);
  const res = await sysDialog({
    title: 'Отправить заметку', icon: '📤',
    text: list.map((c, i) => `${i + 1}. ${c.name || c.full}`).join('<br/>'),
    input: { placeholder: 'Имя контакта' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Отправить', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const c = list.find((x) => (x.name || x.full || '').toLowerCase().includes(q)) || list[0];
  const { pushMessage } = await import('./messages.js');
  pushMessage(c.id, 'out', `📝 ${n.title || 'Заметка'}\n${n.body}`);
  toast('📤', 'Отправлено', c.name || c.full);
  api.openApp('messages', { chat: c.id });
}
