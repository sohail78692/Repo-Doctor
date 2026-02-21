import { octokit } from './github';
import { getCollection } from './db';
import { subDays, differenceInHours } from 'date-fns';

type CommitListItem = Awaited<ReturnType<typeof octokit.rest.repos.listCommits>>['data'][number];

export async function generateWeeklyReport(repoParams: { owner: string; repo: string }) {
    const lastWeek = subDays(new Date(), 7);

    // 1. Stats
    const { data: issues } = await octokit.rest.issues.listForRepo({
        ...repoParams,
        state: 'open',
    });

    const { data: pulls } = await octokit.rest.pulls.list({
        ...repoParams,
        state: 'all',
    });

    const openPrs = pulls.filter(p => p.state === 'open');
    const mergedPrsLastWeek = pulls.filter(p => p.merged_at && new Date(p.merged_at) > lastWeek);

    // Calculate Average Merge Time (in hours)
    const mergeTimes = mergedPrsLastWeek.map(p =>
        differenceInHours(new Date(p.merged_at!), new Date(p.created_at))
    );
    const avgMergeTime = mergeTimes.length > 0
        ? (mergeTimes.reduce((a, b) => a + b, 0) / mergeTimes.length).toFixed(1)
        : '0';

    // 2. Fetch Commits from last week
    let recentCommits: CommitListItem[] = [];
    try {
        const { data: commits } = await octokit.rest.repos.listCommits({
            ...repoParams,
            since: lastWeek.toISOString(),
        });
        recentCommits = commits;
    } catch (e) {
        console.warn('Could not fetch commits or repo is empty', e);
    }

    // 2.5 Calculate Contributor Stats
    const contributorCommits: Record<string, number> = {};
    recentCommits.forEach(c => {
        const author = c.author?.login || c.commit.author?.name || 'Unknown';
        contributorCommits[author] = (contributorCommits[author] || 0) + 1;
    });
    const topContributors = Object.entries(contributorCommits)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    // 3. Fetch Risky PRs from DB
    const analysisCollection = await getCollection('pull_request_analyses');
    const riskyPrs = await analysisCollection
        .find({ 'risk.level': 'HIGH', updatedAt: { $gt: lastWeek } })
        .sort({ 'risk.score': -1 })
        .limit(5)
        .toArray();

    // 4. Format Report
    const report = {
        repo: `${repoParams.owner}/${repoParams.repo}`,
        weekStart: lastWeek,
        metrics: {
            openIssues: issues.length - openPrs.length,
            openPrs: openPrs.length,
            mergedLastWeek: mergedPrsLastWeek.length,
            avgMergeTimeHours: avgMergeTime,
            commitsLastWeek: recentCommits.length,
            activeContributors: Object.keys(contributorCommits).length,
        },
        topContributors: topContributors.map(([name, count]) => ({ name, count })),
        topRiskyPrs: riskyPrs.map(p => ({
            number: p.number,
            title: p.title,
            score: p.risk.score,
        })),
        createdAt: new Date(),
    };

    // 5. Save to DB
    const reportCollection = await getCollection('weekly_reports');
    await reportCollection.insertOne(report);

    // 6. Generate Markdown
    const markdown = `
# 📊 Weekly Health Report: \`${report.repo}\`
*Week of ${report.weekStart.toLocaleDateString()} to ${report.createdAt.toLocaleDateString()}*

## 📈 Key Metrics
- **Open Issues:** ${report.metrics.openIssues}
- **Open Pull Requests:** ${report.metrics.openPrs}
- **Merged PRs (Last 7 Days):** ${report.metrics.mergedLastWeek}
- **Avg. Merge Time:** ${report.metrics.avgMergeTimeHours} hours
- **Total Commits:** ${report.metrics.commitsLastWeek}
- **Active Contributors:** ${report.metrics.activeContributors}

## 🏆 Top Contributors This Week
${report.topContributors.length > 0
            ? report.topContributors.map(c => `- @${c.name} (${c.count} commits)`).join('\n')
            : '- No commits this week.'}

## ⚠️ Top Risky PRs
${report.topRiskyPrs.length > 0
            ? report.topRiskyPrs.map(pr => `- [#${pr.number}] ${pr.title} (Risk Score: **${pr.score}**)`).join('\n')
            : '- No high-risk PRs detected this week. Great job!'}
`.trim();

    return markdown;
}
