import { TARGET_TYPES, EFFECT_TYPES } from './types.js';
import { getBossById } from './bosses.js';

/**
 * Common actions available to all characters
 */
export const COMMON_ACTIONS = {
  attack: {
    id: 'attack',
    name: 'Attack',
    description: 'Strike a random enemy for 1 damage.',
    cost: 1,
    targetType: TARGET_TYPES.RANDOM,
    hits: 1,
    effects: [{ type: EFFECT_TYPES.DAMAGE, amount: 1 }],
    selfEffects: [],
  },
  shield: {
    id: 'shield',
    name: 'Shield',
    description: 'Raise your guard, gaining 1 shield point.',
    cost: 1,
    targetType: TARGET_TYPES.SELF,
    hits: 1,
    effects: [],
    selfEffects: [{ type: EFFECT_TYPES.ADD_SHIELD, amount: 1 }],
  },
  rest: {
    id: 'rest',
    name: 'Rest',
    description: 'Recover 2 AP and heal 20% HP.',
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
  return [{ ...COMMON_ACTIONS.attack }, { ...COMMON_ACTIONS.shield }, { ...COMMON_ACTIONS.rest }];
}

/**
 * Get all actions for a character including class abilities from server
 * @param {import('./types.js').Character} character
 * @param {import('./types.js').SkillNode[]} serverSkills - Skills fetched from server
 * @param {string[]} ownedSkillIds - IDs of skills the character has unlocked
 * @returns {import('./types.js').Action[]}
 */
export function getActionsForCharacter(character, serverSkills, ownedSkillIds) {
  const actions = [{ ...COMMON_ACTIONS.attack }, { ...COMMON_ACTIONS.shield }, { ...COMMON_ACTIONS.rest }];

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
      description: skill.description,
      cost: skill.ability.cost,
      targetType: skill.ability.targetType,
      hits: skill.ability.hits,
      effects: skill.ability.effects,
      selfEffects: skill.ability.selfEffects,
    }));

  return [...actions, ...classAbilities];
}

/**
 * Get actions for a boss by their boss ID
 * @param {string} bossId - The boss definition ID (e.g., 'molly_the_matron')
 * @returns {import('./types.js').Action[]}
 */
export function getBossActions(bossId) {
  const bossDefinition = getBossById(bossId);
  if (!bossDefinition) {
    // Fallback to default actions if boss not found
    return getDefaultActions('boss');
  }

  return bossDefinition.abilities.map((ability) => ({
    id: ability.id,
    name: ability.name,
    cost: ability.cost,
    targetType: ability.targetType,
    hits: ability.hits,
    effects: ability.effects,
    selfEffects: ability.selfEffects,
    special: ability.special,
  }));
}
