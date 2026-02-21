# Configuration Guide

## Labeling Rules (`config/default-rules.json`)
You can customize how labels are applied based on:
- **Path Rules**: Match file paths to specific labels.
- **Title Rules**: Use regex to match PR titles.
- **Size Rules**: Define thresholds for size labeling (s, m, l, xl).

## Stale Manager (`config/default-stale.json`)
- `staleThresholdDays`: Days of inactivity before marking as stale.
- `closeThresholdDays`: Days of inactivity while stale before closing.
- `ignoreLabels`: List of labels that prevent an item from becoming stale.
