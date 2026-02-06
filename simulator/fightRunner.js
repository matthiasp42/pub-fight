/**
 * Headless fight loop — runs a complete fight using the real game engine.
 */

import {
  executeAction,
  advanceTurn,
  getCurrentTurnCharacter,
  cloneState,
} from '../client/src/game/engine.js';
import { CHARACTER_TYPES, EFFECT_TYPES } from '../client/src/game/types.js';
import { createBossForLevel } from '../client/src/game/random.js';
import { chooseBossAction } from '../client/src/game/bossAI.js';
import { choosePlayerAction } from './playerAI.js';
import { createSimPlayer } from './buildGenerator.js';

const MAX_TURNS = 300;

// ---------------------------------------------------------------------------
// Build fight state from build configs
// ---------------------------------------------------------------------------

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

/**
 * Build a fight state from player build configs and a boss level.
 *
 * @param {Array<{className: string, strategyName: string, skillIds: string[], level: number}>} builds
 * @param {number} bossLevel
 * @returns {import('../client/src/game/types.js').FightState}
 */
export function buildFightState(builds, bossLevel) {
  const players = builds.map((b, i) =>
    createSimPlayer(b.className, b.strategyName, b.skillIds, b.level, `Player${i + 1}`)
  );

  const boss = createBossForLevel(bossLevel);
  boss.state.health = boss.attributes.maxHealth;
  boss.state.ap = boss.attributes.maxAP;
  boss.state.shield = 0;
  boss.state.isAlive = true;

  const characters = [...players, boss];
  const turnOrder = shuffle(characters.map(c => c.id));

  return {
    id: generateId(),
    level: bossLevel,
    characters,
    turnOrder,
    currentTurnIndex: 0,
    isOver: false,
    result: 'ongoing',
  };
}

// ---------------------------------------------------------------------------
// Run a single fight
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} FightMetrics
 * @property {'victory'|'defeat'|'timeout'} result
 * @property {number} turns
 * @property {Object<string, number>} playerDamageDealt - playerId -> total damage
 * @property {Object<string, number>} playerDamageTaken - playerId -> total damage taken
 * @property {Object<string, number>} playerHealingDone - playerId -> total healing
 * @property {number} bossHealingDone
 * @property {number} shieldAbsorbed
 * @property {Object<string, number>} actionsUsed - actionId -> count
 * @property {Object<string, boolean>} playerSurvived - playerId -> alive at end
 */

/**
 * Run a single headless fight.
 *
 * @param {Array<{className: string, strategyName: string, skillIds: string[], level: number}>} builds
 * @param {number} bossLevel
 * @param {string} aiStrategy - Player AI strategy name
 * @returns {FightMetrics}
 */
export function runFight(builds, bossLevel, aiStrategy = 'balanced') {
  let state = buildFightState(builds, bossLevel);

  const metrics = {
    result: 'timeout',
    turns: 0,
    playerDamageDealt: {},
    playerDamageTaken: {},
    playerHealingDone: {},
    bossHealingDone: 0,
    shieldAbsorbed: 0,
    actionsUsed: {},
    playerSurvived: {},
  };

  // Init per-player tracking
  for (const c of state.characters) {
    if (c.type === CHARACTER_TYPES.PLAYER) {
      metrics.playerDamageDealt[c.id] = 0;
      metrics.playerDamageTaken[c.id] = 0;
      metrics.playerHealingDone[c.id] = 0;
      metrics.playerSurvived[c.id] = true;
    }
  }

  let turnCount = 0;

  while (!state.isOver && turnCount < MAX_TURNS) {
    const actor = getCurrentTurnCharacter(state);
    if (!actor || !actor.state.isAlive) {
      state = advanceTurn(state);
      turnCount++;
      continue;
    }

    let action = null;
    let manualTargetId = null;

    if (actor.type === CHARACTER_TYPES.PLAYER) {
      const choice = choosePlayerAction(actor, state, aiStrategy);
      action = choice.action;
      manualTargetId = choice.manualTargetId;
    } else {
      action = chooseBossAction(actor);
    }

    if (!action) {
      state = advanceTurn(state);
      turnCount++;
      continue;
    }

    const { newState, result } = executeAction(state, actor.id, action.id, manualTargetId);

    if (result.success) {
      // Track metrics
      metrics.actionsUsed[action.id] = (metrics.actionsUsed[action.id] || 0) + 1;

      // Track target effects
      for (const tr of result.targetResults) {
        for (const er of tr.effects) {
          if (er.type === EFFECT_TYPES.DAMAGE) {
            const dmg = er.healthDamage || 0;
            const shieldAbs = er.shieldDamageAbsorbed || 0;
            metrics.shieldAbsorbed += shieldAbs;

            if (actor.type === CHARACTER_TYPES.PLAYER) {
              metrics.playerDamageDealt[actor.id] = (metrics.playerDamageDealt[actor.id] || 0) + dmg;
            }

            // Track damage taken by players
            if (metrics.playerDamageTaken[tr.targetId] !== undefined) {
              metrics.playerDamageTaken[tr.targetId] += dmg;
            }
          }
          if (er.type === EFFECT_TYPES.HEAL) {
            if (actor.type === CHARACTER_TYPES.PLAYER) {
              metrics.playerHealingDone[actor.id] = (metrics.playerHealingDone[actor.id] || 0) + er.amount;
            }
          }
        }
      }

      // Track self effects
      for (const er of result.selfResults) {
        if (er.type === EFFECT_TYPES.HEAL) {
          if (actor.type === CHARACTER_TYPES.BOSS || actor.type === CHARACTER_TYPES.MINION) {
            metrics.bossHealingDone += er.amount;
          } else {
            metrics.playerHealingDone[actor.id] = (metrics.playerHealingDone[actor.id] || 0) + er.amount;
          }
        }
      }

      state = advanceTurn(newState);
    } else {
      state = advanceTurn(state);
    }

    turnCount++;
  }

  metrics.turns = turnCount;

  if (state.isOver) {
    metrics.result = state.result; // 'victory' or 'defeat'
  }

  // Record survival
  for (const c of state.characters) {
    if (c.type === CHARACTER_TYPES.PLAYER) {
      metrics.playerSurvived[c.id] = c.state.isAlive;
    }
  }

  return metrics;
}

/**
 * Run N fights with the same config and return all metrics.
 */
export function runFights(builds, bossLevel, aiStrategy, runs) {
  const results = [];
  for (let i = 0; i < runs; i++) {
    results.push(runFight(builds, bossLevel, aiStrategy));
  }
  return results;
}
