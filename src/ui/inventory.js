// Inventory + crafting panels
import { ITEMS } from '../game/items.js';
import { drawItemIcon } from '../game/sprites.js';
import { RECIPES, canCraft } from '../game/crafting.js';

function makeIconCanvas(id, size = 12) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (id) drawItemIcon(ctx, id, size);
  return c;
}

export class InventoryUI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('inventory');
    this.grid = document.getElementById('inv-grid');
    this.detail = document.getElementById('inv-detail');
    this.eqHands = document.getElementById('eq-hands');
    this.eqBack = document.getElementById('eq-back');
    this.stats = document.getElementById('inv-stats');
    this.sel = -1;
    this.slots = [];
    for (let i = 0; i < 40; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.addEventListener('mousedown', (e) => this.onSlot(e, i));
      this.grid.appendChild(d);
      this.slots.push(d);
    }
    this.eqHands.addEventListener('mousedown', () => { game.player.unequip(game); this.refresh(); });
    this.root.querySelector('.close-btn').addEventListener('click', () => game.closeUI());
  }

  onSlot(e, i) {
    const g = this.game, p = g.player;
    const st = p.inv[i];
    if (!st) { this.sel = -1; this.refresh(); return; }
    if (e.button === 2) {
      this.act(i);
      return;
    }
    if (this.sel === i) this.act(i);
    else this.sel = i;
    this.refresh();
  }

  act(i) {
    const g = this.game, p = g.player;
    const st = p.inv[i];
    if (!st) return;
    const def = ITEMS[st.id];
    if (!def) return;
    if (def.cat === 'weapon') p.equip(i, g);
    else if (['food', 'drink', 'med', 'tool'].includes(def.cat) || def.throwable) p.useItem(g, i);
    else g.log(`The ${def.name.toLowerCase()} is not usable.`, 'warn');
    this.refresh();
  }

  refresh() {
    const p = this.game.player;
    for (let i = 0; i < this.slots.length; i++) {
      const el = this.slots[i];
      const st = p.inv[i];
      el.innerHTML = '';
      el.classList.toggle('sel', this.sel === i);
      if (!st) continue;
      const c = makeIconCanvas(st.id, 12);
      el.appendChild(c);
      if (st.count > 1) {
        const n = document.createElement('span');
        n.className = 'cnt'; n.textContent = st.count;
        el.appendChild(n);
      }
    }
    // hands
    this.eqHands.innerHTML = '';
    if (p.weapon) {
      this.eqHands.appendChild(makeIconCanvas(p.weapon.id, 12));
      const n = document.createElement('span');
      n.className = 'cnt';
      n.textContent = p.weapon.kind === 'gun' ? `${p.weapon.ammo}` : '';
      this.eqHands.appendChild(n);
    } else {
      const h = document.createElement('span'); h.className = 'hint'; h.textContent = 'hands';
      this.eqHands.appendChild(h);
    }
    // backpack
    this.eqBack.innerHTML = '';
    const b = document.createElement('span'); b.className = 'hint';
    b.textContent = `backpack ${p.inv.length}/40`;
    this.eqBack.appendChild(b);

    // stats
    const w = p.weapon;
    this.stats.innerHTML = '';
    const rows = [
      ['Health', `${Math.round(p.hp)}/${p.maxHp}`],
      ['Stamina', `${Math.round(p.stamina)}`],
      ['Food', `${Math.round(p.food)}`],
      ['Thirst', `${Math.round(p.thirst)}`],
      ['Level', `${p.level} (${Math.floor(p.xp)}/${p.xpNeeded})`],
      ['Kills', `${p.kills}`],
      ['Weapon', w ? ITEMS[w.id].name + (w.kind === 'gun' ? ` (${w.ammo}/${w.magSize})` : '') : '—'],
    ];
    for (const [k, v] of rows) {
      const d = document.createElement('div');
      d.innerHTML = `${k}: <b>${v}</b>`;
      this.stats.appendChild(d);
    }

    // detail
    this.detail.innerHTML = '';
    const st = p.inv[this.sel];
    if (st && ITEMS[st.id]) {
      const def = ITEMS[st.id];
      const d = document.createElement('div');
      d.className = 'nm';
      d.textContent = `${def.name} x${st.count}`;
      const t = document.createElement('div');
      t.textContent = def.desc || '';
      const u = document.createElement('div');
      u.className = 'dim';
      u.textContent = 'Left click to use/equip · right click to use · category: ' + def.cat;
      this.detail.appendChild(d); this.detail.appendChild(t); this.detail.appendChild(u);
    } else {
      const s = document.createElement('span');
      s.className = 'dim';
      s.textContent = 'Select an item.';
      this.detail.appendChild(s);
    }
  }
}

export class CraftUI {
  constructor(game) {
    this.game = game;
    this.root = document.getElementById('crafting');
    this.list = document.getElementById('craft-list');
    this.root.querySelector('.close-btn').addEventListener('click', () => game.closeUI());
  }

  refresh() {
    const g = this.game, p = g.player;
    this.list.innerHTML = '';
    for (const r of RECIPES) {
      const ok = canCraft(p.inv, r);
      const el = document.createElement('div');
      el.className = 'recipe ' + (ok ? 'ok' : 'no');
      const n = document.createElement('div');
      n.className = 'rn';
      n.textContent = (ok ? '✔ ' : '✖ ') + r.name;
      const c = document.createElement('div');
      c.className = 'rc';
      c.textContent = 'needs: ' + r.in.map(([id, q]) => `${ITEMS[id].name} x${q}`).join(', ') +
        `  →  ${ITEMS[r.out[0]].name} x${r.out[1]}`;
      el.appendChild(n); el.appendChild(c);
      el.addEventListener('click', () => { if (ok) { g.craft(r); this.refresh(); } else g.log('Missing materials.', 'warn'); });
      this.list.appendChild(el);
    }
  }
}
