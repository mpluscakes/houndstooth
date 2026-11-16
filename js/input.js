// Pointer + keyboard input. Dragging anywhere moves the ship (relative drag,
// so your thumb never has to cover it). Taps are queued for menus/buttons.
import { view } from './gfx.js';
import { audio } from './audio.js';

export const input = {
  left: 0, right: 0,
  taps: [],          // [{x, y}] in logical pixels (x = -1 for keyboard "tap")
  keys: [],          // one-shot key presses: 'mute', 'pause'
  _drag: 0, _id: null, _lastX: 0, _wantFullscreen: true,

  takeDrag() { const d = this._drag; this._drag = 0; return d; },
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
    input._lastX = p.x;
    input.taps.push(p);
    e.preventDefault();
  }, { passive: false });

  target.addEventListener('pointermove', e => {
    if (e.pointerId !== input._id) return;
    const p = toLogical(e);
    input._drag += p.x - input._lastX;
    input._lastX = p.x;
  });

  const end = e => {
    audio.unlock();
    if (e.pointerId === input._id) input._id = null;
    if (e.type === 'pointerup') tryFullscreen(e);
  };
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
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
      case 'Space': case 'Enter': input.taps.push({ x: -1, y: -1 }); e.preventDefault(); break;
      case 'KeyM': input.keys.push('mute'); break;
      case 'KeyP': case 'Escape': input.keys.push('pause'); break;
    }
  });
  addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') input.left = 0;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') input.right = 0;
  });
}
