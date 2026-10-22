import { getState, save } from '../state.js';
import { el, clear, clamp, rndInt } from '../util.js';
import { ICON } from '../icons.js';
import { SFX } from '../audio.js';
import { unlock } from '../achievements.js';
import { toast, sysDialog } from '../ui.js';

let inst = null, loop = null, snake = [], dir = { x: 1, y: 0 }, food = null, score = 0, alive = false, speed = 150, started = false, cols = 17, rows = 28, wallMode = false;

export function mount(root, a, params) {
  inst = { root, api: a };
  root.className = 'app snake theme-dark';
  render();
  return {
    onFocus() { bindKeys(true); },
    onBlur() { pause(); bindKeys(false); },
    onBack() {
      if (started && alive) { pause(); return true; }
      return false;
    },
    onUnmount() { stopLoop(); bindKeys(false); inst = null; }
  };
}

function bindKeys(on) {
  if (on) window.addEventListener('keydown', keyHandler);
  else window.removeEventListener('keydown', keyHandler);
}

function keyHandler(e) {
  if (!inst || !alive) return;
  const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
  const k = map[e.key];
  if (k) { e.preventDefault(); setDir(k[0], k[1]); }
  if (e.key === ' ' || e.key === 'Escape') { e.preventDefault(); pause(); }
}

function render() {
  if (!inst) return;
  const S = getState();
  clear(inst.root);

  const bar = el('div', { class: 'appbar', style: { background: 'transparent' } },
    el('h1', {}, el('span', { text: 'Змейка' }), el('span', { class: 'sub', text: `Рекорд: ${S.stats.snakeBest || 0}` })));
  const acts = el('div', { class: 'appbar__actions' });
  const help = el('button', { class: 'iconbtn', onclick: () => showHelp() });
  help.innerHTML = ICON.help();
  acts.append(help);
  bar.append(acts);
  inst.root.append(bar);

  const hud = el('div', { class: 'snake__hud' });
  hud.append(el('div', { class: 'sh' }, el('span', { text: 'СЧЁТ' }), el('b', { id: 'sn-score', text: String(score) })));
  hud.append(el('div', { class: 'sh' }, el('span', { text: 'ДЛИНА' }), el('b', { id: 'sn-len', text: String(snake.length || 3) })));
  hud.append(el('div', { class: 'sh' }, el('span', { text: 'СКОРОСТЬ' }), el('b', { id: 'sn-speed', text: '×1.0' })));
  inst.root.append(hud);

  const stage = el('div', { class: 'snake__stage', id: 'sn-stage' });
  const grid = el('div', { class: 'snake__grid', id: 'sn-grid' });
  grid.style.setProperty('--cols', cols);
  grid.style.setProperty('--rows', rows);
  stage.append(grid);
  const ov = el('div', { class: 'snake__overlay', id: 'sn-overlay' });
  ov.append(el('div', { class: 'so-box' },
    el('div', { style: { fontSize: '52px' }, text: '🐍' }),
    el('h2', { text: 'Змейка Nova' }),
    el('p', { text: 'Свайпайте по полю или используйте стрелки. Съешьте яблоко — не съешьте себя.' }),
    el('div', { style: { display: 'flex', gap: '8px', marginTop: '6px', justifyContent: 'center', flexWrap: 'wrap' } },
      el('button', { class: 'chip' + (wallMode ? '' : ' on'), text: 'Сквозь стены', onclick: () => { wallMode = false; ov.querySelector('.chip.on')?.classList.remove('on'); ov.querySelectorAll('.chip')[0].classList.add('on'); } }),
      el('button', { class: 'chip' + (wallMode ? ' on' : ''), text: 'Стены = смерть', onclick: () => { wallMode = true; ov.querySelector('.chip.on')?.classList.remove('on'); ov.querySelectorAll('.chip')[1].classList.add('on'); } })),
    el('button', { class: 'btn btn--primary', style: { marginTop: '14px', padding: '13px 34px' }, text: '▶ Играть', onclick: () => start() })));
  stage.append(ov);
  inst.root.append(stage);

  // свайпы
  let sx = 0, sy = 0;
  stage.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  stage.addEventListener('pointerup', (e) => {
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.hypot(dx, dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) setDir(Math.sign(dx), 0);
    else setDir(0, Math.sign(dy));
  });

  // D-pad
  const dpad = el('div', { class: 'snake__dpad' });
  const b = (label, x, y, cls) => el('button', { class: cls || '', text: label, onclick: () => setDir(x, y) });
  dpad.append(el('div'), b('▲', 0, -1), el('div'));
  dpad.append(b('◀', -1, 0), el('button', { class: 'mid', text: alive ? '⏸' : '▶', onclick: () => { if (!alive) start(); else pause(); } }), b('▶', 1, 0));
  dpad.append(el('div'), b('▼', 0, 1), el('div'));
  inst.root.append(dpad);
}

function setDir(x, y) {
  if (!alive) return;
  if (x === -dir.x && y === -dir.y) return;
  dir = { x, y };
  SFX.tap();
}

function start() {
  snake = [{ x: 8, y: 14 }, { x: 7, y: 14 }, { x: 6, y: 14 }];
  dir = { x: 1, y: 0 };
  score = 0; speed = 150; alive = true; started = true;
  placeFood();
  draw();
  inst.root.querySelector('#sn-overlay')?.classList.add('hide');
  stopLoop();
  loop = setInterval(step, speed);
}

function placeFood() {
  do {
    food = { x: rndInt(0, cols - 1), y: rndInt(0, rows - 1), kind: Math.random() < 0.12 ? 'golden' : 'apple' };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}

function step() {
  if (!alive || !inst) return;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (wallMode) {
    if (head.x < 0 || head.y < 0 || head.x >= cols || head.y >= rows) return die('Вы врезались в стену');
  } else {
    head.x = (head.x + cols) % cols;
    head.y = (head.y + rows) % rows;
  }
  if (snake.some((s) => s.x === head.x && s.y === head.y)) return die('Вы съели себя');
  snake.unshift(head);
  if (food && head.x === food.x && head.y === food.y) {
    const gain = food.kind === 'golden' ? 50 : 10;
    score += gain;
    SFX.snakeEat();
    placeFood();
    if (score % 50 === 0 && speed > 65) {
      speed -= 12;
      stopLoop();
      loop = setInterval(step, speed);
    }
    unlock('snake');
    const S = getState();
    S.stats.snakeBest = Math.max(S.stats.snakeBest || 0, score);
    save();
    updHud();
  } else {
    snake.pop();
  }
  draw();
}

function updHud() {
  const s = inst?.root.querySelector('#sn-score');
  const l = inst?.root.querySelector('#sn-len');
  const sp = inst?.root.querySelector('#sn-speed');
  if (s) s.textContent = String(score);
  if (l) l.textContent = String(snake.length);
  if (sp) sp.textContent = '×' + (150 / speed).toFixed(1);
}

function draw() {
  const grid = inst?.root.querySelector('#sn-grid');
  if (!grid) return;
  clear(grid);
  const cell = (x, y, cls, text) => {
    const c = el('div', { class: 'cell ' + cls });
    c.style.gridArea = `${y + 1}/${x + 1}`;
    if (text) c.textContent = text;
    grid.append(c);
  };
  if (food) cell(food.x, food.y, 'food' + (food.kind === 'golden' ? ' gold' : ''), food.kind === 'golden' ? '★' : '🍎');
  snake.forEach((s, i) => cell(s.x, s.y, i === 0 ? 'head' : 'body'));
  updHud();
}

function pause() {
  if (!alive) return;
  alive = false;
  stopLoop();
  const ov = inst?.root.querySelector('#sn-overlay');
  if (ov) {
    ov.classList.remove('hide');
    const box = ov.querySelector('.so-box');
    clear(box);
    box.append(el('div', { style: { fontSize: '44px' }, text: '⏸️' }),
      el('h2', { text: 'Пауза' }),
      el('p', { text: `Счёт: ${score} · длина: ${snake.length}` }),
      el('button', { class: 'btn btn--primary', style: { marginTop: '12px', padding: '12px 30px' }, text: '▶ Продолжить', onclick: () => { alive = true; ov.classList.add('hide'); stopLoop(); loop = setInterval(step, speed); } }));
  }
}

function stopLoop() { clearInterval(loop); loop = null; }

async function die(reason) {
  alive = false;
  stopLoop();
  SFX.snakeDie();
  const S = getState();
  const rec = score > (S.stats.snakeBest || 0);
  S.stats.snakeBest = Math.max(S.stats.snakeBest || 0, score);
  save();
  const ov = inst.root.querySelector('#sn-overlay');
  ov.classList.remove('hide');
  const box = ov.querySelector('.so-box');
  clear(box);
  box.append(
    el('div', { style: { fontSize: '44px' }, text: '💀' }),
    el('h2', { text: 'Игра окончена' }),
    el('p', { text: reason }),
    el('div', { style: { fontSize: '34px', fontWeight: '800', margin: '8px 0', letterSpacing: '-.02em' }, text: String(score) }),
    el('div', { style: { fontSize: '12px', opacity: '.6' }, text: rec ? '🏆 Новый рекорд!' : `Рекорд: ${S.stats.snakeBest} · длина змейки: ${snake.length}` }),
    el('div', { style: { display: 'flex', gap: '10px', marginTop: '14px' } },
      el('button', { class: 'btn btn--primary', style: { padding: '12px 26px' }, text: '🔄 Ещё раз', onclick: () => start() }),
      el('button', { class: 'btn btn--ghost', style: { padding: '12px 20px' }, text: 'В меню', onclick: () => { started = false; score = 0; snake = []; render(); } }))
  );
  if (rec && score >= 100) toast('🏆', 'Новый рекорд в «Змейке»!', `${score} очков`);
}

async function showHelp() {
  await sysDialog({
    title: 'Как играть', icon: '🐍',
    text: '🍎 обычное яблоко — <b>10 очков</b><br/>★ золотое — <b>50 очков</b> (появляется редко)<br/><br/>Управление: свайп по полю, D-pad снизу или стрелки на клавиатуре.<br/><br/>Каждые 50 очков скорость растёт. Рекорд сохраняется даже после перезагрузки телефона.',
    buttons: [{ label: 'Понятно', value: true, cls: 'primary' }]
  });
}
