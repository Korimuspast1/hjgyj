// Player entity: movement, stamina, needs, inventory, weapons
import { moveEntity } from './physics.js';
import { ITEMS, addToInventory, removeItem, countItem } from './items.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = 6;
    this.hp = 100; this.maxHp = 100;
    this.stamina = 100;
    this.food = 100; this.thirst = 100;
    this.bleeding = 0;
    this.painkillerT = 0;
    this.morale = 60;
    this.dirX = 0; this.dirY = 1;
    this.aim = 0;
    this.phase = 0; this.moving = false;
    this.sprinting = false; this.crouch = false;
    this.inv = [];
    this.weapon = null;          // {id, kind:'melee'|'gun', ammo, magSize}
    this.flashlight = false;
    this.attackCd = 0;
    this.swingT = 0;
    this.reloadT = 0;
    this.xp = 0; this.level = 1; this.kills = 0;
    this.hurtFlash = 0;
    this.dead = false;
    this.busy = 0; this.busyTarget = null;
    this.noiseT = 0;
    this.stepT = 0;
    this.lightOn = false;
    this.hasLight = false;
    this.fireCd = 0;
    this.lastDamageTime = -999;
    this.sleeping = false;
    this.exhaustWarn = 0;
  }

  get xpNeeded() { return this.level * 100; }

  addXp(n) {
    this.xp += n;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.maxHp += 5;
      this.hp = Math.min(this.maxHp, this.hp + 15);
      return true;
    }
    return false;
  }

  update(game, dt) {
    const inp = game.input;
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.swingT = Math.max(0, this.swingT - dt);
    this.fireCd = Math.max(0, this.fireCd - dt);
    this.exhaustWarn = Math.max(0, (this.exhaustWarn || 0) - dt);

    // --------------------------------------------------- input direction
    let ix = 0, iy = 0;
    if (!this.sleeping) {
      if (inp.isDown('KeyW') || inp.isDown('ArrowUp')) iy--;
      if (inp.isDown('KeyS') || inp.isDown('ArrowDown')) iy++;
      if (inp.isDown('KeyA') || inp.isDown('ArrowLeft')) ix--;
      if (inp.isDown('KeyD') || inp.isDown('ArrowRight')) ix++;
    }
    const mag = Math.hypot(ix, iy);
    if (mag > 0) { ix /= mag; iy /= mag; }

    this.crouch = (inp.isDown('ControlLeft') || inp.isDown('ControlRight')) && !this.busy;
    const wantSprint = (inp.isDown('ShiftLeft') || inp.isDown('ShiftRight')) && !this.crouch && mag > 0 && this.stamina > 2;
    this.sprinting = wantSprint;

    let speed = 52;
    if (this.crouch) speed = 25;
    else if (wantSprint) speed = 92;
    if (this.busy > 0) speed *= 0.35;
    if (this.swingT > 0) speed *= 0.55;

    const accel = 14;
    const k = Math.min(1, accel * dt);
    this.vx += (ix * speed - this.vx) * k;
    this.vy += (iy * speed - this.vy) * k;
    if (mag === 0) { this.vx *= Math.pow(0.0001, dt); this.vy *= Math.pow(0.0001, dt); }

    moveEntity(game.world, this, this.vx * dt, this.vy * dt);

    const spd = Math.hypot(this.vx, this.vy);
    this.moving = spd > 3;
    if (this.moving) {
      this.phase += dt * (this.sprinting ? 13 : this.crouch ? 6 : 9);
      if (mag > 0) { this.dirX = ix; this.dirY = iy; }
    }

    // aim follows the mouse
    const mw = game.mouseWorld();
    this.aim = Math.atan2(mw.y - this.y, mw.x - this.x);

    // --------------------------------------------------- stamina
    if (wantSprint) this.stamina = Math.max(0, this.stamina - 16 * dt);
    else this.stamina = Math.min(100, this.stamina + (this.crouch ? 12 : 8) * dt);

    // --------------------------------------------------- needs
    const gpm = game.minutesPerSecond;
    this.food = Math.max(0, this.food - 0.05 * gpm * dt);
    this.thirst = Math.max(0, this.thirst - 0.09 * gpm * dt);
    if (this.bleeding > 0) {
      this.hp -= this.bleeding * 0.55 * dt;
      this.bleeding = Math.max(0, this.bleeding - 0.035 * dt);
    }
    if (this.painkillerT > 0) {
      this.painkillerT -= dt;
      this.hp = Math.min(this.maxHp, this.hp + 0.45 * dt);
    }
    if (this.food <= 0 || this.thirst <= 0) {
      this.hp -= 0.55 * dt;
    } else if (this.food > 45 && this.thirst > 45 && this.bleeding <= 0 && this.hp < this.maxHp) {
      this.hp = Math.min(this.maxHp, this.hp + 0.22 * dt);
    }
    this.hp = Math.max(0, Math.min(this.maxHp, this.hp));
    if (this.hp <= 0) { this.dead = true; }

    // --------------------------------------------------- noise
    this.noiseT -= dt;
    if (this.noiseT <= 0 && this.moving) {
      const n = this.sprinting ? 95 : this.crouch ? 14 : 34;
      this.noiseT = this.sprinting ? 0.42 : 0.7;
      game.makeNoise(this.x, this.y, n, 'step');
      if (this.sprinting) {
        this.stepT -= dt;
        if (this.stepT <= 0) { this.stepT = 0.34; game.sfx.footstep(true); }
      }
    }
  }

  damage(amount, game, cause = 'zombie') {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtFlash = 1;
    this.lastDamageTime = game.time;
    game.sfx.playerHurt();
    game.flashDamage();
    if (Math.random() < 0.35 + amount * 0.012) {
      this.bleeding = Math.min(2.5, this.bleeding + 0.5 + amount * 0.012);
    }
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }

  // -------------------------------------------------------------- items
  useItem(game, index) {
    const s = this.inv[index];
    if (!s) return;
    const def = ITEMS[s.id];
    if (!def) return;
    if (def.cat === 'food' || def.cat === 'drink') {
      this.food = Math.min(100, this.food + (def.food || 0));
      this.thirst = Math.min(100, this.thirst + (def.thirst || 0));
      if (def.morale) this.morale = Math.min(100, this.morale + def.morale);
      game.sfx.eat();
      game.log(`You eat the ${def.name.toLowerCase()}.`, 'good');
    } else if (def.cat === 'med') {
      if (def.heal) this.heal(def.heal);
      if (def.stopBleed) this.bleeding = 0;
      if (def.painkiller) this.painkillerT = 25;
      game.sfx.heal();
      game.log(`You use the ${def.name.toLowerCase()}.`, 'good');
    } else if (def.throwable) {
      throwItem(game, this, s.id);
    } else if (def.light) {
      this.flashlight = !this.flashlight;
      game.log(`Torch ${this.flashlight ? 'lit' : 'out'}.`);
    } else {
      game.log(`You cannot use the ${def.name.toLowerCase()} right now.`, 'warn');
      return;
    }
    s.count--;
    if (s.count <= 0) this.inv.splice(index, 1);
  }

  equip(index, game) {
    const s = this.inv[index];
    if (!s) return;
    const def = ITEMS[s.id];
    if (!def) return;
    if (def.cat === 'weapon') {
      if (this.weapon && this.weapon.id === s.id) return;
      const prev = this.weapon;
      this.inv.splice(index, 1);
      if (prev) this.inv.push({ id: prev.id, count: 1 });
      this.weapon = makeWeapon(def);
      game.sfx.ui();
      game.log(`Equipped ${def.name}.`);
    }
  }

  unequip(game) {
    if (!this.weapon) return;
    if (this.inv.length >= 40) return;
    this.inv.push({ id: this.weapon.id, count: 1 });
    this.weapon = null;
    game.sfx.ui();
  }
}

export function makeWeapon(def) {
  if (def.gun) {
    const g = def.gun;
    const magSize = { pistol: 12, shotgun: 6, rifle: 10 }[g] || 10;
    return { id: def.id, kind: 'gun', gun: g, ammo: 0, magSize, dmg: def.dmg, noise: def.noise, pellets: def.pellets || 1, spread: def.spread || 0.04 };
  }
  return { id: def.id, kind: 'melee', dmg: def.dmg || 12, reach: def.reach || 24, knock: def.knock || 60, breakDoor: !!def.breakDoor };
}

export function throwItem(game, player, id) {
  const speed = 260;
  const a = player.aim;
  game.bullets.push({
    x: player.x, y: player.y - 4,
    vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
    life: 1.4, dmg: 0, owner: 'player', kind: 'throwable', item: id
  });
  game.sfx.swing();
}
