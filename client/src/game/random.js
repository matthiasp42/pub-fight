import { CHARACTER_TYPES, CHARACTER_CLASSES } from './types.js';
import { getDefaultActions } from './actions.js';
import { BOSS_DEFINITIONS, getBossForLevel } from './bosses.js';

const CHARACTER_CLASS_LIST = ['tank', 'wizard', 'alchemist', 'warrior'];

const PLAYER_NAMES = [
  'Grimjaw',
  'Thornwick',
  'Blazefist',
  'Shadowmere',
  'Ironfang',
  'Stormcaller',
  'Bonecrusher',
  'Nightwhisper',
];

// Default minion names for bosses without specific minion definitions
const DEFAULT_MINION_NAMES = [
  'Rowdy Regular',
  'Drunk Patron',
  'Angry Local',
  'Bar Fly',
  'Tipsy Terry',
];

/**
 * Generate a random ID
 * @returns {string}
 */
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

/**
 * Shuffle an array in place
 * @template T
 * @param {T[]} array
 * @returns {T[]}
 */
function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Generate a random number within a range
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Create a random player character
 * @param {string} [name]
 * @param {string} [characterClass]
 * @returns {import('./types.js').Character}
 */
export function createRandomPlayer(name, characterClass) {
  const id = generateId();
  const playerName = name || PLAYER_NAMES[randomInRange(0, PLAYER_NAMES.length - 1)];
  const playerClass = characterClass || CHARACTER_CLASS_LIST[randomInRange(0, CHARACTER_CLASS_LIST.length - 1)];

  return {
    id,
    name: playerName,
    type: CHARACTER_TYPES.PLAYER,
    class: playerClass,
    level: 1,
    perkPoints: 1, // Start with 1 perk point at level 1
    ownedSkillIds: [],
    attributes: {
      maxHealth: randomInRange(80, 120),
      maxAP: randomInRange(4, 6),
      strength: randomInRange(8, 15),
      shieldCapacity: randomInRange(2, 4),
      shieldStrength: randomInRange(4, 8),
      dexterity: randomInRange(40, 80),
      evasiveness: randomInRange(20, 60),
    },
    state: {
      health: 0, // Will be set to maxHealth
      ap: 0, // Will be set to maxAP
      shield: 0,
      isAlive: true,
    },
    actions: getDefaultActions(CHARACTER_TYPES.PLAYER),
  };
}

/**
 * Create a boss for a specific level using boss definitions
 * @param {number} level - Level 1-7
 * @returns {import('./types.js').Character}
 * @throws {Error} If no boss definition exists for the level
 */
export function createBossForLevel(level) {
  const bossDefinition = getBossForLevel(level);
  if (!bossDefinition) {
    throw new Error(`No boss definition for level ${level}. Valid levels are 1-7.`);
  }

  const id = generateId();

  // Convert abilities to actions
  const actions = bossDefinition.abilities.map((ability) => ({
    id: ability.id,
    name: ability.name,
    cost: ability.cost,
    targetType: ability.targetType,
    hits: ability.hits,
    effects: ability.effects,
    selfEffects: ability.selfEffects,
    special: ability.special,
  }));

  return {
    id,
    name: bossDefinition.name,
    type: CHARACTER_TYPES.BOSS,
    bossId: bossDefinition.id,
    archetype: bossDefinition.archetype,
    level: bossDefinition.level,
    attributes: { ...bossDefinition.attributes },
    state: {
      health: 0,
      ap: 0,
      shield: 0,
      isAlive: true,
    },
    actions,
  };
}

/**
 * Create a random boss (picks a random level 1-7)
 * @deprecated Use createBossForLevel instead for explicit level control
 * @returns {import('./types.js').Character}
 */
export function createRandomBoss() {
  const level = randomInRange(1, 7);
  return createBossForLevel(level);
}

/**
 * Create a minion for a specific boss
 * @param {string} bossId - The boss ID to get the minion definition from
 * @returns {import('./types.js').Character}
 */
export function createMinionForBoss(bossId) {
  const bossDefinition = BOSS_DEFINITIONS.find((b) => b.id === bossId);
  const id = generateId();

  // If boss has a specific minion definition, use it
  if (bossDefinition?.minion) {
    const minionDef = bossDefinition.minion;
    return {
      id,
      name: minionDef.name,
      type: CHARACTER_TYPES.MINION,
      bossId: bossId,
      attributes: { ...minionDef.attributes },
      state: {
        health: 0,
        ap: 0,
        shield: 0,
        isAlive: true,
      },
      actions: getDefaultActions(CHARACTER_TYPES.MINION),
    };
  }

  // Fallback to default minion if boss has no specific minion
  return createRandomMinion();
}

/**
 * Create a random minion (generic, not boss-specific)
 * @param {string} [name]
 * @returns {import('./types.js').Character}
 */
export function createRandomMinion(name) {
  const id = generateId();
  const minionName = name || DEFAULT_MINION_NAMES[randomInRange(0, DEFAULT_MINION_NAMES.length - 1)];

  return {
    id,
    name: minionName,
    type: CHARACTER_TYPES.MINION,
    attributes: {
      maxHealth: randomInRange(30, 60),
      maxAP: randomInRange(2, 3),
      strength: randomInRange(5, 10),
      shieldCapacity: randomInRange(1, 2),
      shieldStrength: randomInRange(3, 5),
      dexterity: randomInRange(30, 50),
      evasiveness: randomInRange(30, 50),
    },
    state: {
      health: 0,
      ap: 0,
      shield: 0,
      isAlive: true,
    },
    actions: getDefaultActions(CHARACTER_TYPES.MINION),
  };
}

/**
 * Initialize a character's state to full health/AP
 * @param {import('./types.js').Character} character
 */
function initializeCharacterState(character) {
  character.state.health = character.attributes.maxHealth;
  character.state.ap = character.attributes.maxAP;
  character.state.shield = 0;
  character.state.isAlive = true;
}

/**
 * Create a fight for a specific level (beginning of fight - all characters at full stats)
 * @param {number} level - Boss level 1-7
 * @param {number} [numPlayers=3] - Number of player characters
 * @param {number} [numMinions=0] - Number of starting minions (0 by default, bosses spawn their own)
 * @returns {import('./types.js').FightState}
 * @throws {Error} If level is not 1-7
 */
export function createFightForLevel(level, numPlayers = 3, numMinions = 0) {
  if (level < 1 || level > 7) {
    throw new Error(`Invalid level ${level}. Valid levels are 1-7.`);
  }

  const players = [];
  const usedPlayerNames = new Set();

  for (let i = 0; i < numPlayers; i++) {
    let player;
    do {
      player = createRandomPlayer();
    } while (usedPlayerNames.has(player.name));
    usedPlayerNames.add(player.name);
    initializeCharacterState(player);
    players.push(player);
  }

  const boss = createBossForLevel(level);
  initializeCharacterState(boss);

  const minions = [];
  for (let i = 0; i < numMinions; i++) {
    const minion = createMinionForBoss(boss.bossId);
    initializeCharacterState(minion);
    minions.push(minion);
  }

  const characters = [...players, boss, ...minions];

  // Randomize turn order
  const turnOrder = shuffle(characters.map((c) => c.id));

  return {
    id: generateId(),
    level,
    characters,
    turnOrder,
    currentTurnIndex: 0,
    isOver: false,
    result: 'ongoing',
  };
}

/**
 * Create a random fight (picks a random level 1-7)
 * @deprecated Use createFightForLevel instead for explicit level control
 * @param {number} [numPlayers=3]
 * @param {number} [numMinions=0]
 * @returns {import('./types.js').FightState}
 */
export function createRandomFight(numPlayers = 3, numMinions = 0) {
  const level = randomInRange(1, 7);
  return createFightForLevel(level, numPlayers, numMinions);
}

/**
 * Create a game state for a specific level (mid-fight - characters have taken some damage)
 * @param {number} level - Boss level 1-7
 * @param {number} [numPlayers=3]
 * @param {number} [numMinions=0]
 * @returns {import('./types.js').FightState}
 */
export function createGameStateForLevel(level, numPlayers = 3, numMinions = 0) {
  const fight = createFightForLevel(level, numPlayers, numMinions);

  // Randomly damage characters and modify their state
  for (const character of fight.characters) {
    // Random health loss (0-60% of max)
    const healthLoss = Math.floor(
      character.attributes.maxHealth * Math.random() * 0.6
    );
    character.state.health = Math.max(1, character.state.health - healthLoss);

    // Random AP usage (0-70% of max)
    const apUsed = Math.floor(character.attributes.maxAP * Math.random() * 0.7);
    character.state.ap = Math.max(0, character.state.ap - apUsed);

    // Random shield (0 to capacity)
    character.state.shield = randomInRange(0, character.attributes.shieldCapacity);

    // Small chance of being dead (10%)
    if (Math.random() < 0.1) {
      character.state.health = 0;
      character.state.isAlive = false;
    }
  }

  // Ensure at least one player and one enemy is alive
  const alivePlayers = fight.characters.filter(
    (c) => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
  );
  if (alivePlayers.length === 0) {
    const player = fight.characters.find(
      (c) => c.type === CHARACTER_TYPES.PLAYER
    );
    player.state.health = Math.floor(player.attributes.maxHealth * 0.3);
    player.state.isAlive = true;
  }

  const aliveEnemies = fight.characters.filter(
    (c) =>
      (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) &&
      c.state.isAlive
  );
  if (aliveEnemies.length === 0) {
    const boss = fight.characters.find((c) => c.type === CHARACTER_TYPES.BOSS);
    boss.state.health = Math.floor(boss.attributes.maxHealth * 0.3);
    boss.state.isAlive = true;
  }

  // Randomize current turn index
  fight.currentTurnIndex = randomInRange(0, fight.turnOrder.length - 1);

  // Make sure the current turn character is alive
  while (
    !fight.characters.find(
      (c) => c.id === fight.turnOrder[fight.currentTurnIndex] && c.state.isAlive
    )
  ) {
    fight.currentTurnIndex =
      (fight.currentTurnIndex + 1) % fight.turnOrder.length;
  }

  return fight;
}

/**
 * Create a random game state (picks a random level 1-7)
 * @deprecated Use createGameStateForLevel instead for explicit level control
 * @param {number} [numPlayers=3]
 * @param {number} [numMinions=0]
 * @returns {import('./types.js').FightState}
 */
export function createRandomGameState(numPlayers = 3, numMinions = 0) {
  const level = randomInRange(1, 7);
  return createGameStateForLevel(level, numPlayers, numMinions);
}
