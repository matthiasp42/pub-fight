#!/usr/bin/env node

/**
 * Auto-Tuner — Binary searches optimal boss HP, then reports fight quality
 * and skill balance metrics.
 *
 * Phase 1: Binary search HP per boss to hit target win rates
 * Phase 2: Analyze fight quality (survivors, duration, one-shots)
 * Phase 3: Skill impact analysis (OP/dead skills)
 *
 * Usage:
 *   node simulator/autoTune.js
 *   node simulator/autoTune.js --runs 500           # runs per iteration (default 500)
 *   node simulator/autoTune.js --tolerance 2         # HP convergence (default 2)
 *   node simulator/autoTune.js --hp-min 8 --hp-max 120
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { BOSS_DEFINITIONS } from '../client/src/game/bosses.js';
import { CLASS_BASE_ATTRIBUTES } from '../server/dist/classes/index.js';
import {
  generateBuildsForClass,
  getClassNames,
  getStrategyNames,
} from './buildGenerator.js';
import { buildFightState } from './fightRunner.js';

// ---------------------------------------------------------------------------
// Engine imports (used by workers and main thread for fight execution)
// ---------------------------------------------------------------------------

import {
  executeAction,
  advanceTurn,
  getCurrentTurnCharacter,
} from '../client/src/game/engine.js';
import { CHARACTER_TYPES, EFFECT_TYPES } from '../client/src/game/types.js';
import { chooseBossAction } from '../client/src/game/bossAI.js';
import { choosePlayerAction } from './playerAI.js';

const MAX_TURNS = 300;

// ---------------------------------------------------------------------------
// Fight runner with full metrics tracking
// ---------------------------------------------------------------------------

function runFightFromState(state, aiStrategy = 'balanced') {
  let turnCount = 0;
  let roundCount = 0;
  const playerCount = state.characters.filter(c => c.type === CHARACTER_TYPES.PLAYER).length;
  const turnsPerRound = state.turnOrder.length;
  let maxSingleHit = 0;
  let maxSingleHitAbility = '';
  const playerDamageDealt = {};
  const playerDamageTaken = {};

  for (const c of state.characters) {
    if (c.type === CHARACTER_TYPES.PLAYER) {
      playerDamageDealt[c.id] = 0;
      playerDamageTaken[c.id] = 0;
    }
  }

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
      // Track damage metrics
      for (const tr of result.targetResults) {
        let hitDamage = 0;
        for (const er of tr.effects) {
          if (er.type === EFFECT_TYPES.DAMAGE) {
            const dmg = er.healthDamage || 0;
            hitDamage += dmg;

            if (actor.type === CHARACTER_TYPES.PLAYER) {
              playerDamageDealt[actor.id] = (playerDamageDealt[actor.id] || 0) + dmg;
            }
            if (playerDamageTaken[tr.targetId] !== undefined) {
              playerDamageTaken[tr.targetId] += dmg;
            }
          }
        }
        // Track max single hit from boss/minions to players
        if (actor.type !== CHARACTER_TYPES.PLAYER && playerDamageTaken[tr.targetId] !== undefined) {
          if (hitDamage > maxSingleHit) {
            maxSingleHit = hitDamage;
            maxSingleHitAbility = action.name || action.id;
          }
        }
      }

      state = advanceTurn(newState);
    } else {
      state = advanceTurn(state);
    }
    turnCount++;
  }

  roundCount = Math.ceil(turnCount / Math.max(turnsPerRound, 1));

  const survivors = state.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
  ).length;

  const resultStr = state.isOver ? state.result : 'timeout';

  return {
    result: resultStr,
    turns: turnCount,
    rounds: roundCount,
    survivors,
    playerCount,
    maxSingleHit,
    maxSingleHitAbility,
    playerDamageDealt,
    playerDamageTaken,
  };
}

// ---------------------------------------------------------------------------
// Worker thread
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { bossLevel, bossHP, runs } = workerData;
  const ALL_CLASSES = getClassNames();

  function buildMixedParty(level, strategyName) {
    return ALL_CLASSES.map(cls => {
      const builds = generateBuildsForClass(cls, level);
      const match = builds.find(b => b.strategyName === strategyName) || builds[0];
      return { ...match, level };
    });
  }

  let totalWins = 0;
  let totalFights = 0;
  let totalSurvivorsOnWin = 0;
  let totalTurns = 0;
  let totalRounds = 0;
  let winCount = 0;
  let overallMaxSingleHit = 0;
  let overallMaxSingleHitAbility = '';
  const classDamageDealt = {};   // className -> total
  const classDamageTaken = {};   // className -> total
  let fightsWith0Survivors = 0;  // wins where only boss died (shouldn't happen but just in case)
  let fightsWith1Survivor = 0;   // "barely won"
  let turnsHistogram = {};       // round buckets for duration distribution

  const strategies = getStrategyNames();

  for (const strat of strategies) {
    const partyBuilds = buildMixedParty(bossLevel, strat);
    const runsPerStrategy = Math.ceil(runs / strategies.length);

    for (let i = 0; i < runsPerStrategy; i++) {
      const state = buildFightState(partyBuilds, bossLevel);

      // Override boss HP
      for (const char of state.characters) {
        if (char.type === 'boss') {
          char.attributes.maxHealth = bossHP;
          char.state.health = bossHP;
        }
      }

      const fightResult = runFightFromState(state, strat);
      totalFights++;
      totalTurns += fightResult.turns;
      totalRounds += fightResult.rounds;

      if (fightResult.result === 'victory') {
        totalWins++;
        totalSurvivorsOnWin += fightResult.survivors;
        winCount++;
        if (fightResult.survivors <= 1) fightsWith1Survivor++;
      }

      if (fightResult.maxSingleHit > overallMaxSingleHit) {
        overallMaxSingleHit = fightResult.maxSingleHit;
        overallMaxSingleHitAbility = fightResult.maxSingleHitAbility;
      }

      // Track damage by class
      for (const char of state.characters) {
        if (char.type === CHARACTER_TYPES.PLAYER && char.class) {
          classDamageDealt[char.class] = (classDamageDealt[char.class] || 0) +
            (fightResult.playerDamageDealt[char.id] || 0);
          classDamageTaken[char.class] = (classDamageTaken[char.class] || 0) +
            (fightResult.playerDamageTaken[char.id] || 0);
        }
      }

      // Rounds histogram
      const bucket = Math.min(fightResult.rounds, 20);
      turnsHistogram[bucket] = (turnsHistogram[bucket] || 0) + 1;
    }
  }

  parentPort.postMessage({
    bossLevel,
    bossHP,
    winRate: totalWins / totalFights,
    totalFights,
    avgSurvivorsOnWin: winCount > 0 ? totalSurvivorsOnWin / winCount : 0,
    avgTurns: totalTurns / totalFights,
    avgRounds: totalRounds / totalFights,
    maxSingleHit: overallMaxSingleHit,
    maxSingleHitAbility: overallMaxSingleHitAbility,
    barelyWonPct: winCount > 0 ? fightsWith1Survivor / winCount : 0,
    classDamageDealt,
    classDamageTaken,
    turnsHistogram,
  });
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '500' },
    tolerance: { type: 'string', default: '2' },
    'hp-min': { type: 'string', default: '8' },
    'hp-max': { type: 'string', default: '120' },
  },
  strict: false,
});

const RUNS_PER_ITERATION = parseInt(args.runs, 10);
const TOLERANCE = parseInt(args.tolerance, 10);
const HP_MIN = parseInt(args['hp-min'], 10);
const HP_MAX = parseInt(args['hp-max'], 10);

// Target win rates per boss level
const TARGET_WIN_RATES = {
  1: 0.90,
  2: 0.80,
  3: 0.75,
  4: 0.70,
  5: 0.65,
  6: 0.55,
  7: 0.45,
};

// Fight quality targets
const QUALITY_TARGETS = {
  minAvgSurvivors: 2.0,    // At least 2 players alive on win
  maxAvgSurvivors: 3.8,    // Not too easy (everyone always lives)
  minAvgRounds: 4,          // Fights shouldn't be too short
  maxAvgRounds: 10,         // Or too long
  maxBarelyWonPct: 0.40,   // Less than 40% of wins should be 1-survivor
  maxSingleHitPctHP: 0.65, // No single hit should do >65% of lowest class HP
};

// Class HP for one-shot checks
const CLASS_MIN_HP = Math.min(
  ...Object.values(CLASS_BASE_ATTRIBUTES).map(a => a.maxHealth)
);

// ---------------------------------------------------------------------------
// Worker spawner
// ---------------------------------------------------------------------------

function runHPTest(bossLevel, bossHP, runs = RUNS_PER_ITERATION) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { bossLevel, bossHP, runs },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited ${code}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Phase 1: Binary search HP
// ---------------------------------------------------------------------------

async function tuneBossHP(bossLevel, targetWinRate) {
  let low = HP_MIN;
  let high = HP_MAX;
  let bestHP = Math.round((low + high) / 2);
  let bestResult = null;
  let iteration = 0;

  const bossName = BOSS_DEFINITIONS.find(b => b.level === bossLevel)?.name || `Boss ${bossLevel}`;

  while (high - low > TOLERANCE) {
    iteration++;
    const midHP = Math.round((low + high) / 2);

    const result = await runHPTest(bossLevel, midHP);

    const arrow = result.winRate > targetWinRate ? '^ HP' : 'v HP';
    console.log(
      `  [${bossName}] iter ${iteration}: HP=${midHP}, win=${(result.winRate * 100).toFixed(1)}%, ` +
      `surv=${result.avgSurvivorsOnWin.toFixed(1)}, rds=${result.avgRounds.toFixed(1)} -> ${arrow}`
    );

    bestHP = midHP;
    bestResult = result;

    if (result.winRate > targetWinRate) {
      low = midHP;
    } else {
      high = midHP;
    }
  }

  return { bossLevel, bossName, hp: bestHP, ...bestResult, iterations: iteration };
}

// ---------------------------------------------------------------------------
// Phase 2: Quality analysis
// ---------------------------------------------------------------------------

function analyzeQuality(results) {
  const warnings = [];

  for (const r of results) {
    const boss = `Boss ${r.bossLevel} (${r.bossName})`;

    // Survivor check
    if (r.avgSurvivorsOnWin < QUALITY_TARGETS.minAvgSurvivors) {
      warnings.push({
        severity: 'HIGH',
        boss,
        issue: `Low survivors: ${r.avgSurvivorsOnWin.toFixed(1)} avg on win (target >=${QUALITY_TARGETS.minAvgSurvivors})`,
        fix: 'Reduce boss damage abilities or add more AoE spread (less single-target burst)',
      });
    }

    // Barely-won check
    if (r.barelyWonPct > QUALITY_TARGETS.maxBarelyWonPct) {
      warnings.push({
        severity: 'HIGH',
        boss,
        issue: `${(r.barelyWonPct * 100).toFixed(0)}% of wins are 1-survivor (target <${(QUALITY_TARGETS.maxBarelyWonPct * 100).toFixed(0)}%)`,
        fix: 'Boss damage too spiky — reduce burst abilities or add more spread damage',
      });
    }

    // Duration check
    if (r.avgRounds < QUALITY_TARGETS.minAvgRounds) {
      warnings.push({
        severity: 'MEDIUM',
        boss,
        issue: `Fights too short: ${r.avgRounds.toFixed(1)} rounds (target >=${QUALITY_TARGETS.minAvgRounds})`,
        fix: 'Raise boss HP or reduce player damage',
      });
    }
    if (r.avgRounds > QUALITY_TARGETS.maxAvgRounds) {
      warnings.push({
        severity: 'MEDIUM',
        boss,
        issue: `Fights too long: ${r.avgRounds.toFixed(1)} rounds (target <=${QUALITY_TARGETS.maxAvgRounds})`,
        fix: 'Lower boss HP or reduce boss healing',
      });
    }

    // One-shot check
    const oneHitPct = r.maxSingleHit / CLASS_MIN_HP;
    if (oneHitPct > QUALITY_TARGETS.maxSingleHitPctHP) {
      warnings.push({
        severity: 'HIGH',
        boss,
        issue: `One-shot risk: "${r.maxSingleHitAbility}" hit for ${r.maxSingleHit} (${(oneHitPct * 100).toFixed(0)}% of ${CLASS_MIN_HP} HP class)`,
        fix: `Cap this ability's damage or split into multi-hit`,
      });
    }

    // Damage distribution check — is one class taking all the hits?
    if (r.classDamageTaken) {
      const totalTaken = Object.values(r.classDamageTaken).reduce((s, v) => s + v, 0);
      if (totalTaken > 0) {
        for (const [cls, dmg] of Object.entries(r.classDamageTaken)) {
          const pct = dmg / totalTaken;
          if (pct > 0.50) {
            warnings.push({
              severity: 'LOW',
              boss,
              issue: `${cls} absorbing ${(pct * 100).toFixed(0)}% of all damage`,
              fix: 'This is fine if intentional (tank). Flag if non-tank.',
            });
          }
        }
      }
    }

    // Damage dealt check — is one class doing all the work?
    if (r.classDamageDealt) {
      const totalDealt = Object.values(r.classDamageDealt).reduce((s, v) => s + v, 0);
      if (totalDealt > 0) {
        for (const [cls, dmg] of Object.entries(r.classDamageDealt)) {
          const pct = dmg / totalDealt;
          if (pct > 0.55) {
            warnings.push({
              severity: 'LOW',
              boss,
              issue: `${cls} dealing ${(pct * 100).toFixed(0)}% of all damage`,
              fix: 'May indicate other classes are underpowered offensively.',
            });
          }
        }
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Pub Fight Auto-Tuner ===\n');
  console.log(`  Runs per iteration: ${RUNS_PER_ITERATION}`);
  console.log(`  HP search range: ${HP_MIN}-${HP_MAX}`);
  console.log(`  Tolerance: +/-${TOLERANCE} HP`);
  console.log(`  Lowest class HP: ${CLASS_MIN_HP} (one-shot threshold: ${Math.round(CLASS_MIN_HP * QUALITY_TARGETS.maxSingleHitPctHP)})`);
  console.log('');

  console.log('Target win rates:');
  for (const [level, rate] of Object.entries(TARGET_WIN_RATES)) {
    const bossName = BOSS_DEFINITIONS.find(b => b.level === parseInt(level))?.name || `Boss ${level}`;
    console.log(`  ${level}. ${bossName}: ${(rate * 100).toFixed(0)}%`);
  }

  // ---- Phase 1: Binary search HP ----
  console.log('\n--- Phase 1: Binary Search Boss HP ---\n');
  const startTime = Date.now();

  const tunePromises = Object.entries(TARGET_WIN_RATES).map(([level, target]) =>
    tuneBossHP(parseInt(level), target)
  );

  const results = await Promise.all(tunePromises);
  const sortedResults = results.sort((a, b) => a.bossLevel - b.bossLevel);

  const phase1Time = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nPhase 1 completed in ${phase1Time}s`);

  // ---- Phase 2: Quality analysis ----
  console.log('\n--- Phase 2: Fight Quality Analysis ---\n');

  console.log('Boss                        | HP  | Win%  | Surviv | Rounds | Barely | Max Hit');
  console.log('----------------------------|-----|-------|--------|--------|--------|--------');
  for (const r of sortedResults) {
    const name = r.bossName.padEnd(27);
    const hp = String(r.hp).padStart(3);
    const win = `${(r.winRate * 100).toFixed(0)}%`.padStart(4);
    const surv = r.avgSurvivorsOnWin.toFixed(1).padStart(5);
    const rounds = r.avgRounds.toFixed(1).padStart(5);
    const barely = `${(r.barelyWonPct * 100).toFixed(0)}%`.padStart(5);
    const maxHit = `${r.maxSingleHit}`.padStart(3);
    console.log(`${name} | ${hp} | ${win}  | ${surv}  | ${rounds}  | ${barely}  | ${maxHit} (${r.maxSingleHitAbility})`);
  }

  const warnings = analyzeQuality(sortedResults);

  if (warnings.length > 0) {
    console.log('\n--- Warnings ---\n');
    for (const w of warnings) {
      const icon = w.severity === 'HIGH' ? '!!!' : w.severity === 'MEDIUM' ? ' ! ' : '   ';
      console.log(`${icon} [${w.severity}] ${w.boss}`);
      console.log(`    Issue: ${w.issue}`);
      console.log(`    Fix:   ${w.fix}`);
      console.log('');
    }
  } else {
    console.log('\nNo warnings — all quality metrics within targets!\n');
  }

  // ---- Phase 3: Validation run at tuned HP ----
  console.log('--- Phase 3: Validation (2x runs) ---\n');

  const valPromises = sortedResults.map(r => runHPTest(r.bossLevel, r.hp, RUNS_PER_ITERATION * 2));
  const validations = await Promise.all(valPromises);

  console.log('Boss                        | HP  | Tuned | Valid | Target | Surviv | Rounds');
  console.log('----------------------------|-----|-------|-------|--------|--------|-------');
  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i];
    const v = validations[i];
    const name = r.bossName.padEnd(27);
    const hp = String(r.hp).padStart(3);
    const tuned = `${(r.winRate * 100).toFixed(0)}%`.padStart(4);
    const valid = `${(v.winRate * 100).toFixed(0)}%`.padStart(4);
    const target = `${(TARGET_WIN_RATES[r.bossLevel] * 100).toFixed(0)}%`.padStart(4);
    const surv = v.avgSurvivorsOnWin.toFixed(1).padStart(5);
    const rounds = v.avgRounds.toFixed(1).padStart(5);
    console.log(`${name} | ${hp} | ${tuned}  | ${valid}  | ${target}   | ${surv}  | ${rounds}`);
  }

  // ---- Output ----
  console.log('\n=== Recommended Boss HP Values ===\n');
  console.log('// Auto-tuned boss HP values — paste into bosses.js and bosses/index.ts');
  for (const r of sortedResults) {
    const target = (TARGET_WIN_RATES[r.bossLevel] * 100).toFixed(0);
    console.log(`// ${r.bossName} — target ${target}%, validated ${(validations[sortedResults.indexOf(r)].winRate * 100).toFixed(0)}%`);
    console.log(`maxHealth: ${r.hp},`);
  }

  // Class damage breakdown
  console.log('\n=== Class Damage Contribution (averaged across all bosses) ===\n');
  const classTotals = {};
  let grandTotal = 0;
  for (const r of sortedResults) {
    if (!r.classDamageDealt) continue;
    for (const [cls, dmg] of Object.entries(r.classDamageDealt)) {
      classTotals[cls] = (classTotals[cls] || 0) + dmg;
      grandTotal += dmg;
    }
  }
  if (grandTotal > 0) {
    for (const [cls, dmg] of Object.entries(classTotals).sort((a, b) => b[1] - a[1])) {
      const pct = ((dmg / grandTotal) * 100).toFixed(1);
      const bar = '#'.repeat(Math.round(dmg / grandTotal * 40));
      console.log(`  ${cls.padEnd(12)} ${pct}% ${bar}`);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nTotal time: ${totalTime}s`);
}

main().catch(err => {
  console.error('Auto-tuner failed:', err);
  process.exit(1);
});
