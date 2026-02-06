/**
 * Core game types for Pub Fight
 *
 * @typedef {'player' | 'boss' | 'minion'} CharacterType
 * @typedef {'self' | 'manual' | 'random' | 'allParty' | 'allEnemies'} TargetType
 * @typedef {'damage' | 'heal' | 'addShield' | 'modifyAP' | 'spawnMinion' | 'removeShield' | 'revive' | 'modifyAttribute'} EffectType
 * @typedef {'swarmMaster' | 'executioner' | 'devastator' | 'tankBuster' | 'tempoManipulator' | 'regenerator' | 'hybridNightmare'} BossArchetype
 */

/**
 * @typedef {Object} Effect
 * @property {EffectType} type
 * @property {number} amount
 * @property {boolean} [piercing] - Only for damage effects
 * @property {boolean} [drain] - For heal effects: heal equals damage dealt
 * @property {number} [minionCount] - For spawnMinion effects: number of minions to spawn
 * @property {string} [attribute] - For modifyAttribute effects: which attribute to change
 */

/**
 * @typedef {Object} Action
 * @property {string} id
 * @property {string} name
 * @property {number} cost - AP cost
 * @property {TargetType} targetType
 * @property {number} hits - Number of wheel spins for 'random' (default 1)
 * @property {Effect[]} effects - Applied to resolved targets
 * @property {Effect[]} selfEffects - Applied to actor
 */

/**
 * @typedef {Object} CharacterAttributes
 * @property {number} maxHealth
 * @property {number} maxAP
 * @property {number} power
 * @property {number} shieldCapacity
 * @property {number} shieldStrength
 * @property {number} dexterity - 0-100, higher = more accurate
 * @property {number} evasiveness - 0-100, higher = harder to hit
 */

/**
 * @typedef {Object} CharacterState
 * @property {number} health
 * @property {number} ap
 * @property {number} shield
 * @property {boolean} isAlive
 */

/**
 * @typedef {Object} Character
 * @property {string} id
 * @property {string} name
 * @property {CharacterType} type
 * @property {CharacterClass} [class] - Character class (players only)
 * @property {number} [level] - Character level 1-7 (players only)
 * @property {number} [perkPoints] - Available perk points (players only)
 * @property {string[]} [ownedSkillIds] - IDs of unlocked skills (players only)
 * @property {string} [bossId] - Boss definition ID (bosses and their minions only)
 * @property {BossArchetype} [archetype] - Boss archetype (bosses only)
 * @property {CharacterAttributes} attributes
 * @property {CharacterState} state
 * @property {Action[]} actions
 */

/**
 * @typedef {Object} FightState
 * @property {string} id
 * @property {number} [level] - Boss level 1-7
 * @property {Character[]} characters
 * @property {string[]} turnOrder - Character IDs in turn order
 * @property {number} currentTurnIndex
 * @property {boolean} isOver
 * @property {'ongoing' | 'victory' | 'defeat'} result
 */

/**
 * @typedef {Object} ActionResult
 * @property {boolean} success
 * @property {string} actorId
 * @property {string} actionId
 * @property {number} apDeducted
 * @property {TargetResult[]} targetResults
 * @property {EffectResult[]} selfResults
 */

/**
 * @typedef {Object} TargetResult
 * @property {string} targetId
 * @property {boolean} hit - false if wheel missed
 * @property {EffectResult[]} effects
 */

/**
 * @typedef {Object} EffectResult
 * @property {EffectType} type
 * @property {number} amount - The actual amount applied
 * @property {number} shieldDamageAbsorbed - For damage effects
 * @property {number} healthDamage - For damage effects
 * @property {number} shieldPointsDestroyed - For damage effects
 */

/**
 * @typedef {Object} GameLogEntry
 * @property {number} timestamp
 * @property {string} type - 'action' | 'turn_start' | 'fight_start' | 'fight_end'
 * @property {FightState} stateBefore
 * @property {FightState} stateAfter
 * @property {ActionResult} [actionResult]
 * @property {string} description
 */

export const TARGET_TYPES = {
  SELF: 'self',
  MANUAL: 'manual',
  RANDOM: 'random',
  ALL_PARTY: 'allParty',
  ALL_ENEMIES: 'allEnemies',
};

export const EFFECT_TYPES = {
  DAMAGE: 'damage',
  HEAL: 'heal',
  ADD_SHIELD: 'addShield',
  MODIFY_AP: 'modifyAP',
  SPAWN_MINION: 'spawnMinion',
  REMOVE_SHIELD: 'removeShield',
  REVIVE: 'revive',
  MODIFY_ATTRIBUTE: 'modifyAttribute',
};

export const CHARACTER_TYPES = {
  PLAYER: 'player',
  BOSS: 'boss',
  MINION: 'minion',
};

/**
 * @typedef {'tank' | 'alchemist' | 'wizard' | 'warrior'} CharacterClass
 */

/**
 * @typedef {'always' | 'onHit' | 'onTakeDamage' | 'onLowHP' | 'onTurnStart' | 'onKill' | 'onFightStart' | 'onFatalDamage'} PassiveTrigger
 */

/**
 * @typedef {'damageReduction' | 'reflectDamage' | 'modifyShieldGain' | 'modifyDamage' | 'restoreAP' | 'modifyAbilityCost' | 'modifyMaxAP' | 'modifyShieldCapacity' | 'modifyShieldStrength' | 'surviveFatal' | 'precision' | 'provoke' | 'glassCannon' | 'healBonus' | 'secondWind' | 'gainShield'} PassiveEffectType
 */

/**
 * @typedef {Object} PassiveEffect
 * @property {PassiveEffectType} type
 * @property {number} [amount]
 * @property {{hpBelow?: number}} [condition]
 */

/**
 * @typedef {Object} AbilityData
 * @property {number} cost
 * @property {TargetType} targetType
 * @property {number} hits
 * @property {Effect[]} effects
 * @property {Effect[]} selfEffects
 */

/**
 * @typedef {Object} PassiveData
 * @property {PassiveTrigger} trigger
 * @property {PassiveEffect} effect
 */

/**
 * @typedef {Object} SkillNode
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {CharacterClass} class
 * @property {number} levelRequired - 1, 3, 5, or 7
 * @property {string} [requires] - ID of prerequisite skill
 * @property {'ability' | 'passive'} type
 * @property {AbilityData} [ability]
 * @property {PassiveData} [passive]
 */

export const CHARACTER_CLASSES = {
  TANK: 'tank',
  WIZARD: 'wizard',
  ALCHEMIST: 'alchemist',
  WARRIOR: 'warrior',
};

/**
 * @typedef {Object} BossAbility
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {TargetType} targetType
 * @property {number} hits
 * @property {Effect[]} effects
 * @property {Effect[]} selfEffects
 * @property {'spawnMinion' | 'spawnMinion2' | 'requiresMark'} [special]
 */

/**
 * @typedef {Object} MinionDefinition
 * @property {string} name
 * @property {CharacterAttributes} attributes
 */

/**
 * @typedef {Object} BossDefinition
 * @property {string} id
 * @property {string} name
 * @property {number} level
 * @property {BossArchetype} archetype
 * @property {CharacterAttributes} attributes
 * @property {BossAbility[]} abilities
 * @property {MinionDefinition} [minion]
 */

export const BOSS_ARCHETYPES = {
  SWARM_MASTER: 'swarmMaster',
  EXECUTIONER: 'executioner',
  DEVASTATOR: 'devastator',
  TANK_BUSTER: 'tankBuster',
  TEMPO_MANIPULATOR: 'tempoManipulator',
  REGENERATOR: 'regenerator',
  HYBRID_NIGHTMARE: 'hybridNightmare',
};
