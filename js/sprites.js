// Pixel art data. Sprites are rows of characters looked up in a palette.
import { bake, silhouette, makeCanvas } from './gfx.js';

// The classic 8x8 houndstooth repeat (2/2 twill, 4 dark + 4 light threads).
export const TILE_BITS = [
  '11110011',
  '11110110',
  '11111100',
  '11111001',
  '11000000',
  '10010000',
  '00110000',
  '01100000',
];

// One whole "tooth" cut out of that pattern: the square body, the spike on
// top (our nose/gun), the arm sweeping up-right and the little nubs.
// Copies of this placed 8 cells apart interlock into the houndstooth tiling.
// The body's centre is at cell (3,5) => pixel (6,10) at 2px per cell.
export const TOOTH = [
  '....1....',
  '...11....',
  '..11.....',
  '.1111..11',
  '.1111.11.',
  '.111111..',
  '111111...',
  '.11......',
  '.1.......',
];
export const TOOTH_ORIGIN = { x: 6, y: 10 };

// Moths are drawn as a left half and mirrored (last column = centre line).
const MOTH_A = [
  '....a...',
  '.....a..',
  '.ww...ab',
  'wwww..bb',
  'wxxwwweb',
  'wxxxwwbb',
  'wwxxwwbb',
  '.wwwwwbb',
  '..wwwwbb',
  '.wwww.bb',
  '.www...b',
  '..w.....',
];
const MOTH_B = [
  '....a...',
  '.....a..',
  '......ab',
  '..ww..bb',
  '.wxxwweb',
  '.wxxxwbb',
  '.wwxxwbb',
  '..wwwwbb',
  '..wwwwbb',
  '..www.bb',
  '..ww...b',
  '........',
];

const QUEEN = [
  '......a.........',
  '.......a........',
  '........a...a...',
  '.wwww....a...a..',
  'wwwwwww...a..abb',
  'wxxxxwwww..bbbbb',
  'wxyyxxwwwwwbbebb',
  'wxyyyxxwwwwbbbbb',
  'wxxyyyxxwwwbbcbb',
  'wwxxyyxxwwwbbbbb',
  '.wwxxxxwwwwbbcbb',
  '..wwwwwwwwwbbbbb',
  '...wwwwwwwbbbcbb',
  '..wwxxxwww.bbbbb',
  '.wwxyyxxww.bbcbb',
  '.wxyyyxww...bbbb',
  '.wxxyxxw....bbcb',
  '.wwxxxww.....bbb',
  '..wwwww......bbb',
  '...www........bb',
  '...............b',
];

// w = wing, x = wing marking, b = body, e = eye, a = antenna
export const PAL = {
  1: { w: '#ff5fa2', x: '#ffd1e3', b: '#a8386f', e: '#ffffff', a: '#ffb3d1' },
  2: { w: '#3fd8ff', x: '#e0fbff', b: '#1f7fa8', e: '#ffffff', a: '#a8efff' },
  3: { w: '#8dff5a', x: '#f0ffd0', b: '#3a9a3e', e: '#ffffff', a: '#c8ffb0' },
  4: { w: '#ffa53a', x: '#fff0b0', b: '#b85a18', e: '#ffffff', a: '#ffd29a' },
  glow: { w: '#ffe95a', x: '#ffffff', b: '#d9a520', e: '#ffffff', a: '#fff6b0' },
  queen: { w: '#b455ff', x: '#ff5fa2', y: '#ffe95a', b: '#5a2796', c: '#ffe95a', e: '#ff3030', a: '#d9a6ff' },
};

const SPEAKER = [
  '...1...',
  '..11.1.',
  '1111..1',
  '1111..1',
  '1111..1',
  '..11.1.',
  '...1...',
];

export function buildSprites() {
  const S = { moth: {}, mothFlash: [] };
  for (const key of [1, 2, 3, 4, 'glow']) {
    S.moth[key] = [bake(MOTH_A, PAL[key], { mirror: true }), bake(MOTH_B, PAL[key], { mirror: true })];
  }
  S.mothFlash = S.moth[1].map(c => silhouette(c));

  S.queen = bake(QUEEN, PAL.queen, { mirror: true, px: 2 });
  S.queenFlash = silhouette(S.queen);
  S.queenRed = silhouette(S.queen, '#ff4040');

  S.tooth = bake(TOOTH, { 1: '#ffffff' }, { px: 2 });
  S.toothGold = bake(TOOTH, { 1: '#ffe95a' }, { px: 2 });
  S.toothGrey = bake(TOOTH, { 1: '#9a9a9a' }, { px: 2 });

  // Dim houndstooth cloth for backdrops.
  S.cloth = makeCanvas(16, 16);
  const g = S.cloth.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16);
  g.drawImage(bake(TILE_BITS, { 1: '#1d1d1d' }, { px: 2 }), 0, 0);

  S.speaker = bake(SPEAKER, { 1: '#ffffff' });
  S.speakerOff = bake(SPEAKER.map(r => r.slice(0, 4)), { 1: '#777777' });
  return S;
}
