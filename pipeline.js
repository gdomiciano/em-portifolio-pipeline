/**
 * pipeline.js
 * Orchestrates the full pipeline: ingest → analyze → sync
 * 
 * Run with: npm run pipeline
 * Or individual stages: npm run ingest | npm run analyze | npm run sync
 */

import { fetchAllRepos } from './ingest.js';
import { analyzeAllRepos } from './analyze.js';
import { syncToNotion } from './notion-sync.js';

const STAGES = {
  ingest: fetchAllRepos,
  analyze: analyzeAllRepos,
  sync: syncToNotion,
};

async function runPipeline(stages = ['ingest', 'analyze', 'sync']) {
  console.log('\n🚀 EM Portfolio Pipeline starting...\n');
  console.log(`   Stages: ${stages.join(' → ')}\n`);
  console.log('─'.repeat(50));

  const startTime = Date.now();

  for (const stage of stages) {
    const fn = STAGES[stage];
    if (!fn) {
      console.error(`❌ Unknown stage: ${stage}`);
      process.exit(1);
    }

    console.log(`\n▶ Stage: ${stage.toUpperCase()}`);
    console.log('─'.repeat(50));

    await fn();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('─'.repeat(50));
  console.log(`\n🎉 Pipeline complete in ${elapsed}s\n`);
  console.log('   Next steps:');
  console.log('   1. Open your Notion Repo Audit Board');
  console.log('   2. Review AI decisions — adjust any you disagree with');
  console.log('   3. Set priorities for Upgrade repos');
  console.log('   4. Run `npm run upgrade-plan` for detailed upgrade instructions\n');
}

// Support running individual stages via CLI: node src/pipeline.js analyze
const args = process.argv.slice(2);
const stagesToRun = args.length > 0 ? args : ['ingest', 'analyze', 'sync'];

runPipeline(stagesToRun).catch(err => {
  console.error('\n❌ Pipeline failed:', err.message);
  process.exit(1);
});
