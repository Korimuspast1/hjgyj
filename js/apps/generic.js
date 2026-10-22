import { getState, save } from '../state.js';
import { el, clear, fmtTime } from '../util.js';
import { ICON } from '../icons.js';
import { STORE_CATALOG } from '../registry.js';
import { SFX } from '../audio.js';

// Универсальное приложение-заглушка для программ из Nova Store
export function mount(root, api, params) {
  const meta = STORE_CATALOG.find((a) => a.id === params.appId) || { name: params.appId, emoji: '📱', color: '#38bdf8', cat: 'Программы', desc: '' };
  root.className = 'app theme-dark';
  root.style.setProperty('--accent-app', meta.color);

  const bar = el('div', { class: 'appbar' });
  const back = el('button', { class: 'iconbtn', onclick: () => api.back() });
  back.innerHTML = ICON.back();
  bar.append(back, el('h1', {}, el('span', { text: meta.name })));
  root.append(bar);

  const body = el('div', { class: 'appbody' });
  body.append(
    el('div', { style: { textAlign: 'center', padding: '26px 20px 10px' } },
      el('div', {
        style: {
          width: '86px', height: '86px', margin: '0 auto', borderRadius: '24px',
          background: `linear-gradient(135deg, ${meta.color}, #1e293b)`,
          display: 'grid', placeItems: 'center', fontSize: '42px',
          boxShadow: '0 18px 34px -16px #000, inset 0 1px 0 rgba(255,255,255,.3)'
        }, text: meta.emoji
      }),
      el('h2', { style: { fontSize: '19px', marginTop: '16px' }, text: meta.name }),
      el('p', { style: { fontSize: '12px', opacity: '.55', marginTop: '4px' }, text: `${meta.cat} · установлено из Nova Store` })
    ),
    el('div', { style: { padding: '8px 18px 20px' } },
      el('p', { style: { fontSize: '13px', lineHeight: '1.65', opacity: '.8' }, text: meta.desc || 'Приложение работает.' }),
      el('div', { class: 'card', style: { marginTop: '14px', padding: '14px', borderRadius: '16px', background: 'rgba(255,255,255,.06)', fontSize: '12.5px', lineHeight: '1.7' } },
        el('div', { text: '✅ Загружено из Nova Store' }),
        el('div', { text: `🕒 Установлено: ${fmtTime()}` }),
        el('div', { text: '📦 Размер: ' + (meta.size || 10) + ' МБ' }),
        el('div', { text: '⭐ Рейтинг: ' + (meta.rating || 4.0) })
      ),
      el('div', { style: { marginTop: '16px', padding: '14px', borderRadius: '16px', background: 'rgba(56,189,248,.1)', border: '1px solid rgba(56,189,248,.2)', fontSize: '12.3px', lineHeight: '1.6' } },
        el('div', { text: '💡 Это демо-версия симулятора.' }),
        el('div', { style: { opacity: '.75', marginTop: '4px' }, text: 'Полноценно работают: Сообщения, Телефон, Браузер, Камера, Галерея, Настройки, Музыка, Часы, Калькулятор, Заметки, Погода, NovaBank, Файлы, Змейка, Радио, Диктофон и Уровень.' })
      ),
      el('button', {
        class: 'btn btn--ghost', style: { marginTop: '16px', width: '100%' }, text: '🔄 Проверить обновления',
        onclick: (e) => {
          const b = e.currentTarget;
          b.textContent = 'Поиск обновлений…';
          SFX.tap();
          setTimeout(() => { b.textContent = '✅ У вас последняя версия'; }, 900);
        }
      })
    )
  );
  root.append(body);
  return {};
}
