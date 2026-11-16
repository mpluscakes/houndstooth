// The Moth Queen: a giant boss with a health bar and a cycle of attacks.
import { view, drawGlow } from './gfx.js';
import { Moth } from './enemies.js';
import { audio } from './audio.js';
import { fx } from './fx.js';

const COLORS = ['#b455ff', '#ff5fa2', '#ffe95a', '#ffffff'];

export class Queen {
  constructor(game, tier) {
    this.game = game;
    this.tier = tier;                       // 1 for the first Queen, 2 for the next...
    this.maxHp = this.hp = 60 + tier * 45;
    this.x = view.W / 2; this.y = -40;
    this.hw = 26; this.hh = 15;             // hit box half-size
    this.state = 'enter';
    this.t = 0; this.sway = 0;
    this.cd = 1.2; this.attackIdx = 0;
    this.rain = 0; this.rainT = 0; this.fan2 = 0;
    this.flash = 0;
    this.droppedMid = false;
    this.dead = false;
  }

  get homeY() { return view.safeTop + 66; }
  get enraged() { return this.hp < this.maxHp * 0.4; }
  get vulnerable() { return this.state !== 'enter' && this.state !== 'dying'; }

  update(dt) {
    const g = this.game, W = view.W;
    this.t += dt; this.flash -= dt;

    switch (this.state) {
      case 'enter':
        this.y += 45 * dt;
        if (this.y >= this.homeY) { this.state = 'fight'; audio.sfx.queenCry(); fx.addShake(4); }
        break;

      case 'fight':
        this.sway += dt * (this.enraged ? 1.15 : 0.8);
        this.x = W / 2 + Math.sin(this.sway) * (W / 2 - 34);
        this.y = this.homeY + Math.sin(this.t * 1.9) * 5;
        if (this.fan2 > 0 && (this.fan2 -= dt) <= 0) this.fan();
        if (this.rain > 0) {
          this.rain -= dt; this.rainT -= dt;
          if (this.rainT <= 0) {
            this.rainT = 0.12;
            g.enemyShot(this.x + Math.sin(this.t * 7) * 22, this.y + 16, Math.PI / 2 + Math.sin(this.t * 3) * 0.55, 72 + this.tier * 4);
          }
        } else if ((this.cd -= dt) <= 0 && g.player.alive) this.attack();
        break;

      case 'telegraph': // shudder before a swoop
        this.tt -= dt;
        if (this.tt <= 0) { this.state = 'swoop'; this.sw = 0; this.swY = g.player.y - 4; audio.sfx.dive(); }
        break;

      case 'swoop': {
        this.sw += dt;
        const home = this.homeY;
        if (this.sw < 0.5) { const k = this.sw / 0.5; this.y = home + (this.swY - home) * k * k; }
        else if (this.sw < 0.7) this.y = this.swY;
        else if (this.sw < 1.7) { const k = this.sw - 0.7; this.y = this.swY + (home - this.swY) * (1 - (1 - k) * (1 - k)); }
        else { this.state = 'fight'; this.cd = 1; }
        break;
      }

      case 'dying':
        this.dieT -= dt;
        this.y += 5 * dt;
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
        this.game.enemies.push(new Moth(this.game, {
          type: 3, kamikaze: true,
          x: this.x + (i - (n - 1) / 2) * 14, y: this.y + 10,
        }));
      }
    } else {
      this.state = 'telegraph'; this.tt = 0.75;
      audio.sfx.queenCry();
    }
  }

  fan() {
    const p = this.game.player;
    const n = 3 + Math.min(this.tier, 2) * 2;
    const base = Math.atan2(p.y - this.y, p.x - this.x);
    for (let i = 0; i < n; i++) {
      this.game.enemyShot(this.x, this.y + 14, base + (i - (n - 1) / 2) * 0.27, 78 + this.tier * 5);
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
      this.game.dropPickup(this.x, this.y + 10);
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
