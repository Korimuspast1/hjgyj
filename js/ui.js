import { getState, save } from './state.js';
import { clear, el } from './util.js';
import { ICON } from './icons.js';
import { SFX } from './audio.js';

/* ================= ТОСТ (мир игры) ================= */
let toastEl, toastTimer, toastQueue = [];
export function initToast() { toastEl = document.getElementById('toast'); }

export function toast(icon, title, text, ms = 3200) {
  if (!toastEl) return;
  toastQueue.push({ icon, title, text, ms });
  if (toastEl.classList.contains('show')) return;
  nextToast();
}
function nextToast() {
  const n = toastQueue.shift();
  if (!n) return;
  clear(toastEl);
  toastEl.append(
    el('div', { class: 'toast__ico', text: n.icon }),
    el('div', { class: 'toast__txt' }, el('b', { text: n.title }), n.text ? el('span', { text: n.text }) : null)
  );
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(nextToast, 380);
  }, n.ms);
}

/* ================= КОУЧМАРК ================= */
const coach = document.getElementById('coachmark');
const coachText = document.getElementById('coachmark-text');
export function coachmark(text, target, opts = {}) {
  if (!coach) return;
  coachText.textContent = text;
  coach.hidden = false;
  const place = () => {
    const r = target ? target.getBoundingClientRect() : null;
    if (!r) {
      coach.style.left = '50%'; coach.style.top = '80px'; coach.style.transform = 'translateX(-50%)';
      return;
    }
    const w = 320;
    let left = r.left + r.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - w - 12));
    let top = r.bottom + 16;
    let flip = false;
    if (top + 120 > window.innerHeight) { top = r.top - 16; flip = true; }
    coach.style.left = left + 'px';
    coach.style.top = flip ? '' : top + 'px';
    coach.style.bottom = flip ? (window.innerHeight - top) + 'px' : '';
    coach.style.transform = 'none';
    const arrow = coach.querySelector('.coachmark__arrow');
    if (arrow) {
      arrow.style.left = Math.max(14, Math.min(w - 24, r.left + r.width / 2 - left)) + 'px';
      arrow.style.top = flip ? '' : '-8px';
      arrow.style.bottom = flip ? '-8px' : '';
      arrow.style.transform = flip ? 'rotate(45deg)' : 'rotate(225deg)';
    }
  };
  place();
  window.addEventListener('resize', place);
  coach._cleanup = () => { window.removeEventListener('resize', place); coach.hidden = true; };
  if (opts.auto) setTimeout(() => hideCoach(), opts.auto);
}
export function hideCoach() {
  if (coach && !coach.hidden) { coach._cleanup?.(); coach.hidden = true; }
}
document.getElementById('coachmark-ok')?.addEventListener('click', hideCoach);

/* ================= СИСТЕМНЫЙ ДИАЛОГ (внутри экрана) ================= */
export function sysDialog(opts) {
  return new Promise((resolve) => {
    const S = getState();
    const syslayer = document.getElementById('syslayer');
    const {
      title = '', text = '', icon = '', input = null, inputType = 'text',
      buttons = [{ label: 'ОК', value: true, cls: 'primary' }],
      dismissible = true, wide = false
    } = opts;

    const backdrop = el('div', { class: 'sysdialog-backdrop' });
    const box = el('div', { class: 'sysdialog', style: wide ? { maxWidth: '330px' } : {} });
    const body = el('div', { class: 'sysdialog__body' });
    if (icon) body.append(el('div', { class: 'sysdialog__ico', text: icon }));
    if (title) body.append(el('div', { class: 'sysdialog__title', text: title }));
    if (text) body.append(el('div', { class: 'sysdialog__text', html: text }));
    let inputEl = null;
    if (input) {
      inputEl = el('input', {
        class: 'sysdialog__input', type: inputType, placeholder: input.placeholder || '',
        value: input.value || '', maxlength: input.maxlength || 64
      });
      body.append(inputEl);
    }
    if (opts.custom) body.append(opts.custom);
    box.append(body);

    const actions = el('div', { class: 'sysdialog__actions' });
    buttons.forEach((b) => {
      actions.append(el('button', {
        class: b.cls || '', text: b.label,
        onclick: () => { SFX.click(); close(b.value); }
      }));
    });
    box.append(actions);
    backdrop.append(box);
    if (dismissible) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) { SFX.back(); close(null); } });
    syslayer.append(backdrop);
    setTimeout(() => inputEl?.focus(), 60);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { SFX.click(); close(inputEl.value); }
    });

    function close(v) {
      backdrop.remove();
      resolve(typeof v === 'string' || (inputEl && v === true) ? (inputEl?.value ?? v) : v);
    }
  });
}

export function sysPrompt(title, text, placeholder = '', value = '') {
  return sysDialog({ title, text, input: { placeholder, value }, buttons: [{ label: 'Отмена', value: false }, { label: 'ОК', value: true, cls: 'primary' }] });
}
export function sysConfirm(title, text, okLabel = 'Да', danger = false) {
  return sysDialog({
    title, text,
    buttons: [{ label: 'Отмена', value: false }, { label: okLabel, value: true, cls: danger ? 'danger' : 'primary' }]
  });
}
export function sysAlert(title, text, icon = '') {
  return sysDialog({ title, text, icon, buttons: [{ label: 'ОК', value: true, cls: 'primary' }] });
}

/* ================= МОДАЛКА МИРА (помощь) ================= */
export function worldModal(html, title = 'Как играть') {
  const root = document.getElementById('modal-root');
  const backdrop = el('div', { class: 'modal-backdrop' });
  const m = el('div', { class: 'modal' });
  m.innerHTML = `<h2>${title}</h2>${html}`;
  const actions = el('div', { class: 'modal__actions' });
  actions.append(el('button', { class: 'btn btn--primary', text: 'Понятно', onclick: close }));
  m.append(actions);
  backdrop.append(m);
  root.append(backdrop);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  function close() { backdrop.remove(); }
  return close;
}

/* Модальное окно мира с выбором (проміс) */
export function worldChoice({ title, text, options, okLabel = 'Выбрать', cancelLabel = 'Позже', dismissible = true }) {
  return new Promise((resolve) => {
    const root = document.getElementById('modal-root');
    const backdrop = el('div', { class: 'modal-backdrop' });
    const m = el('div', { class: 'modal' });
    m.append(el('h2', { text: title }));
    if (text) m.append(el('p', { text }));
    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '9px', margin: '6px 0 4px' } });
    let sel = null;
    const nodes = options.map((o) => {
      const n = el('div', { class: 'opt', style: { color: '#e8edf7' }, onclick: () => {
        nodes.forEach((x) => { x.classList.remove('sel'); x.querySelector('.o-chk').textContent = ''; });
        n.classList.add('sel'); n.querySelector('.o-chk').textContent = '✓';
        sel = o.id; SFX.tap();
      } },
        el('div', { class: 'o-ico', text: o.icon || '•' }),
        el('div', { class: 'o-t' }, el('b', { text: o.title }), o.sub ? el('span', { text: o.sub }) : null),
        el('div', { class: 'o-chk' })
      );
      wrap.append(n);
      return n;
    });
    m.append(wrap);
    const actions = el('div', { class: 'modal__actions' });
    actions.append(el('button', { class: 'btn btn--ghost', text: cancelLabel, onclick: () => close(null) }));
    actions.append(el('button', { class: 'btn btn--primary', text: okLabel, onclick: () => close(sel) }));
    m.append(actions);
    backdrop.append(m);
    root.append(backdrop);
    if (dismissible) backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(null); });
    function close(v) { backdrop.remove(); resolve(v); }
  });
}

/* ================= ПЕРЕКЛЮЧАТЕЛЬ / СТРОКИ ================= */
export function switchEl(on, onChange) {
  const n = el('div', { class: 'switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(!!on) });
  n.addEventListener('click', (e) => {
    e.stopPropagation();
    SFX.tap();
    const next = !n.classList.contains('on');
    n.classList.toggle('on', next);
    n.setAttribute('aria-checked', String(next));
    onChange(next);
  });
  n.sync = (v) => n.classList.toggle('on', !!v);
  return n;
}

export function row({ icon, iconBg, title, sub, right, onClick, cls = '' }) {
  const r = el('div', { class: 'list__row ' + cls, onclick: onClick });
  if (icon !== undefined && icon !== null) {
    r.append(iconBg
      ? el('div', { class: 'set-row-ico', style: { background: iconBg }, text: icon })
      : (typeof icon === 'string' && icon.startsWith('<svg')
        ? el('div', { class: 'set-row-ico', html: icon, style: { background: iconBg || 'rgba(255,255,255,.1)' } })
        : el('div', { class: 'set-row-ico', text: icon, style: { background: iconBg || 'rgba(255,255,255,.1)' } })));
  }
  const g = el('div', { class: 'grow' });
  g.append(el('div', { class: 't1', text: title }));
  if (sub) g.append(el('div', { class: 't2', text: sub }));
  r.append(g);
  if (right) r.append(right);
  return r;
}

export function chev() { return el('div', { class: 't3', html: ICON.chevR(), style: { display: 'flex', opacity: '.4' } }); }

/* ================= АВАТАР ================= */
export function avatar(contact, size = '') {
  const label = contact.initials || (contact.name || '?')[0];
  const a = el('div', {
    class: 'avatar ' + size,
    style: { background: `linear-gradient(135deg, ${contact.color}, ${shadeColor(contact.color, -35)})` },
    text: String(label).slice(0, 2)
  });
  if (contact.online === 'в сети') a.append(el('i', { class: 'online' }));
  return a;
}
export function shadeColor(hex, amt) {
  const c = hex.replace('#', '');
  const num = parseInt(c.length === 3 ? c.split('').map((x) => x + x).join('') : c, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
