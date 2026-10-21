// Item catalogue
export const ITEMS = {
  // --- food & drink ---
  canned_food: { name: 'Canned Food', cat: 'food', stack: 4, weight: 0.4, icon: 'can', color: '#8a9a63', food: 22, thirst: -2, desc: 'Old but edible. +22 food.' },
  soda: { name: 'Soda', cat: 'drink', stack: 4, weight: 0.3, icon: 'bottle', color: '#7a4a3a', thirst: 25, food: 8, desc: 'Flat soda. +25 thirst.' },
  water: { name: 'Water Bottle', cat: 'drink', stack: 4, weight: 0.5, icon: 'bottle', color: '#4a7a9a', thirst: 32, desc: 'Clean water. +32 thirst.' },
  jerky: { name: 'Jerky', cat: 'food', stack: 6, weight: 0.2, icon: 'meat', color: '#7a4a32', food: 16, desc: 'Dry meat. +16 food.' },
  chocolate: { name: 'Chocolate', cat: 'food', stack: 4, weight: 0.1, icon: 'bar', color: '#5a3a2a', food: 14, morale: 8, desc: 'A small morale boost.' },

  // --- medical ---
  bandage: { name: 'Bandage', cat: 'med', stack: 6, weight: 0.1, icon: 'cloth', color: '#d8d2c0', heal: 22, stopBleed: true, desc: 'Stops bleeding, +22 health.' },
  firstaid: { name: 'First Aid Kit', cat: 'med', stack: 2, weight: 1.2, icon: 'medkit', color: '#c8c8c0', heal: 55, stopBleed: true, desc: 'Full heal +55.' },
  painkillers: { name: 'Painkillers', cat: 'med', stack: 6, weight: 0.1, icon: 'pill', color: '#d8c060', heal: 8, painkiller: true, desc: 'Slowly restores health.' },
  alcohol: { name: 'Alcohol', cat: 'mat', stack: 4, weight: 0.5, icon: 'bottle', color: '#a08a4a', heal: 4, desc: 'Drink it or craft with it.' },
  antiseptic: { name: 'Antiseptic', cat: 'med', stack: 3, weight: 0.3, icon: 'bottle', color: '#5a9a7a', heal: 10, stopBleed: true, desc: '+10 health, stops bleeding.' },

  // --- materials ---
  wood: { name: 'Wood Plank', cat: 'mat', stack: 8, weight: 0.6, icon: 'plank', color: '#7a5a34', desc: 'Barricade material.' },
  rag: { name: 'Rag', cat: 'mat', stack: 8, weight: 0.1, icon: 'cloth', color: '#b8ac90', desc: 'Cloth. Combine with alcohol.' },
  nails: { name: 'Nails', cat: 'mat', stack: 20, weight: 0.02, icon: 'nails', color: '#9a9a92', desc: 'Fixes boards together.' },
  tape: { name: 'Duct Tape', cat: 'mat', stack: 3, weight: 0.2, icon: 'tape', color: '#6a6a60', desc: 'Fixes almost anything.' },
  fuel: { name: 'Fuel Can', cat: 'mat', stack: 2, weight: 3.0, icon: 'fuel', color: '#8a6a3a', desc: 'Burns things. Molotov fuel.' },
  battery: { name: 'Battery', cat: 'mat', stack: 4, weight: 0.2, icon: 'battery', color: '#4a6a8a', desc: 'Flashlight fuel.' },
  metal: { name: 'Metal Scrap', cat: 'mat', stack: 8, weight: 0.8, icon: 'scrap', color: '#8a8a84', desc: 'Bent steel.' },
  cloth: { name: 'Cloth', cat: 'mat', stack: 8, weight: 0.1, icon: 'cloth', color: '#8a8474', desc: 'Fabric scraps.' },

  // --- tools & gear ---
  flashlight: { name: 'Flashlight', cat: 'tool', stack: 1, weight: 0.6, icon: 'torch', color: '#c8b04a', desc: 'Batteries required. Press F.' },
  knife: { name: 'Knife', cat: 'weapon', stack: 1, weight: 0.4, icon: 'knife', color: '#b0b4b8', dmg: 18, reach: 24, desc: 'Fast, quiet blade.' },
  crowbar: { name: 'Crowbar', cat: 'weapon', stack: 1, weight: 1.4, icon: 'crowbar', color: '#9a3a2a', dmg: 26, reach: 26, breakDoor: true, desc: 'Good for doors and skulls.' },
  bat: { name: 'Baseball Bat', cat: 'weapon', stack: 1, weight: 1.2, icon: 'bat', color: '#8a6a44', dmg: 32, reach: 28, knock: 90, desc: 'Slow but heavy hits.' },
  axe: { name: 'Fire Axe', cat: 'weapon', stack: 1, weight: 1.8, icon: 'axe', color: '#a0a4a8', dmg: 38, reach: 26, breakDoor: true, desc: 'Splits doors open.' },
  pistol: { name: 'Pistol', cat: 'weapon', stack: 1, weight: 1.0, icon: 'pistol', color: '#5a5a60', gun: 'pistol', dmg: 34, noise: 190, desc: '9mm. Noisy.' },
  shotgun: { name: 'Shotgun', cat: 'weapon', stack: 1, weight: 2.4, icon: 'shotgun', color: '#6a4a3a', gun: 'shotgun', dmg: 22, pellets: 6, spread: 0.26, noise: 260, desc: 'Devastating up close.' },
  rifle: { name: 'Rifle', cat: 'weapon', stack: 1, weight: 3.0, icon: 'rifle', color: '#4a4038', gun: 'rifle', dmg: 48, noise: 320, desc: 'Loud. Very loud.' },

  // --- crafted / throwable ---
  molotov: { name: 'Molotov', cat: 'weapon', stack: 2, weight: 0.9, icon: 'molotov', color: '#a05a2a', throwable: true, desc: 'Thrown fire. Burns zombies.' },
  baton: { name: 'Improvised Baton', cat: 'weapon', stack: 1, weight: 0.7, icon: 'bat', color: '#7a5a34', dmg: 21, reach: 25, desc: 'Wood and tape.' },
  torch: { name: 'Torch', cat: 'tool', stack: 1, weight: 0.9, icon: 'torch', color: '#d07a2a', light: true, desc: 'Light source. Press F.' },

  // --- ammo ---
  ammo_pistol: { name: 'Pistol Ammo', cat: 'ammo', stack: 60, weight: 0.012, icon: 'ammo', color: '#c0a24a', ammo: 'pistol', desc: '9mm rounds.' },
  ammo_shell: { name: 'Shells', cat: 'ammo', stack: 30, weight: 0.05, icon: 'shell', color: '#a03a2a', ammo: 'shotgun', desc: '12 gauge.' },
  ammo_rifle: { name: 'Rifle Ammo', cat: 'ammo', stack: 40, weight: 0.02, icon: 'ammo', color: '#7a8a4a', ammo: 'rifle', desc: 'Rifle rounds.' },
};

export const GUNS = {
  pistol: { name: 'Pistol', mag: 12, ammo: 'ammo_pistol', reload: 1.3, spread: 0.045, speed: 620, dmgMul: 1 },
  shotgun: { name: 'Shotgun', mag: 6, ammo: 'ammo_shell', reload: 2.2, spread: 0.26, speed: 520, dmgMul: 1 },
  rifle: { name: 'Rifle', mag: 10, ammo: 'ammo_rifle', reload: 2.0, spread: 0.06, speed: 900, dmgMul: 1 },
};

export function itemDef(id) { return ITEMS[id]; }
export function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }

export function newStack(id, count = 1) { return { id, count }; }

export function stackWeight(s) { return (ITEMS[s.id]?.weight || 0) * s.count; }

export function addToInventory(inv, id, count = 1) {
  const def = ITEMS[id];
  if (!def) return 0;
  let left = count;
  for (const s of inv) {
    if (s.id !== id || s.count >= def.stack) continue;
    const can = Math.min(def.stack - s.count, left);
    s.count += can; left -= can;
    if (left <= 0) return count;
  }
  while (left > 0) {
    const can = Math.min(def.stack, left);
    inv.push({ id, count: can });
    left -= can;
    if (inv.length >= 40) break;
  }
  return count - left;
}

export function countItem(inv, id) {
  let n = 0;
  for (const s of inv) if (s.id === id) n += s.count;
  return n;
}

export function removeItem(inv, id, count = 1) {
  let left = count;
  for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
    if (inv[i].id !== id) continue;
    const take = Math.min(inv[i].count, left);
    inv[i].count -= take; left -= take;
    if (inv[i].count <= 0) inv.splice(i, 1);
  }
  return count - left;
}

export function consumeStack(inv, index, count = 1) {
  const s = inv[index];
  if (!s) return;
  s.count -= count;
  if (s.count <= 0) inv.splice(index, 1);
}
