#!/usr/bin/env node

/**
 * Balance Simulator — CLI entry point.
 *
 * Usage:
 *   node simulator/simulate.js                      # full run (same-class parties)
 *   node simulator/simulate.js --mixed              # 4-player mixed party (one of each class)
 *   node simulator/simulate.js --class warrior       # one class only
 *   node simulator/simulate.js --boss 3              # one boss level
 *   node simulator/simulate.js --runs 1000           # runs per combo
 *   node simulator/simulate.js --party 2             # party size (ignored in mixed mode)
 *   node simulator/simulate.js --progressive         # campaign 1→7
 *   node simulator/simulate.js --ai aggressive       # player AI
 *   node simulator/simulate.js --output report.md    # save markdown
 */

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { cpus } from 'node:os';
import { parseArgs } from 'node:util';

import { BOSS_DEFINITIONS } from '../client/src/game/bosses.js';
import { CLASS_BASE_ATTRIBUTES } from '../server/dist/classes/index.js';
import {
  generateBuildsForClass,
  getClassNames,
  getStrategyNames,
  describeBuild,
  distributeAttributes,
} from './buildGenerator.js';
import { runFights } from './fightRunner.js';
import {
  aggregateRuns,
  attributeCorrelation,
  skillImpact,
  detectOutliers,
} from './metrics.js';
import { printReport, findTrapSkills } from './reporter.js';

// ---------------------------------------------------------------------------
// Worker thread support
// ---------------------------------------------------------------------------

if (!isMainThread) {
  // Worker: run fights for a single combo
  const { builds, bossLevel, aiStrategy, runs } = workerData;
  const results = runFights(builds, bossLevel, aiStrategy, runs);
  const agg = aggregateRuns(results);
  parentPort.postMessage(agg);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  options: {
    class: { type: 'string' },
    boss: { type: 'string' },
    runs: { type: 'string', default: '200' },
    party: { type: 'string', default: '2' },
    mixed: { type: 'boolean', default: false },
    progressive: { type: 'boolean', default: false },
    ai: { type: 'string', default: 'balanced' },
    output: { type: 'string' },
    workers: { type: 'string' },
  },
  strict: false,
});

const RUNS = parseInt(args.runs, 10);
const AI_STRATEGY = args.ai;
const CLASS_FILTER = args.class || null;
const BOSS_FILTER = args.boss ? parseInt(args.boss, 10) : null;
const PROGRESSIVE = args.progressive;
const MIXED = args.mixed;
const OUTPUT_PATH = args.output || null;
const NUM_WORKERS = parseInt(args.workers || String(Math.max(1, cpus().length - 2)), 10);

// In mixed mode, party is always 4 (one of each class)
const ALL_CLASSES = getClassNames();
const PARTY_SIZE = MIXED ? ALL_CLASSES.length : parseInt(args.party, 10);

// ---------------------------------------------------------------------------
// Determine combos to run
// ---------------------------------------------------------------------------

const classes = CLASS_FILTER ? [CLASS_FILTER] : ALL_CLASSES;
const bossLevels = BOSS_FILTER
  ? [BOSS_FILTER]
  : BOSS_DEFINITIONS.map(b => b.level);

console.log(`Simulator config:`);
if (MIXED) {
  console.log(`  Mode: MIXED PARTY (${ALL_CLASSES.join(' + ')})`);
} else {
  console.log(`  Classes: ${classes.join(', ')}`);
  console.log(`  Party size: ${PARTY_SIZE}`);
}
console.log(`  Boss levels: ${bossLevels.join(', ')}`);
console.log(`  Runs/combo: ${RUNS}`);
console.log(`  AI: ${AI_STRATEGY}`);
console.log(`  Workers: ${NUM_WORKERS}`);
if (PROGRESSIVE) console.log(`  Campaign: PROGRESSIVE (1→7)`);
console.log('');

// ---------------------------------------------------------------------------
// Run combos (worker-parallel or inline)
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);

function runComboInline(builds, bossLevel) {
  const results = runFights(builds, bossLevel, AI_STRATEGY, RUNS);
  return aggregateRuns(results);
}

function runComboWorker(builds, bossLevel) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(__filename, {
      workerData: { builds, bossLevel, aiStrategy: AI_STRATEGY, runs: RUNS },
    });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', code => {
      if (code !== 0) reject(new Error(`Worker exited with code ${code}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Helper: build a mixed party (one of each class) for a given level/strategy
// ---------------------------------------------------------------------------

function buildMixedParty(level, strategyName) {
  return ALL_CLASSES.map(cls => {
    const builds = generateBuildsForClass(cls, level);
    // Pick the first build matching this strategy
    const match = builds.find(b => b.strategyName === strategyName) || builds[0];
    return { ...match, level };
  });
}

// ---------------------------------------------------------------------------
// Standard simulation (same-class parties OR mixed)
// ---------------------------------------------------------------------------

async function runStandardSimulation() {
  const combos = [];

  if (MIXED) {
    // Mixed mode: one combo per strategy × boss level
    for (const strat of getStrategyNames()) {
      for (const bossLevel of bossLevels) {
        const partyBuilds = buildMixedParty(bossLevel, strat);
        const allSkills = partyBuilds.flatMap(b => b.skillIds);
        combos.push({
          label: `mixed/${strat}`,
          className: 'mixed',
          strategyName: strat,
          skillIds: allSkills,
          builds: partyBuilds,
          bossLevel,
          level: bossLevel,
        });
      }
    }
  } else {
    // Original mode: same-class parties
    for (const cls of classes) {
      for (const bossLevel of bossLevels) {
        const level = bossLevel;
        const builds = generateBuildsForClass(cls, level);

        const seen = new Set();
        for (const b of builds) {
          const key = `${b.className}/${b.strategyName}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const partyBuilds = Array(PARTY_SIZE).fill(b);
          combos.push({
            label: `${b.className}/${b.strategyName}`,
            className: b.className,
            strategyName: b.strategyName,
            skillIds: b.skillIds,
            builds: partyBuilds,
            bossLevel,
            level,
          });
        }
      }
    }
  }

  console.log(`Running ${combos.length} combos x ${RUNS} fights = ${(combos.length * RUNS).toLocaleString()} total fights...`);
  const startTime = Date.now();

  const comboResults = new Array(combos.length);
  let completed = 0;

  async function processCombo(idx) {
    const combo = combos[idx];
    if (NUM_WORKERS > 1) {
      comboResults[idx] = await runComboWorker(combo.builds, combo.bossLevel);
    } else {
      comboResults[idx] = runComboInline(combo.builds, combo.bossLevel);
    }
    completed++;
    if (completed % 10 === 0 || completed === combos.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      process.stdout.write(`\r  Progress: ${completed}/${combos.length} combos (${elapsed}s)`);
    }
  }

  for (let i = 0; i < combos.length; i += NUM_WORKERS) {
    const batch = [];
    for (let j = i; j < Math.min(i + NUM_WORKERS, combos.length); j++) {
      batch.push(processCombo(j));
    }
    await Promise.all(batch);
  }
  console.log('');

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Completed in ${elapsed}s`);

  // ---------------------------------------------------------------------------
  // Assemble report
  // ---------------------------------------------------------------------------

  const winRateTable = [];
  const allEntries = [];
  const attrWinData = [];
  const skillWinData = [];

  const byLabel = {};
  for (let i = 0; i < combos.length; i++) {
    const combo = combos[i];
    const agg = comboResults[i];
    if (!agg) continue;

    if (!byLabel[combo.label]) {
      byLabel[combo.label] = {
        label: combo.label,
        className: combo.className,
        strategyName: combo.strategyName,
        byBoss: {},
      };
    }
    byLabel[combo.label].byBoss[combo.bossLevel] = agg;

    const bossName = BOSS_DEFINITIONS.find(b => b.level === combo.bossLevel)?.name || `Boss ${combo.bossLevel}`;
    allEntries.push({
      label: `${combo.label} vs ${bossName} @ ${PARTY_SIZE}p`,
      winRate: agg.winRate,
      total: agg.total,
    });

    // Attribute correlation — in mixed mode, average across all party members
    if (MIXED) {
      const avgAttrs = {};
      for (const b of combo.builds) {
        const base = CLASS_BASE_ATTRIBUTES[b.className];
        if (!base) continue;
        const attrPoints = (b.level - 1) * 3;
        const attrs = distributeAttributes({ ...base }, attrPoints, b.strategyName);
        for (const [k, v] of Object.entries(attrs)) {
          avgAttrs[k] = (avgAttrs[k] || 0) + v / combo.builds.length;
        }
      }
      if (Object.keys(avgAttrs).length > 0) {
        attrWinData.push({ attributes: avgAttrs, winRate: agg.winRate });
      }
    } else {
      const base = CLASS_BASE_ATTRIBUTES[combo.className];
      if (base) {
        const attrPoints = (combo.level - 1) * 3;
        const attrs = distributeAttributes({ ...base }, attrPoints, combo.strategyName);
        attrWinData.push({ attributes: attrs, winRate: agg.winRate });
      }
    }

    skillWinData.push({
      skillIds: combo.skillIds || [],
      winRate: agg.winRate,
    });
  }

  for (const row of Object.values(byLabel)) {
    winRateTable.push(row);
  }
  winRateTable.sort((a, b) => a.label.localeCompare(b.label));

  const attrCorr = attributeCorrelation(attrWinData);
  const deadStats = Object.entries(attrCorr)
    .filter(([, corr]) => Math.abs(corr) < 0.05)
    .map(([attr, correlation]) => ({ attr, correlation }));

  const skillImpacts = skillImpact(skillWinData);
  const warnings = detectOutliers(allEntries);
  const trapSkills = findTrapSkills();

  const report = {
    runsPerCombo: RUNS,
    aiStrategy: AI_STRATEGY,
    winRateTables: { [PARTY_SIZE]: winRateTable },
    warnings,
    deadStats,
    trapSkills,
    skillImpacts,
    progressive: [],
  };

  printReport(report, OUTPUT_PATH);
}

// ---------------------------------------------------------------------------
// Progressive campaign simulation
// ---------------------------------------------------------------------------

async function runProgressiveSimulation() {
  console.log('Running progressive campaign simulation (levels 1→7)...\n');
  const startTime = Date.now();

  const campaignResults = [];

  if (MIXED) {
    // Mixed progressive: one run per strategy, party = one of each class
    for (const strat of getStrategyNames()) {
      let fullClears = 0;
      const bossesCleared = [];

      for (let run = 0; run < RUNS; run++) {
        let cleared = 0;

        for (let bossLevel = 1; bossLevel <= 7; bossLevel++) {
          const partyBuilds = buildMixedParty(bossLevel, strat);
          const results = runFights(partyBuilds, bossLevel, AI_STRATEGY, 1);
          if (results[0].result === 'victory') {
            cleared++;
          } else {
            break;
          }
        }

        bossesCleared.push(cleared);
        if (cleared === 7) fullClears++;
      }

      const clearRate = fullClears / RUNS;
      const avgBossesCleared = bossesCleared.reduce((a, b) => a + b, 0) / RUNS;

      campaignResults.push({
        label: `mixed/${strat} @ ${PARTY_SIZE}p`,
        clearRate,
        avgBossesCleared,
      });

      process.stdout.write(`\r  mixed/${strat}: ${(clearRate * 100).toFixed(0)}% full clear, avg ${avgBossesCleared.toFixed(1)} bosses`);
      console.log('');
    }
  } else {
    // Original: same-class parties
    for (const cls of classes) {
      for (const strat of getStrategyNames()) {
        let fullClears = 0;
        const bossesCleared = [];

        for (let run = 0; run < RUNS; run++) {
          let cleared = 0;

          for (let bossLevel = 1; bossLevel <= 7; bossLevel++) {
            const level = bossLevel;
            const allBuilds = generateBuildsForClass(cls, level);
            const matchingBuild = allBuilds.find(b => b.strategyName === strat) || allBuilds[0];

            const partyBuilds = Array(PARTY_SIZE).fill({
              ...matchingBuild,
              level,
            });

            const results = runFights(partyBuilds, bossLevel, AI_STRATEGY, 1);
            if (results[0].result === 'victory') {
              cleared++;
            } else {
              break;
            }
          }

          bossesCleared.push(cleared);
          if (cleared === 7) fullClears++;
        }

        const clearRate = fullClears / RUNS;
        const avgBossesCleared = bossesCleared.reduce((a, b) => a + b, 0) / RUNS;

        campaignResults.push({
          label: `${cls}/${strat} @ ${PARTY_SIZE}p`,
          clearRate,
          avgBossesCleared,
        });

        process.stdout.write(`\r  ${cls}/${strat}: ${(clearRate * 100).toFixed(0)}% full clear, avg ${avgBossesCleared.toFixed(1)} bosses`);
        console.log('');
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCampaign simulation completed in ${elapsed}s`);

  const report = {
    runsPerCombo: RUNS,
    aiStrategy: AI_STRATEGY,
    winRateTables: {},
    warnings: [],
    deadStats: [],
    trapSkills: findTrapSkills(),
    skillImpacts: [],
    progressive: campaignResults,
  };

  printReport(report, OUTPUT_PATH);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

if (PROGRESSIVE) {
  runProgressiveSimulation().catch(err => {
    console.error('Simulation failed:', err);
    process.exit(1);
  });
} else {
  runStandardSimulation().catch(err => {
    console.error('Simulation failed:', err);
    process.exit(1);
  });
}
