/**
 * Helper functions for skill tree management
 */

/**
 * Check if a skill can be unlocked
 * @param {import('./types').SkillNode} skill
 * @param {number} level - Character's current level
 * @param {string[]} ownedSkillIds - IDs of skills already owned
 * @returns {boolean}
 */
export function canUnlockSkill(skill, level, ownedSkillIds) {
  // Already owned
  if (ownedSkillIds.includes(skill.id)) {
    return false;
  }

  // Level requirement not met
  if (level < skill.levelRequired) {
    return false;
  }

  // Prerequisite not met
  if (skill.requires && !ownedSkillIds.includes(skill.requires)) {
    return false;
  }

  return true;
}

/**
 * Get available skills that can be unlocked right now
 * @param {import('./types').SkillNode[]} allSkills
 * @param {string} characterClass
 * @param {number} level
 * @param {string[]} ownedSkillIds
 * @returns {import('./types').SkillNode[]}
 */
export function getAvailableSkills(allSkills, characterClass, level, ownedSkillIds) {
  return allSkills
    .filter((skill) => skill.class === characterClass)
    .filter((skill) => canUnlockSkill(skill, level, ownedSkillIds));
}

/**
 * Get skill status for UI display
 * @param {import('./types').SkillNode} skill
 * @param {number} level
 * @param {string[]} ownedSkillIds
 * @returns {'owned' | 'available' | 'locked'}
 */
export function getSkillStatus(skill, level, ownedSkillIds) {
  if (ownedSkillIds.includes(skill.id)) {
    return 'owned';
  }
  if (canUnlockSkill(skill, level, ownedSkillIds)) {
    return 'available';
  }
  return 'locked';
}

/**
 * Get skills organized by level for tree display
 * @param {import('./types').SkillNode[]} allSkills
 * @param {string} characterClass
 * @returns {Record<number, import('./types').SkillNode[]>}
 */
export function getSkillsByLevel(allSkills, characterClass) {
  const classSkills = allSkills.filter((skill) => skill.class === characterClass);
  const byLevel = { 1: [], 3: [], 5: [], 7: [] };

  classSkills.forEach((skill) => {
    if (byLevel[skill.levelRequired]) {
      byLevel[skill.levelRequired].push(skill);
    }
  });

  return byLevel;
}

/**
 * Convert a skill node's ability data to an Action for the game engine
 * @param {import('./types').SkillNode} skill
 * @returns {import('./types').Action | null}
 */
export function skillToAction(skill) {
  if (skill.type !== 'ability' || !skill.ability) {
    return null;
  }

  return {
    id: skill.id,
    name: skill.name,
    cost: skill.ability.cost,
    targetType: skill.ability.targetType,
    hits: skill.ability.hits,
    effects: skill.ability.effects,
    selfEffects: skill.ability.selfEffects,
  };
}

/**
 * Get all abilities for a character based on owned skills
 * @param {import('./types').SkillNode[]} allSkills
 * @param {string} characterClass
 * @param {string[]} ownedSkillIds
 * @returns {import('./types').Action[]}
 */
export function getAbilitiesForCharacter(allSkills, characterClass, ownedSkillIds) {
  return allSkills
    .filter((skill) => skill.class === characterClass)
    .filter((skill) => ownedSkillIds.includes(skill.id))
    .filter((skill) => skill.type === 'ability')
    .map(skillToAction)
    .filter(Boolean);
}

/**
 * Get all passive effects for a character based on owned skills
 * @param {import('./types').SkillNode[]} allSkills
 * @param {string} characterClass
 * @param {string[]} ownedSkillIds
 * @returns {import('./types').SkillNode[]}
 */
export function getPassivesForCharacter(allSkills, characterClass, ownedSkillIds) {
  return allSkills
    .filter((skill) => skill.class === characterClass)
    .filter((skill) => ownedSkillIds.includes(skill.id))
    .filter((skill) => skill.type === 'passive');
}
