import type { CharacterClass, CharacterAttributes } from '../types/game.js';
import classData from '../../../shared/classes.json' with { type: 'json' };

export const CLASS_BASE_ATTRIBUTES: Record<CharacterClass, CharacterAttributes> =
  classData as Record<CharacterClass, CharacterAttributes>;
