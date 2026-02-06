import type { BossDefinition } from '../types/game.js';
export declare const BOSS_DEFINITIONS: BossDefinition[];
/**
 * Get the boss definition for a specific level
 * @param level - Level 1-7
 * @returns The boss definition for that level, or undefined if invalid level
 */
export declare function getBossForLevel(level: number): BossDefinition | undefined;
/**
 * Get a boss definition by ID
 * @param id - The boss ID
 * @returns The boss definition, or undefined if not found
 */
export declare function getBossById(id: string): BossDefinition | undefined;
