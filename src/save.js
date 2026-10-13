/**
 * Save / load. The whole simulation is serialised to one JSON document:
 * terrain and pheromones as base64 typed arrays, entities as plain objects.
 *
 * Object references (an ant's task target, an egg it carries) are written as
 * {__ref, cls} ids and relinked on load. Paths are not saved: they are
 * recomputed. Pheromones are quantised to 8 bits, which is precise enough for
 * the game.
 */
import { Game } from './game.js';
import { Ant } from './ant.js';
import { Enemy } from './enemies.js';
import { Brood } from './items.js';
import { Colony } from './colony.js';
import { SAVE_KEY, SAVE_VERSION, PHEROMONE_MAX } from './config.js';

/** Encodes a typed array as base64 (works in browsers and Node). */
export function encodeBytes(u8) {
  if (typeof Buffer !== 'undefined') return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength).toString('base64');
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Decodes base64 into a fresh Uint8Array. */
export function decodeBytes(str) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(str, 'base64'));
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function classOf(v) {
  if (v instanceof Ant) return 'ant';
  if (v instanceof Enemy) return 'enemy';
  if (v instanceof Brood) return 'brood';
  return null;
}

/** Converts entity references to ids, recursing through plain objects and arrays. */
function encodeValue(v) {
  if (v === null || typeof v !== 'object') return v;
  const cls = classOf(v);
  if (cls) return { __ref: v.id, cls };
  if (Array.isArray(v)) return v.map(encodeValue);
  if (Object.getPrototypeOf(v) !== Object.prototype) return undefined; // skip other class instances
  const out = {};
  for (const key of Object.keys(v)) out[key] = encodeValue(v[key]);
  return out;
}

/** Turns an entity's own fields into a JSON-safe object (paths are dropped). */
function encodeEntity(entity) {
  const out = {};
  for (const key of Object.keys(entity)) {
    if (key === 'path' || key === 'pathPos') continue;
    out[key] = encodeValue(entity[key]);
  }
  return out;
}

/**
 * Serialises a game to a plain JSON-safe object.
 * @param {Game} game
 * @returns {object}
 */
export function serializeGame(game) {
  const w = game.world;
  const quantise = (layer) => {
    const u8 = new Uint8Array(layer.length);
    for (let i = 0; i < layer.length; i++) {
      u8[i] = Math.min(255, Math.round((layer[i] * 255) / PHEROMONE_MAX));
    }
    return encodeBytes(u8);
  };
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    seed: game.seed,
    tick: game.tick,
    nextId: game.nextId,
    rng: game.rng.state >>> 0,
    stats: game.stats,
    events: game.events,
    inspectIndex: game.inspectIndex,
    world: {
      width: w.width,
      height: w.height,
      type: encodeBytes(w.type),
      density: encodeBytes(w.density),
      subtype: encodeBytes(w.subtype),
      moisture: encodeBytes(w.moisture),
      stress: encodeBytes(w.stress),
    },
    pheromones: game.pheromones.layers.map(quantise),
    colonies: game.colonies.map((c) => ({
      id: c.id,
      name: c.name,
      foodStored: c.foodStored,
      queenId: c.queen ? c.queen.id : null,
      nest: c.nest,
      alarm: c.alarm,
      collapseAlarm: c.collapseAlarm,
      layTimer: c.layTimer,
      knownFood: c.knownFood,
      stats: c.stats,
    })),
    ants: game.ants.filter((a) => a.alive).map(encodeEntity),
    enemies: game.enemies.filter((e) => e.alive).map(encodeEntity),
    brood: game.brood.filter((b) => b.alive).map(encodeEntity),
  };
}

/** Copies base64 bytes into a typed array of the expected length, or throws. */
function fillBytes(target, str, name) {
  const bytes = decodeBytes(str);
  if (bytes.length !== target.length) {
    throw new Error(`Save file: ${name} has ${bytes.length} cells, expected ${target.length}`);
  }
  target.set(bytes);
}

/**
 * Rebuilds a Game from serialised data.
 * @param {object} data output of serializeGame (already parsed from JSON)
 * @returns {Game}
 * @throws {Error} if the version or the array sizes do not match
 */
export function deserializeGame(data) {
  if (!data || data.version !== SAVE_VERSION) {
    throw new Error(`Unsupported save version: ${data && data.version}`);
  }
  const game = new Game(data.seed);
  const w = game.world;
  if (data.world.width !== w.width || data.world.height !== w.height) {
    throw new Error('Save file: world size does not match this build');
  }
  fillBytes(w.type, data.world.type, 'type');
  fillBytes(w.density, data.world.density, 'density');
  fillBytes(w.subtype, data.world.subtype, 'subtype');
  fillBytes(w.moisture, data.world.moisture, 'moisture');
  fillBytes(w.stress, data.world.stress, 'stress');
  w.computeLight();
  w.waterStamp.fill(0);

  data.pheromones.forEach((str, l) => {
    const bytes = decodeBytes(str);
    const layer = game.pheromones.layers[l];
    let any = 0;
    for (let i = 0; i < layer.length; i++) {
      layer[i] = (bytes[i] * PHEROMONE_MAX) / 255;
      if (bytes[i]) any = 1;
    }
    game.pheromones.active[l] = any;
  });

  game.colonies = data.colonies.map((c) => {
    const { queenId, ...rest } = c;
    const colony = Object.assign(new Colony({ id: c.id, name: c.name }), rest);
    colony.queen = null;
    colony._queenId = queenId;
    return colony;
  });

  // Create every entity first so references can be resolved in a second pass.
  const maps = { ant: new Map(), enemy: new Map(), brood: new Map() };
  const make = (Cls, key, list, source) => {
    const made = source.map((d) => {
      const e = Object.create(Cls.prototype);
      maps[key].set(d.id, e);
      return { e, d };
    });
    return made;
  };
  const antPairs = make(Ant, 'ant', game.ants, data.ants);
  const enemyPairs = make(Enemy, 'enemy', game.enemies, data.enemies);
  const broodPairs = make(Brood, 'brood', game.brood, data.brood);

  const decodeValue = (v) => {
    if (v === null || typeof v !== 'object') return v;
    if (Array.isArray(v)) return v.map(decodeValue);
    if ('__ref' in v) return maps[v.cls].get(v.__ref) || null;
    const out = {};
    for (const key of Object.keys(v)) out[key] = decodeValue(v[key]);
    return out;
  };
  // Walkers get fresh (empty) path state; their paths are recomputed on demand.
  const fill = (pairs, walker) => {
    for (const { e, d } of pairs) {
      for (const key of Object.keys(d)) e[key] = decodeValue(d[key]);
      if (walker) {
        e.path = null;
        e.pathPos = 0;
        e.pathGoalX = -1;
        e.pathGoalY = -1;
      }
    }
    return pairs.map((p) => p.e);
  };
  game.ants = fill(antPairs, true);
  game.enemies = fill(enemyPairs, true);
  game.brood = fill(broodPairs, false);
  for (const colony of game.colonies) {
    colony.queen = colony._queenId != null ? maps.ant.get(colony._queenId) || null : null;
    delete colony._queenId;
  }

  game.tick = data.tick;
  game.nextId = data.nextId;
  game.rng.state = data.rng >>> 0;
  Object.assign(game.stats, data.stats);
  game.events = data.events || [];
  game.inspectIndex = data.inspectIndex ?? -1;
  game.refreshSurface();
  game.rebuildIndices();
  game.updateStats();
  return game;
}

/**
 * Saves to localStorage.
 * @param {Game} game
 * @param {Storage} [storage]
 * @throws if the browser refuses the write (for example, quota exceeded)
 */
export function saveToStorage(game, storage = globalThis.localStorage) {
  storage.setItem(SAVE_KEY, JSON.stringify(serializeGame(game)));
}

/**
 * Loads from localStorage.
 * @param {Storage} [storage]
 * @returns {Game|null} null when no save exists
 */
export function loadFromStorage(storage = globalThis.localStorage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  return deserializeGame(JSON.parse(raw));
}
