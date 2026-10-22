import { getState, save, completeTask, displayName } from '../state.js';
import { emit, EV, on } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify, badgeCount, clearAppNotifs, vibrate } from '../notify.js';
import { el, clear, uid, fmtTime, chatStamp, timeAgo, pick, rndInt, clamp, onLongPress, plural, esc } from '../util.js';
import { avatar, toast, sysDialog, sysConfirm } from '../ui.js';

/* =========================================================
   ХАРАКТЕРЫ КОНТАКТОВ
   ========================================================= */
const PERSONAS = {
  mom: {
    typing: (t) => 900 + t.length * 42,
    keywords: [
      { k: ['привет', 'здравств', 'хай', 'добр'], r: 'Привет, солнышко! Я так рада, что ты написал первым 🙂' },
      { k: ['купил', 'телефон', 'аппарат', 'нова'], r: 'Покажешь, когда приедешь? Я хочу посмотреть, какой он красивый!' },
      { k: ['ел', 'поел', 'обед', 'ужин', 'еда', 'суп', 'борщ'], r: 'Ну хоть что-то. Я тебе борщ оставила в холодильнике, синий контейнер.' },
      { k: ['деньг', 'перевод', 'скинь', 'баланс'], r: 'Деньги я тебе отправила, проверь карту. Только не трать всё на ерунду!' },
      { k: ['люблю', 'скучаю'], r: 'И я тебя люблю ❤️ Звони чаще, а не только когда деньги нужны.' },
      { k: ['фото', 'фотк', 'сним', 'камер'], r: 'Пришли хоть одно фото! Я поставлю на заставку.' },
      { k: ['как дела', 'как ты'], r: 'У меня всё хорошо, давление скачет, но это привычно. Ты лучше про себя расскажи.' },
      { k: ['спасибо', 'благод'], r: 'Всегда пожалуйста, мой хороший 🤗' },
      { k: ['пока', 'до свид'], r: 'Целую! Не забудь поесть.' }
    ],
    arc: [
      'Сынок, ты уже дома? Ты купил телефон?',
      'Как он тебе? Красивый? Я видела рекламу — там камера 108 мегапикселей!',
      'Пришли мне фотографию, я хочу посмотреть 😊',
      'Ты пообедал? Не сиди на голодный желудок',
      'Папа сказал, что ты потратил почти все деньги. Ты уверен, что он того стоит?',
      'Позвони мне вечером, я буду ждать',
      'Не забывай заряжать телефон. У тебя вечно 1%',
      'Люблю тебя ❤️'
    ],
    ambient: ['Не забудь шапку, на улице ветер', 'Смотришь в телефон — смотри под ноги!', 'Бабушка передаёт привет', 'Я тебе пирог испекла, заедешь?']
  },
  kirill: {
    typing: (t) => 500 + t.length * 26,
    keywords: [
      { k: ['привет', 'хай', 'здоров', 'йо'], r: 'ооо привет! ну показывай аппарат 😎' },
      { k: ['игр', 'змейк', 'snake', 'го'], r: 'го! я поставил 42 очка. если перебьёшь — с меня пицца 🍕' },
      { k: ['телефон', 'аппарат', 'нова', 'камер'], r: 'ну ты даёшь, 120 герц? у меня на старом даже шторка лагает 😂' },
      { k: ['фото', 'фотк'], r: 'скинь в галерею, потом в чат. у меня интернет лимитный, но на мемы хватит' },
      { k: ['батаре', 'заряд', 'сел'], r: 'классика. у меня зарядка живёт в рюкзаке, как домашнее животное' },
      { k: ['деньг', 'кредит', 'дорого'], r: 'ну ты копил год, зато теперь у тебя лучший телефон во всём чате' },
      { k: ['спам', 'мошенник'], r: 'кидай в блок сразу. мне вчера писали «вы выиграли яхту», я даже ответил, но яхта не пришла' },
      { k: ['аня'], r: 'ахаха, ну-ну 👀 я ничего не говорил, но я всё видел' },
      { k: ['пока', 'бб', 'до'], r: 'давай, на связи 🤙' },
      { k: ['спасибо'], r: 'всегда пожалуйста, бро' }
    ],
    arc: [
      'ты где пропал? купил уже этот свой NOVA?',
      'ну фотку давай! хочу посмотреть на тебя со стороны 😄',
      'у меня кстати интернет кончается, 15 гигабайт улетели за неделю. ты как вообще живёшь с безлимитом?',
      'го вечером в змейку? рекорд 42, попробуй перебить',
      'ты уже шторку открывал? там столько переключателей, я полчаса тыкал',
      'мне тут спам пришёл «вы выиграли яхту». отвечаю: «где моя яхта?» — молчат 😂',
      'слушай, а Аня тебе писала? она спрашивала про твой телефон, я ничего не говорил честно',
      'ладно, пойду есть. мамка пельмени сварила. скинь потом фоток с камеры, интересно же'
    ],
    ambient: ['скинь мем', 'ты онлайн?', 'я тут такое нашёл 😂', 'го в змейку', 'у тебя сколько процентов батареи?']
  },
  anya: {
    typing: (t) => 1100 + t.length * 55,
    keywords: [
      { k: ['привет', 'хай'], r: 'привет 🙂' },
      { k: ['как дела', 'как ты'], r: 'нормально. вот, сижу, разглядываю твой статус «в сети» 😅 а у тебя?' },
      { k: ['телефон', 'нова', 'аппарат'], r: 'покажешь? мне интересно, как он выглядит вживую' },
      { k: ['красив', 'мило', 'класс'], r: '😳 ну хватит' },
      { k: ['гулять', 'погуля', 'встрет', 'кино', 'кофе'], r: 'можно. в субботу я свободна после 15:00, если что' },
      { k: ['фото', 'селфи'], r: 'тогда пришли селфи с новой камеры. проверим, на что она способна 📸' },
      { k: ['люблю'], r: '…ты это серьёзно? 🙂' },
      { k: ['пока', 'споки'], r: 'пока-пока 🌙' }
    ],
    arc: [
      'привет! ты сменил номер? у меня тут новый контакт появился 🙂',
      'Кирилл говорит, ты купил новый телефон. Хвастайся!',
      'я вот никак не решусь сменить свой — он ещё живой, только батарея 40%',
      'ты уже настроил всё? я в этих настройках теряюсь'
    ],
    ambient: ['ты спишь?', 'скинул бы фотку 🙃', 'смотри какой закат сегодня']
  },
  dad: {
    typing: (t) => 1400 + t.length * 30,
    keywords: [
      { k: ['привет'], r: 'Привет.' },
      { k: ['деньг', 'баланс', 'кредит'], r: 'Деньги на карте проверил? Абонплата списывается каждый день в 9:00. Следи.' },
      { k: ['телефон', 'аппарат'], r: 'Хороший выбор. Только не урони.' },
      { k: ['мама'], r: 'Спроси у мамы.' },
      { k: ['заряд', 'батаре'], r: 'Не разряжай в ноль. Литиевые батареи этого не любят.' },
      { k: ['спасибо'], r: 'Пожалуйста.' }
    ],
    arc: [
      'Телефон получил?',
      'Зарядка на столе. Кабель USB-C, 33 ватта.',
      'Проверь баланс в банке. Абонплата капает.',
      'Молодец, что сам накопил.'
    ],
    ambient: ['Выключи свет в коридоре.', 'Завтра подъём в 7.', 'Проверь, закрыл ли дверь.']
  },
  spam: {
    typing: () => 400,
    keywords: [
      { k: ['кто', 'что', 'зачем'], r: '🎉 ВЫ УВЕРЕНЫ? Приз сгорает через 15 минут! Перейдите по ссылке!' },
      { k: ['нет', 'отстань', 'блок'], r: '😡 Вы пожалеете! Ваш номер добавлен в базу «счастливых» клиентов!' },
      { k: ['да', 'ок', 'хочу'], r: 'Отлично! Для получения приза отправьте слово ПРИЗ на номер 4444. Стоимость 9,99 € за SMS.' }
    ],
    arc: [
      '🎉 ВЫ ВЫИГРАЛИ! Чтобы получить приз, перейдите по ссылке: bit.ly/prize-nova',
      '📢 ВАША ПОСЫЛКА ЗАДЕРЖИВАЕТСЯ. Оплатите пошлину 2,50 €: bit.ly/poshlina',
      '💰 ОДОБРЕНО! Кредит 5000 € за 3 минуты без отказа: bit.ly/kredit'
    ],
    ambient: ['⏰ Осталось 2 часа! Успейте!', '📱 Ваш аккаунт будет заблокирован!']
  }
};

const QUICK_BY_CONTACT = {
  mom: ['Да, мам, всё хорошо 😊', 'Я поел, не волнуйся', 'Пришлю фото!', 'Позвоню вечером ❤️'],
  kirill: ['го в змейку 🐍', 'щас скину фотку', 'ахах 😂', 'у меня 87% батареи, ха'],
  anya: ['привет 🙂', 'щас покажу!', 'а давай в субботу?', '😳'],
  dad: ['Принял.', 'Проверил, спасибо.', 'Хорошо.']
};

/* =========================================================
   СОСТОЯНИЕ ЧАТОВ
   ========================================================= */
function chat(id) {
  const S = getState();
  if (!S.messages.chats[id]) S.messages.chats[id] = { id, messages: [], unread: 0, pinned: false, muted: false, draft: '', step: 0, typing: false, lastActivity: 0 };
  return S.messages.chats[id];
}

export function pushMessage(contactId, dir, text, opts = {}) {
  const S = getState();
  const c = chat(contactId);
  const m = {
    id: uid('m'), dir, text, at: opts.at ?? S.time.gameMs,
    type: opts.type || 'text', media: opts.media || null, status: dir === 'out' ? 'sent' : 'read',
    replyTo: opts.replyTo || null
  };
  c.messages.push(m);
  c.lastActivity = m.at;
  if (dir === 'in') {
    c.unread++;
    S.stats.msgsRecv++;
    const contact = S.contacts.find((x) => x.id === contactId);
    if (contact && !opts.silent) {
      notify({
        appId: 'messages', icon: '💬', color: contact.color,
        title: displayName(contact), text: m.type === 'img' ? '📷 Фотография' : text,
        action: { type: 'app', id: 'messages', params: { chat: contactId } },
        actions: contactId === 'spam' ? [{ label: '🚫 Заблокировать', act: () => blockContact(contactId) }] : []
      });
      vibrate(18);
    }
  } else {
    S.stats.msgsSent++;
    // доставлено → прочитано
    setTimeout(() => { m.status = 'delivered'; refreshIfOpen(contactId); save(); }, 700);
    setTimeout(() => { m.status = 'read'; refreshIfOpen(contactId); save(); }, rndInt(1800, 4200));
  }
  save();
  emit(EV.MESSAGE, { contactId, m });
  return m;
}

export function botSay(contactId, text, opts = {}) {
  const c = chat(contactId);
  c.typing = true;
  refreshIfOpen(contactId);
  const delay = opts.delay ?? (PERSONAS[contactId]?.typing?.(text) ?? 1200);
  setTimeout(() => {
    c.typing = false;
    pushMessage(contactId, 'in', text, opts);
    refreshIfOpen(contactId);
  }, delay);
}

function botReply(contactId, userText) {
  const S = getState();
  const p = PERSONAS[contactId];
  const c = chat(contactId);
  if (!p) return;
  const lower = userText.toLowerCase();

  let reply = null;
  for (const kw of p.keywords) {
    if (kw.k.some((k) => lower.includes(k))) { reply = pick(kw.r ? (Array.isArray(kw.r) ? kw.r : [kw.r]) : []); break; }
  }
  if (!reply) {
    reply = p.arc[c.step % p.arc.length];
    c.step++;
  }
  botSay(contactId, reply);
}

/* ---------------- сюжетные сообщения после настройки ---------------- */
export function startStory() {
  const S = getState();
  if (S.flags.storyStarted) return;
  S.flags.storyStarted = true;
  save();

  setTimeout(() => botSay('mom', PERSONAS.mom.arc[0], { delay: 800 }), 2200);
  setTimeout(() => botSay('kirill', PERSONAS.kirill.arc[0], { delay: 800 }), 9000);
  setTimeout(() => {
    const op = S.phone.sim.operator;
    if (op) {
      window.__sysMsg?.('operator', `Ваша SIM-карта активирована. Номер ${S.phone.sim.number}. Тариф «${op === 'mobiline' ? 'Безлимит+' : 'Старт 15'}». Проверка баланса: *100#`);
    }
  }, 15000);
  setTimeout(() => botSay('dad', PERSONAS.dad.arc[0], { delay: 800 }), 21000);
  setTimeout(() => botSay('anya', PERSONAS.anya.arc[0], { delay: 800 }), 30000);
}

/* ---------------- фоновые сообщения ---------------- */
let ambientAcc = 0;
export function ambientTick(dtReal) {
  const S = getState();
  if (S.stage !== 'ready' || !S.phone.setupDone) return;
  ambientAcc += dtReal;
  if (ambientAcc < 45) return; // реальная секунда = игровая минута → ~45 игровых минут
  ambientAcc = 0;
  if (Math.random() > 0.32) return;
  const pool = ['kirill', 'mom', 'anya', 'dad'];
  const id = pick(pool);
  const p = PERSONAS[id];
  if (!p) return;
  botSay(id, pick(p.ambient), { delay: rndInt(600, 2000) });
}

/* ---------------- блокировка спама ---------------- */
function blockContact(id) {
  const S = getState();
  const c = S.contacts.find((x) => x.id === id);
  if (!c) return;
  c.blocked = true;
  const ch = chat(id);
  ch.muted = true;
  pushMessage(id, 'in', '⛔ Вы заблокировали этот номер. Сообщения больше не будут приходить.', { silent: true, type: 'system' });
  save();
  unlock('spam');
  toast('🚫', 'Номер заблокирован', 'Спам больше не придёт. Так держать!');
}

/* =========================================================
   UI: СПИСОК ЧАТОВ
   ========================================================= */
let curChat = null, filter = 'all', inst = null;

export function mount(root, api, params) {
  inst = { root, api };
  root.className = 'app theme-dark msg-app';
  root.style.setProperty('--app-bg', getState().phone.theme === 'light' ? '#f4f6fb' : '#0b0f1a');
  root.classList.toggle('theme-light', getState().phone.theme === 'light');

  if (params?.chat) openChat(params.chat);
  else renderList();

  clearAppNotifs('messages');
  return {
    light: getState().phone.theme === 'light',
    onFocus(p) {
      if (p?.chat && p.chat !== curChat) openChat(p.chat);
      else if (!curChat) renderList();
      clearAppNotifs('messages');
    },
    onBack() {
      if (emojiOpen || attachOpen) { closePanels(); return true; }
      if (curChat) { closeChat(); return true; }
      if (filter !== 'all') { filter = 'all'; renderList(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function refreshIfOpen(contactId) {
  if (!inst) return;
  if (curChat === contactId) renderChat();
  // сообщение из другого чата не должно выбрасывать пользователя из открытого диалога
  else if (!curChat) renderList();
}

on(EV.MESSAGE, ({ contactId }) => refreshIfOpen(contactId));

let emojiOpen = false, attachOpen = false;

function renderList() {
  const S = getState();
  curChat = null;
  const root = inst.root;
  clear(root);

  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Сообщения' }), el('span', { class: 'sub', text: `${totalUnread() ? totalUnread() + ' непрочитанных' : 'все прочитано'}` })));
  const acts = el('div', { class: 'appbar__actions' });
  const searchBtn = el('button', { class: 'iconbtn', onclick: () => toggleSearch() });
  searchBtn.innerHTML = ICON.search();
  const newBtn = el('button', { class: 'iconbtn', onclick: () => newMessage() });
  newBtn.innerHTML = ICON.edit();
  acts.append(searchBtn, newBtn);
  bar.append(acts);
  root.append(bar);

  // поиск
  const searchRow = el('div', { class: 'set-search', style: { display: 'none' } });
  searchRow.innerHTML = ICON.search();
  const searchInput = el('input', { placeholder: 'Поиск по чатам и тексту', oninput: () => { renderRows(searchInput.value.trim().toLowerCase()); } });
  searchRow.append(searchInput);
  root.append(searchRow);
  function toggleSearch() {
    const vis = searchRow.style.display !== 'none';
    searchRow.style.display = vis ? 'none' : 'flex';
    if (!vis) searchInput.focus();
    else { searchInput.value = ''; renderRows(''); }
  }

  // вкладки
  const tabs = el('div', { class: 'tabs' });
  [['all', 'Все'], ['unread', 'Непрочитанные'], ['sms', 'SMS и сервисы']].forEach(([id, label]) => {
    tabs.append(el('button', { class: filter === id ? 'on' : '', text: label, onclick: () => { filter = id; SFX.tap(); renderList(); } }));
  });
  root.append(tabs);

  const body = el('div', { class: 'appbody chatlist' });
  root.append(body);
  renderRows('');

  function renderRows(q) {
    clear(body);
    let list = S.contacts.filter((c) => chatHasContent(c.id) || !c.service);
    if (filter === 'unread') list = list.filter((c) => chat(c.id).unread > 0);
    if (filter === 'sms') list = list.filter((c) => c.service);
    if (q) {
      list = list.filter((c) => displayName(c).toLowerCase().includes(q) ||
        chat(c.id).messages.some((m) => (m.text || '').toLowerCase().includes(q)));
    }
    list.sort((a, b) => {
      const ca = chat(a.id), cb = chat(b.id);
      if (ca.pinned !== cb.pinned) return ca.pinned ? -1 : 1;
      return (cb.lastActivity || 0) - (ca.lastActivity || 0);
    });

    if (!list.length) {
      body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '💬' }),
        filter === 'unread' ? 'Непрочитанных нет. Подозрительно тихо.' : 'Пока пусто. Напишите кому-нибудь первым!'));
    }
    list.forEach((c) => body.append(chatRow(c)));
  }

  // FAB
  const fab = el('button', { class: 'fab', title: 'Новое сообщение', onclick: () => newMessage() });
  fab.innerHTML = ICON.edit();
  root.append(fab);
}

function chatHasContent(id) { return chat(id).messages.length > 0; }
function totalUnread() {
  const S = getState();
  return Object.values(S.messages.chats).reduce((a, c) => a + (c.unread || 0), 0);
}

function chatRow(c) {
  const S = getState();
  const ch = chat(c.id);
  const last = ch.messages[ch.messages.length - 1];
  const name = displayName(c);
  const row = el('div', { class: 'list__row' + (ch.unread ? ' unread' : '') + (ch.muted ? ' muted' : '') });
  row.append(avatar(c));
  const g = el('div', { class: 'grow' });
  const t1 = el('div', { class: 't1', text: name });
  if (c.blocked) t1.append(el('span', { text: ' ⛔', style: { fontSize: '11px' } }));
  g.append(t1);
  const bottom = el('div', { class: 'cl-bottom' });
  const prev = last
    ? (last.type === 'img' ? '📷 Фотография' : last.type === 'system' ? last.text : (last.dir === 'out' ? 'Вы: ' : '') + last.text)
    : (c.service ? 'Сервисные сообщения' : 'Нет сообщений');
  bottom.append(el('span', { class: 'cl-prev', text: prev }));
  if (ch.unread) bottom.append(el('div', { class: 'badge', text: String(ch.unread) }));
  if (ch.muted) bottom.append(el('span', { style: { fontSize: '12px', opacity: '.5' }, text: '🔕' }));
  if (ch.pinned) bottom.append(el('span', { class: 'pin-ico', text: '📌' }));
  g.append(bottom);
  row.append(g);
  row.append(el('div', { class: 'cl-time', text: last ? chatStamp(last.at) : '' }));
  row.addEventListener('click', () => { SFX.tap(); openChat(c.id); });
  onLongPress(row, async () => {
    const act = await sysDialog({
      title: name, icon: ch.pinned ? '📌' : '📎',
      text: `${ch.messages.length} ${plural(ch.messages.length, ['сообщение', 'сообщения', 'сообщений'])} · ${ch.unread} непрочитанных`,
      buttons: [
        { label: ch.pinned ? 'Открепить' : '📌 Закрепить', value: 'pin' },
        { label: ch.muted ? 'Включить звук' : '🔕 Без звука', value: 'mute' },
        { label: '🗑️ Очистить', value: 'clear', cls: 'danger' },
        { label: 'Отмена', value: null }
      ]
    });
    if (act === 'pin') { ch.pinned = !ch.pinned; save(); renderList(); }
    if (act === 'mute') { ch.muted = !ch.muted; save(); renderList(); }
    if (act === 'clear') {
      if (await sysConfirm('Очистить чат?', `Все сообщения с «${name}» будут удалены.`, 'Очистить', true)) {
        ch.messages = []; ch.unread = 0; ch.lastActivity = 0; save(); renderList();
        toast('🗑️', 'Чат очищен', '');
      }
    }
  }, null, 520);
  return row;
}

async function newMessage() {
  const S = getState();
  const list = S.contacts.filter((c) => !c.service || c.id === 'spam');
  const res = await sysDialog({
    title: 'Кому написать?', icon: '✍️',
    text: list.map((c, i) => `${i + 1}. ${displayName(c)}`).join('<br/>'),
    input: { placeholder: 'Имя или номер' },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Написать', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const c = list.find((x) => displayName(x).toLowerCase().includes(q)) || list[0];
  openChat(c.id);
}

/* =========================================================
   UI: ЧАТ
   ========================================================= */
function openChat(id) {
  const S = getState();
  const ch = chat(id);
  ch.unread = 0;
  save();
  curChat = id;
  clearAppNotifs('messages');
  renderChat();
  completeTask('t9');
}

function closeChat() {
  curChat = null;
  closePanels();
  renderList();
}

function renderChat() {
  if (!inst) return;
  const S = getState();
  const id = curChat;
  const c = S.contacts.find((x) => x.id === id);
  const ch = chat(id);
  const root = inst.root;
  const scrollPos = root.querySelector('.chat__body')?.scrollTop;
  const wasBottom = (() => {
    const b = root.querySelector('.chat__body');
    return !b || b.scrollHeight - b.scrollTop - b.clientHeight < 90;
  })();
  clear(root);

  const wrap = el('div', { class: 'chat' });

  /* шапка */
  const head = el('div', { class: 'chat__head' });
  const back = el('button', { class: 'iconbtn', onclick: () => { SFX.back(); closeChat(); } });
  back.innerHTML = ICON.back();
  head.append(back);
  head.append(avatar(c, 'sm'));
  const info = el('div', { class: 'grow', style: { cursor: 'pointer' }, onclick: () => contactInfo(c) });
  info.append(el('div', { class: 'h-name', text: displayName(c) }));
  info.append(el('div', { class: 'h-state' + (ch.typing ? ' online' : ''), text: ch.typing ? 'печатает…' : (c.online || (c.service ? 'сервисный номер' : 'не в сети')) }));
  head.append(info);
  const acts = el('div', { class: 'appbar__actions' });
  const callBtn = el('button', { class: 'iconbtn', title: 'Позвонить', onclick: () => { if (!c.phone) return; api.openApp('phone', { dial: c.phone }); } });
  callBtn.innerHTML = ICON.phone();
  const moreBtn = el('button', { class: 'iconbtn', onclick: () => contactInfo(c) });
  moreBtn.innerHTML = ICON.more();
  acts.append(callBtn, moreBtn);
  head.append(acts);
  wrap.append(head);

  if (c.blocked) {
    wrap.append(el('div', { class: 'no-signal-banner', text: '⛔ Номер заблокирован — сообщения не приходят' }));
  }

  /* сообщения */
  const body = el('div', { class: 'chat__body' });
  let lastDay = '';
  ch.messages.forEach((m) => {
    const d = new Date(m.at).toDateString();
    if (d !== lastDay) {
      lastDay = d;
      const dd = new Date(m.at);
      const today = new Date(S.time.gameMs).toDateString();
      const yest = new Date(S.time.gameMs - 86400000).toDateString();
      const label = d === today ? 'Сегодня' : d === yest ? 'Вчера' : dd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
      body.append(el('div', { class: 'day-sep', text: label }));
    }
    body.append(msgEl(m, c));
  });
  if (ch.typing) {
    body.append(el('div', { class: 'typing' }, el('i'), el('i'), el('i')));
  }
  if (!ch.messages.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: c.service ? '📩' : '👋' }),
      c.service ? 'Сервисный номер. Здесь появляются уведомления оператора и банка.' : `Начните переписку с «${displayName(c)}». Напишите «привет» — и увидите, что будет.`));
  }
  wrap.append(body);

  /* быстрые ответы */
  const quick = QUICK_BY_CONTACT[id];
  if (quick && ch.messages.length && ch.messages[ch.messages.length - 1]?.dir === 'in') {
    const q = el('div', { class: 'quick-replies' });
    quick.forEach((t) => q.append(el('button', { text: t, onclick: () => { send(t); } })));
    wrap.append(q);
  }

  /* поле ввода */
  const inputRow = el('div', { class: 'chat__input' });
  const field = el('div', { class: 'chat__field' });
  const emojiBtn = el('button', { class: 'iconbtn', style: { width: '30px', height: '30px' }, onclick: () => toggleEmoji() });
  emojiBtn.innerHTML = ICON.emoji();
  const ta = el('textarea', { rows: '1', placeholder: c.service && id !== 'spam' ? 'На сервисный номер писать нельзя… но попробовать можно' : 'Сообщение…', value: ch.draft || '' });
  ta.style.color = 'inherit';
  const attachBtn = el('button', { class: 'iconbtn', style: { width: '30px', height: '30px' }, onclick: () => toggleAttach() });
  attachBtn.innerHTML = ICON.attach();
  field.append(emojiBtn, ta, attachBtn);
  const sendBtn = el('button', { class: 'chat__send', onclick: () => send(ta.value) });
  sendBtn.innerHTML = ICON.send();
  inputRow.append(field, sendBtn);
  wrap.append(inputRow);

  root.append(wrap);

  // автовысота
  const autoGrow = () => {
    ta.style.height = 'auto';
    ta.style.height = Math.min(88, ta.scrollHeight) + 'px';
    sendBtn.innerHTML = ta.value.trim() ? ICON.send() : ICON.mic();
    sendBtn.onclick = () => ta.value.trim() ? send(ta.value) : voiceHint();
  };
  ta.addEventListener('input', () => { ch.draft = ta.value; autoGrow(); });
  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); }
  });
  autoGrow();

  // прокрутка
  requestAnimationFrame(() => {
    if (scrollPos !== undefined && !wasBottom) body.scrollTop = scrollPos;
    else body.scrollTop = body.scrollHeight;
  });

  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    ch.draft = '';
    pushMessage(id, 'out', text);
    SFX.msgOut();
    ta.value = ''; autoGrow();
    renderChat();
    // задача «Ответить маме» засчитывается только за переписку с мамой
    if (id === 'mom') completeTask('t10');
    if (id === 'mom') unlock('mom');
    unlock('msg');
    if (S.stats.msgsSent >= 10) unlock('chat10');
    // ответ бота
    if (!c.blocked && PERSONAS[id]) setTimeout(() => botReply(id, text), rndInt(300, 900));
    else if (c.service && id !== 'spam') {
      setTimeout(() => pushMessage(id, 'in', 'Это автоматический номер. Ответ невозможен. Используйте приложение или USSD-команды.', { silent: true, type: 'system' }), 900);
    }
  }
  function voiceHint() {
    toast('🎙️', 'Голосовые сообщения', 'Записать голосовое можно в приложении «Диктофон», а потом прикрепить через 📎');
  }
}

function msgEl(m, c) {
  const S = getState();
  if (m.type === 'system') {
    return el('div', { class: 'day-sep', style: { maxWidth: '88%', textAlign: 'center', lineHeight: '1.4' }, text: m.text });
  }
  const node = el('div', { class: 'msg ' + (m.dir === 'out' ? 'out' : 'in') + (m.type === 'img' ? ' img-msg' : '') });
  if (m.replyTo) {
    node.append(el('div', {
      style: { fontSize: '11px', opacity: '.65', borderLeft: '2px solid currentColor', paddingLeft: '7px', marginBottom: '5px' },
      text: '↩ ' + m.replyTo.slice(0, 44)
    }));
  }
  if (m.type === 'img' && m.media?.svg) {
    const ph = el('div', { class: 'ph' });
    ph.innerHTML = m.media.svg;
    node.append(ph);
    if (m.text) node.append(el('div', { text: m.text, style: { padding: '4px 4px 0' } }));
  } else {
    node.append(el('span', { html: linkify(m.text) }));
  }
  const meta = el('div', { class: 'm-meta' });
  meta.append(el('span', { text: fmtTime(new Date(m.at)) }));
  if (m.dir === 'out') {
    const ticks = m.status === 'read' ? '✓✓' : m.status === 'delivered' ? '✓✓' : '✓';
    meta.append(el('span', { class: 'm-ticks', text: ticks, style: m.status === 'read' ? { color: '#7dd3fc' } : {} }));
  } else if (m.type === 'sms') {
    meta.append(el('span', { text: 'SMS' }));
  }
  node.append(meta);

  // контекстное меню
  onLongPress(node, async () => {
    vibrate(14);
    const act = await sysDialog({
      title: m.type === 'img' ? 'Фотография' : (m.text || '').slice(0, 40),
      text: fmtTime(new Date(m.at)) + ' · ' + (m.dir === 'out' ? 'отправлено' : displayName(c)),
      buttons: [
        { label: '↩️ Ответить', value: 'reply' },
        { label: '📋 Копировать', value: 'copy' },
        { label: '🗑️ Удалить', value: 'del', cls: 'danger' },
        { label: 'Отмена', value: null }
      ]
    });
    const ch = chat(curChat);
    if (act === 'copy') {
      navigator.clipboard?.writeText(m.text || '').catch(() => {});
      toast('📋', 'Скопировано', (m.text || '').slice(0, 40));
    } else if (act === 'del') {
      ch.messages = ch.messages.filter((x) => x.id !== m.id);
      ch.messages.push({ id: uid('m'), dir: 'in', text: '🗑️ Сообщение удалено', at: S.time.gameMs, type: 'system', status: 'read' });
      save(); renderChat();
    } else if (act === 'reply') {
      const ta = inst.root.querySelector('textarea');
      if (ta) { ta.focus(); ta.placeholder = '↩ ' + (m.text || 'фото').slice(0, 30); ta.dataset.reply = m.text || 'фотография'; }
    }
  }, null, 480);
  return node;
}

function linkify(text) {
  return esc(text)
    .replace(/(https?:\/\/[^\s]+)/g, '<a href="#" data-url="$1">$1</a>')
    .replace(/(bit\.ly\/[^\s]+)/g, '<a href="#" data-url="http://$1">$1</a>')
    .replace(/\n/g, '<br/>');
}

function closePanels() {
  emojiOpen = attachOpen = false;
  inst?.root.querySelectorAll('.emoji-panel, .attach-menu').forEach((n) => n.remove());
}

function toggleEmoji() {
  if (emojiOpen) { closePanels(); return; }
  closePanels();
  emojiOpen = true;
  const emojis = '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😴 🤤 😪 😷 🤒 🤕 🤢 🤮 🥴 😵 🤩 👍 👎 👌 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 🤝 🙏 💪 ❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 🔥 ✨ ⭐ 🌟 💫 ⚡ 🎉 🎊 🎈 🎁 🍕 🍔 🍟 ☕ 🍺 🐍 📱 🔋 📶 📷 🎧 ⚽ 🏆'.split(' ');
  const panel = el('div', { class: 'emoji-panel' });
  emojis.forEach((e) => panel.append(el('button', { text: e, onclick: () => {
    const ta = inst.root.querySelector('textarea');
    ta.value += e;
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  } })));
  inst.root.append(panel);
  SFX.tap();
}

function toggleAttach() {
  if (attachOpen) { closePanels(); return; }
  closePanels();
  attachOpen = true;
  const S = getState();
  const menu = el('div', { class: 'attach-menu' });
  const item = (icon, label, fn) => menu.append(el('button', { onclick: () => { closePanels(); fn(); } }, el('span', { text: icon }), el('span', { text: label })));
  item('📷', 'Камера', () => api.openApp('camera', { shareTo: curChat }));
  item('🖼️', `Галерея (${S.photos.length})`, () => api.openApp('gallery', { shareTo: curChat }));
  item('📍', 'Геолокация', () => { pushMessage(curChat, 'out', '📍 Моё местоположение: Брюссель, ул. Симулаторная, 15'); SFX.msgOut(); renderChat(); });
  item('👤', 'Контакт', () => { pushMessage(curChat, 'out', '👤 Кирилл Бондарь · +32 477 90 31 55'); SFX.msgOut(); renderChat(); });
  inst.root.append(menu);
  SFX.tap();
}

async function contactInfo(c) {
  const S = getState();
  const ch = chat(c.id);
  const act = await sysDialog({
    title: displayName(c),
    icon: c.blocked ? '⛔' : '👤',
    text: [
      c.phone ? `<b>Номер:</b> ${c.phone}` : null,
      c.role ? `<b>Статус:</b> ${c.role}` : null,
      `<b>Сообщений:</b> ${ch.messages.length}`,
      `<b>В сети:</b> ${c.online || '—'}`
    ].filter(Boolean).join('<br/>'),
    buttons: [
      { label: '📞 Позвонить', value: 'call' },
      { label: ch.muted ? '🔔 Включить звук' : '🔕 Без звука', value: 'mute' },
      { label: c.blocked ? '✅ Разблокировать' : '🚫 Заблокировать', value: 'block', cls: 'danger' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (act === 'call' && c.phone) api.openApp('phone', { dial: c.phone });
  if (act === 'mute') { ch.muted = !ch.muted; save(); renderChat(); }
  if (act === 'block') {
    if (c.blocked) { c.blocked = false; toast('✅', 'Номер разблокирован', displayName(c)); }
    else blockContact(c.id);
    save(); renderChat();
  }
}

/* ======================= ЭКСПОРТЫ ДЛЯ ДРУГИХ МОДУЛЕЙ ======================= */
export function sharePhotoTo(contactId, photo) {
  pushMessage(contactId, 'out', photo.caption || '', { type: 'img', media: { svg: photo.svg, id: photo.id } });
  SFX.msgOut();
  toast('📤', 'Фото отправлено', `${displayName(getState().contacts.find((c) => c.id === contactId))}`);
}
