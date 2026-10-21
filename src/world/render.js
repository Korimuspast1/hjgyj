// World rendering: tiles, props, decals, entities
import { TILE, TS, TILE_INFO } from './tiles.js';
import { hash2 } from '../core/rng.js';
import { drawHumanoid, drawTree, drawCar, drawCorpse, drawItemIcon } from '../game/sprites.js';

export function renderWorld(ctx, game) {
  const world = game.world;
  const atlas = game.atlas;
  const cam = game.cam;
  const vw = game.viewW, vh = game.viewH;

  const x0 = Math.max(0, Math.floor((cam.x - vw / 2) / TS) - 1);
  const y0 = Math.max(0, Math.floor((cam.y - vh / 2) / TS) - 1);
  const x1 = Math.min(world.w - 1, Math.ceil((cam.x + vw / 2) / TS) + 1);
  const y1 = Math.min(world.h - 1, Math.ceil((cam.y + vh / 2) / TS) + 1);

  // ---------------------------------------------------------- floor layer
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const i = ty * world.w + tx;
      let id = world.tiles[i];
      if (id === TILE.DOOR) {
        const d = world.doors.get(i);
        if (d && d.open) id = d.floor || TILE.FLOOR_WOOD;
      } else if (id === TILE.WINDOW || id === TILE.GLASS) {
        const d = world.doors.get(i);
        if (d && d.broken) id = TILE.WALL;
      }
      const v = (hash2(tx, ty, 7) * 4) | 0;
      const [sx, sy] = atlas.index[id][v];
      ctx.drawImage(atlas.canvas, sx, sy, TS, TS, tx * TS, ty * TS, TS, TS);
    }
  }

  // ---------------------------------------------------------- decals
  for (const d of game.decals) {
    ctx.globalAlpha = d.a;
    ctx.fillStyle = d.c;
    ctx.fillRect(Math.round(d.x - d.r), Math.round(d.y - d.r * 0.5), Math.round(d.r * 2), Math.round(d.r));
  }
  ctx.globalAlpha = 1;

  // ---------------------------------------------------------- ground items
  for (const it of game.groundItems) {
    ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
    ctx.fillRect(it.x - 4, it.y + 3, 8, 3);
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(Math.round(it.x - 5), Math.round(it.y - 6));
    ctx.scale(10 / 12, 10 / 12);
    drawItemIcon(ctx, it.id, 12);
    ctx.restore();
    if (it.count > 1) {
      ctx.fillStyle = '#e7ece5';
      ctx.font = '6px monospace';
      ctx.fillText(it.count, it.x + 4, it.y - 6);
    }
  }

  // ---------------------------------------------------------- actors (y-sorted)
  const actors = [];
  for (const z of game.zombies) {
    if (z.x < x0 * TS - 40 || z.x > x1 * TS + 40 || z.y < y0 * TS - 40 || z.y > y1 * TS + 40) continue;
    actors.push(z);
  }
  for (const p of game.world.props) {
    if (p.type !== 'car') continue;
    if (p.x < x0 * TS - 40 || p.x > x1 * TS + 40 || p.y < y0 * TS - 40 || p.y > y1 * TS + 40) continue;
    actors.push(p);
  }
  if (!game.preview) actors.push(game.player);
  actors.sort((a, b) => (a.y + (a.sortY || 0)) - (b.y + (b.sortY || 0)));

  for (const a of actors) {
    if (a === game.player) {
      const p = game.player;
      drawHumanoid(ctx, {
        x: p.x, y: p.y, dirX: p.dirX, dirY: p.dirY, moving: p.moving && !p.sleeping, phase: p.phase,
        skin: '#c9a07c', shirt: '#4c5f52', pants: '#3a3f46', hair: '#4a3020',
        aim: p.aim, crouch: p.crouch, hurt: p.hurtFlash, dead: !!p.sleeping,
        aimWeapon: p.weapon && p.weapon.kind === 'gun' && !p.sleeping ? p.weapon.gun : null
      });
      if (p.flashlight) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#fff3c0';
        ctx.beginPath(); ctx.arc(p.x, p.y - 4, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    } else if (a.type === 'car') {
      drawCar(ctx, a);
    } else if (a.dead) {
      if (a.deadT < 90) {
        drawCorpse(ctx, { x: a.x, y: a.y, rot: a.rot, skin: a.skin, shirt: a.shirt });
      }
    } else {
      drawHumanoid(ctx, {
        x: a.x, y: a.y, dirX: Math.cos(a.angle), dirY: Math.sin(a.angle),
        moving: Math.hypot(a.vx, a.vy) > 4, phase: a.phase,
        skin: a.skin, shirt: a.shirt, pants: a.pants,
        zombie: true, hurt: a.hurtFlash, scale: a.def ? a.def.scale : 1,
        aim: a.angle
      });
    }
  }

  // trees drawn on top of actors they cover (canopy)
  for (const p of game.world.props) {
    if (p.type !== 'tree') continue;
    if (p.x < x0 * TS - 40 || p.x > x1 * TS + 40 || p.y < y0 * TS - 60 || p.y > y1 * TS + 40) continue;
    drawTree(ctx, p);
  }
}
