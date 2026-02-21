import { NextRequest, NextResponse } from 'next/server';
import { dispatchRepoAlerts, getAlertSettings } from '@/lib/alerts';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';
import { RepoParams } from '@/lib/github';

function parseRepo(repo: string): RepoParams | null {
    const parts = repo.split('/').map(part => part.trim());
    if (parts.length !== 2) return null;
    const [owner, name] = parts;
    if (!owner || !name) return null;
    return { owner, repo: name };
}

function hasValidCronSecret(req: NextRequest) {
    const configured = env.ALERT_CRON_SECRET?.trim();
    if (!configured) return true;

    const headerValue =
        req.headers.get('x-repo-doctor-cron-secret') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
        '';

    return headerValue === configured;
}

export async function POST(req: NextRequest) {
    try {
        if (!hasValidCronSecret(req)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const requestedRepo = req.nextUrl.searchParams.get('repo')?.trim() || '';
        const reposToProcess = new Set<string>();

        if (requestedRepo) {
            reposToProcess.add(requestedRepo);
        } else {
            const settingsCollection = await getCollection('alert_settings');
            const docs = await settingsCollection
                .find<{ repo: string; enabled?: boolean }>({ enabled: true })
                .project<{ repo: string }>({ repo: 1 })
                .limit(150)
                .toArray();

            for (const doc of docs) {
                if (doc.repo) reposToProcess.add(doc.repo);
            }
        }

        const results: Array<{
            repo: string;
            ok: boolean;
            sent: boolean;
            reason?: string;
            error?: string;
            sentAlerts?: string[];
        }> = [];

        for (const repo of reposToProcess) {
            const parsed = parseRepo(repo);
            if (!parsed) {
                results.push({
                    repo,
                    ok: false,
                    sent: false,
                    error: 'Invalid repo format',
                });
                continue;
            }

            try {
                const settings = await getAlertSettings(repo);
                const dispatch = await dispatchRepoAlerts({
                    repoParams: parsed,
                    settings,
                    channel: 'auto',
                    force: false,
                });

                results.push({
                    repo,
                    ok: true,
                    sent: dispatch.sent,
                    reason: dispatch.reason,
                    sentAlerts: dispatch.sentAlerts,
                });
            } catch (error: unknown) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                results.push({
                    repo,
                    ok: false,
                    sent: false,
                    error: message,
                });
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            sent: results.filter(result => result.sent).length,
            failed: results.filter(result => !result.ok).length,
            results,
        });
    } catch (error: unknown) {
        console.error('Alerts cron failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
