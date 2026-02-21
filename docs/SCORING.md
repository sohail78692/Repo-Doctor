# PR Risk Scoring

The Repo Doctor calculates a risk score (0-100) for every PR based on the following criteria:

| Criteria | Weight | Reason |
|----------|--------|--------|
| Large PR | +20 | More than 20 files changed |
| High Churn | +20 | More than 800 lines added/deleted |
| Sensitive Paths | +25 | Changes in auth, infra, config, or .env |
| No Tests | +15 | No files matching test/spec patterns |
| No Docs | +10 | No .md files or documentation changed |

## Risk Levels
- **LOW**: 0-34
- **MEDIUM**: 35-69
- **HIGH**: 70-100
