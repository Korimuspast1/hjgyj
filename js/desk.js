import { getState, save, completeTask, OPERATORS } from './state.js';
import { api } from './api.js';
import { SFX } from './audio.js';
import { unlock } from './achievements.js';
import { toast, coachmark, hideCoach, worldModal, worldChoice } from './ui.js';
import { $, el, clear, drag, fmtMoney, rndInt, clamp, sleep } from './util.js';
import { EV, emit } from './bus.js';

let refs = {};

export function initDesk() {
  refs = {
    scene: $('#scene'),
    box: $('#prop-box'),
    boxPhone: $('#box-phone'),
    boxFilm: $('#box-film'),
    pin: $('#prop-pin'),
    sim: $('#prop-sim'),
    charger: $('#prop-charger'),
    wallet: $('#prop-wallet'),
    walletLabel: $('#wallet-label'),
    router: $('#prop-router'),
    lamp: $('#prop-lamp'),
    mug: $('#prop-mug'),
    plant: $('.prop--plant'),
    tray: $('#simtray'),
    traySlot: $('#simtray-slot'),
    simHole: $('#hw-simhole'),
    phoneEl: $('#phone'),
    phoneWrap: $('#phone-wrap'),
    tooltip: $('#prop-tooltip'),
    trayHint: $('#simtray-hint'),
    port: $('.phone__port'),
    simText: $('#simcard-txt'),
    flashBeam: $('#flash-beam')
  };

  bindProps();
  renderWorld();
  hintForStage();
}

/* ======================= РЕНДЕР МИРА ======================= */
export function renderWorld() {
  const S = getState();
  const w = S.world;

  refs.box?.classList.toggle('opened', w.boxOpened);
  refs.boxPhone?.classList.toggle('out', w.phoneOutOfBox);
  refs.boxFilm?.classList.toggle('peeled', w.filmPeeled);
  refs.tray?.classList.toggle('out', w.trayOut);
  refs.traySlot?.classList.toggle('has-sim', w.simInTray);
  refs.sim?.classList.toggle('gone', w.simInTray);
  refs.pin?.classList.toggle('gone', w.simInTray && w.trayIn);
  refs.charger?.classList.toggle('plugged', w.chargerPlugged);
  refs.port?.classList.toggle('plugged', w.chargerPlugged);
  refs.scene?.classList.toggle('lamp-on', w.lampOn);
  refs.walletLabel.textContent = fmtMoney(S.money);
  refs.simText.textContent = w.simOperator ? OPERATORS[w.simOperator].name.slice(0, 7) : 'SIM';
  if (refs.simText && w.simOperator) refs.simText.style.color = OPERATORS[w.simOperator].color;
  if (w.simInTray || w.trayIn) refs.sim?.classList.add('gone');

  // телефон виден на столе только когда он «в руках» (т.е. вне коробки)
  refs.phoneWrap.style.opacity = w.phoneOutOfBox ? '1' : '0';
  refs.phoneWrap.style.pointerEvents = w.phoneOutOfBox ? 'auto' : 'none';

  // подсказка у лотка
  const showTrayHint = w.filmPeeled && !w.trayIn && !w.simInTray;
  if (refs.trayHint) refs.trayHint.hidden = !showTrayHint;
  positionTrayHint();

  // день/ночь
  updateSky();
}

function positionTrayHint() {
  if (!refs.trayHint || refs.trayHint.hidden) return;
  const r = refs.simHole.getBoundingClientRect();
  refs.trayHint.style.left = (r.left - 190) + 'px';
  refs.trayHint.style.top = (r.top - 6) + 'px';
}
window.addEventListener('resize', () => { positionTrayHint(); });

export function updateSky() {
  const S = getState();
  const d = new Date(S.time.gameMs);
  const h = d.getHours() + d.getMinutes() / 60;
  const sky = $('#sky'), sun = $('#sun'), moon = $('#moon'), stars = $('#stars');
  if (!sky) return;
  let top, bot, sunTop = 18, sunLeft = 16, moonOp = 0, starOp = 0;
  if (h >= 5 && h < 8) { top = '#f9a8d4'; bot = '#fcd34d'; sunTop = 52; sunLeft = 22; starOp = 0.15; }       // рассвет
  else if (h >= 8 && h < 17) { top = '#7dd3fc'; bot = '#dbeafe'; sunTop = 14 + Math.sin((h - 8) / 9 * Math.PI) * -4; sunLeft = 12 + (h - 8) * 7; } // день
  else if (h >= 17 && h < 21) { top = '#fb923c'; bot = '#7c3aed'; sunTop = 20 + (h - 17) * 14; sunLeft = 66; starOp = (h - 19) / 4; }              // закат
  else { top = '#0b1026'; bot = '#1e293b'; moonOp = 1; starOp = 1; }                                                                              // ночь
  sky.style.background = `linear-gradient(180deg, ${top}, ${bot})`;
  if (sun) { sun.style.top = sunTop + '%'; sun.style.left = sunLeft + '%'; sun.style.opacity = (h >= 21 || h < 5) ? 0 : 1; }
  if (moon) moon.style.opacity = moonOp;
  if (stars) {
    stars.style.opacity = clamp(starOp, 0, 1);
    if (!stars.childElementCount) {
      for (let i = 0; i < 26; i++) {
        const s = document.createElement('i');
        s.style.left = Math.random() * 100 + '%';
        s.style.top = Math.random() * 70 + '%';
        s.style.animationDelay = (Math.random() * 3) + 's';
        stars.append(s);
      }
    }
  }
  refs.scene?.classList.toggle('night', h >= 21 || h < 5);
  refs.flashBeam?.classList.toggle('on', getState().phone.flashlight);
}

/* ======================= ПОДСКАЗКИ ПО ЭТАПАМ ======================= */
export function hintForStage() {
  const S = getState();
  const w = S.world;
  if (S.stage === 'ready' || S.stage === 'setup' || S.stage === 'booting') { hideCoach(); return; }
  if (S.hintsShown[S.stage]) return;
  S.hintsShown[S.stage] = true;
  save();

  switch (S.stage) {
    case 'box':
      coachmark('Ты только что купил телефон 🎉 Кликни по коробке на столе, чтобы вскрыть её.', refs.box);
      break;
    case 'opened':
      coachmark('Коробка открыта. Теперь вытащи телефон — потяни его вверх из коробки.', refs.boxPhone);
      break;
    case 'film':
      coachmark('На экране защитная плёнка. Потяни за ярлычок «потяни» в левом верхнем углу — сними её!', refs.boxFilm);
      break;
    case 'simtray':
      coachmark('Без SIM-карты сети не будет. Возьми скрепку со стола, затем нажми ею маленькое отверстие на правой грани телефона.', refs.pin);
      break;
    case 'trayout':
      coachmark('Лоток выезжает. Перетащи SIM-карту в лоток.', refs.sim);
      break;
    case 'simin':
      coachmark('SIM на месте. Нажми на лоток, чтобы задвинуть его обратно в телефон.', refs.tray);
      break;
    case 'tariff':
      coachmark('Теперь зажми кнопку питания справа — телефон включится и предложит выбрать оператора.', $('#hw-power'));
      break;
  }
}

/* ======================= ВЗАИМОДЕЙСТВИЯ ======================= */
function bindProps() {
  // тултипы
  document.querySelectorAll('.prop[data-hint]').forEach((p) => {
    p.addEventListener('mouseenter', (e) => showTip(e, p.dataset.hint));
    p.addEventListener('mousemove', (e) => moveTip(e));
    p.addEventListener('mouseleave', hideTip);
  });

  // --- коробка ---
  refs.box.addEventListener('click', () => {
    const w = getState().world;
    if (!w.boxOpened) { openBox(); return; }
    if (!w.phoneOutOfBox) { toast('📦', 'Телефон в коробке', 'Потяни телефон вверх, чтобы достать его'); return; }
    toast('📦', 'Пустая коробка', 'Внутри: скрепка для SIM, документация и кабель USB-C');
  });

  // --- достать телефон (перетаскивание) ---
  dragPhoneOut();

  // --- плёнка ---
  dragFilm();

  // --- скрепка ---
  refs.pin.addEventListener('click', () => {
    const S = getState();
    if (S.world.simInTray) { toast('📎', 'Скрепка больше не нужна', 'SIM-карта уже установлена'); return; }
    if (S.stage !== 'simtray') { toast('📎', 'Скрепка', 'Маленький инструмент, чтобы вытащить SIM-лоток'); return; }
    S.flags.pinInHand = !S.flags.pinInHand;
    refs.pin.classList.toggle('picked', S.flags.pinInHand);
    if (S.flags.pinInHand) {
      toast('📎', 'Скрепка в руке', 'Теперь нажми ею на отверстие рядом с SIM-лотком на правой грани');
      refs.simHole.classList.add('hint');
      SFX.click();
    } else {
      refs.simHole.classList.remove('hint');
      SFX.tap();
    }
    save();
  });

  // --- отверстие SIM-лотка ---
  refs.simHole.addEventListener('click', () => {
    const S = getState();
    if (S.flags.needTariff && !S.phone.sim.operator) { retryTariff(); return; }
    if (S.world.trayIn) {
      toast('📱', 'Лоток закрыт', 'SIM-карта уже внутри телефона');
      return;
    }
    if (!S.flags.pinInHand) {
      toast('📎', 'Нужна скрепка', 'Сначала возьми скрепку со стола — она слева от коробки');
      refs.pin.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.25) rotate(-6deg)' }, { transform: 'scale(1)' }], { duration: 600 });
      return;
    }
    if (S.stage === 'trayout' || S.world.trayOut) {
      // задвинуть
      pushTray();
      return;
    }
    ejectTray();
  });

  // --- лоток ---
  refs.tray.addEventListener('click', (e) => {
    const S = getState();
    if (S.flags.needTariff && !S.phone.sim.operator) { retryTariff(); return; }
    if (!S.world.trayOut) {
      toast('📱', 'SIM-лоток', 'Чтобы открыть лоток, нажми скрепкой в отверстие на грани');
      return;
    }
    if (!S.world.simInTray) {
      toast('📶', 'Пустой лоток', 'Перетащи сюда SIM-карту со стола');
      return;
    }
    pushTray();
  });

  // --- SIM-карта (перетаскивание в лоток) ---
  refs.sim.addEventListener('click', () => retryTariff());
  dragSim();

  // --- зарядка ---
  refs.charger.addEventListener('click', () => {
    const S = getState();
    if (!S.world.phoneOutOfBox) { toast('🔌', 'Зарядка', 'Сначала достань телефон из коробки'); return; }
    S.world.chargerPlugged = !S.world.chargerPlugged;
    if (S.world.chargerPlugged) {
      SFX.plug();
      toast('🔌', 'Зарядка подключена', S.phone.on ? 'Идёт зарядка батареи' : 'Телефон выключен — зарядка всё равно идёт');
      unlock('charge');
      completeTask('t15');
      if (S.stage === 'dead') toast('🪫', 'Телефон на зарядке', 'Подожди немного и включи его кнопкой питания');
    } else {
      SFX.unplug();
      toast('🔌', 'Кабель отключён', '');
    }
    save();
    renderWorld();
    emit(EV.STATE);
  });

  // --- кошелёк ---
  refs.wallet.addEventListener('click', () => {
    const S = getState();
    S.world.walletSeen = true;
    SFX.coin();
    worldModal(`
      <p>В кошельке наличными: <b>${fmtMoney(S.money)}</b></p>
      <p>На банковской карте (приложение NovaBank): <b>${fmtMoney(S.bank.balance)}</b></p>
      <p class="muted" style="opacity:.6;font-size:12.5px">Телефон уже куплен — чек лежит в коробке. Деньги пригодятся для покупок в интернет-магазине и оплаты связи.</p>
    `, '💶 Кошелёк');
    save();
  });

  // --- роутер ---
  refs.router.addEventListener('click', () => {
    const S = getState();
    S.world.routerSeen = true;
    SFX.tap();
    worldModal(`
      <p>Домашний роутер. На наклейке снизу написано:</p>
      <div class="modal" style="padding:0;border:none;background:none;box-shadow:none;margin:10px 0">
        <p style="font-family:ui-monospace,monospace;background:rgba(110,231,255,.1);border:1px solid rgba(110,231,255,.25);border-radius:10px;padding:10px">
          SSID: <b>Home_Nova_5G</b><br/>Пароль: <b>kotenok2024</b>
        </p>
      </div>
      <p class="muted" style="opacity:.6;font-size:12.5px">Запомни пароль — он понадобится в настройках Wi-Fi. Он также записан в твоих заметках.</p>
    `, '📡 Роутер');
    save();
  });

  // --- лампа ---
  refs.lamp.addEventListener('click', () => {
    const S = getState();
    S.world.lampOn = !S.world.lampOn;
    SFX.click();
    toast('💡', S.world.lampOn ? 'Лампа включена' : 'Лампа выключена', '');
    save();
    renderWorld();
  });

  // --- кружка ---
  refs.mug?.addEventListener('click', () => {
    const S = getState();
    if (S.world.mugSipped) { toast('☕', 'Кружка пуста', 'Кофе закончился — но телефон важнее'); return; }
    S.world.mugSipped = true;
    SFX.tap();
    toast('☕', 'Глоток кофе', 'Бодрость +10. Можно продолжать настройку телефона');
    save();
  });

  // --- растение ---
  refs.plant?.addEventListener('click', () => {
    toast('🪴', 'Фикус', 'Его зовут Геннадий. Он не против, что ты играешь с телефоном');
  });
}

function showTip(e, text) {
  refs.tooltip.textContent = text;
  refs.tooltip.classList.add('show');
  moveTip(e);
}
function moveTip(e) {
  const t = refs.tooltip;
  const w = t.offsetWidth || 180;
  t.style.left = clamp(e.clientX - w / 2, 10, window.innerWidth - w - 10) + 'px';
  t.style.top = (e.clientY - 46) + 'px';
}
function hideTip() { refs.tooltip.classList.remove('show'); }

/* ---------- открыть коробку ---------- */
async function openBox() {
  const S = getState();
  S.world.boxOpened = true;
  S.stage = 'opened';
  SFX.tray();
  renderWorld();
  save();
  unlock('unbox');
  completeTask('t1');
  toast('📦', 'Коробка открыта!', 'Внутри: NOVA X5 Pro, кабель USB-C, скрепка для SIM и документация');
  hideCoach();
  await sleep(700);
  hintForStage();
}

/* ---------- достать телефон ---------- */
function dragPhoneOut() {
  const node = refs.boxPhone;
  let startY = 0, moved = false;
  node.addEventListener('pointerdown', (e) => {
    if (getState().world.phoneOutOfBox) return;
    node.setPointerCapture(e.pointerId);
    startY = e.clientY; moved = true;
    node.classList.add('dragging');
  });
  node.addEventListener('pointermove', (e) => {
    if (!moved) return;
    const dy = clamp(e.clientY - startY, -260, 20);
    node.style.transform = `translateX(-50%) translateY(${dy}px) rotate(${dy / -22}deg)`;
  });
  node.addEventListener('pointerup', (e) => {
    if (!moved) return;
    moved = false;
    node.classList.remove('dragging');
    const dy = e.clientY - startY;
    node.style.transform = '';
    if (dy < -110) takePhoneOut();
    else node.animate?.([{ transform: 'translateX(-50%) translateY(0)' }], { duration: 200 });
  });
  node.addEventListener('pointercancel', () => { moved = false; node.classList.remove('dragging'); node.style.transform = ''; });
  node.addEventListener('click', () => {
    if (!getState().world.phoneOutOfBox && getState().world.boxOpened) {
      toast('📦', 'Потяни вверх', 'Захвати телефон мышкой и потяни его вверх из коробки');
    }
  });
}

async function takePhoneOut() {
  const S = getState();
  if (S.world.phoneOutOfBox) return;
  S.world.phoneOutOfBox = true;
  S.stage = 'film';
  refs.boxPhone.classList.add('out');
  SFX.tray();
  save();
  toast('📱', 'Телефон в руках', 'Холодный металл, запах нового устройства... На экране защитная плёнка!');
  renderWorld();
  hideCoach();
  await sleep(800);
  hintForStage();
}

/* ---------- плёнка ---------- */
function dragFilm() {
  const node = refs.boxFilm;
  let sx = 0, sy = 0, moved = false;
  node.addEventListener('pointerdown', (e) => {
    if (getState().world.filmPeeled) return;
    node.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY; moved = true;
    node.classList.add('dragging');
  });
  node.addEventListener('pointermove', (e) => {
    if (!moved) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    const dist = Math.hypot(dx, dy);
    const p = clamp(dist / 140, 0, 1);
    node.style.transform = `translate(${dx * 0.7}px, ${dy * 0.7 - p * 40}px) rotate(${p * 34}deg) scale(${1 - p * 0.18})`;
    node.style.opacity = String(1 - p * 0.85);
    if (dist > 20 && !node._snd) { node._snd = true; SFX.film(); setTimeout(() => (node._snd = false), 600); }
  });
  node.addEventListener('pointerup', (e) => {
    if (!moved) return;
    moved = false;
    node.classList.remove('dragging');
    const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
    node.style.transform = ''; node.style.opacity = '';
    if (dist > 90) peelFilm();
  });
  node.addEventListener('pointercancel', () => { moved = false; node.classList.remove('dragging'); node.style.transform = ''; node.style.opacity = ''; });
  node.addEventListener('click', () => {
    if (!getState().world.filmPeeled && getState().stage === 'film') {
      toast('✨', 'Потяни плёнку', 'Захвати ярлычок «потяни» и потяни в сторону — это лучший момент в жизни');
    }
  });
}

async function peelFilm() {
  const S = getState();
  if (S.world.filmPeeled) return;
  S.world.filmPeeled = true;
  S.stage = 'simtray';
  refs.boxFilm.classList.add('peeled');
  SFX.film();
  save();
  unlock('film');
  completeTask('t2');
  toast('✨', 'Плёнка снята!', 'Экран идеально чистый. +100 к удовольствию');
  renderWorld();
  hideCoach();
  await sleep(600);
  hintForStage();
}

/* ---------- SIM-лоток ---------- */
async function ejectTray() {
  const S = getState();
  S.world.trayOut = true;
  S.stage = 'trayout';
  refs.tray.classList.add('out');
  refs.simHole.classList.remove('hint');
  S.flags.pinInHand = false;
  refs.pin.classList.remove('picked');
  SFX.tray();
  save();
  completeTask('t3');
  toast('📥', 'Лоток открыт', 'Скрепка сработала! Теперь перетащи SIM-карту в лоток');
  renderWorld();
  hideCoach();
  await sleep(400);
  hintForStage();
}

async function pushTray() {
  const S = getState();
  S.world.trayOut = false;
  S.world.trayIn = true;
  refs.tray.classList.remove('out');
  SFX.tray();
  save();
  renderWorld();
  await sleep(500);
  openTariffChooser();
}

/* ---------- перетаскивание SIM ---------- */
function dragSim() {
  const node = refs.sim;
  let sx = 0, sy = 0, moved = false, clone = null;
  node.addEventListener('pointerdown', (e) => {
    const S = getState();
    if (S.world.simInTray) return;
    if (!S.world.trayOut) {
      toast('📶', 'Сначала открой лоток', 'Возьми скрепку и нажми в отверстие на правой грани телефона');
      return;
    }
    node.setPointerCapture(e.pointerId);
    sx = e.clientX; sy = e.clientY; moved = true;
    const r = node.getBoundingClientRect();
    clone = node.cloneNode(true);
    clone.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;z-index:130;pointer-events:none;transition:none;margin:0`;
    clone.classList.remove('prop');
    document.body.append(clone);
    node.style.opacity = '.25';
  });
  node.addEventListener('pointermove', (e) => {
    if (!moved || !clone) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    clone.style.transform = `translate(${dx}px, ${dy}px) rotate(${dx / 24}deg) scale(1.06)`;
    const slot = refs.traySlot.getBoundingClientRect();
    const over = e.clientX > slot.left - 30 && e.clientX < slot.right + 30 && e.clientY > slot.top - 20 && e.clientY < slot.bottom + 20;
    clone.style.filter = over ? 'drop-shadow(0 0 16px #4ade80)' : '';
    refs.traySlot.style.boxShadow = over ? '0 0 0 3px #4ade80aa' : '';
  });
  node.addEventListener('pointerup', (e) => {
    if (!moved) return;
    moved = false;
    const slot = refs.traySlot.getBoundingClientRect();
    const over = e.clientX > slot.left - 34 && e.clientX < slot.right + 34 && e.clientY > slot.top - 24 && e.clientY < slot.bottom + 24;
    clone?.remove(); clone = null;
    node.style.opacity = '';
    refs.traySlot.style.boxShadow = '';
    if (over) insertSim();
    else toast('📶', 'Мимо лотка', 'Перетащи SIM-карту точно в выезжающий лоток справа от телефона');
  });
  node.addEventListener('pointercancel', () => { moved = false; clone?.remove(); clone = null; node.style.opacity = ''; });
}

async function insertSim() {
  const S = getState();
  S.world.simInTray = true;
  S.phone.sim.inserted = true;
  S.stage = 'simin';
  SFX.click();
  save();
  toast('📶', 'SIM-карта в лотке', 'Теперь нажми на лоток, чтобы задвинуть его в телефон');
  renderWorld();
  hideCoach();
  await sleep(500);
  hintForStage();
}

/* ---------- выбор оператора ---------- */
export async function openTariffChooser() {
  const S = getState();
  const sel = await worldChoice({
    title: '📶 Активация SIM-карты',
    text: 'В магазине дали две SIM-карты на выбор. Обе бесплатные, абонплата списывается с банковской карты каждый день в 9:00.',
    okLabel: 'Активировать',
    cancelLabel: 'Решу позже',
    dismissible: false,
    options: [
      { id: 'mobiline', icon: '🔴', title: `Mobiline — «${OPERATORS.mobiline.tariff}»`, sub: OPERATORS.mobiline.desc },
      { id: 'telka', icon: '🟢', title: `Telka — «${OPERATORS.telka.tariff}»`, sub: OPERATORS.telka.desc }
    ]
  });

  if (!sel) {
    S.world.simInTray = true;
    S.stage = 'tariff';
    S.flags.needTariff = true;
    toast('📶', 'SIM без тарифа', 'Сеть работать не будет. Нажми на SIM-карту или лоток, чтобы выбрать оператора');
    save();
    coachmark('Ты отложил выбор оператора. Без тарифа не будет ни звонков, ни мобильного интернета — нажми на SIM-карту на столе.', refs.sim);
    return;
  }
  S.flags.needTariff = false;
  activateSim(sel);
}

function retryTariff() {
  const S = getState();
  if (S.flags.needTariff && !S.phone.sim.operator) { hideCoach(); openTariffChooser(); }
}

export function activateSim(opId) {
  const S = getState();
  const o = OPERATORS[opId];
  S.world.simOperator = opId;
  S.world.simTariffPaid = true;
  S.phone.sim.operator = opId;
  S.phone.sim.number = `+32 4${rndInt(60, 99)} ${rndInt(10, 99)} ${rndInt(10, 99)} ${rndInt(10, 99)}`;
  S.phone.sim.iccid = '8932' + Array.from({ length: 15 }, () => rndInt(0, 9)).join('');
  S.phone.sim.signal = 3;
  S.phone.data.limitGb = o.gb === Infinity ? 999 : o.gb;
  S.stage = 'tariff';
  const c = S.contacts.find((x) => x.id === 'operator');
  if (c) { c.name = o.name; c.full = `${o.name} — сервис`; c.phone = opId === 'mobiline' ? '1111' : '2222'; c.color = o.color; }
  SFX.coin();
  save();
  unlock('sim'); unlock('tariff');
  completeTask('t4'); completeTask('t5');
  renderWorld();
  toast('📶', `${o.name}: SIM активирована`, `Номер ${S.phone.sim.number} · тариф «${o.tariff}» · ${o.price.toFixed(2)} €/день`);
  api.notify?.({
    appId: 'system', icon: '📶', color: o.color, title: `${o.name}: добро пожаловать`,
    text: `SIM активирована. Тариф «${o.tariff}». Набор *100# — проверка баланса.`
  });
  hintForStage();
  emit(EV.NET);
}

/* ======================= ЭКСПОРТ ДЛЯ ДРУГИХ МОДУЛЕЙ ======================= */
export function worldClick(id) {
  const map = { box: refs.box, pin: refs.pin, sim: refs.sim, charger: refs.charger, wallet: refs.wallet, router: refs.router, lamp: refs.lamp };
  map[id]?.click();
}
