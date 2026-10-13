/**
 * Hostile creatures: raider ants, beetles and spiders.
 * Simple AI: hunt anything within sight, otherwise wander. Species differ in
 * speed, sight, HP and damage.
 */
import { walkTo, wanderStep } from './movement.js';

export const ENEMY_SPECIES = Object.freeze({
  raider: { label: 'RAIDER ANT', maxHp: 24, damage: 2, cooldown: 6, speed: 0.45, sight: 9 },
  beetle: { label: 'BEETLE', maxHp: 90, damage: 4, cooldown: 12, speed: 0.22, sight: 4 },
  spider: { label: 'SPIDER', maxHp: 50, damage: 5, cooldown: 8, speed: 0.6, sight: 12 },
});

export class Enemy {
  /**
   * @param {{id: number, species: string, x: number, y: number}} options
   */
  constructor({ id, species, x, y }) {
    const stats = ENEMY_SPECIES[species];
    if (!stats) throw new Error(`Unknown enemy species: ${species}`);
    this.id = id;
    this.species = species;
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.prevY = y;
    this.facing = 1;
    this.animFrame = 0;
    this.alive = true;
    this.cause = null;
    this.maxHp = stats.maxHp;
    this.hp = stats.maxHp;
    this.damage = stats.damage;
    this.cooldownMax = stats.cooldown;
    this.cooldown = 0;
    this.speed = stats.speed;
    this.sight = stats.sight;
    this.moveCredit = 0;
    this.path = null;
    this.pathPos = 0;
    this.pathGoalX = -1;
    this.pathGoalY = -1;
    this.pathRetryTick = 0;
    this.stuckTicks = 0;
    this.heading = 0;
    this.carrying = null;
  }
}

/**
 * Advances an enemy by one tick.
 * @param {Enemy} enemy
 * @param {import('./game.js').Game} game
 */
export function updateEnemy(enemy, game) {
  if (!enemy.alive) return;
  enemy.moveCredit = Math.min(1, enemy.moveCredit + enemy.speed);
  const target = game.nearestAnt(enemy, enemy.sight);
  if (target) {
    walkTo(enemy, game, target.x, target.y, 1);
  } else if (game.rng.chance(0.6)) {
    wanderStep(enemy, game);
  }
}
