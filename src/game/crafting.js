// Crafting recipes
export const RECIPES = [
  { id: 'bandage', name: 'Bandage', out: ['bandage', 1], in: [['rag', 2], ['alcohol', 1]], time: 1.2, desc: 'Rag + alcohol' },
  { id: 'plank', name: 'Wood Plank', out: ['wood', 1], in: [['nails', 2]], time: 0.8, desc: 'Nails + wood (barricade)' },
  { id: 'molotov', name: 'Molotov', out: ['molotov', 1], in: [['alcohol', 2], ['rag', 1]], time: 1.5, desc: 'Fires everything nearby' },
  { id: 'baton', name: 'Improvised Baton', out: ['baton', 1], in: [['wood', 2], ['tape', 1]], time: 1.0, desc: 'A blunt weapon' },
  { id: 'torch', name: 'Torch', out: ['torch', 1], in: [['wood', 1], ['rag', 1], ['fuel', 1]], time: 1.0, desc: 'Light source, burns zombies' },
  { id: 'ammo_pistol', name: 'Pistol Ammo', out: ['ammo_pistol', 6], in: [['metal', 1], ['nails', 2]], time: 1.4, desc: 'Improvised rounds' },
  { id: 'snack', name: 'Snack', out: ['chocolate', 1], in: [['soda', 1], ['jerky', 1]], time: 0.6, desc: 'Morale in a can' },
];

export function canCraft(inv, recipe) {
  for (const [id, n] of recipe.in) {
    let have = 0;
    for (const s of inv) if (s.id === id) have += s.count;
    if (have < n) return false;
  }
  return true;
}
