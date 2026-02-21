import rules from '@/config/default-rules.json';

export function getLabelsForPR(pr: {
    title: string;
    filenames: string[];
    additions: number;
    deletions: number;
}): string[] {
    const labels = new Set<string>();

    // Path Rules
    for (const rule of rules.pathRules) {
        if (pr.filenames.some(f => f.includes(rule.pattern))) {
            labels.add(rule.label);
        }
    }

    // Title Rules
    for (const rule of rules.titleRules) {
        if (new RegExp(rule.regex, 'i').test(pr.title)) {
            labels.add(rule.label);
        }
    }

    // Size Rules
    const totalDiff = pr.additions + pr.deletions;
    if (totalDiff <= rules.sizeRules.s.max) {
        labels.add(rules.sizeRules.s.label);
    } else if (totalDiff <= rules.sizeRules.m.max) {
        labels.add(rules.sizeRules.m.label);
    } else if (totalDiff <= rules.sizeRules.l.max) {
        labels.add(rules.sizeRules.l.label);
    } else {
        labels.add(rules.sizeRules.xl.label);
    }

    return Array.from(labels);
}
