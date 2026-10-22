import { getState, save } from '../state.js';
import { api } from '../api.js';
import { ICON } from '../icons.js';
import { el, clear, pad2, fmtTime, fmtDateFull, hash, rndInt } from '../util.js';
import { today, hours, days, tempRange } from '../weather.js';
import { SFX } from '../audio.js';
import { toast } from '../ui.js';
import { hasInternet } from '../net.js';

let inst = null;

export function mount(root, a) {
  inst = { root, api: a };
  render();
  return {
    onFocus() { render(); },
    onUnmount() { inst = null; }
  };
}

function render() {
  if (!inst) return;
  const S = getState();
  const t = today();
  const pod = new Date(S.time.gameMs).getHours();
  clear(inst.root);
  inst.root.className = 'app weather' + (pod >= 21 || pod < 6 ? ' night' : '') + (['rain', 'storm', 'drizzle'].includes(t.cond.id) ? ' rain' : '');
  inst.root.style.setProperty('--app-ink', '#fff');

  const net = hasInternet();

  const body = el('div', { class: 'appbody', style: { position: 'relative', overflow: 'hidden' } });

  if (['rain', 'storm', 'drizzle'].includes(t.cond.id)) {
    for (let i = 0; i < 40; i++) {
      const d = el('i', { class: 'raindrop' });
      d.style.left = (i * 2.6) + '%';
      d.style.top = (-rndInt(0, 400)) + 'px';
      d.style.animationDuration = (0.6 + (i % 5) * 0.16) + 's';
      d.style.animationDelay = (i * 0.07) + 's';
      body.append(d);
    }
  }

  body.append(el('div', { class: 'wx-hero' },
    el('div', { class: 'wx-c', text: `${t.city} · ${fmtDateFull()}` }),
    el('div', { class: 'wx-ico', text: t.cond.icon }),
    el('div', { class: 'wx-t', text: `${t.temp}°` }),
    el('div', { class: 'wx-d', text: t.cond.name }),
    el('div', { class: 'wx-c', text: `ощущается как ${t.feels}° · макс ${t.max}° · мин ${t.min}°` })
  ));

  body.append(el('div', { class: 'wx-stats' },
    stat('💨', 'Ветер', `${t.wind} м/с`),
    stat('💧', 'Влажн.', `${t.hum}%`),
    stat('🌡️', 'Давл.', `${t.pressure}`),
    stat('☀️', 'УФ', `${t.uv}`)
  ));

  if (!net.ok) {
    body.append(el('div', { style: { margin: '0 14px 14px', padding: '11px 13px', borderRadius: '14px', background: 'rgba(251,191,36,.16)', border: '1px solid rgba(251,191,36,.3)', fontSize: '12px' },
      text: `⚠️ ${net.why}. Показан кэш последней загрузки.` }));
  }

  body.append(el('div', { style: { padding: '0 14px 6px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', opacity: '.6' }, text: 'Почасовой прогноз' }));
  const hw = el('div', { class: 'wx-hours' });
  hours(0).forEach((h) => {
    hw.append(el('div', { class: 'wx-hour' },
      el('div', { class: 'h', text: h.h }),
      el('div', { class: 'i', text: h.icon }),
      el('div', { class: 't', text: h.t + '°' }),
      el('div', { style: { fontSize: '9.5px', opacity: '.6' }, text: h.rain + '%' })));
  });
  body.append(hw);

  body.append(el('div', { style: { padding: '8px 14px 6px', fontSize: '11.5px', letterSpacing: '.06em', textTransform: 'uppercase', opacity: '.6' }, text: 'На 7 дней' }));
  const dw = el('div', { class: 'wx-days' });
  const range = tempRange();
  days(7).forEach((d) => {
    const left = ((d.min - range.min) / (range.max - range.min)) * 100;
    const width = ((d.max - d.min) / (range.max - range.min)) * 100;
    dw.append(el('div', { class: 'wx-day' },
      el('div', { class: 'dn', text: d.label }),
      el('div', { class: 'di', text: d.cond.icon }),
      el('div', { style: { fontSize: '11px', opacity: '.6', width: '30px' }, text: d.min + '°' }),
      el('div', { class: 'dbar' }, el('i', { style: { left: left + '%', width: Math.max(8, width) + '%' } })),
      el('div', { class: 'dt', html: `<b>${d.max}°</b> <span>· ${d.rain}%</span>` })));
  });
  body.append(dw);

  body.append(el('div', { class: 'list', style: { marginTop: '6px' } },
    infoRow('🌅', 'Восход', t.sunrise),
    infoRow('🌇', 'Закат', t.sunset),
    infoRow('👁️', 'Видимость', `${t.visibility} км`),
    infoRow('🌙', 'Фаза луны', moonPhase())
  ));

  body.append(el('div', { style: { padding: '14px 16px 26px' } },
    el('button', { class: 'btn btn--ghost', style: { width: '100%', background: 'rgba(255,255,255,.12)' }, text: '📍 Сменить город', onclick: () => changeCity() })));

  inst.root.append(body);
}

function stat(icon, label, value) {
  return el('div', { class: 'wx-stat' }, el('div', { class: 'l', text: label }), el('div', { style: { fontSize: '17px', margin: '3px 0 1px' }, text: icon }), el('div', { class: 'v', text: value }));
}
function infoRow(icon, title, value) {
  return el('div', { class: 'list__row', style: { background: 'rgba(255,255,255,.08)', borderRadius: '14px', margin: '0 14px 7px' } },
    el('div', { style: { fontSize: '19px' }, text: icon }),
    el('div', { class: 'grow' }, el('div', { class: 't1', text: title })),
    el('div', { style: { fontSize: '13.5px', opacity: '.85' }, text: value }));
}

function moonPhase() {
  const S = getState();
  const day = Math.floor(S.time.gameMs / 86400000);
  const phases = ['🌑 Новолуние', '🌒 Растущий серп', '🌓 Первая четверть', '🌔 Растущая луна', '🌕 Полнолуние', '🌖 Убывающая луна', '🌗 Последняя четверть', '🌘 Убывающий серп'];
  return phases[day % 8];
}

async function changeCity() {
  const S = getState();
  const cities = ['Брюссель', 'Антверпен', 'Гент', 'Париж', 'Амстердам', 'Киев', 'Лондон'];
  const { sysDialog } = await import('../ui.js');
  const res = await sysDialog({
    title: 'Выбор города', icon: '📍',
    text: 'Прогноз в игре генерируется по дате — погода везде разная.',
    buttons: cities.slice(0, 3).map((c) => ({ label: c, value: c })).concat([{ label: 'Ещё…', value: 'more' }, { label: 'Отмена', value: null }])
  });
  let city = res;
  if (res === 'more') {
    city = await sysDialog({ title: 'Ещё города', icon: '📍', text: '', buttons: cities.slice(3).map((c) => ({ label: c, value: c })).concat([{ label: 'Отмена', value: null }]) });
  }
  if (!city) return;
  S.weather.city = city;
  S.weather.seed = hash(city) % 100000;
  save();
  SFX.tap();
  render();
  toast('📍', 'Город изменён', city);
}
