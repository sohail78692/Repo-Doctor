export interface RiskAnalysis {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
}

export function calculateRiskScore(pr: {
    changedFiles: number;
    additions: number;
    deletions: number;
    filenames: string[];
}): RiskAnalysis {
    let score = 0;
    const reasons: string[] = [];

    // Files Changed
    if (pr.changedFiles > 20) {
        score += 20;
        reasons.push('Large number of files changed (> 20)');
    }

    // Total Churn
    if (pr.additions + pr.deletions > 800) {
        score += 20;
        reasons.push('High code churn (> 800 lines)');
    }

    // Sensitive Paths
    const sensitivePatterns = [
        /auth\//i,
        /migration/i,
        /infra\//i,
        /config\//i,
        /\.env/i,
        /security/i
    ];

    const sensitiveTouched = pr.filenames.filter(f =>
        sensitivePatterns.some(pattern => pattern.test(f))
    );

    if (sensitiveTouched.length > 0) {
        score += 25;
        reasons.push(`Sensitive paths touched: ${sensitiveTouched.slice(0, 3).join(', ')}${sensitiveTouched.length > 3 ? '...' : ''}`);
    }

    // Tests check
    const hasTests = pr.filenames.some(f =>
        f.includes('test') || f.includes('spec') || f.includes('__tests__')
    );
    if (!hasTests) {
        score += 15;
        reasons.push('No test changes detected');
    }

    // Docs check
    const hasDocs = pr.filenames.some(f =>
        f.endsWith('.md') || f.includes('docs/')
    );
    if (!hasDocs) {
        score += 10;
        reasons.push('No documentation changes detected');
    }

    // Clamp & Level
    score = Math.min(100, Math.max(0, score));

    let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (score >= 70) level = 'HIGH';
    else if (score >= 35) level = 'MEDIUM';

    return { score, level, reasons };
}
