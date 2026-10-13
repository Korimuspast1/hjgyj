/**
 * Game: owns the whole simulation state and the fixed tick order.
 *
 * Tick order (per simulation tick):
 *   1. pheromones  - evaporate and diffuse
 *   2. physics     - sand, dirt, food, water, cave-ins
 *   3. enemies     - sense and move
 *   4. ants        - needs, utility decisions, actions
 *   5. combat      - attacks on cooldowns
 *   6. brood       - eggs hatch, larvae grow, pupae emerge
 *   7. colonies    - queen eats, lays eggs, alarms decay
 *   8. cleanup     - remove the dead, leave corpses, refresh stats
 *
 * The single Game object is the only mutable simulation state. Views (renderer,
 * GUI, input) read it and call its methods; they never modify arrays directly.
 */
import { World, CELL, FOOD_KIND, FOOD_UNITS, ANT_PASSABLE } from './world.js';
import { Pheromones } from './pheromones.js';
import { Pathfinder } from './pathfinding.js';
import { SpatialHash } from './spatial.js';
import { Random, chebyshev, DX, DY } from './utils.js';
import {
  CRUSH_DAMAGE,
  FOOD_SUPPLY_INTERVAL,
  FOOD_SUPPLY_LOW,
  FOOD_SUPPLY_SPREAD,
} from './config.js';
import { Ant, ROLE } from './ant.js';
import { Colony } from './colony.js';
import { Enemy, updateEnemy } from './enemies.js';
import { Brood, updateBrood } from './items.js';
import { stepPhysics } from './physics.js';
import { stepCombat } from './combat.js';
import { updateAnt } from './ai.js';
import { TOOLS_BY_ID } from './tools.js';
import {
  MAX_PATHS_PER_TICK,
  START_FOOD,
  SURFACE_Y,
  BRUSH_SIZES,
  QUANTITIES,
} from './config.js';

const MESSAGE_LOG_SIZE = 8;

export class Game {
  /** @param {number} seed 32-bit seed for the deterministic random generator */
  constructor(seed = 1) {
    this.seed = seed >>> 0;
    this.rng = new Random(this.seed);
    this.tick = 0;

    this.world = new World();
    this.world.resetToFormicarium();
    this.pheromones = new Pheromones(this.world.width, this.world.height);
    this.pathfinder = new Pathfinder(this.world);
    this.antHash = new SpatialHash(this.world.width, this.world.height, 8);
    this.enemyHash = new SpatialHash(this.world.width, this.world.height, 8);
    /** Number of living entities per cell, rebuilt each tick. */
    this.occupancy = new Uint8Array(this.world.size);

    this.colonies = [new Colony({ id: 1, name: 'BLACK COLONY' })];
    this.ants = [];
    this.enemies = [];
    this.brood = [];
    this.nextId = 1;
    this.pathBudget = 0;
    /** Cell indices of open air cells that rest on solid ground. */
    this.surfaceCells = [];
    this.inspectIndex = -1;
    /** Ant or enemy picked with the inspect tool (view state, not saved). */
    this.selected = null;
    this.events = [];

    this.stats = {
      dug: 0,
      filled: 0,
      caveIns: 0,
      kills: 0,
      deaths: 0,
      population: 0,
      soldiers: 0,
      enemies: 0,
      brood: 0,
      tickMs: 0,
    };

    /** View settings. They are not part of the saved simulation. */
    this.ui = {
      tool: 'ant',
      brush: 0,
      quantity: 0,
      speed: 0,
      paused: false,
      zoom: 1,
      camX: 0,
      camY: 0,
      debug: { pheromones: false, states: false, grid: false, paths: false },
    };

    this.physicsHooks = {
      occupiedAt: (i) => this.occupancy[i] > 0,
      onCrush: (i) => this.crushAt(i),
      onDrown: (i) => this.drownAt(i),
      onCollapse: (x, y) => this.onCollapse(x, y),
    };

    this.refreshSurface();
    this.log('The formicarium is empty: just sand and glass.');
  }

  /** Factory with a time-based seed (the constructor stays deterministic). */
  static create() {
    return new Game((Date.now() >>> 0) ^ Math.floor(Math.random() * 0xffffffff));
  }

  newId() {
    return this.nextId++;
  }

  log(text) {
    this.events.push({ tick: this.tick, text });
    if (this.events.length > MESSAGE_LOG_SIZE) this.events.shift();
  }

  colonyOf(entity) {
    return this.colonies.find((c) => c.id === entity.colonyId) || null;
  }

  populationCount() {
    return this.ants.length + this.brood.length;
  }

  // ---- Spatial queries -------------------------------------------------------

  /** Nearest living enemy within Chebyshev `radius`, or null. */
  nearestEnemy(entity, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const e of this.enemyHash.query(entity.x, entity.y, radius)) {
      if (!e.alive) continue;
      const d = chebyshev(e.x, e.y, entity.x, entity.y);
      if (d < bestDist) {
        bestDist = d;
        best = e;
      }
    }
    return best;
  }

  /** Nearest living ant (queen included) other than `entity`, or null. */
  nearestAnt(entity, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const a of this.antHash.query(entity.x, entity.y, radius)) {
      if (!a.alive || a === entity) continue;
      const d = chebyshev(a.x, a.y, entity.x, entity.y);
      if (d < bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  occupiedAt(i) {
    return this.occupancy[i] > 0;
  }

  /** Rebuilds occupancy and spatial hashes from current entity positions. */
  rebuildIndices() {
    this.occupancy.fill(0);
    this.antHash.clear();
    this.enemyHash.clear();
    const world = this.world;
    for (const ant of this.ants) {
      if (!ant.alive) continue;
      this.antHash.insert(ant);
      const i = world.index(ant.x, ant.y);
      if (this.occupancy[i] < 255) this.occupancy[i]++;
    }
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      this.enemyHash.insert(enemy);
      const i = world.index(enemy.x, enemy.y);
      if (this.occupancy[i] < 255) this.occupancy[i]++;
    }
  }

  // ---- Simulation ------------------------------------------------------------

  /** Advances the simulation by exactly one tick. */
  step() {
    const started = performance.now();
    this.tick++;

    this.pheromones.update(this.world);
    this.pathBudget = MAX_PATHS_PER_TICK;
    // Remember where each creature started the tick, so the renderer can interpolate.
    for (const a of this.ants) a.clock = this.tick;
    for (const e of this.enemies) e.clock = this.tick;

    this.rebuildIndices();
    stepPhysics(this.world, this.rng, this.physicsHooks, this.tick);

    this.rebuildIndices();
    for (const enemy of this.enemies) updateEnemy(enemy, this);

    this.rebuildIndices();
    for (let k = 0; k < this.ants.length; k++) updateAnt(this.ants[k], this);

    this.rebuildIndices();
    stepCombat(this);

    for (const b of this.brood) updateBrood(b, this);
    for (const colony of this.colonies) colony.update(this);
    this.supplyFood();

    if (this.tick % 60 === 0) this.refreshSurface();
    this.removeDead();
    if (this.tick % 10 === 0) this.updateStats();

    this.stats.tickMs = this.stats.tickMs * 0.9 + (performance.now() - started) * 0.1;
  }

  /** Scans every column for the first air cell above solid ground. */
  refreshSurface() {
    const world = this.world;
    const cells = [];
    for (let x = 1; x < world.width - 1; x++) {
      for (let y = 1; y < world.height - 2; y++) {
        const i = world.index(x, y);
        if (world.type[i] === CELL.EMPTY && world.type[i + world.width] !== CELL.EMPTY && world.type[i + world.width] !== CELL.GLASS) {
          cells.push(i);
          break;
        }
      }
    }
    this.surfaceCells = cells;
  }

  /** Removes dead entities and leaves food corpses where open ground allows. */
  removeDead() {
    const survivors = [];
    for (const ant of this.ants) {
      if (ant.alive) survivors.push(ant);
      else if (ant.cause !== 'removed') this.leaveCorpse(ant);
    }
    this.ants = survivors;

    const enemies = [];
    for (const enemy of this.enemies) {
      if (enemy.alive) enemies.push(enemy);
      else if (enemy.cause !== 'removed') this.leaveCorpse(enemy, enemy.species === 'beetle' ? 10 : 6);
    }
    this.enemies = enemies;

    this.brood = this.brood.filter((b) => b.alive);

    if (this.selected && !this.selected.alive) {
      const what = this.selected.role ? `Ant #${this.selected.id}` : `${this.selected.species} #${this.selected.id}`;
      this.log(`${what} died (${this.selected.cause}).`);
      this.selected = null;
    }
  }

  leaveCorpse(entity, units = 6) {
    const world = this.world;
    if (!world.inBounds(entity.x, entity.y)) return;
    const i = world.index(entity.x, entity.y);
    const t = world.type[i];
    if (t === CELL.EMPTY || t === CELL.TUNNEL || t === CELL.CHAMBER) {
      world.setIndex(i, CELL.FOOD, units, FOOD_KIND.CORPSE);
    }
  }

  updateStats() {
    let population = 0;
    let soldiers = 0;
    for (const ant of this.ants) {
      if (!ant.alive || ant.role === ROLE.QUEEN) continue;
      population++;
      if (ant.role === ROLE.SOLDIER) soldiers++;
    }
    this.stats.population = population;
    this.stats.soldiers = soldiers;
    this.stats.enemies = this.enemies.filter((e) => e.alive).length;
    this.stats.brood = this.brood.length;
  }

  // ---- Deaths ----------------------------------------------------------------

  killAnt(ant, cause) {
    if (!ant || !ant.alive) return;
    ant.alive = false;
    ant.cause = cause;
    this.stats.deaths++;
    const colony = this.colonyOf(ant);
    if (colony) colony.stats.died++;
    if (ant.role === ROLE.QUEEN) {
      this.log('The queen has died. The colony is queenless.');
    }
  }

  killEnemy(enemy, cause) {
    if (!enemy || !enemy.alive) return;
    enemy.alive = false;
    enemy.cause = cause;
    if (cause === 'slain') this.stats.kills++;
  }

  /** Something heavy landed on cell i. Queens survive one hit; ants do not. */
  crushAt(i) {
    const x = this.world.xOf(i);
    const y = this.world.yOf(i);
    for (const ant of this.antHash.query(x, y, 0)) {
      if (!ant.alive || ant.x !== x || ant.y !== y) continue;
      // Sand landing on an ant pushes it into a free neighbour and hurts it. If
      // there is no room, the ant takes the hit and stays put; it dies only when
      // its HP runs out.
      ant.hp -= ant.role === ROLE.QUEEN ? 40 : CRUSH_DAMAGE;
      const exit = this.freeNeighbour(x, y, i);
      if (exit) {
        ant.fromX = ant.x;
        ant.fromY = ant.y;
        ant.movedTick = this.tick;
        ant.x = exit.x;
        ant.y = exit.y;
        ant.path = null;
      }
      if (ant.hp <= 0) this.killAnt(ant, 'crushed');
    }
    for (const enemy of this.enemyHash.query(x, y, 0)) {
      if (!enemy.alive || enemy.x !== x || enemy.y !== y) continue;
      enemy.hp -= 50;
      if (enemy.hp <= 0) this.killEnemy(enemy, 'crushed');
    }
  }

  drownAt(i) {
    const x = this.world.xOf(i);
    const y = this.world.yOf(i);
    for (const ant of this.antHash.query(x, y, 0)) {
      if (ant.alive && ant.x === x && ant.y === y) this.killAnt(ant, 'drowned');
    }
    for (const enemy of this.enemyHash.query(x, y, 0)) {
      if (enemy.alive && enemy.x === x && enemy.y === y) this.killEnemy(enemy, 'drowned');
    }
  }

  onCollapse() {
    this.stats.caveIns++;
    const colony = this.colonies[0];
    if (colony) colony.collapseAlarm = 200;
    if (this.stats.caveIns % 25 === 1) this.log('Cave-in! Unsupported sand collapsed.');
  }

  // ---- Spawning --------------------------------------------------------------

  /**
   * Nearby random cell an entity may occupy: passable for ants and not occupied.
   * @returns {{x: number, y: number}|null}
   */
  findOpenNear(x, y, radius) {
    const world = this.world;
    // Random probes first, widening the search area as they fail.
    for (let t = 0; t < 16; t++) {
      const reach = radius + ((t >> 2) << 1);
      const nx = x + this.rng.int(2 * reach + 1) - reach;
      const ny = y + this.rng.int(2 * reach + 1) - reach;
      if (this.isFreeSpot(nx, ny)) return { x: nx, y: ny };
    }
    // Deterministic fallback: nearest free spot in a wider square (e.g. a click inside sand).
    const reach = radius + 12;
    for (let r = 0; r <= reach; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isFreeSpot(x + dx, y + dy)) return { x: x + dx, y: y + dy };
        }
      }
    }
    return null;
  }

  /** A passable, unoccupied neighbour of (x, y) other than cell `avoid`, or null. */
  freeNeighbour(x, y, avoid) {
    for (let d = 0; d < 8; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!this.world.inBounds(nx, ny) || this.world.index(nx, ny) === avoid) continue;
      if (this.isFreeSpot(nx, ny)) return { x: nx, y: ny };
    }
    return null;
  }

  /**
   * Keeps the colony fed: while its store is low, a pile of sugar drops onto the
   * surface above the nest. See FOOD_SUPPLY_* in config.js.
   */
  supplyFood() {
    if (this.tick % FOOD_SUPPLY_INTERVAL !== 0) return;
    const colony = this.colonies[0];
    if (!colony || !colony.nest || colony.foodStored >= FOOD_SUPPLY_LOW) return;
    const world = this.world;
    for (let t = 0; t < 20; t++) {
      const x = colony.nest.x + this.rng.int(2 * FOOD_SUPPLY_SPREAD + 1) - FOOD_SUPPLY_SPREAD;
      const y = SURFACE_Y - 2;
      if (!world.inBounds(x, y)) continue;
      const i = world.index(x, y);
      if (world.type[i] !== CELL.EMPTY) continue;
      world.setIndex(i, CELL.FOOD, FOOD_UNITS[FOOD_KIND.SUGAR], FOOD_KIND.SUGAR);
      this.log('Fresh sugar dropped near the nest.');
      return;
    }
  }

  /** True when an ant-passable cell holds no living entity. */
  isFreeSpot(x, y) {
    if (!this.world.canAntEnter(x, y)) return false;
    return !this.occupiedAt(this.world.index(x, y));
  }

  spawnAnt(colonyId, x, y, role) {
    const ant = new Ant({ id: this.newId(), colonyId, role, x, y, rng: this.rng });
    this.ants.push(ant);
    const colony = this.colonies.find((c) => c.id === colonyId);
    if (colony) {
      colony.stats.born++;
      if (!colony.nest) colony.nest = { x, y }; // first ants found a temporary nest
    }
    return ant;
  }

  /** Places the queen in a chamber dug out of the sand, with a shaft to the surface. */
  spawnQueen(x, y) {
    const colony = this.colonies[0];
    if (colony.queen && colony.queen.alive) {
      this.log('The colony already has a queen.');
      return false;
    }
    const world = this.world;
    const qx = Math.min(world.width - 10, Math.max(9, x));
    const qy = Math.min(world.height - 10, Math.max(SURFACE_Y + 8, y));
    const blocking = world.typeAt(qx, qy);
    if (blocking === CELL.ROCK || blocking === CELL.GLASS) {
      this.log('Rock is too hard for a queen chamber here.');
      return false;
    }
    this.carveChamber(qx, qy, 3);
    this.carveShaft(qx, qy, SURFACE_Y - 1);

    const queen = new Ant({ id: this.newId(), colonyId: colony.id, role: ROLE.QUEEN, x: qx, y: qy, rng: this.rng });
    this.ants.push(queen);
    colony.queen = queen;
    colony.nest = { x: qx, y: qy };
    colony.foodStored = Math.max(colony.foodStored, START_FOOD);
    this.log('A queen founded the colony. Her chamber is ready.');
    return true;
  }

  /** Turns soil in a disc into chamber (keeps glass and rock intact). */
  carveChamber(cx, cy, radius) {
    const world = this.world;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius + 1) continue;
        const x = cx + dx;
        const y = cy + dy;
        if (!world.inBounds(x, y) || y < 1) continue;
        const t = world.typeAt(x, y);
        if (t === CELL.GLASS || t === CELL.ROCK) continue;
        world.setCell(x, y, CELL.CHAMBER);
      }
    }
  }

  /** Vertical 1-cell tunnel from (x, fromY) up to row toY. Stops at rock. */
  carveShaft(x, fromY, toY) {
    const world = this.world;
    for (let y = fromY; y >= toY; y--) {
      const t = world.typeAt(x, y);
      if (t === CELL.ROCK || t === CELL.GLASS) break;
      if (t === CELL.SAND || t === CELL.DIRT || t === CELL.CLAY) world.setCell(x, y, CELL.TUNNEL);
    }
  }

  spawnEnemy(species, x, y) {
    const enemy = new Enemy({ id: this.newId(), species, x, y });
    this.enemies.push(enemy);
    return enemy;
  }

  spawnBrood(kind, x, y, colonyId) {
    const brood = new Brood({ id: this.newId(), kind, x, y, colonyId });
    this.brood.push(brood);
    return brood;
  }

  /** A pupa emerges as an adult of a role the colony needs. */
  hatchBrood(brood) {
    const colony = this.colonies.find((c) => c.id === brood.colonyId) || this.colonies[0];
    const role = colony.chooseRole(this);
    this.spawnAnt(colony.id, brood.x, brood.y, role);
  }

  // ---- Terrain & tools -------------------------------------------------------

  /** Applies a player action at cell (x,y) using the current tool, brush and quantity. */
  applyTool(toolId, x, y) {
    const tool = TOOLS_BY_ID[toolId];
    if (!tool || !this.world.inBounds(x, y)) return;
    const world = this.world;
    const radius = (BRUSH_SIZES[this.ui.brush] - 1) >> 1;
    const count = QUANTITIES[this.ui.quantity];
    this.rebuildIndices();

    switch (tool.kind) {
      case 'ant':
        this.spawnBatch(count, x, y, radius, (p) => this.spawnAnt(this.colonies[0].id, p.x, p.y, tool.role));
        break;
      case 'enemy':
        this.spawnBatch(count, x, y, radius, (p) => this.spawnEnemy(tool.species, p.x, p.y));
        break;
      case 'brood':
        this.spawnBatch(count, x, y, radius, (p) => this.spawnBrood(tool.brood, p.x, p.y, this.colonies[0].id));
        break;
      case 'queen':
        this.spawnQueen(x, y);
        break;
      case 'paint':
        this.paintArea(x, y, radius, (i) => {
          if (world.type[i] === CELL.GLASS) return;
          if (this.occupiedAt(i)) this.crushAt(i);
          world.setIndex(i, tool.cell, 255);
        });
        break;
      case 'water':
        this.paintArea(x, y, radius, (i) => {
          const t = world.type[i];
          if (t === CELL.EMPTY || t === CELL.TUNNEL || t === CELL.CHAMBER) world.setIndex(i, CELL.WATER, 255);
        });
        break;
      case 'food':
        this.paintArea(x, y, radius, (i) => {
          const t = world.type[i];
          if (t === CELL.EMPTY || t === CELL.TUNNEL || t === CELL.CHAMBER) {
            world.setIndex(i, CELL.FOOD, FOOD_UNITS[tool.food], tool.food);
          }
        });
        break;
      case 'erase':
        this.paintArea(x, y, radius, (i) => {
          if (world.type[i] !== CELL.GLASS) world.setIndex(i, CELL.EMPTY);
        });
        break;
      case 'carve':
        this.paintArea(x, y, radius, (i) => {
          const t = world.type[i];
          if (t !== CELL.GLASS && t !== CELL.ROCK) world.setIndex(i, tool.cell);
        });
        break;
      case 'inspect':
        this.inspectIndex = world.index(x, y);
        this.selected = this.creatureNear(x, y, 2);
        break;
      default:
        break;
    }
    if (tool.kind !== 'inspect') this.refreshSurface();
  }

  /** Closest living ant or enemy within Chebyshev `radius` of (x,y), or null. */
  creatureNear(x, y, radius) {
    let best = null;
    let bestDist = Infinity;
    for (const c of [...this.ants, ...this.enemies]) {
      if (!c.alive) continue;
      const d = chebyshev(c.x, c.y, x, y);
      if (d <= radius && d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  }

  /** Clears the inspect selection (Escape). */
  clearSelection() {
    this.selected = null;
    this.inspectIndex = -1;
  }

  /** Right-click: removes living things in the brush area, or erases terrain when none are there. */
  eraseAt(x, y) {
    const radius = (BRUSH_SIZES[this.ui.brush] - 1) >> 1;
    let removed = 0;
    for (const ant of this.ants) {
      if (ant.alive && chebyshev(ant.x, ant.y, x, y) <= radius) {
        this.killAnt(ant, 'removed');
        removed++;
      }
    }
    for (const enemy of this.enemies) {
      if (enemy.alive && chebyshev(enemy.x, enemy.y, x, y) <= radius) {
        this.killEnemy(enemy, 'removed');
        removed++;
      }
    }
    if (removed === 0) this.applyTool('eraser', x, y);
    else this.refreshSurface();
  }

  spawnBatch(count, x, y, radius, make) {
    const spread = Math.max(radius + 2, 4);
    let placed = 0;
    for (let k = 0; k < count; k++) {
      const spot = this.findOpenNear(x, y, spread);
      if (!spot) continue;
      make(spot);
      this.occupancy[this.world.index(spot.x, spot.y)]++;
      placed++;
    }
    if (placed === 0) this.log('No room there: click on or next to sand, tunnels or chambers.');
  }

  paintArea(x, y, radius, fn) {
    const world = this.world;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (!world.inBounds(nx, ny)) continue;
        fn(world.index(nx, ny));
      }
    }
  }

  /** Whether the cell at (x,y) is a valid place for a new ant. Used by tests and tools. */
  canPlaceAnt(x, y) {
    return this.world.canAntEnter(x, y) && ANT_PASSABLE[this.world.typeAt(x, y)] === 1;
  }
}
