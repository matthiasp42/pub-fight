/**
 * Metrics aggregation across simulation runs.
 */

// ---------------------------------------------------------------------------
// Aggregate an array of FightMetrics from identical build/boss combos
// ---------------------------------------------------------------------------

/**
 * @param {import('./fightRunner.js').FightMetrics[]} runs
 * @returns {object} Aggregated statistics
 */
export function aggregateRuns(runs) {
  const total = runs.length;
  if (total === 0) return null;

  const wins = runs.filter(r => r.result === 'victory').length;
  const losses = runs.filter(r => r.result === 'defeat').length;
  const timeouts = runs.filter(r => r.result === 'timeout').length;

  const winRate = wins / total;

  // Wilson confidence interval (95%)
  const z = 1.96;
  const pHat = winRate;
  const denom = 1 + z * z / total;
  const center = (pHat + z * z / (2 * total)) / denom;
  const spread = z * Math.sqrt((pHat * (1 - pHat) + z * z / (4 * total)) / total) / denom;
  const ciLow = Math.max(0, center - spread);
  const ciHigh = Math.min(1, center + spread);

  // Turn counts
  const winTurns = runs.filter(r => r.result === 'victory').map(r => r.turns);
  const lossTurns = runs.filter(r => r.result === 'defeat').map(r => r.turns);

  // Action usage across all runs
  const actionCounts = {};
  const actionCountsWins = {};
  const actionCountsLosses = {};
  for (const r of runs) {
    const bucket = r.result === 'victory' ? actionCountsWins : actionCountsLosses;
    for (const [aid, count] of Object.entries(r.actionsUsed)) {
      actionCounts[aid] = (actionCounts[aid] || 0) + count;
      bucket[aid] = (bucket[aid] || 0) + count;
    }
  }

  // Boss healing
  const totalBossHealing = runs.reduce((s, r) => s + r.bossHealingDone, 0);
  const totalShieldAbsorbed = runs.reduce((s, r) => s + r.shieldAbsorbed, 0);

  // Player damage
  const totalPlayerDamage = runs.reduce((s, r) => {
    return s + Object.values(r.playerDamageDealt).reduce((a, b) => a + b, 0);
  }, 0);

  return {
    total,
    wins,
    losses,
    timeouts,
    winRate,
    ciLow,
    ciHigh,
    avgWinTurns: mean(winTurns),
    medianWinTurns: median(winTurns),
    avgLossTurns: mean(lossTurns),
    medianLossTurns: median(lossTurns),
    actionCounts,
    actionCountsWins,
    actionCountsLosses,
    avgBossHealing: totalBossHealing / total,
    avgShieldAbsorbed: totalShieldAbsorbed / total,
    avgPlayerDamage: totalPlayerDamage / total,
  };
}

// ---------------------------------------------------------------------------
// Attribute correlation with win rate
// ---------------------------------------------------------------------------

/**
 * Given an array of { attributes: {...}, winRate: number } entries,
 * compute Pearson correlation of each attribute with win rate.
 *
 * @param {Array<{attributes: object, winRate: number}>} data
 * @returns {Object<string, number>} attribute -> correlation coefficient
 */
export function attributeCorrelation(data) {
  if (data.length < 3) return {};

  const attrKeys = Object.keys(data[0].attributes);
  const results = {};

  for (const key of attrKeys) {
    const xs = data.map(d => d.attributes[key]);
    const ys = data.map(d => d.winRate);
    results[key] = pearson(xs, ys);
  }

  return results;
}

/**
 * Skill impact: for each skill, compare win rate of builds WITH the skill
 * versus builds WITHOUT it.
 *
 * @param {Array<{skillIds: string[], winRate: number}>} data
 * @returns {Array<{skillId: string, delta: number, withRate: number, withoutRate: number, inWinPct: number}>}
 */
export function skillImpact(data) {
  // Collect all unique skill IDs
  const allSkills = new Set();
  for (const d of data) {
    for (const s of d.skillIds) allSkills.add(s);
  }

  const results = [];
  for (const skillId of allSkills) {
    const withSkill = data.filter(d => d.skillIds.includes(skillId));
    const withoutSkill = data.filter(d => !d.skillIds.includes(skillId));

    if (withSkill.length === 0 || withoutSkill.length === 0) continue;

    const withRate = mean(withSkill.map(d => d.winRate));
    const withoutRate = mean(withoutSkill.map(d => d.winRate));

    // % of wins that include this skill
    const winsWithSkill = withSkill.filter(d => d.winRate > 0.5).length;
    const totalWins = data.filter(d => d.winRate > 0.5).length;
    const inWinPct = totalWins > 0 ? winsWithSkill / totalWins : 0;

    results.push({
      skillId,
      delta: withRate - withoutRate,
      withRate,
      withoutRate,
      inWinPct,
    });
  }

  results.sort((a, b) => b.delta - a.delta);
  return results;
}

/**
 * Detect outlier win rates (too easy / too hard).
 *
 * @param {Array<{label: string, winRate: number, total: number}>} entries
 * @param {number} easyThreshold - win rate above this = too easy (default 0.90)
 * @param {number} hardThreshold - win rate below this = too hard (default 0.10)
 * @returns {Array<{label: string, winRate: number, type: 'too_easy'|'too_hard'}>}
 */
export function detectOutliers(entries, easyThreshold = 0.90, hardThreshold = 0.10) {
  const warnings = [];
  for (const e of entries) {
    if (e.total < 10) continue; // Skip low-sample entries
    if (e.winRate >= easyThreshold) {
      warnings.push({ label: e.label, winRate: e.winRate, type: 'too_easy' });
    } else if (e.winRate <= hardThreshold) {
      warnings.push({ label: e.label, winRate: e.winRate, type: 'too_hard' });
    }
  }
  return warnings;
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}
