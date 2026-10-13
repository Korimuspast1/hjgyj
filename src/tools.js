/**
 * Catalogue of player tools. The GUI, hotkeys and Game.applyTool all read from here,
 * so adding a tool means adding one entry (plus an icon sprite if it needs one).
 *
 * kind:
 *   ant | queen | enemy | brood  - spawn entities (quantity applies)
 *   paint                         - set a terrain type (brush applies)
 *   water | food | erase | carve  - special terrain edits
 *   inspect                       - show a cell's properties
 */
import { CELL, FOOD_KIND } from './world.js';

export const TOOLS = Object.freeze([
  { id: 'ant', label: 'SPAWN WORKER ANT', hotkey: '1', icon: 'ant_worker_0', kind: 'ant', role: 'worker' },
  { id: 'queen', label: 'SPAWN QUEEN (ONE PER COLONY)', hotkey: '2', icon: 'queen_0', kind: 'queen' },
  { id: 'soldier', label: 'SPAWN SOLDIER ANT', hotkey: '3', icon: 'ant_soldier_0', kind: 'ant', role: 'soldier' },
  { id: 'raider', label: 'SPAWN ENEMY ANT (RAIDER)', hotkey: '4', icon: 'raider_0', kind: 'enemy', species: 'raider' },
  { id: 'beetle', label: 'SPAWN BEETLE', hotkey: '5', icon: 'beetle_0', kind: 'enemy', species: 'beetle' },
  { id: 'spider', label: 'SPAWN SPIDER', hotkey: '6', icon: 'spider_0', kind: 'enemy', species: 'spider' },
  { id: 'sand', label: 'PAINT SAND', hotkey: '7', icon: 'ui_sand', kind: 'paint', cell: CELL.SAND },
  { id: 'dirt', label: 'PAINT DIRT', hotkey: '8', icon: 'ui_dirt', kind: 'paint', cell: CELL.DIRT },
  { id: 'clay', label: 'PAINT CLAY', hotkey: '9', icon: 'ui_clay', kind: 'paint', cell: CELL.CLAY },
  { id: 'rock', label: 'PAINT ROCK', hotkey: '0', icon: 'ui_rock', kind: 'paint', cell: CELL.ROCK },
  { id: 'water', label: 'PAINT WATER', hotkey: 'q', icon: 'ui_water', kind: 'water' },
  { id: 'seed', label: 'SPAWN FOOD: SEED', hotkey: 'e', icon: 'food_seed', kind: 'food', food: FOOD_KIND.SEED },
  { id: 'leaf', label: 'SPAWN FOOD: LEAF', hotkey: 'r', icon: 'food_leaf', kind: 'food', food: FOOD_KIND.LEAF },
  { id: 'sugar', label: 'SPAWN FOOD: SUGAR', hotkey: 't', icon: 'food_sugar', kind: 'food', food: FOOD_KIND.SUGAR },
  { id: 'egg', label: 'SPAWN EGG', hotkey: 'y', icon: 'egg', kind: 'brood', brood: 'egg' },
  { id: 'larva', label: 'SPAWN LARVA', hotkey: 'u', icon: 'larva', kind: 'brood', brood: 'larva' },
  { id: 'eraser', label: 'ERASER (RIGHT-CLICK ANYWHERE)', hotkey: 'i', icon: 'ui_eraser', kind: 'erase' },
  { id: 'tunnel', label: 'PAINT TUNNEL', hotkey: 'o', icon: 'ui_tunnel', kind: 'carve', cell: CELL.TUNNEL },
  { id: 'chamber', label: 'PAINT CHAMBER', hotkey: 'p', icon: 'ui_chamber', kind: 'carve', cell: CELL.CHAMBER },
  { id: 'inspect', label: 'INSPECT CELL', hotkey: 'f', icon: 'ui_inspect', kind: 'inspect' },
]);

export const TOOLS_BY_ID = Object.freeze(Object.fromEntries(TOOLS.map((tool) => [tool.id, tool])));

/** Tools that spawn entities (their drag behaviour differs from terrain painting). */
export const SPAWN_KINDS = Object.freeze(['ant', 'queen', 'enemy', 'brood']);
