#!/usr/bin/env node

/**
 * Auto-Pilot Tuner — comprehensive 6-phase balance pipeline.
 *
 * Phase 1: Damage audit (cap one-shot abilities)
 * Phase 2: Binary search boss HP to hit target win rates
 * Phase 3: Fight quality validation (duration, survivors, solo-tank, etc.)
 * Phase 4: Skill/perk impact analysis
 * Phase 5: Campaign validation (progressive 1→7)
 * Phase 6: Summary report
 *
 * Usage:
 *   node simulator/autoTune.js                    # full auto-pilot
 *   node simulator/autoTune.js --dry-run          # preview changes, don't write JSON
 *   node simulator/autoTune.js --skip-hp          # skip HP search, just validate
 *   node simulator/autoTune.js --runs 1000        # more runs per iteration
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseArgs } from 'node:util';

import {
  generateBuildsForClass,
  getClassNames,
  getStrategyNames,
} from './buildGenerator.js';
import { buildFightState } from './fightRunner.js';

import {
  executeAction,
  advanceTurn,
  getCurrentTurnCharacter,
} from '../client/src/game/engine.js';
import { CHARACTER_TYPES, EFFECT_TYPES } from '../client/src/game/types.js';
import { chooseBossAction } from '../client/src/game/bossAI.js';
import { choosePlayerAction } from './playerAI.js';
import { ALL_SKILLS, SKILLS_BY_CLASS } from '../server/dist/skills/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BOSSES_JSON_PATH = resolve(__dirname, '../shared/bosses.json');
const CLASSES_JSON_PATH = resolve(__dirname, '../shared/classes.json');

const MAX_TURNS = 300;

// ---------------------------------------------------------------------------
// Load shared JSON (mutable — we may write changes back)
// ---------------------------------------------------------------------------

function loadBossesJSON() {
  return JSON.parse(readFileSync(BOSSES_JSON_PATH, 'utf-8'));
}

function loadClassesJSON() {
  return JSON.parse(readFileSync(CLASSES_JSON_PATH, 'utf-8'));
}

function saveBossesJSON(data) {
  writeFileSync(BOSSES_JSON_PATH, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

// ---------------------------------------------------------------------------
// Fight runner with enhanced metrics (solo-tank tracking)
// ---------------------------------------------------------------------------

function runFightFromState(state, aiStrategy = 'balanced') {
  let turnCount = 0;
  let roundCount = 0;
  const playerIds = state.characters
    .filter(c => c.type === CHARACTER_TYPES.PLAYER)
    .map(c => c.id);
  const playerCount = playerIds.length;
  const turnsPerRound = state.turnOrder.length;
  let maxSingleHit = 0;
  let maxSingleHitAbility = '';
  const playerDamageDealt = {};
  const playerDamageTaken = {};
  const playerHealingDone = {};
  const playerClasses = {};

  // Solo-tank tracking
  let firstDeathRound = -1;
  let roundsAfterFirstDeath = 0;
  let soloRounds = 0; // rounds where exactly 1 player alive

  for (const c of state.characters) {
    if (c.type === CHARACTER_TYPES.PLAYER) {
      playerDamageDealt[c.id] = 0;
      playerDamageTaken[c.id] = 0;
      playerHealingDone[c.id] = 0;
      playerClasses[c.id] = c.class;
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
      action = chooseBossAction(actor, state);
    }

    if (!action) {
      state = advanceTurn(state);
      turnCount++;
      continue;
    }

    const { newState, result } = executeAction(state, actor.id, action.id, manualTargetId);

    if (result.success) {
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
          if (er.type === EFFECT_TYPES.HEAL) {
            if (actor.type === CHARACTER_TYPES.PLAYER) {
              playerHealingDone[actor.id] = (playerHealingDone[actor.id] || 0) + (er.amount || 0);
            }
          }
        }
        if (actor.type !== CHARACTER_TYPES.PLAYER && playerDamageTaken[tr.targetId] !== undefined) {
          if (hitDamage > maxSingleHit) {
            maxSingleHit = hitDamage;
            maxSingleHitAbility = action.name || action.id;
          }
        }
      }

      // Track self-heal
      for (const er of result.selfResults || []) {
        if (er.type === EFFECT_TYPES.HEAL && actor.type === CHARACTER_TYPES.PLAYER) {
          playerHealingDone[actor.id] = (playerHealingDone[actor.id] || 0) + (er.amount || 0);
        }
      }

      state = advanceTurn(newState);
    } else {
      state = advanceTurn(state);
    }
    turnCount++;

    // Track solo-tank per round boundary
    const currentRound = Math.ceil(turnCount / Math.max(turnsPerRound, 1));
    const alivePlayers = state.characters.filter(
      c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
    ).length;

    if (alivePlayers < playerCount && firstDeathRound === -1) {
      firstDeathRound = currentRound;
    }
    if (firstDeathRound > -1 && currentRound > firstDeathRound) {
      // Only count at round boundaries (when turnCount aligns)
      if (turnCount % turnsPerRound === 0) {
        roundsAfterFirstDeath++;
        if (alivePlayers === 1) soloRounds++;
      }
    }
  }

  roundCount = Math.ceil(turnCount / Math.max(turnsPerRound, 1));

  const survivors = state.characters.filter(
    c => c.type === CHARACTER_TYPES.PLAYER && c.state.isAlive
  ).length;

  const resultStr = state.isOver ? state.result : 'timeout';

  const isSoloTankWin = resultStr === 'victory' &&
    roundsAfterFirstDeath > 0 &&
    (soloRounds / roundsAfterFirstDeath) > 0.5;

  // Aggregate damage by class
  const classDamageDealt = {};
  const classDamageTaken = {};
  const classHealingDone = {};
  for (const [pid, cls] of Object.entries(playerClasses)) {
    classDamageDealt[cls] = (classDamageDealt[cls] || 0) + (playerDamageDealt[pid] || 0);
    classDamageTaken[cls] = (classDamageTaken[cls] || 0) + (playerDamageTaken[pid] || 0);
    classHealingDone[cls] = (classHealingDone[cls] || 0) + (playerHealingDone[pid] || 0);
  }

  return {
    result: resultStr,
    turns: turnCount,
    rounds: roundCount,
    survivors,
    playerCount,
    maxSingleHit,
    maxSingleHitAbility,
    classDamageDealt,
    classDamageTaken,
    classHealingDone,
    isSoloTankWin,
  };
}

// ---------------------------------------------------------------------------
// Worker thread
// ---------------------------------------------------------------------------

if (!isMainThread) {
  const { bossLevel, bossHP, runs, mode, strategyFilter } = workerData;
  const ALL_CLASSES = getClassNames();

  function buildMixedParty(level, strategyName) {
    return ALL_CLASSES.map(cls => {
      const builds = generateBuildsForClass(cls, level);
      const match = builds.find(b => b.strategyName === strategyName) || builds[0];
      return { ...match, level };
    });
  }

  if (mode === 'campaign') {
    // Progressive campaign run for a single strategy
    const strat = strategyFilter;
    let fullClears = 0;
    const bossesCleared = [];
    const wallCounts = {};

    for (let run = 0; run < runs; run++) {
      let cleared = 0;
      for (let bl = 1; bl <= 7; bl++) {
        const partyBuilds = buildMixedParty(bl, strat);
        const state = buildFightState(partyBuilds, bl);
        const fightResult = runFightFromState(state, strat);
        if (fightResult.result === 'victory') {
          cleared++;
        } else {
          wallCounts[bl] = (wallCounts[bl] || 0) + 1;
          break;
        }
      }
      bossesCleared.push(cleared);
      if (cleared === 7) fullClears++;
    }

    parentPort.postMessage({
      strategy: strat,
      clearRate: fullClears / runs,
      avgBossesCleared: bossesCleared.reduce((a, b) => a + b, 0) / runs,
      wallCounts,
      totalRuns: runs,
    });
    process.exit(0);
  }

  // Standard HP test mode
  const strategies = getStrategyNames();
  let totalWins = 0;
  let totalFights = 0;
  let totalSurvivorsOnWin = 0;
  let totalRounds = 0;
  let winCount = 0;
  let overallMaxSingleHit = 0;
  let overallMaxSingleHitAbility = '';
  const classDamageDealt = {};
  const classDamageTaken = {};
  const classHealingDone = {};
  let fightsWith1Survivor = 0;
  let soloTankWins = 0;

  for (const strat of strategies) {
    const partyBuilds = buildMixedParty(bossLevel, strat);
    const runsPerStrategy = Math.ceil(runs / strategies.length);

    for (let i = 0; i < runsPerStrategy; i++) {
      const state = buildFightState(partyBuilds, bossLevel);

      if (bossHP !== undefined && bossHP !== null) {
        for (const char of state.characters) {
          if (char.type === 'boss') {
            char.attributes.maxHealth = bossHP;
            char.state.health = bossHP;
          }
        }
      }

      const fightResult = runFightFromState(state, strat);
      totalFights++;
      totalRounds += fightResult.rounds;

      if (fightResult.result === 'victory') {
        totalWins++;
        totalSurvivorsOnWin += fightResult.survivors;
        winCount++;
        if (fightResult.survivors <= 1) fightsWith1Survivor++;
        if (fightResult.isSoloTankWin) soloTankWins++;
      }

      if (fightResult.maxSingleHit > overallMaxSingleHit) {
        overallMaxSingleHit = fightResult.maxSingleHit;
        overallMaxSingleHitAbility = fightResult.maxSingleHitAbility;
      }

      for (const [cls, dmg] of Object.entries(fightResult.classDamageDealt)) {
        classDamageDealt[cls] = (classDamageDealt[cls] || 0) + dmg;
      }
      for (const [cls, dmg] of Object.entries(fightResult.classDamageTaken)) {
        classDamageTaken[cls] = (classDamageTaken[cls] || 0) + dmg;
      }
      for (const [cls, heal] of Object.entries(fightResult.classHealingDone)) {
        classHealingDone[cls] = (classHealingDone[cls] || 0) + heal;
      }
    }
  }

  parentPort.postMessage({
    bossLevel,
    bossHP,
    winRate: totalWins / totalFights,
    totalFights,
    avgSurvivorsOnWin: winCount > 0 ? totalSurvivorsOnWin / winCount : 0,
    avgRounds: totalRounds / totalFights,
    maxSingleHit: overallMaxSingleHit,
    maxSingleHitAbility: overallMaxSingleHitAbility,
    barelyWonPct: winCount > 0 ? fightsWith1Survivor / winCount : 0,
    soloTankPct: winCount > 0 ? soloTankWins / winCount : 0,
    classDamageDealt,
    classDamageTaken,
    classHealingDone,
  });
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    runs: { type: 'string', default: '500' },
    tolerance: { type: 'string', default: '2' },
    'hp-min': { type: 'string', default: '8' },
    'hp-max': { type: 'string', default: '150' },
    'dry-run': { type: 'boolean', default: false },
    'skip-hp': { type: 'boolean', default: false },
  },
  strict: false,
});

const RUNS_PER_ITERATION = parseInt(args.runs, 10);
const TOLERANCE = parseInt(args.tolerance, 10);
const HP_MIN = parseInt(args['hp-min'], 10);
const HP_MAX = parseInt(args['hp-max'], 10);
const DRY_RUN = args['dry-run'];
const SKIP_HP = args['skip-hp'];

const TARGET_WIN_RATES = {
  1: 0.90,
  2: 0.80,
  3: 0.75,
  4: 0.70,
  5: 0.65,
  6: 0.55,
  7: 0.45,
};

const QUALITY_TARGETS = {
  minAvgSurvivors: 2.0,
  maxAvgSurvivors: 3.8,
  minAvgRounds: 4,
  maxAvgRounds: 10,
  maxBarelyWonPct: 0.40,
  maxSingleHitPctHP: 0.65,
  maxSoloTankPct: 0.15,
  maxClassDamageDealtPct: 0.55,
  maxClassDamageTakenPct: 0.50,
  skillDeltaDeadThreshold: 0.02,
  skillDeltaOPThreshold: 0.15,
  minClassContribution: 0.15,
  maxClassContribution: 0.40,
  minStrategyWinRate: 0.20,
};

const classesJSON = loadClassesJSON();
const CLASS_MIN_HP = Math.min(
  ...Object.values(classesJSON).map(a => a.maxHealth)
);
const ONE_SHOT_THRESHOLD = Math.floor(CLASS_MIN_HP * QUALITY_TARGETS.maxSingleHitPctHP);

// ---------------------------------------------------------------------------
// Worker spawner
// ---------------------------------------------------------------------------

function runHPTest(bossLevel, bossHP, runs = RUNS_PER_ITERATION) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { bossLevel, bossHP, runs, mode: 'hptest' },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited ${code}`));
    });
  });
}

function runCampaignWorker(strategy, runs) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { runs, mode: 'campaign', strategyFilter: strategy },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited ${code}`));
    });
  });
}

// ===========================================================================
// Phase 1: Damage Audit
// ===========================================================================

function phase1DamageAudit(bossesJSON) {
  console.log('\n--- Phase 1: Damage Audit ---\n');
  const changes = [];

  for (const boss of bossesJSON.bosses) {
    const bossPower = boss.attributes.power || 0;

    for (const ability of boss.abilities) {
      for (const effect of ability.effects) {
        if (effect.type === 'damage') {
          const effectiveDmg = effect.amount + bossPower;
          const totalPerUse = effectiveDmg * (ability.hits || 1);

          if (totalPerUse > ONE_SHOT_THRESHOLD && ability.hits === 1) {
            const cappedAmount = ONE_SHOT_THRESHOLD - bossPower;
            if (cappedAmount < effect.amount && cappedAmount > 0) {
              changes.push({
                boss: boss.name,
                ability: ability.name,
                field: 'damage',
                from: effect.amount,
                to: cappedAmount,
                reason: `Effective ${effectiveDmg} (base ${effect.amount} + power ${bossPower}) exceeds one-shot threshold ${ONE_SHOT_THRESHOLD}`,
              });
              effect.amount = cappedAmount;
            }
          }
        }
      }
    }
  }

  if (changes.length === 0) {
    console.log('  All abilities within one-shot threshold. No changes needed.');
  } else {
    for (const c of changes) {
      console.log(`  CAPPED: ${c.boss} / ${c.ability}: damage ${c.from} -> ${c.to}`);
      console.log(`    Reason: ${c.reason}`);
    }
  }

  return changes;
}

// ===========================================================================
// Phase 2: Binary Search Boss HP
// ===========================================================================

async function phase2BinarySearchHP(bossesJSON) {
  console.log('\n--- Phase 2: Binary Search Boss HP ---\n');

  const results = [];

  for (const [levelStr, targetWinRate] of Object.entries(TARGET_WIN_RATES)) {
    const bossLevel = parseInt(levelStr);
    const boss = bossesJSON.bosses.find(b => b.level === bossLevel);
    const bossName = boss?.name || `Boss ${bossLevel}`;

    let low = HP_MIN;
    let high = HP_MAX;
    let bestHP = Math.round((low + high) / 2);
    let bestResult = null;
    let iteration = 0;

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

    results.push({ bossLevel, bossName, hp: bestHP, ...bestResult, iterations: iteration });
  }

  return results;
}

// ===========================================================================
// Phase 3: Fight Quality Validation
// ===========================================================================

async function phase3FightQuality(bossesJSON) {
  console.log('\n--- Phase 3: Fight Quality Validation ---\n');

  const valPromises = bossesJSON.bosses.map(boss =>
    runHPTest(boss.level, boss.attributes.maxHealth, RUNS_PER_ITERATION * 2)
  );
  const validations = await Promise.all(valPromises);
  const warnings = [];

  // Print table
  console.log('Boss                        | HP  | Win%  | Surviv | Rounds | Barely | SoloTk | Max Hit');
  console.log('----------------------------|-----|-------|--------|--------|--------|--------|--------');

  for (let i = 0; i < bossesJSON.bosses.length; i++) {
    const boss = bossesJSON.bosses[i];
    const v = validations[i];
    const name = boss.name.padEnd(27);
    const hp = String(boss.attributes.maxHealth).padStart(3);
    const win = `${(v.winRate * 100).toFixed(0)}%`.padStart(4);
    const surv = v.avgSurvivorsOnWin.toFixed(1).padStart(5);
    const rounds = v.avgRounds.toFixed(1).padStart(5);
    const barely = `${(v.barelyWonPct * 100).toFixed(0)}%`.padStart(5);
    const soloTk = `${(v.soloTankPct * 100).toFixed(0)}%`.padStart(5);
    const maxHit = `${v.maxSingleHit}`.padStart(3);
    console.log(`${name} | ${hp} | ${win}  | ${surv}  | ${rounds}  | ${barely}  | ${soloTk}  | ${maxHit} (${v.maxSingleHitAbility})`);

    const bossLabel = `Boss ${boss.level} (${boss.name})`;

    if (v.avgSurvivorsOnWin < QUALITY_TARGETS.minAvgSurvivors) {
      warnings.push({ severity: 'HIGH', boss: bossLabel, issue: `Low survivors: ${v.avgSurvivorsOnWin.toFixed(1)} avg on win (target >=${QUALITY_TARGETS.minAvgSurvivors})`, fix: 'Reduce boss burst damage' });
    }
    if (v.avgSurvivorsOnWin > QUALITY_TARGETS.maxAvgSurvivors) {
      warnings.push({ severity: 'LOW', boss: bossLabel, issue: `High survivors: ${v.avgSurvivorsOnWin.toFixed(1)} avg on win (target <=${QUALITY_TARGETS.maxAvgSurvivors})`, fix: 'Boss may be too easy — increase damage or HP' });
    }
    if (v.barelyWonPct > QUALITY_TARGETS.maxBarelyWonPct) {
      warnings.push({ severity: 'HIGH', boss: bossLabel, issue: `${(v.barelyWonPct * 100).toFixed(0)}% barely-won (target <${(QUALITY_TARGETS.maxBarelyWonPct * 100).toFixed(0)}%)`, fix: 'Reduce boss burst — too swingy' });
    }
    if (v.avgRounds < QUALITY_TARGETS.minAvgRounds) {
      warnings.push({ severity: 'MEDIUM', boss: bossLabel, issue: `Too short: ${v.avgRounds.toFixed(1)} rounds (target >=${QUALITY_TARGETS.minAvgRounds})`, fix: 'Raise boss HP' });
    }
    if (v.avgRounds > QUALITY_TARGETS.maxAvgRounds) {
      warnings.push({ severity: 'MEDIUM', boss: bossLabel, issue: `Too long: ${v.avgRounds.toFixed(1)} rounds (target <=${QUALITY_TARGETS.maxAvgRounds})`, fix: 'Lower boss HP or reduce healing' });
    }
    if (v.soloTankPct > QUALITY_TARGETS.maxSoloTankPct) {
      warnings.push({ severity: 'HIGH', boss: bossLabel, issue: `Solo-tank grind: ${(v.soloTankPct * 100).toFixed(0)}% of wins (target <${(QUALITY_TARGETS.maxSoloTankPct * 100).toFixed(0)}%)`, fix: 'Boss AoE too low or tank too survivable vs this boss' });
    }

    const oneHitPct = v.maxSingleHit / CLASS_MIN_HP;
    if (oneHitPct > QUALITY_TARGETS.maxSingleHitPctHP) {
      warnings.push({ severity: 'HIGH', boss: bossLabel, issue: `One-shot risk: "${v.maxSingleHitAbility}" = ${v.maxSingleHit} (${(oneHitPct * 100).toFixed(0)}% of ${CLASS_MIN_HP} HP)`, fix: 'Cap ability damage or split into multi-hit' });
    }

    if (v.classDamageDealt) {
      const totalDealt = Object.values(v.classDamageDealt).reduce((s, x) => s + x, 0);
      if (totalDealt > 0) {
        for (const [cls, dmg] of Object.entries(v.classDamageDealt)) {
          const pct = dmg / totalDealt;
          if (pct > QUALITY_TARGETS.maxClassDamageDealtPct) {
            warnings.push({ severity: 'LOW', boss: bossLabel, issue: `${cls} dealing ${(pct * 100).toFixed(0)}% of damage`, fix: 'Other classes may be underpowered offensively' });
          }
        }
      }
    }
    if (v.classDamageTaken) {
      const totalTaken = Object.values(v.classDamageTaken).reduce((s, x) => s + x, 0);
      if (totalTaken > 0) {
        for (const [cls, dmg] of Object.entries(v.classDamageTaken)) {
          const pct = dmg / totalTaken;
          if (pct > QUALITY_TARGETS.maxClassDamageTakenPct) {
            warnings.push({ severity: 'LOW', boss: bossLabel, issue: `${cls} absorbing ${(pct * 100).toFixed(0)}% of damage`, fix: 'Expected if tank, flag if not' });
          }
        }
      }
    }
  }

  return { validations, warnings };
}

// ===========================================================================
// Phase 4: Skill/Perk Impact Analysis
// ===========================================================================

async function phase4SkillImpact(bossesJSON) {
  console.log('\n--- Phase 4: Skill/Perk Impact Analysis ---\n');

  const ALL_CLASSES = getClassNames();
  const strategies = getStrategyNames();

  // Run baseline (all skills active) per boss per strategy
  console.log('  Running baseline...');
  const baselinePromises = bossesJSON.bosses.map(boss =>
    runHPTest(boss.level, boss.attributes.maxHealth, RUNS_PER_ITERATION)
  );
  const baselineResults = await Promise.all(baselinePromises);
  const baselineByLevel = {};
  for (const r of baselineResults) {
    baselineByLevel[r.bossLevel] = r;
  }

  // Per-skill impact: we measure overall win rate with vs without each skill
  // across all bosses. This is approximate but fast.
  const skillResults = [];

  // Collect all skills per class
  for (const cls of ALL_CLASSES) {
    const classSkills = SKILLS_BY_CLASS[cls] || [];

    for (const skill of classSkills) {
      // Run fights excluding this specific skill from builds
      // We do this by running from the highest boss level where the skill is available
      const testLevel = Math.min(skill.levelRequired + 2, 7);
      const boss = bossesJSON.bosses.find(b => b.level === testLevel);
      if (!boss) continue;

      // Build parties with and without the skill
      let withWinRate = 0;
      let withoutWinRate = 0;
      let withRuns = 0;
      let withoutRuns = 0;

      for (const strat of strategies) {
        const partyBuilds = ALL_CLASSES.map(c => {
          const builds = generateBuildsForClass(c, testLevel);
          return builds.find(b => b.strategyName === strat) || builds[0];
        });

        // "With" — normal run (skill available if selected)
        const hasSkill = partyBuilds.some(b => b.skillIds.includes(skill.id));

        // "Without" — remove skill from builds
        const withoutBuilds = partyBuilds.map(b => ({
          ...b,
          skillIds: b.skillIds.filter(s => s !== skill.id),
        }));

        // Run small batch for each
        const runsPerTest = Math.ceil(RUNS_PER_ITERATION / strategies.length / 3);

        for (let i = 0; i < runsPerTest; i++) {
          // With skill
          const stateWith = buildFightState(partyBuilds, testLevel);
          const resWith = runFightFromState(stateWith, strat);
          withRuns++;
          if (resWith.result === 'victory') withWinRate++;

          // Without skill
          const stateWithout = buildFightState(withoutBuilds, testLevel);
          const resWithout = runFightFromState(stateWithout, strat);
          withoutRuns++;
          if (resWithout.result === 'victory') withoutWinRate++;
        }
      }

      const withRate = withRuns > 0 ? withWinRate / withRuns : 0;
      const withoutRate = withoutRuns > 0 ? withoutWinRate / withoutRuns : 0;
      const delta = withRate - withoutRate;

      skillResults.push({
        skillId: skill.id,
        skillName: skill.name,
        class: cls,
        delta,
        withRate,
        withoutRate,
      });
    }
  }

  skillResults.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // Print skill impact table
  console.log('  Skill                       | Class     | Delta  | With   | Without | Flag');
  console.log('  ----------------------------|-----------|--------|--------|---------|-----');
  const skillWarnings = [];

  for (const s of skillResults) {
    const sign = s.delta >= 0 ? '+' : '';
    const flag =
      Math.abs(s.delta) < QUALITY_TARGETS.skillDeltaDeadThreshold ? 'DEAD' :
      Math.abs(s.delta) > QUALITY_TARGETS.skillDeltaOPThreshold ? 'OP' : '';
    const name = s.skillName.padEnd(27);
    const cls = s.class.padEnd(9);
    const deltaStr = `${sign}${(s.delta * 100).toFixed(1)}%`.padStart(6);
    const withStr = `${(s.withRate * 100).toFixed(0)}%`.padStart(5);
    const withoutStr = `${(s.withoutRate * 100).toFixed(0)}%`.padStart(6);
    console.log(`  ${name} | ${cls} | ${deltaStr} | ${withStr}  | ${withoutStr}  | ${flag}`);

    if (flag) {
      skillWarnings.push({
        severity: flag === 'OP' ? 'HIGH' : 'MEDIUM',
        issue: `${flag}: ${s.skillName} (${s.class}) delta=${sign}${(s.delta * 100).toFixed(1)}%`,
        fix: flag === 'OP' ? 'Nerf this skill — too impactful' : 'Buff or rework — negligible impact',
      });
    }
  }

  // Class contribution across all bosses (from baseline)
  console.log('\n  Class Contribution (damage dealt / taken / healing):');

  const classTotals = { dealt: {}, taken: {}, healing: {} };
  let grandDealt = 0, grandTaken = 0, grandHeal = 0;

  for (const r of baselineResults) {
    for (const [cls, dmg] of Object.entries(r.classDamageDealt || {})) {
      classTotals.dealt[cls] = (classTotals.dealt[cls] || 0) + dmg;
      grandDealt += dmg;
    }
    for (const [cls, dmg] of Object.entries(r.classDamageTaken || {})) {
      classTotals.taken[cls] = (classTotals.taken[cls] || 0) + dmg;
      grandTaken += dmg;
    }
    for (const [cls, heal] of Object.entries(r.classHealingDone || {})) {
      classTotals.healing[cls] = (classTotals.healing[cls] || 0) + heal;
      grandHeal += heal;
    }
  }

  console.log('  Class       | Dealt   | Taken   | Healing');
  console.log('  ------------|---------|---------|--------');
  for (const cls of ALL_CLASSES) {
    const dPct = grandDealt > 0 ? ((classTotals.dealt[cls] || 0) / grandDealt * 100).toFixed(0) : '0';
    const tPct = grandTaken > 0 ? ((classTotals.taken[cls] || 0) / grandTaken * 100).toFixed(0) : '0';
    const hPct = grandHeal > 0 ? ((classTotals.healing[cls] || 0) / grandHeal * 100).toFixed(0) : '0';
    console.log(`  ${cls.padEnd(11)} | ${dPct.padStart(4)}%   | ${tPct.padStart(4)}%   | ${hPct.padStart(4)}%`);

    if (grandDealt > 0) {
      const contribution = (classTotals.dealt[cls] || 0) / grandDealt;
      if (contribution < QUALITY_TARGETS.minClassContribution) {
        skillWarnings.push({
          severity: 'MEDIUM',
          issue: `${cls} contributing only ${(contribution * 100).toFixed(0)}% of total damage (threshold ${(QUALITY_TARGETS.minClassContribution * 100).toFixed(0)}%)`,
          fix: 'Buff class damage output',
        });
      }
      if (contribution > QUALITY_TARGETS.maxClassContribution) {
        skillWarnings.push({
          severity: 'MEDIUM',
          issue: `${cls} contributing ${(contribution * 100).toFixed(0)}% of total damage (threshold ${(QUALITY_TARGETS.maxClassContribution * 100).toFixed(0)}%)`,
          fix: 'Nerf class damage or buff others',
        });
      }
    }
  }

  // Strategy viability
  console.log('\n  Strategy Win Rates per Boss:');
  const strategyWarnings = [];
  const strategyResults = {};

  for (const strat of strategies) {
    strategyResults[strat] = {};
    for (const boss of bossesJSON.bosses) {
      // Quick test per strategy per boss
      const partyBuilds = ALL_CLASSES.map(cls => {
        const builds = generateBuildsForClass(cls, boss.level);
        return builds.find(b => b.strategyName === strat) || builds[0];
      });

      let wins = 0;
      const testRuns = Math.ceil(RUNS_PER_ITERATION / 5);
      for (let i = 0; i < testRuns; i++) {
        const state = buildFightState(partyBuilds, boss.level);
        const res = runFightFromState(state, strat);
        if (res.result === 'victory') wins++;
      }
      const wr = wins / testRuns;
      strategyResults[strat][boss.level] = wr;

      if (wr < QUALITY_TARGETS.minStrategyWinRate) {
        strategyWarnings.push({
          severity: 'LOW',
          issue: `Strategy "${strat}" has ${(wr * 100).toFixed(0)}% win rate vs ${boss.name} (threshold ${(QUALITY_TARGETS.minStrategyWinRate * 100).toFixed(0)}%)`,
          fix: 'Non-viable strategy for this boss',
        });
      }
    }
  }

  // Print strategy table
  const bossHeaders = bossesJSON.bosses.map(b => b.name.split(' ').pop().substring(0, 8));
  console.log(`  ${'Strategy'.padEnd(15)} | ${bossHeaders.map(h => h.padStart(8)).join(' | ')}`);
  console.log(`  ${'-'.repeat(15)}-|-${bossHeaders.map(() => '-'.repeat(8)).join('-|-')}`);
  for (const strat of strategies) {
    const cells = bossesJSON.bosses.map(b => {
      const wr = strategyResults[strat][b.level];
      return `${(wr * 100).toFixed(0)}%`.padStart(8);
    });
    console.log(`  ${strat.padEnd(15)} | ${cells.join(' | ')}`);
  }

  return { skillResults, skillWarnings: [...skillWarnings, ...strategyWarnings] };
}

// ===========================================================================
// Phase 5: Campaign Validation
// ===========================================================================

async function phase5Campaign() {
  console.log('\n--- Phase 5: Campaign Validation ---\n');

  const strategies = getStrategyNames();
  const campaignRuns = Math.ceil(RUNS_PER_ITERATION / 5);

  const campaignPromises = strategies.map(strat =>
    runCampaignWorker(strat, campaignRuns)
  );
  const campaignResults = await Promise.all(campaignPromises);

  console.log('  Strategy        | Clear%  | Avg Bosses | Wall Boss');
  console.log('  ----------------|---------|------------|----------');

  for (const r of campaignResults) {
    const clearPct = `${(r.clearRate * 100).toFixed(0)}%`.padStart(5);
    const avgBosses = r.avgBossesCleared.toFixed(1).padStart(4);

    // Find the wall boss (most common failure point)
    let wallBoss = '-';
    if (r.wallCounts && Object.keys(r.wallCounts).length > 0) {
      const wallLevel = Object.entries(r.wallCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
      wallBoss = `Boss ${wallLevel}`;
    }

    console.log(`  ${r.strategy.padEnd(15)} | ${clearPct}   | ${avgBosses}       | ${wallBoss}`);
  }

  return campaignResults;
}

// ===========================================================================
// Phase 6: Summary Report
// ===========================================================================

function phase6Summary(allChanges, phase2Results, phase3Data, phase4Data, phase5Data) {
  console.log('\n' + '='.repeat(70));
  console.log('  SUMMARY REPORT');
  console.log('='.repeat(70));

  // Changes made
  if (allChanges.length > 0) {
    console.log('\n--- Changes Applied ---\n');
    for (const c of allChanges) {
      if (c.field === 'damage') {
        console.log(`  ${c.boss} / ${c.ability}: damage ${c.from} -> ${c.to}`);
      } else if (c.field === 'maxHealth') {
        console.log(`  ${c.boss}: HP ${c.from} -> ${c.to}`);
      }
    }
  } else {
    console.log('\n  No changes applied (dry-run or already tuned).');
  }

  // All warnings
  const allWarnings = [
    ...(phase3Data?.warnings || []),
    ...(phase4Data?.skillWarnings || []),
  ];

  if (allWarnings.length > 0) {
    console.log('\n--- All Warnings ---\n');

    const byLevel = { HIGH: [], MEDIUM: [], LOW: [] };
    for (const w of allWarnings) {
      byLevel[w.severity] = byLevel[w.severity] || [];
      byLevel[w.severity].push(w);
    }

    for (const level of ['HIGH', 'MEDIUM', 'LOW']) {
      if (byLevel[level].length === 0) continue;
      const icon = level === 'HIGH' ? '!!!' : level === 'MEDIUM' ? ' ! ' : '   ';
      for (const w of byLevel[level]) {
        console.log(`${icon} [${level}] ${w.boss || ''} ${w.issue}`);
        console.log(`    Fix: ${w.fix}`);
      }
    }
  } else {
    console.log('\n  No warnings — all metrics within targets!');
  }

  // Boss HP summary
  if (phase2Results) {
    console.log('\n--- Recommended Boss HP ---\n');
    for (const r of phase2Results) {
      const target = (TARGET_WIN_RATES[r.bossLevel] * 100).toFixed(0);
      console.log(`  ${r.bossName}: HP ${r.hp} (target ${target}%, actual ${(r.winRate * 100).toFixed(0)}%)`);
    }
  }

  // Campaign summary
  if (phase5Data && phase5Data.length > 0) {
    console.log('\n--- Campaign Summary ---\n');
    const avgClear = phase5Data.reduce((s, r) => s + r.clearRate, 0) / phase5Data.length;
    console.log(`  Average full-clear rate: ${(avgClear * 100).toFixed(0)}%`);
    const best = phase5Data.sort((a, b) => b.clearRate - a.clearRate)[0];
    console.log(`  Best strategy: ${best.strategy} (${(best.clearRate * 100).toFixed(0)}%)`);
  }
}

// ===========================================================================
// Main
// ===========================================================================

async function main() {
  console.log('=== Pub Fight Auto-Pilot Tuner ===\n');
  console.log(`  Runs per iteration: ${RUNS_PER_ITERATION}`);
  console.log(`  HP search range: ${HP_MIN}-${HP_MAX}`);
  console.log(`  Tolerance: +/-${TOLERANCE} HP`);
  console.log(`  Lowest class HP: ${CLASS_MIN_HP} (one-shot threshold: ${ONE_SHOT_THRESHOLD})`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}${SKIP_HP ? ' (skip HP search)' : ''}`);

  const startTime = Date.now();
  const allChanges = [];

  // Load current boss data
  let bossesJSON = loadBossesJSON();

  // ---- Phase 1: Damage Audit ----
  const damageChanges = phase1DamageAudit(bossesJSON);
  allChanges.push(...damageChanges);

  // ---- Phase 2: Binary Search HP ----
  let phase2Results = null;
  if (!SKIP_HP) {
    phase2Results = await phase2BinarySearchHP(bossesJSON);

    // Apply tuned HP to bossesJSON
    for (const r of phase2Results) {
      const boss = bossesJSON.bosses.find(b => b.level === r.bossLevel);
      if (boss && boss.attributes.maxHealth !== r.hp) {
        allChanges.push({
          boss: r.bossName,
          field: 'maxHealth',
          from: boss.attributes.maxHealth,
          to: r.hp,
        });
        boss.attributes.maxHealth = r.hp;
      }
    }
  } else {
    console.log('\n--- Phase 2: Skipped (--skip-hp) ---');
  }

  // ---- Write changes before validation phases ----
  if (allChanges.length > 0 && !DRY_RUN) {
    saveBossesJSON(bossesJSON);
    console.log(`\n  Wrote ${allChanges.length} change(s) to shared/bosses.json`);
  } else if (allChanges.length > 0) {
    console.log(`\n  DRY RUN: ${allChanges.length} change(s) would be written to shared/bosses.json`);
  }

  // ---- Phase 3: Fight Quality ----
  const phase3Data = await phase3FightQuality(bossesJSON);

  // ---- Phase 4: Skill Impact ----
  const phase4Data = await phase4SkillImpact(bossesJSON);

  // ---- Phase 5: Campaign ----
  const phase5Data = await phase5Campaign();

  // ---- Phase 6: Summary ----
  phase6Summary(allChanges, phase2Results, phase3Data, phase4Data, phase5Data);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nTotal time: ${totalTime}s`);
}

main().catch(err => {
  console.error('Auto-tuner failed:', err);
  process.exit(1);
});
