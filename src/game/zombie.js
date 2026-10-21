// Zombie entity + AI (idle / wander / alert / chase / attack / stagger)
import { moveEntity, losClear, angleDiff } from './physics.js';
import { TILE, TS } from '../world/tiles.js';

export const ZTYPES = {
  walker: {
    name: 'Walker', hp: 46, speed: 21, dmg: 11, r: 6, xp: 22, scale: 1,
    skins: ['#7d9068', '#8a9670', '#6f8460'], shirts: ['#4a4436', '#3d4a4a', '#54433a', '#45403f'], pants: ['#3a3d36', '#33353a']
  },
  runner: {
    name: 'Runner', hp: 30, speed: 47, dmg: 9, r: 5.5, xp: 28, scale: 0.95,
    skins: ['#8a9a6a', '#9aa070'], shirts: ['#6a3a34', '#7a4a2a', '#3f4a5a'], pants: ['#2e3238', '#3b3229']
  },
  crawler: {
    name: 'Crawler', hp: 22, speed: 40, dmg: 7, r: 4.5, xp: 18, scale: 0.8,
    skins: ['#86966c', '#7a8a62'], shirts: ['#5a4a3a', '#4a4a52'], pants: ['#3a3a34']
  },
  brute: {
    name: 'Brute', hp: 165, speed: 16, dmg: 27, r: 9, xp: 70, scale: 1.35,
    skins: ['#7a8a60', '#6a7a55'], shirts: ['#4a3f36', '#3a3f42'], pants: ['#33322c']
  },
};

let uid = 1;

export class Zombie {
  constructor(x, y, typeName, rng) {
    const t = ZTYPES[typeName] || ZTYPES.walker;
    this.id = uid++;
    this.type = typeName;
    this.def = t;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.r = t.r;
    this.hp = t.hp + (rng ? (rng() * 12 - 6) : 0);
    this.maxHp = this.hp;
    this.speed = t.speed * (0.88 + (rng ? rng() * 0.26 : 0.1));
    this.dmg = t.dmg * (0.85 + (rng ? rng() * 0.35 : 0.1));
    this.skin = t.skins[(rng ? rng() * t.skins.length : 0) | 0];
    this.shirt = t.shirts[(rng ? rng() * t.shirts.length : 0) | 0];
    this.pants = t.pants[(rng ? rng() * t.pants.length : 0) | 0];
    this.angle = rng ? rng() * Math.PI * 2 : 0;
    this.phase = rng ? rng() * 10 : 0;
    this.state = 'wander';
    this.targetX = x; this.targetY = y;
    this.memory = 0;
    this.attackCd = 0;
    this.windup = 0;
    this.stagger = 0;
    this.dead = false;
    this.deadT = 0;
    this.rot = 0;
    this.hurtFlash = 0;
    this.growlCd = rng ? rng() * 8 : 4;
    this.repathCd = 0;
    this.shoveCd = 0;
    this.detourT = 0;
    this.detourA = 0;
  }

  update(game, dt) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    if (this.dead) { this.deadT += dt; return; }

    const p = game.player;
    const dx = p.x - this.x, dy = p.y - this.y;
    const dist = Math.hypot(dx, dy);
    const toAngle = Math.atan2(dy, dx);
    this.repathCd -= dt;
    this.shoveCd -= dt;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.growlCd -= dt;

    // ------------------------------------------------------ senses
    const lit = game.lightLevelAt(this.x, this.y);
    const sightRange = 60 + lit * 150;
    let sees = false;
    if (!p.dead && dist < sightRange) {
      // close range: they sense movement even behind their back
      const closeEnough = dist < 34;
      const fovOk = closeEnough || this.state === 'chase' || this.state === 'attack'
        ? true
        : Math.abs(angleDiff(toAngle, this.angle)) < 1.9;
      if (fovOk && losClear(game.world, this.x, this.y, p.x, p.y)) sees = true;
    }
    if (sees) {
      this.memory = 7;
      this.targetX = p.x; this.targetY = p.y;
      if (this.state !== 'chase' && this.state !== 'attack') {
        this.state = 'chase';
        if (Math.random() < 0.45) game.sfx.zombieAlert();
      }
    } else if (this.memory > 0) {
      this.memory -= dt;
    }

    // ------------------------------------------------------ behaviour
    switch (this.state) {
      case 'stagger': {
        this.stagger -= dt;
        moveEntity(game.world, this, this.vx * dt, this.vy * dt);
        this.vx *= Math.pow(0.02, dt); this.vy *= Math.pow(0.02, dt);
        if (this.stagger <= 0) this.state = this.memory > 0 ? 'chase' : 'wander';
        break;
      }
      case 'attack': {
        this.windup -= dt;
        if (this.windup <= 0) {
          const reach = this.def.r + 16;
          if (!p.dead && dist < reach) {
            p.damage(this.dmg, game, 'zombie');
            const a = Math.atan2(p.y - this.y, p.x - this.x);
            p.vx += Math.cos(a) * 90;
            p.vy += Math.sin(a) * 90;
            game.makeNoise(p.x, p.y, 40, 'scream');
          }
          this.attackCd = 1.0;
          this.state = this.memory > 0 ? 'chase' : 'wander';
        }
        break;
      }
      case 'chase': {
        this.moveToward(game, dt, this.targetX, this.targetY, 1);
        if (!p.dead && dist < this.def.r + 15 && this.attackCd <= 0) {
          this.state = 'attack';
          this.windup = 0.38;
          this.angle = toAngle;
          game.sfx.growl();
        }
        if (this.memory <= 0 && !sees) { this.state = 'wander'; this.repathCd = 0; }
        break;
      }
      case 'alert': {
        this.moveToward(game, dt, this.targetX, this.targetY, 0.75);
        if (Math.hypot(this.targetX - this.x, this.targetY - this.y) < 10 || this.memory <= 0) this.state = 'wander';
        break;
      }
      default: { // wander
        if (this.repathCd <= 0) {
          this.repathCd = 3 + Math.random() * 5;
          const a = Math.random() * Math.PI * 2;
          const d = 24 + Math.random() * 60;
          this.targetX = this.x + Math.cos(a) * d;
          this.targetY = this.y + Math.sin(a) * d;
          this.wanderCd = 3;
        }
        this.moveToward(game, dt, this.targetX, this.targetY, 0.42);
      }
    }

    // blocked by a door? smash it
    if (this.state === 'chase' && this.shoveCd <= 0) {
      const ax = Math.cos(this.angle), ay = Math.sin(this.angle);
      const tx = Math.floor((this.x + ax * (this.r + 6)) / TS);
      const ty = Math.floor((this.y + ay * (this.r + 6)) / TS);
      const tile = game.world.tiles[ty * game.world.w + tx];
      if (tile === TILE.DOOR) {
        const d = game.world.doors.get(ty * game.world.w + tx);
        if (d && !d.broken) {
          d.hp -= this.dmg * 1.4;
          game.particles.dust(d.x * TS + 8, d.y * TS + 8, 3, '#7a6242');
          game.sfx.wood();
          if (d.hp <= 0) {
            d.broken = true;
            game.world.tiles[ty * game.world.w + tx] = TILE.FLOOR_CRACK;
            game.log('A door gives way.', 'warn');
          }
        }
        this.shoveCd = 0.8;
      }
    }

    if (this.growlCd <= 0) {
      this.growlCd = 4 + Math.random() * 10;
      if (dist < 220 && Math.random() < 0.6) game.sfx.growl();
    }
  }

  moveToward(game, dt, tx, ty, factor) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) { this.vx *= 0.8; this.vy *= 0.8; return; }
    let a = Math.atan2(dy, dx);

    // simple local avoidance: if we are wedged against a wall, slide sideways
    if (this.detourT > 0) {
      this.detourT -= dt;
      a = this.detourA;
    } else {
      const turn = 3.2 * dt;
      this.angle += Math.max(-turn, Math.min(turn, angleDiff(a, this.angle)));
    }
    // jitter so crowds don't stack in a line
    const jitter = Math.sin(game.time * 1.7 + this.id) * 0.35;
    const sp = this.speed * factor;
    const ax = Math.cos(a + jitter) * sp;
    const ay = Math.sin(a + jitter) * sp;
    const k = Math.min(1, 7 * dt);
    this.vx += (ax - this.vx) * k;
    this.vy += (ay - this.vy) * k;

    const px = this.x, py = this.y;
    moveEntity(game.world, this, this.vx * dt, this.vy * dt);
    const moved = Math.hypot(this.x - px, this.y - py);
    const want = Math.hypot(this.vx, this.vy) * dt;
    if (this.detourT <= 0 && want > 0.3 && moved < want * 0.35) {
      // blocked: commit to a detour for a moment
      const side = this.id % 2 === 0 ? 1 : -1;
      this.detourT = 0.5 + Math.random() * 0.7;
      this.detourA = Math.atan2(dy, dx) + side * (Math.PI / 2.4);
      this.vx = Math.cos(this.detourA) * sp;
      this.vy = Math.sin(this.detourA) * sp;
    }
    this.phase += dt * (2.4 + Math.abs(this.vx + this.vy) * 0.12);
  }

  hurt(game, dmg, angle, knock = 60) {
    if (this.dead) return;
    this.hp -= dmg;
    this.hurtFlash = 1;
    this.memory = 8;
    this.state = 'chase';
    this.targetX = game.player.x; this.targetY = game.player.y;
    if (knock > 0) {
      this.vx += Math.cos(angle) * knock;
      this.vy += Math.sin(angle) * knock;
      this.stagger = Math.min(0.45, 0.12 + knock / 400);
      this.state = 'stagger';
    }
    if (this.hp <= 0) this.die(game);
  }

  die(game) {
    if (this.dead) return;
    this.dead = true;
    this.deadT = 0;
    this.rot = Math.random() < 0.5 ? 0 : Math.PI / 2;
    game.particles.blood(this.x, this.y, 0, -1, 14, '#7a1414');
    game.particles.gib(this.x, this.y, 4);
    game.sfx.zombieDie();
    game.onZombieKilled(this);
  }
}
