// All gameplay tuning lives here so it is easy to tweak.
export const CFG = {
  TARGET_W: 180,          // logical pixels across the screen (integer-scaled up)
  MAX_ASPECT: 0.62,       // on wide screens, letterbox to this width/height

  // The tilted field (see field.js)
  AIM_DEG: 63.435,        // firing angle above horizontal. atan(2): shots step
                          // 1px across per 2px up, a clean pixel diagonal
  FRONT: 0.42,            // how far up the axis the player may advance (0..1)
  THUMB_W: 0.36,          // width (share of the screen) of the bottom-right
                          // corner cut off along the firing axis for a thumb
  HUD_H: 20,

  // Player / formation
  TILE: 16,               // houndstooth repeat, in logical px (8 cells of 2px)
  MAX_SHIPS: 8,
  FIRE_INTERVAL: 0.095,   // seconds between volleys (only while touching)
  BULLET_SPEED: 330,
  INVULN_TIME: 1.3,       // seconds of blinking after a hit
  // Double tap: the spin, a timed special. The formation whirls around the
  // leader, invulnerable, firing fast and shredding any moth it touches.
  SPIN_TIME: 0.65,
  SPIN_TURNS: 2,
  SPIN_SPREAD: 2.0,       // how far apart the ships fling (1 = locked together)
  SPIN_FIRE: 2.5,         // fire-rate multiplier during the spin
  SPIN_GRACE: 0.2,        // extra invulnerable time after regrouping
  SPIN_COOLDOWN: 4,       // seconds before it can be used again
  // Second thumb: drag up / down to loosen or tighten the formation.
  SPREAD_MAX: 2.2,        // widest spacing (1 = locked together)
  SPREAD_DRAG: 70,        // px of second-thumb travel from locked to widest
  DRAG_GAIN: 1.3,         // ship px moved per px of thumb drag
  KEY_SPEED: 150,

  // Pickups
  PICKUP_FALL: 40,
  GLOW_EVERY_WAVES: 3,    // a glowing moth appears about once every N waves
  GLOW_MERCY_WAVES: 2,    // ...or every N waves when down to the last ship

  // Structure
  WAVES_PER_LEVEL: 3,
  BOSS_EVERY: 4,          // every Nth level is a Moth Queen

  // Grid of moths (tilted: columns are firing lanes, rows run across them)
  GRID_COLS: 8,
  GRID_DV: 16,            // spacing between lanes
  GRID_DU: 15,            // spacing between rows
  GRID_SWAY: 8,
};

// Formation slots, in houndstooth-tile units (x right, y down) relative to
// the lead ship. Ships fill these in order. Chosen for the firing angle so
// the formation stays one solid block of cloth behind the leader at every
// size (2x2 at four ships), with every ship in its own lane.
export const SLOTS = [
  [0, 0], [-1, 0], [0, 1], [-1, 1],
  [1, 1], [-2, 0], [-2, 1], [0, 2],
];

// Where shots leave a ship, relative to its centre: the tips of the tooth's
// two prongs, used alternately like twin guns.
export const MUZZLES = [[3, -9], [11, -3]];

export const MOTH_TYPES = {
  1: { hp: 2, score: 50,  shooter: false, diveSpeed: 1.0 },
  2: { hp: 3, score: 100, shooter: true,  diveSpeed: 1.0 },
  3: { hp: 1, score: 80,  shooter: false, diveSpeed: 1.45 },
  4: { hp: 5, score: 150, shooter: true,  diveSpeed: 0.9 },
};

// How the game gets harder with level number.
export function difficulty(level) {
  const l = Math.min(level, 14);
  return {
    speed: 1 + (l - 1) * 0.055,
    diveInterval: Math.max(0.5, 2.0 - l * 0.13),
    maxDivers: Math.min(6, 2 + Math.floor(l / 2)),
    bulletSpeed: 70 + l * 5,
    shootChance: Math.min(0.9, 0.12 + l * 0.08), // for non-shooter moths
  };
}
