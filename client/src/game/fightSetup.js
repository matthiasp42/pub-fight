import { CHARACTER_TYPES } from './types.js';
import { getDefaultActions } from './actions.js';
import { getBossById } from './bosses.js';

/**
 * Build fight state from server game state data
 * @param {Record<string, object>} serverPlayers - gameState.players
 * @param {string} dungeonId - The active dungeon ID
 * @param {Array} dungeons - Dungeon definitions from server
 * @returns {import('./types.js').FightState}
 */
export function buildFightFromServer(serverPlayers, dungeonId, dungeons) {
  const dungeon = dungeons.find(d => d.id === dungeonId);
  if (!dungeon) throw new Error(`Dungeon ${dungeonId} not found`);

  const bossDefinition = getBossById(dungeon.bossId);
  if (!bossDefinition) throw new Error(`Boss ${dungeon.bossId} not found`);

  // Build player characters from server data
  const players = Object.values(serverPlayers).map(sp => ({
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
    actions: getDefaultActions(CHARACTER_TYPES.PLAYER),
  }));

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
  };

  const characters = [...players, boss];

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
