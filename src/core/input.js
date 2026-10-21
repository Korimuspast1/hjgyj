// Keyboard / mouse input with edge detection
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.down = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.mouse = { x: 0, y: 0, wx: 0, wy: 0, down: false, rdown: false, clicked: false, rclicked: false, wheel: 0 };
    this.blocked = false; // true when a modal UI has focus

    const kd = (e) => {
      if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      const c = e.code;
      if (!this.down.has(c)) this.pressed.add(c);
      this.down.add(c);
      if (['Tab', 'Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE', 'KeyR', 'KeyC', 'KeyM', 'KeyF'].includes(c)) e.preventDefault();
    };
    const ku = (e) => { this.down.delete(e.code); this.released.add(e.code); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.down = false; this.mouse.rdown = false; });

    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouse.down = true; this.mouse.clicked = true; }
      if (e.button === 2) { this.mouse.rdown = true; this.mouse.rclicked = true; }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.down = false;
      if (e.button === 2) this.mouse.rdown = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { this.mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  isDown(code) { return !this.blocked && this.down.has(code); }
  wasPressed(code) { return this.pressed.has(code); }
  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.mouse.clicked = false;
    this.mouse.rclicked = false;
    this.mouse.wheel = 0;
  }
}
