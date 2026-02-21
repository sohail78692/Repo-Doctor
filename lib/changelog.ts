import { octokit } from './github';

export async function generateChangelog(repoParams: { owner: string; repo: string }) {
    // 1. Get last release tag
    let lastTagDate = new Date(0).toISOString();
    try {
        const { data: releases } = await octokit.rest.repos.listReleases({
            ...repoParams,
            per_page: 1,
        });
        if (releases.length > 0) {
            lastTagDate = releases[0].created_at;
        }
    } catch {
        console.warn('No previous releases found');
    }

    // 2. Fetch merged PRs since then
    const { data: prs } = await octokit.rest.pulls.list({
        ...repoParams,
        state: 'closed',
        base: 'main',
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
    });

    const mergedPrs = prs.filter(pr =>
        pr.merged_at && new Date(pr.merged_at) > new Date(lastTagDate)
    );

    // 3. Format Markdown
    const groups: Record<string, string[]> = {
        'Features': [],
        'Fixes': [],
        'Docs': [],
        'Other': [],
    };

    mergedPrs.forEach(pr => {
        const title = pr.title.toLowerCase();
        const entry = `- ${pr.title} (#${pr.number}) by @${pr.user?.login}`;

        if (title.startsWith('feat')) groups.Features.push(entry);
        else if (title.startsWith('fix')) groups.Fixes.push(entry);
        else if (title.startsWith('docs')) groups.Docs.push(entry);
        else groups.Other.push(entry);
    });

    let markdown = `# Changelog (${new Date().toLocaleDateString()})\n\n`;
    for (const [group, entries] of Object.entries(groups)) {
        if (entries.length > 0) {
            markdown += `### ${group}\n${entries.join('\n')}\n\n`;
        }
    }

    return markdown;
}
