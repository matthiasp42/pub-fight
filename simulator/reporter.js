/**
 * Report generator — console + markdown output.
 */

import { writeFileSync } from 'node:fs';
import bossData from '../shared/bosses.json' with { type: 'json' };
import { ALL_SKILLS } from '../server/dist/skills/index.js';

const _bossJson = bossData.default || bossData;
const BOSS_DEFINITIONS = _bossJson.bosses;

// ---------------------------------------------------------------------------
// Console reporter
// ---------------------------------------------------------------------------

/**
 * Print a full balance report to the console and optionally to a markdown file.
 *
 * @param {object} report - The assembled report data
 * @param {string|null} outputPath - If set, write markdown to this file
 */
export function printReport(report, outputPath = null) {
  const lines = [];
  const md = [];

  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

  lines.push('');
  lines.push(`BALANCE REPORT — ${timestamp}`);
  lines.push(`Runs per combo: ${report.runsPerCombo} | AI: ${report.aiStrategy}`);
  lines.push('='.repeat(70));

  md.push(`# Balance Report — ${timestamp}`);
  md.push('');
  md.push(`- Runs per combo: ${report.runsPerCombo}`);
  md.push(`- AI strategy: ${report.aiStrategy}`);
  md.push('');

  // Win rate tables per party size
  for (const [partySize, table] of Object.entries(report.winRateTables)) {
    lines.push('');
    lines.push(`=== WIN RATES (${partySize}-player party) ===`);
    md.push(`## Win Rates (${partySize}-player party)`);
    md.push('');

    const bossNames = BOSS_DEFINITIONS.map(b => b.name.split(' ').pop()); // Short names
    const bossLevels = BOSS_DEFINITIONS.map(b => b.level);

    // Header
    const header = padRight('Build', 30) + bossNames.map(n => padRight(n, 10)).join('');
    lines.push(header);
    lines.push('-'.repeat(header.length));

    const mdHeader = `| Build | ${bossNames.join(' | ')} |`;
    const mdSep = `|${'-'.repeat(31)}|${bossNames.map(() => '-'.repeat(11) + '|').join('')}`;
    md.push(mdHeader);
    md.push(mdSep);

    for (const row of table) {
      const label = padRight(row.label, 30);
      const cells = bossLevels.map(level => {
        const entry = row.byBoss[level];
        if (!entry) return padRight('--', 10);
        return padRight(pct(entry.winRate), 10);
      });
      lines.push(label + cells.join(''));

      const mdCells = bossLevels.map(level => {
        const entry = row.byBoss[level];
        return entry ? pct(entry.winRate) : '--';
      });
      md.push(`| ${padRight(row.label, 29)} | ${mdCells.join(' | ')} |`);
    }
    md.push('');
  }

  // Warnings
  if (report.warnings.length > 0) {
    lines.push('');
    lines.push('=== WARNINGS ===');
    md.push('## Warnings');
    md.push('');

    for (const w of report.warnings) {
      const icon = w.type === 'too_easy' ? 'TOO EASY' : 'TOO HARD';
      lines.push(`[!] ${icon}: ${w.label}: ${pct(w.winRate)} win rate`);
      md.push(`- **${icon}**: ${w.label}: ${pct(w.winRate)} win rate`);
    }

    // Dead stats
    for (const ds of report.deadStats) {
      lines.push(`[!] DEAD STAT: '${ds.attr}' — ${ds.correlation.toFixed(2)} correlation with win rate`);
      md.push(`- **DEAD STAT**: \`${ds.attr}\` — ${ds.correlation.toFixed(2)} correlation with win rate`);
    }

    // Trap skills (passives with no effect)
    for (const ts of report.trapSkills) {
      lines.push(`[!] TRAP SKILL: ${ts.id} (${ts.type}, no combat effect detected)`);
      md.push(`- **TRAP SKILL**: \`${ts.id}\` (${ts.type}, no combat effect detected)`);
    }
    md.push('');
  }

  // Skill impact
  if (report.skillImpacts.length > 0) {
    lines.push('');
    lines.push('=== SKILL IMPACT (win rate WITH - win rate WITHOUT) ===');
    md.push('## Skill Impact');
    md.push('');
    md.push('| Skill | Delta | With | Without |');
    md.push('|-------|-------|------|---------|');

    for (const si of report.skillImpacts) {
      const sign = si.delta >= 0 ? '+' : '';
      lines.push(`  ${padRight(si.skillId, 25)} ${sign}${pct(si.delta)} (with: ${pct(si.withRate)}, without: ${pct(si.withoutRate)})`);
      md.push(`| ${si.skillId} | ${sign}${pct(si.delta)} | ${pct(si.withRate)} | ${pct(si.withoutRate)} |`);
    }
    md.push('');
  }

  // Progressive campaign results
  if (report.progressive && report.progressive.length > 0) {
    lines.push('');
    lines.push('=== CAMPAIGN (progressive 1→7) ===');
    md.push('## Campaign (Progressive 1→7)');
    md.push('');
    md.push('| Build | Clear Rate | Avg Bosses Cleared |');
    md.push('|-------|------------|-------------------|');

    for (const p of report.progressive) {
      lines.push(`  ${padRight(p.label, 35)} ${pct(p.clearRate)} full clear (avg ${p.avgBossesCleared.toFixed(1)} bosses)`);
      md.push(`| ${p.label} | ${pct(p.clearRate)} | ${p.avgBossesCleared.toFixed(1)} |`);
    }
    md.push('');
  }

  // Print to console
  for (const line of lines) {
    console.log(line);
  }

  // Write markdown
  if (outputPath) {
    writeFileSync(outputPath, md.join('\n'), 'utf-8');
    console.log(`\nReport written to ${outputPath}`);
  }
}

// ---------------------------------------------------------------------------
// Identify trap skills (passives that can't fire because passive system is dead)
// ---------------------------------------------------------------------------

export function findTrapSkills() {
  return ALL_SKILLS
    .filter(s => s.type === 'passive')
    .map(s => ({ id: s.id, name: s.name, type: 'passive', class: s.class }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(n) {
  return `${(n * 100).toFixed(0)}%`;
}

function padRight(str, len) {
  if (str.length >= len) return str.substring(0, len);
  return str + ' '.repeat(len - str.length);
}
