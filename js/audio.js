// Chiptune sound effects and looping music, all synthesised with Web Audio.
const MUTE_KEY = 'houndstooth.muted';
const midi = n => 440 * Math.pow(2, (n - 69) / 12);

let ctx = null, master, sfxGain, musicGain, noiseBuf;
let song = null, step = 0, nextT = 0, timer = null, lastShoot = 0;

function tone({ type = 'square', f, f2 = 0, dur, vol = 0.2, t = 0, out = sfxGain, attack = 0.004 }) {
  if (!ctx) return;
  t = t || ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.03);
}

function noise({ dur, vol = 0.2, t = 0, out = sfxGain, type = 'lowpass', freq = 4000, freq2 = 0 }) {
  if (!ctx) return;
  t = t || ctx.currentTime;
  const s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true;
  fl.type = type;
  fl.frequency.setValueAtTime(freq, t);
  if (freq2) fl.frequency.exponentialRampToValueAtTime(freq2, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(out);
  s.start(t, Math.random()); s.stop(t + dur + 0.03);
}

// Play a quick run of notes (midi numbers), `gap` seconds apart.
function arp(notes, gap, opts = {}) {
  if (!ctx) return;
  const t0 = ctx.currentTime;
  notes.forEach((n, i) => tone({ f: midi(n), dur: gap * 1.6, vol: 0.14, ...opts, t: t0 + i * gap + 0.001 }));
}

// --- Music ------------------------------------------------------------------
// Each bar: bass root, chord (for the arpeggio) and 16 lead steps
// (midi note, 0 = rest, -1 = hold previous note).
const SONGS = {
  main: {
    bpm: 138, kickEvery: 8,
    bars: [
      { root: 45, chord: [57, 60, 64], lead: [69, -1, -1, 72, -1, -1, 76, -1, 74, -1, 72, -1, 71, -1, 72, -1] },
      { root: 41, chord: [57, 60, 65], lead: [69, -1, -1, 65, -1, -1, 69, -1, 72, -1, -1, -1, 0, 0, 69, 72] },
      { root: 48, chord: [55, 60, 64], lead: [76, -1, -1, 72, -1, -1, 76, -1, 79, -1, 76, -1, 74, -1, 72, -1] },
      { root: 43, chord: [55, 59, 62], lead: [74, -1, -1, 71, -1, -1, 67, -1, 71, -1, 74, -1, 0, 0, 71, 74] },
      { root: 45, chord: [57, 60, 64], lead: [76, -1, -1, 81, -1, -1, 76, -1, 72, -1, 76, -1, 81, -1, 79, -1] },
      { root: 41, chord: [57, 60, 65], lead: [77, -1, -1, 81, -1, -1, 77, -1, 72, -1, 77, -1, 76, -1, 74, -1] },
      { root: 43, chord: [55, 59, 62], lead: [74, -1, 71, -1, 74, -1, 79, -1, 77, -1, 74, -1, 71, -1, 74, -1] },
      { root: 40, chord: [56, 59, 64], lead: [76, -1, -1, -1, 80, -1, -1, -1, 83, -1, 80, -1, 76, -1, 0, 0] },
    ],
  },
  boss: {
    bpm: 164, kickEvery: 4,
    bars: [
      { root: 45, chord: [57, 60, 64], lead: [69, 0, 69, 72, -1, 69, 0, 76, -1, -1, 74, -1, 72, -1, 71, -1] },
      { root: 45, chord: [57, 60, 64], lead: [69, 0, 69, 72, -1, 69, 0, 77, -1, -1, 76, -1, 74, -1, 72, -1] },
      { root: 41, chord: [57, 60, 65], lead: [65, 0, 65, 69, -1, 65, 0, 72, -1, -1, 69, -1, 65, -1, 69, -1] },
      { root: 40, chord: [56, 59, 64], lead: [64, 0, 64, 68, -1, 71, -1, 76, -1, -1, 80, -1, 83, -1, 80, -1] },
    ],
  },
};

function playStep(sg, n, t) {
  const bar = sg.bars[n >> 4], s = n & 15, sd = 60 / sg.bpm / 4;
  const v = bar.lead[s];
  if (v > 0) {
    let len = 1;
    while (s + len < 16 && bar.lead[s + len] === -1) len++;
    tone({ f: midi(v), dur: len * sd * 0.95, vol: 0.085, t, out: musicGain });
  }
  if (s % 2 === 0) {
    tone({ type: 'triangle', f: midi(bar.root + (s % 4 === 2 ? 12 : 0)), dur: sd * 1.9, vol: 0.26, t, out: musicGain });
  }
  tone({ f: midi(bar.chord[s % 3] + 12), dur: sd * 0.9, vol: 0.028, t, out: musicGain });
  if (s % sg.kickEvery === 0) tone({ type: 'triangle', f: 160, f2: 40, dur: 0.12, vol: 0.4, t, out: musicGain });
  if (s % 8 === 4) noise({ dur: 0.1, vol: 0.13, t, out: musicGain, type: 'highpass', freq: 1500 });
  if (s % 2 === 0) noise({ dur: 0.03, vol: 0.04, t, out: musicGain, type: 'highpass', freq: 7000 });
}

function schedule() {
  if (!song || !ctx || ctx.state !== 'running') return;
  if (nextT < ctx.currentTime) nextT = ctx.currentTime + 0.05; // fell behind (tab was asleep)
  while (nextT < ctx.currentTime + 0.15) {
    playStep(song, step, nextT);
    nextT += 60 / song.bpm / 4;
    step = (step + 1) % (song.bars.length * 16);
  }
}

export const audio = {
  muted: false,
  _wanted: null, // music requested before the context was unlocked

  // Must be called from a user gesture; safe to call repeatedly.
  unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
      master = ctx.createGain(); master.gain.value = this.muted ? 0 : 0.8; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.9; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.55; musicGain.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      timer = setInterval(schedule, 25);
      if (this._wanted) this.playMusic(this._wanted);
    }
    if (ctx.state === 'suspended' && !document.hidden) ctx.resume();
  },

  loadMuted() {
    try { this.muted = localStorage.getItem(MUTE_KEY) === '1'; } catch (e) {}
  },

  toggleMute() {
    this.muted = !this.muted;
    try { localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0'); } catch (e) {}
    if (ctx) master.gain.setTargetAtTime(this.muted ? 0 : 0.8, ctx.currentTime, 0.02);
  },

  playMusic(name) {
    this._wanted = name;
    if (!ctx || song === SONGS[name]) return;
    song = SONGS[name]; step = 0; nextT = ctx.currentTime + 0.08;
  },
  stopMusic() { this._wanted = null; song = null; },

  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

  sfx: {
    shoot() {
      if (!ctx || ctx.currentTime - lastShoot < 0.07) return;
      lastShoot = ctx.currentTime;
      tone({ f: 1100, f2: 380, dur: 0.07, vol: 0.05 });
    },
    hit() { tone({ f: 320, f2: 160, dur: 0.05, vol: 0.1 }); },
    boom() {
      noise({ dur: 0.22, vol: 0.28, freq: 3200, freq2: 300 });
      tone({ f: 240, f2: 50, dur: 0.18, vol: 0.14 });
    },
    bigBoom() {
      noise({ dur: 0.9, vol: 0.5, freq: 2600, freq2: 80 });
      tone({ type: 'sawtooth', f: 180, f2: 28, dur: 0.8, vol: 0.25 });
    },
    playerHit() {
      noise({ dur: 0.4, vol: 0.4, freq: 2400, freq2: 150 });
      tone({ type: 'sawtooth', f: 440, f2: 55, dur: 0.4, vol: 0.2 });
    },
    dive() { tone({ type: 'triangle', f: 1300, f2: 350, dur: 0.38, vol: 0.07 }); },
    drop() { arp([88, 84, 88, 91], 0.06, { type: 'triangle', vol: 0.16 }); },
    pickup() { arp([72, 76, 79, 84, 88], 0.05); },
    lock() { tone({ f: 660, dur: 0.05, vol: 0.12 }); tone({ f: 1320, dur: 0.12, vol: 0.12, t: ctx ? ctx.currentTime + 0.05 : 0 }); },
    start() { arp([60, 64, 67, 72, 76, 79], 0.06); },
    waveClear() { arp([72, 79, 84], 0.07, { vol: 0.1 }); },
    levelClear() { arp([67, 72, 76, 79, 76, 79, 84], 0.09); },
    warning() {
      if (!ctx) return;
      for (let i = 0; i < 6; i++) tone({ type: 'sawtooth', f: i % 2 ? 196 : 233, dur: 0.22, vol: 0.16, t: ctx.currentTime + i * 0.25 + 0.001 });
    },
    queenCry() { tone({ type: 'sawtooth', f: 900, f2: 120, dur: 0.6, vol: 0.16 }); },
    gameOver() { arp([72, 71, 67, 64, 60, 59, 57], 0.16, { type: 'triangle', vol: 0.22 }); },
  },
};
audio.loadMuted();
