// Loot tables for searchable containers
import { weighted, randInt } from '../core/rng.js';
import { ITEMS } from './items.js';

export const LOOT_TABLES = {
  fridge: [['canned_food', 5], ['soda', 3], ['water', 3], ['jerky', 2], ['alcohol', 1], ['firstaid', 0.4]],
  shelf: [['canned_food', 4], ['soda', 3], ['water', 2], ['jerky', 3], ['chocolate', 3], ['cloth', 2], ['battery', 1], ['flashlight', 0.8], ['tape', 1]],
  cabinet: [['bandage', 4], ['alcohol', 3], ['painkillers', 3], ['antiseptic', 2], ['firstaid', 1], ['tape', 2], ['battery', 1], ['rag', 2]],
  locker: [['knife', 1.5], ['crowbar', 1.2], ['bat', 1], ['axe', 0.8], ['ammo_pistol', 4], ['ammo_shell', 2], ['cloth', 3], ['flashlight', 1], ['pistol', 0.8]],
  crate: [['wood', 5], ['nails', 6], ['metal', 4], ['fuel', 2], ['tape', 2], ['rag', 4], ['battery', 1], ['ammo_rifle', 2], ['ammo_shell', 2]],
  desk: [['bandage', 2], ['painkillers', 2], ['tape', 2], ['nails', 4], ['battery', 1], ['ammo_pistol', 2], ['flashlight', 0.6], ['wood', 2]],
  counter: [['canned_food', 4], ['soda', 3], ['water', 2], ['chocolate', 2], ['alcohol', 2], ['bandage', 1], ['tape', 1]],
};

export function rollLoot(rng, type, level = 1) {
  const table = LOOT_TABLES[type] || LOOT_TABLES.shelf;
  const out = [];
  const tries = Math.max(1, Math.round(randInt(rng, 1, 3) + level * 0.4));
  for (let i = 0; i < tries; i++) {
    const id = weighted(rng, table);
    if (!id || !ITEMS[id]) continue;
    const def = ITEMS[id];
    const count = 1 + (rng() < 0.35 ? randInt(rng, 1, 3) : 0);
    out.push({ id, count: Math.min(count, def.stack || 1) });
  }
  return out;
}
