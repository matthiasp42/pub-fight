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
// All boss definitions in order
export const BOSS_DEFINITIONS = BOSSES;
/**
 * Get the boss definition for a specific level
 * @param level - Level 1-7
 * @returns The boss definition for that level, or undefined if invalid level
 */
export function getBossForLevel(level) {
    return BOSS_DEFINITIONS.find((boss) => boss.level === level);
}
/**
 * Get a boss definition by ID
 * @param id - The boss ID
 * @returns The boss definition, or undefined if not found
 */
export function getBossById(id) {
    return BOSS_DEFINITIONS.find((boss) => boss.id === id);
}
