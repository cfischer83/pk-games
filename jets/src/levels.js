// =============================================================================
// JETS — level definitions
// =============================================================================
// Built to scale to more levels later: the game engine takes a level index and
// reads everything it needs from one of these descriptors. Add objects to the
// LEVELS array to introduce new sectors (different pacing, density, theming).
// =============================================================================

import { GAME, enemyInterval } from './config.js';

/**
 * @typedef {Object} LevelDef
 * @property {number} id
 * @property {string} name
 * @property {number} duration            seconds to survive to clear the level
 * @property {(t:number)=>number} forwardSpeed   world units/sec at normalized time t (0..1)
 * @property {(t:number)=>number} enemyInterval  seconds between enemy spawns at time t
 * @property {(t:number)=>number} obstacleDensity 0..1 chance weighting for obstacle slots at time t
 * @property {number} maxEnemies          soft cap on concurrent enemies
 * @property {boolean} hills              include green hills among obstacles
 */

/** @type {LevelDef[]} */
export const LEVELS = [
  {
    id: 1,
    name: 'NEON CITY',
    duration: GAME.LEVEL_DURATION,
    forwardSpeed: (t) => GAME.FORWARD_SPEED * (1 + (GAME.FORWARD_RAMP - 1) * t),
    enemyInterval,
    // Per-lot fill chance for the city grid. Start fairly open, thicken the
    // skyline through the middle, ease slightly at the very end.
    obstacleDensity: (t) => 0.45 + 0.30 * Math.min(1, t * 1.15) - 0.12 * Math.max(0, t - 0.85) / 0.15,
    maxEnemies: 6,
    hills: true,
  },
];

/** Safe accessor: clamps the index into range and returns a level descriptor. */
export function getLevel(index) {
  const i = Math.max(0, Math.min(LEVELS.length - 1, index | 0));
  return LEVELS[i];
}
