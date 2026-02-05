import { TARGET_TYPES, EFFECT_TYPES } from './types.js';

/**
 * Common actions available to all characters
 */
export const COMMON_ACTIONS = {
  attack: {
    id: 'attack',
    name: 'Attack',
    cost: 1,
    targetType: TARGET_TYPES.RANDOM,
    hits: 1,
    effects: [{ type: EFFECT_TYPES.DAMAGE, amount: 10 }],
    selfEffects: [],
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    cost: 1,
    targetType: TARGET_TYPES.SELF,
    hits: 1,
    effects: [],
    selfEffects: [{ type: EFFECT_TYPES.ADD_SHIELD, amount: 1 }],
  },
  rest: {
    id: 'rest',
    name: 'Rest',
    cost: 0,
    targetType: TARGET_TYPES.SELF,
    hits: 1,
    effects: [],
    selfEffects: [{ type: EFFECT_TYPES.MODIFY_AP, amount: 2 }],
  },
};

/**
 * Get default actions for a character type
 * @param {string} characterType
 * @returns {import('./types.js').Action[]}
 */
export function getDefaultActions(characterType) {
  // For now, all characters get attack and shield
  return [COMMON_ACTIONS.attack, COMMON_ACTIONS.shield];
}

/**
 * Get all actions for a character including class abilities from server
 * @param {import('./types.js').Character} character
 * @param {import('./types.js').SkillNode[]} serverSkills - Skills fetched from server
 * @param {string[]} ownedSkillIds - IDs of skills the character has unlocked
 * @returns {import('./types.js').Action[]}
 */
export function getActionsForCharacter(character, serverSkills, ownedSkillIds) {
  // Start with common actions (rest is always available)
  const actions = [COMMON_ACTIONS.attack, COMMON_ACTIONS.shield, COMMON_ACTIONS.rest];

  // If no class, just return common actions
  if (!character.class || !serverSkills || !ownedSkillIds) {
    return actions;
  }

  // Add unlocked class abilities
  const classAbilities = serverSkills
    .filter((skill) => skill.class === character.class)
    .filter((skill) => ownedSkillIds.includes(skill.id))
    .filter((skill) => skill.type === 'ability' && skill.ability)
    .map((skill) => ({
      id: skill.id,
      name: skill.name,
      cost: skill.ability.cost,
      targetType: skill.ability.targetType,
      hits: skill.ability.hits,
      effects: skill.ability.effects,
      selfEffects: skill.ability.selfEffects,
    }));

  return [...actions, ...classAbilities];
}
