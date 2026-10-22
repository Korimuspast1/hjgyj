import { getState, save } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, fmtMoney, hash, rndInt } from '../util.js';
import { toast, sysDialog, sysConfirm, chev } from '../ui.js';
import { STORE_CATALOG, APPS } from '../registry.js';
import { registerInstalledApp } from '../home.js';

let inst = null, cat = 'all', detail = null, query = '';

const CATS = ['all', 'Игры', 'Инструменты', 'Музыка', 'Общение', 'Фото', 'Здоровье', 'Финансы', 'Развлечения', 'Путешествия', 'Транспорт', 'Еда'];

export function mount(root, a, params) {
  inst = { root, api: a };
  detail = params?.detail || null;
  root.className = 'app store theme-dark';
  root.classList.toggle('theme-light', getState().phone.theme === 'light');
  render();
  return {
    light: getState().phone.theme === 'light',
    onFocus(p) { if (p?.detail) { detail = p.detail; render(); } },
    onBack() {
      if (detail) { detail = null; render(); return true; }
      if (query) { query = ''; render(); return true; }
      if (cat !== 'all') { cat = 'all'; render(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function isInstalled(id) {
  return !!APPS[id] && !APPS[id].storeOnly ? true : getState().store.installed.includes(id);
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);
  if (detail) { renderDetail(detail); return; }

  const bar = el('div', { class: 'appbar' },
    el('h1', {}, el('span', { text: 'Nova Store' }), el('span', { class: 'sub', text: `${S.store.installed.length} установлено · ${STORE_CATALOG.length} в каталоге` })));
  const acts = el('div', { class: 'appbar__actions' });
  const acc = el('button', { class: 'iconbtn', onclick: () => account() });
  acc.innerHTML = ICON.user();
  acts.append(acc);
  bar.append(acts);
  inst.root.append(bar);

  // поиск
  const sb = el('div', { class: 'set-search' });
  sb.innerHTML = ICON.search();
  const input = el('input', { placeholder: 'Поиск приложений и игр', value: query });
  input.addEventListener('input', () => { query = input.value.trim().toLowerCase(); renderList(); });
  sb.append(input);
  inst.root.append(sb);

  // избранное
  if (!query && cat === 'all') {
    const feat = el('div', { class: 'store__feat', onclick: () => { detail = 'snake'; render(); } });
    feat.append(el('div', {},
      el('b', { text: '🐍 Змейка Nova' }),
      el('span', { text: 'Игра недели · бесплатно · уже на вашем телефоне' })));
    inst.root.append(feat);
  }

  // категории
  const cats = el('div', { style: { display: 'flex', gap: '7px', padding: '4px 14px 12px', overflowX: 'auto' } });
  CATS.forEach((c) => {
    cats.append(el('button', { class: 'chip' + (cat === c ? ' on' : ''), text: c === 'all' ? 'Все' : c, style: { flex: '0 0 auto' }, onclick: () => { cat = c; SFX.tap(); render(); } }));
  });
  inst.root.append(cats);

  const body = el('div', { class: 'appbody', id: 'store-body' });
  inst.root.append(body);
  renderList();
}

function renderList() {
  const S = getState();
  const body = inst.root.querySelector('#store-body');
  if (!body) return;
  clear(body);
  let list = STORE_CATALOG.slice();
  if (cat !== 'all') list = list.filter((a) => a.cat === cat);
  if (query) list = list.filter((a) => (a.name + ' ' + a.cat + ' ' + a.desc).toLowerCase().includes(query));
  list.sort((a, b) => (isInstalled(b.id) ? 1 : 0) - (isInstalled(a.id) ? 1 : 0));

  if (!list.length) { body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🛍️' }), 'Ничего не найдено')); return; }

  body.append(el('div', { class: 'sect-title', text: cat === 'all' ? 'Рекомендуем для вас' : cat }));
  list.forEach((a) => body.append(appCard(a)));

  body.append(el('div', { style: { padding: '18px 16px 24px', fontSize: '11.5px', opacity: '.45', lineHeight: '1.6' },
    text: 'Nova Store — магазин приложений в симуляторе. Бесплатные приложения появляются на втором экране домашнего стола сразу после установки. Платные списывают деньги с карты NovaBank.' }));
}

function appCard(a) {
  const S = getState();
  const installed = isInstalled(a.id);
  const card = el('div', { class: 'app-card' });
  card.append(el('div', { class: 'ac-ico', style: { background: `linear-gradient(135deg,${a.color},#111)` }, text: a.emoji }));
  const g = el('div', { class: 'grow', style: { flex: '1', minWidth: '0' }, onclick: () => { detail = a.id; SFX.tap(); render(); } });
  g.append(el('div', { class: 'ac-t', text: a.name }));
  g.append(el('div', { class: 'ac-c', text: a.cat }));
  g.append(el('div', { class: 'ac-r', html: `★ ${a.rating} · ${a.size} МБ ${a.price ? '· ' + fmtMoney(a.price) : '· бесплатно'}` }));
  card.append(g);
  const btn = el('button', {
    class: 'ac-btn ' + (installed ? 'installed' : a.price ? 'buy' : ''),
    text: installed ? 'Открыть' : a.price ? fmtMoney(a.price) : 'Установить',
    onclick: () => installed ? api.openApp(a.id) : install(a)
  });
  card.append(btn);
  return card;
}

async function install(a) {
  const S = getState();
  if (a.price > 0) {
    if (S.bank.balance < a.price) {
      SFX.error();
      toast('💸', 'Недостаточно средств', `Нужно ${fmtMoney(a.price)}, на карте ${fmtMoney(S.bank.balance)}. Пополните в NovaBank или внесите наличные из кошелька.`);
      return;
    }
    const ok = await sysConfirm('Купить приложение?', `${a.name} · ${fmtMoney(a.price)}<br/>Списание с карты •••• 7723`, 'Купить');
    if (!ok) return;
    S.bank.balance -= a.price;
    S.bank.transactions.unshift({ id: 'tx' + Date.now(), title: `Nova Store — ${a.name}`, cat: 'Покупки', amount: -a.price, at: S.time.gameMs, icon: '🛍️' });
    S.stats.spent = (S.stats.spent || 0) + a.price;
    if (S.stats.spent >= 100) unlock('rich');
    emit(EV.MONEY);
  }

  // анимация загрузки
  const overlay = el('div', { class: 'sysdialog-backdrop' });
  const box = el('div', { class: 'sysdialog' });
  const bar = el('div', { class: 'boot__bar', style: { width: '100%', marginTop: '14px' } }, el('i', { style: { width: '0%' } }));
  const lbl = el('div', { class: 'sysdialog__text', text: 'Загрузка…' });
  box.append(el('div', { class: 'sysdialog__body' }, el('div', { class: 'sysdialog__ico', text: a.emoji }), el('div', { class: 'sysdialog__title', text: a.name }), lbl, bar));
  overlay.append(box);
  document.getElementById('syslayer').append(overlay);
  const steps = ['Загрузка…', 'Установка…', 'Оптимизация…'];
  for (let i = 0; i < steps.length; i++) {
    lbl.textContent = steps[i];
    bar.firstChild.style.width = `${(i + 1) / steps.length * 100}%`;
    await new Promise((r) => setTimeout(r, 700));
  }
  overlay.remove();

  registerInstalledApp(a);
  if (!S.store.installed.includes(a.id)) S.store.installed.push(a.id);
  S.phone.storage.apps += a.size / 1024;
  save();
  SFX.notif();
  unlock('install');
  api.refreshHome();
  toast('📲', `${a.name} установлено`, 'Иконка появилась на втором экране домашнего стола');
  notify({ appId: 'store', icon: a.emoji, color: a.color, title: 'Установка завершена', text: `${a.name} · ${a.size} МБ`, action: { type: 'app', id: 'store' } });
  render();
}

function renderDetail(id) {
  const S = getState();
  const a = STORE_CATALOG.find((x) => x.id === id) || (APPS[id] ? { id, name: APPS[id].name, cat: 'Системные', emoji: STORE_CATALOG.find(x => x.id === id)?.emoji || '📱', color: '#38bdf8', rating: 4.5, size: 20, desc: 'Системное приложение NovaOS.', price: 0 } : null);
  if (!a) { detail = null; render(); return; }
  const installed = isInstalled(a.id);

  const bar = el('div', { class: 'appbar' });
  const back = el('button', { class: 'iconbtn', onclick: () => { detail = null; SFX.back(); render(); } });
  back.innerHTML = ICON.back();
  bar.append(back);
  bar.append(el('h1', {}, el('span', { text: a.name })));
  inst.root.append(bar);

  const body = el('div', { class: 'appbody' });
  body.append(el('div', { style: { textAlign: 'center', padding: '14px 20px 8px' } },
    el('div', { style: { width: '96px', height: '96px', margin: '0 auto', borderRadius: '26px', background: `linear-gradient(135deg,${a.color},#111)`, display: 'grid', placeItems: 'center', fontSize: '46px', boxShadow: '0 22px 40px -18px #000, inset 0 1px 0 rgba(255,255,255,.3)' }, text: a.emoji }),
    el('div', { style: { fontSize: '19px', fontWeight: '700', marginTop: '14px' }, text: a.name }),
    el('div', { style: { fontSize: '12px', opacity: '.6', marginTop: '3px' }, text: `${a.cat} · ${a.size} МБ` }),
    el('div', { style: { fontSize: '12px', opacity: '.75', marginTop: '6px' }, html: `★ ${a.rating} · ${rndInt(200, 90000).toLocaleString('ru-RU')} оценок` })
  ));

  body.append(el('div', { style: { padding: '10px 16px 16px' } },
    el('button', {
      class: 'btn ' + (installed ? 'btn--ghost' : 'btn--primary'), style: { width: '100%', padding: '13px' },
      text: installed ? 'Открыть' : a.price ? `Купить за ${fmtMoney(a.price)}` : 'Установить',
      onclick: () => installed ? api.openApp(a.id) : install(a)
    })
  ));

  const stats = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', padding: '0 16px 14px', textAlign: 'center' } });
  [['★', a.rating, 'Рейтинг'], ['📦', a.size + ' МБ', 'Размер'], ['🔞', '3+', 'Возраст'], ['🔄', '1.' + (hash(a.id) % 9) + '.' + (hash(a.id) % 30), 'Версия']].forEach(([i, v, l]) => {
    stats.append(el('div', { style: { background: 'rgba(255,255,255,.06)', borderRadius: '13px', padding: '10px 4px' } },
      el('div', { style: { fontSize: '15px' }, text: i }),
      el('div', { style: { fontSize: '13px', fontWeight: '700', marginTop: '3px' }, text: String(v) }),
      el('div', { style: { fontSize: '10px', opacity: '.55', marginTop: '2px' }, text: l })));
  });
  body.append(stats);

  body.append(el('div', { style: { padding: '0 18px 12px', fontSize: '13px', lineHeight: '1.65', opacity: '.85' }, text: a.desc }));

  body.append(el('div', { class: 'sect-title', text: 'Скриншоты' }));
  const shots = el('div', { style: { display: 'flex', gap: '9px', overflowX: 'auto', padding: '0 16px 14px' } });
  for (let i = 0; i < 3; i++) {
    shots.append(el('div', { style: { flex: '0 0 108px', height: '190px', borderRadius: '14px', background: `linear-gradient(${140 + i * 30}deg,${a.color},#0b0f1a)`, display: 'grid', placeItems: 'center', fontSize: '38px', opacity: '.9' }, text: a.emoji }));
  }
  body.append(shots);

  body.append(el('div', { class: 'sect-title', text: 'Отзывы' }));
  const reviews = [
    ['Алексей К.', 5, 'Работает. Больше ничего не прошу от приложения.'],
    ['Мария Д.', 4, 'Хорошо, но хотелось бы виджет на домашний экран.'],
    ['user_9931', 2, 'Удалил через день. Батарея улетала на глазах.'],
    ['Настя', 5, 'Идеально! Сижу в нём вместо того, чтобы делать дела.'],
    ['Виктор', 3, 'Нормально, но в 2019 было лучше.']
  ];
  reviews.slice(0, 4).forEach(([name, r, text]) => {
    body.append(el('div', { style: { padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,.06)' } },
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        el('div', { class: 'avatar sm', style: { background: `hsl(${hash(name) % 360} 65% 60%)`, width: '28px', height: '28px', fontSize: '12px' }, text: name[0] }),
        el('b', { style: { fontSize: '13px' }, text: name }),
        el('span', { style: { fontSize: '11px', color: '#facc15' }, text: '★'.repeat(r) + '☆'.repeat(5 - r) })),
      el('div', { style: { fontSize: '12.4px', opacity: '.72', marginTop: '6px', lineHeight: '1.5' }, text })
    ));
  });

  body.append(el('div', { class: 'list', style: { marginTop: '10px' } },
    el('div', { class: 'list__row', onclick: () => toast('🔐', 'Разрешения', a.name + ' запрашивает: доступ к памяти, уведомления, вибрацию. Всё честно.') },
      el('div', { class: 'set-row-ico', style: { background: 'rgba(255,255,255,.08)' }, text: '🔐' }),
      el('div', { class: 'grow' }, el('div', { class: 't1', text: 'Разрешения' }), el('div', { class: 't2', text: 'память, уведомления' })), chev()),
    installed ? el('div', { class: 'list__row', onclick: () => uninstall(a) },
      el('div', { class: 'set-row-ico', style: { background: 'rgba(239,68,68,.16)' }, text: '🗑️' }),
      el('div', { class: 'grow' }, el('div', { class: 't1', style: { color: '#f87171' }, text: 'Удалить приложение' }))) : null
  ));

  inst.root.append(body);
}

async function uninstall(a) {
  const S = getState();
  if (!S.store.installed.includes(a.id)) return;
  const ok = await sysConfirm('Удалить приложение?', `${a.name} и все его данные будут удалены.`, 'Удалить', true);
  if (!ok) return;
  S.store.installed = S.store.installed.filter((x) => x !== a.id);
  S.phone.storage.apps = Math.max(0, S.phone.storage.apps - a.size / 1024);
  save();
  api.refreshHome();
  detail = null;
  render();
  toast('🗑️', 'Приложение удалено', `${a.name} · освобождено ${a.size} МБ`);
}

async function account() {
  const S = getState();
  await sysDialog({
    title: 'Аккаунт Nova', icon: '👤',
    text: `${S.phone.user.name || 'Владелец'}<br/>nova-id: ${hash(S.phone.sim.imei).toString(36).slice(0, 10)}@nova.local<br/><br/>Установлено приложений: <b>${S.store.installed.length}</b><br/>Потрачено: <b>${fmtMoney(S.stats.spent || 0)}</b><br/>Баланс карты: <b>${fmtMoney(S.bank.balance)}</b>`,
    buttons: [{ label: 'Закрыть', value: true, cls: 'primary' }]
  });
}
