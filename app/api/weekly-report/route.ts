import { NextRequest, NextResponse } from 'next/server';
import { generateWeeklyReport } from '@/lib/weekly-report';
import { getRepoParams, hasValidRepoParams } from '@/lib/github';

export async function POST(req: NextRequest) {
    try {
        const repoParams = getRepoParams(req);
        if (!hasValidRepoParams(repoParams)) {
            return NextResponse.json(
                { error: 'Invalid repo format. Use owner/repo or configure GITHUB_REPO.' },
                { status: 400 }
            );
        }
        const report = await generateWeeklyReport(repoParams);
        return NextResponse.json({ success: true, report });
    } catch (error: unknown) {
        console.error('Weekly Report Generation Failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
