import type { BossDefinition } from '../types/game.js';
import bossData from '../../../shared/bosses.json' with { type: 'json' };

// Resolve minionId references into inline minion objects
const BOSSES: BossDefinition[] = bossData.bosses.map((boss) => {
  const resolved: any = { ...boss };
  if (boss.minionId) {
    resolved.minion = (bossData.minions as any)[boss.minionId];
    delete resolved.minionId;
  }
  return resolved as BossDefinition;
});

// All boss definitions in order
export const BOSS_DEFINITIONS: BossDefinition[] = BOSSES;

/**
 * Get the boss definition for a specific level
 * @param level - Level 1-7
 * @returns The boss definition for that level, or undefined if invalid level
 */
export function getBossForLevel(level: number): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((boss) => boss.level === level);
}

/**
 * Get a boss definition by ID
 * @param id - The boss ID
 * @returns The boss definition, or undefined if not found
 */
export function getBossById(id: string): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((boss) => boss.id === id);
}
