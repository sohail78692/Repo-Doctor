import { describe, it, expect } from 'vitest';
import { getLabelsForPR } from '@/lib/label-rules';

describe('getLabelsForPR', () => {
    it('should apply labels based on paths', () => {
        const labels = getLabelsForPR({
            title: 'update something',
            filenames: ['auth/provider.ts', 'docs/api.md'],
            additions: 10,
            deletions: 5,
        });
        expect(labels).toContain('area/auth');
        expect(labels).toContain('area/docs');
    });

    it('should apply labels based on title regex', () => {
        const labels = getLabelsForPR({
            title: 'fix: something broken',
            filenames: ['src/index.ts'],
            additions: 10,
            deletions: 5,
        });
        expect(labels).toContain('type/bug');
    });

    it('should apply size labels correctly', () => {
        const s = getLabelsForPR({ title: 'x', filenames: [], additions: 50, deletions: 0 });
        const m = getLabelsForPR({ title: 'x', filenames: [], additions: 300, deletions: 0 });
        const xl = getLabelsForPR({ title: 'x', filenames: [], additions: 2000, deletions: 0 });

        expect(s).toContain('size/s');
        expect(m).toContain('size/m');
        expect(xl).toContain('size/xl');
    });
});
