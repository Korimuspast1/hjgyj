import { getState, save } from '../state.js';
import { el, clear, fmtMoney } from '../util.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { toast } from '../ui.js';

let inst = null, cur = '0', expr = '', op = null, prev = null, justEvaluated = false, showHist = false;

export function mount(root, a) {
  inst = { root, api: a };
  const S = getState();
  root.className = 'app calc theme-dark';
  render();
  return {
    onBack() {
      if (showHist) { showHist = false; render(); return true; }
      if (cur !== '0' || expr) { clearAll(); render(); return true; }
      return false;
    },
    onUnmount() { inst = null; }
  };
}

function clearAll() { cur = '0'; expr = ''; op = null; prev = null; justEvaluated = false; }

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar' }, el('h1', {}, el('span', { text: 'Калькулятор' })));
  const acts = el('div', { class: 'appbar__actions' });
  const histBtn = el('button', { class: 'iconbtn', title: 'История', onclick: () => { showHist = !showHist; SFX.tap(); render(); } });
  histBtn.innerHTML = ICON.history();
  acts.append(histBtn);
  bar.append(acts);
  inst.root.append(bar);

  if (showHist) { renderHistory(); return; }

  const disp = el('div', { class: 'calc__disp' });
  disp.append(el('div', { class: 'calc__expr', text: expr || '\u00a0' }));
  disp.append(el('div', { class: 'calc__res', id: 'calc-res', text: formatOut(cur) }));
  inst.root.append(disp);

  const pad = el('div', { class: 'calc__pad' });
  const btn = (label, cls, fn, title) => pad.append(el('button', { class: cls, text: label, title: title || '', onclick: () => { SFX.key(); fn(); } }));
  btn('C', 'fn', () => { clearAll(); render(); }, 'Сброс');
  btn('±', 'fn', () => { cur = cur.startsWith('-') ? cur.slice(1) : '-' + cur; render(); }, 'Сменить знак');
  btn('%', 'fn', () => { cur = String(+cur / 100); render(); }, 'Процент');
  btn('÷', 'op', () => setOp('/'), 'Разделить');
  ['7', '8', '9'].forEach((k) => btn(k, '', () => digit(k)));
  btn('×', 'op', () => setOp('*'), 'Умножить');
  ['4', '5', '6'].forEach((k) => btn(k, '', () => digit(k)));
  btn('−', 'op', () => setOp('-'), 'Вычесть');
  ['1', '2', '3'].forEach((k) => btn(k, '', () => digit(k)));
  btn('+', 'op', () => setOp('+'), 'Сложить');
  btn('0', '', () => digit('0'));
  btn(',', '', () => { if (!cur.includes('.')) cur += '.'; render(); }, 'Запятая');
  btn('=', 'eq', () => evaluate(), 'Равно');
  inst.root.append(pad);

  const del = el('div', { style: { padding: '0 12px 20px', display: 'flex', gap: '9px' } });
  del.append(el('button', { class: 'btn btn--ghost', style: { flex: '1' }, text: '⌫ Стереть', onclick: () => { cur = cur.length > 1 ? cur.slice(0, -1) : '0'; SFX.tap(); render(); } }));
  del.append(el('button', { class: 'btn btn--ghost', style: { flex: '1' }, text: '📐 Инженерный', onclick: () => engineer() }));
  inst.root.append(del);
}

function formatOut(v) {
  if (v === 'Ошибка' || v === 'Infinity' || v === 'NaN') return 'Ошибка';
  const n = String(v);
  if (n.includes('.')) {
    const [i, d] = n.split('.');
    return Number(i).toLocaleString('ru-RU') + ',' + d;
  }
  const num = Number(n);
  if (!isFinite(num)) return 'Ошибка';
  return num.toLocaleString('ru-RU');
}

function digit(k) {
  if (justEvaluated) { cur = '0'; expr = ''; justEvaluated = false; }
  cur = cur === '0' ? k : (cur === '-0' ? '-' + k : cur + k);
  if (cur.replace(/[-.]/g, '').length > 14) cur = cur.slice(0, -1);
  render();
}

function setOp(o) {
  if (op && !justEvaluated && expr) evaluate(true);
  prev = cur;
  op = o;
  expr = `${formatOut(prev)} ${symbol(o)}`;
  cur = '0';
  justEvaluated = false;
  render();
}
const symbol = (o) => ({ '+': '+', '-': '−', '*': '×', '/': '÷' }[o]);

function evaluate(chained = false) {
  if (op === null || prev === null) return;
  const a = parseFloat(prev), b = parseFloat(cur);
  let r;
  switch (op) {
    case '+': r = a + b; break;
    case '-': r = a - b; break;
    case '*': r = a * b; break;
    case '/': r = b === 0 ? NaN : a / b; break;
  }
  const full = `${formatOut(prev)} ${symbol(op)} ${formatOut(cur)} =`;
  const out = isNaN(r) || !isFinite(r) ? 'Ошибка' : String(+r.toFixed(10));
  if (!chained) {
    expr = full;
    const S = getState();
    S.calcHistory.unshift({ e: full, r: out === 'Ошибка' ? 'Ошибка' : formatOut(out), at: S.time.gameMs });
    if (S.calcHistory.length > 40) S.calcHistory.length = 40;
    save();
  } else {
    expr = `${formatOut(out)} `;
  }
  cur = out;
  op = null; prev = null;
  justEvaluated = true;
  render();
  if (out === 'Ошибка') { SFX.error(); toast('🧮', 'Деление на ноль', 'Калькулятор сломался (но не по-настоящему)'); }
}

function renderHistory() {
  const S = getState();
  const body = el('div', { class: 'appbody' });
  if (!S.calcHistory.length) {
    body.append(el('div', { class: 'empty' }, el('span', { class: 'big', text: '🧮' }), 'История пуста', el('br'), el('span', { style: { fontSize: '12px' }, text: 'Посчитайте что-нибудь — например, сколько осталось денег после покупки чехла' })));
  } else {
    const wrap = el('div', { class: 'calc__hist' });
    S.calcHistory.forEach((h) => {
      wrap.append(el('div', { class: 'h', style: { cursor: 'pointer' }, onclick: () => { cur = h.r.replace(/\s/g, '').replace(',', '.'); showHist = false; render(); SFX.tap(); } },
        el('span', { text: h.e }), el('b', { text: h.r })));
    });
    body.append(wrap);
    body.append(el('div', { style: { padding: '14px 18px' } },
      el('button', { class: 'btn btn--ghost', style: { width: '100%' }, text: 'Очистить историю', onclick: () => { S.calcHistory = []; save(); render(); } })));
  }
  inst.root.append(body);
}

async function engineer() {
  const val = parseFloat(cur) || 0;
  const res = {
    'x²': val * val, '√x': Math.sqrt(val), '1/x': 1 / val,
    'sin': Math.sin(val), 'cos': Math.cos(val), 'ln': Math.log(val),
    'log₁₀': Math.log10(val), 'π·x': Math.PI * val, 'x!': val >= 0 && val < 170 && Number.isInteger(val) ? fact(val) : NaN
  };
  const keys = Object.keys(res);
  const { sysDialog } = await import('../ui.js');
  const pick = await sysDialog({
    title: 'Инженерный режим', icon: '📐',
    text: `x = ${val}<br/><br/>` + keys.map((k) => `${k} = <b>${isNaN(res[k]) ? '∄' : +res[k].toFixed(6)}</b>`).join('<br/>'),
    buttons: [{ label: '√x → в ответ', value: 'sqrt' }, { label: 'x² → в ответ', value: 'sqr' }, { label: 'Закрыть', value: null }]
  });
  if (pick === 'sqrt') { cur = String(+Math.sqrt(val).toFixed(10)); render(); }
  if (pick === 'sqr') { cur = String(+(val * val).toFixed(10)); render(); }
}
function fact(n) { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
