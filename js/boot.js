import { getState, save } from './state.js';
import { el, clear, sleep, rndInt } from './util.js';
import { SFX } from './audio.js';
import { $ } from './util.js';

const BOOT_STEPS = [
  'Проверка оборудования…',
  'Загрузка ядра NovaOS 15…',
  'Монтирование разделов…',
  'Инициализация модема…',
  'Запуск системных сервисов…',
  'Подготовка домашнего экрана…'
];

export async function bootSequence() {
  const boot = $('#boot');
  const S = getState();
  clear(boot);
  boot.classList.add('show');

  const inner = el('div', { class: 'boot__inner' });
  inner.append(
    el('div', { class: 'boot__logo', text: 'NOVA' }),
    el('div', { class: 'boot__sub', text: 'Powered by NovaOS 15' }),
    el('div', { class: 'boot__bar' }, el('i')),
    el('div', { class: 'boot__txt', text: 'Включение…' })
  );
  boot.append(inner);
  const barFill = inner.querySelector('.boot__bar i');
  const txt = inner.querySelector('.boot__txt');

  SFX.powerOn();
  await sleep(700);

  for (let i = 0; i < BOOT_STEPS.length; i++) {
    txt.textContent = BOOT_STEPS[i];
    barFill.style.width = `${Math.round(((i + 1) / BOOT_STEPS.length) * 100)}%`;
    await sleep(rndInt(220, 420));
  }

  if (S.phone.sim.inserted && S.phone.sim.operator) {
    txt.textContent = 'Регистрация в сети…';
    await sleep(600);
  }
  txt.textContent = 'Почти готово…';
  await sleep(350);

  clear(boot);
  boot.append(el('div', { class: 'boot__inner' },
    el('div', { class: 'boot__logo', text: 'NOVA' }),
    el('div', { class: 'boot__spinner' })
  ));
  await sleep(700);
  boot.classList.remove('show');
  clear(boot);
}

export async function shutdownSequence(reason = 'Выключение') {
  const boot = $('#boot');
  clear(boot);
  boot.classList.add('show');
  boot.append(el('div', { class: 'boot__inner' },
    el('div', { class: 'boot__logo', text: 'NOVA' }),
    el('div', { class: 'boot__txt', text: reason })
  ));
  SFX.powerOff();
  await sleep(900);
  boot.classList.remove('show');
  clear(boot);
}
