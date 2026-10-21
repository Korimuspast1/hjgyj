/**
 * Project Zomboid 2D Pixel Simulator
 * Features:
 * - 2D Top-Down / Isometric pixel-art aesthetic
 * - Physics: realistic movement with inertia, collision boxes, wall sliding, sprinting
 * - Line of Sight & Darkness / Vision Cone with Flashlight toggle (Project Zomboid style)
 * - Non-aggressive Zombies: idle wandering, groaning, wandering aimlessly or reacting passively to sound
 * - Combat: swinging axe/bat with cooldown, knockback, blood splatters, sound effects via Web Audio API
 * - Interactive House, Doors, Windows, Crates, Refrigerators, Trees, Road
 * - Project Zomboid authentic UI: Moodles (Hungry, Thirsty, Tired, Endurance), Inventory Window, Health Window, Crafting
 * - Day/Night cycle, Sound simulation (Shouting 'Q', swinging, walking)
 */

// Sound synthesis using Web Audio API (No external assets required!)
class SoundEngine {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
  playSwing() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.16);
    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.16);
  }
  playHit() {
    this.init();
    if (!this.ctx) return;
    // noise + low thud
    const bufferSize = this.ctx.sampleRate * 0.12;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
    noise.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start();
  }
  playFootstep() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.06);
  }
  playZombieGroan() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    const pitch = 65 + Math.random() * 30;
    osc.frequency.setValueAtTime(pitch, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(pitch - 20, this.ctx.currentTime + 0.6);
    gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, this.ctx.currentTime + 0.6);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.6);
  }
  playLoot() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, this.ctx.currentTime);
    osc.frequency.setValueAtTime(650, this.ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.2);
  }
  playDoor() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(140, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }
}

const audio = new SoundEngine();

// GAME STATE & CONSTANTS
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let width = (canvas.width = window.innerWidth);
let height = (canvas.height = window.innerHeight);

window.addEventListener('resize', () => {
  width = canvas.width = window.innerWidth;
  height = canvas.height = window.innerHeight;
});

// Controls & Inputs
const keys = {};
const mouse = { x: width / 2, y: height / 2, down: false, rightDown: false, worldX: 0, worldY: 0 };

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  audio.init();

  if (e.code === 'KeyI' || e.code === 'Tab') {
    e.preventDefault();
    toggleWindow('inventory-window');
  } else if (e.code === 'KeyH') {
    toggleWindow('health-window');
  } else if (e.code === 'KeyB') {
    toggleWindow('crafting-window');
  } else if (e.code === 'KeyF') {
    player.flashlight = !player.flashlight;
    addLog(player.flashlight ? 'Фонарик включен' : 'Фонарик выключен');
  } else if (e.code === 'KeyQ') {
    shout();
  } else if (e.code === 'KeyE') {
    interactNearest();
  } else if (e.code === 'Digit1') equipSlot(1);
  else if (e.code === 'Digit2') equipSlot(2);
  else if (e.code === 'Digit3') equipSlot(3);
  else if (e.code === 'Digit4') equipSlot(4);
  else if (e.code === 'Digit5') equipSlot(5);
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

window.addEventListener('mousemove', (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

window.addEventListener('mousedown', (e) => {
  audio.init();
  if (e.button === 0) {
    mouse.down = true;
    if (!isPointerOnUI(e.clientX, e.clientY)) {
      playerAttack();
    }
  } else if (e.button === 2) {
    mouse.rightDown = true;
    e.preventDefault();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) mouse.down = false;
  if (e.button === 2) mouse.rightDown = false;
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

function isPointerOnUI(x, y) {
  const el = document.elementFromPoint(x, y);
  return el && el.id !== 'gameCanvas';
}

// LOGGING
function addLog(text) {
  const container = document.getElementById('log-feed');
  const entry = document.createElement('div');
  entry.className = 'pz-log-entry';
  entry.innerText = text;
  container.appendChild(entry);
  setTimeout(() => {
    if (entry.parentNode) entry.parentNode.removeChild(entry);
  }, 4500);
}

// CAMERA
const camera = {
  x: 0,
  y: 0,
  targetX: 0,
  targetY: 0,
  zoom: 1.0,
  update(target) {
    // Lead camera slightly in direction of mouse for PZ style peek
    const aimOffsetX = (mouse.x - width / 2) * 0.25;
    const aimOffsetY = (mouse.y - height / 2) * 0.25;
    
    this.targetX = target.x + aimOffsetX;
    this.targetY = target.y + aimOffsetY;

    this.x += (this.targetX - this.x) * 0.1;
    this.y += (this.targetY - this.y) * 0.1;
  }
};

// WORLD & OBJECTS
const TILE_SIZE = 32;
const WORLD_WIDTH = 2800;
const WORLD_HEIGHT = 2400;

// Buildings & Static objects
const buildings = [
  // House 1: Safehouse
  { x: 300, y: 300, w: 420, h: 360, name: 'Жилой дом (База)', color: '#2c333a', roofColor: '#3c4854' },
  // House 2: Tool shed / Garage
  { x: 900, y: 250, w: 260, h: 220, name: 'Мастерская / Гараж', color: '#272a2e', roofColor: '#453a30' },
  // House 3: Grocery Store / Supermarket
  { x: 500, y: 880, w: 500, h: 380, name: 'Супермаркет "Spiffo Mart"', color: '#2a363a', roofColor: '#324e4b' },
  // House 4: Medical Clinic
  { x: 1200, y: 780, w: 320, h: 300, name: 'Медпункт', color: '#333b42', roofColor: '#435561' }
];

// Walls for collision (x, y, w, h)
const walls = [];

// Populate walls around buildings with doorways
buildings.forEach(b => {
  const wallThick = 12;
  const doorWidth = 46;

  // Top wall
  walls.push({ x: b.x, y: b.y, w: b.w, h: wallThick });
  // Left wall
  walls.push({ x: b.x, y: b.y, w: wallThick, h: b.h });
  // Right wall
  walls.push({ x: b.x + b.w - wallThick, y: b.y, w: wallThick, h: b.h });
  // Bottom wall with doorway gap in middle
  const halfBottom = (b.w - doorWidth) / 2;
  walls.push({ x: b.x, y: b.y + b.h - wallThick, w: halfBottom, h: wallThick });
  walls.push({ x: b.x + halfBottom + doorWidth, y: b.y + b.h - wallThick, w: halfBottom, h: wallThick });
});

// Interactive Objects: Doors, Windows, Containers, Trees
class InteractiveObject {
  constructor(x, y, w, h, type, name, items = []) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type; // 'door', 'container', 'tree', 'window'
    this.name = name;
    this.isOpen = false;
    this.items = items;
    this.health = 100;
  }

  interact() {
    if (this.type === 'door') {
      this.isOpen = !this.isOpen;
      audio.playDoor();
      addLog(this.isOpen ? `${this.name} открыта` : `${this.name} закрыта`);
    } else if (this.type === 'container') {
      openContainer(this);
      audio.playLoot();
    } else if (this.type === 'tree') {
      addLog(`Вы осмотрели ${this.name}. Можно срубить топором.`);
    }
  }

  draw(ctx, offsetX, offsetY) {
    const rx = this.x - offsetX;
    const ry = this.y - offsetY;

    if (this.type === 'door') {
      ctx.fillStyle = this.isOpen ? '#5a4632' : '#8b5a2b';
      if (this.isOpen) {
        ctx.fillRect(rx, ry, 12, this.h);
      } else {
        ctx.fillRect(rx, ry, this.w, this.h);
        ctx.fillStyle = '#ffd700';
        ctx.fillRect(rx + this.w - 10, ry + this.h / 2 - 2, 4, 4);
      }
    } else if (this.type === 'container') {
      // Wood crate or fridge
      ctx.fillStyle = this.name.includes('Холодильник') ? '#cbd5e1' : '#7c5e42';
      ctx.fillRect(rx, ry, this.w, this.h);
      ctx.strokeStyle = '#2b2118';
      ctx.lineWidth = 2;
      ctx.strokeRect(rx, ry, this.w, this.h);

      // Label icon
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.fillText(this.name.includes('Холодильник') ? '❄️' : '📦', rx + 6, ry + 18);
    } else if (this.type === 'tree') {
      // Pixel Tree
      ctx.fillStyle = '#1e3820';
      ctx.beginPath();
      ctx.arc(rx + this.w / 2, ry + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f5233';
      ctx.beginPath();
      ctx.arc(rx + this.w / 2 - 4, ry + this.h / 2 - 4, this.w / 2.6, 0, Math.PI * 2);
      ctx.fill();
      // trunk
      ctx.fillStyle = '#4a2f1b';
      ctx.fillRect(rx + this.w / 2 - 3, ry + this.h / 2 - 3, 6, 6);
    }
  }
}

const interactiveObjects = [];

// Place Doors at building bottom gaps
buildings.forEach(b => {
  const wallThick = 12;
  const doorWidth = 46;
  const halfBottom = (b.w - doorWidth) / 2;
  interactiveObjects.push(
    new InteractiveObject(b.x + halfBottom, b.y + b.h - wallThick, doorWidth, wallThick, 'door', 'Деревянная дверь')
  );
});

// Containers in House 1 (Safehouse)
interactiveObjects.push(
  new InteractiveObject(330, 330, 32, 32, 'container', 'Кухонный шкафчик', [
    { id: 'canned_beans', name: 'Консервированная фасоль', icon: '🥫', weight: 0.5, type: 'food', nutrition: 35 },
    { id: 'water_bottle', name: 'Бутылка свежей воды', icon: '🍶', weight: 0.8, type: 'drink', thirst: 50 },
    { id: 'can_opener', name: 'Консервный нож', icon: '🔪', weight: 0.2, type: 'tool' }
  ]),
  new InteractiveObject(380, 330, 36, 32, 'container', 'Холодильник', [
    { id: 'fresh_apple', name: 'Свежее яблоко', icon: '🍎', weight: 0.2, type: 'food', nutrition: 20 },
    { id: 'soda', name: 'Банка газировки', icon: '🥤', weight: 0.4, type: 'drink', thirst: 40, stamina: 15 }
  ]),
  new InteractiveObject(640, 330, 34, 34, 'container', 'Оружейный ящик', [
    { id: 'baseball_bat', name: 'Бейсбольная бита', icon: '🏏', weight: 2.0, type: 'weapon', damage: 32, range: 45 },
    { id: 'nails', name: 'Коробка гвоздей (x20)', icon: '🔩', weight: 0.3, type: 'material', count: 20 },
    { id: 'hammer', name: 'Молоток плотника', icon: '🔨', weight: 1.2, type: 'tool' }
  ]),
  new InteractiveObject(330, 580, 36, 36, 'container', 'Гардеробная', [
    { id: 'bandage', name: 'Стерильный бинт', icon: '🩹', weight: 0.1, type: 'medical', heal: 30 },
    { id: 'jacket', name: 'Кожаная куртка (+броня)', icon: '🧥', weight: 1.5, type: 'clothes' }
  ])
);

// Containers in Grocery Store
interactiveObjects.push(
  new InteractiveObject(540, 920, 36, 36, 'container', 'Продуктовая полка', [
    { id: 'chips', name: 'Чипсы Spiffo', icon: '🍟', weight: 0.2, type: 'food', nutrition: 25 },
    { id: 'chocolate', name: 'Шоколадный батончик', icon: '🍫', weight: 0.1, type: 'food', nutrition: 20, stamina: 10 },
    { id: 'canned_soup', name: 'Консервированный суп', icon: '🥫', weight: 0.6, type: 'food', nutrition: 40 }
  ]),
  new InteractiveObject(620, 920, 36, 36, 'container', 'Витрина с напитками', [
    { id: 'orange_juice', name: 'Апельсиновый сок', icon: '🧃', weight: 1.0, type: 'drink', thirst: 60 },
    { id: 'water_bottle_2', name: 'Бутылка воды', icon: '🍶', weight: 0.8, type: 'drink', thirst: 50 }
  ]),
  new InteractiveObject(820, 920, 36, 36, 'container', 'Аптечный стеллаж', [
    { id: 'painkillers', name: 'Обезболивающие таблетки', icon: '💊', weight: 0.1, type: 'medical', heal: 15 },
    { id: 'bandage_roll', name: 'Рулон бинтов (x2)', icon: '🩹', weight: 0.2, type: 'medical', heal: 40 }
  ])
);

// Containers in Clinic
interactiveObjects.push(
  new InteractiveObject(1240, 820, 40, 36, 'container', 'Медицинский сейф', [
    { id: 'medkit', name: 'Армейская аптечка первой помощи', icon: '🧰', weight: 1.5, type: 'medical', heal: 75 },
    { id: 'disinfectant', name: 'Спиртовой антисептик', icon: '🧴', weight: 0.4, type: 'medical', heal: 20 },
    { id: 'suture_needle', name: 'Хирургическая игла с нитью', icon: '🪡', weight: 0.1, type: 'medical', heal: 50 }
  ])
);

// Scatter trees outside
for (let i = 0; i < 60; i++) {
  const tx = 100 + Math.random() * (WORLD_WIDTH - 200);
  const ty = 100 + Math.random() * (WORLD_HEIGHT - 200);

  // Avoid placing inside buildings
  const inside = buildings.some(b => tx >= b.x - 30 && tx <= b.x + b.w + 30 && ty >= b.y - 30 && ty <= b.y + b.h + 30);
  if (!inside) {
    interactiveObjects.push(new InteractiveObject(tx, ty, 44, 44, 'tree', 'Сосна'));
  }
}

// BLOOD & DECALS
const bloodSplatters = [];
function addBlood(x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    bloodSplatters.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y + (Math.random() - 0.5) * 24,
      radius: 2 + Math.random() * 4,
      color: Math.random() > 0.4 ? '#680e0e' : '#851212',
      alpha: 0.8
    });
  }
  if (bloodSplatters.length > 300) bloodSplatters.splice(0, 50);
}

// PARTICLES & HIT EFFECTS
const particles = [];
function addHitSpark(x, y) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      decay: 0.05 + Math.random() * 0.05,
      color: Math.random() > 0.5 ? '#b91c1c' : '#ef4444',
      size: 2 + Math.random() * 2
    });
  }
}

// PLAYER
const player = {
  x: 480,
  y: 480,
  w: 24,
  h: 24,
  vx: 0,
  vy: 0,
  speed: 2.8,
  sprintSpeed: 4.8,
  angle: 0,
  flashlight: true,
  health: 100,
  stamina: 100,
  hunger: 88,
  thirst: 92,
  fatigue: 8,
  equippedSlot: 1,
  swingCooldown: 0,
  isSwinging: false,
  swingAngle: 0,
  footstepTimer: 0,
  inventory: [
    { id: 'fire_axe', name: 'Пожарный топор', icon: '🪓', weight: 2.5, type: 'weapon', damage: 45, range: 48 },
    { id: 'spiked_bat', name: 'Бита с гвоздями', icon: '🏏', weight: 2.2, type: 'weapon', damage: 38, range: 45 },
    { id: 'frying_pan', name: 'Чугунная сковорода', icon: '🍳', weight: 1.8, type: 'weapon', damage: 24, range: 38 },
    { id: 'chips_pack', name: 'Пачка сухариков', icon: '🥫', weight: 0.2, type: 'food', nutrition: 30 },
    { id: 'bandage_p', name: 'Стерильный бинт', icon: '🩹', weight: 0.1, type: 'medical', heal: 25 }
  ],
  equippedWeapon: { id: 'fire_axe', name: 'Пожарный топор', damage: 45, range: 48 }
};

// ZOMBIES (Non-aggressive by default as requested: wander slowly, moan, ignore or slowly glance)
class Zombie {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.w = 22;
    this.h = 22;
    this.vx = 0;
    this.vy = 0;
    this.speed = 0.5 + Math.random() * 0.4;
    this.angle = Math.random() * Math.PI * 2;
    this.health = 80;
    this.maxHealth = 80;
    this.dead = false;
    this.wanderTimer = Math.random() * 120;
    this.wanderDir = Math.random() * Math.PI * 2;
    this.moanTimer = 180 + Math.random() * 600;
    this.skinColor = ['#5b7264', '#4e6357', '#6d7f72'][Math.floor(Math.random() * 3)];
    this.clothesColor = ['#3b4252', '#434c5e', '#4c566a', '#3f2d2d'][Math.floor(Math.random() * 4)];
    this.headColor = '#708878';
    this.isAlerted = false; // if player shouts or hits them
    this.lookAtPlayer = false;
  }

  update() {
    if (this.dead) return;

    this.moanTimer--;
    if (this.moanTimer <= 0) {
      this.moanTimer = 400 + Math.random() * 700;
      const dist = Math.hypot(this.x - player.x, this.y - player.y);
      if (dist < 500) {
        audio.playZombieGroan();
      }
    }

    // Check distance to player
    const dist = Math.hypot(this.x - player.x, this.y - player.y);
    
    // Non-aggressive behavior:
    // They wander aimlessly around the neighborhood. If player is very close (< 60 px) or shouted, they turn their head and slowly shamble toward or around, but do not sprint or bite aggressively.
    if (this.isAlerted && dist > 50) {
      // Just slowly shuffle towards sound source or wander
      const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
      this.angle += (targetAngle - this.angle) * 0.05;
      this.vx = Math.cos(this.angle) * (this.speed * 0.6);
      this.vy = Math.sin(this.angle) * (this.speed * 0.6);
    } else {
      // Wander peacefully
      this.wanderTimer--;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 90 + Math.random() * 200;
        this.wanderDir += (Math.random() - 0.5) * 1.5;
      }
      this.angle += (this.wanderDir - this.angle) * 0.04;
      this.vx = Math.cos(this.angle) * (this.speed * 0.4);
      this.vy = Math.sin(this.angle) * (this.speed * 0.4);
    }

    // Move with collision
    let nx = this.x + this.vx;
    let ny = this.y + this.vy;

    // Check wall collision
    if (!checkCollision(nx, this.y, this.w, this.h)) {
      this.x = nx;
    } else {
      this.wanderDir += Math.PI * 0.5;
    }

    if (!checkCollision(this.x, ny, this.w, this.h)) {
      this.y = ny;
    } else {
      this.wanderDir += Math.PI * 0.5;
    }

    // World boundary
    this.x = Math.max(30, Math.min(WORLD_WIDTH - 30, this.x));
    this.y = Math.max(30, Math.min(WORLD_HEIGHT - 30, this.y));
  }

  takeDamage(amount, fromAngle) {
    if (this.dead) return;
    this.health -= amount;
    this.isAlerted = true;
    audio.playHit();
    addBlood(this.x, this.y, 8);
    addHitSpark(this.x, this.y);

    // Knockback
    this.x += Math.cos(fromAngle) * 16;
    this.y += Math.sin(fromAngle) * 16;

    if (this.health <= 0) {
      this.dead = true;
      addBlood(this.x, this.y, 16);
      addLog('Зомби повержен на землю');
    }
  }

  draw(ctx, offsetX, offsetY) {
    const rx = this.x - offsetX;
    const ry = this.y - offsetY;

    if (this.dead) {
      // Dead zombie on ground
      ctx.save();
      ctx.translate(rx, ry);
      ctx.rotate(this.angle);
      ctx.fillStyle = '#1c1f21';
      ctx.fillRect(-12, -8, 24, 16);
      ctx.fillStyle = this.skinColor;
      ctx.fillRect(-8, -6, 16, 12);
      ctx.fillStyle = '#401010';
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(this.angle);

    // Zombie Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body (torn clothes)
    ctx.fillStyle = this.clothesColor;
    ctx.fillRect(-9, -7, 18, 14);

    // Shoulders & Arms outstretched (classic PZ zombie stance)
    ctx.fillStyle = this.skinColor;
    // Left arm reaching forward
    ctx.fillRect(4, -8, 12, 4);
    // Right arm reaching forward
    ctx.fillRect(4, 4, 12, 4);

    // Head
    ctx.fillStyle = this.headColor;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    // Dead white eyes
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(3, -4, 3, 2);
    ctx.fillRect(3, 2, 3, 2);

    // Blood stains on zombie
    ctx.fillStyle = '#6b1111';
    ctx.fillRect(-2, -3, 4, 6);

    ctx.restore();

    // Health indicator if damaged
    if (this.health < this.maxHealth) {
      const barW = 24;
      const barH = 3;
      const pct = Math.max(0, this.health / this.maxHealth);
      ctx.fillStyle = '#111';
      ctx.fillRect(rx - barW / 2, ry - 18, barW, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(rx - barW / 2, ry - 18, barW * pct, barH);
    }
  }
}

const zombies = [];

// Populate 25 non-aggressive zombies wandering around the map
for (let i = 0; i < 28; i++) {
  const zx = 200 + Math.random() * (WORLD_WIDTH - 400);
  const zy = 200 + Math.random() * (WORLD_HEIGHT - 400);
  // Keep distance from spawn safehouse
  if (Math.hypot(zx - player.x, zy - player.y) > 250) {
    zombies.push(new Zombie(zx, zy));
  }
}

// COLLISION DETECTION
function checkCollision(x, y, w, h) {
  const px = x - w / 2;
  const py = y - h / 2;

  // Check walls
  for (const wall of walls) {
    if (px < wall.x + wall.w && px + w > wall.x && py < wall.y + wall.h && py + h > wall.y) {
      return true;
    }
  }

  // Check closed doors & solid containers
  for (const obj of interactiveObjects) {
    if (obj.type === 'door' && !obj.isOpen) {
      if (px < obj.x + obj.w && px + w > obj.x && py < obj.y + obj.h && py + h > obj.y) {
        return true;
      }
    } else if (obj.type === 'container' || obj.type === 'tree') {
      if (px < obj.x + obj.w && px + w > obj.x && py < obj.y + obj.h && py + h > obj.y) {
        return true;
      }
    }
  }

  return false;
}

// PLAYER ATTACK
function playerAttack() {
  if (player.swingCooldown > 0) return;
  player.swingCooldown = 22; // frame cooldown
  player.isSwinging = true;
  player.swingAngle = -Math.PI / 3;

  audio.playSwing();
  player.stamina = Math.max(0, player.stamina - 4);

  // Calculate hit zone
  const hitReach = player.equippedWeapon.range;
  const hitAngle = player.angle;
  const hitX = player.x + Math.cos(hitAngle) * (hitReach * 0.7);
  const hitY = player.y + Math.sin(hitAngle) * (hitReach * 0.7);

  // Check zombies in range and within swing arc
  let hitAny = false;
  for (const z of zombies) {
    if (z.dead) continue;
    const dist = Math.hypot(z.x - player.x, z.y - player.y);
    if (dist <= hitReach + 15) {
      const angleToZombie = Math.atan2(z.y - player.y, z.x - player.x);
      let angleDiff = Math.abs(angleToZombie - player.angle);
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      angleDiff = Math.abs(angleDiff);

      if (angleDiff < Math.PI / 2.5) {
        z.takeDamage(player.equippedWeapon.damage, player.angle);
        hitAny = true;
      }
    }
  }

  // Check interactive trees for woodcutting
  for (const obj of interactiveObjects) {
    if (obj.type === 'tree') {
      const dist = Math.hypot(obj.x + obj.w / 2 - player.x, obj.y + obj.h / 2 - player.y);
      if (dist < 50) {
        audio.playHit();
        addHitSpark(obj.x + obj.w / 2, obj.y + obj.h / 2);
        obj.health -= 35;
        if (obj.health <= 0) {
          obj.type = 'container';
          obj.name = 'Срубленное дерево (Доски)';
          obj.items = [
            { id: 'plank', name: 'Деревянная доска (x3)', icon: '🪵', weight: 3.0, type: 'material', count: 3 },
            { id: 'wood_twigs', name: 'Ветки для растопки', icon: '🌿', weight: 0.5, type: 'material' }
          ];
          addLog('Дерево срублено! Получены доски.');
        }
      }
    }
  }
}

// SHOUT (Q)
function shout() {
  addLog('Вы кричите: "Эй! Я здесь!"');
  audio.playSwing(); // alert tone

  // Alert nearby zombies
  zombies.forEach(z => {
    const dist = Math.hypot(z.x - player.x, z.y - player.y);
    if (dist < 400) {
      z.isAlerted = true;
    }
  });
}

// INTERACT (E)
function interactNearest() {
  let closest = null;
  let minDist = 65;

  for (const obj of interactiveObjects) {
    const cx = obj.x + obj.w / 2;
    const cy = obj.y + obj.h / 2;
    const dist = Math.hypot(cx - player.x, cy - player.y);
    if (dist < minDist) {
      minDist = dist;
      closest = obj;
    }
  }

  if (closest) {
    closest.interact();
  } else {
    addLog('Рядом ничего нет для взаимодействия');
  }
}

// HOTBAR & WEAPON EQUIP
function equipSlot(slotNum) {
  player.equippedSlot = slotNum;
  document.querySelectorAll('.hotbar-slot').forEach(s => s.classList.remove('active'));
  const slotEl = document.getElementById(`slot-${slotNum}`);
  if (slotEl) slotEl.classList.add('active');

  const item = player.inventory[slotNum - 1];
  if (item) {
    if (item.type === 'weapon') {
      player.equippedWeapon = item;
      addLog(`Экипировано: ${item.name}`);
    } else {
      useItem(item, slotNum - 1);
    }
  }
}

// INVENTORY & CONTAINER MANAGEMENT
let currentOpenContainer = null;
let selectedPlayerItemIndex = 0;

function openContainer(container) {
  currentOpenContainer = container;
  const win = document.getElementById('inventory-window');
  win.style.display = 'flex';
  document.getElementById('container-name').innerText = container.name.toUpperCase();
  refreshInventoryUI();
}

function refreshInventoryUI() {
  // Player inventory
  const playerList = document.getElementById('player-items');
  playerList.innerHTML = '';
  let totalWeight = 0;

  player.inventory.forEach((item, idx) => {
    totalWeight += item.weight || 0.5;
    const row = document.createElement('div');
    row.className = `pz-item-row ${idx === selectedPlayerItemIndex ? 'selected' : ''}`;
    row.innerHTML = `
      <div class="pz-item-icon">${item.icon || '📦'}</div>
      <div class="pz-item-name">${item.name}</div>
      <div class="pz-item-weight">${item.weight || 0.5} кг</div>
    `;
    row.onclick = () => {
      selectedPlayerItemIndex = idx;
      refreshInventoryUI();
    };
    playerList.appendChild(row);
  });
  document.getElementById('player-weight').innerText = `${totalWeight.toFixed(1)} / 15.0 кг`;

  // Container inventory
  const contList = document.getElementById('container-items');
  contList.innerHTML = '';
  if (currentOpenContainer && currentOpenContainer.items) {
    let contWeight = 0;
    currentOpenContainer.items.forEach((item, idx) => {
      contWeight += item.weight || 0.5;
      const row = document.createElement('div');
      row.className = 'pz-item-row';
      row.innerHTML = `
        <div class="pz-item-icon">${item.icon || '📦'}</div>
        <div class="pz-item-name">${item.name}</div>
        <button class="pz-btn" style="padding:2px 6px; font-size:10px;">Взять</button>
      `;
      row.querySelector('button').onclick = (e) => {
        e.stopPropagation();
        takeContainerItem(idx);
      };
      contList.appendChild(row);
    });
    document.getElementById('container-weight').innerText = `${contWeight.toFixed(1)} кг`;
  } else {
    contList.innerHTML = '<div style="color:#666; font-size:11px; padding:8px;">Пусто вокруг</div>';
    document.getElementById('container-weight').innerText = '0.0 кг';
  }
}

function takeContainerItem(idx) {
  if (!currentOpenContainer || !currentOpenContainer.items[idx]) return;
  const item = currentOpenContainer.items.splice(idx, 1)[0];
  player.inventory.push(item);
  audio.playLoot();
  addLog(`Взято: ${item.name}`);
  refreshInventoryUI();
  updateHotbarUI();
}

function takeAllContainer() {
  if (!currentOpenContainer || !currentOpenContainer.items.length) return;
  currentOpenContainer.items.forEach(item => player.inventory.push(item));
  currentOpenContainer.items = [];
  audio.playLoot();
  addLog('Всё содержимое забрано');
  refreshInventoryUI();
  updateHotbarUI();
}

function useItem(item, idx) {
  if (!item) return;

  if (item.type === 'food') {
    player.hunger = Math.min(100, player.hunger + (item.nutrition || 20));
    player.health = Math.min(100, player.health + 5);
    addLog(`Вы съели: ${item.name}`);
    player.inventory.splice(idx, 1);
  } else if (item.type === 'drink') {
    player.thirst = Math.min(100, player.thirst + (item.thirst || 40));
    player.stamina = Math.min(100, player.stamina + 20);
    addLog(`Вы выпили: ${item.name}`);
    player.inventory.splice(idx, 1);
  } else if (item.type === 'medical') {
    player.health = Math.min(100, player.health + (item.heal || 30));
    addLog(`Раны обработаны: ${item.name}`);
    player.inventory.splice(idx, 1);
  } else if (item.type === 'weapon') {
    player.equippedWeapon = item;
    addLog(`Оружие в руках: ${item.name}`);
  }
  refreshInventoryUI();
  updateHotbarUI();
}

function dropItem(idx) {
  if (!player.inventory[idx]) return;
  const item = player.inventory.splice(idx, 1)[0];
  addLog(`Выброшено на землю: ${item.name}`);

  // Put into near container or create ground item
  if (currentOpenContainer) {
    currentOpenContainer.items.push(item);
  }
  refreshInventoryUI();
  updateHotbarUI();
}

function updateHotbarUI() {
  for (let i = 1; i <= 5; i++) {
    const item = player.inventory[i - 1];
    const iconEl = document.getElementById(`slot-${i}-icon`);
    const nameEl = document.getElementById(`slot-${i}-name`);
    if (item) {
      iconEl.innerText = item.icon || '📦';
      nameEl.innerText = item.name;
    } else {
      iconEl.innerText = '';
      nameEl.innerText = 'Пусто';
    }
  }
}

// CRAFTING SYSTEM
window.craftItem = function(craftId) {
  if (craftId === 'barricade') {
    addLog('Скрафчено: Деревянная баррикада');
    player.inventory.push({ id: 'barricade', name: 'Деревянная баррикада', icon: '🪵', weight: 4.0, type: 'tool' });
  } else if (craftId === 'spiked-bat') {
    addLog('Скрафчено: Бита с гвоздями');
    player.inventory.push({ id: 'spiked_bat', name: 'Бита с гвоздями', icon: '🏏', weight: 2.2, type: 'weapon', damage: 38, range: 45 });
  } else if (craftId === 'clean-bandage') {
    addLog('Скрафчено: Стерильный бинт');
    player.inventory.push({ id: 'clean_bandage', name: 'Стерильный бинт', icon: '🩹', weight: 0.1, type: 'medical', heal: 35 });
  } else if (craftId === 'campfire') {
    addLog('Скрафчено: Кострище');
    player.inventory.push({ id: 'campfire_kit', name: 'Кострище (набор)', icon: '🔥', weight: 3.5, type: 'tool' });
  }
  refreshInventoryUI();
  updateHotbarUI();
};

// WINDOW VISIBILITY TOGGLES
function toggleWindow(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'flex' : 'none';
  }
}

document.getElementById('btn-inv').onclick = () => toggleWindow('inventory-window');
document.getElementById('btn-health').onclick = () => toggleWindow('health-window');
document.getElementById('btn-craft').onclick = () => toggleWindow('crafting-window');
document.getElementById('close-inv').onclick = () => toggleWindow('inventory-window');
document.getElementById('close-health').onclick = () => toggleWindow('health-window');
document.getElementById('close-craft').onclick = () => toggleWindow('crafting-window');

document.getElementById('btn-use-item').onclick = () => {
  useItem(player.inventory[selectedPlayerItemIndex], selectedPlayerItemIndex);
};
document.getElementById('btn-drop-item').onclick = () => {
  dropItem(selectedPlayerItemIndex);
};
document.getElementById('btn-loot-all').onclick = () => {
  takeAllContainer();
};
document.getElementById('btn-heal-self').onclick = () => {
  player.health = Math.min(100, player.health + 20);
  addLog('Вы наложили чистую повязку');
};
document.getElementById('btn-flashlight').onclick = () => {
  player.flashlight = !player.flashlight;
  addLog(player.flashlight ? 'Фонарик включен' : 'Фонарик выключен');
};
document.getElementById('btn-zombies').onclick = () => {
  // Spawn 3 more zombies nearby
  for (let i = 0; i < 3; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 80;
    zombies.push(new Zombie(player.x + Math.cos(angle) * r, player.y + Math.sin(angle) * r));
  }
  addLog('3 нейтральных зомби появились неподалеку');
};

// MOODLES SYSTEM (Project Zomboid's iconic moodles)
const moodlesContainer = document.getElementById('moodles-container');

function updateMoodles() {
  moodlesContainer.innerHTML = '';

  // Endurance / Stamina moodle
  if (player.stamina < 30) {
    addMoodle('😫', 'Одышка', 'Вымотан бегом или боем', 'moodle-danger');
  } else if (player.stamina < 60) {
    addMoodle('😮‍💨', 'Усталость', 'Теряет выносливость', 'moodle-warning');
  }

  // Hunger moodle
  if (player.hunger < 30) {
    addMoodle('🍖', 'Голодание', 'Нужно поесть срочно', 'moodle-danger');
  } else if (player.hunger < 65) {
    addMoodle('🥪', 'Голод', 'Желудок урчит', 'moodle-warning');
  }

  // Thirst moodle
  if (player.thirst < 30) {
    addMoodle('💧', 'Обезвоживание', 'Сильная жажда', 'moodle-danger');
  } else if (player.thirst < 65) {
    addMoodle('🥤', 'Жажда', 'Хочется пить', 'moodle-warning');
  }

  // Health moodle
  if (player.health < 40) {
    addMoodle('🩸', 'Тяжелые травмы', 'Кровотечение и боль', 'moodle-danger');
  } else if (player.health < 80) {
    addMoodle('🩹', 'Легкие ранения', 'Нужна перевязка', 'moodle-warning');
  }

  // Heavy Load moodle
  let totalW = player.inventory.reduce((acc, i) => acc + (i.weight || 0.5), 0);
  if (totalW > 12) {
    addMoodle('🎒', 'Перегруз', 'Тяжелый рюкзак замедляет ход', 'moodle-warning');
  }
}

function addMoodle(icon, title, desc, cls) {
  const el = document.createElement('div');
  el.className = 'pz-moodle';
  el.innerHTML = `
    <div class="moodle-icon ${cls}">${icon}</div>
    <div>
      <div style="font-weight:bold; font-size:11px;">${title}</div>
      <div style="font-size:10px; color:#aaa;">${desc}</div>
    </div>
  `;
  moodlesContainer.appendChild(el);
}

// IN-GAME TIME & DAY CYCLE
let gameMinutes = 9 * 60; // starts at 09:00
let gameDays = 1;
let timeMultiplier = 1;

document.querySelectorAll('.pz-speed-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.pz-speed-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    timeMultiplier = parseInt(btn.dataset.speed);
  };
});

function updateTime(dt) {
  if (timeMultiplier === 0) return;
  gameMinutes += (dt * 0.5) * timeMultiplier;
  if (gameMinutes >= 24 * 60) {
    gameMinutes = 0;
    gameDays++;
    document.getElementById('pz-day').innerText = `День ${gameDays}`;
  }

  const hours = Math.floor(gameMinutes / 60);
  const mins = Math.floor(gameMinutes % 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const padMin = mins < 10 ? '0' + mins : mins;
  const padHr = displayHours < 10 ? '0' + displayHours : displayHours;
  document.getElementById('pz-clock').innerText = `${padHr}:${padMin} ${ampm}`;

  // Hunger & thirst degrade slowly
  player.hunger = Math.max(0, player.hunger - 0.003 * timeMultiplier);
  player.thirst = Math.max(0, player.thirst - 0.005 * timeMultiplier);
}

// DRAGGABLE WINDOWS (PZ UI Feel)
function makeDraggable(windowEl) {
  const header = windowEl.querySelector('.pz-window-header');
  if (!header) return;

  let isDragging = false;
  let startX, startY, initialLeft, initialTop;

  header.onmousedown = (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    initialLeft = windowEl.offsetLeft;
    initialTop = windowEl.offsetTop;
    e.preventDefault();
  };

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    windowEl.style.left = `${initialLeft + dx}px`;
    windowEl.style.top = `${initialTop + dy}px`;
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

makeDraggable(document.getElementById('inventory-window'));
makeDraggable(document.getElementById('health-window'));
makeDraggable(document.getElementById('crafting-window'));

// MAIN UPDATE & PHYSICS LOOP
let lastTime = performance.now();

function update(dt) {
  updateTime(dt);

  // Player input & velocity
  let moveX = 0;
  let moveY = 0;

  if (keys['KeyW'] || keys['ArrowUp']) moveY -= 1;
  if (keys['KeyS'] || keys['ArrowDown']) moveY += 1;
  if (keys['KeyA'] || keys['ArrowLeft']) moveX -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) moveX += 1;

  // Normalize
  if (moveX !== 0 && moveY !== 0) {
    moveX *= 0.7071;
    moveY *= 0.7071;
  }

  // Sprinting with Left Shift
  const isSprinting = (keys['ShiftLeft'] || keys['ShiftRight']) && (moveX !== 0 || moveY !== 0) && player.stamina > 5;
  const currentSpeed = isSprinting ? player.sprintSpeed : player.speed;

  if (isSprinting) {
    player.stamina = Math.max(0, player.stamina - 0.25);
  } else {
    player.stamina = Math.min(100, player.stamina + 0.15);
  }

  // Inertia physics: smoothly accelerate and decelerate
  const targetVx = moveX * currentSpeed;
  const targetVy = moveY * currentSpeed;

  player.vx += (targetVx - player.vx) * 0.25;
  player.vy += (targetVy - player.vy) * 0.25;

  // Footstep audio
  if (Math.hypot(player.vx, player.vy) > 0.5) {
    player.footstepTimer += isSprinting ? 2 : 1;
    if (player.footstepTimer > 20) {
      player.footstepTimer = 0;
      audio.playFootstep();
    }
  }

  // Collision resolution for player (allows sliding along walls)
  const nextX = player.x + player.vx;
  const nextY = player.y + player.vy;

  if (!checkCollision(nextX, player.y, player.w, player.h)) {
    player.x = nextX;
  } else {
    player.vx = 0;
  }

  if (!checkCollision(player.x, nextY, player.w, player.h)) {
    player.y = nextY;
  } else {
    player.vy = 0;
  }

  // Bounds
  player.x = Math.max(20, Math.min(WORLD_WIDTH - 20, player.x));
  player.y = Math.max(20, Math.min(WORLD_HEIGHT - 20, player.y));

  // Player orientation: look towards mouse cursor in world coordinates
  const screenPlayerX = player.x - camera.x + width / 2;
  const screenPlayerY = player.y - camera.y + height / 2;
  player.angle = Math.atan2(mouse.y - screenPlayerY, mouse.x - screenPlayerX);

  // Weapon swing animation cooldown
  if (player.swingCooldown > 0) {
    player.swingCooldown--;
    player.swingAngle += 0.2;
    if (player.swingCooldown <= 0) {
      player.isSwinging = false;
    }
  }

  // Update Zombies
  zombies.forEach(z => z.update());

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Camera update
  camera.update(player);

  // Health UI update
  document.getElementById('val-health').innerText = `${Math.round(player.health)}%`;
  document.getElementById('bar-health').style.width = `${player.health}%`;
  document.getElementById('val-stamina').innerText = `${Math.round(player.stamina)}%`;
  document.getElementById('bar-stamina').style.width = `${player.stamina}%`;
  document.getElementById('val-hunger').innerText = `${Math.round(player.hunger)}%`;
  document.getElementById('bar-hunger').style.width = `${player.hunger}%`;
  document.getElementById('val-thirst').innerText = `${Math.round(player.thirst)}%`;
  document.getElementById('bar-thirst').style.width = `${player.thirst}%`;

  updateMoodles();
}

// RENDERING (Pixel Art Aesthetic & PZ Darkness/Vision Cone)
function render() {
  ctx.save();
  ctx.clearRect(0, 0, width, height);

  const offsetX = camera.x - width / 2;
  const offsetY = camera.y - height / 2;

  // 1. Draw Ground (Pixel tiles, grass, pavement, asphalt road)
  drawTerrain(offsetX, offsetY);

  // 2. Draw Blood splatters
  for (const b of bloodSplatters) {
    if (b.x > offsetX - 20 && b.x < offsetX + width + 20 && b.y > offsetY - 20 && b.y < offsetY + height + 20) {
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x - offsetX, b.y - offsetY, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 3. Draw Buildings (Floors, walls)
  drawBuildings(offsetX, offsetY);

  // 4. Draw Interactive Objects (Doors, Crates, Trees)
  interactiveObjects.forEach(obj => obj.draw(ctx, offsetX, offsetY));

  // 5. Draw Zombies
  zombies.forEach(z => z.draw(ctx, offsetX, offsetY));

  // 6. Draw Player
  drawPlayer(offsetX, offsetY);

  // 7. Draw Particles / Hit Sparks
  particles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - offsetX, p.y - offsetY, p.size, p.size);
  });

  // 8. Darkness & Line of Sight / Flashlight Cone (PZ hallmark visual!)
  drawLightingAndFog(offsetX, offsetY);

  // 9. Crosshair for PZ aiming
  drawAimingReticle();

  ctx.restore();
}

// TERRAIN DRAWING
function drawTerrain(offsetX, offsetY) {
  // Base dark asphalt and grass tiles
  const startCol = Math.floor(offsetX / TILE_SIZE);
  const endCol = startCol + Math.ceil(width / TILE_SIZE) + 1;
  const startRow = Math.floor(offsetY / TILE_SIZE);
  const endRow = startRow + Math.ceil(height / TILE_SIZE) + 1;

  for (let c = startCol; c <= endCol; c++) {
    for (let r = startRow; r <= endRow; r++) {
      const worldTileX = c * TILE_SIZE;
      const worldTileY = r * TILE_SIZE;

      // Road running through the town
      if (worldTileY >= 680 && worldTileY <= 760) {
        // Asphalt Road
        ctx.fillStyle = '#1e2328';
        ctx.fillRect(worldTileX - offsetX, worldTileY - offsetY, TILE_SIZE, TILE_SIZE);

        // Yellow road divider markings
        if (worldTileY >= 716 && worldTileY <= 724 && (c % 4 < 2)) {
          ctx.fillStyle = '#d97706';
          ctx.fillRect(worldTileX - offsetX, worldTileY - offsetY, TILE_SIZE, 4);
        }
      } else if (worldTileY >= 660 && worldTileY < 680 || worldTileY > 760 && worldTileY <= 780) {
        // Pavement / Sidewalk
        ctx.fillStyle = '#374151';
        ctx.fillRect(worldTileX - offsetX, worldTileY - offsetY, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = '#2b323c';
        ctx.strokeRect(worldTileX - offsetX, worldTileY - offsetY, TILE_SIZE, TILE_SIZE);
      } else {
        // Dark Knox County Grass
        const grassSeed = (c * 17 + r * 31) % 4;
        ctx.fillStyle = grassSeed === 0 ? '#1b2a1e' : grassSeed === 1 ? '#18241b' : '#1e2f21';
        ctx.fillRect(worldTileX - offsetX, worldTileY - offsetY, TILE_SIZE, TILE_SIZE);

        // Pixel grass detail
        if (grassSeed === 2) {
          ctx.fillStyle = '#2d4732';
          ctx.fillRect(worldTileX - offsetX + 8, worldTileY - offsetY + 12, 3, 4);
        }
      }
    }
  }
}

// BUILDINGS RENDERING
function drawBuildings(offsetX, offsetY) {
  buildings.forEach(b => {
    const rx = b.x - offsetX;
    const ry = b.y - offsetY;

    // Floor (Wood parquet or tile)
    ctx.fillStyle = b.roofColor;
    ctx.fillRect(rx, ry, b.w, b.h);

    // Floor grid texture
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    for (let fx = rx; fx < rx + b.w; fx += 24) {
      ctx.beginPath();
      ctx.moveTo(fx, ry);
      ctx.lineTo(fx, ry + b.h);
      ctx.stroke();
    }
    for (let fy = ry; fy < ry + b.h; fy += 24) {
      ctx.beginPath();
      ctx.moveTo(rx, fy);
      ctx.lineTo(rx + b.w, fy);
      ctx.stroke();
    }

    // Interior rug in safehouse
    if (b.name.includes('База')) {
      ctx.fillStyle = '#5c1d1d';
      ctx.fillRect(rx + 60, ry + 60, 100, 80);
      ctx.strokeStyle = '#852b2b';
      ctx.strokeRect(rx + 60, ry + 60, 100, 80);
    }

    // Name sign at building top
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px monospace';
    ctx.fillText(b.name, rx + 10, ry + 16);
  });

  // Draw walls with 3D brick depth
  ctx.fillStyle = '#374151';
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;

  walls.forEach(w => {
    ctx.fillRect(w.x - offsetX, w.y - offsetY, w.w, w.h);
    ctx.strokeRect(w.x - offsetX, w.y - offsetY, w.w, w.h);
  });
}

// PLAYER RENDERING
function drawPlayer(offsetX, offsetY) {
  const rx = player.x - offsetX;
  const ry = player.y - offsetY;

  ctx.save();
  ctx.translate(rx, ry);
  ctx.rotate(player.angle);

  // Player Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 15, 11, 0, 0, Math.PI * 2);
  ctx.fill();

  // Survivor Backpack on back
  ctx.fillStyle = '#2d3748';
  ctx.fillRect(-14, -7, 6, 14);

  // Body / Jacket
  ctx.fillStyle = '#2563eb'; // Blue military jacket
  ctx.fillRect(-8, -8, 16, 16);

  // Shoulders & Hands
  ctx.fillStyle = '#d97706'; // Skin tone hands
  ctx.fillRect(4, -9, 6, 5);
  ctx.fillRect(4, 4, 6, 5);

  // Head with hair/hat
  ctx.fillStyle = '#e2b17a'; // Skin
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();

  // Survivor baseball cap (PZ style)
  ctx.fillStyle = '#dc2626';
  ctx.beginPath();
  ctx.arc(-1, 0, 7.5, Math.PI * 0.4, Math.PI * 1.6);
  ctx.fill();
  // Visor of cap
  ctx.fillStyle = '#991b1b';
  ctx.fillRect(2, -5, 6, 10);

  // Held Weapon (Axe / Bat / Pan)
  ctx.save();
  ctx.translate(10, 6);
  if (player.isSwinging) {
    ctx.rotate(player.swingAngle);
  }

  if (player.equippedWeapon.name.includes('топор')) {
    // Axe handle
    ctx.fillStyle = '#92400e';
    ctx.fillRect(0, -2, 22, 4);
    // Axe blade
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(16, -7, 6, 14);
  } else if (player.equippedWeapon.name.includes('бита')) {
    // Baseball bat
    ctx.fillStyle = '#d97706';
    ctx.fillRect(0, -3, 24, 6);
    // Spikes if spiked
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(18, -5, 4, 10);
  } else {
    // Skillet / Other
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, -2, 14, 4);
    ctx.beginPath();
    ctx.arc(18, 0, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.restore();
}

// LIGHTING, DAY/NIGHT CYCLE, VISION CONE & FLASHLIGHT
function drawLightingAndFog(offsetX, offsetY) {
  // Calculate darkness based on time of day (21:00 to 05:00 is darkest)
  const hour = gameMinutes / 60;
  let darkness = 0.35; // base PZ apocalyptic overcast gloom
  if (hour >= 21 || hour < 5) {
    darkness = 0.88; // Deep night
  } else if (hour >= 18 && hour < 21) {
    darkness = 0.35 + (0.88 - 0.35) * ((hour - 18) / 3); // Dusk
  } else if (hour >= 5 && hour < 8) {
    darkness = 0.88 - (0.88 - 0.35) * ((hour - 5) / 3); // Dawn
  }

  // Create darkness overlay with vision cutout
  const screenPlayerX = player.x - offsetX;
  const screenPlayerY = player.y - offsetY;

  // Offscreen canvas or composite operation
  ctx.save();
  ctx.fillStyle = `rgba(5, 7, 10, ${darkness})`;
  ctx.fillRect(0, 0, width, height);

  // Cut out player ambient sight circle
  ctx.globalCompositeOperation = 'destination-out';

  // Ambient circle around player
  const ambientRadius = 110;
  const ambGrad = ctx.createRadialGradient(screenPlayerX, screenPlayerY, 20, screenPlayerX, screenPlayerY, ambientRadius);
  ambGrad.addColorStop(0, 'rgba(0,0,0,1)');
  ambGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = ambGrad;
  ctx.beginPath();
  ctx.arc(screenPlayerX, screenPlayerY, ambientRadius, 0, Math.PI * 2);
  ctx.fill();

  // Flashlight / Direct field of view cone (Iconic PZ cone of vision!)
  const coneLength = player.flashlight ? 380 : 220;
  const coneAngle = player.flashlight ? Math.PI / 3.2 : Math.PI / 2.8;

  ctx.beginPath();
  ctx.moveTo(screenPlayerX, screenPlayerY);
  ctx.arc(screenPlayerX, screenPlayerY, coneLength, player.angle - coneAngle / 2, player.angle + coneAngle / 2);
  ctx.closePath();

  const coneGrad = ctx.createRadialGradient(screenPlayerX, screenPlayerY, 30, screenPlayerX, screenPlayerY, coneLength);
  coneGrad.addColorStop(0, 'rgba(0,0,0,1)');
  coneGrad.addColorStop(0.8, 'rgba(0,0,0,0.85)');
  coneGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = coneGrad;
  ctx.fill();

  ctx.restore();

  // If flashlight is ON, render subtle warm beam tint on top
  if (player.flashlight) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(screenPlayerX, screenPlayerY);
    ctx.arc(screenPlayerX, screenPlayerY, coneLength, player.angle - coneAngle / 2, player.angle + coneAngle / 2);
    ctx.closePath();
    const beamGrad = ctx.createRadialGradient(screenPlayerX, screenPlayerY, 40, screenPlayerX, screenPlayerY, coneLength);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.15)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0.0)');
    ctx.fillStyle = beamGrad;
    ctx.fill();
    ctx.restore();
  }
}

// PZ AIMING RETICLE
function drawAimingReticle() {
  ctx.save();
  ctx.strokeStyle = '#ef4444';
  ctx.lineWidth = 1.5;

  const size = 8;
  ctx.beginPath();
  // Reticle circle
  ctx.arc(mouse.x, mouse.y, 7, 0, Math.PI * 2);
  // Crosshairs
  ctx.moveTo(mouse.x - size, mouse.y);
  ctx.lineTo(mouse.x + size, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - size);
  ctx.lineTo(mouse.x, mouse.y + size);
  ctx.stroke();

  ctx.restore();
}

// MAIN LOOP
function gameLoop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// INITIAL STARTUP
refreshInventoryUI();
updateHotbarUI();
addLog('Добро пожаловать в Project Zomboid 2D Simulator!');
addLog('Зомби в окрестностях пока нейтральны и бродят по городу.');
addLog('Нажмите E для взаимодействия со шкафами и дверьми, 1-5 для смены оружия.');

requestAnimationFrame(gameLoop);
