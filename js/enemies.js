// Moths: fly in along a curve, sit in the grid, and dive at the player.
import { MOTH_TYPES } from './config.js';
import { view, drawGlow } from './gfx.js';
import { PAL } from './sprites.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

export class Moth {
  // o: { type, col, row, delay, enter: {p0, c1, c2, dur}, glow }
  //    or { type, x, y, kamikaze: true } for the Queen's brood.
  constructor(game, o) {
    this.game = game;
    this.type = o.type;
    this.def = MOTH_TYPES[o.type];
    this.hp = this.def.hp;
    this.col = o.col; this.row = o.row;
    this.glow = !!o.glow;
    this.kamikaze = !!o.kamikaze;
    this.delay = o.delay || 0;
    this.enter = o.enter;
    this.state = 'wait';
    this.t = 0;
    this.x = o.x ?? -50; this.y = o.y ?? -50;
    this.flash = 0;
    this.phase = Math.random() * 10;
    this.dead = false;
    if (this.kamikaze) this.startDive();
  }

  get active() { return this.state !== 'wait'; }
  get pal() { return this.glow ? PAL.glow : PAL[this.type]; }
  slot() { return this.game.gridPos(this.col, this.row); }

  startDive() {
    const g = this.game, p = g.player, { W, H } = view;
    const side = this.x < W / 2 ? -1 : 1; // peel away outwards first
    const tx = clamp(p.x, 12, W - 12);
    this.d = [
      { x: this.x, y: this.y },
      { x: this.x + side * 45, y: this.y - 32 },
      { x: clamp(tx + side * 70, -10, W + 10), y: p.y - 100 },
      { x: clamp(tx + (Math.random() - 0.5) * 36, 8, W - 8), y: H + 26 },
    ];
    this.diveDur = 2.5 / (g.diff.speed * this.def.diveSpeed);
    this.shots = this.def.shooter || Math.random() < g.diff.shootChance ? (this.def.shooter ? 2 : 1) : 0;
    this.state = 'dive';
    this.t = 0;
    audio.sfx.dive();
  }

  update(dt) {
    const g = this.game;
    this.flash -= dt;
    switch (this.state) {
      case 'wait':
        this.delay -= dt;
        if (this.delay <= 0) { this.state = 'enter'; this.t = 0; }
        return;
      case 'enter': {
        this.t += dt / this.enter.dur;
        const k = Math.min(1, this.t);
        const p = bez(this.enter.p0, this.enter.c1, this.enter.c2, this.slot(), k);
        this.x = p.x; this.y = p.y;
        if (this.t >= 1) this.state = 'grid';
        break;
      }
      case 'grid': {
        const s = this.slot();
        this.x = s.x; this.y = s.y;
        break;
      }
      case 'dive': {
        const before = this.t;
        this.t += dt / this.diveDur;
        const p = bez(this.d[0], this.d[1], this.d[2], this.d[3], Math.min(1, this.t));
        this.x = p.x; this.y = p.y;
        for (const mark of [0.32, 0.5]) {
          if (this.shots > 0 && before < mark && this.t >= mark && this.y < g.player.y - 50 && g.player.alive) {
            this.shots--;
            const a = Math.atan2(g.player.y - this.y, g.player.x - this.x) + (Math.random() - 0.5) * 0.25;
            g.enemyShot(this.x, this.y + 4, a, g.diff.bulletSpeed);
          }
        }
        if (this.t >= 1) {
          if (this.kamikaze) this.dead = true;
          else { this.state = 'return'; this.t = 0; }
        }
        break;
      }
      case 'return': {
        this.t += dt / 1.1;
        const s = this.slot(), k = Math.min(1, this.t), e = 1 - (1 - k) * (1 - k);
        this.x = s.x; this.y = -20 + (s.y + 20) * e;
        if (this.t >= 1) this.state = 'grid';
        break;
      }
    }

    if (this.glow && Math.random() < dt * 14) {
      fx.spark(this.x + (Math.random() - 0.5) * 14, this.y + (Math.random() - 0.5) * 10,
        0, 12, 0.5, Math.random() < 0.5 ? '#ffe95a' : '#ffffff', 1, 0);
    }
  }

  // Returns true if this hit killed it.
  hit() {
    this.hp--;
    this.flash = 0.08;
    return this.hp <= 0;
  }

  draw(ctx, sprites, time) {
    if (!this.active) return;
    const fast = this.state === 'dive' || this.state === 'enter';
    const frame = ((time * (fast ? 12 : 5) + this.phase) | 0) % 2;
    const img = this.flash > 0 ? sprites.mothFlash[frame] : sprites.moth[this.glow ? 'glow' : this.type][frame];
    if (this.glow) drawGlow(ctx, this.x, this.y, 15 + Math.sin(time * 8) * 4, '#ffe95a', 0.9);
    ctx.drawImage(img, Math.round(this.x) - 7, Math.round(this.y) - 6);
  }
}
