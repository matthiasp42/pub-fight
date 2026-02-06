/**
 * Boss AI — picks a random affordable action for a boss/minion actor.
 * Shared by FightScreen (browser) and simulator (Node).
 *
 * @param {import('./types.js').Character} actor
 * @returns {import('./types.js').Action | null}
 */
export function chooseBossAction(actor) {
  const affordable = actor.actions.filter(a => a.cost <= actor.state.ap);
  if (affordable.length === 0) return null;
  return affordable[Math.floor(Math.random() * affordable.length)];
}
