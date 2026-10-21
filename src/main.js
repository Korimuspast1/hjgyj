// DEADBLOCK — main game loop and systems
import { Input } from './core/input.js';
import { Sfx } from './core/audio.js';
import { Particles } from './core/particles.js';
import { mulberry32, randInt, chance, pick } from './core/rng.js';
import { buildAtlas, TILE, TS } from './world/tiles.js';
import { generateWorld } from './world/generate.js';
import { renderWorld } from './world/render.js';
import { computeLightGrid, lightLevelAt, renderLighting, ambientFor } from './world/light.js';
import { Player } from './game/player.js';
import { Zombie, ZTYPES } from './game/zombie.js';
import { playerAttack, startReload, finishReload, updateBullets, updateFires } from './game/combat.js';
import { separate, losClear, solidAt } from './game/physics.js';
import { ITEMS, addToInventory, countItem, removeItem } from './game/items.js';
import { rollLoot } from './game/loot.js';
import { HUD } from './ui/hud.js';
import { InventoryUI, CraftUI } from './ui/inventory.js';
import { Minimap } from './ui/minimap.js';

const MINUTES_PER_SECOND = 1.4;

class Game {
  constructor() {
    this.canvas = document.getElementById('screen');
    this.ctx = this.canvas.getContext('2d');
    this.lightCanvas = document.createElement('canvas');
    this.lightCtx = this.lightCanvas.getContext('2d');
    this.input = new Input(this.canvas);
    this.sfx = new Sfx();
    this.particles = new Particles();
    this.atlas = buildAtlas(20241021);
    this.state = 'menu';
    this.zoom = 3;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.time = 8 * 60;
    this.day = 1;
    this.minutesPerSecond = MINUTES_PER_SECOND;
    this.zombies = [];
    this.bullets = [];
    this.fires = [];
    this.groundItems = [];
    this.decals = [];
    this.dynamicLights = [];
    this.noises = [];
    this.shake = 0;
    this.uiOpen = null;
    this.currentPrompt = null;
    this.interact = null;
    this.difficulty = 1;
    this.weather = 'clear';
    this.weatherT = 120;
    this.rainDrops = [];
    this.sleeping = false;
    this.rng = mulberry32(1);
    this.spawnTimer = 0;
    this.lightTimer = 0;
    this.ambient = ambientFor(this.time);
    this.ambientLevel = 1;
    this.isNight = false;
    this.lightGrid = null;

    // helpers exposed to the entity systems
    this.lightLevelAt = (x, y) => lightLevelAt(this, x, y);
    this.losClear = (x0, y0, x1, y1) => losClear(this.world, x0, y0, x1, y1);
    this.flashDamage = () => { if (this.player) this.player.hurtFlash = Math.max(this.player.hurtFlash, 0.85); };

    this.hud = new HUD(this);
    this.invUI = new InventoryUI(this);
    this.craftUI = new CraftUI(this);
    this.minimap = new Minimap(this);

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindUI();

    document.getElementById('menu').classList.remove('hidden');
    this.buildPreview();
    this.loop = this.loop.bind(this);
    this.last = performance.now();
    requestAnimationFrame(this.loop);
  }

  // ---------------------------------------------------------------- setup
  buildPreview() {
    // a living city behind the main menu
    this.preview = true;
    this.world = generateWorld((Math.random() * 1e9) | 0);
    this.player = { x: 0, y: 0, r: 6, dirX: 0, dirY: 1, moving: false, phase: 0, aim: 0, hurtFlash: 0, inv: [], weapon: null, flashlight: false, crouch: false, sprinting: false, bleeding: 0, food: 100, thirst: 100, stamina: 100, hp: 100, maxHp: 100, level: 1, xp: 0, xpNeeded: 100, kills: 0, busy: 0, reloadT: 0 };
    const w = this.world;
    this.cam = { x: w.w * TS * 0.5, y: w.h * TS * 0.5 };
    this.previewAngle = 0;
    this.zombies = [];
    this.groundItems = [];
    this.decals = [];
    this.bullets = [];
    this.fires = [];
    this.lightTimer = 0;
    this.time = 18 * 60 + 40;
    this.updateAmbient();
    computeLightGrid(this);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.lightCanvas.width = this.canvas.width;
    this.lightCanvas.height = this.canvas.height;
    this.canvasW = this.canvas.width;
    this.canvasH = this.canvas.height;
    this.viewW = w / this.zoom;
    this.viewH = h / this.zoom;
    this.ctx.imageSmoothingEnabled = false;
    this.lightCtx.imageSmoothingEnabled = false;
  }

  bindUI() {
    document.getElementById('btn-start').addEventListener('click', () => {
      const seedTxt = document.getElementById('seed-input').value.trim();
      const seed = seedTxt ? (isNaN(Number(seedTxt)) ? hashString(seedTxt) : Number(seedTxt)) : (Math.random() * 1e9) | 0;
      const diff = parseInt(document.getElementById('diff-input').value, 10);
      document.getElementById('menu').classList.add('hidden');
      this.start(seed, diff);
      this.sfx.ensure();
      this.sfx.ui();
    });
    document.getElementById('btn-resume').addEventListener('click', () => this.closeUI());
    document.getElementById('btn-quit').addEventListener('click', () => this.toMenu());
    document.getElementById('btn-retry').addEventListener('click', () => {
      document.getElementById('dead').classList.add('hidden');
      this.start(this.seed, this.difficulty);
    });
    document.getElementById('btn-menu').addEventListener('click', () => {
      document.getElementById('dead').classList.add('hidden');
      this.toMenu();
    });
    document.getElementById('vol-input').addEventListener('input', (e) => this.sfx.setVolume(e.target.value / 100));
    document.getElementById('zoom-input').addEventListener('input', (e) => {
      this.zoom = parseInt(e.target.value, 10);
      this.resize();
    });
    document.querySelectorAll('[data-close]').forEach(b => {
      b.addEventListener('click', () => this.closeUI());
    });
  }

  start(seed, difficulty) {
    this.seed = seed;
    this.difficulty = difficulty;
    this.rng = mulberry32(seed ^ 0x9e3779b9);
    this.world = generateWorld(seed);
    this.time = 8 * 60;
    this.day = 1;
    this.zombies = [];
    this.bullets = [];
    this.fires = [];
    this.groundItems = [];
    this.decals = [];
    this.noises = [];
    this.shake = 0;
    this.particles.list.length = 0;

    // player spawn inside a house
    const spawn = this.findPlayerSpawn();
    this.player = new Player(spawn.x, spawn.y);
    this.player.inv.push({ id: 'bandage', count: 1 });
    this.player.inv.push({ id: 'soda', count: 1 });
    this.player.inv.push({ id: 'jerky', count: 1 });

    this.cam = { x: spawn.x, y: spawn.y };
    this.preview = false;
    this.state = 'play';
    this.uiOpen = null;
    this.input.blocked = false;
    this.hud.show();
    this.hud.clearLog();
    this.minimap.dirty = true;
    this.populate();
    this.updateAmbient();
    this.hud.log('You wake up in an empty house. Day 1.', 'warn');
    this.hud.log('Find food, water and a weapon. Stay quiet.', '');
  }

  toMenu() {
    this.state = 'menu';
    this.buildPreview();
    this.hud.hide();
    document.getElementById('menu').classList.remove('hidden');
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('inventory').classList.add('hidden');
    document.getElementById('crafting').classList.add('hidden');
    document.getElementById('mapview').classList.add('hidden');
    this.uiOpen = null;
    this.input.blocked = true;
  }

  findPlayerSpawn() {
    const houses = this.world.houses.filter(h => h.style === 'house');
    const pool = houses.length ? houses : this.world.houses;
    for (let attempt = 0; attempt < 40; attempt++) {
      const h = pool[(this.rng() * pool.length) | 0];
      if (!h) break;
      const x = h.x0 + 1 + ((this.rng() * Math.max(1, h.x1 - h.x0 - 1)) | 0);
      const y = h.y0 + 1 + ((this.rng() * Math.max(1, h.y1 - h.y0 - 1)) | 0);
      const wx = x * TS + 8, wy = y * TS + 8;
      if (!solidAt(this.world, x, y)) return { x: wx, y: wy };
    }
    return { x: 200, y: 200 };
  }

  populate() {
    const count = 90 + this.difficulty * 25;
    for (let i = 0; i < count; i++) {
      const z = this.spawnZombie(true);
      if (!z) break;
    }
  }

  zombieType() {
    const dayFactor = Math.min(0.85, this.day * 0.07);
    const r = this.rng();
    if (r < 0.05 + dayFactor * 0.12) return 'brute';
    if (r < 0.20 + dayFactor * 0.35) return 'runner';
    if (r < 0.36 + dayFactor * 0.30) return 'crawler';
    return 'walker';
  }

  spawnZombie(anywhere = false) {
    const spots = this.world.spawnSpots;
    if (!spots.length) return null;
    const type = this.zombieType();
    for (let i = 0; i < 60; i++) {
      const s = spots[(this.rng() * spots.length) | 0];
      const d = Math.hypot(s.x - this.player.x, s.y - this.player.y);
      if (!anywhere && d < 280) continue;
      if (anywhere && d < 180) continue;
      const z = new Zombie(s.x, s.y, type, this.rng);
      this.zombies.push(z);
      return z;
    }
    return null;
  }

  // PZ-style: zombies creep in around the survivor
  spawnZombieNearPlayer() {
    const p = this.player;
    const type = this.zombieType();
    for (let i = 0; i < 50; i++) {
      const a = this.rng() * Math.PI * 2;
      const d = 230 + this.rng() * 330;
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const tx = Math.floor(x / TS), ty = Math.floor(y / TS);
      if (tx < 2 || ty < 2 || tx >= this.world.w - 2 || ty >= this.world.h - 2) continue;
      if (solidAt(this.world, tx, ty)) continue;
      const z = new Zombie(x, y, type, this.rng);
      this.zombies.push(z);
      return z;
    }
    return null;
  }

  // ---------------------------------------------------------------- loop
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps ? this.fps * 0.92 + (1 / Math.max(0.0001, dt)) * 0.08 : 60;
    if (this.state === 'menu' && this.preview) {
      this.previewAngle += dt * 0.06;
      const w = this.world;
      const cx = w.w * TS * 0.5, cy = w.h * TS * 0.5;
      this.cam.x = cx + Math.cos(this.previewAngle) * w.w * TS * 0.18;
      this.cam.y = cy + Math.sin(this.previewAngle * 0.8) * w.h * TS * 0.18;
      this.time += dt * 2;
      this.updateAmbient();
      if (this.lightTimer === undefined || this.lightTimer-- <= 0) { this.lightTimer = 0.4; computeLightGrid(this); }
      this.render();
    }
    if (this.state === 'play') {
      this.handleKeys();
      if (!this.uiOpen) this.update(dt);
      else this.updateIdle(dt);
      this.render();
      this.hud.update();
      this.minimap.draw();
      if (this.uiOpen === 'inventory') this.invUI.refresh();
    }
    this.input.endFrame();
    requestAnimationFrame(this.loop);
  }

  updateIdle(dt) {
    // UI open: the world is frozen so you can think
    this.particles.update(dt);
    this.subT = Math.max(0, (this.subT || 0) - dt);
    if (this.subT <= 0) document.getElementById('subtitle').textContent = '';
  }

  showSubtitle(text, secs = 4) {
    const el = document.getElementById('subtitle');
    el.textContent = text;
    this.subT = secs;
  }

  update(dt) {
    const inp = this.input;

    // time & day cycle (time runs much faster while sleeping)
    if (this.sleeping) {
      this.time += dt * this.minutesPerSecond * 26;
      if (this.player.hp < (this.sleepHp || 100) - 0.5 && !this.player.dead) this.wakeUp(true);
      if (this.time >= this.wakeAtAbs) this.wakeUp(false);
    } else {
      this.time += dt * this.minutesPerSecond;
    }
    this.checkDay();
    this.updateAmbient();
    this.updateWeather(dt);

    // player
    this.player.update(this, dt);
    if (this.player.dead) { this.onDeath(); return; }

    // zombies
    for (const z of this.zombies) z.update(this, dt);
    separate(this.zombies.filter(z => !z.dead), 0.9);

    // bullets / fires / particles
    updateBullets(this, dt);
    updateFires(this, dt);
    this.particles.update(dt);

    // noise events
    for (let i = this.noises.length - 1; i >= 0; i--) {
      const n = this.noises[i];
      n.life -= dt;
      if (n.life <= 0) this.noises.splice(i, 1);
    }

    // clean corpses
    for (let i = this.zombies.length - 1; i >= 0; i--) {
      const z = this.zombies[i];
      if (z.dead && z.deadT > 120) {
        this.decals.push({ x: z.x, y: z.y, r: 7 + Math.random() * 6, c: '#4e1010', a: 0.55 });
        this.zombies.splice(i, 1);
      }
    }
    if (this.decals.length > 300) this.decals.splice(0, this.decals.length - 300);

    // dynamic lights fade
    for (let i = this.dynamicLights.length - 1; i >= 0; i--) {
      const L = this.dynamicLights[i];
      L.life -= dt;
      if (L.life <= 0) this.dynamicLights.splice(i, 1);
    }

    // zombie population management
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.isNight ? 1.6 : 4.5;
      const target = 90 + this.day * 8 + this.difficulty * 20 + (this.isNight ? 30 : 0);
      const alive = this.zombies.filter(z => !z.dead).length;
      if (alive < target) {
        if (chance(this.rng, 0.6)) this.spawnZombieNearPlayer();
        else this.spawnZombie();
      }
    }

    // light grid refresh
    this.lightTimer -= dt;
    if (this.lightTimer <= 0) {
      this.lightTimer = 0.2;
      computeLightGrid(this);
    }

    // camera
    const p = this.player;
    this.cam.x += (p.x - this.cam.x) * Math.min(1, dt * 9);
    this.cam.y += (p.y - this.cam.y) * Math.min(1, dt * 9);
    const maxX = this.world.w * TS, maxY = this.world.h * TS;
    this.cam.x = Math.max(this.viewW / 2, Math.min(maxX - this.viewW / 2, this.cam.x));
    this.cam.y = Math.max(this.viewH / 2, Math.min(maxY - this.viewH / 2, this.cam.y));
    this.shake = Math.max(0, this.shake - dt * 14);

    // interaction prompt
    this.interact = this.findInteraction();
    this.currentPrompt = this.promptFor(this.interact);
    if (this.interact && this.interact.type === 'container' && inp.isDown('KeyE')) {
      this.player.busy += dt;
      if (this.player.busy > 1.3) {
        this.player.busy = 0;
        this.searchContainer(this.interact.c);
      }
    } else if (this.player.busy > 0) {
      this.player.busy = Math.max(0, this.player.busy - dt * 2);
    }

    // combat input
    if (inp.mouse.down || inp.isDown('Space')) playerAttack(this);
    if (this.player.reloadT > 0) {
      this.player.reloadT -= dt;
      if (this.player.reloadT <= 0) { this.player.reloadT = 0; finishReload(this); }
    }
  }

  handleKeys() {
    const inp = this.input;
    if (this.sleeping) {
      if (inp.wasPressed('KeyE') || inp.wasPressed('Space') || inp.wasPressed('Escape')) this.wakeUp(false);
    }
    if (inp.wasPressed('Escape')) {
      if (this.uiOpen) this.closeUI();
      else this.openUI('pause');
    }
    if (inp.wasPressed('Tab')) { this.uiOpen === 'inventory' ? this.closeUI() : this.openUI('inventory'); }
    if (inp.wasPressed('KeyC')) { this.uiOpen === 'crafting' ? this.closeUI() : this.openUI('crafting'); }
    if (inp.wasPressed('KeyM')) { this.uiOpen === 'mapview' ? this.closeUI() : this.openUI('mapview'); }
    if (this.uiOpen) return;

    if (inp.wasPressed('KeyE')) this.doInteract();
    if (inp.wasPressed('KeyR')) startReload(this);
    if (inp.wasPressed('KeyF')) this.toggleLight();
    for (let i = 0; i < 5; i++) {
      if (inp.wasPressed('Digit' + (i + 1))) {
        const st = this.player.inv[i];
        if (st) { this.player.useItem(this, i); this.hud.update(); }
      }
    }
  }

  toggleLight() {
    const p = this.player;
    const hasTorch = countItem(p.inv, 'flashlight') > 0;
    const hasFlame = countItem(p.inv, 'torch') > 0;
    if (!hasTorch && !hasFlame) { this.log('You have no light source.', 'warn'); return; }
    p.flashlight = !p.flashlight;
    this.log(p.flashlight ? 'You switch the light on.' : 'You switch the light off.');
    this.sfx.ui();
  }

  doInteract() {
    if (!this.interact) return;
    const it = this.interact;
    if (it.type === 'item') {
      const idx = this.groundItems.indexOf(it.item);
      if (idx < 0) return;
      const g = this.groundItems[idx];
      const added = addToInventory(this.player.inv, g.id, g.count);
      if (added > 0) {
        g.count -= added;
        if (g.count <= 0) this.groundItems.splice(idx, 1);
        this.log(`Picked up ${ITEMS[g.id].name}.`, 'good');
        this.sfx.pickup();
      } else {
        this.log('No room in your backpack.', 'warn');
      }
    } else if (it.type === 'door') {
      const d = it.door;
      d.open = !d.open;
      this.sfx.door();
      this.log(d.open ? 'You open the door.' : 'You close the door.');
    } else if (it.type === 'container') {
      this.player.busy = 0.01;
    } else if (it.type === 'bed') {
      if (this.sleeping) this.wakeUp(false);
      else this.sleep();
    }
  }

  findInteraction() {
    const p = this.player;
    // ground items first
    let best = null, bestD = 18;
    for (const g of this.groundItems) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < bestD) { bestD = d; best = { type: 'item', item: g, d }; }
    }
    if (best) return best;
    // containers
    bestD = 22;
    for (const c of this.world.containers) {
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestD) { bestD = d; best = { type: 'container', c, d }; }
    }
    if (best) return best;
    // bed near the player
    const btx = Math.floor(p.x / TS), bty = Math.floor(p.y / TS);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = btx + dx, y = bty + dy;
        if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) continue;
        if (this.world.tiles[y * this.world.w + x] !== TILE.BED) continue;
        const dd = Math.hypot(x * TS + 8 - p.x, y * TS + 8 - p.y);
        if (dd < 26) return { type: 'bed', d: dd };
      }
    }
    // door near the player
    const tx = Math.floor(p.x / TS), ty = Math.floor(p.y / TS);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tx + dx, y = ty + dy;
        if (x < 0 || y < 0 || x >= this.world.w || y >= this.world.h) continue;
        if (this.world.tiles[y * this.world.w + x] !== TILE.DOOR) continue;
        const d = this.world.doors.get(y * this.world.w + x);
        if (!d || d.broken) continue;
        const dd = Math.hypot(x * TS + 8 - p.x, y * TS + 8 - p.y);
        if (dd < 26) return { type: 'door', door: d, d: dd };
      }
    }
    return null;
  }

  promptFor(it) {
    if (!it) return null;
    if (it.type === 'item') return `<b>E</b> — pick up ${ITEMS[it.item.id].name}`;
    if (it.type === 'container') {
      if (this.player.busy > 0) {
        const pct = Math.min(100, (this.player.busy / 1.3) * 100);
        return `searching… <b>${Math.round(pct)}%</b>`;
      }
      return `<b>E</b> — search ${it.c.name.toLowerCase()}`;
    }
    if (it.type === 'door') return `<b>E</b> — ${it.door.open ? 'close' : 'open'} door`;
    if (it.type === 'bed') return this.sleeping ? `<b>E</b> — get up` : `<b>E</b> — sleep until dawn`;
    return null;
  }

  searchContainer(c) {
    if (c.searched) {
      this.log(`${c.name} is empty.`, '');
      return;
    }
    c.searched = true;
    const loot = rollLoot(this.rng, c.type, c.level);
    let taken = 0;
    for (const l of loot) {
      const added = addToInventory(this.player.inv, l.id, l.count);
      if (added > 0) {
        taken++;
        this.log(`Found ${ITEMS[l.id].name} x${added}.`, 'good');
      } else {
        this.groundItems.push({ x: c.x + (Math.random() - 0.5) * 10, y: c.y + 8 + (Math.random() - 0.5) * 6, id: l.id, count: l.count });
      }
    }
    if (!taken) this.log(`${c.name}: nothing useful.`, '');
    this.makeNoise(c.x, c.y, 60, 'search');
    this.sfx.pickup();
  }

  // ---------------------------------------------------------------- systems
  makeNoise(x, y, radius, kind) {
    this.noises.push({ x, y, r: radius, life: 0.3 });
    for (const z of this.zombies) {
      if (z.dead) continue;
      if (z.state === 'chase' || z.state === 'attack') continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d > radius) continue;
      if (!losClear(this.world, z.x, z.y, x, y) && d > radius * 0.6) continue;
      z.state = 'alert';
      z.targetX = x + (Math.random() - 0.5) * 20;
      z.targetY = y + (Math.random() - 0.5) * 20;
      z.memory = 7;
    }
  }

  muzzleFlash(x, y) {
    this.dynamicLights.push({ x, y, r: 90, i: 0.95, life: 0.07 });
  }

  ignite(x, y) {
    this.fires.push({ x, y, life: 7, r: 10 });
    this.dynamicLights.push({ x, y, r: 60, i: 0.7, life: 0.5 });
    this.sfx.molotov();
    for (const z of this.zombies) {
      if (z.dead) continue;
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < 46) z.hurt(this, 25, Math.atan2(z.y - y, z.x - x), 40);
    }
  }

  onZombieKilled(z) {
    const p = this.player;
    p.kills++;
    const leveled = p.addXp(z.def.xp);
    if (leveled) {
      this.log(`Level up! You are now level ${p.level}.`, 'good');
      this.sfx.levelUp();
    }
    this.decals.push({ x: z.x, y: z.y, r: 6 + Math.random() * 5, c: '#551010', a: 0.6 });
    if (chance(this.rng, 0.14)) {
      const pool = ['canned_food', 'soda', 'ammo_pistol', 'cloth', 'nails', 'bandage', 'battery'];
      const id = pick(this.rng, pool);
      this.groundItems.push({ x: z.x + (Math.random() - 0.5) * 8, y: z.y + 6, id, count: 1 });
    }
  }

  craft(recipe) {
    const p = this.player;
    for (const [id, n] of recipe.in) removeItem(p.inv, id, n);
    addToInventory(p.inv, recipe.out[0], recipe.out[1]);
    this.log(`Crafted ${ITEMS[recipe.out[0]].name} x${recipe.out[1]}.`, 'good');
    this.sfx.pickup();
  }

  checkDay() {
    const day = 1 + Math.floor(this.time / 1440);
    if (day !== this.day) {
      this.day = day;
      this.hud.log(`Day ${day}. You survived another night.`, 'good');
      this.showSubtitle(`Day ${day} — you survived the night.`);
      this.sfx.levelUp();
    }
  }

  updateWeather(dt) {
    this.weatherT -= dt;
    if (this.weatherT <= 0) {
      this.weatherT = 90 + this.rng() * 240;
      const r = this.rng();
      const prev = this.weather;
      this.weather = r < 0.45 ? 'clear' : r < 0.72 ? 'overcast' : 'rain';
      if (this.weather !== prev) {
        this.hud.log(this.weather === 'rain' ? 'It starts to rain.' :
          this.weather === 'overcast' ? 'The clouds roll in.' : 'The sky clears up.', '');
        if (this.weather === 'rain') this.sfx.startRain(); else this.sfx.stopRain();
      }
    }
    // rain drops in screen space
    if (this.weather === 'rain') {
      const n = Math.min(220, Math.round(this.canvasW / 9));
      while (this.rainDrops.length < n) this.rainDrops.push(this.newDrop(true));
      for (const d of this.rainDrops) {
        d.y += d.v * dt;
        d.x += d.wind * dt;
        if (d.y > this.canvasH + 10) Object.assign(d, this.newDrop(false));
      }
    } else if (this.rainDrops.length) {
      this.rainDrops.length = 0;
    }
    // overcast dims the world a bit
    if (this.weather !== 'clear') {
      const dim = this.weather === 'rain' ? 0.72 : 0.85;
      this.ambient.c = this.ambient.c.map(c => Math.round(c * dim));
    }
  }

  newDrop(anywhere) {
    return {
      x: this.rng() * (this.canvasW + 200) - 100,
      y: anywhere ? this.rng() * this.canvasH : -20 - this.rng() * 60,
      v: 420 + this.rng() * 260,
      wind: -60 - this.rng() * 40,
      len: 6 + this.rng() * 9,
    };
  }

  wakeUp(attacked) {
    if (!this.sleeping) return;
    this.sleeping = false;
    this.player.sleeping = false;
    this.hud.log(attacked ? 'You wake up in a panic!' : 'You wake up at dawn.', attacked ? 'bad' : 'good');
  }

  sleep() {
    const p = this.player;
    this.sleeping = true;
    p.sleeping = true;
    this.sleepHp = p.hp;
    this.hud.log('You lie down to sleep...', '');
    // wake at 6:00
    const cur = this.time % 1440;
    const dayStart = Math.floor(this.time / 1440) * 1440;
    this.wakeAtAbs = dayStart + (cur < 360 ? 360 : 1440 + 360);
  }

  updateAmbient() {
    this.ambient = ambientFor(this.time);
    const night = this.ambient.night;
    if (night !== this.isNight) {
      this.isNight = night;
      if (this.state === 'play') this.showSubtitle(night ? 'Night falls. They can smell fear.' : 'Dawn breaks. The streets are quiet... for now.');
    }
    this.ambientLevel = (this.ambient.c[0] + this.ambient.c[1] + this.ambient.c[2]) / (3 * 255);
  }

  onDeath() {
    this.state = 'dead';
    this.sfx.zombieDie();
    const info = document.getElementById('dead-info');
    info.innerHTML = `You died on Day ${this.day}, ${Math.floor((this.time % 1440) / 60)}:${String(Math.floor(this.time % 60)).padStart(2, '0')}.<br>` +
      `Zombies killed: ${this.player.kills} · Level ${this.player.level} · Seed ${this.seed}`;
    document.getElementById('dead').classList.remove('hidden');
    this.hud.hide();
  }

  // ---------------------------------------------------------------- ui
  openUI(which) {
    this.uiOpen = which;
    this.input.blocked = true;
    if (which === 'pause') {
      document.getElementById('pause').classList.remove('hidden');
      this.sfx.ui();
    } else if (which === 'inventory') {
      document.getElementById('inventory').classList.remove('hidden');
      this.invUI.refresh();
      this.sfx.ui();
    } else if (which === 'crafting') {
      document.getElementById('crafting').classList.remove('hidden');
      this.craftUI.refresh();
      this.sfx.ui();
    } else if (which === 'mapview') {
      document.getElementById('mapview').classList.remove('hidden');
      this.minimap.drawBig();
      this.sfx.ui();
    }
  }

  closeUI() {
    if (!this.uiOpen) return;
    ['pause', 'inventory', 'crafting', 'mapview'].forEach(id => document.getElementById(id).classList.add('hidden'));
    this.uiOpen = null;
    this.input.blocked = false;
    this.sfx.ui();
  }

  log(text, cls) { this.hud.log(text, cls); }

  mouseWorld() {
    const r = this.canvas.getBoundingClientRect();
    const mx = (this.input.mouse.x + r.left) * this.dpr;
    const my = (this.input.mouse.y + r.top) * this.dpr;
    const scale = this.zoom * this.dpr;
    return {
      x: (mx - this.canvasW / 2) / scale + this.cam.x,
      y: (my - this.canvasH / 2) / scale + this.cam.y
    };
  }

  // ---------------------------------------------------------------- render
  render() {
    const ctx = this.ctx;
    const scale = this.zoom * this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    const shx = (Math.random() - 0.5) * this.shake;
    const shy = (Math.random() - 0.5) * this.shake;
    const camX = Math.round(this.cam.x + shx);
    const camY = Math.round(this.cam.y + shy);

    ctx.setTransform(scale, 0, 0, scale, -camX * scale + this.canvasW / 2, -camY * scale + this.canvasH / 2);
    const savedCam = this.cam;
    this.cam = { x: camX, y: camY };
    renderWorld(ctx, this);
    this.cam = savedCam;

    // bullets
    for (const b of this.bullets) {
      ctx.fillStyle = b.kind === 'throwable' ? '#d08a3a' : '#ffe9a8';
      ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
    }
    this.particles.draw(ctx);

    // fire glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const f of this.fires) {
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
      g.addColorStop(0, 'rgba(255,170,60,0.5)');
      g.addColorStop(1, 'rgba(255,90,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    renderLighting(ctx, this);

    // rain overlay
    if (this.weather === 'rain' && this.rainDrops.length) {
      ctx.strokeStyle = 'rgba(170,200,220,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const d of this.rainDrops) {
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.wind * 0.03, d.y + d.len);
      }
      ctx.stroke();
    }
  }
}

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

window.addEventListener('DOMContentLoaded', () => { window.game = new Game(); });
