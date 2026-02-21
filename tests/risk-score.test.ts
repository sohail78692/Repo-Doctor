import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '@/lib/risk-score';

describe('calculateRiskScore', () => {
    it('should return LOW score for small PR with tests and docs', () => {
        const analysis = calculateRiskScore({
            changedFiles: 2,
            additions: 50,
            deletions: 10,
            filenames: ['src/app.ts', 'tests/app.test.ts', 'README.md'],
        });
        expect(analysis.score).toBe(0);
        expect(analysis.level).toBe('LOW');
    });

    it('should return HIGH score for risky PR', () => {
        const analysis = calculateRiskScore({
            changedFiles: 25,
            additions: 1000,
            deletions: 200,
            filenames: ['auth/login.ts', 'infra/db.yaml'],
        });
        expect(analysis.score).toBeGreaterThanOrEqual(70);
        expect(analysis.level).toBe('HIGH');
        expect(analysis.reasons).toContain('Large number of files changed (> 20)');
        expect(analysis.reasons).toContain('High code churn (> 800 lines)');
        expect(analysis.reasons).toContain('No test changes detected');
    });

    it('should identify sensitive paths', () => {
        const analysis = calculateRiskScore({
            changedFiles: 1,
            additions: 10,
            deletions: 0,
            filenames: ['config/secrets.json'],
        });
        expect(analysis.reasons.some(r => r.includes('Sensitive paths touched'))).toBe(true);
    });
});
