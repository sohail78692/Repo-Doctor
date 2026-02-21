import config from '@/config/default-stale.json';
import { getCollection } from '@/lib/db';
import { env } from '@/lib/env';
import { octokit, RepoParams } from '@/lib/github';

const MS_PER_DAY = 86_400_000;
const PER_PAGE = 100;
const MAX_OPEN_PR_PAGES = 5;
const MAX_STALE_SCAN_PAGES = 10;

export type AlertId = 'NO_COMMITS' | 'PR_STUCK' | 'STALE_SPIKE';
export type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type AlertChannel = 'auto' | 'webhook' | 'slack' | 'discord';

export type AlertSettings = {
    enabled: boolean;
    cooldownHours: number;
    rules: {
        noCommitDays: number;
        prStuckDays: number;
        staleSpikeCount: number;
        staleWindowDays: number;
    };
};

type AlertSettingsDoc = Partial<AlertSettings> & {
    repo: string;
    createdAt?: Date;
    updatedAt?: Date;
};

export type StuckPullRequest = {
    number: number;
    title: string;
    url: string;
    updatedAt: string;
    daysSinceUpdate: number;
};

export type AlertState = {
    id: AlertId;
    title: string;
    severity: AlertSeverity;
    active: boolean;
    threshold: number;
    value: number | null;
    message: string;
};

export type AlertEvaluation = {
    repo: string;
    generatedAt: string;
    settings: AlertSettings;
    alerts: AlertState[];
    activeAlerts: AlertState[];
    metrics: {
        lastCommitAt: string | null;
        daysSinceLastCommit: number | null;
        totalOpenPrs: number;
        stuckPrs: number;
        staleCurrentWindow: number;
        stalePreviousWindow: number;
        staleOpenNow: number | null;
    };
    samples: {
        stuckPullRequests: StuckPullRequest[];
    };
};

type DeliveryTarget = {
    kind: Exclude<AlertChannel, 'auto'>;
    url: string;
};

type DeliveryEvent = {
    repo: string;
    ruleId: AlertId;
    severity: AlertSeverity;
    sentAt: Date;
    channel: DeliveryTarget['kind'];
    force: boolean;
};

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
    enabled: true,
    cooldownHours: 24,
    rules: {
        noCommitDays: 7,
        prStuckDays: 3,
        staleSpikeCount: 5,
        staleWindowDays: 7,
    },
};

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
    if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
    return Math.min(max, Math.max(min, Math.round(value)));
}

function sanitizeSettings(input: Partial<AlertSettings> | null | undefined): AlertSettings {
    const source = input || {};
    const sourceRules: Partial<AlertSettings['rules']> = source.rules || {};

    return {
        enabled: typeof source.enabled === 'boolean' ? source.enabled : DEFAULT_ALERT_SETTINGS.enabled,
        cooldownHours: clampNumber(source.cooldownHours, 1, 168, DEFAULT_ALERT_SETTINGS.cooldownHours),
        rules: {
            noCommitDays: clampNumber(
                sourceRules.noCommitDays,
                1,
                180,
                DEFAULT_ALERT_SETTINGS.rules.noCommitDays
            ),
            prStuckDays: clampNumber(
                sourceRules.prStuckDays,
                1,
                90,
                DEFAULT_ALERT_SETTINGS.rules.prStuckDays
            ),
            staleSpikeCount: clampNumber(
                sourceRules.staleSpikeCount,
                1,
                200,
                DEFAULT_ALERT_SETTINGS.rules.staleSpikeCount
            ),
            staleWindowDays: clampNumber(
                sourceRules.staleWindowDays,
                1,
                30,
                DEFAULT_ALERT_SETTINGS.rules.staleWindowDays
            ),
        },
    };
}

function isoDaysAgo(days: number) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString();
}

function daysSince(isoDate: string, now = new Date()) {
    const parsed = Date.parse(isoDate);
    if (!Number.isFinite(parsed)) return null;
    return Math.floor((now.getTime() - parsed) / MS_PER_DAY);
}

function getRepoKey(repoParams: RepoParams) {
    return `${repoParams.owner}/${repoParams.repo}`;
}

function extractLabels(labels: Array<string | { name?: string | null }>) {
    return labels
        .map(label => (typeof label === 'string' ? label : (label.name || '')))
        .filter(Boolean);
}

function buildWebhookMessage(evaluation: AlertEvaluation, alertsToSend: AlertState[]) {
    const lines: string[] = [];
    lines.push(`Repo Doctor Alert: ${evaluation.repo}`);
    lines.push(`${alertsToSend.length} active rule${alertsToSend.length === 1 ? '' : 's'} triggered`);
    lines.push('');

    for (const alert of alertsToSend) {
        lines.push(`[${alert.severity}] ${alert.title}`);
        lines.push(`- ${alert.message}`);
    }

    lines.push('');
    lines.push(`Generated at: ${evaluation.generatedAt}`);
    lines.push(`Open stale issues: ${evaluation.metrics.staleOpenNow ?? 'N/A'}`);
    return lines.join('\n');
}

function severityPriority(severity: AlertSeverity) {
    if (severity === 'HIGH') return 3;
    if (severity === 'MEDIUM') return 2;
    return 1;
}

function highestSeverity(alerts: AlertState[]): AlertSeverity {
    return alerts.reduce<AlertSeverity>((current, alert) => {
        return severityPriority(alert.severity) > severityPriority(current) ? alert.severity : current;
    }, 'LOW');
}

function severityColorHex(severity: AlertSeverity) {
    if (severity === 'HIGH') return 0xb91c1c;
    if (severity === 'MEDIUM') return 0xd97706;
    return 0x047857;
}

function severityEmoji(severity: AlertSeverity) {
    if (severity === 'HIGH') return '🔴';
    if (severity === 'MEDIUM') return '🟠';
    return '🟢';
}

function truncateText(value: string, max = 1000) {
    if (value.length <= max) return value;
    return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function buildDiscordPayload(evaluation: AlertEvaluation, alertsToSend: AlertState[]) {
    const dominantSeverity = highestSeverity(alertsToSend);
    const repoUrl = `https://github.com/${evaluation.repo}`;
    const triggeredList = alertsToSend
        .map(alert => `${severityEmoji(alert.severity)} **${alert.title}**\n${alert.message}`)
        .join('\n\n');

    const stuckPreview = evaluation.samples.stuckPullRequests
        .slice(0, 3)
        .map(pr => `• [#${pr.number}](${pr.url}) - ${truncateText(pr.title, 72)} (${pr.daysSinceUpdate}d idle)`)
        .join('\n');

    const staleNow = evaluation.metrics.staleOpenNow ?? 'N/A';
    const noCommitThreshold = evaluation.settings.rules.noCommitDays;
    const prStuckThreshold = evaluation.settings.rules.prStuckDays;
    const staleThreshold = evaluation.settings.rules.staleSpikeCount;
    const staleWindow = evaluation.settings.rules.staleWindowDays;

    return {
        username: 'Repo Doctor',
        content: `🚨 **Repo health alert triggered for \`${evaluation.repo}\`**`,
        embeds: [
            {
                title: `${alertsToSend.length} active alert${alertsToSend.length === 1 ? '' : 's'} detected`,
                url: repoUrl,
                description: truncateText(triggeredList, 3900),
                color: severityColorHex(dominantSeverity),
                fields: [
                    {
                        name: 'Commit Activity',
                        value: evaluation.metrics.daysSinceLastCommit === null
                            ? `No commit found (threshold ${noCommitThreshold}d)`
                            : `Last commit: **${evaluation.metrics.daysSinceLastCommit}d** ago (threshold ${noCommitThreshold}d)`,
                        inline: true,
                    },
                    {
                        name: 'Pull Requests',
                        value: `Open: **${evaluation.metrics.totalOpenPrs}**\nStuck: **${evaluation.metrics.stuckPrs}** (threshold ${prStuckThreshold}d)`,
                        inline: true,
                    },
                    {
                        name: 'Stale Trend',
                        value: `Current: **${evaluation.metrics.staleCurrentWindow}**\nPrevious: **${evaluation.metrics.stalePreviousWindow}**\nOpen stale: **${staleNow}**`,
                        inline: true,
                    },
                    {
                        name: 'Rule Thresholds',
                        value: `No commits: ${noCommitThreshold}d\nPR stuck: ${prStuckThreshold}d\nStale spike: ${staleThreshold} in ${staleWindow}d`,
                        inline: false,
                    },
                    ...(stuckPreview
                        ? [{
                            name: 'Top Stuck PRs',
                            value: truncateText(stuckPreview, 1000),
                            inline: false,
                        }]
                        : []),
                ],
                footer: {
                    text: 'Repo Doctor · Smart Alerts',
                },
                timestamp: evaluation.generatedAt,
            },
        ],
    };
}

function resolveDeliveryTarget(channel: AlertChannel): DeliveryTarget | null {
    if (channel === 'slack' && env.ALERT_SLACK_WEBHOOK_URL) {
        return { kind: 'slack', url: env.ALERT_SLACK_WEBHOOK_URL };
    }

    if (channel === 'discord' && env.ALERT_DISCORD_WEBHOOK_URL) {
        return { kind: 'discord', url: env.ALERT_DISCORD_WEBHOOK_URL };
    }

    if (channel === 'webhook' && env.ALERT_WEBHOOK_URL) {
        return { kind: 'webhook', url: env.ALERT_WEBHOOK_URL };
    }

    if (channel === 'auto') {
        if (env.ALERT_WEBHOOK_URL) return { kind: 'webhook', url: env.ALERT_WEBHOOK_URL };
        if (env.ALERT_SLACK_WEBHOOK_URL) return { kind: 'slack', url: env.ALERT_SLACK_WEBHOOK_URL };
        if (env.ALERT_DISCORD_WEBHOOK_URL) return { kind: 'discord', url: env.ALERT_DISCORD_WEBHOOK_URL };
    }

    return null;
}

export function isAlertWebhookConfigured() {
    return Boolean(resolveDeliveryTarget('auto'));
}

async function sendWebhook(target: DeliveryTarget, message: string) {
    const response = await fetch(target.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: message,
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        const details = body ? `: ${body.slice(0, 220)}` : '';
        throw new Error(`Webhook delivery failed (${response.status})${details}`);
    }
}

async function sendAlertPayload(target: DeliveryTarget, evaluation: AlertEvaluation, alertsToSend: AlertState[]) {
    if (target.kind === 'discord') {
        const discordPayload = buildDiscordPayload(evaluation, alertsToSend);
        await sendWebhook(target, JSON.stringify(discordPayload));
        return;
    }

    const plainMessage = buildWebhookMessage(evaluation, alertsToSend);
    await sendWebhook(target, JSON.stringify({ text: plainMessage }));
}


export async function getAlertSettings(repo: string) {
    const collection = await getCollection('alert_settings');
    const saved = await collection.findOne<AlertSettingsDoc>({ repo });
    return sanitizeSettings(saved || undefined);
}

export async function saveAlertSettings(repo: string, input: Partial<AlertSettings>) {
    const current = await getAlertSettings(repo);
    const merged = sanitizeSettings({
        ...current,
        ...input,
        rules: {
            ...current.rules,
            ...(input.rules || {}),
        },
    });

    const collection = await getCollection('alert_settings');
    const now = new Date();
    await collection.updateOne(
        { repo },
        {
            $set: {
                ...merged,
                updatedAt: now,
            },
            $setOnInsert: {
                createdAt: now,
            },
        },
        { upsert: true }
    );

    return merged;
}

export async function evaluateRepoAlerts(repoParams: RepoParams, settings: AlertSettings) {
    const repo = getRepoKey(repoParams);
    const now = new Date();

    const { data: latestCommits } = await octokit.rest.repos.listCommits({
        ...repoParams,
        per_page: 1,
    });
    const latestCommit = latestCommits[0];
    const lastCommitAt =
        latestCommit?.commit.author?.date ||
        latestCommit?.commit.committer?.date ||
        null;
    const daysSinceLastCommit = lastCommitAt ? daysSince(lastCommitAt, now) : null;
    const noCommitActive =
        daysSinceLastCommit === null
            ? true
            : daysSinceLastCommit >= settings.rules.noCommitDays;

    let openPrCount = 0;
    const stuckPullRequests: StuckPullRequest[] = [];

    for (let page = 1; page <= MAX_OPEN_PR_PAGES; page += 1) {
        const { data: pulls } = await octokit.rest.pulls.list({
            ...repoParams,
            state: 'open',
            sort: 'updated',
            direction: 'asc',
            per_page: PER_PAGE,
            page,
        });

        if (pulls.length === 0) break;
        openPrCount += pulls.length;

        for (const pull of pulls) {
            const staleDays = daysSince(pull.updated_at, now);
            if (staleDays === null || staleDays < settings.rules.prStuckDays) continue;

            stuckPullRequests.push({
                number: pull.number,
                title: pull.title,
                url: pull.html_url,
                updatedAt: pull.updated_at,
                daysSinceUpdate: staleDays,
            });
        }

        if (pulls.length < PER_PAGE) break;
    }

    stuckPullRequests.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
    const stuckPrCount = stuckPullRequests.length;

    const staleWindowDays = settings.rules.staleWindowDays;
    const currentWindowStartMs = Date.now() - (staleWindowDays * MS_PER_DAY);
    const previousWindowStartIso = isoDaysAgo(staleWindowDays * 2);
    const previousWindowStartMs = Date.parse(previousWindowStartIso);

    let staleCurrentWindow = 0;
    let stalePreviousWindow = 0;

    for (let page = 1; page <= MAX_STALE_SCAN_PAGES; page += 1) {
        const { data: issues } = await octokit.rest.issues.listForRepo({
            ...repoParams,
            state: 'all',
            since: previousWindowStartIso,
            sort: 'updated',
            direction: 'desc',
            per_page: PER_PAGE,
            page,
        });

        if (issues.length === 0) break;

        for (const issue of issues) {
            if (issue.pull_request) continue;
            const labels = extractLabels(issue.labels as Array<string | { name?: string | null }>);
            if (!labels.includes(config.staleLabel)) continue;

            const updatedAtMs = Date.parse(issue.updated_at);
            if (!Number.isFinite(updatedAtMs)) continue;

            if (updatedAtMs >= currentWindowStartMs) {
                staleCurrentWindow += 1;
            } else if (updatedAtMs >= previousWindowStartMs) {
                stalePreviousWindow += 1;
            }
        }

        if (issues.length < PER_PAGE) break;
    }

    let staleOpenNow: number | null = null;
    try {
        const escapedLabel = config.staleLabel.replaceAll('"', '\\"');
        const query = `repo:${repo} is:issue is:open label:"${escapedLabel}"`;
        const { data } = await octokit.rest.search.issuesAndPullRequests({
            q: query,
            per_page: 1,
        });
        staleOpenNow = data.total_count;
    } catch (error) {
        console.warn('Failed to fetch open stale issue count:', error);
    }

    const staleSpikeActive =
        staleCurrentWindow >= settings.rules.staleSpikeCount &&
        staleCurrentWindow > stalePreviousWindow;

    const alerts: AlertState[] = [
        {
            id: 'NO_COMMITS',
            title: 'No Recent Commits',
            severity: 'HIGH',
            active: noCommitActive,
            threshold: settings.rules.noCommitDays,
            value: daysSinceLastCommit,
            message:
                daysSinceLastCommit === null
                    ? 'No commits were found in repository history.'
                    : `Last commit was ${daysSinceLastCommit} day(s) ago (threshold ${settings.rules.noCommitDays}d).`,
        },
        {
            id: 'PR_STUCK',
            title: 'Stuck Pull Requests',
            severity: 'MEDIUM',
            active: stuckPrCount > 0,
            threshold: settings.rules.prStuckDays,
            value: stuckPrCount,
            message:
                stuckPrCount > 0
                    ? `${stuckPrCount} open PR(s) have no updates for at least ${settings.rules.prStuckDays} day(s).`
                    : `No open PR has been idle for ${settings.rules.prStuckDays}+ day(s).`,
        },
        {
            id: 'STALE_SPIKE',
            title: 'Stale Spike',
            severity: 'MEDIUM',
            active: staleSpikeActive,
            threshold: settings.rules.staleSpikeCount,
            value: staleCurrentWindow,
            message: staleSpikeActive
                ? `${staleCurrentWindow} stale-labeled issue(s) updated in last ${staleWindowDays} day(s), up from ${stalePreviousWindow}.`
                : `Stale update volume (${staleCurrentWindow}) is below spike threshold (${settings.rules.staleSpikeCount}) or not above previous window (${stalePreviousWindow}).`,
        },
    ];

    const activeAlerts = alerts.filter(alert => alert.active);

    const evaluation: AlertEvaluation = {
        repo,
        generatedAt: new Date().toISOString(),
        settings,
        alerts,
        activeAlerts,
        metrics: {
            lastCommitAt,
            daysSinceLastCommit,
            totalOpenPrs: openPrCount,
            stuckPrs: stuckPrCount,
            staleCurrentWindow,
            stalePreviousWindow,
            staleOpenNow,
        },
        samples: {
            stuckPullRequests: stuckPullRequests.slice(0, 8),
        },
    };

    return evaluation;
}

export async function dispatchRepoAlerts(args: {
    repoParams: RepoParams;
    settings: AlertSettings;
    force?: boolean;
    channel?: AlertChannel;
}) {
    const force = Boolean(args.force);
    const channel = args.channel || 'auto';
    const repo = getRepoKey(args.repoParams);
    const evaluation = await evaluateRepoAlerts(args.repoParams, args.settings);

    if (!args.settings.enabled && !force) {
        return {
            success: true,
            sent: false,
            reason: 'Alerts are disabled for this repository.',
            evaluation,
            suppressed: [] as AlertId[],
            sentAlerts: [] as AlertId[],
        };
    }

    if (evaluation.activeAlerts.length === 0) {
        return {
            success: true,
            sent: false,
            reason: 'No active alerts to send.',
            evaluation,
            suppressed: [] as AlertId[],
            sentAlerts: [] as AlertId[],
        };
    }

    const target = resolveDeliveryTarget(channel);
    if (!target) {
        throw new Error('Alert webhook is not configured. Set ALERT_WEBHOOK_URL or channel-specific webhook URLs.');
    }

    const deliveries = await getCollection('alert_deliveries');
    const now = new Date();
    const cooldownMs = args.settings.cooldownHours * 3600000;
    const sendable: AlertState[] = [];
    const suppressed: AlertId[] = [];

    for (const alert of evaluation.activeAlerts) {
        if (force) {
            sendable.push(alert);
            continue;
        }

        const lastSent = await deliveries.findOne<{ sentAt?: Date }>(
            { repo, ruleId: alert.id },
            { sort: { sentAt: -1 } }
        );
        const lastSentMs = lastSent?.sentAt ? new Date(lastSent.sentAt).getTime() : 0;
        if (lastSentMs && (now.getTime() - lastSentMs) < cooldownMs) {
            suppressed.push(alert.id);
            continue;
        }

        sendable.push(alert);
    }

    if (sendable.length === 0) {
        return {
            success: true,
            sent: false,
            reason: 'All active alerts are in cooldown.',
            evaluation,
            suppressed,
            sentAlerts: [] as AlertId[],
        };
    }

    await sendAlertPayload(target, evaluation, sendable);

    const events: DeliveryEvent[] = sendable.map(alert => ({
        repo,
        ruleId: alert.id,
        severity: alert.severity,
        sentAt: now,
        channel: target.kind,
        force,
    }));

    if (events.length > 0) {
        await deliveries.insertMany(events);
    }

    return {
        success: true,
        sent: true,
        reason: '',
        evaluation,
        suppressed,
        sentAlerts: sendable.map(alert => alert.id),
        channel: target.kind,
        sentAt: now.toISOString(),
    };
}
