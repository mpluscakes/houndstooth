// The tilted playfield. Everything in the game runs along one diagonal axis:
// ships fire up it, moths fly down it. Positions are often easier to think
// about in axis coordinates:
//   u = distance along the firing axis, measured from the bottom-left corner
//   v = lane (sideways across the axis; bigger = further right / lower)
// A shot keeps its v and gains u. F.pt(u, v) converts back to screen pixels.
import { CFG } from './config.js';
import { view } from './gfx.js';

const a = (CFG.AIM_DEG * Math.PI) / 180;

export const F = {
  dx: Math.cos(a), dy: -Math.sin(a),   // unit vector of fire, in screen space
  nx: Math.sin(a), ny: Math.cos(a),    // unit vector across the lanes
  backAngle: Math.atan2(Math.sin(a), -Math.cos(a)), // screen angle moths travel at

  W: 180, top: 0, bottom: 300, dead: 0,
  uFar: 300,     // u of the far (top-right) corner
  front: 100,    // the player may not advance past this u
  reachL: 0,     // left-most lane the player can get into
  reachR: 0,     // right-most lane

  // Recomputed every frame so rotation / resizing just works.
  layout() {
    const { W, H } = view;
    this.W = W;
    this.dead = Math.max(CFG.THUMB_MIN, Math.round(H * CFG.THUMB_FRAC)) + view.safeBottom;
    this.bottom = H - this.dead;
    this.top = view.safeTop + CFG.HUD_H;
    this.uFar = this.u(W, this.top);
    this.front = this.uFar * CFG.FRONT;
    this.reachL = (10 - this.front * this.dx) / this.nx;
    this.reachR = (W - 14) * this.nx;
  },

  x(u, v) { return u * this.dx + v * this.nx; },
  y(u, v) { return this.bottom + u * this.dy + v * this.ny; },
  pt(u, v) { return { x: this.x(u, v), y: this.y(u, v) }; },
  u(x, y) { return x * this.dx + (y - this.bottom) * this.dy; },
  v(x, y) { return x * this.nx + (y - this.bottom) * this.ny; },

  // How far up lane v you can go before leaving the top or right edge.
  exitU(v) {
    return Math.min((this.W - v * this.nx) / this.dx, (this.top - this.bottom - v * this.ny) / this.dy);
  },

  // Is the point outside the playfield by more than m pixels?
  outside(x, y, m = 8) {
    return x < -m || x > this.W + m || y < this.top - m || y > this.bottom + m;
  },
};
