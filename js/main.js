// Boot + fixed-timestep loop (logic at 60Hz, drawn once per display frame).
import { initView, view } from './gfx.js';
import { initInput } from './input.js';
import { Game } from './game.js';

initView(document.getElementById('game'));
initInput();
const game = new Game();
window.__game = game; // handy in the console

const STEP = 1 / 60;
let last = performance.now(), acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (Math.abs(dt - STEP) < 0.003) dt = STEP; // absorb timer jitter on 60Hz screens
  acc += Math.min(dt, 0.25);
  let n = 0;
  while (acc >= STEP - 1e-6 && n < 5) { game.update(STEP); acc -= STEP; n++; }
  if (n === 5) acc = 0;
  game.draw(view.ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
