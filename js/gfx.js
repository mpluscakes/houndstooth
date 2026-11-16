// Screen setup (integer-scaled low-res canvas), sprite baking and a pixel font.
import { CFG } from './config.js';

export const view = { canvas: null, ctx: null, W: 180, H: 320, scale: 1, safeTop: 0, safeBottom: 0 };

export function initView(canvas) {
  view.canvas = canvas;
  view.ctx = canvas.getContext('2d', { alpha: false });
  resize();
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 250));
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);
}

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  const cssH = window.innerHeight;
  const cssW = Math.min(window.innerWidth, Math.floor(cssH * CFG.MAX_ASPECT));
  // Each logical pixel covers a whole number of device pixels => crisp.
  const scale = Math.max(1, Math.floor((cssW * dpr) / CFG.TARGET_W));
  const W = Math.max(120, Math.floor((cssW * dpr) / scale));
  const H = Math.max(200, Math.floor((cssH * dpr) / scale));
  const c = view.canvas;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  c.style.width = (W * scale) / dpr + 'px';
  c.style.height = (H * scale) / dpr + 'px';
  view.ctx.imageSmoothingEnabled = false;
  view.W = W; view.H = H; view.scale = scale;

  const probe = document.getElementById('safe-probe');
  if (probe) {
    const cs = getComputedStyle(probe);
    view.safeTop = Math.ceil(((parseFloat(cs.paddingTop) || 0) * dpr) / scale);
    view.safeBottom = Math.ceil(((parseFloat(cs.paddingBottom) || 0) * dpr) / scale);
  }
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// Turn rows of palette characters into a canvas. `mirror` reflects each row
// around its last column (handy for symmetric creatures). `px` = pixel size.
export function bake(rows, pal, { mirror = false, px = 1 } = {}) {
  const full = rows.map(r => (mirror ? r + [...r].slice(0, -1).reverse().join('') : r));
  const w = Math.max(...full.map(r => r.length));
  const c = makeCanvas(w * px, full.length * px);
  const g = c.getContext('2d');
  full.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const col = pal[r[x]];
      if (col) { g.fillStyle = col; g.fillRect(x * px, y * px, px, px); }
    }
  });
  return c;
}

// Solid-colour copy of a sprite, used for hit flashes.
export function silhouette(src, color = '#fff') {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

export function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Soft radial glow sprites, cached per colour. Drawn additively and scaled
// with smoothing off, so the glow itself stays chunky.
const glowCache = new Map();
export function getGlow(color) {
  let c = glowCache.get(color);
  if (!c) {
    const R = 16;
    c = makeCanvas(R * 2, R * 2);
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(R, R, 0, R, R, R);
    grad.addColorStop(0, hexA(color, 0.85));
    grad.addColorStop(0.35, hexA(color, 0.35));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, R * 2, R * 2);
    glowCache.set(color, c);
  }
  return c;
}

export function drawGlow(ctx, x, y, r, color, alpha = 1) {
  if (alpha <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, alpha);
  ctx.drawImage(getGlow(color), Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
  ctx.restore();
}

// --- 3x5 pixel font -------------------------------------------------------
const FONT = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '111101101101101', O: '111101101101111', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  '-': '000000111000000', '.': '000000000000010', '!': '010010010000010',
  ':': '000010000010000', '+': '000010111010000', '/': '001001010100100',
  "'": '010010000000000',
};

export function textWidth(str, scale = 1) {
  return (str.length * 4 - 1) * scale;
}

// align: 'left' | 'center' | 'right'. `shadow` is an optional drop-shadow colour.
export function drawText(ctx, str, x, y, { scale = 1, color = '#fff', align = 'left', shadow = null } = {}) {
  str = String(str).toUpperCase();
  x = Math.round(x); y = Math.round(y);
  if (align === 'center') x -= Math.round(textWidth(str, scale) / 2);
  else if (align === 'right') x -= textWidth(str, scale);
  if (shadow) drawText(ctx, str, x + scale, y + scale, { scale, color: shadow });
  ctx.fillStyle = color;
  for (let i = 0; i < str.length; i++) {
    const g = FONT[str[i]];
    if (g) {
      for (let b = 0; b < 15; b++) {
        if (g[b] === '1') ctx.fillRect(x + (b % 3) * scale, y + ((b / 3) | 0) * scale, scale, scale);
      }
    }
    x += 4 * scale;
  }
}
