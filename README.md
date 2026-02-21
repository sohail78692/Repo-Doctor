# 🩺 GitHub Repo Doctor

An all-in-one GitHub repository health tool built with Next.js, MongoDB Atlas, and Octokit. Zero paid APIs, maximum insights.

## 🚀 Features
- **PR Risk Scoring**: Automated risk assessment (0-100).
- **Checklist Generator**: Smart PR checklists based on file changes.
- **Rule-based Labeling**: Auto-label PRs by path, title, and size.
- **Stale Manager**: Keep your issues and PRs fresh.
- **Changelog Generator**: One-click markdown changelogs.
- **Weekly Reports**: Detailed maintainer metrics and health reports.

## 🛠️ Tech Stack
- **Framework**: Next.js 15+ (App Router)
- **Database**: MongoDB Atlas
- **GitHub API**: Octokit
- **Validation**: Zod
- **Testing**: Vitest

## 📋 Prerequisites
- Node.js 20+
- MongoDB Atlas cluster
- GitHub Personal Access Token (PAT) with `repo` scopes

## ⚙️ Setup
1. Clone the repo.
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and fill in your credentials.
4. Run locally: `npm run dev`

## 🧪 Testing
Run unit tests:
```bash
npm test
```

## 📖 Documentation
- [Scoring Rules](./docs/SCORING.md)
- [Configuration](./docs/CONFIG.md)
