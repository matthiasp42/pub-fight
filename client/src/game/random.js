import { CHARACTER_TYPES, CHARACTER_CLASSES } from './types.js';
import { getDefaultActions } from './actions.js';

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

const BOSS_NAMES = [
  'Grug the Barkeep',
  'Mad Molly',
  'The Publican',
  'Dartboard Dave',
  'Pickled Pete',
];

const MINION_NAMES = [
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
 * Create a random boss
 * @param {string} [name]
 * @returns {import('./types.js').Character}
 */
export function createRandomBoss(name) {
  const id = generateId();
  const bossName = name || BOSS_NAMES[randomInRange(0, BOSS_NAMES.length - 1)];

  return {
    id,
    name: bossName,
    type: CHARACTER_TYPES.BOSS,
    attributes: {
      maxHealth: randomInRange(150, 250),
      maxAP: randomInRange(3, 5),
      strength: randomInRange(10, 18),
      shieldCapacity: randomInRange(3, 5),
      shieldStrength: randomInRange(6, 10),
      dexterity: randomInRange(50, 70),
      evasiveness: randomInRange(10, 30),
    },
    state: {
      health: 0,
      ap: 0,
      shield: 0,
      isAlive: true,
    },
    actions: getDefaultActions(CHARACTER_TYPES.BOSS),
  };
}

/**
 * Create a random minion
 * @param {string} [name]
 * @returns {import('./types.js').Character}
 */
export function createRandomMinion(name) {
  const id = generateId();
  const minionName = name || MINION_NAMES[randomInRange(0, MINION_NAMES.length - 1)];

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
 * Create a random fight (beginning of fight - all characters at full stats)
 * @param {number} [numPlayers=3]
 * @param {number} [numMinions=2]
 * @returns {import('./types.js').FightState}
 */
export function createRandomFight(numPlayers = 3, numMinions = 2) {
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

  const boss = createRandomBoss();
  initializeCharacterState(boss);

  const minions = [];
  for (let i = 0; i < numMinions; i++) {
    const minion = createRandomMinion();
    initializeCharacterState(minion);
    minions.push(minion);
  }

  const characters = [...players, boss, ...minions];

  // Randomize turn order
  const turnOrder = shuffle(characters.map((c) => c.id));

  return {
    id: generateId(),
    characters,
    turnOrder,
    currentTurnIndex: 0,
    isOver: false,
    result: 'ongoing',
  };
}

/**
 * Create a random game state (mid-fight - characters have taken some damage)
 * @param {number} [numPlayers=3]
 * @param {number} [numMinions=2]
 * @returns {import('./types.js').FightState}
 */
export function createRandomGameState(numPlayers = 3, numMinions = 2) {
  const fight = createRandomFight(numPlayers, numMinions);

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
