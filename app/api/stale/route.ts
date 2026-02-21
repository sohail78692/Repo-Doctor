import { NextRequest, NextResponse } from 'next/server';
import { octokit, getRepoParams, hasValidRepoParams } from '@/lib/github';
import { getStaleAction } from '@/lib/stale';
import config from '@/config/default-stale.json';
import { getCollection } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const repoParams = getRepoParams(req);
        if (!hasValidRepoParams(repoParams)) {
            return NextResponse.json(
                { error: 'Invalid repo format. Use owner/repo or configure GITHUB_REPO.' },
                { status: 400 }
            );
        }
        const { data: issues } = await octokit.rest.issues.listForRepo({
            ...repoParams,
            state: 'open',
            per_page: 100,
        });

        const results = issues.map((issue) => {
            const labels = issue.labels
                .map((label) => (typeof label === 'string' ? label : (label.name || '')))
                .filter(Boolean);
            const isStale = labels.includes(config.staleLabel);

            const action = getStaleAction({
                updatedAt: issue.updated_at,
                labels,
                isStale,
            });

            return {
                number: issue.number,
                title: issue.title,
                url: issue.html_url,
                updatedAt: issue.updated_at,
                labels,
                isStale,
                action: action.type,
                reason: action.reason,
            };
        });

        // Sort by the ones needing most attention first (CLOSE > MARK_STALE > NONE)
        results.sort((a, b) => {
            const priority: Record<string, number> = { 'CLOSE': 3, 'MARK_STALE': 2, 'NONE': 1 };
            return priority[b.action] - priority[a.action];
        });

        return NextResponse.json({ success: true, count: results.length, issues: results });
    } catch (error: unknown) {
        console.error('Stale Fetch Failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const repoParams = getRepoParams(req);
        if (!hasValidRepoParams(repoParams)) {
            return NextResponse.json(
                { error: 'Invalid repo format. Use owner/repo or configure GITHUB_REPO.' },
                { status: 400 }
            );
        }
        // 1. Fetch open issues and PRs
        const { data: issues } = await octokit.rest.issues.listForRepo({
            ...repoParams,
            state: 'open',
            per_page: 100,
        });

        const results = [];

        for (const issue of issues) {
            const labels = issue.labels
                .map((label) => (typeof label === 'string' ? label : (label.name || '')))
                .filter(Boolean);
            const isStale = labels.includes(config.staleLabel);

            const action = getStaleAction({
                updatedAt: issue.updated_at,
                labels,
                isStale,
            });

            if (action.type === 'MARK_STALE') {
                await octokit.rest.issues.createComment({
                    ...repoParams,
                    issue_number: issue.number,
                    body: config.staleMessage,
                });
                await octokit.rest.issues.addLabels({
                    ...repoParams,
                    issue_number: issue.number,
                    labels: [config.staleLabel],
                });
                results.push({ number: issue.number, action: 'marked stale' });
            } else if (action.type === 'CLOSE') {
                await octokit.rest.issues.createComment({
                    ...repoParams,
                    issue_number: issue.number,
                    body: config.closeMessage,
                });
                await octokit.rest.issues.update({
                    ...repoParams,
                    issue_number: issue.number,
                    state: 'closed',
                });
                results.push({ number: issue.number, action: 'closed' });
            }

            // Snapshot for reporting
            const collection = await getCollection('issue_snapshots');
            await collection.insertOne({
                repo: `${repoParams.owner}/${repoParams.repo}`,
                number: issue.number,
                title: issue.title,
                labels,
                isStale,
                updatedAt: new Date(issue.updated_at),
                createdAt: new Date(),
            });
        }

        return NextResponse.json({ success: true, processed: issues.length, results });
    } catch (error: unknown) {
        console.error('Stale Scan Failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
