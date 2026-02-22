# GitHub Repo Doctor

GitHub Repo Doctor is a self-hosted repository health dashboard built with Next.js, MongoDB, and Octokit.  
It helps maintainers detect risk early, reduce stale backlog, and generate operational reports without paid APIs.

## What You Get
- PR risk scoring (`LOW`/`MEDIUM`/`HIGH`) with reasons.
- Auto-generated PR checklist from changed file paths.
- Stale issue/PR detection with optional automated action.
- Action Center queue for high-priority maintainer work.
- Commit and trend analytics (7/30/90 day engineering signals).
- Auto-changelog and weekly report markdown generation.
- Smart webhook alerts with per-repo thresholds and cooldowns.
- Multi-repo switcher so one deployment can analyze many repos.

## Stack
- Next.js 16 (App Router)
- React 19
- TypeScript
- MongoDB Atlas (`mongodb` driver)
- GitHub API (`@octokit/rest`)
- Vitest

## Quick Start
### 1. Prerequisites
- Node.js 20+
- MongoDB Atlas (or compatible MongoDB instance)
- GitHub token with access to target repositories

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy `.env.example` to `.env` and set values.

Required:
- `GITHUB_TOKEN`
- `GITHUB_OWNER`
- `MONGODB_URI`

Optional but useful:
- `GITHUB_REPO` (default repo if no `repo` query is provided)
- `MONGODB_DB_NAME` (default: `repo_doctor`)
- `REPO_DOCTOR_BOT_NAME` (default: `repo-doctor[bot]`)
- `NEXT_PUBLIC_GITHUB_OWNER` / `NEXT_PUBLIC_GITHUB_REPO` (UI default workspace repo)
- `ALERT_WEBHOOK_URL` (generic webhook destination)
- `ALERT_SLACK_WEBHOOK_URL` (Slack incoming webhook)
- `ALERT_DISCORD_WEBHOOK_URL` (Discord webhook; richer payload)
- `ALERT_CRON_SECRET` (protects `/api/alerts/cron`)

### 4. Run locally
```bash
npm run dev
```

Open `http://localhost:3000`.

### 5. Verify installation
- Dashboard should show `MongoDB Atlas: Online`.
- Dashboard should show `GitHub API: Online`.
- Pick a repo in the workspace switcher (`owner/repo`).

## Product Tour
### Dashboard (`/`)
Service health + entry point to all tools.

### PR Analyzer (`/pr`)
Analyzes PR by number, stores analysis, and posts/updates a GitHub comment.

### Commit History (`/commits`)
Shows full/range commit history and trend analytics from `/api/time-trends`.

### Action Center (`/actions`)
Prioritized queue for stale issues, stuck PRs, and missing reviewers.

### Smart Alerts (`/alerts`)
Per-repo alert rules, cooldowns, and manual/forced dispatch.

### Stale Issues (`/stale`)
Preview stale actions and optionally execute mark/close actions on GitHub.

### Changelog (`/changelog`)
Generates categorized markdown from merged PRs since last release.

### Weekly Report (`/report`)
Generates a markdown maintainer report for the last 7 days.

## API Reference
All endpoints support `?repo=owner/repo` to target a specific repository.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/status` | `GET` | Service health (MongoDB, GitHub, runtime). |
| `/api/repos` | `GET` | List up to 50 recently updated repos for authenticated user. |
| `/api/analyze-pr` | `POST` | Risk + checklist + GitHub comment upsert. |
| `/api/stale` | `GET` | Preview stale actions. |
| `/api/stale` | `POST` | Execute stale labeling/closing workflow. |
| `/api/action-center` | `GET` | Build prioritized maintainer task queue. |
| `/api/commit-history` | `GET` | Commit history aggregates (`scope=full|range`, optional `days`). |
| `/api/time-trends` | `GET` | 90-day trend metrics and chart series. |
| `/api/changelog` | `POST` | Generate changelog markdown. |
| `/api/weekly-report` | `POST` | Generate weekly report markdown. |
| `/api/alerts` | `GET/PUT/POST` | Load/update settings and dispatch alerts. |
| `/api/alerts/cron` | `POST` | Batch alert dispatch for enabled repos. |

Example: analyze PR #42
```bash
curl -X POST "http://localhost:3000/api/analyze-pr?repo=owner/repo" \
  -H "Content-Type: application/json" \
  -d "{\"pull_number\":42}"
```

Example: run stale scan action
```bash
curl -X POST "http://localhost:3000/api/stale?repo=owner/repo"
```

Example: cron dispatch with secret header
```bash
curl -X POST "http://localhost:3000/api/alerts/cron" \
  -H "x-repo-doctor-cron-secret: $ALERT_CRON_SECRET"
```

## Configuration
- Risk scoring weights and levels: `docs/SCORING.md`
- Labeling + stale settings overview: `docs/CONFIG.md`
- Default labeling rules: `config/default-rules.json`
- Default stale behavior/messages: `config/default-stale.json`

## Automation with GitHub Actions
This repo includes sample workflows in `.github/workflows` that call your deployed Repo Doctor service:
- `repo-doctor-pr.yml`: trigger PR analysis on PR events.
- `repo-doctor-weekly.yml`: run stale scan + weekly report on schedule.
- `repo-doctor-changelog.yml`: generate changelog on release publish.

Set `REPO_DOCTOR_URL` in GitHub Actions secrets for the target repo.

## Data Stored in MongoDB
Main collections:
- `pull_request_analyses`
- `issue_snapshots`
- `weekly_reports`
- `alert_settings`
- `alert_deliveries`

Indexes are created on startup in `lib/db.ts`.

## Development
Run tests:
```bash
npm run test
```

Run lint:
```bash
npm run lint
```

## Troubleshooting
- `Invalid repo format`: pass `?repo=owner/repo` or set `GITHUB_REPO`.
- GitHub offline in status: verify `GITHUB_TOKEN` scopes and repo access.
- MongoDB offline in status: verify `MONGODB_URI` and network allowlist.
- Alerts not sending: set one of `ALERT_WEBHOOK_URL`, `ALERT_SLACK_WEBHOOK_URL`, or `ALERT_DISCORD_WEBHOOK_URL`.
- Cron unauthorized: ensure request includes `ALERT_CRON_SECRET` via header if configured.

## License
No license file is currently defined in this repository.
