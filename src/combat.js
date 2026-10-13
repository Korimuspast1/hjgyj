/**
 * Combat: adjacent enemies trade blows on cooldowns. Hits leave danger
 * pheromone and raise the colony alarm, which pulls soldiers in.
 */
import { ROLE } from './ant.js';
import { LAYER } from './pheromones.js';

const DANGER_DEPOSIT = 40;
const ALARM_TICKS = 120;

/**
 * One combat step for all ants and enemies.
 * @param {import('./game.js').Game} game
 */
export function stepCombat(game) {
  for (const ant of game.ants) {
    if (!ant.alive || ant.role === ROLE.QUEEN) continue;
    if (ant.attackCooldown > 0) {
      ant.attackCooldown--;
      continue;
    }
    const foe = game.nearestEnemy(ant, 1);
    if (!foe) continue;
    foe.hp -= ant.damage * ant.strength;
    ant.attackCooldown = ant.role === ROLE.SOLDIER ? 3 : 5;
    if (foe.hp <= 0) game.killEnemy(foe, 'slain');
  }

  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    if (enemy.cooldown > 0) {
      enemy.cooldown--;
      continue;
    }
    const victim = game.nearestAnt(enemy, 1);
    if (!victim) continue;
    victim.hp -= enemy.damage;
    enemy.cooldown = enemy.cooldownMax;

    const world = game.world;
    game.pheromones.deposit(LAYER.DANGER, world.index(victim.x, victim.y), DANGER_DEPOSIT);
    victim.memory.dangerTick = game.tick;
    victim.memory.dangerX = victim.x;
    victim.memory.dangerY = victim.y;
    const colony = game.colonyOf(victim);
    if (colony) colony.alarm = ALARM_TICKS;

    if (victim.hp <= 0) game.killAnt(victim, `killed by ${enemy.species}`);
  }
}
