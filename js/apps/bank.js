import { getState, save } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, uid, fmtMoney, fmtTime, timeAgo, clamp, fmtDateShort } from '../util.js';
import { toast, sysDialog, sysConfirm, row, chev } from '../ui.js';
import { OPERATORS, displayName } from '../state.js';

let inst = null, tab = 'main';

export function mount(root, a) {
  inst = { root, api: a };
  root.className = 'app bank theme-dark';
  render();
  return {
    onFocus() { render(); },
    onBack() { if (tab !== 'main') { tab = 'main'; render(); return true; } return false; },
    onUnmount() { inst = null; }
  };
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar' },
    el('h1', {}, el('span', { text: 'NovaBank' }), el('span', { class: 'sub', text: tab === 'main' ? 'Карта •••• 7723' : '' })));
  const acts = el('div', { class: 'appbar__actions' });
  const qr = el('button', { class: 'iconbtn', onclick: () => qrScan() });
  qr.innerHTML = ICON.qr();
  const support = el('button', { class: 'iconbtn', onclick: () => support() });
  support.innerHTML = ICON.chat();
  acts.append(qr, support);
  bar.append(acts);
  inst.root.append(bar);

  const tabs = el('div', { class: 'tabs' });
  [['main', 'Главная'], ['history', 'История'], ['services', 'Услуги']].forEach(([id, label]) => {
    tabs.append(el('button', { class: tab === id ? 'on' : '', text: label, onclick: () => { tab = id; SFX.tap(); render(); } }));
  });
  inst.root.append(tabs);

  const body = el('div', { class: 'appbody' });
  inst.root.append(body);
  if (tab === 'main') main(body);
  else if (tab === 'history') history(body);
  else services(body);
}

function main(body) {
  const S = getState();
  body.append(el('div', { class: 'bank__bal' },
    el('div', { class: 'bank__card' },
      el('div', { class: 'bc-chip' }),
      el('div', { class: 'bc-bank', text: 'NOVABANK · DEBIT' }),
      el('div', { class: 'bc-sum', text: fmtMoney(S.bank.balance) }),
      el('div', { class: 'bc-num', text: S.bank.card }),
      el('div', { style: { fontSize: '11px', opacity: '.65', marginTop: '8px' }, text: `${S.phone.user.name || 'ВЛАДЕЛЕЦ'} · действительна до 12/29` })
    )
  ));

  body.append(el('div', { class: 'bank__quick' },
    qBtn('💸', 'Перевод', () => transfer()),
    qBtn('📱', 'Мобильная связь', () => topUpMobile()),
    qBtn('💶', 'Внести наличные', () => depositCash()),
    qBtn('💱', 'Обмен валют', () => exchange())
  ));

  const cashCard = el('div', { class: 'bank__cash' });
  cashCard.append(el('div', { class: 'cash-ico', text: '💶' }));
  const cashTxt = el('div', { class: 'cash-txt' });
  cashTxt.append(el('div', { class: 't1', text: 'Наличные в кошельке' }));
  cashTxt.append(el('div', { class: 't2', text: fmtMoney(S.money) + ' · кошелёк лежит на столе' }));
  cashCard.append(cashTxt);
  cashCard.append(el('button', { class: 'btn btn--tiny', text: 'На карту', onclick: () => depositCash() }));
  body.append(cashCard);

  body.append(el('div', { class: 'sect-title', text: 'Последние операции' }));
  const list = el('div', { class: 'list' });
  S.bank.transactions.slice(0, 6).forEach((t) => list.append(txRow(t)));
  body.append(list);
  body.append(el('div', { style: { padding: '12px 16px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: 'Вся история', onclick: () => { tab = 'history'; render(); } })));
}

function qBtn(icon, label, fn) {
  return el('button', { onclick: fn }, el('div', { class: 'qi', text: icon }), el('span', { text: label }));
}

function txRow(t) {
  return el('div', { class: 'tx-row' },
    el('div', { class: 'tx-i', text: t.icon || '💳' }),
    el('div', { style: { flex: '1', minWidth: '0' } },
      el('div', { class: 'tx-t', text: t.title }),
      el('div', { class: 'tx-d', text: `${t.cat} · ${timeAgo(t.at)}` })),
    el('div', { class: 'tx-s ' + (t.amount > 0 ? 'plus' : 'minus'), text: `${t.amount > 0 ? '+' : ''}${fmtMoney(t.amount)}` }));
}

function history(body) {
  const S = getState();
  if (!S.bank.transactions.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🧾' }), 'Операций нет'));
    return;
  }
  let lastMonth = '';
  const list = el('div', { class: 'list' });
  S.bank.transactions.forEach((t) => {
    const m = new Date(t.at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    if (m !== lastMonth) {
      lastMonth = m;
      const sum = S.bank.transactions.filter((x) => new Date(x.at).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }) === m)
        .reduce((a, x) => a + x.amount, 0);
      list.append(el('div', { class: 'sect-title', style: { display: 'flex', justifyContent: 'space-between' } },
        el('span', { text: m }), el('span', { style: { color: sum >= 0 ? '#4ade80' : '#f87171' }, text: (sum >= 0 ? '+' : '') + fmtMoney(sum) })));
    }
    list.append(txRow(t));
  });
  body.append(list);
}

function services(body) {
  const S = getState();
  const list = el('div', { class: 'list' });
  const srv = (icon, title, sub, fn, bg = 'rgba(255,255,255,.08)') => list.append(row({ icon, iconBg: bg, title, sub, right: chev(), onClick: fn }));
  srv('📱', 'Мобильная связь', S.phone.sim.number || 'нет SIM-карты', () => topUpMobile(), 'rgba(74,222,128,.18)');
  srv('🌐', 'Домашний интернет', 'Home_Nova_5G · 24,90 €/мес', () => toast('🌐', 'Домашний интернет', 'Уже оплачен до конца месяца. Роутер мигает в знак благодарности'), 'rgba(56,189,248,.18)');
  srv('💡', 'Коммунальные услуги', 'Оплатить за месяц — 86,40 €', () => payBills(), 'rgba(250,204,21,.18)');
  srv('🚇', 'Проездной', 'MOBIB · 49 €/мес', () => toast('🚇', 'Проездной', 'В этой игре метро нет, но билет красивый'), 'rgba(167,139,250,.18)');
  srv('🏦', 'Накопительный счёт', '3,2% годовых · 0,00 €', () => savings(), 'rgba(34,211,238,.18)');
  srv('💳', 'Заказать новую карту', 'бесплатно, 5 дней', () => toast('💳', 'Заявка принята', 'Курьер приедет… когда-нибудь'), 'rgba(244,114,181,.18)');
  srv('🔒', 'Заблокировать карту', 'на всякий случай', () => blockCard(), 'rgba(239,68,68,.18)');
  body.append(list);
}

/* ---------------- операции ---------------- */
async function transfer() {
  const S = getState();
  const list = S.contacts.filter((c) => c.phone && !c.service);
  const res = await sysDialog({
    title: 'Перевод', icon: '💸',
    text: 'Кому перевести деньги?',
    input: { placeholder: list.map((c) => c.name).join(', ') },
    buttons: [{ label: 'Отмена', value: null }, { label: 'Далее', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const q = String(res || '').trim().toLowerCase();
  const to = list.find((c) => (c.name || c.full || '').toLowerCase().includes(q)) || list[0];
  const amtRes = await sysDialog({
    title: `Перевод: ${displayName(to)}`, icon: '💶',
    text: `Доступно: ${fmtMoney(S.bank.balance)}<br/>Комиссия: 0% (переводы друзьям бесплатны)`,
    input: { placeholder: 'Сумма, например 10', value: '10', inputType: 'number' }, inputType: 'number',
    buttons: [{ label: 'Отмена', value: null }, { label: 'Перевести', value: true, cls: 'primary' }]
  });
  if (amtRes === null) return;
  const amt = parseFloat(String(amtRes).replace(',', '.'));
  if (!amt || amt <= 0) { SFX.error(); toast('❌', 'Неверная сумма', 'Введите число больше нуля'); return; }
  if (amt > S.bank.balance) { SFX.error(); toast('💸', 'Недостаточно средств', `На карте ${fmtMoney(S.bank.balance)}`); return; }

  const code = String(Math.floor(1000 + Math.random() * 9000));
  const ok = await sysDialog({
    title: 'Подтвердите перевод', icon: '🔐',
    text: `${displayName(to)} · ${fmtMoney(amt)}<br/><br/>Код из SMS: <b style="letter-spacing:.2em;font-size:19px">${code}</b><br/><span style="opacity:.6;font-size:12px">Код пришёл на номер ${S.phone.sim.number || '—'} — в игре его можно просто нажать</span>`,
    buttons: [{ label: 'Отмена', value: false }, { label: '✅ Подтвердить', value: true, cls: 'primary' }]
  });
  if (!ok) return;

  S.bank.balance -= amt;
  S.bank.transactions.unshift({ id: uid('tx'), title: `Перевод · ${displayName(to)}`, cat: 'Переводы', amount: -amt, at: S.time.gameMs, icon: '💸' });
  S.stats.transfers = (S.stats.transfers || 0) + 1;
  save();
  emit(EV.MONEY);
  SFX.coin();
  unlock('bank');
  toast('💸', 'Перевод выполнен', `${fmtMoney(amt)} → ${displayName(to)}`);
  window.__sysMsg?.('bank', `Перевод ${fmtMoney(amt)} получателю ${displayName(to)} выполнен. Баланс: ${fmtMoney(S.bank.balance)}. Код ${code} никому не сообщайте — даже маме.`);
  setTimeout(() => {
    window.__botMsg?.(to.id, amt >= 20 ? `ооо спасибо за ${amt} €! ты лучший 🤗` : `получил(а) ${amt} €, спасибо!`);
  }, 4000);
  render();
}

async function topUpMobile() {
  const S = getState();
  if (!S.phone.sim.operator) { toast('📵', 'Нет SIM-карты', 'Сначала установите SIM: скрепка → лоток → SIM'); return; }
  const op = OPERATORS[S.phone.sim.operator];
  const res = await sysDialog({
    title: 'Пополнить мобильный', icon: '📱',
    text: `Номер: ${S.phone.sim.number}<br/>Оператор: ${op.name}<br/>Тариф: «${op.tariff}» · ${op.price.toFixed(2)} €/день<br/><br/>Сколько положить?`,
    buttons: [
      { label: '5 €', value: 5, cls: 'primary' }, { label: '10 €', value: 10, cls: 'primary' },
      { label: '20 €', value: 20, cls: 'primary' }, { label: 'Отмена', value: null }
    ]
  });
  if (!res) return;
  if (S.bank.balance < res) { toast('💸', 'Недостаточно средств', 'Пополните карту наличными из кошелька'); return; }
  S.bank.balance -= res;
  S.bank.transactions.unshift({ id: uid('tx'), title: `Мобильная связь ${op.name}`, cat: 'Связь', amount: -res, at: S.time.gameMs, icon: '📱' });
  if (op.gb !== Infinity) { S.phone.data.limitGb += res; S.flags.dataLimitHit = false; }
  save(); emit(EV.MONEY); SFX.coin();
  toast('📱', `Счёт пополнен на ${res} €`, op.gb === Infinity ? 'Безлимит продлён' : `Добавлено ${res} ГБ интернета`);
  window.__sysMsg?.('operator', `Ваш счёт пополнен на ${res.toFixed(2)} €. ${op.gb === Infinity ? 'Безлимит активен.' : `Добавлено ${res} ГБ.`} Баланс: ${(S.bank.balance).toFixed(2)} €.`);
  render();
}

async function depositCash() {
  const S = getState();
  if (S.money <= 0) { toast('💶', 'Кошелёк пуст', 'Наличных нет. Зато есть телефон!'); return; }
  const res = await sysDialog({
    title: 'Внести наличные', icon: '💶',
    text: `В кошельке: ${fmtMoney(S.money)}<br/>Комиссия банкомата: 0 € (он в игре бесплатный)`,
    buttons: [
      { label: '10 €', value: Math.min(10, S.money) },
      { label: 'Всё', value: S.money, cls: 'primary' },
      { label: 'Отмена', value: null }
    ]
  });
  if (res === null) return;
  const amt = Math.min(res, S.money);
  S.money -= amt;
  S.bank.balance += amt;
  S.bank.transactions.unshift({ id: uid('tx'), title: 'Внесение наличных', cat: 'Пополнение', amount: amt, at: S.time.gameMs, icon: '💶' });
  save(); emit(EV.MONEY); SFX.coin();
  toast('💶', `Внесено ${fmtMoney(amt)}`, `Баланс карты: ${fmtMoney(S.bank.balance)}`);
  render();
}

async function exchange() {
  const res = await sysDialog({
    title: 'Обмен валют', icon: '💱',
    text: 'Курс NovaBank на сегодня:<br/><br/>USD/EUR 0,92 · GBP/EUR 1,17 · UAH/EUR 0,024<br/>JPY/EUR 0,0061 · PLN/EUR 0,23<br/><br/>Обмен в игре недоступен — у вас и так всё в евро.',
    buttons: [{ label: 'Ясно', value: true, cls: 'primary' }]
  });
}

async function payBills() {
  const S = getState();
  const amt = 86.4;
  const ok = await sysDialog({
    title: 'Коммунальные услуги', icon: '💡',
    text: `Квартира, ул. Симуляторная 15<br/><br/>Электричество: 42,10 €<br/>Вода: 18,30 €<br/>Интернет: 24,90 €<br/>Вывоз мусора: 1,10 €<br/><br/><b>Итого: ${fmtMoney(amt)}</b>`,
    buttons: [{ label: 'Отмена', value: false }, { label: `Оплатить ${fmtMoney(amt)}`, value: true, cls: 'primary' }]
  });
  if (!ok) return;
  if (S.bank.balance < amt) { toast('💸', 'Недостаточно средств', `Нужно ${fmtMoney(amt)}, на карте ${fmtMoney(S.bank.balance)}`); return; }
  S.bank.balance -= amt;
  S.bank.transactions.unshift({ id: uid('tx'), title: 'Коммунальные услуги', cat: 'Платежи', amount: -amt, at: S.time.gameMs, icon: '💡' });
  S.stats.spent = (S.stats.spent || 0) + amt;
  if (S.stats.spent >= 100) unlock('rich');
  save(); emit(EV.MONEY); SFX.coin();
  toast('💡', 'Коммуналка оплачена', `${fmtMoney(amt)} · квитанция в Файлы → Документы`);
  window.__sysMsg?.('bank', `Платёж ${fmtMoney(amt)} принят: коммунальные услуги. Квитанция сохранена в «Файлы».`);
  render();
}

async function savings() {
  const S = getState();
  const res = await sysDialog({
    title: 'Накопительный счёт', icon: '🏦',
    text: 'Ставка 3,2% годовых. Капитализация ежемесячная.<br/><br/>На счёте: <b>0,00 €</b><br/>Чтобы открыть вклад, переведите туда деньги.',
    input: { placeholder: 'Сумма вклада', value: '50' }, inputType: 'number',
    buttons: [{ label: 'Отмена', value: null }, { label: 'Открыть вклад', value: true, cls: 'primary' }]
  });
  if (res === null) return;
  const amt = parseFloat(String(res));
  if (!amt || amt <= 0) return;
  if (amt > S.bank.balance) { toast('💸', 'Недостаточно средств', ''); return; }
  S.bank.balance -= amt;
  S.flags.savings = (S.flags.savings || 0) + amt;
  S.bank.transactions.unshift({ id: uid('tx'), title: 'Перевод на накопительный', cat: 'Сбережения', amount: -amt, at: S.time.gameMs, icon: '🏦' });
  save(); emit(EV.MONEY); SFX.coin();
  toast('🏦', 'Вклад открыт', `${fmtMoney(amt)} под 3,2% годовых. Проценты придут… через год (в игровом времени — через 365 дней)`);
  render();
}

async function blockCard() {
  const ok = await sysConfirm('Заблокировать карту?', 'После блокировки покупки и переводы станут недоступны. Разблокировать можно только в поддержке (которой тоже нет).', 'Заблокировать', true);
  if (!ok) return;
  toast('🔒', 'Карта заблокирована', 'Шутка. В симуляторе это было бы слишком жестоко — ничего не произошло.');
}

async function qrScan() {
  const res = await sysDialog({
    title: 'Сканер QR', icon: '📷',
    text: 'Камера ищет QR-код…<br/><br/>🔲 Наведите на код. В игре кодов нет, но вот один для настроения:<br/><br/><span style="font-family:monospace;font-size:11px">▛▀▖▌ ▌▛▀▖<br/>▙▄▘▙▄▘▙▄▘</span>',
    buttons: [{ label: 'Отмена', value: null }, { label: 'Отсканировать', value: true, cls: 'primary' }]
  });
  if (res) toast('📷', 'QR распознан', '«Скидка 5% на кофе» — но кофейня в игре не работает');
}

async function support() {
  const res = await sysDialog({
    title: 'Поддержка NovaBank', icon: '💬',
    text: 'Выберите тему обращения',
    buttons: [
      { label: '💳 Карта и платежи', value: 'card' },
      { label: '🔐 Безопасность', value: 'sec' },
      { label: '🤖 Чат-бот', value: 'bot' },
      { label: 'Закрыть', value: null }
    ]
  });
  if (res === 'bot') {
    await sysDialog({
      title: '🤖 Нова-бот', icon: '🤖',
      text: 'Здравствуйте! Я виртуальный помощник.<br/><br/>Вы: «где мои деньги?»<br/>Бот: «Деньги там же, где и вчера — в кошельке на столе 💶»<br/><br/>Вы: «позови человека»<br/>Бот: «Оператор №47 освободится через 118 минут. Ожидайте.»',
      buttons: [{ label: 'Завершить чат', value: true, cls: 'primary' }]
    });
  }
  if (res === 'sec') await sysDialog({ title: 'Безопасность', icon: '🔐', text: 'Никогда не сообщайте PIN-код, CVV и коды из SMS — даже сотруднику банка.<br/><br/>Ваш PIN в этой игре: 1234 (поменяйте его в Настройки → Безопасность).', buttons: [{ label: 'Понятно', value: true, cls: 'primary' }] });
  if (res === 'card') await sysDialog({ title: 'Карта и платежи', icon: '💳', text: `Карта ${getState().bank.card}<br/>Статус: активна<br/>Лимит в день: 2 000 €<br/>Бесконтактная оплата: включена`, buttons: [{ label: 'Спасибо', value: true, cls: 'primary' }] });
}
