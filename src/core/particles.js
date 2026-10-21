// Simple particle system (blood, sparks, smoke, gibs, shells, dust)
export class Particles {
  constructor(max = 1600) {
    this.max = max;
    this.list = [];
  }

  spawn(p) {
    if (this.list.length >= this.max) this.list.shift();
    this.list.push(Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, size: 2,
      color: '#8c1f1f', drag: 0.9, gravity: 0, fade: 1, glow: false, kind: 'blood'
    }, p));
  }

  blood(x, y, dx, dy, amount = 8, color = '#8e1c1c') {
    for (let i = 0; i < amount; i++) {
      const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
      const sp = 25 + Math.random() * 90;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35 + Math.random() * 0.5, maxLife: 0.8,
        size: Math.random() < 0.3 ? 3 : 2, color, drag: 0.88, kind: 'blood'
      });
    }
  }

  gib(x, y, amount = 6) {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 120;
      this.spawn({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.6 + Math.random() * 0.7, size: 2 + ((Math.random() * 2) | 0),
        color: Math.random() < 0.5 ? '#6d1515' : '#3f2a25', drag: 0.9, kind: 'gib'
      });
    }
  }

  spark(x, y, color = '#ffd27a') {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 90;
      this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.2 + Math.random() * 0.2, size: 1, color, glow: true, drag: 0.86, kind: 'spark' });
    }
  }

  smoke(x, y, amount = 6, color = '#3c3c3c') {
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2;
      this.spawn({
        x: x + (Math.random() - 0.5) * 4, y: y + (Math.random() - 0.5) * 4,
        vx: Math.cos(a) * 8, vy: Math.sin(a) * 8 - 6,
        life: 0.9 + Math.random() * 0.9, size: 2 + Math.random() * 3,
        color, drag: 0.96, fade: 0.6, kind: 'smoke'
      });
    }
  }

  casing(x, y, dx, dy) {
    const a = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.2;
    const sp = 40 + Math.random() * 50;
    this.spawn({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.9, size: 2, color: '#c8a03c', drag: 0.9, kind: 'casing', gravity: 0 });
  }

  dust(x, y, amount = 4, color = '#6b6b62') {
    for (let i = 0; i < amount; i++) {
      this.spawn({ x, y, vx: (Math.random() - 0.5) * 40, vy: (Math.random() - 0.5) * 40, life: 0.3 + Math.random() * 0.3, size: 1 + ((Math.random() * 2) | 0), color, drag: 0.85, kind: 'dust' });
    }
  }

  fire(x, y) {
    for (let i = 0; i < 3; i++) {
      this.spawn({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 20 - 14,
        life: 0.4 + Math.random() * 0.4, size: 2 + ((Math.random() * 2) | 0),
        color: Math.random() < 0.5 ? '#ff9a2a' : '#ffd24a', drag: 0.9, glow: true, kind: 'fire'
      });
    }
  }

  update(dt) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) { l.splice(i, 1); continue; }
      p.vx *= Math.pow(p.drag, dt * 60);
      p.vy *= Math.pow(p.drag, dt * 60);
      p.vy += p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  }

  draw(ctx) {
    for (const p of this.list) {
      const a = Math.max(0, Math.min(1, p.life / (p.maxLife || p.life)));
      ctx.globalAlpha = p.fade ? a : Math.min(1, a * 1.6);
      ctx.fillStyle = p.color;
      const s = p.size;
      if (p.glow) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      }
    }
    ctx.globalAlpha = 1;
  }
}
