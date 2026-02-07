import { CHARACTER_TYPES } from './types.js';
import { getActionsForCharacter } from './actions.js';
import { getBossById } from './bosses.js';

/**
 * Populate passives array on a character from their owned skills
 * @param {object} character - The character to populate passives on
 * @param {Array} serverSkills - All skills from server
 */
function populatePassives(character, serverSkills) {
  character.passives = [];
  if (!character.ownedSkillIds || !serverSkills) return;

  for (const skillId of character.ownedSkillIds) {
    const skill = serverSkills.find(s => s.id === skillId);
    if (skill && skill.type === 'passive' && skill.passive) {
      character.passives.push({
        skillId: skill.id,
        name: skill.name,
        trigger: skill.passive.trigger,
        effect: { ...skill.passive.effect },
      });
    }
  }
}

/**
 * Apply "always" passives at fight start (stat modifications)
 * @param {object} character
 */
function applyAlwaysPassives(character) {
  if (!character.passives) return;

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
        break;
      case 'provoke':
        // Reduce own evasiveness (makes you a bigger target on the wheel)
        character.attributes.evasiveness += passive.effect.amount;
        break;
      case 'precision':
        // Make basic Attack target manually instead of randomly
        for (const action of character.actions) {
          if (action.id === 'attack') {
            action.targetType = 'manual';
          }
        }
        break;
      // damageReduction, modifyShieldGain, modifyAbilityCost, modifyDamage,
      // glassCannon, healBonus, secondWind are checked dynamically during combat
    }
  }
}

/**
 * Initialize once-per-fight ability tracking on actions
 * @param {object} character
 * @param {Array} serverSkills
 */
function initializeActionUses(character, serverSkills) {
  if (!serverSkills) return;

  for (const action of character.actions) {
    // Find matching skill definition to check for maxUses
    const skill = serverSkills.find(s => s.id === action.id);
    if (skill && skill.ability && skill.ability.maxUses) {
      action.maxUses = skill.ability.maxUses;
      action.usesRemaining = skill.ability.maxUses;
    }
  }
}

/**
 * Apply "onFightStart" passives
 * @param {object[]} characters - All fight characters
 */
function applyOnFightStartPassives(characters) {
  const players = characters.filter(c => c.type === CHARACTER_TYPES.PLAYER);

  for (const character of players) {
    if (!character.passives) continue;

    for (const passive of character.passives) {
      if (passive.trigger !== 'onFightStart') continue;

      switch (passive.effect.type) {
        case 'restoreAP':
          // Philosopher's Stone: all party +1 AP on first turn
          for (const ally of players) {
            ally.state.ap = Math.min(
              ally.attributes.maxAP,
              ally.state.ap + passive.effect.amount
            );
          }
          break;
        case 'modifyMaxAP':
          character.attributes.maxAP += passive.effect.amount;
          character.state.ap = character.attributes.maxAP;
          break;
      }
    }
  }
}

/**
 * Build fight state from server game state data
 * @param {Record<string, object>} serverPlayers - gameState.players
 * @param {string} dungeonId - The active dungeon ID
 * @param {Array} dungeons - Dungeon definitions from server
 * @param {Array} [serverSkills] - All skill definitions from server
 * @returns {import('./types.js').FightState}
 */
export function buildFightFromServer(serverPlayers, dungeonId, dungeons, serverSkills) {
  const dungeon = dungeons.find(d => d.id === dungeonId);
  if (!dungeon) throw new Error(`Dungeon ${dungeonId} not found`);

  const bossDefinition = getBossById(dungeon.bossId);
  if (!bossDefinition) throw new Error(`Boss ${dungeon.bossId} not found`);
  if (!serverSkills) throw new Error('Server skills not loaded');

  // Build player characters from server data
  const players = Object.values(serverPlayers).map(sp => {
    const char = {
      id: sp.id,
      name: sp.name,
      type: CHARACTER_TYPES.PLAYER,
      class: sp.class,
      level: sp.level,
      perkPoints: sp.perkPoints,
      ownedSkillIds: sp.ownedSkillIds || [],
      attributes: { ...sp.attributes },
      state: {
        health: sp.attributes.maxHealth,
        ap: sp.attributes.maxAP,
        shield: 0,
        isAlive: true,
      },
      actions: getActionsForCharacter({ class: sp.class }, serverSkills, sp.ownedSkillIds || []),
      passives: [],
    };

    // Populate passives from owned skills
    if (serverSkills) {
      populatePassives(char, serverSkills);
    }

    return char;
  });

  // Build boss character
  const bossId = generateId();
  const bossActions = bossDefinition.abilities.map(ability => ({
    id: ability.id,
    name: ability.name,
    cost: ability.cost,
    targetType: ability.targetType,
    hits: ability.hits,
    effects: ability.effects,
    selfEffects: ability.selfEffects,
    special: ability.special,
  }));

  const boss = {
    id: bossId,
    name: bossDefinition.name,
    type: CHARACTER_TYPES.BOSS,
    bossId: bossDefinition.id,
    archetype: bossDefinition.archetype,
    level: bossDefinition.level,
    attributes: { ...bossDefinition.attributes },
    state: {
      health: bossDefinition.attributes.maxHealth,
      ap: bossDefinition.attributes.maxAP,
      shield: 0,
      isAlive: true,
    },
    actions: bossActions,
    passives: [],
  };

  // Scale boss HP by player count (balanced around 4 players)
  const hpScale = Math.max(0.5, players.length / 4);
  boss.attributes.maxHealth = Math.round(boss.attributes.maxHealth * hpScale);
  boss.state.health = boss.attributes.maxHealth;

  const characters = [...players, boss];

  // Apply always passives (stat mods like Titan's Resolve, Provoke, Precision)
  for (const char of characters) {
    applyAlwaysPassives(char);
  }

  // Initialize once-per-fight ability tracking
  if (serverSkills) {
    for (const char of characters) {
      initializeActionUses(char, serverSkills);
    }
  }

  // Apply onFightStart passives (like Philosopher's Stone)
  applyOnFightStartPassives(characters);

  // Shuffle turn order
  const turnOrder = shuffle(characters.map(c => c.id));

  return {
    id: generateId(),
    level: dungeon.level,
    characters,
    turnOrder,
    currentTurnIndex: 0,
    isOver: false,
    result: 'ongoing',
    actionLog: [],
  };
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
