import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import { octokit, getRepoParams, hasValidRepoParams } from '@/lib/github';

export async function GET(req: NextRequest) {
    const repoParams = getRepoParams(req);
    const hasRepo = hasValidRepoParams(repoParams);
    const status = {
        db: 'Offline',
        github: 'Offline',
        repo: hasRepo ? `${repoParams.owner}/${repoParams.repo}` : 'Not configured',
        node: process.version,
    };

    try {
        const { db } = await connectToDatabase();
        await db.command({ ping: 1 });
        status.db = 'Online';
    } catch (e) {
        console.error('DB Status Check Failed:', e);
    }

    try {
        const { data } = hasRepo
            ? await octokit.rest.repos.get(repoParams)
            : await octokit.rest.rateLimit.get();
        if (data) status.github = 'Online';
    } catch (e) {
        console.error('GitHub Status Check Failed:', e);
    }

    return NextResponse.json(status);
}
