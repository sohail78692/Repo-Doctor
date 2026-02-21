import { differenceInDays } from 'date-fns';
import config from '@/config/default-stale.json';

export interface StaleAction {
    type: 'MARK_STALE' | 'CLOSE' | 'NONE';
    reason: string;
}

export function getStaleAction(item: {
    updatedAt: string | Date;
    labels: string[];
    isStale: boolean;
}): StaleAction {
    const daysSinceUpdate = differenceInDays(new Date(), new Date(item.updatedAt));

    // Check if ignored
    if (item.labels.some(l => config.ignoreLabels.includes(l))) {
        return { type: 'NONE', reason: 'Item has protected label' };
    }

    if (!item.isStale) {
        if (daysSinceUpdate >= config.staleThresholdDays) {
            return { type: 'MARK_STALE', reason: `No activity for ${daysSinceUpdate} days` };
        }
    } else {
        // Already marked stale, check for closure
        if (daysSinceUpdate >= config.closeThresholdDays) {
            return { type: 'CLOSE', reason: `Stale for ${daysSinceUpdate} days` };
        }
    }

    return { type: 'NONE', reason: 'Activity threshold not met' };
}
