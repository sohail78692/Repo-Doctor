import { NextRequest, NextResponse } from 'next/server';
import { octokit, getRepoParams, hasValidRepoParams } from '@/lib/github';

const PER_PAGE = 100;
const MAX_COMMITS = 5000;
const DEFAULT_DAYS = 365;
const MAX_DAYS = 3650;

type CommitRecord = {
    sha: string;
    date: string;
    author: string;
    isMerge: boolean;
};

function parseDays(value: string | null) {
    if (!value) return DEFAULT_DAYS;

    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_DAYS;

    return Math.min(parsed, MAX_DAYS);
}

function toIsoDaysAgo(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString();
}

function buildWeekdayRows(counts: Map<string, number>) {
    const ordered = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return ordered.map(day => ({ day, count: counts.get(day) || 0 }));
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

        const searchParams = req.nextUrl.searchParams;
        const scope = searchParams.get('scope') === 'full' ? 'full' : 'range';
        const days = parseDays(searchParams.get('days'));
        const since = scope === 'full' ? undefined : toIsoDaysAgo(days);

        const commits: CommitRecord[] = [];
        let page = 1;
        let truncated = false;

        while (commits.length < MAX_COMMITS) {
            const { data } = await octokit.rest.repos.listCommits({
                ...repoParams,
                per_page: PER_PAGE,
                page,
                ...(since ? { since } : {}),
            });

            if (data.length === 0) break;

            for (const commit of data) {
                if (commits.length >= MAX_COMMITS) {
                    truncated = true;
                    break;
                }

                const date = commit.commit.author?.date || commit.commit.committer?.date;
                if (!date) continue;

                const author =
                    commit.author?.login ||
                    commit.commit.author?.name ||
                    commit.commit.committer?.name ||
                    'Unknown';

                commits.push({
                    sha: commit.sha,
                    date,
                    author,
                    isMerge: commit.parents.length > 1,
                });
            }

            if (data.length < PER_PAGE) break;
            page += 1;
        }

        const daily = new Map<string, number>();
        const monthly = new Map<string, number>();
        const authors = new Map<string, number>();
        const weekdays = new Map<string, number>();
        let mergeCommits = 0;

        for (const commit of commits) {
            const day = commit.date.slice(0, 10);
            const month = commit.date.slice(0, 7);
            const weekday = new Date(commit.date).toLocaleDateString('en-US', {
                weekday: 'long',
                timeZone: 'UTC',
            });

            daily.set(day, (daily.get(day) || 0) + 1);
            monthly.set(month, (monthly.get(month) || 0) + 1);
            authors.set(commit.author, (authors.get(commit.author) || 0) + 1);
            weekdays.set(weekday, (weekdays.get(weekday) || 0) + 1);

            if (commit.isMerge) mergeCommits += 1;
        }

        const dailyRows = [...daily.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, count]) => ({ date, count }));

        const monthlyRows = [...monthly.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([month, count]) => ({ month, count }));

        const contributorRows = [...authors.entries()]
            .map(([author, count]) => ({ author, count }))
            .sort((a, b) => b.count - a.count);

        const firstCommitAt = commits.length > 0 ? commits[commits.length - 1].date : null;
        const latestCommitAt = commits.length > 0 ? commits[0].date : null;

        return NextResponse.json({
            success: true,
            repo: `${repoParams.owner}/${repoParams.repo}`,
            scope,
            days: scope === 'full' ? null : days,
            truncated,
            limits: { maxCommits: MAX_COMMITS },
            totals: {
                commits: commits.length,
                contributors: authors.size,
                mergeCommits,
            },
            range: {
                from: firstCommitAt,
                to: latestCommitAt,
            },
            charts: {
                daily: dailyRows,
                monthly: monthlyRows,
                contributors: contributorRows.slice(0, 15),
                weekdays: buildWeekdayRows(weekdays),
            },
        });
    } catch (error: unknown) {
        console.error('Commit history fetch failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
