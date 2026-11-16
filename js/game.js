// Game state machine: title -> playing -> dying -> gameover, plus the level
// director (banner -> waves -> boss -> clear), collisions, HUD and drawing.
import { CFG, difficulty } from './config.js';
import { view, drawText, drawGlow } from './gfx.js';
import { buildSprites, TOOTH_ORIGIN } from './sprites.js';
import { input } from './input.js';
import { F } from './field.js';
import { audio } from './audio.js';
import { fx } from './fx.js';
import { Player } from './player.js';
import { buildWave, isBossLevel } from './waves.js';
import { Queen } from './boss.js';

const HI_KEY = 'houndstooth.hi';
const near = (a, b, w, h) => Math.abs(a.x - b.x) < w && Math.abs(a.y - b.y) < h;

export class Game {
  constructor() {
    this.sprites = buildSprites();
    this.time = 0;
    this.state = 'title';
    this.paused = false;
    this.score = 0;
    this.hi = 0;
    try { this.hi = +localStorage.getItem(HI_KEY) || 0; } catch (e) {}
    this.newHi = false;
    this.level = 1;
    this.diff = difficulty(1);
    F.layout();
    this.setGrid(8, 3);
    this.enemies = []; this.bullets = []; this.ebullets = []; this.pickups = [];
    this.boss = null;
    this.banner = null;
    this.player = new Player(this);
    this.stars = Array.from({ length: 46 }, () => ({
      x: Math.random(), y: Math.random(), sp: 6 + Math.random() * 26,
      c: Math.random() < 0.12 ? '#6f5a8a' : ['#333', '#555', '#888'][(Math.random() * 3) | 0],
    }));

    // Debug helpers: ?level=4 starts on a boss, ?ships=5 starts with a formation.
    const q = new URLSearchParams(location.search);
    this.startLevel = Math.max(1, +q.get('level') || 1);
    this.startShips = Math.max(1, +q.get('ships') || 1);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state === 'playing') this.paused = true;
        this.saveHi();
        audio.suspend();
      } else if (!this.paused) audio.resume();
    });
  }

  // --- Flow -----------------------------------------------------------------

  newGame() {
    fx.reset();
    this.score = 0; this.newHi = false; this.hiAtStart = this.hi;
    this.enemies = []; this.bullets = []; this.ebullets = []; this.pickups = [];
    this.boss = null;
    this.progress = 0;                           // normal waves started so far
    this.wavesSinceGlow = CFG.GLOW_EVERY_WAVES;  // so the very first wave has a glowing moth
    this.player.reset(this.startShips);
    this.state = 'playing';
    audio.sfx.start();
    this.beginLevel(this.startLevel);
    if (this.startLevel > 1) this.progress = (this.startLevel - 1 - Math.floor((this.startLevel - 1) / CFG.BOSS_EVERY)) * CFG.WAVES_PER_LEVEL;
  }

  beginLevel(n) {
    this.level = n;
    this.diff = difficulty(n);
    this.wave = 0;
    this.isBoss = isBossLevel(n);
    this.phase = 'banner';
    if (this.isBoss) {
      this.phaseT = 3.2;
      this.showBanner('WARNING', 'THE MOTH QUEEN APPROACHES', 3.2, '#ff4060');
      audio.stopMusic();
      audio.sfx.warning();
    } else {
      this.phaseT = 1.2;
      this.showBanner('LEVEL ' + n, '', 1.2, '#ffffff');
      audio.playMusic('main');
    }
  }

  nextWave() {
    this.wave++;
    this.wavesSinceGlow++;
    const p = this.player;
    const due = this.wavesSinceGlow >= (p.count === 1 ? CFG.GLOW_MERCY_WAVES : CFG.GLOW_EVERY_WAVES);
    const glow = due && !p.full;
    if (glow) this.wavesSinceGlow = 0;
    buildWave(this, this.progress++, glow);
    this.diveT = 2;
    this.phase = 'wave';
  }

  director(dt) {
    switch (this.phase) {
      case 'banner':
        if ((this.phaseT -= dt) <= 0) {
          if (this.isBoss) {
            this.boss = new Queen(this, this.level / CFG.BOSS_EVERY);
            this.phase = 'boss';
            audio.playMusic('boss');
          } else this.nextWave();
        }
        break;
      case 'wave':
        this.runDives(dt);
        if (!this.enemies.length) {
          this.phase = 'gap'; this.phaseT = 0.6;
          if (this.wave < CFG.WAVES_PER_LEVEL) audio.sfx.waveClear();
        }
        break;
      case 'gap':
        if ((this.phaseT -= dt) <= 0) {
          if (this.wave < CFG.WAVES_PER_LEVEL) this.nextWave();
          else {
            const bonus = 500 * this.level;
            this.addScore(bonus);
            this.showBanner('LEVEL CLEAR', 'BONUS ' + bonus, 2.2, '#8dff5a');
            audio.sfx.levelClear();
            this.phase = 'clear'; this.phaseT = 2.4;
          }
        }
        break;
      case 'clear':
        if ((this.phaseT -= dt) <= 0) this.beginLevel(this.level + 1);
        break;
      // 'boss': the Queen drives things via onQueenDying / onQueenDead.
    }
  }

  // Periodically send a moth from the grid diving at the player.
  runDives(dt) {
    if ((this.diveT -= dt) > 0) return;
    const inGrid = this.enemies.filter(e => e.state === 'grid');
    const diving = this.enemies.filter(e => e.state === 'dive').length;
    const few = this.enemies.length <= 3; // stragglers get aggressive
    if (inGrid.length && diving < (few ? 3 : this.diff.maxDivers)) {
      inGrid[(Math.random() * inGrid.length) | 0].startDive();
    }
    this.diveT = this.diff.diveInterval * (few ? 0.45 : 1) * (0.6 + Math.random() * 0.8);
  }

  onQueenDying() {
    audio.stopMusic();
    for (const b of this.ebullets) fx.spark(b.x, b.y, 0, -10, 0.4, '#ff9a3a');
    this.ebullets = [];
    for (const e of this.enemies) this.killMoth(e, false);
  }

  onQueenDead(q) {
    const bonus = 5000 * q.tier;
    this.addScore(bonus);
    this.boss = null;
    this.dropPickup(q.x, q.y);
    this.showBanner('QUEEN DEFEATED', 'BONUS ' + bonus, 3, '#ffe95a');
    audio.sfx.levelClear();
    this.phase = 'clear'; this.phaseT = 3.6;
  }

  gameOver() {
    this.state = 'dying'; this.deathT = 1.8;
    audio.stopMusic();
    audio.sfx.bigBoom();
    this.saveHi();
  }

  // --- Helpers used by entities ----------------------------------------------

  // The moth grid is tilted with the field: columns are firing lanes, rows
  // run across them. It sits as far up the axis as the screen allows, in the
  // lanes the player can actually reach.
  setGrid(cols, rows) {
    const span = (CFG.GRID_COLS - 1) * CFG.GRID_DV, sway = CFG.GRID_SWAY;
    const vL = F.reachL + sway + 2;
    this.grid = {
      cols, rows,
      vMid: vL + span / 2,
      uFar: Math.min(F.exitU(vL - sway), F.exitU(vL + span + sway)) - 13,
    };
  }

  gridPos(col, row) {
    const g = this.grid;
    return F.pt(
      g.uFar - row * CFG.GRID_DU + Math.sin(this.time * 1.7 + col * 0.6) * 1.5,
      g.vMid + (col - (g.cols - 1) / 2) * CFG.GRID_DV + Math.sin(this.time * 0.9) * CFG.GRID_SWAY,
    );
  }

  enemyShot(x, y, angle, speed) {
    this.ebullets.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
  }

  dropPickup(x, y) {
    // Teeth drift down the axis, easing into a lane the player can reach.
    const lane = F.v(x, y);
    this.pickups.push({ x, y, t: 0, u: F.u(x, y), lane, goal: Math.max(F.reachL + 24, Math.min(F.reachR - 30, lane)) });
    fx.blast(x, y, '#ffe95a', 26, 0.4);
    audio.sfx.drop();
  }

  addScore(n) {
    this.score += n;
    if (this.score > this.hi) { if (this.hiAtStart > 0) this.newHi = true; this.hi = this.score; }
  }

  saveHi() { try { localStorage.setItem(HI_KEY, String(this.hi)); } catch (e) {} }

  showBanner(title, sub, dur, color) { this.banner = { title, sub, t: dur, color }; }

  killMoth(m, scored = true) {
    if (m.dead) return;
    m.dead = true;
    const pal = m.pal;
    fx.burst(m.x, m.y, [pal.w, pal.x, '#ffffff'], 14, 75);
    fx.blast(m.x, m.y, pal.w, 18);
    fx.addShake(2);
    audio.sfx.boom();
    if (scored) {
      const pts = m.def.score * (m.state === 'dive' ? 2 : 1);
      this.addScore(pts);
      fx.popup(m.x, m.y - 4, pts, pal.x);
    }
    if (m.glow) this.dropPickup(m.x, m.y);
  }

  // --- Update -----------------------------------------------------------------

  handleInput() {
    for (const k of input.keys.splice(0)) {
      if (k === 'mute') audio.toggleMute();
      if (k === 'pause' && this.state === 'playing') this.setPaused(!this.paused);
    }
    for (const tap of input.taps.splice(0)) {
      if (tap.x > view.W - 26 && tap.y >= 0 && tap.y < view.safeTop + 26) { audio.toggleMute(); continue; }
      if (this.paused) { this.setPaused(false); continue; }
      if (this.state === 'title') this.newGame();
      else if (this.state === 'gameover' && this.overT > 0.9) this.newGame();
    }
  }

  setPaused(p) {
    this.paused = p;
    if (p) audio.suspend(); else audio.resume();
    input.takeDrag();
  }

  update(dt) {
    F.layout();
    this.setGrid(this.grid.cols, this.grid.rows);
    this.handleInput();
    if (this.paused) return;
    this.time += dt;
    for (const s of this.stars) {
      // Stars streak down the axis, so the whole field reads as tilted.
      s.x -= (F.dx * s.sp * dt) / view.W; s.y -= (F.dy * s.sp * dt) / view.H;
      if (s.x < 0) { s.x += 1; s.y = Math.random(); }
      if (s.y > 1) { s.y -= 1; s.x = Math.random(); }
    }
    if (fx.hitstop > 0) { fx.hitstop -= dt; return; }
    fx.update(dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.state === 'title') { input.takeDrag(); return; }

    this.updateWorld(dt);
    if (this.state === 'dying' && (this.deathT -= dt) <= 0) {
      this.state = 'gameover'; this.overT = 0;
      audio.sfx.gameOver();
    }
    if (this.state === 'gameover') this.overT += dt;
  }

  updateWorld(dt) {
    const p = this.player;
    p.update(dt);
    if (this.state === 'playing') this.director(dt);

    const bs = CFG.BULLET_SPEED * dt;
    for (const b of this.bullets) { b.x += F.dx * bs; b.y += F.dy * bs; if (F.outside(b.x, b.y, 6)) b.dead = true; }
    for (const b of this.ebullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (F.outside(b.x, b.y, 6)) b.dead = true;
    }
    for (const e of this.enemies) e.update(dt);
    if (this.boss) this.boss.update(dt);
    for (const k of this.pickups) {
      k.t += dt;
      k.u -= CFG.PICKUP_FALL * dt;
      k.lane += (k.goal - k.lane) * Math.min(1, dt * 1.3);
      const v = k.lane + Math.sin(k.t * 2.2) * 8;
      k.x = F.x(k.u, v); k.y = F.y(k.u, v);
      if (k.t > 1 && F.outside(k.x, k.y, 14)) k.dead = true;
      if (Math.random() < dt * 10) fx.spark(k.x + (Math.random() - 0.5) * 12, k.y, F.dx * 14, F.dy * 14, 0.5, '#ffe95a');
    }

    if (this.state === 'playing') this.collide();

    this.bullets = this.bullets.filter(b => !b.dead);
    this.ebullets = this.ebullets.filter(b => !b.dead);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.pickups = this.pickups.filter(k => !k.dead);
  }

  collide() {
    const p = this.player, boss = this.boss;

    // Player bullets vs moths and the Queen.
    for (const b of this.bullets) {
      if (boss && boss.vulnerable && near(b, boss, boss.hw, boss.hh)) {
        b.dead = true;
        boss.hit();
        this.addScore(10);
        audio.sfx.hit();
        fx.burst(b.x, b.y, ['#ffffff', '#d9a6ff'], 3, 50, { life: 0.25 });
        continue;
      }
      for (const e of this.enemies) {
        if (!e.active || e.dead || !near(b, e, 8, 8)) continue;
        b.dead = true;
        if (e.hit()) this.killMoth(e);
        else { audio.sfx.hit(); fx.burst(b.x, b.y, ['#ffffff', e.pal.w], 4, 50, { life: 0.25 }); }
        break;
      }
    }
    if (!p.alive) return;

    // Catch falling teeth.
    for (const k of this.pickups) {
      if (k.dead || !p.ships.some(s => near(s, k, 14, 14))) continue;
      k.dead = true;
      audio.sfx.pickup();
      fx.blast(k.x, k.y, '#ffe95a', 24, 0.35);
      fx.burst(k.x, k.y, ['#ffe95a', '#ffffff'], 16, 80);
      if (p.addShip(k.x, k.y)) { this.addScore(250); fx.popup(k.x, k.y - 10, '+SHIP', '#ffe95a'); }
      else { this.addScore(1000); fx.popup(k.x, k.y - 10, '+1000', '#ffe95a'); }
    }

    // Things that hurt.
    if (p.invuln > 0) return;
    for (let i = 0; i < p.ships.length; i++) {
      const s = p.ships[i];
      let hurt = false;
      for (const e of this.enemies) {
        if (e.active && !e.dead && near(s, e, 10, 9)) { this.killMoth(e); hurt = true; break; }
      }
      if (!hurt) for (const b of this.ebullets) {
        if (!b.dead && near(s, b, 5.5, 5.5)) { b.dead = true; hurt = true; break; }
      }
      if (!hurt && boss && boss.vulnerable && near(s, boss, boss.hw + 3, boss.hh + 4)) hurt = true;
      if (hurt) {
        if (p.hit(i)) this.gameOver();
        return;
      }
    }
  }

  // --- Draw -------------------------------------------------------------------

  draw(ctx) {
    const { W, H } = view, S = this.sprites, t = this.time;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    if (this.state === 'title') {
      this.drawTitle(ctx);
    } else {
      for (const s of this.stars) {
        const x = (s.x * W) | 0, y = (s.y * H) | 0;
        ctx.fillStyle = s.c; ctx.fillRect(x, y, 1, 1);
        if (s.sp > 22) { ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x + 1, y - 3, 1, 2); } // fast ones leave a tail
      }

      ctx.save();
      const [sx, sy] = fx.shakeOffset();
      ctx.translate(sx, sy);

      for (const k of this.pickups) {
        drawGlow(ctx, k.x, k.y, 17 + Math.sin(k.t * 9) * 4, '#ffe95a', 0.9);
        ctx.drawImage(((k.t * 8) | 0) % 2 ? S.tooth : S.toothGold, Math.round(k.x) - TOOTH_ORIGIN.x, Math.round(k.y) - TOOTH_ORIGIN.y);
      }
      for (const e of this.enemies) e.draw(ctx, S, t);
      if (this.boss) this.boss.draw(ctx, S, t);

      for (const b of this.bullets) {
        // A short streak of blocks laid along the firing axis.
        for (let i = 2; i >= 0; i--) {
          ctx.fillStyle = i === 2 ? '#777' : '#fff';
          ctx.fillRect(Math.round(b.x - F.dx * i * 2.24) - 1, Math.round(b.y - F.dy * i * 2.24) - 1, 2, 2);
        }
      }
      this.player.draw(ctx, S, t);
      for (const b of this.ebullets) {
        const x = Math.round(b.x), y = Math.round(b.y);
        drawGlow(ctx, x, y, 6, '#ff5a3a', 0.8);
        ctx.fillStyle = ((t * 12) | 0) % 2 ? '#ff9a3a' : '#ff5fa2';
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1, 1);
      }
      fx.draw(ctx);
      ctx.restore();

      this.drawThumbZone(ctx);
      this.drawHud(ctx);
    }

    if (this.state === 'gameover') this.drawGameOver(ctx);
    if (this.paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
      drawText(ctx, 'PAUSED', W / 2, H * 0.42, { scale: 3, align: 'center' });
      drawText(ctx, 'TAP TO RESUME', W / 2, H * 0.42 + 24, { align: 'center', color: '#aaa' });
    }
    if (fx.flash > 0) {
      ctx.globalAlpha = Math.min(1, fx.flash);
      ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    // Mute button (top right).
    const mx = W - 13, my = view.safeTop + 5;
    if (audio.muted) {
      ctx.drawImage(S.speakerOff, mx, my);
      drawText(ctx, 'X', mx + 5, my + 1, { color: '#ff4060' });
    } else ctx.drawImage(S.speaker, mx, my);
  }

  drawHud(ctx) {
    const { W, H } = view, top = view.safeTop + 4;
    drawText(ctx, this.score, 4, top, { scale: 2, shadow: '#333' });
    drawText(ctx, 'HI ' + this.hi, W / 2 + 8, top, { align: 'center', color: this.newHi ? '#ffe95a' : '#888' });
    const where = this.isBoss ? 'LEVEL ' + this.level + ' - QUEEN' : 'LEVEL ' + this.level + ' - WAVE ' + Math.max(1, this.wave) + '/' + CFG.WAVES_PER_LEVEL;
    drawText(ctx, where, W / 2 + 8, top + 7, { align: 'center', color: '#555' });

    const q = this.boss;
    if (q && q.state !== 'enter') {
      const bw = W - 40, by = view.safeTop + 22, fill = Math.max(0, Math.round((bw - 2) * q.hp / q.maxHp));
      ctx.fillStyle = '#fff'; ctx.fillRect(20, by, bw, 5);
      ctx.fillStyle = '#000'; ctx.fillRect(21, by + 1, bw - 2, 3);
      ctx.fillStyle = q.enraged ? '#ff3060' : '#b455ff'; ctx.fillRect(21, by + 1, fill, 3);
    }

    const b = this.banner;
    if (b && this.state === 'playing') {
      const y = Math.round(F.top + (F.bottom - F.top) * 0.42);
      if (b.color !== '#ff4060' || ((this.time * 5) | 0) % 2) {
        drawText(ctx, b.title, W / 2, y, { scale: 3, align: 'center', color: b.color, shadow: '#222' });
      }
      if (b.sub) drawText(ctx, b.sub, W / 2, y + 22, { align: 'center', color: '#ccc' });
    }
  }

  // The strip at the bottom is kept clear of the action so a thumb resting
  // there never hides anything. It is upholstered, naturally.
  drawThumbZone(ctx) {
    const { W, H } = view, y = F.bottom;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, y, W, H - y); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(0, y, W, H - y);
    this.drawCloth(ctx, 0.75);
    ctx.restore();
    ctx.fillStyle = '#444'; ctx.fillRect(0, y, W, 1);
    if (this.state === 'playing' && !this.paused && !input.firing && ((this.time * 2.5) | 0) % 2) {
      const ty = Math.round(y + (F.dead - view.safeBottom) / 2 - 3);
      ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 34, ty - 4, 68, 13);
      drawText(ctx, 'HOLD TO FIRE', W / 2, ty, { align: 'center' });
    }
  }

  drawCloth(ctx, alpha) {
    const { W, H } = view;
    const off = ((this.time * 6) | 0) % 16;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(-off, off - 16);
    ctx.fillStyle = this._cloth || (this._cloth = ctx.createPattern(this.sprites.cloth, 'repeat'));
    ctx.fillRect(0, 0, W + 16, H + 32);
    ctx.restore();
  }

  drawTitle(ctx) {
    const { W, H } = view, S = this.sprites, t = this.time;
    this.drawCloth(ctx, 1);

    const ty = Math.round(H * 0.2);
    ctx.fillStyle = '#000'; ctx.fillRect(0, ty - 12, W, 50);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, ty - 12, W, 1); ctx.fillRect(0, ty + 37, W, 1);
    drawText(ctx, 'HOUNDSTOOTH', W / 2, ty, { scale: 3, align: 'center', shadow: '#555' });
    drawText(ctx, 'A MOTH-EATEN SHOOTER', W / 2, ty + 24, { align: 'center', color: '#ff5fa2' });

    // A little diorama: a three-ship wedge firing up the diagonal at moths.
    const cy = Math.round(H * 0.47);
    ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - 48, cy - 48, 96, 96);
    const sx = Math.round(W / 2 - 24), sy = cy + 20 + Math.round(Math.sin(t * 1.5) * 2);
    [[-1, 1], [0, 'glow'], [1, 2]].forEach(([k, type], i) => {
      const bob = Math.sin(t * 2 + i * 2) * 2;
      const mx = sx + F.dx * (56 + bob) + F.nx * k * 19, my = sy + F.dy * (56 + bob) + F.ny * k * 19;
      if (type === 'glow') drawGlow(ctx, mx, my, 15 + Math.sin(t * 8) * 4, '#ffe95a', 0.9);
      ctx.drawImage(S.moth[type][((t * 5 + i) | 0) % 2], Math.round(mx) - 7, Math.round(my) - 6);
    });
    for (let i = 0; i < 3; i++) {
      const d = 14 + ((t * 60 + i * 13) % 39);
      ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(sx + 3 + F.dx * d), Math.round(sy - 4 + F.dy * d), 2, 2);
    }
    for (const [dx, dy] of [[0, 0], [-16, 0], [0, 16]]) ctx.drawImage(S.tooth, sx + dx - TOOTH_ORIGIN.x, sy + dy - TOOTH_ORIGIN.y);
    ctx.fillStyle = '#ff3b3b'; ctx.fillRect(sx - 1, sy - 1, 2, 2);

    const by = Math.round(H * 0.68);
    ctx.fillStyle = '#000'; ctx.fillRect(0, by - 8, W, 62);
    if (((t * 2.5) | 0) % 2) drawText(ctx, 'TAP TO START', W / 2, by, { scale: 2, align: 'center' });
    drawText(ctx, 'DRAG TO MOVE - HOLD TO FIRE', W / 2, by + 20, { align: 'center', color: '#aaa' });
    drawText(ctx, 'SHOOT THE GLOWING MOTH', W / 2, by + 30, { align: 'center', color: '#ffe95a' });
    drawText(ctx, 'CATCH THE TOOTH TO GROW', W / 2, by + 38, { align: 'center', color: '#ffe95a' });
    if (this.hi > 0) drawText(ctx, 'HIGH SCORE ' + this.hi, W / 2, H - 14 - view.safeBottom, { align: 'center', color: '#fff', shadow: '#000' });
  }

  drawGameOver(ctx) {
    const { W, H } = view, y = Math.round(H * 0.32);
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
    drawText(ctx, 'GAME OVER', W / 2, y, { scale: 3, align: 'center', shadow: '#555' });
    drawText(ctx, 'SCORE', W / 2, y + 30, { align: 'center', color: '#888' });
    drawText(ctx, this.score, W / 2, y + 38, { scale: 2, align: 'center' });
    if (this.newHi) {
      if (((this.time * 4) | 0) % 2) drawText(ctx, 'NEW HIGH SCORE!', W / 2, y + 56, { align: 'center', color: '#ffe95a' });
    } else drawText(ctx, 'HIGH SCORE ' + this.hi, W / 2, y + 56, { align: 'center', color: '#888' });
    drawText(ctx, 'REACHED LEVEL ' + this.level, W / 2, y + 66, { align: 'center', color: '#888' });
    if (this.overT > 0.9 && ((this.time * 2.5) | 0) % 2) drawText(ctx, 'TAP TO RESTART', W / 2, y + 92, { scale: 2, align: 'center' });
  }
}
