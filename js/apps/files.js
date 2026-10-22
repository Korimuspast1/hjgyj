import { getState, save } from '../state.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { el, clear, uid, fmtSize, timeAgo, fmtTime, hash } from '../util.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';

let inst = null, path = ['Внутренний накопитель'];

const BASE_FOLDERS = [
  { name: 'DCIM', icon: '📷', type: 'folder', desc: 'Фото и видео с камеры' },
  { name: 'Загрузки', icon: '⬇️', type: 'folder', desc: 'Скачанные файлы' },
  { name: 'Документы', icon: '📄', type: 'folder', desc: 'PDF и квитанции' },
  { name: 'Музыка', icon: '🎵', type: 'folder', desc: '6 треков офлайн' },
  { name: 'Рингтоны', icon: '🔔', type: 'folder', desc: 'Мелодии звонка' },
  { name: 'Android', icon: '🤖', type: 'folder', desc: 'Системные данные (не трогать)' },
  { name: 'Nova', icon: '📱', type: 'folder', desc: 'Данные NovaOS' }
];

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app files theme-dark';
  root.classList.toggle('theme-light', getState().phone.theme === 'light');
  path = ['Внутренний накопитель'];
  render();
  return {
    light: getState().phone.theme === 'light',
    onBack() { if (path.length > 1) { path.pop(); render(); return true; } return false; },
    onUnmount() { inst = null; }
  };
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const cur = path[path.length - 1];
  const bar = el('div', { class: 'appbar' });
  if (path.length > 1) {
    const back = el('button', { class: 'iconbtn', onclick: () => { path.pop(); SFX.back(); render(); } });
    back.innerHTML = ICON.back();
    bar.append(back);
  }
  bar.append(el('h1', {}, el('span', { text: cur }), el('span', { class: 'sub', text: path.length === 1 ? `занято ${usedTotal().toFixed(1)} ГБ из ${S.phone.storage.total} ГБ` : folderCount(cur) + ' объектов' })));
  const acts = el('div', { class: 'appbar__actions' });
  const sBtn = el('button', { class: 'iconbtn', onclick: () => searchFiles() });
  sBtn.innerHTML = ICON.search();
  acts.append(sBtn);
  bar.append(acts);
  inst.root.append(bar);

  const crumb = el('div', { class: 'crumb' });
  path.forEach((p, i) => {
    if (i) crumb.append(el('span', { text: '›', style: { opacity: '.4' } }));
    crumb.append(el('button', { text: p, onclick: () => { path = path.slice(0, i + 1); render(); } }));
  });
  inst.root.append(crumb);

  const body = el('div', { class: 'appbody' });
  inst.root.append(body);

  const items = listFor(cur);
  if (!items.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '📂' }), 'Папка пуста', el('br'), el('span', { style: { fontSize: '12px' }, text: 'Файлы появляются после покупок, фото и загрузок из браузера' })));
    return;
  }
  const list = el('div', { class: 'list' });
  items.forEach((f) => {
    list.append(el('div', { class: 'list__row file-row', onclick: () => openFile(f) },
      el('div', { class: 'f-ico', text: f.icon }),
      el('div', { class: 'grow' },
        el('div', { class: 't1', text: f.name }),
        el('div', { class: 't2', text: f.type === 'folder' ? (f.desc || 'Папка') : `${fmtSize(f.size * 1024)} · ${timeAgo(f.at || S.time.gameMs)}` })),
      el('div', { class: 't3', html: f.type === 'folder' ? ICON.chevR() : '', style: { display: 'flex', opacity: '.35' } })
    ));
  });
  body.append(list);
}

function usedTotal() {
  const S = getState();
  const st = S.phone.storage;
  return st.apps + st.system + st.media + st.photos + S.photos.reduce((a, p) => a + p.sizeMb, 0) / 1024;
}

function folderCount(name) { return listFor(name).length; }

function listFor(folder) {
  const S = getState();
  if (folder === 'Внутренний накопитель') {
    return BASE_FOLDERS.map((f) => ({ ...f, type: 'folder' }));
  }
  if (folder === 'DCIM') {
    return S.photos.slice().reverse().map((p) => ({
      name: (p.video ? 'VID_' : 'IMG_') + new Date(p.at).toISOString().slice(2, 10).replace(/-/g, '') + '_' + p.id.slice(-4).toUpperCase() + (p.video ? '.mp4' : '.jpg'),
      icon: p.video ? '🎥' : '🖼️', type: 'file', size: p.sizeMb, at: p.at, kind: p.video ? 'video' : 'photo', ref: p
    }));
  }
  if (folder === 'Музыка') {
    return S.music.tracks.map((t, i) => ({ name: `${i + 1}. ${t.artist} — ${t.title}.mp3`, icon: '🎵', type: 'file', size: t.dur * 0.06, at: S.time.gameMs, kind: 'audio', ref: t }));
  }
  if (folder === 'Загрузки') {
    return (S.files || []).filter((f) => f.folder === 'Загрузки').map((f) => ({ ...f, icon: iconFor(f) }));
  }
  if (folder === 'Документы') {
    const docs = [
      { name: 'Чек_NOVA_X5_Pro.pdf', icon: '🧾', type: 'file', size: 0.24, at: S.time.gameMs - 4 * 3600000, kind: 'doc', text: 'NOVA Electronics\nЧек о покупке\n\nNOVA X5 Pro 12/256 ГБ — 899,00 €\nЧехол в подарок — 0,00 €\nSIM-карта — 0,00 €\n\nИТОГО: 899,00 €\nОплата: карта •••• 7723\nСпасибо за покупку!' },
      { name: 'Инструкция_X5_Pro.pdf', icon: '📘', type: 'file', size: 4.8, at: S.time.gameMs - 4 * 3600000, kind: 'doc', text: 'NOVA X5 Pro — краткое руководство\n\n1. Вставьте SIM-карту с помощью скрепки.\n2. Зажмите кнопку питания справа на 1 секунду.\n3. Пройдите первоначальную настройку.\n4. Снимите защитную плёнку (или оставьте — мы не осудим).\n\nГарантия 24 месяца. Не погружать в кофе.' },
      { name: 'Договор_с_оператором.pdf', icon: '📄', type: 'file', size: 0.9, at: S.time.gameMs - 3 * 3600000, kind: 'doc', text: S.phone.sim.operator ? `Договор об оказании услуг связи\n\nОператор: ${S.phone.sim.operator === 'mobiline' ? 'Mobiline' : 'Telka'}\nНомер: ${S.phone.sim.number}\nТариф: ежедневная абонплата\n\nПункт 7.3: оператор не несёт ответственности за то, что вы сидите в телефоне до трёх ночи.` : 'SIM-карта не установлена — договора нет.' }
    ];
    return docs.concat((S.files || []).filter((f) => f.folder === 'Документы').map((f) => ({ ...f, icon: iconFor(f) })));
  }
  if (folder === 'Рингтоны') {
    return [
      { name: 'Nova (по умолчанию).ogg', icon: '🔔', type: 'file', size: 0.6, kind: 'audio', at: S.time.gameMs },
      { name: 'Перезвон.ogg', icon: '🔔', type: 'file', size: 0.4, kind: 'audio', at: S.time.gameMs },
      { name: 'Ретро-телефон.mp3', icon: '📞', type: 'file', size: 1.2, kind: 'audio', at: S.time.gameMs },
      { name: 'Будильник_жёсткий.mp3', icon: '⏰', type: 'file', size: 0.9, kind: 'audio', at: S.time.gameMs }
    ];
  }
  if (folder === 'Android') {
    return [
      { name: 'data', icon: '🤖', type: 'folder', desc: '12,4 ГБ · системные данные' },
      { name: 'obb', icon: '🎮', type: 'folder', desc: 'кэши игр' },
      { name: 'НЕ_УДАЛЯТЬ.txt', icon: '⚠️', type: 'file', size: 0.001, kind: 'doc', at: S.time.gameMs, text: 'Серьёзно. Не надо.' }
    ];
  }
  if (folder === 'Nova') {
    return [
      { name: 'wallpapers', icon: '🖼️', type: 'folder', desc: '9 встроенных обоев' },
      { name: 'setup_log.txt', icon: '📝', type: 'file', size: 0.02, kind: 'doc', at: S.phone.firstBootAt || S.time.gameMs, text: `Журнал первой настройки\n\nЯзык: ${S.phone.lang}\nWi-Fi: ${S.phone.wifi.ssid || 'не подключён'}\nSIM: ${S.phone.sim.operator || 'нет'}\nPIN: установлен\nОтпечаток: ${S.phone.user.fp ? 'да' : 'нет'}\nОбои: ${S.phone.wallpaper}` },
      { name: 'crash_report_00.log', icon: '🐛', type: 'file', size: 0.05, kind: 'doc', at: S.time.gameMs, text: 'Exception: UserTooHappy\n  at PeelFilmScreen.smile(Film.java:42)\n  at UnboxingFlow.step(UnboxingFlow.java:7)\n\nКомментарий разработчика: это не баг, это фича.' }
    ];
  }
  return [];
}

function iconFor(f) {
  if (f.name.endsWith('.pdf')) return '📄';
  if (f.name.endsWith('.jpg') || f.name.endsWith('.png')) return '🖼️';
  if (f.name.endsWith('.mp4')) return '🎥';
  if (f.name.endsWith('.mp3')) return '🎵';
  return '📦';
}

async function openFile(f) {
  const S = getState();
  SFX.tap();
  if (f.type === 'folder') { path.push(f.name); render(); return; }
  if (f.kind === 'photo' || f.kind === 'video') {
    api.openApp('gallery');
    return;
  }
  if (f.kind === 'audio') {
    api.openApp('music');
    return;
  }
  await sysDialog({
    title: f.name, icon: f.icon || '📄',
    text: (f.text || 'Файл открыт в просмотрщике NovaOS.\nСодержимое пустое, зато имя красивое.').replace(/\n/g, '<br/>') + `<br/><br/><span style="opacity:.55;font-size:11.5px">Размер: ${fmtSize((f.size || 0.1) * 1024)}</span>`,
    buttons: [
      { label: '📤 Поделиться', value: 'share' },
      { label: '🗑️ Удалить', value: 'del', cls: 'danger' },
      { label: 'Закрыть', value: null }
    ]
  }).then(async (v) => {
    if (v === 'share') {
      toast('📤', 'Отправить файл', 'Выберите чат — файл уйдёт как документ');
      api.openApp('messages');
    }
    if (v === 'del' && f.id) {
      if (await sysConfirm('Удалить файл?', f.name, 'Удалить', true)) {
        S.files = S.files.filter((x) => x.id !== f.id);
        save(); render();
        toast('🗑️', 'Файл удалён', f.name);
      }
    }
  });
}

async function searchFiles() {
  const S = getState();
  const res = await sysDialog({
    title: 'Поиск файлов', icon: '🔎',
    text: 'Искать по всему накопителю',
    input: { placeholder: 'например: чек' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Найти', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const all = [];
  BASE_FOLDERS.forEach((f) => listFor(f.name).forEach((x) => { if (!x.type || x.type === 'file') all.push({ ...x, from: f.name }); }));
  const found = all.filter((f) => (f.name || '').toLowerCase().includes(q));
  await sysDialog({
    title: `Найдено: ${found.length}`, icon: '🔎',
    text: found.length ? found.slice(0, 12).map((f) => `📂 ${f.from} → <b>${f.name}</b>`).join('<br/>') : `По запросу «${q}» ничего нет. Попробуйте «чек» или «pdf».`,
    buttons: [{ label: 'Закрыть', value: true, cls: 'primary' }]
  });
}
