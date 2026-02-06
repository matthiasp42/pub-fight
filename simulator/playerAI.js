/**
 * Heuristic player AI for headless simulation.
 *
 * Three strategies: aggressive, balanced, defensive.
 * Fully dynamic — reads whatever actions exist on the character.
 */

import { CHARACTER_TYPES, EFFECT_TYPES, TARGET_TYPES } from '../client/src/game/types.js';
import { getEffectiveCost } from '../client/src/game/engine.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAffordableActions(actor) {
  return actor.actions.filter(a => {
    const cost = getEffectiveCost(actor, a);
    if (cost > actor.state.ap) return false;
    // Shield at max capacity is useless
    if (a.id === 'shield' && actor.state.shield >= actor.attributes.shieldCapacity) return false;
    // Once-per-fight used up
    if (a.usesRemaining !== undefined && a.usesRemaining <= 0) return false;
    return true;
  });
}

function isDamageAction(action) {
  return action.effects.some(e => e.type === EFFECT_TYPES.DAMAGE);
}

function isHealAction(action) {
  return action.effects.some(e => e.type === EFFECT_TYPES.HEAL) ||
    action.selfEffects.some(e => e.type === EFFECT_TYPES.HEAL);
}

function isReviveAction(action) {
  return action.effects.some(e => e.type === EFFECT_TYPES.REVIVE);
}

function isShieldAction(action) {
  return action.selfEffects.some(e => e.type === EFFECT_TYPES.ADD_SHIELD) ||
    action.effects.some(e => e.type === EFFECT_TYPES.ADD_SHIELD);
}

function isAPAction(action) {
  return action.effects.some(e => e.type === EFFECT_TYPES.MODIFY_AP && e.amount > 0);
}

function isDebuffAction(action) {
  return action.effects.some(e => e.type === EFFECT_TYPES.MODIFY_ATTRIBUTE && e.amount < 0);
}

function expectedDamage(action) {
  let total = 0;
  for (const e of action.effects) {
    if (e.type === EFFECT_TYPES.DAMAGE) total += e.amount;
  }
  return total * (action.hits || 1);
}

function expectedHeal(action) {
  let total = 0;
  for (const e of [...action.effects, ...action.selfEffects]) {
    if (e.type === EFFECT_TYPES.HEAL && !e.drain) total += e.amount;
  }
  return total;
}

function hpPercent(character) {
  return character.state.health / character.attributes.maxHealth;
}

/** Pick a manual target based on action type */
function pickManualTarget(action, state, actor) {
  // Revive: target dead ally
  if (isReviveAction(action)) {
    const deadAllies = state.characters.filter(
      c => c.type === CHARACTER_TYPES.PLAYER && !c.state.isAlive
    );
    return deadAllies[0]?.id || null;
  }

  // Heal or AP buff: target lowest-HP or lowest-AP ally
  if (isHealAction(action)) {
    const allies = state.characters.filter(
      c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
    );
    allies.sort((a, b) => hpPercent(a) - hpPercent(b));
    return allies[0]?.id || null;
  }

  if (isAPAction(action)) {
    // Give AP to the ally with best damage potential (not self unless alone)
    const allies = state.characters.filter(
      c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive && c.id !== actor.id
    );
    if (allies.length === 0) return actor.id;
    // Prefer allies with low AP who have good skills
    allies.sort((a, b) => a.state.ap - b.state.ap);
    return allies[0]?.id || actor.id;
  }

  if (isDamageAction(action)) {
    // Target the boss preferably, else any alive enemy
    const enemies = state.characters.filter(
      c => (c.type === CHARACTER_TYPES.BOSS || c.type === CHARACTER_TYPES.MINION) && c.state.isAlive
    );
    return enemies.find(e => e.type === CHARACTER_TYPES.BOSS)?.id ||
      enemies[0]?.id || null;
  }

  // Default: target self
  return actor.id;
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

function chooseAggressive(actor, state) {
  const actions = getAffordableActions(actor);
  if (actions.length === 0) return null;

  // Pick highest-damage action
  const damageActions = actions.filter(isDamageAction);
  if (damageActions.length > 0) {
    damageActions.sort((a, b) => expectedDamage(b) - expectedDamage(a));
    return damageActions[0];
  }

  return actions[0];
}

function chooseBalanced(actor, state) {
  const actions = getAffordableActions(actor);
  if (actions.length === 0) return null;

  // Revive dead allies first (high priority)
  const deadAllies = state.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER && !c.state.isAlive
  );
  if (deadAllies.length > 0) {
    const revive = actions.find(isReviveAction);
    if (revive) return revive;
  }

  // Use debuffs early if available (they're limited use, use them)
  const debuffs = actions.filter(isDebuffAction);
  if (debuffs.length > 0) {
    return debuffs[0];
  }

  // Heal if below 30% HP
  if (hpPercent(actor) < 0.3) {
    const heals = actions.filter(isHealAction);
    if (heals.length > 0) {
      heals.sort((a, b) => expectedHeal(b) - expectedHeal(a));
      return heals[0];
    }
  }

  // Heal allies below 30% HP (for support classes)
  const woundedAlly = state.characters.find(
    c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive && hpPercent(c) < 0.3
  );
  if (woundedAlly) {
    const heals = actions.filter(a => isHealAction(a) && a.targetType === TARGET_TYPES.MANUAL);
    if (heals.length > 0) {
      heals.sort((a, b) => expectedHeal(b) - expectedHeal(a));
      return heals[0];
    }
  }

  // Use best damage skill if available (not basic attack)
  const skills = actions.filter(a => isDamageAction(a) && a.id !== 'attack');
  if (skills.length > 0) {
    skills.sort((a, b) => expectedDamage(b) - expectedDamage(a));
    return skills[0];
  }

  // Basic attack
  const attack = actions.find(a => a.id === 'attack');
  if (attack) return attack;

  return actions[0];
}

function chooseDefensive(actor, state) {
  const actions = getAffordableActions(actor);
  if (actions.length === 0) return null;

  // Revive dead allies first
  const deadAllies = state.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER && !c.state.isAlive
  );
  if (deadAllies.length > 0) {
    const revive = actions.find(isReviveAction);
    if (revive) return revive;
  }

  // Shield first if not at capacity
  if (actor.state.shield < actor.attributes.shieldCapacity) {
    const shields = actions.filter(isShieldAction);
    if (shields.length > 0) return shields[0];
  }

  // Heal allies below 50%
  const allies = state.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
  );
  const woundedAlly = allies.find(a => hpPercent(a) < 0.5);
  if (woundedAlly) {
    const heals = actions.filter(isHealAction);
    if (heals.length > 0) {
      heals.sort((a, b) => expectedHeal(b) - expectedHeal(a));
      return heals[0];
    }
  }

  // Attack when safe
  const damageActions = actions.filter(isDamageAction);
  if (damageActions.length > 0) {
    damageActions.sort((a, b) => expectedDamage(b) - expectedDamage(a));
    return damageActions[0];
  }

  return actions[0];
}

const STRATEGIES = {
  aggressive: chooseAggressive,
  balanced: chooseBalanced,
  defensive: chooseDefensive,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Choose an action for a player character.
 *
 * @param {object} actor - The acting character
 * @param {object} state - Full fight state
 * @param {string} strategyName - 'aggressive' | 'balanced' | 'defensive'
 * @returns {{ action: object|null, manualTargetId: string|null }}
 */
export function choosePlayerAction(actor, state, strategyName = 'balanced') {
  const chooser = STRATEGIES[strategyName] || STRATEGIES.balanced;
  const action = chooser(actor, state);
  if (!action) return { action: null, manualTargetId: null };

  let manualTargetId = null;
  if (action.targetType === TARGET_TYPES.MANUAL) {
    manualTargetId = pickManualTarget(action, state, actor);
  }

  return { action, manualTargetId };
}

export function getStrategyNames() {
  return Object.keys(STRATEGIES);
}
