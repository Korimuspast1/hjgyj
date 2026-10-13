/**
 * Colony state: food store, queen, nest location, alarm levels, brood laying
 * and role balancing.
 */
import { POPULATION_CAP, QUEEN_FOOD_RATE, LAY_INTERVAL } from './config.js';
import { ROLE, WORKER_ROLES, ROLE_SHARE } from './ant.js';
import { CELL } from './world.js';

export class Colony {
  /**
   * @param {{id: number, name: string}} options
   */
  constructor({ id, name }) {
    this.id = id;
    this.name = name;
    this.foodStored = 0;
    /** @type {import('./ant.js').Ant|null} */
    this.queen = null;
    /** @type {{x: number, y: number}|null} queen chamber */
    this.nest = null;
    this.alarm = 0;          // ticks of raised alarm after attacks (boosts soldiers)
    this.collapseAlarm = 0;  // ticks after cave-ins (boosts builders)
    this.layTimer = LAY_INTERVAL;
    /** Cell indices of recently seen food, shared by the whole colony. */
    this.knownFood = [];
    this.stats = { born: 0, died: 0, eggsLaid: 0, foodDelivered: 0 };
  }

  addFood(amount) {
    this.foodStored += amount;
  }

  /** @returns {boolean} whether the requested amount was available */
  takeFood(amount) {
    if (this.foodStored < amount) return false;
    this.foodStored -= amount;
    return true;
  }

  /** Remembers a food cell for the whole colony (max 12 entries). */
  noteFood(index) {
    if (this.knownFood.includes(index)) return;
    this.knownFood.push(index);
    if (this.knownFood.length > 12) this.knownFood.shift();
  }

  pruneKnownFood(world) {
    this.knownFood = this.knownFood.filter((i) => world.type[i] === CELL.FOOD && world.density[i] > 0);
  }

  /**
   * Per-tick colony upkeep: decays alarms, feeds and starves the queen, and lays eggs.
   * @param {import('./game.js').Game} game
   */
  update(game) {
    if (this.alarm > 0) this.alarm--;
    if (this.collapseAlarm > 0) this.collapseAlarm--;
    if (game.tick % 100 === 0) this.pruneKnownFood(game.world);

    const queen = this.queen;
    if (!queen || !queen.alive) return;

    this.foodStored = Math.max(0, this.foodStored - QUEEN_FOOD_RATE);
    if (this.foodStored <= 0) {
      queen.hp -= 0.05;
      if (queen.hp <= 0) game.killAnt(queen, 'starved');
      return;
    }

    if (--this.layTimer <= 0) {
      this.layTimer = LAY_INTERVAL + game.rng.int(30);
      if (this.foodStored >= 1 && game.populationCount() < POPULATION_CAP) {
        const spot = game.findOpenNear(queen.x, queen.y, 3);
        if (spot) {
          game.spawnBrood('egg', spot.x, spot.y, this.id);
          this.foodStored -= 1;
          this.stats.eggsLaid++;
        }
      }
    }
  }

  /** @returns {Object<string, number>} living non-queen ants per role */
  roleCounts(game) {
    const counts = {};
    for (const ant of game.ants) {
      if (!ant.alive || ant.colonyId !== this.id || ant.role === ROLE.QUEEN) continue;
      counts[ant.role] = (counts[ant.role] || 0) + 1;
    }
    return counts;
  }

  /**
   * Picks a role for a newly hatched ant. It chooses the role with the largest
   * deficit against target shares, which are raised for soldiers under attack
   * and for builders after cave-ins.
   */
  chooseRole(game) {
    const counts = this.roleCounts(game);
    let total = 0;
    for (const role of WORKER_ROLES) total += counts[role] || 0;

    const shares = { ...ROLE_SHARE };
    if (this.alarm > 0) shares.soldier *= 2.5;
    if (this.collapseAlarm > 0) shares.builder *= 2.5;
    if (this.foodStored < 5) shares.forager *= 1.5;

    let best = ROLE.WORKER;
    let bestScore = -Infinity;
    for (const role of WORKER_ROLES) {
      if (role === ROLE.WORKER) continue;
      const deficit = shares[role] * (total + 1) - (counts[role] || 0);
      const score = deficit + game.rng.next() * 0.2;
      if (score > bestScore) {
        bestScore = score;
        best = role;
      }
    }
    return best;
  }
}
