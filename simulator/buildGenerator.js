/**
 * Dynamic build generator — reads live class/skill data, generates all
 * meaningful build combinations for simulation.
 *
 * Zero hardcoded skill names or class lists.
 */

import classData from '../shared/classes.json' with { type: 'json' };
import { ALL_SKILLS, SKILLS_BY_CLASS } from '../server/dist/skills/index.js';

const CLASS_BASE_ATTRIBUTES = classData.default || classData;
import { getActionsForCharacter } from '../client/src/game/actions.js';
import { CHARACTER_TYPES } from '../client/src/game/types.js';

// ---------------------------------------------------------------------------
// Attribute strategies — weight maps for distributing attribute points.
// Keys are attribute names; values are relative weights. Any attribute
// not listed gets weight 0 (except in "balanced" which spreads evenly).
// ---------------------------------------------------------------------------

const ATTRIBUTE_STRATEGIES = {
  balanced: null, // special: spread evenly across all attributes
  glass_cannon: { maxAP: 3, dexterity: 2 },
  tanky: { maxHealth: 3, shieldCapacity: 2, shieldStrength: 1 },
  evasive: { evasiveness: 3, dexterity: 2 },
  ap_heavy: { maxAP: 5 },
};

/**
 * Distribute `points` attribute points across the attributes in `base`
 * according to a named strategy.
 *
 * Returns a new attributes object (base values + added points).
 */
export function distributeAttributes(baseAttributes, points, strategyName) {
  const attrs = { ...baseAttributes };
  const keys = Object.keys(attrs);

  if (points <= 0) return attrs;

  const strategy = ATTRIBUTE_STRATEGIES[strategyName];

  if (!strategy) {
    // balanced: round-robin across all attributes
    let i = 0;
    for (let p = 0; p < points; p++) {
      attrs[keys[i % keys.length]] += 1;
      i++;
    }
    return attrs;
  }

  // Weighted distribution
  const weightedKeys = Object.keys(strategy).filter(k => k in attrs);
  const totalWeight = weightedKeys.reduce((s, k) => s + strategy[k], 0);

  if (totalWeight === 0 || weightedKeys.length === 0) {
    // fallback to balanced
    return distributeAttributes(baseAttributes, points, 'balanced');
  }

  // Distribute proportionally, round-robin remainder
  let remaining = points;
  const allocated = {};
  for (const k of weightedKeys) {
    const share = Math.floor(points * (strategy[k] / totalWeight));
    allocated[k] = share;
    remaining -= share;
  }
  // Distribute remainder to highest-weight keys
  const sorted = [...weightedKeys].sort((a, b) => strategy[b] - strategy[a]);
  for (let i = 0; remaining > 0; i++, remaining--) {
    allocated[sorted[i % sorted.length]] += 1;
  }

  for (const [k, v] of Object.entries(allocated)) {
    attrs[k] += v;
  }

  return attrs;
}

// ---------------------------------------------------------------------------
// Skill combo generation
// ---------------------------------------------------------------------------

/**
 * Get all valid skill selections for a class at a given level, spending
 * exactly `perkPoints` perk points. Each skill costs 1 perk point.
 *
 * Respects `levelRequired` and `requires` (prerequisite) chains.
 *
 * Returns arrays of skill ID sets: string[][]
 */
export function generateSkillCombos(className, level, perkPoints) {
  const classSkills = SKILLS_BY_CLASS[className] || [];
  const available = classSkills.filter(s => s.levelRequired <= level);

  if (perkPoints <= 0 || available.length === 0) return [[]];

  // Build prerequisite map: skillId -> prerequisite skillId
  const prereqMap = {};
  for (const s of available) {
    if (s.requires) prereqMap[s.id] = s.requires;
  }

  // Check if a set of selected IDs satisfies all prerequisites
  function prereqsSatisfied(selectedSet, skillId) {
    let current = skillId;
    while (prereqMap[current]) {
      if (!selectedSet.has(prereqMap[current])) return false;
      current = prereqMap[current];
    }
    return true;
  }

  // Generate combos via backtracking
  const results = [];
  const ids = available.map(s => s.id);

  function backtrack(startIdx, selected) {
    if (selected.length === perkPoints) {
      results.push([...selected]);
      return;
    }
    if (selected.length > perkPoints) return;

    const selectedSet = new Set(selected);
    for (let i = startIdx; i < ids.length; i++) {
      if (prereqsSatisfied(selectedSet, ids[i])) {
        selected.push(ids[i]);
        backtrack(i + 1, selected);
        selected.pop();
      }
    }
  }

  backtrack(0, []);

  // If no valid combos spend all points (e.g. not enough skills), include
  // partial spends too — find the max achievable
  if (results.length === 0) {
    let maxLen = 0;
    const partial = [];
    function backtrackPartial(startIdx, selected) {
      if (selected.length > perkPoints) return;
      if (selected.length > maxLen) maxLen = selected.length;
      if (selected.length === maxLen && selected.length > 0) {
        partial.push([...selected]);
      }

      const selectedSet = new Set(selected);
      for (let i = startIdx; i < ids.length; i++) {
        if (prereqsSatisfied(selectedSet, ids[i])) {
          selected.push(ids[i]);
          backtrackPartial(i + 1, selected);
          selected.pop();
        }
      }
    }
    backtrackPartial(0, []);

    // Deduplicate by keeping only combos at max length
    const best = partial.filter(c => c.length === maxLen);
    return best.length > 0 ? best : [[]];
  }

  return results;
}

// ---------------------------------------------------------------------------
// Build creation
// ---------------------------------------------------------------------------

/**
 * Create a player character for simulation.
 *
 * @param {string} className - e.g. 'warrior'
 * @param {string} strategyName - attribute strategy key
 * @param {string[]} skillIds - owned skill IDs
 * @param {number} level - character level
 * @param {string} [name] - optional name
 * @returns {object} Character ready for fight state
 */
export function createSimPlayer(className, strategyName, skillIds, level, name) {
  const base = CLASS_BASE_ATTRIBUTES[className];
  if (!base) throw new Error(`Unknown class: ${className}`);

  const attrPoints = (level - 1) * 2;
  const attributes = distributeAttributes({ ...base }, attrPoints, strategyName);

  const character = {
    id: `sim_${className}_${Math.random().toString(36).slice(2, 8)}`,
    name: name || `${className.charAt(0).toUpperCase() + className.slice(1)}`,
    type: CHARACTER_TYPES.PLAYER,
    class: className,
    level,
    perkPoints: 0,
    ownedSkillIds: skillIds,
    attributes,
    state: {
      health: attributes.maxHealth,
      ap: attributes.maxAP,
      shield: 0,
      isAlive: true,
    },
    actions: [],
    passives: [],
  };

  // Use the real game function to convert skills to actions
  character.actions = getActionsForCharacter(character, ALL_SKILLS, skillIds);

  // Populate passives from owned skills
  for (const skillId of skillIds) {
    const skill = ALL_SKILLS.find(s => s.id === skillId);
    if (skill && skill.type === 'passive' && skill.passive) {
      character.passives.push({
        skillId: skill.id,
        name: skill.name,
        trigger: skill.passive.trigger,
        effect: { ...skill.passive.effect },
      });
    }
  }

  // Apply "always" passives that modify stats
  for (const passive of character.passives) {
    if (passive.trigger !== 'always') continue;
    switch (passive.effect.type) {
      case 'modifyShieldCapacity':
        character.attributes.shieldCapacity += passive.effect.amount;
        // Titan's Resolve also grants +1 shield strength
        if (passive.skillId === 'titans_resolve') {
          character.attributes.shieldStrength += 1;
        }
        break;
      case 'modifyShieldStrength':
        character.attributes.shieldStrength += passive.effect.amount;
        break;
      case 'modifyMaxAP':
        character.attributes.maxAP += passive.effect.amount;
        character.state.ap = character.attributes.maxAP;
        character.state.health = character.attributes.maxHealth;
        break;
      case 'provoke':
        character.attributes.evasiveness += passive.effect.amount;
        break;
      case 'precision':
        // Make basic Attack target manually
        for (const action of character.actions) {
          if (action.id === 'attack') {
            action.targetType = 'manual';
          }
        }
        break;
    }
  }

  // Initialize once-per-fight ability tracking
  for (const action of character.actions) {
    const skill = ALL_SKILLS.find(s => s.id === action.id);
    if (skill && skill.ability && skill.ability.maxUses) {
      action.maxUses = skill.ability.maxUses;
      action.usesRemaining = skill.ability.maxUses;
    }
  }

  return character;
}

// ---------------------------------------------------------------------------
// Enumerate all builds
// ---------------------------------------------------------------------------

/**
 * @returns {string[]} All class names from live data
 */
export function getClassNames() {
  return Object.keys(CLASS_BASE_ATTRIBUTES);
}

/**
 * @returns {string[]} All attribute strategy names
 */
export function getStrategyNames() {
  return Object.keys(ATTRIBUTE_STRATEGIES);
}

/**
 * Generate all build configs for a given class at a given level.
 *
 * Returns: { className, strategyName, skillIds, level }[]
 */
export function generateBuildsForClass(className, level) {
  const perkPoints = level; // level 1 = 1 perk point, level N = N perk points
  const skillCombos = generateSkillCombos(className, level, perkPoints);
  const strategies = getStrategyNames();

  const builds = [];
  for (const strat of strategies) {
    for (const skills of skillCombos) {
      builds.push({
        className,
        strategyName: strat,
        skillIds: skills,
        level,
      });
    }
  }
  return builds;
}

/**
 * Generate all build configs across all classes for a given level.
 */
export function generateAllBuilds(level) {
  const classes = getClassNames();
  const builds = [];
  for (const cls of classes) {
    builds.push(...generateBuildsForClass(cls, level));
  }
  return builds;
}

/**
 * Describe a build in a short human-readable string.
 */
export function describeBuild(build) {
  const skills = build.skillIds.length > 0 ? build.skillIds.join('+') : 'none';
  return `${build.className}/${build.strategyName} [${skills}]`;
}
