// HUD: bars, clock, hotbar, prompts, log
import { ITEMS } from '../game/items.js';
import { drawItemIcon } from '../game/sprites.js';

export class HUD {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('hud');
    this.barHp = document.getElementById('bar-hp');
    this.txtHp = document.getElementById('txt-hp');
    this.barSt = document.getElementById('bar-st');
    this.barHun = document.getElementById('bar-hun');
    this.barThi = document.getElementById('bar-thi');
    this.statuses = document.getElementById('statuses');
    this.clock = document.getElementById('clock');
    this.score = document.getElementById('score');
    this.hotbar = document.getElementById('hotbar');
    this.logEl = document.getElementById('log');
    this.prompt = document.getElementById('prompt');
    this.flash = document.getElementById('dmgflash');
    this.crosshair = document.getElementById('crosshair');
    this.hotSlots = [];
    this.buildHotbar();
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  buildHotbar() {
    this.hotbar.innerHTML = '';
    this.hotSlots = [];
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div');
      d.className = 'hslot';
      const k = document.createElement('span'); k.className = 'k'; k.textContent = String(i + 1);
      const c = document.createElement('canvas'); c.width = 12; c.height = 12;
      const n = document.createElement('span'); n.className = 'n';
      d.appendChild(c); d.appendChild(k); d.appendChild(n);
      this.hotbar.appendChild(d);
      this.hotSlots.push({ el: d, canvas: c, num: n, ctx: c.getContext('2d'), id: null });
    }
  }

  update() {
    const g = this.game, p = g.player;
    this.barHp.style.width = `${Math.max(0, (p.hp / p.maxHp) * 100)}%`;
    this.txtHp.textContent = Math.max(0, Math.round(p.hp));
    this.barSt.style.width = `${p.stamina}%`;
    this.barHun.style.width = `${p.food}%`;
    this.barThi.style.width = `${p.thirst}%`;

    // status badges
    const st = [];
    if (p.bleeding > 0) st.push(['bleed', 'BLEEDING']);
    if (p.food < 20) st.push(['hurt', 'HUNGRY']);
    if (p.thirst < 20) st.push(['hurt', 'THIRSTY']);
    if (p.sprinting) st.push(['ok', 'SPRINTING']);
    if (p.crouch) st.push(['ok', 'SNEAKING']);
    if (p.flashlight) st.push(['ok', 'LIGHT ON']);
    if (p.painkillerT > 0) st.push(['ok', 'PAINKILLERS']);
    const key = st.map(s => s[1]).join('|');
    if (key !== this._statusKey) {
      this._statusKey = key;
      this.statuses.innerHTML = '';
      for (const [cls, txt] of st) {
        const s = document.createElement('span');
        s.className = 'st-badge ' + cls;
        s.textContent = txt;
        this.statuses.appendChild(s);
      }
    }

    // clock
    const mins = Math.floor(g.time) % 1440;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    this.clock.textContent = `Day ${g.day} — ${hh}:${mm}  ${g.isNight ? 'NIGHT' : 'DAY'}`;
    this.score.textContent = `Kills: ${p.kills} | Lvl ${p.level} | XP ${Math.floor(p.xp)}/${p.xpNeeded}${g.fps ? ' | ' + Math.round(g.fps) + 'fps' : ''}`;

    // hotbar
    for (let i = 0; i < this.hotSlots.length; i++) {
      const s = this.hotSlots[i];
      const st2 = p.inv[i];
      const id = st2 ? st2.id : null;
      if (id !== s.id) {
        s.id = id;
        s.ctx.clearRect(0, 0, 12, 12);
        if (id) drawItemIcon(s.ctx, id, 12);
      }
      s.num.textContent = st2 && st2.count > 1 ? st2.count : '';
    }

    // interaction prompt
    const pr = g.currentPrompt;
    if (pr) {
      this.prompt.classList.remove('hidden');
      this.prompt.innerHTML = pr;
    } else {
      this.prompt.classList.add('hidden');
    }

    // crosshair
    if (!g.uiOpen && g.state === 'play') {
      this.crosshair.style.display = 'block';
      this.crosshair.style.left = `${g.input.mouse.x}px`;
      this.crosshair.style.top = `${g.input.mouse.y}px`;
    } else {
      this.crosshair.style.display = 'none';
    }

    this.flash.style.opacity = p.hurtFlash * 0.9;
  }

  log(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'logline ' + cls;
    d.textContent = text;
    this.logEl.appendChild(d);
    while (this.logEl.children.length > 6) this.logEl.removeChild(this.logEl.firstChild);
    setTimeout(() => { if (d.parentNode) d.parentNode.removeChild(d); }, 9000);
  }

  clearLog() { this.logEl.innerHTML = ''; }
}
