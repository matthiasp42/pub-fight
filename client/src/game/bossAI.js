/**
 * Boss AI — picks a random affordable action with basic sanity filters.
 * Shared by FightScreen (browser) and simulator (Node).
 *
 * Filters out obviously pointless moves (healing at full HP, shielding
 * at cap, spawning when minion cap reached). If every action is filtered
 * out the boss falls back to the full affordable list so it always acts.
 */

const MAX_MINIONS = 3;

/**
 * Check whether a self-effect would be completely wasted.
 */
function isWastedSelfEffect(effect, actor, state) {
  if (effect.type === 'heal' && !effect.drain) {
    return actor.state.health >= actor.attributes.maxHealth;
  }
  if (effect.type === 'addShield') {
    return actor.state.shield >= actor.attributes.shieldCapacity;
  }
  if (effect.type === 'spawnMinion') {
    const alive = state.characters.filter(
      c => c.type === 'minion' && c.state.isAlive
    ).length;
    return alive >= MAX_MINIONS;
  }
  return false;
}

/**
 * Returns true if the action makes sense given the current fight state.
 */
function isSensible(action, actor, state) {
  const hasTargetDamage = action.effects.some(e => e.type === 'damage');

  // Damage actions are always useful
  if (hasTargetDamage) return true;

  // allEnemies heal (boss heals its team): skip if every ally is full HP
  if (action.targetType === 'allEnemies') {
    const hasHeal = action.effects.some(e => e.type === 'heal');
    if (hasHeal) {
      const allies = state.characters.filter(
        c => (c.type === 'boss' || c.type === 'minion') && c.state.isAlive
      );
      if (allies.every(c => c.state.health >= c.attributes.maxHealth)) {
        return false;
      }
    }
  }

  // Self-targeted with no target damage: skip if every self-effect is wasted
  if (action.targetType === 'self' && action.selfEffects.length > 0) {
    const allWasted = action.selfEffects.every(
      e => isWastedSelfEffect(e, actor, state)
    );
    if (allWasted) return false;
  }

  return true;
}

/**
 * @param {import('./types.js').Character} actor
 * @param {import('./types.js').FightState} state
 * @returns {import('./types.js').Action | null}
 */
export function chooseBossAction(actor, state) {
  const affordable = actor.actions.filter(a => a.cost <= actor.state.ap);
  if (affordable.length === 0) return null;

  // Apply sanity filters if we have state context
  if (state) {
    const sensible = affordable.filter(a => isSensible(a, actor, state));
    if (sensible.length > 0) {
      return sensible[Math.floor(Math.random() * sensible.length)];
    }
  }

  // Fallback: pick from all affordable (boss always acts)
  return affordable[Math.floor(Math.random() * affordable.length)];
}
