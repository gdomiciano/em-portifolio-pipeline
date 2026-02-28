/**
 * import-manual-analysis.js
 * Reads Claude's JSON response from output/claude-response.json
 * and merges the analysis back into output/repos.json.
 * Then you can run `npm run sync` to push results to Notion.
 *
 * Usage:
 *   npm run import-analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const REPOS_FILE = path.join(OUTPUT_DIR, 'repos.json');
const RESPONSE_FILE = path.join(OUTPUT_DIR, 'claude-response.json');

const VALID_DECISIONS = ['Keep', 'Upgrade', 'Archive', 'Merge', 'Delete'];
const VALID_README_QUALITY = ['None', 'Minimal', 'Decent', 'Strong'];
const VALID_EM_SIGNALS = ['Technical Vision', 'People Leadership', 'Process & Tooling', 'Delivery', 'AI/SDLC'];

function validateEntry(entry, index) {
  const errors = [];

  if (!entry.name) errors.push('missing "name"');
  if (!VALID_DECISIONS.includes(entry.decision)) errors.push(`invalid decision: "${entry.decision}"`);
  if (!VALID_README_QUALITY.includes(entry.readme_quality)) errors.push(`invalid readme_quality: "${entry.readme_quality}"`);
  if (typeof entry.completeness_score !== 'number' || entry.completeness_score < 0 || entry.completeness_score > 100) {
    errors.push(`invalid completeness_score: ${entry.completeness_score}`);
  }
  if (!Array.isArray(entry.em_signals)) errors.push('em_signals must be an array');

  if (errors.length > 0) {
    console.warn(`  ⚠️  Entry ${index + 1} (${entry.name || 'unknown'}) has issues: ${errors.join(', ')}`);
    return false;
  }
  return true;
}

function main() {
  if (!fs.existsSync(REPOS_FILE)) {
    console.error('❌ No repos.json found. Run `npm run ingest` first.');
    process.exit(1);
  }

  if (!fs.existsSync(RESPONSE_FILE)) {
    console.error('❌ No claude-response.json found.');
    console.error('   Save Claude\'s JSON response as output/claude-response.json first.');
    process.exit(1);
  }

  const repos = JSON.parse(fs.readFileSync(REPOS_FILE, 'utf-8'));

  let analysisResults;
  try {
    const raw = fs.readFileSync(RESPONSE_FILE, 'utf-8').trim();
    // Strip markdown fences if Claude added them
    const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    analysisResults = JSON.parse(clean);
  } catch (err) {
    console.error('❌ Failed to parse claude-response.json:', err.message);
    console.error('   Make sure it contains valid JSON (a plain array, no markdown fences).');
    process.exit(1);
  }

  if (!Array.isArray(analysisResults)) {
    console.error('❌ claude-response.json must be a JSON array.');
    process.exit(1);
  }

  console.log(`\n📥 Importing ${analysisResults.length} analyses into repos.json...\n`);

  // Build a lookup map by repo name
  const analysisByName = {};
  analysisResults.forEach((entry, i) => {
    if (validateEntry(entry, i)) {
      analysisByName[entry.name] = entry;
    }
  });

  const results = { Keep: 0, Upgrade: 0, Archive: 0, Merge: 0, Delete: 0 };
  let matched = 0;
  let unmatched = 0;

  for (const repo of repos) {
    const analysis = analysisByName[repo.name];
    if (!analysis) {
      unmatched++;
      continue;
    }

    repo.ai_decision = analysis.decision;
    repo.ai_em_signals = analysis.em_signals;
    repo.ai_completeness_score = analysis.completeness_score;
    repo.ai_readme_quality = analysis.readme_quality;
    repo.ai_analysis = analysis.analysis;
    repo.ai_upgrade_plan = analysis.upgrade_plan || '';

    results[analysis.decision] = (results[analysis.decision] || 0) + 1;
    matched++;

    const emoji = { Keep: '✅', Upgrade: '🔧', Archive: '📦', Merge: '🔀', Delete: '🗑️' }[analysis.decision];
    console.log(`  ${emoji} ${repo.name} → ${analysis.decision} (${analysis.completeness_score}/100)`);
  }

  fs.writeFileSync(REPOS_FILE, JSON.stringify(repos, null, 2));

  console.log('\n✅ Import complete!\n');
  console.log('📊 Decision Summary:');
  Object.entries(results).forEach(([decision, count]) => {
    const emoji = { Keep: '✅', Upgrade: '🔧', Archive: '📦', Merge: '🔀', Delete: '🗑️' }[decision];
    console.log(`   ${emoji} ${decision}: ${count}`);
  });

  if (unmatched > 0) {
    console.log(`\n   ⚠️  ${unmatched} repos in repos.json had no match in claude-response.json`);
  }

  console.log(`\n   repos.json updated: ${REPOS_FILE}\n`);
  console.log('📌 Next step: run `npm run sync` to push results to Notion.\n');
}

main();
