// Juice: particles, glow blasts, score popups, screen shake, flashes, hit-stop.
import { drawGlow, drawText } from './gfx.js';

const MAX_PARTS = 700;
const rnd = (a, b) => a + Math.random() * (b - a);

export const fx = {
  parts: [], blasts: [], popups: [],
  shake: 0, flash: 0, flashColor: '#fff', hitstop: 0,

  reset() {
    this.parts.length = this.blasts.length = this.popups.length = 0;
    this.shake = this.flash = this.hitstop = 0;
  },

  spark(x, y, vx, vy, life, color, size = 1, grav = 0) {
    if (this.parts.length >= MAX_PARTS) this.parts.shift();
    this.parts.push({ x, y, vx, vy, life, max: life, color, size, grav });
  },

  // Radial burst of pixels.
  burst(x, y, colors, n = 12, speed = 60, { life = 0.5, grav = 40, size = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * rnd(0.25, 1);
      this.spark(x, y, Math.cos(a) * s, Math.sin(a) * s, life * rnd(0.5, 1.2),
        colors[(Math.random() * colors.length) | 0], size || (Math.random() < 0.3 ? 2 : 1), grav);
    }
  },

  // Expanding flash of glow.
  blast(x, y, color, r = 18, life = 0.28) {
    this.blasts.push({ x, y, color, r, life, max: life });
  },

  popup(x, y, text, color = '#fff') {
    this.popups.push({ x, y, text, color, life: 0.9 });
  },

  addShake(a) { this.shake = Math.min(9, Math.max(this.shake, a)); },
  screenFlash(a, color = '#fff') { this.flash = Math.max(this.flash, a); this.flashColor = color; },

  update(dt) {
    for (const p of this.parts) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.5 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const b of this.blasts) b.life -= dt;
    this.blasts = this.blasts.filter(b => b.life > 0);
    for (const p of this.popups) { p.life -= dt; p.y -= 14 * dt; }
    this.popups = this.popups.filter(p => p.life > 0);
    this.shake = Math.max(0, this.shake - dt * 16);
    this.flash = Math.max(0, this.flash - dt * 2.5);
  },

  shakeOffset() {
    if (this.shake <= 0.2) return [0, 0];
    return [Math.round(rnd(-1, 1) * this.shake), Math.round(rnd(-1, 1) * this.shake)];
  },

  draw(ctx) {
    for (const b of this.blasts) {
      const k = b.life / b.max;
      drawGlow(ctx, b.x, b.y, b.r * (1.6 - k * 0.8), b.color, k);
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      // Flicker out instead of fading, to keep pixels crisp.
      if (p.life < p.max * 0.3 && Math.random() < 0.5) continue;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.restore();
    for (const p of this.popups) {
      if (p.life < 0.25 && ((p.life * 30) | 0) % 2) continue;
      drawText(ctx, p.text, p.x, p.y, { color: p.color, align: 'center', shadow: '#000' });
    }
  },
};
