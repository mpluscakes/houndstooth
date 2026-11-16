// All gameplay tuning lives here so it is easy to tweak.
export const CFG = {
  TARGET_W: 180,          // logical pixels across the screen (integer-scaled up)
  MAX_ASPECT: 0.62,       // on wide screens, letterbox to this width/height

  // Player / formation
  TILE: 16,               // houndstooth repeat, in logical px (8 cells of 2px)
  MAX_SHIPS: 8,
  FIRE_INTERVAL: 0.26,    // seconds between volleys
  BULLET_SPEED: 270,
  INVULN_TIME: 1.3,       // seconds of blinking after a hit
  PLAYER_BOTTOM: 50,      // distance of the lead ship from the bottom edge
  DRAG_GAIN: 1.3,         // ship px moved per px of thumb drag
  KEY_SPEED: 150,

  // Pickups
  PICKUP_FALL: 36,
  GLOW_EVERY_WAVES: 3,    // a glowing moth appears about once every N waves
  GLOW_MERCY_WAVES: 2,    // ...or every N waves when down to the last ship

  // Structure
  WAVES_PER_LEVEL: 3,
  BOSS_EVERY: 4,          // every Nth level is a Moth Queen

  // Grid of moths
  GRID_DX: 20,
  GRID_DY: 16,
  GRID_TOP: 40,
};

// Formation slots, in houndstooth-tile units relative to the lead ship.
// Ships fill these in order, so the formation grows beside, then behind.
export const SLOTS = [
  [0, 0], [-1, 0], [1, 0],
  [0, 1], [-1, 1], [1, 1],
  [-2, 0], [2, 0],
];

export const MOTH_TYPES = {
  1: { hp: 1, score: 50,  shooter: false, diveSpeed: 1.0 },
  2: { hp: 2, score: 100, shooter: true,  diveSpeed: 1.0 },
  3: { hp: 1, score: 80,  shooter: false, diveSpeed: 1.45 },
  4: { hp: 3, score: 150, shooter: true,  diveSpeed: 0.9 },
};

// How the game gets harder with level number.
export function difficulty(level) {
  const l = Math.min(level, 14);
  return {
    speed: 1 + (l - 1) * 0.055,
    diveInterval: Math.max(0.65, 2.7 - l * 0.17),
    maxDivers: Math.min(5, 1 + Math.floor(l / 2)),
    bulletSpeed: 68 + l * 5,
    shootChance: Math.min(0.9, 0.12 + l * 0.08), // for non-shooter moths
  };
}
