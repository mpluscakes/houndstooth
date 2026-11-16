// The Moth Queen: a giant boss with a health bar and a cycle of attacks.
// She lives in axis coordinates (u along the firing axis, v across it).
import { drawGlow } from './gfx.js';
import { F } from './field.js';
import { Moth } from './enemies.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

const COLORS = ['#b455ff', '#ff5fa2', '#ffe95a', '#ffffff'];

export class Queen {
  constructor(game, tier) {
    this.game = game;
    this.tier = tier;                       // 1 for the first Queen, 2 for the next...
    this.maxHp = this.hp = 120 + tier * 90;
    this.u = F.uFar + 50; this.v = this.lanes().mid;
    this.place();
    this.hw = 26; this.hh = 15;             // hit box half-size
    this.state = 'enter';
    this.t = 0; this.sway = 0;
    this.cd = 1.2; this.attackIdx = 0;
    this.rain = 0; this.rainT = 0; this.fan2 = 0;
    this.flash = 0;
    this.droppedMid = false;
    this.dead = false;
  }

  get homeU() { return F.uFar - 85; }
  place() { this.x = F.x(this.u, this.v); this.y = F.y(this.u, this.v); }

  // The lanes she can sway across while staying on screen and in reach.
  lanes() {
    const u = this.homeU;
    const hi = (F.W - 26 - u * F.dx) / F.nx;
    const lo = Math.max(F.reachL + 6, (28 - u * F.dx) / F.nx, (F.top + 32 - F.bottom - u * F.dy) / F.ny);
    return { mid: (lo + hi) / 2, amp: Math.max(0, (hi - lo) / 2) };
  }
  get enraged() { return this.hp < this.maxHp * 0.4; }
  get vulnerable() { return this.state !== 'enter' && this.state !== 'dying'; }

  update(dt) {
    const g = this.game;
    this.t += dt; this.flash -= dt;

    switch (this.state) {
      case 'enter':
        this.u -= 55 * dt;
        if (this.u <= this.homeU) { this.state = 'fight'; audio.sfx.queenCry(); fx.addShake(4); }
        break;

      case 'fight':
        this.sway += dt * (this.enraged ? 1.15 : 0.8);
        const l = this.lanes();
        this.v = l.mid + Math.sin(this.sway) * l.amp;
        this.u = this.homeU + Math.sin(this.t * 1.9) * 5;
        if (this.fan2 > 0 && (this.fan2 -= dt) <= 0) this.fan();
        if (this.rain > 0) {
          this.rain -= dt; this.rainT -= dt;
          if (this.rainT <= 0) {
            this.rainT = 0.15;
            const o = F.pt(this.u - 16, this.v + Math.sin(this.t * 7) * 22);
            g.enemyShot(o.x, o.y, F.backAngle + Math.sin(this.t * 3) * 0.55, 72 + this.tier * 4);
          }
        } else if ((this.cd -= dt) <= 0 && g.player.alive) this.attack();
        break;

      case 'telegraph': // shudder before a swoop
        this.tt -= dt;
        if (this.tt <= 0) { this.state = 'swoop'; this.sw = 0; this.swU = Math.max(18, F.u(g.player.x, g.player.y) + 4); audio.sfx.dive(); }
        break;

      case 'swoop': {
        this.sw += dt;
        // Charge down her lane to the player's depth, then climb back.
        const home = this.homeU;
        if (this.sw < 0.5) { const k = this.sw / 0.5; this.u = home + (this.swU - home) * k * k; }
        else if (this.sw < 0.7) this.u = this.swU;
        else if (this.sw < 1.7) { const k = this.sw - 0.7; this.u = this.swU + (home - this.swU) * (1 - (1 - k) * (1 - k)); }
        else { this.state = 'fight'; this.cd = 1; }
        break;
      }

      case 'dying':
        this.dieT -= dt;
        this.u -= 5 * dt;
        this.place();
        if (Math.random() < dt * 14) {
          const ex = this.x + (Math.random() - 0.5) * 56, ey = this.y + (Math.random() - 0.5) * 36;
          fx.burst(ex, ey, COLORS, 10, 80);
          fx.blast(ex, ey, COLORS[(Math.random() * 3) | 0], 16);
          fx.addShake(3);
          audio.sfx.boom();
        }
        if (this.dieT <= 0) {
          this.dead = true;
          fx.burst(this.x, this.y, COLORS, 90, 190, { life: 1.2 });
          fx.blast(this.x, this.y, '#ffffff', 70, 0.7);
          fx.blast(this.x, this.y, '#b455ff', 100, 1);
          fx.addShake(9); fx.screenFlash(0.9);
          audio.sfx.bigBoom();
          g.onQueenDead(this);
        }
        break;
    }
    this.place();
  }

  attack() {
    const list = this.hp < this.maxHp * 0.65 ? ['fan', 'brood', 'rain', 'swoop'] : ['fan', 'rain', 'brood'];
    const kind = list[this.attackIdx++ % list.length];
    this.cd = this.enraged ? 1.2 : 2;
    if (kind === 'fan') {
      this.fan();
      if (this.enraged) this.fan2 = 0.4;
    } else if (kind === 'rain') {
      this.rain = this.enraged ? 2.2 : 1.5;
    } else if (kind === 'brood') {
      const n = Math.min(5, 2 + this.tier);
      for (let i = 0; i < n; i++) {
        const o = F.pt(this.u - 10, this.v + (i - (n - 1) / 2) * 14);
        this.game.enemies.push(new Moth(this.game, { type: 3, kamikaze: true, x: o.x, y: o.y }));
      }
    } else {
      this.state = 'telegraph'; this.tt = 0.75;
      audio.sfx.queenCry();
    }
  }

  fan() {
    const p = this.game.player;
    const n = 3 + Math.min(this.tier, 2) * 2;
    const o = F.pt(this.u - 14, this.v);
    const base = Math.atan2(p.y - o.y, p.x - o.x);
    for (let i = 0; i < n; i++) {
      this.game.enemyShot(o.x, o.y, base + (i - (n - 1) / 2) * 0.27, 78 + this.tier * 5);
    }
    audio.sfx.hit();
  }

  hit() {
    if (!this.vulnerable) return;
    this.hp--;
    this.flash = 0.06;
    if (!this.droppedMid && this.hp <= this.maxHp / 2) {
      // Halfway there: she sheds a tooth for the player.
      this.droppedMid = true;
      this.game.dropPickup(F.x(this.u - 10, this.v), F.y(this.u - 10, this.v));
      audio.sfx.queenCry();
    }
    if (this.hp <= 0) {
      this.state = 'dying'; this.dieT = 2.2;
      this.rain = 0; this.fan2 = 0;
      this.game.onQueenDying(this);
    }
  }

  draw(ctx, sprites, time) {
    const s = sprites.queen;
    const flap = ((time * (this.enraged ? 9 : 5)) | 0) % 2;
    const w = s.width - (flap ? 6 : 0);
    let x = Math.round(this.x), y = Math.round(this.y);
    if (this.state === 'telegraph') { x += Math.round((Math.random() - 0.5) * 4); y += Math.round((Math.random() - 0.5) * 2); }
    drawGlow(ctx, x, y, 44 + Math.sin(time * 4) * 5, this.enraged ? '#ff3060' : '#b455ff', 0.55);
    let img = s;
    if (this.flash > 0 || (this.state === 'dying' && ((time * 20) | 0) % 2)) img = sprites.queenFlash;
    else if (this.state === 'telegraph' && ((time * 12) | 0) % 2) img = sprites.queenRed;
    ctx.drawImage(img, x - (w >> 1), y - (s.height >> 1), w, s.height);
  }
}
