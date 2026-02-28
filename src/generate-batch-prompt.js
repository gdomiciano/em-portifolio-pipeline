/**
 * generate-batch-prompt.js
 * Reads output/repos.json and builds a single prompt to paste into claude.ai.
 * Claude Pro can analyze all repos at once and return a JSON array.
 *
 * Usage:
 *   npm run generate-prompt
 *   → writes output/batch-prompt.txt (paste this into claude.ai)
 *   → after Claude responds, save the response as output/claude-response.json
 *   → run: npm run import-analysis
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const INPUT_FILE = path.join(OUTPUT_DIR, 'repos.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'batch-prompt.txt');

function buildBatchPrompt(repos) {
  const repoBlocks = repos.map((repo, i) => `### Repo ${i + 1}: ${repo.name}
- **Description:** ${repo.description || '(none)'}
- **Language:** ${repo.language}
- **Topics:** ${repo.topics.length ? repo.topics.join(', ') : '(none)'}
- **Stars:** ${repo.stars} | **Forks:** ${repo.forks}
- **Last commit:** ${repo.last_push?.slice(0, 10) || 'unknown'}
- **Created:** ${repo.created_at?.slice(0, 10) || 'unknown'}
- **Is fork:** ${repo.is_fork}
- **Has README:** ${repo.has_readme}
- **README excerpt:** ${repo.readme_excerpt ? repo.readme_excerpt.slice(0, 400) : '(none)'}`).join('\n\n');

  return `You are a senior Engineering Manager reviewing GitHub repositories to determine which belong in a candidate's EM portfolio.

The candidate is a 13+ year frontend engineer (Vue/Nuxt expertise) transitioning to an Engineering Manager role. They also have Node.js, React/Next.js, and AI/LLM experience.

## Scoring criteria
- **EM signal value** is more important than code complexity
- A simple project with a great README, ADRs, and CONTRIBUTING.md scores higher than a complex one with no docs
- Forks of tutorials with no modifications → Archive
- Community/course projects (Alura, Udemy, etc.) → Archive unless significantly extended
- Old hiring challenges (>3 years, no updates) → Archive unless impressive
- Projects showing systems thinking, architecture decisions, or team-enablement are gold

## Decision guide
- **Keep** — Already strong. Needs only minor polish.
- **Upgrade** — Good bones, needs specific work to be EM-ready.
- **Archive** — Not portfolio material. Move to archived on GitHub.
- **Merge** — Could be combined with another similar project for more impact.
- **Delete** — No value. Empty, broken, or purely duplicative.

---

## Repos to evaluate (${repos.length} total)

${repoBlocks}

---

## Your response

Return ONLY a JSON array with one object per repo, in the same order as above. No markdown fences, no explanation outside the JSON.

Each object must follow this exact shape:
{
  "name": "<repo name>",
  "decision": "Keep" | "Upgrade" | "Archive" | "Merge" | "Delete",
  "em_signals": [],
  "completeness_score": 0,
  "readme_quality": "None" | "Minimal" | "Decent" | "Strong",
  "analysis": "",
  "upgrade_plan": ""
}

Fields:
- "em_signals": zero or more of: ["Technical Vision", "People Leadership", "Process & Tooling", "Delivery", "AI/SDLC"]
- "completeness_score": integer 0-100
- "analysis": one sentence max — why this decision?
- "upgrade_plan": if decision is "Upgrade", list 2-4 specific actions. Otherwise empty string.`;
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ No repos.json found. Run `npm run ingest` first.');
    process.exit(1);
  }

  const repos = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  const unananalyzed = repos.filter(r => r.ai_decision === null);

  console.log(`\n📋 Building batch prompt for ${unananalyzed.length} repos...\n`);

  const prompt = buildBatchPrompt(unananalyzed);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, prompt, 'utf-8');

  const charCount = prompt.length;
  const approxTokens = Math.round(charCount / 4);

  console.log(`✅ Batch prompt written to: output/batch-prompt.txt`);
  console.log(`   Repos included: ${unananalyzed.length}`);
  console.log(`   Prompt size: ~${approxTokens.toLocaleString()} tokens (${charCount.toLocaleString()} chars)\n`);
  console.log('📌 Next steps:');
  console.log('   1. Open output/batch-prompt.txt');
  console.log('   2. Copy the entire contents');
  console.log('   3. Paste into claude.ai and send');
  console.log('   4. Copy Claude\'s JSON response');
  console.log('   5. Save it as output/claude-response.json');
  console.log('   6. Run: npm run import-analysis\n');
}

main();
