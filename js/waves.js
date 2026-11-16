// Wave layouts and the swooping entrance paths.
// To add a wave: add a layout (rows of moth types, '.' = empty, max 8 wide)
// to LAYOUTS. The first row is the furthest away; columns are firing lanes.
// To add an entrance: add a function to ENTRANCES.
import { CFG } from './config.js';
import { F } from './field.js';
import { Moth } from './enemies.js';

export const LAYOUTS = [
  // Level 1
  ['..1111..', '.111111.', '11111111'],
  ['1.1111.1', '11111111', '.111111.'],
  ['..3333..', '11111111', '11111111'],
  // Level 2
  ['2..22..2', '11111111', '.111111.', '.11..11.'],
  ['33.33.33', '11111111', '11111111'],
  ['2.2222.2', '.333333.', '11111111', '.111111.'],
  // Level 3
  ['..4444..', '22.22.22', '11111111', '.111111.'],
  ['3.3333.3', '3.1111.3', '22222222', '.111111.'],
  ['4.4..4.4', '22222222', '33333333', '11111111'],
  // Level 5+ (these last six repeat, with rising difficulty)
  ['44.44.44', '2.2222.2', '33333333', '11111111'],
  ['4.2442.4', '33333333', '2.2222.2', '11111111', '.1.11.1.'],
  ['44444444', '22222222', '33333333', '3.1111.3', '..1111..'],
];
const REPEAT_FROM = 6;

// Each entrance returns { p0, c1, c2, delay } for a moth; the curve ends at
// the moth's grid slot. Points are built with F.pt(u, v): u along the firing
// axis (0 = the player's corner, F.uFar = the far corner), v across it.
// `m` = { col, row, cols, index, side, sideIndex, vMid }.
const ENTRANCES = [
  // Pincer: each half streams in over the far corner, swings wide and
  // crosses in front of the player before climbing to its slot.
  function pincer(m) {
    const s = m.side;
    return {
      p0: F.pt(F.uFar + 26, m.vMid + s * 45),
      c1: F.pt(F.front + 45, m.vMid + s * 150),
      c2: F.pt(F.front + 30, m.vMid - s * 80),
      delay: m.sideIndex * 0.09,
    };
  },
  // Sides: rows alternate sweeping in across the lanes from either flank.
  function sides(m) {
    const s = m.row % 2 ? 1 : -1;
    return {
      p0: F.pt((F.front + F.uFar) / 2, m.vMid + s * (F.W * 0.9 + 30)),
      c1: F.pt(F.front + 35, m.vMid + s * 20),
      c2: F.pt(F.front + 110, m.vMid - s * 115),
      delay: m.row * 0.45 + (s < 0 ? m.col : m.cols - 1 - m.col) * 0.08,
    };
  },
  // Cascade: everyone pours out of the far corner and fans out.
  function cascade(m) {
    const s = m.side;
    return {
      p0: F.pt(F.uFar + 26, F.v(F.W, F.top)),
      c1: F.pt(F.uFar - 90, m.vMid + s * 135),
      c2: F.pt(F.front + 45, m.vMid + s * 85),
      delay: m.index * 0.055,
    };
  },
];

// Fills game.enemies with a wave. `progress` = waves seen so far (0-based).
export function buildWave(game, progress, withGlow) {
  const n = LAYOUTS.length;
  const layout = LAYOUTS[progress < n ? progress : REPEAT_FROM + ((progress - n) % (n - REPEAT_FROM))];
  const entrance = ENTRANCES[progress % ENTRANCES.length];
  const cols = Math.max(...layout.map(r => r.length));
  game.setGrid(cols, layout.length);

  const dur = 1.75 / Math.sqrt(game.diff.speed);
  const vMid = game.grid.vMid;
  const moths = [];
  const sideCount = { '-1': 0, '1': 0 };
  let index = 0;
  layout.forEach((rowStr, row) => {
    for (let col = 0; col < rowStr.length; col++) {
      const type = +rowStr[col];
      if (!type) continue;
      const side = col < cols / 2 ? -1 : 1;
      const e = entrance({ col, row, cols, index: index++, side, sideIndex: sideCount[side]++, vMid });
      moths.push(new Moth(game, { type, col, row, delay: 0.15 + e.delay, enter: { p0: e.p0, c1: e.c1, c2: e.c2, dur } }));
    }
  });
  if (withGlow && moths.length) moths[(Math.random() * moths.length) | 0].glow = true;
  game.enemies.push(...moths);
}

export function isBossLevel(level) { return level % CFG.BOSS_EVERY === 0; }
