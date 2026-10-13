/**
 * Global tuning constants for the formicarium simulator.
 * Balance changes should happen here, not scattered across systems.
 */

// ---- Resolution & layout ----------------------------------------------------
export const WORLD_WIDTH = 480;        // grid cells; 1 cell = 1 internal pixel at zoom 1
export const WORLD_HEIGHT = 270;
export const VIEW_WIDTH = 480;         // internal render target
export const VIEW_HEIGHT = 270;        // world viewport (top area)
export const PANEL_HEIGHT = 48;        // GUI panel (bottom area)
export const CANVAS_WIDTH = VIEW_WIDTH;
export const CANVAS_HEIGHT = VIEW_HEIGHT + PANEL_HEIGHT;
export const ZOOM_LEVELS = [1, 2, 4];

// ---- Time -------------------------------------------------------------------
export const TICKS_PER_SECOND = 20;    // fixed simulation rate
export const SPEED_LEVELS = [1, 2, 4];
export const MAX_TICKS_PER_FRAME = 16; // avoids a spiral of death at x4 speed
export const DAY_TICKS = 2400;         // 2 real minutes per in-game day at x1
export const ANT_LIFESPAN_TICKS = 20 * DAY_TICKS;

// ---- Terrain ----------------------------------------------------------------
export const SURFACE_Y = 60;           // first row of sand; rows above are open air

// ---- Pheromones -------------------------------------------------------------
export const PHEROMONE_MAX = 100;
export const PHEROMONE_EVAPORATION = 0.99;  // multiplied every tick
export const PHEROMONE_DIFFUSION = 0.05;    // share spread to 4 neighbours
export const PHEROMONE_DIFFUSE_EVERY = 2;   // diffusion every N ticks (cost control)

// ---- Ant AI -----------------------------------------------------------------
export const SIGHT_RADIUS = 8;
export const NEST_RADIUS = 3;
export const MAX_PATHS_PER_TICK = 8;   // A* budget shared by all walkers
export const PATH_MAX_NODES = 3000;
export const PATH_RETRY_TICKS = 30;
export const HUNGER_RATE = 0.02;
export const THIRST_RATE = 0.015;
export const POPULATION_CAP = 300;

// ---- Colony & brood ---------------------------------------------------------
export const QUEEN_FOOD_RATE = 0.005;
export const LAY_INTERVAL = 90;
export const START_FOOD = 15;
export const EGG_TICKS = 80;
export const LARVA_MIN_TICKS = 160;
export const PUPA_TICKS = 120;
export const LARVA_FEEDINGS = 3;

// ---- Food supply ------------------------------------------------------------
// Without new food the colony starves within a few minutes. A pile of sugar
// (8 units) drops near the nest every FOOD_SUPPLY_INTERVAL ticks while the store
// is low. Demand is about 0.005 per tick for the queen plus 1 per egg laid.
export const FOOD_SUPPLY_INTERVAL = 300;   // 15 s at x1
export const FOOD_SUPPLY_LOW = 20;         // only drop food while the store is below this
export const FOOD_SUPPLY_SPREAD = 40;      // cells either side of the nest

// ---- Cave-ins ---------------------------------------------------------------
export const SUPPORT_MIN = 3;          // fewer solid neighbours than this = unstable sand
export const CAVE_IN_DELAY = 14;       // ticks of instability before collapse
export const CAVE_IN_CHECK_EVERY = 2;
export const CAVE_IN_MAX_PER_CHECK = 40;
export const CRUSH_DAMAGE = 8;        // sand landing on an ant pushes it aside and hurts it

// ---- Tools ------------------------------------------------------------------
export const BRUSH_SIZES = [1, 3, 5];
export const QUANTITIES = [1, 5, 10];

// ---- Persistence ------------------------------------------------------------
export const SAVE_KEY = 'hjgyj.formicarium.save.v1';
export const SAVE_VERSION = 1;
