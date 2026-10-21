// Melee, guns, bullets, fire
import { TILE, TS } from '../world/tiles.js';
import { GUNS, ITEMS, countItem, removeItem } from './items.js';

export function playerAttack(game) {
  const p = game.player;
  if (p.dead || p.attackCd > 0 || p.reloadT > 0) return;
  if (p.weapon && p.weapon.kind === 'gun') fireGun(game);
  else meleeSwing(game);
}

export function meleeSwing(game) {
  const p = game.player;
  if (p.stamina < 5) {
    if (p.exhaustWarn <= 0) { game.log('You are too exhausted to swing.', 'warn'); p.exhaustWarn = 4; }
    return;
  }
  p.stamina -= 5;
  p.attackCd = 0.42;
  p.swingT = 0.3;
  game.sfx.swing();

  const w = p.weapon;
  const reach = w ? w.reach : 20;
  const dmg = w ? w.dmg : 10;
  const knock = w ? w.knock : 45;
  let hitSomething = false;

  for (const z of game.zombies) {
    if (z.dead) continue;
    const dx = z.x - p.x, dy = z.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d > reach + z.r) continue;
    const a = Math.atan2(dy, dx);
    if (Math.abs(angleDiffLocal(a, p.aim)) > 1.0) continue;
    const dealt = dmg * (0.9 + Math.random() * 0.25);
    z.hurt(game, dealt, a, knock);
    game.particles.blood(z.x, z.y, dx, dy, 9);
    hitSomething = true;
  }

  // smash doors / windows next to you
  if (w && w.breakDoor) {
    const tx = Math.floor((p.x + Math.cos(p.aim) * 14) / TS);
    const ty = Math.floor((p.y + Math.sin(p.aim) * 14) / TS);
    const tile = game.world.tiles[ty * game.world.w + tx];
    if (tile === TILE.DOOR || tile === TILE.WINDOW || tile === TILE.GLASS) {
      const d = game.world.doors.get(ty * game.world.w + tx);
      if (d && !d.broken) {
        d.hp -= 30;
        game.sfx.wood();
        if (d.hp <= 0) {
          d.broken = true;
          if (tile === TILE.DOOR) {
            game.world.tiles[ty * game.world.w + tx] = TILE.FLOOR_CRACK;
            game.log('The door splinters.', 'warn');
          } else {
            game.world.tiles[ty * game.world.w + tx] = TILE.WINDOW;
            game.particles.spark(d.x * TS + 8, d.y * TS + 8, '#bfe6f0');
            game.sfx.glass();
            game.log('The window shatters.', 'warn');
          }
        }
      }
    }
  }
  if (hitSomething) game.sfx.hitFlesh();
}

function angleDiffLocal(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function fireGun(game) {
  const p = game.player;
  const w = p.weapon;
  if (!w || w.kind !== 'gun') return;
  if (p.reloadT > 0) return;
  if (w.ammo <= 0) {
    game.sfx.dryFire();
    game.log('Click. Empty.', 'warn');
    p.attackCd = 0.3;
    startReload(game);
    return;
  }
  const gdef = GUNS[w.gun] || GUNS.pistol;
  w.ammo--;
  p.attackCd = gdef.reload > 1.5 ? 0.85 : 0.32;
  const shots = w.pellets || 1;
  for (let i = 0; i < shots; i++) {
    const spread = (gdef.spread || 0.04) * (shots > 1 ? 1 : 1);
    const a = p.aim + (Math.random() - 0.5) * spread * 2;
    game.bullets.push({
      x: p.x + Math.cos(p.aim) * 7, y: p.y - 4 + Math.sin(p.aim) * 7,
      vx: Math.cos(a) * gdef.speed, vy: Math.sin(a) * gdef.speed,
      life: 1.1, dmg: w.dmg * (1 + Math.random() * 0.15), owner: 'player',
      kind: 'bullet', pierce: 0
    });
  }
  // recoil
  p.vx -= Math.cos(p.aim) * 26;
  p.vy -= Math.sin(p.aim) * 26;
  game.sfx.gunshot(w.gun);
  game.muzzleFlash(p.x + Math.cos(p.aim) * 8, p.y - 4 + Math.sin(p.aim) * 8);
  game.makeNoise(p.x, p.y, w.noise || 180, 'gunshot');
  game.particles.spark(p.x + Math.cos(p.aim) * 9, p.y - 4 + Math.sin(p.aim) * 9, '#ffd27a');
  if (w.gun === 'shotgun') game.shake = Math.max(game.shake, 5);
  else if (w.gun === 'rifle') game.shake = Math.max(game.shake, 3);
}

export function startReload(game) {
  const p = game.player;
  const w = p.weapon;
  if (!w || w.kind !== 'gun' || p.reloadT > 0) return;
  const gdef = GUNS[w.gun] || GUNS.pistol;
  const ammoId = gdef.ammo;
  const have = countItem(p.inv, ammoId);
  if (w.ammo >= w.magSize || have <= 0) return;
  p.reloadT = gdef.reload;
  game.sfx.reload();
  p.reloadTotal = gdef.reload;
}

export function finishReload(game) {
  const p = game.player;
  const w = p.weapon;
  const gdef = GUNS[w.gun] || GUNS.pistol;
  const ammoId = gdef.ammo;
  const need = w.magSize - w.ammo;
  const have = countItem(p.inv, ammoId);
  const take = Math.min(need, have);
  if (take > 0) {
    removeItem(p.inv, ammoId, take);
    w.ammo += take;
  }
  game.log(`Reloaded (${w.ammo}/${w.magSize}).`);
}

export function updateBullets(game, dt) {
  const w = game.world;
  for (let i = game.bullets.length - 1; i >= 0; i--) {
    const b = game.bullets[i];
    b.life -= dt;
    if (b.life <= 0) { game.bullets.splice(i, 1); continue; }
    const speed = Math.hypot(b.vx, b.vy);
    const steps = Math.max(1, Math.ceil((speed * dt) / 5));
    const sdt = dt / steps;
    let dead = false;
    for (let s = 0; s < steps && !dead; s++) {
      b.x += b.vx * sdt;
      b.y += b.vy * sdt;
      const tx = Math.floor(b.x / TS), ty = Math.floor(b.y / TS);

      if (b.kind === 'throwable') {
        // molotov: burst on contact
        const tile = w.tiles[ty * w.w + tx];
        const info = w.doors.get(ty * w.w + tx);
        if (tile === TILE.WALL || tile === TILE.WALL_BRICK || tile === TILE.WALL_EXT || tile === TILE.WINDOW || tile === TILE.GLASS) {
          game.ignite(b.x, b.y);
          dead = true; break;
        }
        continue;
      }

      // tile hit
      const tile = w.tiles[ty * w.w + tx];
      if (tile === TILE.WINDOW || tile === TILE.GLASS) {
        const d = w.doors.get(ty * w.w + tx);
        if (d && !d.broken) {
          d.broken = true;
          game.particles.spark(b.x, b.y, '#bfe6f0');
          game.sfx.glass();
          game.log('Glass breaks.', 'warn');
        }
        dead = true; break;
      }
      if (tile === TILE.DOOR) {
        const d = w.doors.get(ty * w.w + tx);
        if (d && !d.broken) { d.hp -= b.dmg * 0.6; game.sfx.wood(); }
        dead = true; break;
      }
      if (tile === TILE.WALL || tile === TILE.WALL_BRICK || tile === TILE.WALL_EXT || tile === TILE.FENCE || tile === TILE.CRATE || tile === TILE.BARREL || tile === TILE.SHELF) {
        game.particles.spark(b.x, b.y, '#cfcfb8');
        game.sfx.hitMetal();
        dead = true; break;
      }

      // zombie hit
      for (const z of game.zombies) {
        if (z.dead) continue;
        const dx = z.x - b.x, dy = z.y - b.y;
        const rr = z.r + 2;
        if (dx * dx + dy * dy > rr * rr) continue;
        const a = Math.atan2(b.vy, b.vx);
        z.hurt(game, b.dmg, a, 50);
        game.particles.blood(b.x, b.y, b.vx, b.vy, 8);
        game.sfx.hitFlesh();
        dead = true; break;
      }
    }
    if (dead) game.bullets.splice(i, 1);
  }
}

export function updateFires(game, dt) {
  for (let i = game.fires.length - 1; i >= 0; i--) {
    const f = game.fires[i];
    f.life -= dt;
    f.r = Math.min(f.r + 22 * dt, 46);
    if (f.life <= 0) { game.fires.splice(i, 1); continue; }
    game.particles.fire(f.x, f.y);
    for (const z of game.zombies) {
      if (z.dead) continue;
      const dx = z.x - f.x, dy = z.y - f.y;
      if (dx * dx + dy * dy > f.r * f.r) continue;
      z.hurt(game, 26 * dt, Math.atan2(dy, dx), 0);
      game.particles.blood(z.x, z.y, dx, dy, 1, '#ff7a2a');
    }
  }
}
