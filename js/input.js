// Pointer + keyboard input. Dragging anywhere moves the ship (relative drag,
// so your thumb never has to cover it) and the ship fires for as long as the
// screen is touched. Taps are queued for menus/buttons.
import { view } from './gfx.js';
import { audio } from './audio.js';

export const input = {
  left: 0, right: 0, up: 0, down: 0,
  held: false,       // a finger / mouse button is down
  fireKey: 0,        // Space is down
  taps: [],          // [{x, y}] in logical pixels (x = -1 for keyboard "tap")
  keys: [],          // one-shot presses: 'mute', 'pause', 'scatter' (double tap)
  _tapT: 0, _tapX: 0, _tapY: 0,
  _dx: 0, _dy: 0, _id: null, _lastX: 0, _lastY: 0, _wantFullscreen: true,

  get firing() { return this.held || !!this.fireKey; },
  takeDrag() { const d = { x: this._dx, y: this._dy }; this._dx = this._dy = 0; return d; },
};

function toLogical(e) {
  const r = view.canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * view.W) / r.width, y: ((e.clientY - r.top) * view.H) / r.height };
}

function tryFullscreen(e) {
  // Only once, only for touch, and only where the browser supports it
  // (Android Chrome does; iPhone Safari needs "Add to Home Screen").
  if (!input._wantFullscreen || e.pointerType !== 'touch') return;
  input._wantFullscreen = false;
  const el = document.documentElement;
  if (el.requestFullscreen && !document.fullscreenElement) {
    el.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('portrait').catch(() => {}))
      .catch(() => {});
  }
}

export function initInput() {
  const target = window;
  target.addEventListener('pointerdown', e => {
    audio.unlock();
    if (input._id !== null) return;
    const p = toLogical(e);
    input._id = e.pointerId;
    input.held = true;
    input._lastX = p.x; input._lastY = p.y;
    input.taps.push(p);
    const now = performance.now();
    if (now - input._tapT < 300 && Math.abs(p.x - input._tapX) + Math.abs(p.y - input._tapY) < 40) {
      input.keys.push('scatter'); input._tapT = 0;
    } else { input._tapT = now; input._tapX = p.x; input._tapY = p.y; }
    e.preventDefault();
  }, { passive: false });

  target.addEventListener('pointermove', e => {
    if (e.pointerId !== input._id) return;
    const p = toLogical(e);
    input._dx += p.x - input._lastX; input._dy += p.y - input._lastY;
    input._lastX = p.x; input._lastY = p.y;
  });

  const end = e => {
    audio.unlock();
    if (e.pointerId === input._id) { input._id = null; input.held = false; }
    if (e.type === 'pointerup') tryFullscreen(e);
  };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  target.addEventListener('blur', () => {
    input._id = null; input.held = false; input.fireKey = 0;
    input.left = input.right = input.up = input.down = 0;
  });
  // iOS only treats some events as "user gestures" for audio; cover them all.
  for (const ev of ['touchend', 'click']) target.addEventListener(ev, () => audio.unlock());
  for (const ev of ['touchstart', 'touchmove', 'contextmenu', 'gesturestart', 'dblclick']) {
    document.addEventListener(ev, e => e.preventDefault(), { passive: false });
  }

  addEventListener('keydown', e => {
    audio.unlock();
    if (e.repeat) return;
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = 1; break;
      case 'ArrowRight': case 'KeyD': input.right = 1; break;
      case 'ArrowUp': case 'KeyW': input.up = 1; e.preventDefault(); break;
      case 'ArrowDown': case 'KeyS': input.down = 1; e.preventDefault(); break;
      case 'Space': input.fireKey = 1; input.taps.push({ x: -1, y: -1 }); e.preventDefault(); break;
      case 'Enter': input.taps.push({ x: -1, y: -1 }); e.preventDefault(); break;
      case 'KeyM': input.keys.push('mute'); break;
      case 'ShiftLeft': case 'ShiftRight': case 'KeyX': input.keys.push('scatter'); break;
      case 'KeyP': case 'Escape': input.keys.push('pause'); break;
    }
  });
  addEventListener('keyup', e => {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': input.left = 0; break;
      case 'ArrowRight': case 'KeyD': input.right = 0; break;
      case 'ArrowUp': case 'KeyW': input.up = 0; break;
      case 'ArrowDown': case 'KeyS': input.down = 0; break;
      case 'Space': input.fireKey = 0; break;
    }
  });
}
