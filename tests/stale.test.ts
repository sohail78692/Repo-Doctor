import { describe, it, expect } from 'vitest';
import { getStaleAction } from '@/lib/stale';
import { subDays } from 'date-fns';

describe('getStaleAction', () => {
    it('should mark as stale after 30 days', () => {
        const action = getStaleAction({
            updatedAt: subDays(new Date(), 31),
            labels: [],
            isStale: false,
        });
        expect(action.type).toBe('MARK_STALE');
    });

    it('should close after 7 days of being stale', () => {
        const action = getStaleAction({
            updatedAt: subDays(new Date(), 8),
            labels: ['stale'],
            isStale: true,
        });
        expect(action.type).toBe('CLOSE');
    });

    it('should ignore items with protected labels', () => {
        const action = getStaleAction({
            updatedAt: subDays(new Date(), 100),
            labels: ['pinned'],
            isStale: false,
        });
        expect(action.type).toBe('NONE');
        expect(action.reason).toContain('protected');
    });
});
