import { NextRequest, NextResponse } from 'next/server';
import {
    dispatchRepoAlerts,
    evaluateRepoAlerts,
    getAlertSettings,
    isAlertWebhookConfigured,
    saveAlertSettings,
    AlertChannel,
    AlertSettings,
} from '@/lib/alerts';
import { getRepoParams, hasValidRepoParams } from '@/lib/github';

function parseChannel(value: unknown): AlertChannel {
    if (value === 'webhook' || value === 'slack' || value === 'discord') return value;
    return 'auto';
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
        const settings = await getAlertSettings(repo);
        const evaluation = await evaluateRepoAlerts(repoParams, settings);

        return NextResponse.json({
            success: true,
            repo,
            webhookConfigured: isAlertWebhookConfigured(),
            settings,
            evaluation,
        });
    } catch (error: unknown) {
        console.error('Alerts GET failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const repoParams = getRepoParams(req);
        if (!hasValidRepoParams(repoParams)) {
            return NextResponse.json(
                { error: 'Invalid repo format. Use owner/repo or configure GITHUB_REPO.' },
                { status: 400 }
            );
        }

        const body = await req.json().catch(() => ({})) as { settings?: Record<string, unknown> };
        const input = (body.settings || body) as Record<string, unknown>;
        const repo = `${repoParams.owner}/${repoParams.repo}`;

        const settings = await saveAlertSettings(repo, input as Partial<AlertSettings>);
        const evaluation = await evaluateRepoAlerts(repoParams, settings);

        return NextResponse.json({
            success: true,
            repo,
            webhookConfigured: isAlertWebhookConfigured(),
            settings,
            evaluation,
        });
    } catch (error: unknown) {
        console.error('Alerts PUT failed:', error);
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

        const body = await req.json().catch(() => ({})) as {
            force?: boolean;
            channel?: AlertChannel;
        };

        const repo = `${repoParams.owner}/${repoParams.repo}`;
        const settings = await getAlertSettings(repo);
        const result = await dispatchRepoAlerts({
            repoParams,
            settings,
            force: Boolean(body.force),
            channel: parseChannel(body.channel),
        });

        return NextResponse.json({
            ...result,
            repo,
            webhookConfigured: isAlertWebhookConfigured(),
        });
    } catch (error: unknown) {
        console.error('Alerts POST failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
