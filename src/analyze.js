/**
 * analyze.js
 * Reads output/repos.json, sends each repo to Claude API for classification,
 * and writes enriched results back to output/repos.json
 *
 * ADR-001: We use claude-sonnet-4-6 for consistent structured JSON output at scale.
 * ADR-003: We read from and write to repos.json so ingestion and analysis are decoupled.
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { buildRepoClassifierPrompt, PROMPT_VERSION } from './prompts/repo-classifier.js';

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'repos.json');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function analyzeRepo(repo) {
  const prompt = buildRepoClassifierPrompt(repo);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].text.trim();

  // Strip any accidental markdown fences
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  try {
    return JSON.parse(clean);
  } catch (err) {
    console.error(`  ⚠️  JSON parse failed for ${repo.name}:`, raw.slice(0, 100));
    return {
      decision: 'Archive',
      em_signals: [],
      completeness_score: 0,
      readme_quality: 'None',
      analysis: 'AI parse error — defaulting to Archive for manual review.',
      upgrade_plan: '',
    };
  }
}

async function analyzeAllRepos() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error('❌ No repos.json found. Run `npm run ingest` first.');
    process.exit(1);
  }

  const repos = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  const needsAnalysis = repos.filter(r => r.ai_decision === null);

  console.log(`\n🤖 Analyzing ${needsAnalysis.length} repos with Claude (prompt ${PROMPT_VERSION})...\n`);
  console.log(`   Skipping ${repos.length - needsAnalysis.length} already-analyzed repos.\n`);

  const results = { Keep: 0, Upgrade: 0, Archive: 0, Merge: 0, Delete: 0 };

  for (let i = 0; i < repos.length; i++) {
    const repo = repos[i];

    if (repo.ai_decision !== null) {
      results[repo.ai_decision] = (results[repo.ai_decision] || 0) + 1;
      continue;
    }

    process.stdout.write(`  [${i + 1}/${repos.length}] ${repo.name}... `);

    try {
      const analysis = await analyzeRepo(repo);

      repo.ai_decision = analysis.decision;
      repo.ai_em_signals = analysis.em_signals;
      repo.ai_completeness_score = analysis.completeness_score;
      repo.ai_readme_quality = analysis.readme_quality;
      repo.ai_analysis = analysis.analysis;
      repo.ai_upgrade_plan = analysis.upgrade_plan;

      results[analysis.decision] = (results[analysis.decision] || 0) + 1;

      console.log(`${analysis.decision} (${analysis.completeness_score}/100)`);

      // Save after every repo — so you don't lose progress if interrupted
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(repos, null, 2));

      // Rate limiting: 1 request per second
      await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.error(`\n  ❌ Error analyzing ${repo.name}:`, err.message);
    }
  }

  console.log('\n✅ Analysis complete!\n');
  console.log('📊 Decision Summary:');
  Object.entries(results).forEach(([decision, count]) => {
    const emoji = { Keep: '✅', Upgrade: '🔧', Archive: '📦', Merge: '🔀', Delete: '🗑️' }[decision] || '•';
    console.log(`   ${emoji} ${decision}: ${count}`);
  });
  console.log(`\n   Output updated: ${OUTPUT_FILE}\n`);

  return repos;
}

export { analyzeAllRepos };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  analyzeAllRepos().catch(console.error);
}
