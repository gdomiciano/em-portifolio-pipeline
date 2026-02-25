/**
 * ingest.js
 * Fetches all public repos for a GitHub user and saves raw metadata to output/repos.json
 * 
 * ADR-003: We save to JSON first so analysis can be re-run without re-fetching.
 */

import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'repos.json');

const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'gdomiciano';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

async function fetchRepoReadme(owner, repo) {
  try {
    const { data } = await octokit.repos.getReadme({ owner, repo });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    // Return first 800 chars — enough for Claude to assess quality without blowing context
    return content.slice(0, 800);
  } catch {
    return null;
  }
}

async function fetchAllRepos() {
  console.log(`\n🔍 Fetching repos for @${GITHUB_USERNAME}...\n`);

  const repos = await octokit.paginate(octokit.repos.listForUser, {
    username: GITHUB_USERNAME,
    type: 'owner',
    sort: 'pushed',
    per_page: 100,
  });

  console.log(`📦 Found ${repos.length} repos. Fetching READMEs...\n`);

  const enriched = await Promise.all(
    repos.map(async (repo, i) => {
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, i * 100));

      const readme = await fetchRepoReadme(repo.owner.login, repo.name);

      const record = {
        name: repo.name,
        description: repo.description || '',
        url: repo.html_url,
        language: repo.language || 'Unknown',
        topics: repo.topics || [],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        last_push: repo.pushed_at,
        created_at: repo.created_at,
        is_fork: repo.fork,
        has_wiki: repo.has_wiki,
        has_pages: repo.has_pages,
        open_issues: repo.open_issues_count,
        readme_excerpt: readme,
        has_readme: readme !== null,
        // These will be filled by analyze.js
        ai_decision: null,
        ai_em_signals: [],
        ai_completeness_score: null,
        ai_readme_quality: null,
        ai_analysis: null,
        ai_upgrade_plan: null,
      };

      const readmeStatus = readme ? '✅' : '❌';
      console.log(`  ${readmeStatus} ${repo.name} (${repo.language || 'unknown'}) — last push: ${repo.pushed_at?.slice(0, 10)}`);

      return record;
    })
  );

  // Ensure output dir exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2));

  const withReadme = enriched.filter(r => r.has_readme).length;
  const withoutReadme = enriched.filter(r => !r.has_readme).length;
  const forks = enriched.filter(r => r.is_fork).length;

  console.log(`\n✅ Ingestion complete!`);
  console.log(`   Total repos: ${enriched.length}`);
  console.log(`   With README: ${withReadme}`);
  console.log(`   Without README: ${withoutReadme}`);
  console.log(`   Forks: ${forks}`);
  console.log(`   Output: ${OUTPUT_FILE}\n`);

  return enriched;
}

export { fetchAllRepos };

// Run directly if called as main
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  fetchAllRepos().catch(console.error);
}
