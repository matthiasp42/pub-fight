import { TARGET_TYPES, EFFECT_TYPES, CHARACTER_TYPES } from './types.js';
import { createMinionForBoss } from './random.js';

// Max minions alive at once per boss
const MAX_MINIONS = 3;

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
  const sectors = [];
  let currentAngle = 0;

  // Empty sector (miss) - size based on attacker's dexterity
  // High dexterity (100) = 5% miss, Low dexterity (0) = 40% miss
  const missChance = 0.4 - (attacker.attributes.dexterity / 100) * 0.35;
  const missSectorSize = Math.max(0, missChance * 360);

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
  // Negative evasiveness (from Provoke) gives weight > 1.0 = bigger target
  const weights = potentialTargets.map((t) => {
    return Math.max(0.05, 1 - (t.attributes.evasiveness / 100) * 0.9);
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
  while (remainingDamage > 0 && target.state.shield - shieldPointsDestroyed > 0) {
    const absorbed = Math.min(shieldStrength, remainingDamage);
    shieldAbsorbed += absorbed;
    remainingDamage -= absorbed;
    shieldPointsDestroyed++;
  }

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
 * Get the effective AP cost of an action considering passives
 * @param {import('./types.js').Character} actor
 * @param {import('./types.js').Action} action
 * @returns {number}
 */
export function getEffectiveCost(actor, action) {
  let cost = action.cost;

  // Arcane Mastery: all abilities cost 1 less AP (min 1)
  if (actor.passives && action.id !== 'attack' && action.id !== 'shield' && action.id !== 'rest') {
    for (const passive of actor.passives) {
      if (passive.trigger === 'always' && passive.effect.type === 'modifyAbilityCost') {
        cost = Math.max(1, cost + passive.effect.amount);
      }
    }
  }

  return cost;
}

/**
 * Apply a single effect to a character
 * @param {import('./types.js').Character} character
 * @param {import('./types.js').Effect} effect
 * @param {import('./types.js').Character} [attacker] - The character applying the effect (for power bonus)
 * @returns {import('./types.js').EffectResult}
 */
export function applyEffect(character, effect, attacker) {
  const result = {
    type: effect.type,
    amount: effect.amount,
    shieldDamageAbsorbed: 0,
    healthDamage: 0,
    shieldPointsDestroyed: 0,
  };

  switch (effect.type) {
    case EFFECT_TYPES.DAMAGE: {
      let totalDamage = effect.amount;

      // Add attacker's power to damage
      if (attacker && attacker.attributes.power) {
        totalDamage += attacker.attributes.power;
      }

      // Glass Cannon: +1 damage on all abilities (attacker has it)
      if (attacker && attacker.passives) {
        for (const passive of attacker.passives) {
          if (passive.trigger === 'always' && passive.effect.type === 'glassCannon') {
            totalDamage += passive.effect.amount;
          }
        }
      }

      // Apply passive damage reduction from target (Iron Skin)
      if (character.passives) {
        for (const passive of character.passives) {
          if (passive.trigger === 'always' && passive.effect.type === 'damageReduction') {
            totalDamage = Math.max(0, totalDamage - passive.effect.amount);
          }
        }
      }

      // Glass Cannon: +1 damage taken (target has it)
      if (character.passives) {
        for (const passive of character.passives) {
          if (passive.trigger === 'always' && passive.effect.type === 'glassCannon') {
            totalDamage += passive.effect.amount;
          }
        }
      }

      totalDamage = Math.max(0, totalDamage);

      const damageResult = calculateDamage(
        character,
        totalDamage,
        effect.piercing
      );
      character.state.shield -= damageResult.shieldPointsDestroyed;
      character.state.health -= damageResult.healthDamage;
      character.state.health = Math.max(0, character.state.health);

      // Check for onFatalDamage passives before marking dead
      if (character.state.health <= 0 && character.passives) {
        const undying = character.passives.find(
          p => p.trigger === 'onFatalDamage' && p.effect.type === 'surviveFatal' && !p.used
        );
        if (undying) {
          character.state.health = 1;
          undying.used = true;
        } else {
          character.state.isAlive = false;
        }
      } else if (character.state.health <= 0) {
        character.state.isAlive = false;
      }

      result.amount = totalDamage;
      result.shieldDamageAbsorbed = damageResult.shieldAbsorbed;
      result.healthDamage = damageResult.healthDamage;
      result.shieldPointsDestroyed = damageResult.shieldPointsDestroyed;
      break;
    }

    case EFFECT_TYPES.HEAL: {
      let healAmount = effect.amount;

      // Brew Mastery: heals +N extra
      if (attacker && attacker.passives) {
        for (const passive of attacker.passives) {
          if (passive.trigger === 'always' && passive.effect.type === 'healBonus') {
            healAmount += passive.effect.amount;
          }
        }
      }

      healAmount = Math.min(
        healAmount,
        character.attributes.maxHealth - character.state.health
      );
      character.state.health += healAmount;
      result.amount = healAmount;
      break;
    }

    case EFFECT_TYPES.ADD_SHIELD: {
      let shieldAmount = effect.amount;

      // Last Stand: shield gains doubled below 25% HP
      if (character.passives) {
        const hpPct = (character.state.health / character.attributes.maxHealth) * 100;
        for (const passive of character.passives) {
          if (passive.trigger === 'always' && passive.effect.type === 'modifyShieldGain' && passive.effect.condition?.hpBelow) {
            if (hpPct < passive.effect.condition.hpBelow) {
              shieldAmount *= passive.effect.amount;
            }
          }
        }
      }

      shieldAmount = Math.min(
        shieldAmount,
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
      // Handled at the action execution level
      result.amount = effect.minionCount || 1;
      break;
    }

    case EFFECT_TYPES.REVIVE: {
      // Revive a dead character: set alive, then heal to amount
      if (!character.state.isAlive) {
        character.state.isAlive = true;
        character.state.health = Math.min(effect.amount, character.attributes.maxHealth);
        character.state.ap = 0;
        result.amount = character.state.health;
      } else {
        // Already alive — treat as heal
        const healAmt = Math.min(
          effect.amount,
          character.attributes.maxHealth - character.state.health
        );
        character.state.health += healAmt;
        result.amount = healAmt;
      }
      break;
    }

    case EFFECT_TYPES.MODIFY_ATTRIBUTE: {
      // Directly modify a target's attribute (e.g., dexterity, evasiveness, power)
      const attr = effect.attribute;
      if (attr && attr in character.attributes) {
        character.attributes[attr] += effect.amount;
        // Don't let power go below 0
        if (attr === 'power') {
          character.attributes[attr] = Math.max(0, character.attributes[attr]);
        }
      }
      result.amount = effect.amount;
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

  const cost = getEffectiveCost(actor, action);
  if (actor.state.ap < cost) {
    return { canExecute: false, reason: 'Not enough AP' };
  }

  // Shield action is disabled at max capacity
  if (
    action.id === 'shield' &&
    actor.state.shield >= actor.attributes.shieldCapacity
  ) {
    return { canExecute: false, reason: 'Shield at max capacity' };
  }

  // Once-per-fight abilities
  if (action.usesRemaining !== undefined && action.usesRemaining <= 0) {
    return { canExecute: false, reason: 'No uses remaining this fight' };
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

  // 1. Deduct effective AP cost
  const cost = getEffectiveCost(actor, action);
  actor.state.ap -= cost;
  result.apDeducted = cost;

  // Track once-per-fight usage
  if (action.usesRemaining !== undefined) {
    action.usesRemaining--;
  }

  // 2. Resolve targets
  const { targets, wheelResults } = resolveTargets(
    newState,
    actor,
    action,
    manualTargetId
  );
  result.wheelResults = wheelResults;

  // 3. Apply effects to targets (pass actor for power bonus)
  for (const target of targets) {
    const targetResult = {
      targetId: target.id,
      targetName: target.name,
      hit: true,
      effects: [],
    };

    for (const effect of action.effects) {
      const effectResult = applyEffect(target, effect, actor);
      targetResult.effects.push(effectResult);

      // Check onTakeDamage passives (reflect damage, desperation shield)
      if (effect.type === EFFECT_TYPES.DAMAGE && target.passives && target.state.isAlive) {
        for (const passive of target.passives) {
          if (passive.trigger !== 'onTakeDamage') continue;

          if (passive.effect.type === 'reflectDamage') {
            const reflectDmg = passive.effect.amount;
            actor.state.health = Math.max(0, actor.state.health - reflectDmg);
            if (actor.state.health <= 0) {
              actor.state.isAlive = false;
            }
          }

          if (passive.effect.type === 'gainShield' && passive.effect.condition?.hpBelow) {
            const hpPct = (target.state.health / target.attributes.maxHealth) * 100;
            if (hpPct < passive.effect.condition.hpBelow) {
              const shieldGain = Math.min(
                passive.effect.amount,
                target.attributes.shieldCapacity - target.state.shield
              );
              target.state.shield += shieldGain;
            }
          }
        }
      }

      // Check onKill passives
      if (effect.type === EFFECT_TYPES.DAMAGE && !target.state.isAlive && actor.passives) {
        for (const passive of actor.passives) {
          if (passive.trigger === 'onKill' && passive.effect.type === 'restoreAP') {
            actor.state.ap = Math.min(
              actor.attributes.maxAP,
              actor.state.ap + passive.effect.amount
            );
          }
        }
      }
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
    // Handle drain healing
    if (effect.type === EFFECT_TYPES.HEAL && effect.drain) {
      const drainHealEffect = { ...effect, amount: totalDamageDealt };
      const effectResult = applyEffect(actor, drainHealEffect, actor);
      result.selfResults.push(effectResult);
    }
    // Handle minion spawning (with cap)
    else if (effect.type === EFFECT_TYPES.SPAWN_MINION) {
      const currentMinions = newState.characters.filter(
        c => c.type === CHARACTER_TYPES.MINION && c.state.isAlive
      ).length;
      const maxToSpawn = Math.max(0, MAX_MINIONS - currentMinions);
      const minionCount = Math.min(effect.minionCount || 1, maxToSpawn);
      const spawnedMinions = [];

      for (let i = 0; i < minionCount; i++) {
        const minion = createMinionForBoss(actor.bossId);
        minion.state.health = minion.attributes.maxHealth;
        minion.state.ap = minion.attributes.maxAP;
        minion.state.shield = 0;
        minion.state.isAlive = true;

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
      const effectResult = applyEffect(actor, effect, actor);
      result.selfResults.push(effectResult);
    }
  }

  // 5. Second Wind: if this was a Rest action, heal the actor
  if (actionId === 'rest' && actor.passives) {
    for (const passive of actor.passives) {
      if (passive.trigger === 'always' && passive.effect.type === 'secondWind') {
        const healAmt = Math.min(
          passive.effect.amount,
          actor.attributes.maxHealth - actor.state.health
        );
        actor.state.health += healAmt;
      }
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

  // Bosses and minions get AP refill each turn (players must manage AP via Rest)
  const nextCharacter = getCharacter(newState, newState.turnOrder[nextIndex]);
  if (nextCharacter && nextCharacter.state.isAlive &&
      (nextCharacter.type === CHARACTER_TYPES.BOSS || nextCharacter.type === CHARACTER_TYPES.MINION)) {
    nextCharacter.state.ap = nextCharacter.attributes.maxAP;
  }

  return newState;
}
