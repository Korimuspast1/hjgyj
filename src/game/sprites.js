// Pixel-art sprite drawing: characters, items, props
import { ITEMS } from './items.js';

const P = (ctx, x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

// ------------------------------------------------------------ item icons
export function drawItemIcon(ctx, id, size = 12) {
  const def = ITEMS[id];
  const icon = def ? def.icon : 'box';
  const c = def ? def.color : '#999';
  ctx.save();
  ctx.scale(size / 12, size / 12);
  ctx.imageSmoothingEnabled = false;
  switch (icon) {
    case 'can':
      P(ctx, 2, 2, 8, 9, c); P(ctx, 2, 2, 8, 2, '#c9cbb8'); P(ctx, 2, 9, 8, 2, '#5c6448');
      P(ctx, 3, 5, 6, 3, '#7d8a5c'); break;
    case 'bottle':
      P(ctx, 4, 1, 4, 2, '#2e3a44'); P(ctx, 3, 3, 6, 8, c); P(ctx, 4, 3, 2, 8, '#ffffff22');
      P(ctx, 3, 8, 6, 2, '#d8d2c0'); break;
    case 'meat':
      P(ctx, 2, 4, 8, 5, c); P(ctx, 3, 3, 5, 2, '#8d5b3e'); P(ctx, 4, 7, 4, 2, '#c9a88c'); break;
    case 'bar':
      P(ctx, 2, 4, 8, 6, c); P(ctx, 3, 6, 6, 1, '#3a241a'); P(ctx, 3, 9, 6, 1, '#3a241a'); break;
    case 'cloth':
      P(ctx, 2, 3, 8, 7, c); P(ctx, 3, 2, 3, 1, '#d8d2c0'); P(ctx, 7, 10, 3, 1, '#d8d2c0');
      P(ctx, 4, 5, 4, 1, '#a89c84'); break;
    case 'medkit':
      P(ctx, 1, 3, 10, 7, '#d8d8d0'); P(ctx, 5, 4, 2, 5, '#b03028'); P(ctx, 3, 6, 6, 2, '#b03028'); break;
    case 'pill':
      P(ctx, 2, 5, 4, 4, '#e8e4d8'); P(ctx, 7, 4, 4, 4, c); break;
    case 'plank':
      P(ctx, 1, 4, 10, 3, c); P(ctx, 1, 8, 10, 2, '#5c4229'); P(ctx, 2, 5, 8, 1, '#8d6a40'); break;
    case 'nails':
      for (let i = 0; i < 4; i++) { P(ctx, 2 + i * 2, 4 + (i % 2) * 3, 1, 4, c); P(ctx, 2 + i * 2, 4 + (i % 2) * 3, 1, 1, '#d8d8d0'); } break;
    case 'tape':
      P(ctx, 2, 3, 8, 6, c); P(ctx, 4, 5, 4, 2, '#3a3a34'); break;
    case 'fuel':
      P(ctx, 2, 3, 8, 8, c); P(ctx, 4, 1, 3, 2, '#4a4a44'); P(ctx, 3, 6, 6, 2, '#8a2a22'); break;
    case 'battery':
      P(ctx, 3, 3, 6, 8, c); P(ctx, 5, 1, 2, 2, '#c9c9c0'); P(ctx, 4, 6, 4, 3, '#d8dcd0'); break;
    case 'scrap':
      P(ctx, 2, 6, 5, 3, c); P(ctx, 6, 4, 4, 4, '#6e6e68'); P(ctx, 3, 3, 2, 3, '#a8a8a0'); break;
    case 'torch':
      P(ctx, 5, 5, 2, 7, '#6b4a2a'); P(ctx, 4, 1, 4, 5, '#e08a2a'); P(ctx, 5, 2, 2, 3, '#ffd05a'); break;
    case 'knife':
      P(ctx, 2, 5, 7, 2, '#c8ccd0'); P(ctx, 8, 4, 2, 4, '#c8ccd0'); P(ctx, 2, 7, 3, 2, '#4a3a2a'); break;
    case 'crowbar':
      P(ctx, 3, 2, 2, 8, c); P(ctx, 5, 2, 4, 2, c); P(ctx, 7, 1, 2, 3, c); break;
    case 'bat':
      P(ctx, 4, 1, 3, 9, c); P(ctx, 4, 9, 3, 2, '#5c4229'); break;
    case 'axe':
      P(ctx, 5, 2, 2, 9, '#6b4a2a'); P(ctx, 2, 2, 5, 4, '#b8bcc0'); P(ctx, 2, 2, 5, 1, '#d8dce0'); break;
    case 'pistol':
      P(ctx, 2, 5, 6, 2, '#2e2e32'); P(ctx, 3, 7, 2, 3, '#3a3a40'); P(ctx, 8, 5, 3, 2, '#4a4a50'); break;
    case 'shotgun':
      P(ctx, 1, 5, 9, 2, '#5a3f2c'); P(ctx, 9, 5, 3, 2, '#3a3a40'); P(ctx, 5, 7, 2, 2, '#4a3527'); break;
    case 'rifle':
      P(ctx, 1, 5, 10, 2, '#3a3a34'); P(ctx, 2, 4, 4, 1, '#5a4a38'); P(ctx, 4, 7, 2, 2, '#2a2a26'); break;
    case 'ammo':
      P(ctx, 2, 4, 8, 7, '#4a4436'); P(ctx, 3, 5, 2, 2, c); P(ctx, 6, 5, 2, 2, c); P(ctx, 4, 8, 2, 2, c); break;
    case 'shell':
      P(ctx, 4, 2, 4, 7, '#a03a2a'); P(ctx, 4, 9, 4, 2, '#c9b45a'); break;
    case 'molotov':
      P(ctx, 3, 4, 6, 7, '#6a5a2a'); P(ctx, 4, 2, 4, 2, '#8a7a3a'); P(ctx, 3, 6, 6, 2, '#e08a2a'); P(ctx, 5, 1, 2, 2, '#d8d2c0'); break;
    default:
      P(ctx, 2, 3, 8, 7, c); P(ctx, 2, 3, 8, 1, '#00000044');
  }
  ctx.restore();
}

// ------------------------------------------------------------ humans
export function drawShadow(ctx, x, y, rx = 7, ry = 3) {
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y + 7, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawHumanoid(ctx, o) {
  const {
    x, y, dirX = 0, dirY = 1, moving = false, walk = 0, phase = 0,
    skin = '#c9a07c', shirt = '#4a5a6a', pants = '#3a3f4a', hair = '#3a2a20',
    zombie = false, aim = 0, hurt = 0, crouch = false, dead = false, aimWeapon = null, scale = 1
  } = o;

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (scale !== 1) ctx.scale(scale, scale);

  if (dead) {
    ctx.rotate(Math.PI / 2);
  }

  const bob = moving ? Math.round(Math.sin(phase * 2) * 1) : 0;
  const legSwing = moving ? Math.round(Math.sin(phase * 2) * 2) : 0;
  const facingUp = dirY < -0.4 && Math.abs(dirY) >= Math.abs(dirX);
  const facingDown = dirY > 0.4 && Math.abs(dirY) >= Math.abs(dirX);
  const side = Math.abs(dirX) > Math.abs(dirY);
  const flip = dirX < 0;
  const h = crouch ? 2 : 0;

  // shadow
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(0, 8, 6, 2.6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // legs
  const legY = 1 + h;
  P(ctx, -4, legY + legSwing, 3, 7 - h, pants);
  P(ctx, 1, legY - legSwing, 3, 7 - h, pants);
  P(ctx, -4, legY + legSwing + 6 - h, 3, 1, '#22242a');
  P(ctx, 1, legY - legSwing + 6 - h, 3, 1, '#22242a');

  // torso
  P(ctx, -5, -8 + h + bob, 10, 9 - h, shirt);
  P(ctx, -5, -8 + h + bob, 10, 1, shade(shirt, 1.25));
  P(ctx, -5, 0 + h + bob, 10, 1, shade(shirt, 0.7));
  if (zombie) {
    P(ctx, -3, -5 + h + bob, 2, 2, '#6d1d1d');
    P(ctx, 1, -3 + h + bob, 2, 1, '#5a1414');
    P(ctx, -5, -4 + h + bob, 2, 3, '#7a2020');
  }

  // arms
  if (zombie) {
    const ext = facingUp ? [0, -3] : facingDown ? [0, 2] : [flip ? -5 : 5, 0];
    P(ctx, -5, -7 + h + bob, 3, 5, shirt);
    P(ctx, 2, -7 + h + bob, 3, 5, shirt);
    P(ctx, ext[0] - 1, ext[1] + (facingUp ? -2 : 0), 4, 3, skin);
    P(ctx, ext[0] + (facingUp ? 0 : -3), ext[1] + (facingUp ? -2 : 0), 3, 3, skin);
  } else if (aimWeapon) {
    P(ctx, -5, -7 + h + bob, 3, 4, shirt);
    P(ctx, 2, -7 + h + bob, 3, 4, shirt);
    const a = aim;
    const cx = Math.cos(a) * 5, cy = Math.sin(a) * 4 + (-5 + h + bob);
    P(ctx, Math.round(cx) - 1, Math.round(cy) - 1, 3, 3, skin);
  } else {
    P(ctx, -5, -7 + h + bob, 3, 5, shirt);
    P(ctx, 2, -7 + h + bob, 3, 5, shirt);
    P(ctx, -5, -2 + h + bob, 3, 2, skin);
    P(ctx, 2, -2 + h + bob, 3, 2, skin);
  }

  // head
  const headY = -16 + h + bob;
  P(ctx, -4, headY, 8, 8, skin);
  if (zombie) {
    P(ctx, -4, headY, 8, 3, '#4b5a3a'); // matted hair
    P(ctx, -3, headY + 4, 2, 1, '#2a2a1a');
    P(ctx, 1, headY + 4, 2, 1, '#2a2a1a');
    P(ctx, 0, headY + 6, 2, 1, '#3a1414');
  } else {
    P(ctx, -4, headY, 8, 3, hair);
    if (facingDown) {
      P(ctx, -2, headY + 4, 2, 1, '#241a14');
      P(ctx, 1, headY + 4, 2, 1, '#241a14');
    } else if (side) {
      P(ctx, flip ? -3 : 1, headY + 4, 2, 1, '#241a14');
    } else if (facingUp) {
      P(ctx, -4, headY, 8, 4, hair);
    }
  }
  if (hurt > 0) {
    ctx.globalAlpha = Math.min(0.6, hurt);
    ctx.fillStyle = '#c02020';
    ctx.fillRect(-6, headY - 1, 12, 11);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  // weapon in hands
  if (!dead && !zombie && aimWeapon) {
    drawWeapon(ctx, x, y + (-5 + h), aim, aimWeapon);
  }
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.min(255, Math.round(r * f)); g = Math.min(255, Math.round(g * f)); b = Math.min(255, Math.round(b * f));
  return `rgb(${r},${g},${b})`;
}

export function drawWeapon(ctx, x, y, angle, kind) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const len = kind === 'shotgun' ? 9 : kind === 'rifle' ? 11 : 6;
  const col = kind === 'shotgun' ? '#6a4a34' : kind === 'rifle' ? '#3a3a34' : '#2e2e32';
  ctx.fillStyle = col;
  ctx.fillRect(2, -1, len, 2);
  ctx.fillStyle = '#54545a';
  ctx.fillRect(2, -1, 2, 3);
  ctx.restore();
}

// ------------------------------------------------------------ props
export function drawTree(ctx, p) {
  const s = p.seed || 1;
  const r = p.r || 8;
  const dark = '#243a24', mid = p.shade || '#39573a', light = '#4a6b48';
  ctx.save();
  ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 5, r * 0.9, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  P(ctx, p.x - 2, p.y - 4, 4, 9, '#4a3524');
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const rr = r * (0.55 + ((s >> i % 8) % 7) / 16);
    const x = Math.round(p.x + Math.cos(a) * rr);
    const y = Math.round(p.y - 8 + Math.sin(a) * rr * 0.8);
    const c = ((s >> (i % 12)) & 3) === 0 ? light : (((s >> (i % 9)) & 1) ? mid : dark);
    ctx.fillStyle = c;
    ctx.fillRect(x - 2, y - 2, 4, 4);
  }
  ctx.restore();
}

export function drawCar(ctx, p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rot * Math.PI) / 180);
  const w = 30, h = 14;
  ctx.globalAlpha = 0.3; ctx.fillStyle = '#000';
  ctx.fillRect(1, 3, w, h + 2);
  ctx.globalAlpha = 1;
  const body = p.wrecked ? shade(p.color, 0.6) : p.color;
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = shade(p.color, 0.75);
  ctx.fillRect(0, 0, w, 2);
  ctx.fillStyle = shade(p.color, 1.25);
  ctx.fillRect(0, 0, 2, h);
  // roof + windows
  ctx.fillStyle = p.wrecked ? '#2a3236' : '#38505c';
  ctx.fillRect(8, 2, 12, h - 4);
  ctx.fillStyle = '#7c9aa6';
  ctx.fillRect(9, 3, 3, h - 6);
  ctx.fillRect(16, 3, 3, h - 6);
  // wheels
  ctx.fillStyle = '#17181b';
  ctx.fillRect(4, -1, 5, 2); ctx.fillRect(4, h - 1, 5, 2);
  ctx.fillRect(21, -1, 5, 2); ctx.fillRect(21, h - 1, 5, 2);
  // lights
  ctx.fillStyle = '#d8d2a0'; ctx.fillRect(w - 2, 2, 2, 3);
  ctx.fillStyle = '#a03a2a'; ctx.fillRect(w - 2, h - 5, 2, 3);
  if (p.wrecked) {
    ctx.fillStyle = '#1a1c1e';
    ctx.fillRect(6, 4, 4, 3);
    ctx.fillRect(18, 6, 5, 4);
  }
  ctx.restore();
}

export function drawCorpse(ctx, z) {
  ctx.save();
  ctx.translate(Math.round(z.x), Math.round(z.y));
  ctx.rotate(z.rot || 0);
  ctx.fillStyle = '#4b3a34';
  ctx.fillRect(-8, -3, 16, 6);
  ctx.fillStyle = z.shirt;
  ctx.fillRect(-5, -3, 8, 6);
  ctx.fillStyle = z.skin;
  ctx.fillRect(4, -3, 5, 6);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#5a1414';
  ctx.fillRect(-8, -1, 16, 3);
  ctx.restore();
}
