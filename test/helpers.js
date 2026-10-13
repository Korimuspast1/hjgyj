/** Shared test helpers: build small, deterministic games. */
import { Game } from '../src/game.js';
import { CELL } from '../src/world.js';

/** A fresh formicarium game with a queen placed and a colony founded. */
export function makeColonyGame(seed = 42) {
  const game = new Game(seed);
  game.spawnQueen(240, 100);
  return game;
}

/** Spawns `count` worker ants at random open spots near the surface. */
export function addWorkers(game, count, role = 'worker') {
  let placed = 0;
  for (let k = 0; k < count * 4 && placed < count; k++) {
    const spot = game.findOpenNear(240 + (k % 50) - 25, 58, 20);
    if (!spot) continue;
    game.spawnAnt(game.colonies[0].id, spot.x, spot.y, role);
    placed++;
  }
  return placed;
}

/** Clears a game's terrain to empty air except the outer glass border. */
export function emptyWorld(game) {
  const w = game.world;
  w.type.fill(CELL.EMPTY);
  w.density.fill(0);
  w.subtype.fill(0);
  w.moisture.fill(0);
  w.stress.fill(0);
  for (let x = 0; x < w.width; x++) {
    w.setIndex(w.index(x, 0), CELL.GLASS);
    w.setIndex(w.index(x, w.height - 1), CELL.GLASS);
  }
  for (let y = 0; y < w.height; y++) {
    w.setIndex(w.index(0, y), CELL.GLASS);
    w.setIndex(w.index(w.width - 1, y), CELL.GLASS);
  }
  game.refreshSurface();
  return game;
}
