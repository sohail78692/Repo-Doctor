import { NextRequest, NextResponse } from 'next/server';
import config from '@/config/default-stale.json';
import { octokit, getRepoParams, hasValidRepoParams } from '@/lib/github';
import { getStaleAction } from '@/lib/stale';

const MS_PER_DAY = 86_400_000;
const ISSUE_LIMIT = 100;
const PR_LIMIT = 60;
const PR_STUCK_DAYS = 3;

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

type ActionTask = {
    id: string;
    kind: 'CLOSE_STALE' | 'MARK_STALE' | 'STUCK_PR' | 'ADD_REVIEWERS' | 'STUCK_PR_AND_REVIEWERS';
    severity: Severity;
    title: string;
    detail: string;
    url: string;
    number: number;
    updatedAt: string;
};

type BulkAction = {
    id: 'CLOSE_STALE' | 'MARK_STALE' | 'REVIEW_STUCK_PRS' | 'ADD_REVIEWERS';
    title: string;
    description: string;
    count: number;
    severity: Severity;
    url: string;
};

function toDaysAgo(value: string) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor((Date.now() - parsed) / MS_PER_DAY));
}

function severityWeight(severity: Severity) {
    if (severity === 'HIGH') return 3;
    if (severity === 'MEDIUM') return 2;
    return 1;
}

function parseLabels(labels: Array<string | { name?: string | null }>) {
    return labels
        .map(label => (typeof label === 'string' ? label : (label.name || '')))
        .filter(Boolean);
}

function toIssueSearchUrl(repo: string, query: string) {
    return `https://github.com/${repo}/issues?q=${encodeURIComponent(query)}`;
}

export async function GET(req: NextRequest) {
    try {
        const repoParams = getRepoParams(req);
        if (!hasValidRepoParams(repoParams)) {
            return NextResponse.json(
                { error: 'Invalid repo format. Use owner/repo or configure GITHUB_REPO.' },
                { status: 400 }
            );
        }

        const repo = `${repoParams.owner}/${repoParams.repo}`;

        const [issueResponse, pullResponse] = await Promise.all([
            octokit.rest.issues.listForRepo({
                ...repoParams,
                state: 'open',
                sort: 'updated',
                direction: 'asc',
                per_page: ISSUE_LIMIT,
            }),
            octokit.rest.pulls.list({
                ...repoParams,
                state: 'open',
                sort: 'updated',
                direction: 'asc',
                per_page: PR_LIMIT,
            }),
        ]);

        const closeStaleTasks: ActionTask[] = [];
        const markStaleTasks: ActionTask[] = [];

        for (const issue of issueResponse.data) {
            if (issue.pull_request) continue;

            const labels = parseLabels(issue.labels as Array<string | { name?: string | null }>);
            const isStale = labels.includes(config.staleLabel);
            const staleAction = getStaleAction({
                updatedAt: issue.updated_at,
                labels,
                isStale,
            });
            const idleDays = toDaysAgo(issue.updated_at);

            if (staleAction.type === 'CLOSE') {
                closeStaleTasks.push({
                    id: `close-issue-${issue.number}`,
                    kind: 'CLOSE_STALE',
                    severity: idleDays >= 30 ? 'HIGH' : 'MEDIUM',
                    title: `Close stale issue #${issue.number}`,
                    detail: `${idleDays} days idle. Already stale-labeled and ready to close.`,
                    url: issue.html_url,
                    number: issue.number,
                    updatedAt: issue.updated_at,
                });
                continue;
            }

            if (staleAction.type === 'MARK_STALE') {
                markStaleTasks.push({
                    id: `mark-issue-${issue.number}`,
                    kind: 'MARK_STALE',
                    severity: idleDays >= 60 ? 'HIGH' : 'MEDIUM',
                    title: `Mark issue #${issue.number} as stale`,
                    detail: `${idleDays} days idle and missing stale label.`,
                    url: issue.html_url,
                    number: issue.number,
                    updatedAt: issue.updated_at,
                });
            }
        }

        const prTasks: Array<ActionTask & { priority: number }> = [];
        for (const pull of pullResponse.data) {
            if (pull.draft) continue;

            const daysIdle = toDaysAgo(pull.updated_at);
            const daysOpen = toDaysAgo(pull.created_at);
            const requestedReviewers = (pull.requested_reviewers || []).length + (pull.requested_teams || []).length;
            const isStuck = daysIdle >= PR_STUCK_DAYS;
            const missingReviewers = requestedReviewers === 0;

            if (!isStuck && !missingReviewers) continue;

            let kind: ActionTask['kind'] = 'STUCK_PR';
            let title = `Unblock PR #${pull.number}`;
            let severity: Severity = 'MEDIUM';
            let detail = `${daysIdle} day(s) since last update.`;
            let priority = daysIdle;

            if (isStuck && missingReviewers) {
                kind = 'STUCK_PR_AND_REVIEWERS';
                title = `Review and assign reviewers on PR #${pull.number}`;
                severity = daysIdle >= 7 ? 'HIGH' : 'MEDIUM';
                detail = `${daysIdle} day(s) idle and no reviewers assigned (${daysOpen} day(s) open).`;
                priority = daysIdle + 4;
            } else if (missingReviewers) {
                kind = 'ADD_REVIEWERS';
                title = `Assign reviewers to PR #${pull.number}`;
                severity = daysOpen >= 7 ? 'MEDIUM' : 'LOW';
                detail = `${daysOpen} day(s) open and no reviewers assigned.`;
                priority = daysOpen;
            } else if (isStuck) {
                kind = 'STUCK_PR';
                title = `Unblock stale PR #${pull.number}`;
                severity = daysIdle >= 7 ? 'HIGH' : 'MEDIUM';
                detail = `${daysIdle} day(s) since last update.`;
                priority = daysIdle + 2;
            }

            prTasks.push({
                id: `pr-${pull.number}-${kind.toLowerCase()}`,
                kind,
                severity,
                title,
                detail,
                url: pull.html_url,
                number: pull.number,
                updatedAt: pull.updated_at,
                priority,
            });
        }

        prTasks.sort((a, b) => {
            const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
            if (severityDiff !== 0) return severityDiff;
            return b.priority - a.priority;
        });

        closeStaleTasks.sort((a, b) => toDaysAgo(b.updatedAt) - toDaysAgo(a.updatedAt));
        markStaleTasks.sort((a, b) => toDaysAgo(b.updatedAt) - toDaysAgo(a.updatedAt));

        const tasks: ActionTask[] = [
            ...closeStaleTasks.slice(0, 6),
            ...prTasks.slice(0, 8).map(task => ({
                id: task.id,
                kind: task.kind,
                severity: task.severity,
                title: task.title,
                detail: task.detail,
                url: task.url,
                number: task.number,
                updatedAt: task.updatedAt,
            })),
            ...markStaleTasks.slice(0, 4),
        ];

        tasks.sort((a, b) => {
            const severityDiff = severityWeight(b.severity) - severityWeight(a.severity);
            if (severityDiff !== 0) return severityDiff;
            return toDaysAgo(b.updatedAt) - toDaysAgo(a.updatedAt);
        });

        const stuckPrCount = prTasks.filter(task => task.kind === 'STUCK_PR' || task.kind === 'STUCK_PR_AND_REVIEWERS').length;
        const missingReviewerCount = prTasks.filter(task => task.kind === 'ADD_REVIEWERS' || task.kind === 'STUCK_PR_AND_REVIEWERS').length;

        const bulkActions: BulkAction[] = [
            {
                id: 'CLOSE_STALE',
                title: `Close ${closeStaleTasks.length} stale issue${closeStaleTasks.length === 1 ? '' : 's'}`,
                description: 'Issues already stale-labeled and ready for closure.',
                count: closeStaleTasks.length,
                severity: closeStaleTasks.length > 0 ? 'HIGH' : 'LOW',
                url: toIssueSearchUrl(repo, `is:issue is:open label:${config.staleLabel}`),
            },
            {
                id: 'MARK_STALE',
                title: `Mark ${markStaleTasks.length} issue${markStaleTasks.length === 1 ? '' : 's'} as stale`,
                description: 'Long-idle issues without stale label.',
                count: markStaleTasks.length,
                severity: markStaleTasks.length > 0 ? 'MEDIUM' : 'LOW',
                url: toIssueSearchUrl(repo, `is:issue is:open -label:${config.staleLabel} sort:updated-asc`),
            },
            {
                id: 'REVIEW_STUCK_PRS',
                title: `Review ${stuckPrCount} stuck PR${stuckPrCount === 1 ? '' : 's'}`,
                description: `Open PRs with no updates for ${PR_STUCK_DAYS}+ days.`,
                count: stuckPrCount,
                severity: stuckPrCount > 0 ? 'MEDIUM' : 'LOW',
                url: toIssueSearchUrl(repo, 'is:pr is:open sort:updated-asc'),
            },
            {
                id: 'ADD_REVIEWERS',
                title: `Assign reviewers on ${missingReviewerCount} PR${missingReviewerCount === 1 ? '' : 's'}`,
                description: 'Open PRs without requested reviewers.',
                count: missingReviewerCount,
                severity: missingReviewerCount > 0 ? 'MEDIUM' : 'LOW',
                url: toIssueSearchUrl(repo, 'is:pr is:open review:none'),
            },
        ];

        const high = tasks.filter(task => task.severity === 'HIGH').length;
        const medium = tasks.filter(task => task.severity === 'MEDIUM').length;
        const low = tasks.filter(task => task.severity === 'LOW').length;

        return NextResponse.json({
            success: true,
            repo,
            generatedAt: new Date().toISOString(),
            summary: {
                totalTasks: tasks.length,
                high,
                medium,
                low,
                staleToClose: closeStaleTasks.length,
                staleToMark: markStaleTasks.length,
                stuckPrs: stuckPrCount,
                prsMissingReviewers: missingReviewerCount,
            },
            bulkActions,
            tasks,
        });
    } catch (error: unknown) {
        console.error('Action center fetch failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
