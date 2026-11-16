// Wave layouts and the swooping entrance paths.
// To add a wave: add a layout (rows of moth types, '.' = empty, max 8 wide)
// to LAYOUTS. To add an entrance: add a function to ENTRANCES.
import { CFG } from './config.js';
import { view } from './gfx.js';
import { Moth } from './enemies.js';

export const LAYOUTS = [
  // Level 1
  ['..1111..', '.111111.', '11111111'],
  ['1.1111.1', '11111111', '.11..11.'],
  ['..3333..', '11111111', '1.1111.1'],
  // Level 2
  ['2..22..2', '11111111', '.111111.', '..1..1..'],
  ['33.33.33', '11111111', '1.1111.1'],
  ['2.2222.2', '.333333.', '11111111', '..1111..'],
  // Level 3
  ['..4444..', '22.22.22', '11111111', '.111111.'],
  ['3.3333.3', '3.1111.3', '22222222', '..1111..'],
  ['4.4..4.4', '22222222', '33333333', '11111111'],
  // Level 5+ (these last six repeat, with rising difficulty)
  ['44.44.44', '2.2222.2', '33333333', '11111111'],
  ['4.2442.4', '33333333', '2.2222.2', '11111111', '.1.11.1.'],
  ['44444444', '22222222', '33333333', '3.1111.3', '..1111..'],
];
const REPEAT_FROM = 6;

// Each entrance returns { p0, c1, c2, delay } for a moth; the curve ends at
// the moth's grid slot. `m` = { col, row, cols, index, side, sideIndex }.
const ENTRANCES = [
  // Pincer: each half streams in from its own top corner and loops across.
  function pincer(m, W, H) {
    const cx = W / 2, s = m.side;
    return {
      p0: { x: cx + s * W * 0.25, y: -16 },
      c1: { x: cx + s * W * 0.8, y: H * 0.55 },
      c2: { x: cx - s * W * 0.5, y: H * 0.62 },
      delay: m.sideIndex * 0.11,
    };
  },
  // Sides: rows alternate sweeping in from the left and right edges.
  function sides(m, W, H) {
    const cx = W / 2, s = m.row % 2 ? 1 : -1;
    return {
      p0: { x: cx + s * (W / 2 + 16), y: H * 0.5 },
      c1: { x: cx + s * W * 0.1, y: H * 0.74 },
      c2: { x: cx - s * W * 0.55, y: H * 0.25 },
      delay: m.row * 0.55 + (s < 0 ? m.col : m.cols - 1 - m.col) * 0.1,
    };
  },
  // Cascade: everyone pours out of the top centre and fans out.
  function cascade(m, W, H) {
    const cx = W / 2, s = m.side;
    return {
      p0: { x: cx, y: -16 },
      c1: { x: cx + s * W * 0.75, y: H * 0.3 },
      c2: { x: cx + s * W * 0.5, y: H * 0.68 },
      delay: m.index * 0.07,
    };
  },
];

// Fills game.enemies with a wave. `progress` = waves seen so far (0-based).
export function buildWave(game, progress, withGlow) {
  const n = LAYOUTS.length;
  const layout = LAYOUTS[progress < n ? progress : REPEAT_FROM + ((progress - n) % (n - REPEAT_FROM))];
  const entrance = ENTRANCES[progress % ENTRANCES.length];
  const cols = Math.max(...layout.map(r => r.length));
  game.grid = { cols, rows: layout.length };

  const { W, H } = view;
  const dur = 2.1 / Math.sqrt(game.diff.speed);
  const moths = [];
  const sideCount = { '-1': 0, '1': 0 };
  let index = 0;
  layout.forEach((rowStr, row) => {
    for (let col = 0; col < rowStr.length; col++) {
      const type = +rowStr[col];
      if (!type) continue;
      const side = col < cols / 2 ? -1 : 1;
      const e = entrance({ col, row, cols, index: index++, side, sideIndex: sideCount[side]++ }, W, H);
      moths.push(new Moth(game, { type, col, row, delay: 0.2 + e.delay, enter: { p0: e.p0, c1: e.c1, c2: e.c2, dur } }));
    }
  });
  if (withGlow && moths.length) moths[(Math.random() * moths.length) | 0].glow = true;
  game.enemies.push(...moths);
}

export function isBossLevel(level) { return level % CFG.BOSS_EVERY === 0; }
