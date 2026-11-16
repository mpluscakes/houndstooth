// The player's formation of houndstooth ships. The formation IS the health:
// each hit chews one ship away; lose the last one and it's game over.
import { CFG, SLOTS, MUZZLES } from './config.js';
import { F } from './field.js';
import { drawGlow } from './gfx.js';
import { TOOTH, TOOTH_ORIGIN } from './sprites.js';
import { input } from './input.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Player {
  constructor(game) { this.game = game; this.reset(); }

  reset(count = 1) {
    F.layout();
    const start = F.pt(F.front * 0.55, F.reachR * 0.22);
    this.x = start.x; this.y = start.y;
    this.alive = true;
    this.invuln = 0;
    this.fireT = 0.3;
    this.volley = 0;
    this.ships = [];
    for (let i = 0; i < Math.min(count, CFG.MAX_SHIPS); i++) {
      const p = this.slotPos(i);
      this.ships.push({ slot: i, x: p.x, y: p.y, locked: true, flash: 0 });
    }
  }

  get count() { return this.ships.length; }
  get full() { return this.ships.length >= CFG.MAX_SHIPS; }

  slotPos(i) {
    return { x: this.x + SLOTS[i][0] * CFG.TILE, y: this.y + SLOTS[i][1] * CFG.TILE };
  }

  update(dt) {
    const drag = input.takeDrag();
    if (!this.alive) return;
    this.x += drag.x * CFG.DRAG_GAIN + (input.right - input.left) * CFG.KEY_SPEED * dt;
    this.y += drag.y * CFG.DRAG_GAIN + (input.down - input.up) * CFG.KEY_SPEED * dt;
    this.confine();

    this.invuln = Math.max(0, this.invuln - dt);

    for (const s of this.ships) {
      const t = this.slotPos(s.slot);
      s.flash = Math.max(0, s.flash - dt);
      if (s.locked) { s.x = t.x; s.y = t.y; continue; }
      // Fly in and snap into the tiling.
      const k = Math.min(1, dt * 11);
      s.x += (t.x - s.x) * k; s.y += (t.y - s.y) * k;
      if (Math.abs(t.x - s.x) + Math.abs(t.y - s.y) < 1.5) {
        s.locked = true; s.flash = 0.2; s.x = t.x; s.y = t.y;
        audio.sfx.lock();
        fx.blast(s.x, s.y, '#ffffff', 14, 0.2);
        fx.burst(s.x, s.y, ['#ffffff', '#bbbbbb'], 8, 45, { life: 0.3, grav: 0 });
      }
    }

    // Fire only while the screen is touched. Shots alternate between the two
    // prongs of each tooth; the lead fires every volley, wingmen every other.
    this.fireT = Math.max(0, this.fireT - dt);
    if (input.firing && this.fireT <= 0) {
      this.fireT = CFG.FIRE_INTERVAL;
      this.volley++;
      this.ships.forEach((s, i) => {
        if (!s.locked) return;
        if (i !== 0 && (i + this.volley) % 2) return;
        const m = MUZZLES[(this.volley + (i >> 1)) % 2];
        this.game.bullets.push({ x: s.x + m[0], y: s.y + m[1] });
      });
      if (this.volley % 2) audio.sfx.shoot();
    }
  }

  // Keep the whole formation on the playfield, and the leader behind the
  // front line (a diagonal across the field, square to the firing axis).
  confine() {
    let loX = 0, hiX = 0, hiY = 0;
    for (const s of this.ships) {
      const [sx, sy] = SLOTS[s.slot];
      loX = Math.min(loX, sx); hiX = Math.max(hiX, sx); hiY = Math.max(hiY, sy);
    }
    const T = CFG.TILE;
    const x0 = 8 - loX * T, x1 = F.W - 13 - hiX * T, y0 = F.top + 12, y1 = F.bottom - 10 - hiY * T;
    for (let i = 0; i < 4; i++) {
      this.x = clamp(this.x, x0, x1); this.y = clamp(this.y, y0, y1);
      const over = F.u(this.x, this.y) - F.front;
      if (over <= 0) break;
      this.x -= over * F.dx; this.y -= over * F.dy;
    }
    this.x = clamp(this.x, x0, x1); this.y = clamp(this.y, y0, y1);
  }

  // A caught pickup becomes a new ship that flies to the next free slot.
  addShip(fromX, fromY) {
    if (this.full) return false;
    this.ships.push({ slot: this.ships.length, x: fromX, y: fromY, locked: false, flash: 0 });
    return true;
  }

  // Ship `idx` was hit. Returns true if that was the last ship (game over).
  hit(idx) {
    if (!this.alive || this.invuln > 0) return false;
    const s = this.ships[idx];
    this.crumble(s);
    audio.sfx.playerHit();
    fx.addShake(6);
    fx.screenFlash(0.5);
    fx.hitstop = 0.07;

    if (this.ships.length === 1) {
      this.ships.length = 0;
      this.alive = false;
      fx.addShake(9);
      fx.blast(s.x, s.y, '#ffffff', 40, 0.6);
      fx.burst(s.x, s.y, ['#ffffff', '#ff5fa2', '#ffe95a'], 40, 140, { life: 0.9 });
      return true;
    }
    // The outermost ship breaks formation to fill the gap.
    const last = this.ships.pop();
    if (last !== s) { last.slot = s.slot; last.locked = false; this.ships[idx] = last; }
    this.invuln = CFG.INVULN_TIME;
    return false;
  }

  // The tooth gets "chewed": every cell of it flies off as its own pixel.
  crumble(s) {
    fx.blast(s.x, s.y, '#ffffff', 22, 0.3);
    TOOTH.forEach((row, cy) => {
      for (let cx = 0; cx < row.length; cx++) {
        if (row[cx] !== '1') continue;
        const px = s.x - TOOTH_ORIGIN.x + cx * 2, py = s.y - TOOTH_ORIGIN.y + cy * 2;
        const a = Math.atan2(py - s.y, px - s.x) + (Math.random() - 0.5);
        const sp = 30 + Math.random() * 70;
        fx.spark(px, py, Math.cos(a) * sp, Math.sin(a) * sp - 20, 0.5 + Math.random() * 0.6,
          Math.random() < 0.8 ? '#ffffff' : '#888888', 2, 120);
      }
    });
  }

  draw(ctx, sprites, time) {
    if (!this.alive) return;
    const blink = this.invuln > 0 && ((time * 14) | 0) % 2 === 0;
    this.ships.forEach((s, i) => {
      const x = Math.round(s.x) - TOOTH_ORIGIN.x, y = Math.round(s.y) - TOOTH_ORIGIN.y;
      if (s.flash > 0) drawGlow(ctx, s.x, s.y, 16, '#ffffff', s.flash * 4);
      ctx.drawImage(blink ? sprites.toothGrey : sprites.tooth, x, y);
      if (i === 0) {
        // Cockpit light marks the lead ship.
        ctx.fillStyle = ((time * 4) | 0) % 2 ? '#ff3b3b' : '#b01818';
        ctx.fillRect(Math.round(s.x) - 1, Math.round(s.y) - 1, 2, 2);
      }
    });
  }
}
