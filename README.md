# 🤖 EM Portfolio Pipeline

> An AI-SDLC tool that audits your GitHub repos, scores them for Engineering Manager portfolio value, and syncs results to Notion — automatically.

Built by Geisy Domiciano as both a **portfolio tool** and a **portfolio piece**.

---

## What it does

1. **Ingests** all your GitHub repos via the GitHub API
2. **Analyzes** each repo using Claude API — scoring completeness, README quality, and EM signal value
3. **Classifies** every repo: Keep / Upgrade / Archive / Merge / Delete
4. **Syncs** results to a Notion dashboard for review and action planning
5. **Generates** upgrade plans for repos worth keeping

## Why this exists

An EM portfolio isn't just code — it's a demonstration of systems thinking, product sense, and how you lead through tooling. This project is all three at once.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Repo ingestion | Node.js + Octokit |
| AI analysis | Claude API (`claude-sonnet-4-6`) |
| Dashboard sync | Notion API |
| Config | `.env` + JSON |

---

## Project Structure

```
em-portfolio-pipeline/
├── src/
│   ├── ingest.js          # Fetch all repos from GitHub API
│   ├── analyze.js         # Send each repo to Claude for analysis
│   ├── notion-sync.js     # Push results to Notion Repo Audit Board
│   └── prompts/
│       └── repo-classifier.js   # The Claude prompt (versioned)
├── output/
│   └── repos.json         # Raw + enriched repo data (gitignored)
├── .env.example
├── package.json
└── README.md
```

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/gdomiciano/em-portfolio-pipeline
cd em-portfolio-pipeline
npm install

# 2. Configure environment
cp .env.example .env
# Fill in: GITHUB_TOKEN, ANTHROPIC_API_KEY, NOTION_TOKEN, NOTION_DATABASE_ID

# 3. Run the full pipeline
npm run pipeline

# Or run individual stages:
npm run ingest     # Fetch repos only
npm run analyze    # Run AI analysis on existing repos.json
npm run sync       # Push to Notion only
```

---

## Architecture Decision Records

### ADR-001: Why Claude over GPT-4?
Claude's context window and instruction-following make it more reliable for structured JSON output across 40+ sequential repo analyses. Consistency matters more than raw capability here.

### ADR-002: Why Notion over a custom dashboard?
Speed. We're actively interviewing. Notion gives a shareable, polished dashboard in hours instead of days. The portfolio site (Phase 3) will be Next.js — but the command center stays in Notion.

### ADR-003: Why output to JSON first, then Notion?
Decoupling ingestion from sync means you can re-run analysis without re-fetching GitHub, and re-sync Notion without re-running AI (which costs tokens). Each stage is independently restartable.

---

## Contribution

This is a personal project, but it's built to be legible to a team. If you want to fork and adapt it:
- PRs welcome for new scoring dimensions
- The prompt in `src/prompts/repo-classifier.js` is the heart of the system — improve it and document the change

---

## License

MIT
