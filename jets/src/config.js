// =============================================================================
// JETS — shared configuration / single source of truth
// =============================================================================
// Coordinate conventions (IMPORTANT — every module agrees on this):
//   +X  = FORWARD  (direction of travel; the world scrolls toward -X under the
//                   player, the player's worldX increases over time)
//   +Y  = UP       (altitude; ground plane is at y = 0)
//   +Z  = RIGHT    (player's strafe-right; -Z is strafe-left)
// Player jet model faces +X (nose points forward).
// Enemy jet model faces -X (nose points back toward the oncoming player).
// =============================================================================

// ---- World scale -----------------------------------------------------------
// 1 unit is small. A city block road is ~ROAD_SPACING wide. The player jet has
// a wingspan of ~7 units. Buildings: footprint 8-22 u, height 8-46 u.
export const SCALE = {
  UNIT: 1,
  PLAYER_WINGSPAN: 7,
  GROUND_WIDTH: 220,      // visible width of the ground band (along Z)
  TILE_DEPTH: 40,         // length (along X) of one streamed ground tile
};

// ---- Vibrant Zaxxon-inspired palette (hex numbers for three.js) ------------
// Bright, saturated, high-contrast. Read by meshes.js + effects.
export const PALETTE = {
  // environment
  sky:          0x0b0b2e,   // deep indigo background
  skyHorizon:   0x241a5c,   // purple horizon glow
  ground:       0x6464aa,   // night ground base (light enough to read shadows)
  groundEdge:   0x262665,
  road:         0x2f7fe0,   // bright blue roads (signature Zaxxon look)
  roadDark:     0x1f57a8,
  roadLine:     0xffd23f,   // yellow dashed center line
  roadEdge:     0x5fb0ff,   // glowing road edge
  grid:         0x3344aa,   // faint grid glow on ground

  // player jet (white/silver F-16 with red + blue accents)
  jetBody:      0xffff00,	// 0xe9eef5 originally
  jetBodyDark:  0xb7c2d0,
  jetAccent:    0xff3b3b,   // red stripes / tail
  jetCockpit:   0x49b6ff,   // blue canopy
  jetEngine:    0xff8a3d,   // afterburner glow
  jetIntake:    0x2a3140,

  // enemy jet (hostile crimson/orange)
  enemyBody:    0xff4d33,
  enemyBodyDark:0xb02414,
  enemyAccent:  0x2a2a33,
  enemyCockpit: 0xffd23f,
  enemyEngine:  0xff7a3d,   // enemy exhaust glow

  // buildings
  buildingA:    0xbc8d57,   // steel gray
  buildingB:    0x5d6b86,   // bluish gray
  buildingC:    0x8a6f9e,   // muted purple tower
  buildingD:    0x4a8c8c,   // teal block
  buildingTop:  0x39394f,   // dark roof
  windowLit:    0x6fe9ff,   // bright cyan lit window
  windowLit2:   0xffe27a,   // warm lit window
  windowDark:   0x24304a,   // unlit window

  // hills / terrain obstacles
  hill:         0x2f7d4f,   // green hill
  hillDark:     0x1d5436,
  treeTrunk:    0x6b4a2b,   // brown trunk
  treeLeaf:     0x2f9e44,   // foliage
  treeLeaf2:    0x3fbf57,   // lighter foliage

  // projectiles
  playerBullet: 0xff0000,   // red
  playerBulletCore: 0xffffff,
  enemyBullet:  0x9dff4d,   // bright green laser (reads as enemy)
  enemyBulletCore: 0xeaffd0,

  // effects
  explosionHot: 0xfff8c0,   // white-hot core
  explosionMid: 0xffae3f,   // orange
  explosionLow: 0xff5320,   // red-orange
  smoke:        0x3a3a4a,
  shadow:       0x000000,

  // bomb
  bomb:         0xffd23f,
  bombFlash:    0xffffff,
};

// CSS-facing color strings (HUD / menu accents). Mirrors retro convention.
export const CSS = {
  hudYellow:  '#ffd23f',
  hudGreen:   '#5dff5d',
  hudRed:     '#ff3b3b',
  hudBlue:    '#49b6ff',
  hudCyan:    '#6fe9ff',
  bg:         '#0b0b2e',
};

// ---- Camera / projection (orthographic, fixed-angle Zaxxon view) -----------
// The camera does NOT rotate during play. It sits behind/above/right of the
// player target and looks at it. World +X (forward) projects up-and-right on
// screen; +Y (altitude) projects up; +Z (strafe-right) projects right-and-down.
export const CAMERA = {
  // Offset from the look target to the camera position (world units).
  // Tunable: this vector defines the iso angle. Behind (-X), high (+Y), right (+Z).
  OFFSET:      { x: -150, y: 165, z: 120 },
  // Look slightly ahead of the player so more level is visible up-screen, and so
  // the player sits in the lower-left third (classic Zaxxon framing).
  LOOK_AHEAD:  { x: 32, y: 6, z: 0 },
  // Orthographic vertical half-size in world units (controls zoom). Width derives
  // from aspect ratio. Smaller = more zoomed in. At 46, the ~10u jet reads at
  // ~7% of viewport height and the strafe box fits a 16:9 frame.
  ORTHO_HALF_HEIGHT: 46,
  NEAR: 1,
  FAR:  1200,
  // Camera follow stiffness for Y/Z easing (per-second; used as 1-exp(-k*dt)).
  FOLLOW_LERP: 12,
  // Camera only partially follows strafe/altitude so the player can move within
  // the frame (Captain Skyhawk style). 1 = locked to player, 0 = fully free box.
  FOLLOW_STRAFE: 0.35,
  FOLLOW_ALT:    0.25,
};

// ---- Gameplay tuning -------------------------------------------------------
export const GAME = {
  LEVEL_DURATION: 90,        // seconds of survival to win level 1
  FORWARD_SPEED: 50,         // world units/sec the player advances (level scroll)
  FORWARD_RAMP: 1.12,        // forward speed multiplier reached by level end

  PLAYER_MAX_HITS: 3,        // 3 hits then dead
  PLAYER_INVULN_TIME: 1.6,   // seconds of i-frames after a hit
  STRAFE_SPEED: 58,          // units/sec horizontal (Z)
  CLIMB_SPEED:  46,          // units/sec vertical (Y)
  STRAFE_ACCEL: 9,           // responsiveness (higher = snappier)
  // movement box (relative to camera frame; X handled by auto-advance)
  Z_MIN: -78, Z_MAX: 78,
  Y_MIN: 7,   Y_MAX: 72,     // Y_MIN>0 => cannot crash into the ground
  MAX_BANK:  0.62,           // radians of roll at full strafe
  MAX_PITCH: 0.34,           // radians of pitch at full climb

  // player weapon
  BULLET_SPEED: 165,         // slower, readable tracers
  FIRE_INTERVAL: 0.22,       // lower cyclic rate when holding fire
  BULLET_LIFETIME: 2.2,
  BULLET_DAMAGE: 1,
  // Forgiving bullet-vs-enemy hit tolerances (added to the enemy radius). The
  // bullet travels along +X, so the "aim" axes are lateral (Z) and altitude (Y);
  // a generous vertical window means you don't need a pixel-perfect altitude.
  BULLET_HIT_LATERAL: 4.5,   // extra Z tolerance
  BULLET_HIT_VERTICAL: 19.0,  // extra Y tolerance (the big one for hittability)
  BULLET_HIT_FORWARD: 3.0,   // extra X tolerance along travel

  // bombs (now a projectile that arcs forward and lands before detonating)
  BOMBS_PER_LEVEL: 3,
  BOMB_RADIUS: 115,          // clears enemies/enemy-bullets within this radius (XZ)
  BOMB_LAUNCH_VX: 130,       // initial forward speed of the lobbed bomb
  BOMB_LAUNCH_VY: 14,        // initial upward kick (then gravity pulls it down)
  BOMB_GRAVITY: 150,         // strong gravity so it lands within the fuse from any altitude
  BOMB_MAX_FUSE: 1.2,        // hard cap before it detonates regardless

  // enemies
  ENEMY_HP: 1,
  ENEMY_SPEED_REL: 16,       // closing speed relative to scroll (they approach)
  ENEMY_FIRE_MIN: 1.4,       // seconds between an enemy's shots (randomized)
  ENEMY_FIRE_MAX: 3.0,
  ENEMY_BULLET_SPEED: 120,
  ENEMY_BULLET_LIFETIME: 3.2,
  ENEMY_BANK: 0.5,
  ENEMY_ALT_MIN: 18,         // narrower altitude band so they're reachable
  ENEMY_ALT_MAX: 56,

  // spawn distance ahead of player (just beyond view) for streamed objects
  SPAWN_AHEAD: 360,
  DESPAWN_BEHIND: 120,
};

// ---- Level 1 spawn pacing (difficulty curve over 90s) ----------------------
// t is normalized 0..1 across the level. Returns spawn interval (s) for enemies.
export function enemyInterval(t) {
  // start sparse, thicken through the middle, never get too dense (level 1).
  const base = 3.2 - 1.7 * Math.min(1, t * 1.15);
  return Math.max(1.05, base);
}

// ---- Audio synthesis recipes (consumed by audio.js) ------------------------
// All sound is synthesized (no audio files). These are loose targets; the
// audio engine may refine envelopes. Kept here so balance lives in one place.
export const AUDIO = {
  MASTER_GAIN: 0.55,
  MUSIC_GAIN: 0.32,
  SFX_GAIN: 0.5,
  MUSIC_BPM: 132,
  MAX_SFX_VOICES: 14,        // cap concurrent SFX voices to avoid clipping
  STORAGE_KEY_MUSIC: 'jets.musicEnabled',
  STORAGE_KEY_SFX: 'jets.sfxEnabled',
};

// ---- localStorage keys -----------------------------------------------------
export const STORE = {
  MUSIC: 'jets.musicEnabled',
  SFX:   'jets.sfxEnabled',
  BEST:  'jets.bestTime',
};
