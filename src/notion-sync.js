/**
 * notion-sync.js
 * Reads enriched output/repos.json and creates/updates rows in the Notion Repo Audit Board.
 *
 * ADR-002: Notion as the command center — fast to set up, shareable with interviewers.
 * ADR-003: Sync is decoupled from ingestion and analysis — run independently.
 */

import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, '..', 'output', 'repos.json');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DATABASE_ID = process.env.NOTION_DATABASE_ID;

// Map AI decision to priority
function inferPriority(repo) {
  if (repo.ai_decision === 'Keep') return 'P0 - Do Now';
  if (repo.ai_decision === 'Upgrade') return 'P1 - This Week';
  if (repo.ai_decision === 'Merge') return 'P2 - Next Sprint';
  return 'P3 - Backlog';
}

// Map language string to Notion multi-select value
function mapLanguageToStack(repo) {
  const lang = repo.language?.toLowerCase() || '';
  const desc = (repo.description || '').toLowerCase();
  const tags = [];

  if (lang === 'vue' || desc.includes('vue') || desc.includes('nuxt')) tags.push('Vue/Nuxt');
  if (lang === 'javascript' || lang === 'typescript') tags.push('JavaScript');
  if (desc.includes('react') || desc.includes('next')) tags.push('React/Next');
  if (desc.includes('node') || desc.includes('express')) tags.push('Node');
  if (lang === 'php') tags.push('PHP');
  if (lang === 'python') tags.push('Python');
  if (lang === 'html') tags.push('HTML/CSS');
  if (desc.includes('ai') || desc.includes('llm') || desc.includes('claude') || desc.includes('gpt')) tags.push('AI/LLM');

  if (tags.length === 0) tags.push('JavaScript'); // default

  return tags;
}

async function createNotionRow(repo) {
  const techStack = mapLanguageToStack(repo);
  const priority = inferPriority(repo);

  const properties = {
    'Repo Name': {
      title: [{ text: { content: repo.name } }],
    },
    'GitHub URL': {
      url: repo.url,
    },
    'Tech Stack': {
      multi_select: techStack.map(name => ({ name })),
    },
    'Completeness Score': {
      number: repo.ai_completeness_score,
    },
    'AI Analysis': {
      rich_text: [{ text: { content: repo.ai_analysis || '' } }],
    },
    'Upgrade Plan': {
      rich_text: [{ text: { content: repo.ai_upgrade_plan || '' } }],
    },
    'Priority': {
      select: { name: priority },
    },
  };

  // Only set Decision if we have one
  if (repo.ai_decision) {
    properties['Decision'] = { select: { name: repo.ai_decision } };
  }

  if (repo.ai_readme_quality) {
    properties['README Quality'] = { select: { name: repo.ai_readme_quality } };
  }

  if (repo.ai_em_signals?.length) {
    properties['EM Signal'] = {
      multi_select: repo.ai_em_signals.map(name => ({ name })),
    };
  }

  if (repo.last_push) {
    properties['Last Active'] = {
      date: { start: repo.last_push.slice(0, 10) },
    };
  }

  await notion.pages.create({
    parent: { database_id: DATABASE_ID },
    properties,
  });
}

async function syncToNotion() {
  if (!fs.existsSync(OUTPUT_FILE)) {
    console.error('❌ No repos.json found. Run `npm run ingest` and `npm run analyze` first.');
    process.exit(1);
  }

  if (!DATABASE_ID) {
    console.error('❌ NOTION_DATABASE_ID not set in .env');
    process.exit(1);
  }

  const repos = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
  const analyzed = repos.filter(r => r.ai_decision !== null);

  console.log(`\n📤 Syncing ${analyzed.length} repos to Notion...\n`);

  let success = 0;
  let failed = 0;

  for (const repo of analyzed) {
    try {
      process.stdout.write(`  Syncing ${repo.name}... `);
      await createNotionRow(repo);
      console.log('✅');
      success++;
      // Small delay to avoid Notion rate limits
      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`❌ ${err.message}`);
      failed++;
    }
  }

  console.log(`\n✅ Sync complete! ${success} succeeded, ${failed} failed.\n`);
  console.log(`   View your Repo Audit Board in Notion to review and adjust decisions.\n`);
}

export { syncToNotion };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncToNotion().catch(console.error);
}
