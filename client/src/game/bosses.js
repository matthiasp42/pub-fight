/**
 * Boss definitions for Pub Fight
 * Thin wrapper over shared/bosses.json — resolves minionId references.
 */

import bossData from '../../../shared/bosses.json' with { type: 'json' };

// Resolve minionId references into inline minion objects
const BOSSES = bossData.bosses.map((boss) => {
  const resolved = { ...boss };
  if (boss.minionId) {
    resolved.minion = bossData.minions[boss.minionId];
    delete resolved.minionId;
  }
  return resolved;
});

/**
 * All boss definitions in order by level
 * @type {import('./types.js').BossDefinition[]}
 */
export const BOSS_DEFINITIONS = BOSSES;

/**
 * Get the boss definition for a specific level
 * @param {number} level - Level 1-7
 * @returns {import('./types.js').BossDefinition | undefined}
 */
export function getBossForLevel(level) {
  return BOSS_DEFINITIONS.find((boss) => boss.level === level);
}

/**
 * Get a boss definition by ID
 * @param {string} id - The boss ID
 * @returns {import('./types.js').BossDefinition | undefined}
 */
export function getBossById(id) {
  return BOSS_DEFINITIONS.find((boss) => boss.id === id);
}
