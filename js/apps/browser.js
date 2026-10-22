import { getState, save, completeTask, OPERATORS } from '../state.js';
import { emit, EV } from '../bus.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { notify } from '../notify.js';
import { el, clear, uid, fmtMoney, fmtTime, esc, rndInt, pick, fmtDateFull, plural } from '../util.js';
import { toast, sysDialog, sysConfirm } from '../ui.js';
import { hasInternet, useData } from '../net.js';
import { today, days } from '../weather.js';

let inst = null;

export function mount(root, a, params) {
  inst = { root, api: a };
  root.className = 'app browser';
  const S = getState();
  if (params?.url) S.browser.tabs[S.browser.activeTab].url = normalize(params.url);
  render();
  return {
    light: true,
    onFocus(p) { if (p?.url) { S.browser.tabs[S.browser.activeTab].url = normalize(p.url); render(); } },
    onBack() {
      if (historyBack()) return true;
      const t = currentTab();
      if (t.url !== 'nova://start') { go('nova://start'); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

const currentTab = () => {
  const S = getState();
  return S.browser.tabs[S.browser.activeTab] || S.browser.tabs[0];
};

function normalize(url) {
  let u = String(url || '').trim();
  if (!u) return 'nova://start';
  if (u.startsWith('nova://')) return u;
  if (/^(https?:\/\/)/.test(u)) return u.replace(/^https?:\/\//, '');
  if (/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) return u;
  return 'nova-search.net/search?q=' + encodeURIComponent(u);
}

function go(url, opts = {}) {
  const S = getState();
  const t = currentTab();
  const target = normalize(url);
  if (!opts.replace && t.url !== target) {
    t.history = t.history || [];
    t.history.push(t.url);
    if (t.history.length > 30) t.history.shift();
  }
  t.url = target;
  t.title = titleFor(target);
  S.browser.history.unshift({ url: target, title: t.title, at: S.time.gameMs });
  if (S.browser.history.length > 60) S.browser.history.length = 60;
  save();
  render();
}

function historyBack() {
  const t = currentTab();
  if (!t.history?.length) return false;
  const prev = t.history.pop();
  t.url = prev; t.title = titleFor(prev);
  save(); render();
  SFX.back();
  return true;
}

function titleFor(url) {
  if (url.startsWith('nova://start')) return 'Новая вкладка';
  const host = url.split('/')[0];
  return SITE_NAMES[host] || host;
}
const SITE_NAMES = {
  'nova-search.net': 'Nova Search',
  'novanews.io': 'Nova Новости',
  'techshop.online': 'TechShop — интернет-магазин',
  'wiki.nova': 'NovaWiki',
  'bank.nova': 'NovaBank Online',
  'memes.nova': 'Мемы 24/7',
  'bit.ly': 'Перенаправление',
  'weather.nova': 'Погода'
};

/* =========================================================
   РЕНДЕР
   ========================================================= */
function render() {
  if (!inst) return;
  const S = getState();
  const t = currentTab();
  clear(inst.root);

  // адресная строка
  const bar = el('div', { class: 'browser__bar' });
  const tabBtn = el('button', { class: 'iconbtn', style: { color: '#374151' }, onclick: () => tabsView() });
  tabBtn.innerHTML = `<span style="font-size:11.5px;border:1.6px solid currentColor;border-radius:6px;padding:1px 5px;font-weight:700">${S.browser.tabs.length}</span>`;
  bar.append(tabBtn);

  const urlBox = el('div', { class: 'browser__url' });
  const net = hasInternet();
  urlBox.innerHTML = net.ok ? `<span class="lock-ico">🔒</span>` : `<span style="opacity:.5">⚠️</span>`;
  const input = el('input', { type: 'text', value: t.url.startsWith('nova://') ? '' : t.url, placeholder: 'Поиск или адрес сайта' });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = input.value.trim();
      if (!v) return;
      SFX.click();
      go(v);
      input.blur();
    }
  });
  urlBox.append(input);
  bar.append(urlBox);

  const reload = el('button', { class: 'iconbtn', style: { color: '#374151' }, onclick: () => render() });
  reload.innerHTML = ICON.refresh();
  bar.append(reload);
  inst.root.append(bar);

  // содержимое
  const view = el('div', { class: 'browser__view' });
  inst.root.append(view);
  renderPage(view, t.url);

  // навигация
  const nav = el('div', { class: 'browser__nav' });
  const nb = (svg, fn, dis) => {
    const b = el('button', { onclick: fn, disabled: !!dis });
    b.innerHTML = svg;
    return b;
  };
  nav.append(nb(ICON.back(), () => historyBack(), !t.history?.length));
  nav.append(nb(ICON.chevR(), () => {}, true));
  nav.append(nb(ICON.refresh(), () => { SFX.tap(); render(); }));
  nav.append(nb(ICON.bookmark(), () => bookmark()));
  nav.append(nb(ICON.globe(), () => go('nova://start')));
  inst.root.append(nav);
}

async function bookmark() {
  const S = getState();
  const t = currentTab();
  const host = t.url.split('/')[0];
  if (t.url.startsWith('nova://')) { toast('⭐', 'Нельзя сохранить', 'Стартовая страница уже в закладках'); return; }
  if (S.browser.bookmarks.includes(host)) {
    S.browser.bookmarks = S.browser.bookmarks.filter((b) => b !== host);
    toast('⭐', 'Закладка удалена', host);
  } else {
    S.browser.bookmarks.push(host);
    toast('⭐', 'Добавлено в закладки', host);
  }
  save();
}

function tabsView() {
  const S = getState();
  sysDialog({
    title: `Вкладки (${S.browser.tabs.length})`, icon: '🗂️',
    text: S.browser.tabs.map((t, i) => `${i + 1}. ${t.title || t.url}`).join('<br/>') + '<br/><br/>История: ' + (S.browser.history.slice(0, 6).map((h) => h.title).join(' → ') || 'пуста'),
    buttons: [
      { label: '＋ Новая', value: 'new', cls: 'primary' },
      { label: '🕘 История', value: 'hist' },
      { label: 'Закрыть', value: null }
    ]
  }).then(async (v) => {
    if (v === 'new') {
      S.browser.tabs.push({ id: Date.now(), url: 'nova://start', title: 'Новая вкладка', history: [] });
      S.browser.activeTab = S.browser.tabs.length - 1;
      save(); render();
    } else if (v === 'hist') {
      const hist = S.browser.history.slice(0, 25);
      const res = await sysDialog({
        title: 'История', icon: '🕘',
        text: hist.length ? hist.map((h, i) => `${i + 1}. <a href="#" data-h="${esc(h.url)}">${esc(h.title)}</a><br/><span style="opacity:.55;font-size:11px">${esc(h.url)}</span>`).join('<br/>') : 'Пусто',
        buttons: [{ label: 'Очистить', value: 'clear', cls: 'danger' }, { label: 'Закрыть', value: null }]
      });
      if (res === 'clear') { S.browser.history = []; save(); toast('🧹', 'История очищена', ''); }
    }
  });
}

/* =========================================================
   СТРАНИЦЫ
   ========================================================= */
function renderPage(view, url) {
  const S = getState();
  const net = hasInternet();
  if (!net.ok) { noNetPage(view, net); return; }

  const [host, ...rest] = url.split('/');
  const path = rest.join('/');

  useData(rndInt(1, 5));
  completeTask('t13');

  const handlers = {
    'nova://start': startPage,
    'nova-search.net': searchPage,
    'novanews.io': newsPage,
    'techshop.online': shopPage,
    'wiki.nova': wikiPage,
    'bank.nova': bankPage,
    'memes.nova': memesPage,
    'weather.nova': weatherPage,
    'bit.ly': redirectPage
  };

  let handled = false;
  for (const key of Object.keys(handlers)) {
    if (url.startsWith(key)) { handlers[key](view, url.slice(key.length).replace(/^\//, '')); handled = true; break; }
  }
  if (!handled) {
    // «внешние» известные хосты
    if (/prize|win|bonus|free|cash|kredit|poshlina/i.test(url)) { scamPage(view, url); handled = true; }
    else if (/^porno|xxx|adult/i.test(host)) { blockedPage(view, url); handled = true; }
  }
  if (!handled) notFoundPage(view, url);

  unlock('internet');
  // клики по ссылкам
  view.querySelectorAll('a[data-h]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); SFX.tap(); go(a.dataset.h); view.scrollTop = 0; });
  });
  view.querySelectorAll('a[data-search]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); SFX.tap(); go('nova-search.net/search?q=' + encodeURIComponent(a.dataset.search)); });
  });
}

/* ---------- стартовая ---------- */
function startPage(view) {
  const S = getState();
  const p = el('div', { class: 'webpage' });
  const net = hasInternet();
  p.innerHTML = `
    <div class="search-big">
      <div class="logo"><b>N</b><b>o</b><b>v</b><b>a</b><b>&nbsp;</b><b>Search</b></div>
      <form id="sform">
        <input id="sq" type="text" placeholder="Поиск в интернете" autocomplete="off"/>
        <button class="btn-web" type="submit">Найти</button>
      </form>
      <p class="muted" style="margin-top:10px">Подключение: ${net.ok ? (net.kind === 'wifi' ? `Wi-Fi ${esc(net.name)}` : `мобильные данные ${esc(net.name)}`) : 'нет'} · ${esc(fmtDateFull())}</p>
    </div>
    <h3 style="margin-top:18px">Закладки</h3>
    <div class="home-links">
      ${S.browser.bookmarks.map((b) => `<a href="#" data-h="${esc(b)}"><div class="hl-ico" style="background:${faviconBg(b)}">${favicon(b)}</div><span>${esc(b.split('.')[0])}</span></a>`).join('')}
    </div>
    <h3>Часто посещаемые</h3>
    <div class="home-links">
      <a href="#" data-h="novanews.io"><div class="hl-ico" style="background:linear-gradient(135deg,#ef4444,#7f1d1d)">📰</div><span>Новости</span></a>
      <a href="#" data-h="techshop.online"><div class="hl-ico" style="background:linear-gradient(135deg,#22d3ee,#0e7490)">🛒</div><span>Магазин</span></a>
      <a href="#" data-h="wiki.nova"><div class="hl-ico" style="background:linear-gradient(135deg,#94a3b8,#334155)">📚</div><span>Вики</span></a>
      <a href="#" data-h="memes.nova"><div class="hl-ico" style="background:linear-gradient(135deg,#f472b6,#7c3aed)">😂</div><span>Мемы</span></a>
      <a href="#" data-h="bank.nova"><div class="hl-ico" style="background:linear-gradient(135deg,#34d399,#065f46)">🏦</div><span>Банк</span></a>
      <a href="#" data-h="weather.nova"><div class="hl-ico" style="background:linear-gradient(135deg,#38bdf8,#1e40af)">🌤️</div><span>Погода</span></a>
      <a href="#" data-search="как зарядить телефон быстрее"><div class="hl-ico" style="background:linear-gradient(135deg,#facc15,#a16207)">🔋</div><span>Лайфхак</span></a>
      <a href="#" data-h="bit.ly/prize-nova"><div class="hl-ico" style="background:linear-gradient(135deg,#f87171,#7f1d1d)">🎁</div><span>Приз?!</span></a>
    </div>
    <hr/>
    <div class="card">
      <h4>💡 Совет дня</h4>
      <p class="muted" style="font-size:12.5px;margin:0">Свайпните сверху вниз по экрану телефона, чтобы открыть шторку с быстрыми настройками: интернет, Wi-Fi, фонарик и режим полёта.</p>
    </div>
  `;
  view.append(p);
  const form = p.querySelector('#sform');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const q = p.querySelector('#sq').value.trim();
    if (!q) return;
    SFX.click();
    go('nova-search.net/search?q=' + encodeURIComponent(q));
    unlock('search');
  });
}

function favicon(host) {
  const m = { 'nova-search.net': '🔎', 'novanews.io': '📰', 'techshop.online': '🛒', 'wiki.nova': '📚', 'bank.nova': '🏦', 'memes.nova': '😂', 'weather.nova': '🌤️' };
  return m[host] || '🌐';
}
function faviconBg(host) {
  const m = { 'nova-search.net': 'linear-gradient(135deg,#60a5fa,#1d4ed8)', 'novanews.io': 'linear-gradient(135deg,#ef4444,#7f1d1d)', 'techshop.online': 'linear-gradient(135deg,#22d3ee,#0e7490)', 'wiki.nova': 'linear-gradient(135deg,#94a3b8,#334155)', 'bank.nova': 'linear-gradient(135deg,#34d399,#065f46)', 'memes.nova': 'linear-gradient(135deg,#f472b6,#7c3aed)', 'weather.nova': 'linear-gradient(135deg,#38bdf8,#1e40af)' };
  return m[host] || 'linear-gradient(135deg,#64748b,#1e293b)';
}

/* ---------- поиск ---------- */
const SEARCH_DB = [
  { q: ['nova x5', 'телефон', 'смартфон', 'нова'], t: 'NOVA X5 Pro — обзор нового флагмана', u: 'novanews.io/tech/nova-x5-pro', d: 'Титан G3, 120 Гц, камера 108 МП и батарея 5000 мА·ч. Разбираемся, стоит ли своих денег.' },
  { q: ['погод', 'дождь', 'брюссель'], t: 'Погода в Брюсселе на 7 дней', u: 'weather.nova', d: 'Точный прогноз: температура, ветер, осадки и давление. Обновляется каждый час.' },
  { q: ['купить', 'чехол', 'наушник', 'магазин', 'аксессуар'], t: 'TechShop — чехлы, наушники и аксессуары', u: 'techshop.online', d: 'Доставка за 2 часа. Скидка 15% на защитные стёкла до конца дня.' },
  { q: ['как зарядить', 'батаре', 'заряд', 'аккумулятор'], t: 'Как заряжать телефон правильно: 7 правил', u: 'wiki.nova/battery', d: 'Литий-ионные батареи не любят 0% и 100%. Оптимальный диапазон — 20–80%.' },
  { q: ['sim', 'сим', 'оператор', 'тариф', 'mobiline', 'telka'], t: 'Как установить SIM-карту и выбрать тариф', u: 'wiki.nova/sim', d: 'Скрепка, лоток, правильный угол — и почему телефон не видит сеть.' },
  { q: ['wi-fi', 'вайфай', 'пароль', 'роутер', 'интернет'], t: 'Wi-Fi не подключается: что делать', u: 'wiki.nova/wifi', d: 'Проверьте пароль, диапазон 2.4/5 ГГц и не включён ли режим полёта.' },
  { q: ['мем', 'смешн', 'прикол'], t: 'Мемы про телефоны — подборка недели', u: 'memes.nova', d: '1% батареи и 47 уведомлений. Классика.' },
  { q: ['банк', 'перевод', 'деньги', 'карта', 'баланс'], t: 'NovaBank Online — личный кабинет', u: 'bank.nova', d: 'Баланс, переводы, история операций и оплата связи за 10 секунд.' },
  { q: ['змейка', 'игр', 'snake', '2048'], t: 'Лучшие офлайн-игры для телефона', u: 'nova-search.net/games', d: 'Змейка, 2048, сапёр — всё, что работает без интернета и ест батарею.' },
  { q: ['будильник', 'часы', 'таймер', 'время'], t: 'Как настроить будильник и не проспать', u: 'wiki.nova/alarm', d: 'Громкость, вибрация и «ещё 9 минут» — почему это ловушка.' },
  { q: ['приз', 'выиграл', 'бесплатно', 'iphone'], t: '⚠️ Вы выиграли приз? Скорее всего, нет', u: 'wiki.nova/scam', d: 'Как распознать мошенников: короткие ссылки, просьба оплатить «пошлину» и таймер на 15 минут.' },
  { q: ['камер', 'фото', 'селфи', 'снимок'], t: '10 приёмов мобильной фотографии', u: 'wiki.nova/photo', d: 'Правило третей, ночной режим и почему не надо использовать цифровой зум.' },
  { q: ['мама', 'семья', 'позвонить'], t: 'Как часто нужно звонить родителям?', u: 'novanews.io/life/call-parents', d: 'Психологи говорят: хотя бы раз в неделю. Мамы говорят: каждый день.' },
  { q: ['новости', 'что случилось', 'события'], t: 'Главные новости дня', u: 'novanews.io', d: 'Всё, что произошло в мире симулятора за последние сутки.' }
];

function searchPage(view, path) {
  const q = decodeURIComponent((path.split('q=')[1] || '').split('&')[0] || '').toLowerCase();
  const p = el('div', { class: 'webpage' });
  useData(1);
  if (!q) { startPage(view); return; }
  unlock('search');
  const results = SEARCH_DB.filter((r) => r.q.some((k) => q.includes(k) || k.includes(q)));
  const time = (rndInt(18, 62) / 100).toFixed(2);
  let html = `<p class="muted">Результатов: ${results.length ? results.length * rndInt(1200, 90000) : 0} (${time} сек.) · запрос «${esc(q)}»</p>`;
  if (!results.length) {
    html += `
      <div class="card" style="text-align:center">
        <h4>Ничего не найдено 😔</h4>
        <p class="muted">Проверьте раскладку или попробуйте другой запрос. Например: «погода», «чехол», «как зарядить телефон».</p>
      </div>
      <h3>Популярные запросы</h3>
      <div class="home-links">
        ${['погода', 'чехол для телефона', 'как зарядить быстрее', 'мемы', 'змейка', 'сим-карта не работает', 'будильник', 'банк'].map((x) => `<a href="#" data-search="${esc(x)}"><div class="hl-ico" style="background:#e5e7eb;color:#111">🔎</div><span>${esc(x)}</span></a>`).join('')}
      </div>`;
  } else {
    html += results.map((r) => `
      <div class="serp-item">
        <div class="u">${esc(r.u)}</div>
        <div class="t"><a href="#" data-h="${esc(r.u)}">${esc(r.t)}</a></div>
        <div class="d">${esc(r.d)}</div>
      </div>`).join('');
    html += `<hr/><h3>Возможно, вы искали</h3><div class="home-links">
      ${results.slice(0, 4).map((r) => `<a href="#" data-search="${esc(r.q[0])}"><div class="hl-ico" style="background:#e5e7eb;color:#111">💡</div><span>${esc(r.q[0])}</span></a>`).join('')}
    </div>`;
  }
  p.innerHTML = html;
  view.append(p);
}

/* ---------- новости ---------- */
function newsPage(view, path) {
  const S = getState();
  const p = el('div', { class: 'webpage' });
  const t = today();
  const net = hasInternet();
  const opName = S.phone.sim.operator === 'mobiline' ? 'Mobiline' : S.phone.sim.operator === 'telka' ? 'Telka' : 'оператора';

  const articles = [
    { id: 'nova-x5-pro', cat: 'Технологии', t: 'NOVA X5 Pro поступил в продажу: очередь у магазина стояла с ночи', d: 'Первые покупатели говорят, что плёнка на экране снимается особенно приятно. Продажи стартовали в 8 утра, и к обеду партия из 500 штук закончилась.', body: `<p>Сегодня в 8:00 у фирменных магазинов NOVA выстроились очереди. Причина — старт продаж NOVA X5 Pro, флагмана с процессором Titan G3, экраном 120 Гц и камерой на 108 МП.</p><p>«Я пришёл в шесть утра и всё равно был сорок вторым», — рассказывает один из покупателей. По его словам, главным впечатлением стала не камера, а момент снятия защитной плёнки: «Это медитация».</p><p>Аналитики отмечают, что партия из 500 устройств разошлась к обеду. Следующая поставка ожидается через две недели.</p><h3>Характеристики</h3><ul><li>Экран: 6,4" AMOLED, 120 Гц</li><li>Процессор: Nova Titan G3, 8 ядер</li><li>Память: 12 / 256 ГБ</li><li>Камера: 108 + 12 + 8 МП, фронт 32 МП</li><li>Батарея: 5000 мА·ч, зарядка 33 Вт</li></ul>` },
    { id: 'battery', cat: 'Технологии', t: 'Учёные: зарядка до 100% вредит батарее меньше, чем разрядка в ноль', d: 'Исследование 4000 смартфонов показало: идеальный диапазон заряда — от 20 до 80 процентов.', body: '<p>Инженеры изучили деградацию батарей у 4000 устройств и пришли к выводу: главный враг аккумулятора — не «лишний» процент, а полный разряд и перегрев.</p><p>Рекомендации просты: не доводить до 0%, не оставлять на солнцепёке и не играть в тяжёлые игры на зарядке.</p><blockquote>«Если телефон разрядился в ноль — это стресс. Если он на 100% и горячий — это тоже стресс», — отмечают авторы.</blockquote>' },
    { id: 'scam', cat: 'Безопасность', t: 'Новая волна SMS-мошенничества: «вы выиграли приз»', d: 'Жителям рассылают сообщения о выигрыше и просят оплатить «пошлину» в 2,5 евро.', body: '<p>Злоумышленники используют короткие ссылки и ограничивают время: «приз сгорает через 15 минут». Психологи называют это классическим приёмом давления.</p><p>Что делать: не переходить по ссылкам, не вводить данные карты и блокировать номер. Операторы предлагают бесплатную услугу «Антиспам» по команде *111#.</p>' },
    { id: 'weather', cat: 'Город', t: `Погода в Брюсселе: ${t.temp}° и ${t.cond.name.toLowerCase()}`, d: `На неделе температура будет колебаться от ${Math.min(...days(7).map(d=>d.min))}° до ${Math.max(...days(7).map(d=>d.max))}°.`, body: `<p>Сегодня в Брюсселе ${t.temp}°, ${t.cond.name.toLowerCase()}, ветер ${t.wind} м/с, влажность ${t.hum}%. Атмосферное давление ${t.pressure} мм рт. ст.</p><p>Синоптики обещают переменчивую неделю: солнце будет сменяться дождём, а к выходным возможно похолодание.</p><p><a href="#" data-h="weather.nova">Полный прогноз на 7 дней →</a></p>` },
    { id: 'operator', cat: 'Связь', t: `${opName} обновил тарифы: безлимит подешевел`, d: 'Операторы соревнуются за молодых пользователей: больше гигабайт, меньше цена.', body: `<p>Компания ${opName} объявила об обновлении линейки тарифов. Абонентам обещают больше трафика и сохранение текущей цены до конца года.</p><p>Конкуренты уже намекнули на ответные шаги. Пользователям советуют проверять остатки по команде *100#.</p>` },
    { id: 'snake', cat: 'Игры', t: 'Змейка снова в топе: игроки бьют рекорды на новых экранах 120 Гц', d: 'Классическая игра переживает ренессанс — плавная анимация меняет тактику.', body: '<p>После появления дисплеев с частотой 120 Гц классическая «Змейка» стала хитом. Игроки отмечают, что плавность позволяет точнее рассчитывать повороты.</p><p>Мировой рекорд в симуляторе пока составляет 42 очка. Его автор утверждает, что секрет — в движении по спирали.</p><p><a href="#" data-h="nova-search.net/search?q=змейка">Как играть в змейку →</a></p>' }
  ];

  if (path && path.startsWith('tech/nova-x5-pro')) path = 'nova-x5-pro';
  const found = articles.find((a) => path.includes(a.id));
  if (found) {
    p.innerHTML = `
      <a href="#" data-h="novanews.io" class="muted">← Nova Новости</a>
      <p class="muted" style="margin-top:8px">${esc(found.cat)} · ${esc(fmtDateFull())} · 4 мин чтения</p>
      <h1>${esc(found.t)}</h1>
      <div class="hero" style="display:grid;place-items:center;font-size:42px;color:#fff">${found.cat === 'Безопасность' ? '🛡️' : found.cat === 'Игры' ? '🐍' : found.cat === 'Город' ? '🌆' : found.cat === 'Связь' ? '📶' : '📱'}</div>
      ${found.body}
      <hr/>
      <p class="muted" style="font-size:12px">© Nova Новости. Все события вымышлены, совпадения с реальными смартфонами случайны.</p>
      <h3>Читайте также</h3>
      ${articles.filter(a=>a.id!==found.id).slice(0,3).map(a=>`<div class="card"><h4><a href="#" data-h="novanews.io/${a.id}">${esc(a.t)}</a></h4><p class="muted" style="margin:0;font-size:12px">${esc(a.d)}</p></div>`).join('')}
    `;
    view.append(p);
    useData(3);
    return;
  }

  p.innerHTML = `
    <h1 style="font-size:26px">Nova Новости</h1>
    <p class="muted">${esc(fmtDateFull())} · обновлено ${esc(fmtTime())} · ${net.kind === 'wifi' ? 'через Wi-Fi' : 'через мобильную сеть'}</p>
    <hr/>
    ${articles.map((a, i) => `
      <div class="card">
        <p class="muted" style="font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">${esc(a.cat)}${i === 0 ? ' · Главное' : ''}</p>
        <h4><a href="#" data-h="novanews.io/${a.id}">${esc(a.t)}</a></h4>
        <p class="muted" style="margin:4px 0 0;font-size:12.3px">${esc(a.d)}</p>
      </div>`).join('')}
    <div class="card" style="background:#eef2ff">
      <h4>📬 Подписка на рассылку</h4>
      <p class="muted" style="font-size:12px">12 писем в день, 11 из них — про скидки. Подписаться?</p>
      <a class="btn-web" href="#" data-h="novanews.io/subscribe">Подписаться</a> <a class="btn-web gray" href="#" data-h="novanews.io">Не надо</a>
    </div>
  `;
  view.append(p);
}

/* ---------- магазин ---------- */
const SHOP_ITEMS = [
  { id: 'case', name: 'Чехол «Прозрачный»', price: 9.9, emoji: '🧴', cat: 'Аксессуары', desc: 'Не желтеет (обещают). Совместим с NOVA X5 Pro.' },
  { id: 'case2', name: 'Чехол «Карбон»', price: 19.9, emoji: '🖤', cat: 'Аксессуары', desc: 'Строгий, с магнитным креплением. Выглядит дороже, чем стоит.' },
  { id: 'glass', name: 'Защитное стекло 9H', price: 12.5, emoji: '🛡️', cat: 'Аксессуары', desc: 'Выдерживает падение с 1 метра. С двух метров — не проверяли.' },
  { id: 'buds', name: 'Nova Buds Air', price: 49.9, emoji: '🎧', cat: 'Аудио', desc: 'Беспроводные наушники. Появятся в списке Bluetooth-устройств.' },
  { id: 'powerbank', name: 'PowerBank 20 000 мА·ч', price: 34.9, emoji: '🔋', cat: 'Зарядка', desc: 'Заряжает телефон 4 раза. Весит как второй телефон.' },
  { id: 'magsafe', name: 'Беспроводная зарядка MagPad', price: 24.9, emoji: '🧲', cat: 'Зарядка', desc: 'Положил — заряжается. Магия (на самом деле катушка).' },
  { id: 'stick', name: 'Селфи-палка', price: 14.9, emoji: '🤳', cat: 'Фото', desc: 'Для тех, у кого руки короткие, а желания длинные.' },
  { id: 'game', name: '2048 (полная версия)', price: 1.99, emoji: '🔢', cat: 'Игры', desc: 'Без рекламы. Честно.' },
  { id: 'coffee', name: 'Кофе с собой', price: 4.8, emoji: '☕', cat: 'Еда', desc: 'Доставка 20 минут. Бодрость +25.' }
];

function shopPage(view, path) {
  const S = getState();
  const p = el('div', { class: 'webpage' });

  if (path.includes('item/')) {
    const id = path.split('item/')[1].split(/[?/]/)[0];
    const item = SHOP_ITEMS.find((i) => i.id === id);
    if (item) {
      p.innerHTML = `
        <a href="#" data-h="techshop.online" class="muted">← Каталог</a>
        <h1 style="margin-top:10px">${item.emoji} ${esc(item.name)}</h1>
        <div class="hero" style="display:grid;place-items:center;font-size:64px">${item.emoji}</div>
        <p class="price">${fmtMoney(item.price)}</p>
        <p>${esc(item.desc)}</p>
        <ul>
          <li>Категория: ${esc(item.cat)}</li>
          <li>Доставка: курьером за 2 часа или в пункт выдачи</li>
          <li>Гарантия: 12 месяцев</li>
          <li>Рейтинг: ${(4 + (item.price % 1) * 0.9).toFixed(1)} ★ (${rndInt(40, 900)} отзывов)</li>
        </ul>
        <a class="btn-web" href="#" data-buy="${item.id}">Купить за ${fmtMoney(item.price)}</a>
        <a class="btn-web gray" href="#" data-h="techshop.online">Продолжить покупки</a>
        <hr/>
        <h3>Отзывы</h3>
        ${['Всё пришло за день, доволен.', 'Упаковка мятая, но товар целый.', 'Второй раз заказываю здесь — рекомендую.', 'Работает. Что ещё нужно?'].map((r, i) => `<div class="card"><h4>${'★'.repeat(5 - (i % 3))}${'☆'.repeat(i % 3)} Пользователь${i + 1}</h4><p class="muted" style="margin:0;font-size:12.5px">${esc(r)}</p></div>`).join('')}
      `;
      view.append(p);
      bindBuy(p);
      return;
    }
  }

  p.innerHTML = `
    <h1>🛒 TechShop</h1>
    <p class="muted">Аксессуары и техника для вашего NOVA X5 Pro · доставка 2 часа · оплата с карты NovaBank</p>
    <div class="card" style="background:linear-gradient(135deg,#cffafe,#e0f2fe)">
      <h4>🔥 Скидка 15% до конца дня</h4>
      <p class="muted" style="margin:0;font-size:12.5px">На защитные стёкла и чехлы. Промокод применится автоматически.</p>
    </div>
    <p class="muted">Баланс карты: <b>${fmtMoney(S.bank.balance)}</b> · в кошельке: <b>${fmtMoney(S.money)}</b></p>
    <h3>Каталог</h3>
    ${SHOP_ITEMS.map((i) => `
      <div class="card" style="display:flex;gap:12px;align-items:center">
        <div style="width:52px;height:52px;border-radius:14px;background:#f1f5f9;display:grid;place-items:center;font-size:27px;flex:0 0 auto">${i.emoji}</div>
        <div style="flex:1;min-width:0">
          <h4 style="margin:0"><a href="#" data-h="techshop.online/item/${i.id}">${esc(i.name)}</a></h4>
          <p class="muted" style="margin:2px 0 0;font-size:11.5px">${esc(i.cat)} · ${esc(i.desc.slice(0, 46))}…</p>
          <p class="price" style="font-size:15px;margin:5px 0 0">${fmtMoney(i.price)}</p>
        </div>
        <a class="btn-web" href="#" data-buy="${i.id}">Купить</a>
      </div>`).join('')}
    <hr/>
    <p class="muted" style="font-size:12px">Купленные товары появятся в приложении «Файлы» → Загрузки и в галерее (если это чехол — просто в душе).</p>
  `;
  view.append(p);
  bindBuy(p);
}

function bindBuy(p) {
  p.querySelectorAll('a[data-buy]').forEach((a) => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await buyItem(a.dataset.buy);
    });
  });
}

async function buyItem(id) {
  const S = getState();
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return;
  const discount = ['case', 'case2', 'glass'].includes(id) ? 0.85 : 1;
  const price = +(item.price * discount).toFixed(2);
  if (S.bank.balance < price) {
    SFX.error();
    await sysDialog({
      title: 'Недостаточно средств', icon: '💸',
      text: `Цена: <b>${fmtMoney(price)}</b><br/>На карте: <b>${fmtMoney(S.bank.balance)}</b><br/><br/>Пополните карту в приложении NovaBank или переведите наличные из кошелька.`,
      buttons: [{ label: 'Закрыть', value: false }, { label: '💶 Внести наличные', value: 'cash', cls: 'primary' }]
    }).then((v) => {
      if (v === 'cash') {
        const amt = Math.min(S.money, price - S.bank.balance + 5);
        if (amt <= 0) { toast('💶', 'Наличных нет', 'Кошелёк пуст'); return; }
        S.money -= amt; S.bank.balance += amt;
        S.bank.transactions.unshift({ id: uid('tx'), title: 'Внесение наличных', cat: 'Пополнение', amount: amt, at: S.time.gameMs, icon: '💶' });
        save(); emit(EV.MONEY);
        toast('💶', `Внесено ${fmtMoney(amt)}`, 'Теперь можно оплатить покупку');
        buyItem(id);
      }
    });
    return;
  }
  const ok = await sysDialog({
    title: 'Оформить заказ?', icon: item.emoji,
    text: `<b>${esc(item.name)}</b><br/>Цена: <b>${fmtMoney(price)}</b>${discount < 1 ? ' <span style="text-decoration:line-through;opacity:.5">' + fmtMoney(item.price) + '</span> <b style="color:#16a34a">−15%</b>' : ''}<br/>Оплата: карта •••• 7723<br/>Доставка: курьер, ~2 часа`,
    buttons: [{ label: 'Отмена', value: false }, { label: `Оплатить ${fmtMoney(price)}`, value: true, cls: 'primary' }]
  });
  if (!ok) return;

  S.bank.balance -= price;
  S.stats.spent = (S.stats.spent || 0) + price;
  S.bank.transactions.unshift({ id: uid('tx'), title: `TechShop — ${item.name}`, cat: 'Покупки', amount: -price, at: S.time.gameMs, icon: item.emoji });
  S.store.purchases = S.store.purchases || [];
  S.store.purchases.unshift({ ...item, price, at: S.time.gameMs });
  S.files = S.files || [];
  S.files.push({ id: uid('f'), name: `Чек_${item.name.replace(/\s+/g, '_')}.pdf`, type: 'doc', size: 0.12, at: S.time.gameMs, folder: 'Загрузки' });
  if (id === 'buds') {
    const d = S.phone.bt.devices.find((x) => x.id === 'bh1');
    if (d) { d.owned = true; }
    toast('🎧', 'Nova Buds Air куплены', 'Теперь их можно подключить в Настройки → Bluetooth');
  } else {
    toast('🛒', 'Заказ оформлен', `${item.name} · ${fmtMoney(price)} · курьер приедет через 2 часа`);
  }
  S.stats.purchases++;
  unlock('shop');
  if (S.stats.spent >= 100) unlock('rich');
  save();
  emit(EV.MONEY);
  SFX.coin();
  notify({ appId: 'bank', icon: '🛒', color: '#22d3ee', title: `Покупка ${fmtMoney(price)}`, text: `TechShop: ${item.name}. Баланс: ${fmtMoney(S.bank.balance)}`, action: { type: 'app', id: 'bank' } });
  setTimeout(() => {
    window.__sysMsg?.('shop', `Заказ №${rndInt(100000, 999999)} принят: ${item.name}. Курьер будет через 2 часа. Спасибо, что выбрали TechShop!`);
  }, 2500);
  render();
}

/* ---------- вики ---------- */
function wikiPage(view, path) {
  const p = el('div', { class: 'webpage' });
  const topic = path.split('/')[0];
  const WIKI = {
    sim: { t: 'SIM-карта', short: 'Что это, как вставить и почему телефон «не видит сеть»', body: `<p>SIM-карта — это маленький ключ к сети оператора. Без неё телефон умеет только звонить в 112 и фотографировать обои.</p><h3>Как установить</h3><ul><li>Найдите скрепку (она лежит в коробке с телефоном).</li><li>Нажмите скрепкой в маленькое отверстие на боковой грани — лоток выедет.</li><li>Положите SIM-карту в лоток срезанным углом в нужную сторону.</li><li>Задвиньте лоток обратно до щелчка.</li></ul><h3>Если сеть не появилась</h3><ul><li>Проверьте, не включён ли режим полёта (шторка сверху → ✈️).</li><li>Подождите 30 секунд — регистрация в сети не мгновенная.</li><li>Убедитесь, что выбран тариф: у SIM без тарифа сети нет.</li></ul>` },
    battery: { t: 'Литий-ионная батарея', short: 'Почему нельзя разряжать в ноль и греть', body: `<p>Современные смартфоны используют литий-ионные аккумуляторы. Они не любят двух вещей: полного разряда и высокой температуры.</p><h3>Правила долгой жизни батареи</h3><ul><li>Держите заряд в диапазоне 20–80%.</li><li>Не оставляйте телефон на солнце и у батареи отопления.</li><li>Быстрая зарядка греет устройство — это нормально, но играть во время зарядки не стоит.</li><li>Раз в месяц давайте батарее полный цикл.</li></ul><h3>Что расходует заряд</h3><table><tr><th>Экран</th><td>до 60%</td></tr><tr><th>Мобильный интернет</th><td>15–20%</td></tr><tr><th>Камера и игры</th><td>очень много</td></tr><tr><th>Фонарик</th><td>заметно</td></tr><tr><th>Режим полёта</th><td>экономит</td></tr></table>` },
    wifi: { t: 'Wi-Fi', short: 'Диапазоны 2.4 и 5 ГГц, пароли и «сеть не найдена»', body: `<p>Wi-Fi — это домашний интернет без расхода мобильного трафика.</p><h3>2.4 ГГц против 5 ГГц</h3><ul><li>2.4 ГГц: дальнобойнее, но медленнее и забит соседями.</li><li>5 ГГц: быстрее и чище, но хуже проходит через стены.</li></ul><h3>Где взять пароль</h3><p>Обычно он написан на наклейке роутера. В этой игре роутер стоит на столе — кликните по нему.</p><h3>Частые проблемы</h3><ul><li>«Сеть не найдена» — роутер выключен или вы уехали.</li><li>«Неверный пароль» — проверьте раскладку и регистр.</li><li>«Подключено, без доступа в интернет» — классика жанра.</li></ul>` },
    photo: { t: 'Мобильная фотография', short: 'Свет, композиция и почему зум портит кадр', body: `<p>Хороший снимок — это в первую очередь свет. Камера телефона не видит в темноте, она угадывает.</p><h3>Правило третей</h3><p>Включите сетку в камере и ставьте объект на пересечения линий — кадр сразу выглядит осмысленнее.</p><h3>Цифровой зум</h3><p>Это просто обрезка. Лучше подойти ногами.</p><h3>Ночной режим</h3><p>Держите телефон неподвижно 2–3 секунды: алгоритмы склеивают несколько кадров в один светлый.</p>` },
    alarm: { t: 'Будильник', short: 'Как просыпаться и не ненавидеть себя', body: `<p>Будильник — самое честное приложение: оно всегда звонит тогда, когда не хочется.</p><h3>Настройка</h3><ul><li>Откройте «Часы» → «Будильники» → добавьте время.</li><li>Выберите дни повторения.</li><li>Проверьте громкость будильника в шторке.</li></ul><h3>«Ещё 9 минут»</h3><p>Кнопка отложения даёт иллюзию сна: мозг не успевает перейти в глубокую фазу, поэтому просыпаться тяжелее.</p>` },
    scam: { t: 'Мошенничество в SMS', short: 'Как распознать и что делать', body: `<p>Признаки мошеннического сообщения:</p><ul><li>Обещание крупного выигрыша «просто так».</li><li>Ограничение по времени: «осталось 15 минут».</li><li>Короткая ссылка вида bit.ly/…</li><li>Просьба оплатить «пошлину» или «доставку».</li><li>Незнакомый номер, часто международный.</li></ul><h3>Что делать</h3><p>Не переходить по ссылкам, не вводить данные карты, заблокировать номер в мессенджере (долгое нажатие на чат → Заблокировать).</p>` },
    snake: { t: 'Змейка', short: 'Игра, которая старше большинства пользователей', body: `<p>«Змейка» появилась в телефонах в 1997 году и с тех пор не изменилась — потому что менять нечего.</p><h3>Тактика</h3><ul><li>Держитесь краёв поля и двигайтесь по спирали к центру.</li><li>Не отрезайте себе выход в тупик.</li><li>После 30 очков скорость растёт — планируйте заранее.</li></ul><p>Игра предустановлена на вашем NOVA X5 Pro. Рекорд разработчика — 42.</p>` }
  };
  const art = WIKI[topic];
  if (art) {
    p.innerHTML = `<a href="#" data-h="wiki.nova" class="muted">← NovaWiki</a><h1 style="margin-top:8px">${esc(art.t)}</h1><p class="muted">Материал из свободной энциклопедии симулятора</p><hr/>${art.body}<hr/><p class="muted" style="font-size:12px">Последнее изменение: сегодня. Автор: коллектив NovaWiki.</p>`;
  } else {
    p.innerHTML = `<h1>NovaWiki</h1><p class="muted">Свободная энциклопедия симулятора. Здесь объясняют то, что можно было бы не объяснять.</p>
      <h3>Популярные статьи</h3>
      ${Object.entries(WIKI).map(([k, v]) => `<div class="card"><h4><a href="#" data-h="wiki.nova/${k}">${esc(v.t)}</a></h4><p class="muted" style="margin:0;font-size:12.3px">${esc(v.short)}</p></div>`).join('')}`;
  }
  view.append(p);
  useData(2);
}

/* ---------- банк ---------- */
function bankPage(view) {
  const S = getState();
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <h1>🏦 NovaBank Online</h1>
    <p class="muted">Личная веб-версия. Приложение удобнее, но и здесь работает.</p>
    <div class="card" style="background:linear-gradient(135deg,#dcfce7,#ecfdf5)">
      <p class="muted" style="margin:0 0 4px">Баланс карты •••• 7723</p>
      <p class="price" style="margin:0">${fmtMoney(S.bank.balance)}</p>
      <p class="muted" style="margin:6px 0 0;font-size:12px">Наличные в кошельке: ${fmtMoney(S.money)}</p>
    </div>
    <h3>Последние операции</h3>
    <table>
      <tr><th>Операция</th><th>Дата</th><th style="text-align:right">Сумма</th></tr>
      ${S.bank.transactions.slice(0, 8).map(t => `<tr><td>${esc(t.title)}</td><td class="muted">${esc(fmtTime(new Date(t.at)))}</td><td style="text-align:right;color:${t.amount > 0 ? '#16a34a' : '#dc2626'};font-weight:700">${t.amount > 0 ? '+' : ''}${fmtMoney(t.amount)}</td></tr>`).join('')}
    </table>
    <div class="card">
      <h4>💳 Внести наличные на карту</h4>
      <p class="muted" style="font-size:12.3px">Переложить деньги из кошелька (на столе) на карту.</p>
      <a class="btn-web" href="#" data-cash="1">Внести 10 €</a> <a class="btn-web gray" href="#" data-cash="2">Внести всё</a>
    </div>
    <div class="card">
      <h4>📱 Оплата мобильной связи</h4>
      <p class="muted" style="font-size:12.3px">${S.phone.sim.operator ? `${S.phone.sim.number} · ${OPERATORS[S.phone.sim.operator].name}` : 'SIM-карта не установлена'}</p>
      ${S.phone.sim.operator ? `<a class="btn-web" href="#" data-mobile="5">Пополнить на 5 €</a>` : ''}
    </div>
    <p class="muted" style="font-size:11.5px">Полноценные переводы и история — в приложении NovaBank.</p>
  `;
  view.append(p);
  p.querySelectorAll('a[data-cash]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    const all = a.dataset.cash === '2';
    const amt = all ? S.money : Math.min(10, S.money);
    if (amt <= 0) { toast('💶', 'В кошельке пусто', 'Наличные закончились'); return; }
    S.money -= amt; S.bank.balance += amt;
    S.bank.transactions.unshift({ id: uid('tx'), title: 'Внесение наличных', cat: 'Пополнение', amount: amt, at: S.time.gameMs, icon: '💶' });
    save(); emit(EV.MONEY); SFX.coin();
    toast('💶', `Внесено ${fmtMoney(amt)}`, `Баланс карты: ${fmtMoney(S.bank.balance)}`);
    render();
  }));
  p.querySelectorAll('a[data-mobile]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault();
    const amt = 5;
    if (S.bank.balance < amt) { toast('💸', 'Недостаточно средств', ''); return; }
    S.bank.balance -= amt;
    S.phone.data.limitGb += 5;
    S.bank.transactions.unshift({ id: uid('tx'), title: 'Пополнение счёта мобильного', cat: 'Связь', amount: -amt, at: S.time.gameMs, icon: '📱' });
    save(); emit(EV.MONEY); SFX.coin();
    toast('📱', 'Счёт пополнен', `${fmtMoney(amt)} · пакет интернета увеличен на 5 ГБ`);
    window.__sysMsg?.('operator', `Ваш счёт пополнен на ${amt.toFixed(2)} €. Добавлено 5 ГБ интернета. Спасибо!`);
    render();
  }));
}

/* ---------- мемы ---------- */
function memesPage(view) {
  const S = getState();
  const p = el('div', { class: 'webpage' });
  const memes = [
    { t: 'Когда батарея 1%, а ты ещё не поставил зарядку', e: '🪫', up: rndInt(200, 9000) },
    { t: 'Снял защитную плёнку с нового телефона', e: '😌', up: rndInt(2000, 20000) },
    { t: '99+ уведомлений, а ты просто хотел посмотреть время', e: '🔔', up: rndInt(100, 4000) },
    { t: 'Ищу скрепку для SIM-лотка в 2 часа ночи', e: '📎', up: rndInt(300, 5000) },
    { t: '«Ещё 9 минут» — я, каждые 9 минут', e: '⏰', up: rndInt(500, 7000) },
    { t: 'Мама: не сиди в телефоне. Тоже мама: а что за приложение?', e: '📱', up: rndInt(900, 12000) }
  ];
  p.innerHTML = `
    <h1>😂 Мемы 24/7</h1>
    <p class="muted">Лучшее за сегодня · лента обновляется, когда вы не смотрите</p>
    ${memes.map((m, i) => `
      <div class="card">
        <div class="hero" style="height:150px;display:grid;place-items:center;font-size:66px;background:linear-gradient(135deg,hsl(${i * 57} 70% 88%),hsl(${i * 57 + 40} 70% 78%))">${m.e}</div>
        <h4 style="margin:10px 0 4px">${esc(m.t)}</h4>
        <p class="muted" style="font-size:12px;margin:0">▲ ${m.up.toLocaleString('ru-RU')} · 💬 ${rndInt(10, 900)} · ${esc(fmtTime())}</p>
        <div style="margin-top:9px;display:flex;gap:7px">
          <a class="btn-web gray" href="#" data-like="${i}">👍 Лайк</a>
          <a class="btn-web gray" href="#" data-share="${i}">↗ Поделиться</a>
        </div>
      </div>`).join('')}
  `;
  view.append(p);
  p.querySelectorAll('a[data-like]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault(); a.textContent = '❤️ Лайкнуто'; a.removeAttribute('data-like');
    SFX.tap(); toast('👍', 'Лайк поставлен', 'Автор мема где-то улыбнулся');
  }));
  p.querySelectorAll('a[data-share]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    toast('↗', 'Поделиться', 'Ссылка скопирована — можно отправить в мессенджер');
  }));
}

/* ---------- погода ---------- */
function weatherPage(view) {
  const t = today();
  const ds = days(7);
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <h1>🌤️ Погода · ${esc(t.city)}</h1>
    <p class="muted">${esc(fmtDateFull())} · обновлено ${esc(fmtTime())}</p>
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#dbeafe,#eff6ff)">
      <div style="font-size:54px">${t.cond.icon}</div>
      <div style="font-size:44px;font-weight:200">${t.temp}°</div>
      <div>${esc(t.cond.name)} · ощущается как ${t.feels}°</div>
      <div class="muted" style="font-size:12px;margin-top:6px">макс ${t.max}° · мин ${t.min}° · ветер ${t.wind} м/с · влажность ${t.hum}% · УФ ${t.uv}</div>
    </div>
    <h3>На 7 дней</h3>
    <table>
      <tr><th>День</th><th></th><th style="text-align:right">Мин / Макс</th><th style="text-align:right">Дождь</th></tr>
      ${ds.map(d => `<tr><td>${esc(d.label)}</td><td style="font-size:19px">${d.cond.icon}</td><td style="text-align:right">${d.min}° / ${d.max}°</td><td style="text-align:right" class="muted">${d.rain}%</td></tr>`).join('')}
    </table>
    <p class="muted" style="font-size:12px">Восход ${esc(t.sunrise)} · закат ${esc(t.sunset)} · давление ${t.pressure} мм · видимость ${t.visibility} км</p>
    <a class="btn-web" href="#" data-h="nova-search.net/search?q=погода">Искать прогноз</a>
  `;
  view.append(p);
}

/* ---------- скам / редирект ---------- */
function redirectPage(view, path) {
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <h1>🔗 Перенаправление…</h1>
    <p class="muted">bit.ly/${esc(path)} — короткая ссылка. Куда она ведёт, обычно неизвестно.</p>
    <div class="card" style="background:#fef2f2;border-color:#fecaca">
      <h4>⚠️ Осторожно</h4>
      <p style="font-size:12.8px;margin:0">Короткие ссылки часто используются в спам-рассылках. Браузер предупреждает: содержимое может быть небезопасным.</p>
    </div>
    <a class="btn-web" href="#" data-h="bit.ly/${esc(path)}/go">Всё равно перейти</a>
    <a class="btn-web gray" href="#" data-h="nova://start">На стартовую</a>
  `;
  if (path.includes('/go')) scamPage(view, 'bit.ly/' + path);
  else view.append(p);
}

function scamPage(view, url) {
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <div style="background:linear-gradient(135deg,#fde047,#f97316);color:#111;padding:22px;border-radius:14px;text-align:center">
      <div style="font-size:48px">🎉</div>
      <h1 style="color:#111;font-size:22px">ПОЗДРАВЛЯЕМ!<br/>Вы выиграли приз!</h1>
      <p style="font-size:13px;margin:0">Осталось <b id="cnt">14:59</b> — потом приз уйдёт другому</p>
    </div>
    <div class="card" style="margin-top:14px">
      <h4>Чтобы получить iPhone, оплатите доставку 2,50 €</h4>
      <p class="muted" style="font-size:12.5px">Введите данные карты: номер, срок, CVV и пароль из SMS. (Так делают только мошенники.)</p>
      <input class="sysdialog__input" style="background:#f1f5f9;color:#111;border-color:#cbd5e1" placeholder="Номер карты" />
      <a class="btn-web" href="#" data-pay="1" style="margin-top:10px">Оплатить 2,50 € и забрать приз</a>
    </div>
    <div class="card" style="background:#eff6ff;border-color:#bfdbfe">
      <h4>🛡️ Браузер предупреждает</h4>
      <p style="font-size:12.5px;margin:0">Этот сайт помечен как мошеннический. Признаки: таймер обратного отсчёта, просьба оплатить «доставку приза», короткая ссылка из SMS. <a href="#" data-h="wiki.nova/scam">Подробнее →</a></p>
      <a class="btn-web gray" href="#" data-block="1" style="margin-top:10px">🚫 Заблокировать сайт и номер отправителя</a>
    </div>
  `;
  view.append(p);
  let sec = 14 * 60 + 59;
  const cnt = p.querySelector('#cnt');
  const timer = setInterval(() => {
    sec--;
    if (sec <= 0 || !document.body.contains(p)) { clearInterval(timer); return; }
    cnt.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }, 1000);
  p.querySelector('a[data-pay]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    await sysDialog({
      title: '💸 Стоп!', icon: '🛑',
      text: 'Это мошенники. Никакого приза нет.<br/><br/>В реальной жизни после ввода данных карты деньги уходят в течение минут. Никогда не вводите данные карты на сайтах из SMS.',
      buttons: [{ label: 'Понятно, закрываю', value: true, cls: 'primary' }]
    });
    go('nova://start');
  });
  p.querySelector('a[data-block]')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const S = getState();
    const spam = S.contacts.find((c) => c.id === 'spam');
    if (spam) spam.blocked = true;
    unlock('spam');
    save();
    toast('🚫', 'Сайт заблокирован', 'Номер спамера тоже заблокирован. Отличная работа!');
    go('nova://start');
  });
}

function blockedPage(view, url) {
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <div class="card" style="background:#fef2f2;border-color:#fecaca;text-align:center">
      <div style="font-size:44px">🔞</div>
      <h1 style="font-size:19px;color:#111">Сайт заблокирован</h1>
      <p class="muted" style="font-size:12.8px">Родительский контроль NovaOS не разрешает открывать этот адрес.<br/>Отключить контроль можно в Настройки → Цифровое благополучие. Но зачем?</p>
      <a class="btn-web" href="#" data-h="nova://start">Вернуться на стартовую</a>
    </div>`;
  view.append(p);
}

function notFoundPage(view, url) {
  const p = el('div', { class: 'webpage' });
  const host = url.split('/')[0];
  p.innerHTML = `
    <div class="no-net" style="padding:40px 20px">
      <div class="big">🌐</div>
      <h2>${esc(host)}</h2>
      <p>Страница не найдена (404). В этом симуляторе работают только несколько сайтов: nova-search.net, novanews.io, techshop.online, wiki.nova, bank.nova, memes.nova и weather.nova.</p>
      <a class="btn-web" href="#" data-h="nova-search.net/search?q=${encodeURIComponent(host)}">Найти «${esc(host)}» в поиске</a>
      <a class="btn-web gray" href="#" data-h="nova://start">На стартовую</a>
    </div>`;
  view.append(p);
}

/* ---------- нет интернета ---------- */
function noNetPage(view, net) {
  const p = el('div', { class: 'webpage' });
  p.innerHTML = `
    <div class="no-net">
      <div class="big">📡</div>
      <h2>Нет подключения к интернету</h2>
      <p>${esc(net.why)}.</p>
      <div class="dino"><div class="dino__g"></div><div class="dino__d">🦖</div><div class="dino__c">☁️</div><div class="dino__c" style="animation-delay:1.4s">☁️</div></div>
      <p class="muted" style="margin-top:14px;font-size:12px">Пока интернета нет, можно поиграть в змейку (она офлайн) или сделать фото.</p>
    </div>
    <div class="card" style="margin-top:6px">
      <h4>Как исправить</h4>
      <ul style="font-size:12.8px">
        ${net.fix === 'airplane' ? '<li>Выключите <b>режим полёта</b> — шторка сверху → ✈️</li>' : ''}
        ${net.fix === 'sim' ? '<li>Установите <b>SIM-карту</b>: скрепка → лоток → SIM → задвинуть</li>' : ''}
        ${net.fix === 'wifi' ? '<li>Подключитесь к <b>Wi-Fi</b>: Настройки → Wi-Fi → Home_Nova_5G (пароль на роутере)</li>' : ''}
        <li>Или включите <b>мобильные данные</b> в шторке</li>
      </ul>
      <a class="btn-web" href="#" data-fix="1">⚙️ Открыть сетевые настройки</a>
    </div>`;
  view.append(p);
  p.querySelector('a[data-fix]')?.addEventListener('click', (e) => { e.preventDefault(); api.openApp('settings', { page: 'network' }); });
}
