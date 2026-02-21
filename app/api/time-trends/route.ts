import { NextRequest, NextResponse } from 'next/server';
import { octokit, getRepoParams, hasValidRepoParams } from '@/lib/github';
import config from '@/config/default-stale.json';

const PER_PAGE = 100;
const LOOKBACK_DAYS = 90;
const MAX_PAGES = 60;
const MAX_COMMITS = 12000;
const MAX_MERGED_PRS = 8000;
const MAX_ISSUES = 12000;
const WINDOWS = [7, 30, 90] as const;

type WindowKey = '7' | '30' | '90';

type MergeDayAggregate = {
    sumHours: number;
    count: number;
};

type MergedPrRecord = {
    date: string;
    hours: number;
};

function toIsoDaysAgo(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString();
}

function toDayKey(value: string | Date) {
    return new Date(value).toISOString().slice(0, 10);
}

function buildDateRange(days: number) {
    const dates: string[] = [];
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (let index = days - 1; index >= 0; index -= 1) {
        const day = new Date(today);
        day.setUTCDate(day.getUTCDate() - index);
        dates.push(day.toISOString().slice(0, 10));
    }

    return dates;
}

function round(value: number, digits = 2) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

function sumMap(map: Map<string, number>, fromDayKey: string) {
    let total = 0;
    for (const [day, count] of map.entries()) {
        if (day >= fromDayKey) total += count;
    }
    return total;
}

function sumMapAll(map: Map<string, number>) {
    let total = 0;
    for (const count of map.values()) total += count;
    return total;
}

function extractLabels(
    labels: Array<string | { name?: string | null }>
) {
    return labels
        .map(label => (typeof label === 'string' ? label : (label.name || '')))
        .filter(Boolean);
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

        const sinceIso = toIsoDaysAgo(LOOKBACK_DAYS);
        const sinceMs = Date.parse(sinceIso);
        const dateRange = buildDateRange(LOOKBACK_DAYS);

        const commitsByDay = new Map<string, number>();
        const mergeHoursByDay = new Map<string, MergeDayAggregate>();
        const openedIssuesByDay = new Map<string, number>();
        const closedIssuesByDay = new Map<string, number>();
        const staleMarkedByDay = new Map<string, number>();
        const staleResolvedByDay = new Map<string, number>();
        const mergedPrRecords: MergedPrRecord[] = [];

        let commitsTruncated = false;
        let pullsTruncated = false;
        let issuesTruncated = false;
        let commitCount = 0;

        let commitPage = 1;
        while (commitPage <= MAX_PAGES && commitCount < MAX_COMMITS) {
            const { data } = await octokit.rest.repos.listCommits({
                ...repoParams,
                since: sinceIso,
                per_page: PER_PAGE,
                page: commitPage,
            });

            if (data.length === 0) break;

            for (const commit of data) {
                if (commitCount >= MAX_COMMITS) {
                    commitsTruncated = true;
                    break;
                }

                const date = commit.commit.author?.date || commit.commit.committer?.date;
                if (!date) continue;

                const day = date.slice(0, 10);
                commitsByDay.set(day, (commitsByDay.get(day) || 0) + 1);
                commitCount += 1;
            }

            if (data.length < PER_PAGE || commitCount >= MAX_COMMITS) break;
            commitPage += 1;
        }

        if (commitPage > MAX_PAGES) commitsTruncated = true;

        let pullPage = 1;
        let stopPullPagination = false;
        while (
            pullPage <= MAX_PAGES &&
            mergedPrRecords.length < MAX_MERGED_PRS &&
            !stopPullPagination
        ) {
            const { data } = await octokit.rest.pulls.list({
                ...repoParams,
                state: 'closed',
                sort: 'updated',
                direction: 'desc',
                per_page: PER_PAGE,
                page: pullPage,
            });

            if (data.length === 0) break;

            for (const pull of data) {
                if (mergedPrRecords.length >= MAX_MERGED_PRS) {
                    pullsTruncated = true;
                    break;
                }

                const updatedAtMs = Date.parse(pull.updated_at);
                if (Number.isFinite(updatedAtMs) && updatedAtMs < sinceMs) {
                    stopPullPagination = true;
                    break;
                }

                if (!pull.merged_at) continue;

                const mergedAtMs = Date.parse(pull.merged_at);
                if (!Number.isFinite(mergedAtMs) || mergedAtMs < sinceMs) continue;

                const createdAtMs = Date.parse(pull.created_at);
                if (!Number.isFinite(createdAtMs)) continue;

                const hours = (mergedAtMs - createdAtMs) / 36e5;
                const day = pull.merged_at.slice(0, 10);

                const previous = mergeHoursByDay.get(day) || { sumHours: 0, count: 0 };
                mergeHoursByDay.set(day, {
                    sumHours: previous.sumHours + hours,
                    count: previous.count + 1,
                });
                mergedPrRecords.push({
                    date: day,
                    hours,
                });
            }

            if (data.length < PER_PAGE || stopPullPagination) break;
            pullPage += 1;
        }

        if (pullPage > MAX_PAGES) pullsTruncated = true;

        let issuePage = 1;
        let issueCount = 0;
        while (issuePage <= MAX_PAGES && issueCount < MAX_ISSUES) {
            const { data } = await octokit.rest.issues.listForRepo({
                ...repoParams,
                state: 'all',
                since: sinceIso,
                sort: 'updated',
                direction: 'desc',
                per_page: PER_PAGE,
                page: issuePage,
            });

            if (data.length === 0) break;

            for (const issue of data) {
                if (issueCount >= MAX_ISSUES) {
                    issuesTruncated = true;
                    break;
                }

                if (issue.pull_request) continue;
                issueCount += 1;

                const createdAtMs = Date.parse(issue.created_at);
                if (Number.isFinite(createdAtMs) && createdAtMs >= sinceMs) {
                    const day = toDayKey(issue.created_at);
                    openedIssuesByDay.set(day, (openedIssuesByDay.get(day) || 0) + 1);
                }

                if (issue.closed_at) {
                    const closedAtMs = Date.parse(issue.closed_at);
                    if (Number.isFinite(closedAtMs) && closedAtMs >= sinceMs) {
                        const day = toDayKey(issue.closed_at);
                        closedIssuesByDay.set(day, (closedIssuesByDay.get(day) || 0) + 1);
                    }
                }

                const labels = extractLabels(issue.labels as Array<string | { name?: string | null }>);
                const hasStaleLabel = labels.includes(config.staleLabel);
                if (!hasStaleLabel) continue;

                const updatedAtMs = Date.parse(issue.updated_at);
                if (Number.isFinite(updatedAtMs) && updatedAtMs >= sinceMs) {
                    const day = toDayKey(issue.updated_at);
                    staleMarkedByDay.set(day, (staleMarkedByDay.get(day) || 0) + 1);
                }

                if (issue.closed_at) {
                    const closedAtMs = Date.parse(issue.closed_at);
                    if (Number.isFinite(closedAtMs) && closedAtMs >= sinceMs) {
                        const day = toDayKey(issue.closed_at);
                        staleResolvedByDay.set(day, (staleResolvedByDay.get(day) || 0) + 1);
                    }
                }
            }

            if (data.length < PER_PAGE || issueCount >= MAX_ISSUES) break;
            issuePage += 1;
        }

        if (issuePage > MAX_PAGES) issuesTruncated = true;

        let staleOpenNow: number | null = null;
        try {
            const escapedLabel = config.staleLabel.replaceAll('"', '\\"');
            const query = `repo:${repoParams.owner}/${repoParams.repo} is:issue is:open label:"${escapedLabel}"`;
            const { data } = await octokit.rest.search.issuesAndPullRequests({
                q: query,
                per_page: 1,
            });
            staleOpenNow = data.total_count;
        } catch (searchError) {
            console.warn('Could not fetch stale open count:', searchError);
        }

        const commitSeries = dateRange.map(date => ({
            date,
            count: commitsByDay.get(date) || 0,
        }));

        const mergeTimeSeries = dateRange.map(date => {
            const value = mergeHoursByDay.get(date);
            return {
                date,
                mergedPrs: value?.count || 0,
                avgHours: value ? round(value.sumHours / value.count, 2) : null,
            };
        });

        const issueCloseRateSeries = dateRange.map(date => {
            const opened = openedIssuesByDay.get(date) || 0;
            const closed = closedIssuesByDay.get(date) || 0;
            return {
                date,
                opened,
                closed,
                closeRate: opened > 0 ? round((closed / opened) * 100, 2) : null,
            };
        });

        let staleCumulative = 0;
        const staleGrowthSeries = dateRange.map(date => {
            const marked = staleMarkedByDay.get(date) || 0;
            const resolved = staleResolvedByDay.get(date) || 0;
            const net = marked - resolved;
            staleCumulative += net;
            return {
                date,
                marked,
                resolved,
                net,
                cumulative: staleCumulative,
            };
        });

        const metrics = WINDOWS.reduce((acc, windowDays) => {
            const startDate = dateRange[Math.max(0, dateRange.length - windowDays)] || dateRange[0];
            const windowKey = String(windowDays) as WindowKey;

            const commits = sumMap(commitsByDay, startDate);
            const mergedWindow = mergedPrRecords.filter(record => record.date >= startDate);
            const issuesOpened = sumMap(openedIssuesByDay, startDate);
            const issuesClosed = sumMap(closedIssuesByDay, startDate);
            const staleMarked = sumMap(staleMarkedByDay, startDate);
            const staleResolved = sumMap(staleResolvedByDay, startDate);

            const avgMergeHours = mergedWindow.length > 0
                ? round(mergedWindow.reduce((sum, record) => sum + record.hours, 0) / mergedWindow.length, 2)
                : null;
            const issueCloseRate = issuesOpened > 0 ? round((issuesClosed / issuesOpened) * 100, 2) : null;

            acc[windowKey] = {
                commits,
                commitVelocity: round(commits / windowDays, 2),
                mergedPrs: mergedWindow.length,
                avgMergeHours,
                issuesOpened,
                issuesClosed,
                issueCloseRate,
                staleMarked,
                staleResolved,
                staleGrowth: staleMarked - staleResolved,
            };

            return acc;
        }, {} as Record<WindowKey, {
            commits: number;
            commitVelocity: number;
            mergedPrs: number;
            avgMergeHours: number | null;
            issuesOpened: number;
            issuesClosed: number;
            issueCloseRate: number | null;
            staleMarked: number;
            staleResolved: number;
            staleGrowth: number;
        }>);

        return NextResponse.json({
            success: true,
            repo: `${repoParams.owner}/${repoParams.repo}`,
            generatedAt: new Date().toISOString(),
            lookbackDays: LOOKBACK_DAYS,
            metrics,
            totals: {
                staleOpenNow,
                commitsLast90d: commitCount,
                mergedPrsLast90d: mergedPrRecords.length,
                issuesOpenedLast90d: sumMapAll(openedIssuesByDay),
                issuesClosedLast90d: sumMapAll(closedIssuesByDay),
            },
            series: {
                commits: commitSeries,
                mergeTime: mergeTimeSeries,
                issueCloseRate: issueCloseRateSeries,
                staleGrowth: staleGrowthSeries,
            },
            limits: {
                maxPages: MAX_PAGES,
                maxCommits: MAX_COMMITS,
                maxMergedPrs: MAX_MERGED_PRS,
                maxIssues: MAX_ISSUES,
            },
            truncated: {
                commits: commitsTruncated,
                pulls: pullsTruncated,
                issues: issuesTruncated,
            },
        });
    } catch (error: unknown) {
        console.error('Time trends fetch failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
