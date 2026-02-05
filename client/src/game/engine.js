import { TARGET_TYPES, EFFECT_TYPES, CHARACTER_TYPES } from './types.js';
import { createMinionForBoss } from './random.js';

/**
 * Deep clone a fight state
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').FightState}
 */
export function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

/**
 * Get a character by ID from fight state
 * @param {import('./types.js').FightState} state
 * @param {string} characterId
 * @returns {import('./types.js').Character | undefined}
 */
export function getCharacter(state, characterId) {
  return state.characters.find((c) => c.id === characterId);
}

/**
 * Get the character whose turn it is
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').Character | undefined}
 */
export function getCurrentTurnCharacter(state) {
  const characterId = state.turnOrder[state.currentTurnIndex];
  return getCharacter(state, characterId);
}

/**
 * Get all characters of a specific type
 * @param {import('./types.js').FightState} state
 * @param {string} type
 * @returns {import('./types.js').Character[]}
 */
export function getCharactersByType(state, type) {
  return state.characters.filter((c) => c.type === type && c.state.isAlive);
}

/**
 * Get party members (players)
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').Character[]}
 */
export function getParty(state) {
  return getCharactersByType(state, CHARACTER_TYPES.PLAYER);
}

/**
 * Get enemies (bosses and minions)
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').Character[]}
 */
export function getEnemies(state) {
  return state.characters.filter(
    (c) =>
      (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) &&
      c.state.isAlive
  );
}

/**
 * Spin the attack wheel to determine target
 * @param {import('./types.js').FightState} state
 * @param {import('./types.js').Character} attacker
 * @param {import('./types.js').Character[]} potentialTargets
 * @returns {{ target: import('./types.js').Character | null, roll: number, sectors: object[] }}
 */
export function spinWheel(state, attacker, potentialTargets) {
  // Build wheel sectors based on evasiveness
  // Higher evasiveness = smaller sector
  // Attacker's dexterity determines empty sector size

  const sectors = [];
  let currentAngle = 0;

  // Empty sector (miss) - size based on attacker's dexterity
  // High dexterity (100) = 5% miss, Low dexterity (0) = 40% miss
  const missChance = 0.4 - (attacker.attributes.dexterity / 100) * 0.35;
  const missSectorSize = missChance * 360;

  sectors.push({
    type: 'miss',
    target: null,
    start: currentAngle,
    end: currentAngle + missSectorSize,
  });
  currentAngle += missSectorSize;

  // Distribute remaining angle among targets based on inverse evasiveness
  const remainingAngle = 360 - missSectorSize;

  // Calculate weights (inverse of evasiveness)
  const weights = potentialTargets.map((t) => {
    // High evasiveness (100) = weight 0.1, Low evasiveness (0) = weight 1
    return 1 - (t.attributes.evasiveness / 100) * 0.9;
  });
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  potentialTargets.forEach((target, i) => {
    const sectorSize = (weights[i] / totalWeight) * remainingAngle;
    sectors.push({
      type: 'target',
      target,
      start: currentAngle,
      end: currentAngle + sectorSize,
    });
    currentAngle += sectorSize;
  });

  // Spin!
  const roll = Math.random() * 360;

  // Find which sector the roll landed in
  const hitSector = sectors.find((s) => roll >= s.start && roll < s.end);

  return {
    target: hitSector?.target || null,
    roll,
    sectors,
  };
}

/**
 * Calculate damage after shield absorption
 * @param {import('./types.js').Character} target
 * @param {number} damage
 * @param {boolean} piercing
 * @returns {{ healthDamage: number, shieldAbsorbed: number, shieldPointsDestroyed: number }}
 */
export function calculateDamage(target, damage, piercing = false) {
  if (piercing || target.state.shield === 0) {
    return {
      healthDamage: damage,
      shieldAbsorbed: 0,
      shieldPointsDestroyed: 0,
    };
  }

  const shieldStrength = target.attributes.shieldStrength;
  let remainingDamage = damage;
  let shieldPointsDestroyed = 0;
  let shieldAbsorbed = 0;

  // Each shield point absorbs up to shieldStrength damage
  // Any attack destroys at least 1 shield point
  while (remainingDamage > 0 && target.state.shield - shieldPointsDestroyed > 0) {
    const absorbed = Math.min(shieldStrength, remainingDamage);
    shieldAbsorbed += absorbed;
    remainingDamage -= absorbed;
    shieldPointsDestroyed++;
  }

  // Ensure at least 1 shield is destroyed if we had shields
  if (shieldPointsDestroyed === 0 && target.state.shield > 0) {
    shieldPointsDestroyed = 1;
  }

  return {
    healthDamage: remainingDamage,
    shieldAbsorbed,
    shieldPointsDestroyed,
  };
}

/**
 * Apply a single effect to a character
 * @param {import('./types.js').Character} character
 * @param {import('./types.js').Effect} effect
 * @returns {import('./types.js').EffectResult}
 */
export function applyEffect(character, effect) {
  const result = {
    type: effect.type,
    amount: effect.amount,
    shieldDamageAbsorbed: 0,
    healthDamage: 0,
    shieldPointsDestroyed: 0,
  };

  switch (effect.type) {
    case EFFECT_TYPES.DAMAGE: {
      const damageResult = calculateDamage(
        character,
        effect.amount,
        effect.piercing
      );
      character.state.shield -= damageResult.shieldPointsDestroyed;
      character.state.health -= damageResult.healthDamage;
      character.state.health = Math.max(0, character.state.health);

      if (character.state.health <= 0) {
        character.state.isAlive = false;
      }

      result.shieldDamageAbsorbed = damageResult.shieldAbsorbed;
      result.healthDamage = damageResult.healthDamage;
      result.shieldPointsDestroyed = damageResult.shieldPointsDestroyed;
      break;
    }

    case EFFECT_TYPES.HEAL: {
      const healAmount = Math.min(
        effect.amount,
        character.attributes.maxHealth - character.state.health
      );
      character.state.health += healAmount;
      result.amount = healAmount;
      break;
    }

    case EFFECT_TYPES.ADD_SHIELD: {
      const shieldAmount = Math.min(
        effect.amount,
        character.attributes.shieldCapacity - character.state.shield
      );
      character.state.shield += shieldAmount;
      result.amount = shieldAmount;
      break;
    }

    case EFFECT_TYPES.MODIFY_AP: {
      const newAP = Math.max(
        0,
        Math.min(character.attributes.maxAP, character.state.ap + effect.amount)
      );
      result.amount = newAP - character.state.ap;
      character.state.ap = newAP;
      break;
    }

    case EFFECT_TYPES.REMOVE_SHIELD: {
      const shieldsRemoved = character.state.shield;
      character.state.shield = 0;
      result.amount = shieldsRemoved;
      break;
    }

    case EFFECT_TYPES.SPAWN_MINION: {
      // Minion spawning is handled at the action execution level,
      // not in applyEffect. This is just a placeholder to prevent errors.
      result.amount = effect.minionCount || 1;
      break;
    }
  }

  return result;
}

/**
 * Resolve targets for an action
 * @param {import('./types.js').FightState} state
 * @param {import('./types.js').Character} actor
 * @param {import('./types.js').Action} action
 * @param {string} [manualTargetId] - For manual target selection
 * @returns {{ targets: import('./types.js').Character[], wheelResults: object[] }}
 */
export function resolveTargets(state, actor, action, manualTargetId) {
  const wheelResults = [];

  switch (action.targetType) {
    case TARGET_TYPES.SELF:
      return { targets: [actor], wheelResults: [] };

    case TARGET_TYPES.MANUAL: {
      const target = getCharacter(state, manualTargetId);
      return { targets: target ? [target] : [], wheelResults: [] };
    }

    case TARGET_TYPES.RANDOM: {
      // Determine potential targets (enemies for players, players for enemies)
      const isPlayerAction = actor.type === CHARACTER_TYPES.PLAYER;
      const potentialTargets = isPlayerAction
        ? getEnemies(state)
        : getParty(state);

      const targets = [];
      for (let i = 0; i < action.hits; i++) {
        const result = spinWheel(state, actor, potentialTargets);
        wheelResults.push(result);
        if (result.target) {
          targets.push(result.target);
        }
      }
      return { targets, wheelResults };
    }

    case TARGET_TYPES.ALL_PARTY:
      return { targets: getParty(state), wheelResults: [] };

    case TARGET_TYPES.ALL_ENEMIES:
      return { targets: getEnemies(state), wheelResults: [] };

    default:
      return { targets: [], wheelResults: [] };
  }
}

/**
 * Check if an action can be executed
 * @param {import('./types.js').Character} actor
 * @param {import('./types.js').Action} action
 * @returns {{ canExecute: boolean, reason?: string }}
 */
export function canExecuteAction(actor, action) {
  if (!actor.state.isAlive) {
    return { canExecute: false, reason: 'Character is dead' };
  }

  if (actor.state.ap < action.cost) {
    return { canExecute: false, reason: 'Not enough AP' };
  }

  // Shield action is disabled at max capacity
  if (
    action.id === 'shield' &&
    actor.state.shield >= actor.attributes.shieldCapacity
  ) {
    return { canExecute: false, reason: 'Shield at max capacity' };
  }

  return { canExecute: true };
}

/**
 * Execute an action and return the result
 * @param {import('./types.js').FightState} state
 * @param {string} actorId
 * @param {string} actionId
 * @param {string} [manualTargetId]
 * @returns {{ newState: import('./types.js').FightState, result: import('./types.js').ActionResult }}
 */
export function executeAction(state, actorId, actionId, manualTargetId) {
  const newState = cloneState(state);
  const actor = getCharacter(newState, actorId);
  const action = actor.actions.find((a) => a.id === actionId);

  const result = {
    success: false,
    actorId,
    actionId,
    actionName: action.name,
    apDeducted: 0,
    targetResults: [],
    selfResults: [],
    wheelResults: [],
  };

  // Check if action can be executed
  const check = canExecuteAction(actor, action);
  if (!check.canExecute) {
    result.reason = check.reason;
    return { newState: state, result };
  }

  // 1. Deduct AP cost
  actor.state.ap -= action.cost;
  result.apDeducted = action.cost;

  // 2. Resolve targets
  const { targets, wheelResults } = resolveTargets(
    newState,
    actor,
    action,
    manualTargetId
  );
  result.wheelResults = wheelResults;

  // 3. Apply effects to targets
  for (const target of targets) {
    const targetResult = {
      targetId: target.id,
      targetName: target.name,
      hit: true,
      effects: [],
    };

    for (const effect of action.effects) {
      const effectResult = applyEffect(target, effect);
      targetResult.effects.push(effectResult);
    }

    result.targetResults.push(targetResult);
  }

  // 4. Apply self effects
  // Calculate total damage dealt for drain effects
  let totalDamageDealt = 0;
  for (const targetResult of result.targetResults) {
    for (const effectResult of targetResult.effects) {
      if (effectResult.type === EFFECT_TYPES.DAMAGE) {
        totalDamageDealt += effectResult.healthDamage || 0;
      }
    }
  }

  for (const effect of action.selfEffects) {
    // Handle drain healing - heal equals damage dealt
    if (effect.type === EFFECT_TYPES.HEAL && effect.drain) {
      const drainHealEffect = { ...effect, amount: totalDamageDealt };
      const effectResult = applyEffect(actor, drainHealEffect);
      result.selfResults.push(effectResult);
    }
    // Handle minion spawning
    else if (effect.type === EFFECT_TYPES.SPAWN_MINION) {
      const minionCount = effect.minionCount || 1;
      const spawnedMinions = [];

      for (let i = 0; i < minionCount; i++) {
        const minion = createMinionForBoss(actor.bossId);
        // Initialize minion state
        minion.state.health = minion.attributes.maxHealth;
        minion.state.ap = minion.attributes.maxAP;
        minion.state.shield = 0;
        minion.state.isAlive = true;

        // Add minion to the fight
        newState.characters.push(minion);
        newState.turnOrder.push(minion.id);
        spawnedMinions.push(minion);
      }

      const effectResult = {
        type: EFFECT_TYPES.SPAWN_MINION,
        amount: minionCount,
        spawnedMinions: spawnedMinions.map((m) => ({ id: m.id, name: m.name })),
      };
      result.selfResults.push(effectResult);
    }
    // Normal self effect
    else {
      const effectResult = applyEffect(actor, effect);
      result.selfResults.push(effectResult);
    }
  }

  result.success = true;

  // Check for fight end conditions
  checkFightEnd(newState);

  return { newState, result };
}

/**
 * Check if the fight has ended
 * @param {import('./types.js').FightState} state
 */
export function checkFightEnd(state) {
  const aliveParty = getParty(state).filter((c) => c.state.isAlive);
  const aliveEnemies = getEnemies(state).filter((c) => c.state.isAlive);

  if (aliveParty.length === 0) {
    state.isOver = true;
    state.result = 'defeat';
  } else if (aliveEnemies.length === 0) {
    state.isOver = true;
    state.result = 'victory';
  }
}

/**
 * Advance to the next turn
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').FightState}
 */
export function advanceTurn(state) {
  const newState = cloneState(state);

  // Find next alive character
  let nextIndex = (newState.currentTurnIndex + 1) % newState.turnOrder.length;
  let attempts = 0;

  while (attempts < newState.turnOrder.length) {
    const character = getCharacter(newState, newState.turnOrder[nextIndex]);
    if (character && character.state.isAlive) {
      break;
    }
    nextIndex = (nextIndex + 1) % newState.turnOrder.length;
    attempts++;
  }

  newState.currentTurnIndex = nextIndex;
  return newState;
}
