# Formicarium

A 2D pixel-art ant colony sandbox. You see a cross-section of a glass formicarium:
sand, glass walls and open air. It starts **empty**. You place a queen, food, and
creatures, then the ants dig, forage, tend brood and fight off intruders on their own.

No build step and no runtime dependencies: vanilla ES modules and HTML5 Canvas 2D.

## Run it

Requirements: Node.js 18 or newer (only for the static server and tests).

```bash
npm start            # serves the project on http://localhost:8080 (0.0.0.0)
PORT=3000 npm start  # another port
```

Open the address in a modern browser. You can also open `index.html` through
any static file server.

Tests:

```bash
npm test             # unit, integration (100 ants x 1000 ticks) and performance (200 ants)
npm run build:atlas  # regenerates assets/atlas.png and assets/atlas.json
```

## Controls

| Action | Input |
| --- | --- |
| Place / paint with the selected tool | left click (drag paints terrain tools) |
| Remove ants, enemies and terrain under the brush | right click (drag works too) |
| Pan the camera | `W A S D` or arrow keys |
| Zoom 1x / 2x / 4x (integer) | mouse wheel, `+` `-`, or the `Z` button |
| Select a tool | `1`-`0`, `Q E R T Y U I O P F` (shown on each button) |
| Brush size 1 / 3 / 5 | `[` `]` or the buttons |
| Spawn quantity 1 / 5 / 10 | `G` or the buttons |
| Pause / play | `Space` |
| Simulation speed x1 / x2 / x4 | `F2` or the buttons |
| Save / load (browser storage) | `F5` / `F9` (or SAVE / LOAD) |
| Reset to empty | `Delete` (or RESET) |
| Debug overlays | `V` pheromones, `X` ant states, `N` cell grid, `M` ant paths |
| Inspect a cell or creature | select the INSPECT tool (`F`) and click; click an ant or enemy to see all its data (role, needs, task, target, carried item, path, memory, pheromones). `Esc` clears the selection |
| Help | `H` |

Rendering: each move is a glide from the old cell to the new one, spread over the time the ant needs for one step (1 / speed ticks), so walking is smooth. Sprites are mirrored when facing left. The sprite follows the task: walk cycle, dig pose (head down, mandibles in the sand) while digging, bite pose while fighting.

Tools: worker, queen (one per colony), soldier, raider (enemy ant), beetle, spider;
paint sand, dirt, clay, rock, water; food (seed, leaf, sugar); egg, larva; eraser;
paint tunnel, paint chamber; inspect.

The queen's first placement carves a chamber and a shaft to the surface. Ants can
only stand on passable cells that touch solid ground, or inside tunnels and
chambers. Water drowns them.

## What the simulation does

**Terrain.** Each cell has a type, density, subtype (food kind), moisture, light and a
stress counter. Sand and dirt fall, and slide diagonally when the slope allows
(angle of repose). Water falls and spreads sideways and wets the soil next to it.
Sand with fewer than 3 solid neighbours is unstable: after a delay it collapses
into a free cell. A collapse crushes anything standing there. Loose soil does not
fall into ant-made tunnels or chambers, so a well-supported nest stays open.

**Pheromones.** Four layers: home, food, danger and explore. Each tick every layer
evaporates by x0.99. Every second tick it also diffuses to the four neighbours.
Update cost is proportional to the number of cells. Empty layers are skipped.

**Food supply.** Without food the colony starves. While the colony store is below 20, a pile of sugar (8 units) drops on the surface above the nest every 300 ticks (`FOOD_SUPPLY_*` in `src/config.js`). Player-placed food still works as before.

**Crushing.** When loose sand lands on an ant, the ant is pushed into a free neighbouring cell and takes 8 damage (`CRUSH_DAMAGE`). If there is no free cell it stays and takes the hit; it dies only when its HP runs out.

**Ants.** Roles: queen (immobile, lays eggs, starves without food), worker, digger,
forager, nurse, soldier, scout, builder and undertaker. Each non-queen ant runs a
utility-based decision every few ticks. It scores its needs (hunger, thirst, energy),
the colony's needs, and nearby stimuli (food, danger, sand, brood). Ants have a short
memory of danger and of cells that failed. Movement uses cached A* paths (budgeted
per tick), with a greedy fallback when no path is found. Ants follow pheromone
gradients as well. Colonies assign new roles based on the largest deficit against
target shares. Soldiers are called up on alarm, and builders after cave-ins.

**Brood.** Any ant can feed larvae and carry eggs (nurses do it best). Egg (80 ticks) -> larva (needs 3 feedings from nurses and at least 160
ticks; starves at hunger 100) -> pupa (120 ticks) -> adult. The adult's role is
chosen by the colony. Brood buried under sand dies.

**Enemies.** Raider ants, beetles and spiders hunt anything in sight, otherwise
wander. Species differ in speed, sight, HP and damage. Hits leave danger pheromone
and raise colony alarm. Corpses become food.

## Architecture

```
index.html            page shell, canvas CSS scaling (pixelated)
src/
  main.js             entry point, fixed-step main loop, app actions
  config.js           all tuning constants (balance changes belong here)
  utils.js            seeded PRNG (mulberry32), hashing, grid helpers
  world.js            terrain enum, typed-array grid, passability tables
  pheromones.js       four pheromone layers, evaporation and diffusion
  physics.js          sand/dirt gravity, water, cave-ins (via hooks, no ant knowledge)
  spatial.js          uniform-grid spatial hash for neighbour queries
  pathfinding.js      A* with a node budget and reusable arrays
  movement.js         walking, greedy steps, gradient following, wandering, fleeing
  ant.js              Ant entity (state only) and role tables
  ai.js               ant utility AI and task steps (dig, forage, nurse, ...)
  colony.js           food store, queen, egg laying, role choice, alarms
  enemies.js          enemy species and their simple AI
  items.js            Brood entity and its growth rules
  combat.js           attacks, cooldowns, danger deposits, alarms
  game.js             Game object: fixed tick order, spawning, tools, indices
  tools.js            tool catalogue (GUI, hotkeys and applyTool read it)
  sprites.js          palette (32 colours) and procedural sprite generator
  assets.js           builds the sprite atlas at start-up from sprites.js (no binary loaded)
  font.js             3x5 bitmap font
  render.js           terrain buffer, sprites, overlays, HUD, help
  gui.js              bottom panel: button layout, hit testing, tooltips
  input.js            mouse, wheel, keyboard, camera panning
  save.js             JSON save/load with base64 typed arrays
tools/
  build-atlas.mjs     writes assets/atlas.png (zlib PNG encoder, no dependencies)
  serve.mjs           static server bound to 0.0.0.0
test/                 node:test suites (see npm test)
assets/               atlas.png and atlas.json for external use (the game does not load them)
```

Tick order (`Game.step`, 20 Hz): pheromones -> physics -> enemies -> ants -> combat
-> brood -> colonies -> removal of the dead. The renderer runs at display rate and
reads the state. Simulation code never touches the DOM. Only `Game` holds
simulation state. Other modules receive it as an argument.

Rendering: the terrain is redrawn into an `ImageData` buffer once per sim tick (or
after a paint action), then drawn with `imageSmoothingEnabled = false`. Sprites are
drawn on top. Zoom is an integer transform, so pixels stay crisp.

Save format (`localStorage` key `hjgyj.formicarium.save.v1`): JSON with
`version`, `seed`, `tick`, `rng`, `stats`, the world arrays (base64),
quantised pheromones (8 bits per cell), colonies, and the entity lists. Object
references are stored as ids. Paths are not stored and are recomputed after
loading. The version is checked on load.

Palette: 32 named colours in `src/sprites.js`. Every sprite and UI colour uses them.

## Extending it

- **New tool:** add an entry to `TOOLS` in `src/tools.js` with an icon sprite name. For
  a new kind of action, add a `case` in `Game.applyTool`. The GUI, hotkeys and
  tooltips pick it up automatically (hotkey must be unique).
- **New sprite:** add a spec in `buildSpecs()` in `src/sprites.js`. The game builds
  the atlas from it at start-up; run `npm run build:atlas` only to refresh the
  exported `assets/atlas.png` file.
- **New ant role:** add it to `ROLE` and `ROLE_SHARE` in `src/ant.js`, add a tint in
  `ROLE_TINTS` in `src/sprites.js`, and add a `decide...` branch in `src/ai.js`.
- **New enemy:** add it to `ENEMY_SPECIES` in `src/enemies.js` and a sprite
  `<species>_0` / `_1`. Add the tool in `src/tools.js`.
- **Balance:** change constants in `src/config.js`.
- **New terrain:** add the enum entry and its rows in `world.js` (`SOLID`,
  `ANT_PASSABLE`, `DISPLACEABLE`, ...), then a colour in `render.js`.

## Known limitations

- No temperature, no mud (only moisture), no fungus farming, no day/night cycle,
  no seasons, no multi-colony war, no minimap and no mod support.
- Queens are not replaced when they die. The colony becomes queenless.
- Ants can crowd on the surface near the nest entrance early on.
- The visuals were checked with headless renders (`@napi-rs/canvas`), not in a
  real browser. Frame-rate targets were measured only as simulation tick time
  (200 ants: about 4 ms per 20 Hz tick on the development machine).
  Browser rendering cost has not been measured.
- Saves go to browser `localStorage`. There is no export or import file.

## Credits

See `CREDITS.txt`. All art is original and created in code.
