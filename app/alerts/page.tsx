'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from './../components/RepoProvider';

type AlertSettings = {
    enabled: boolean;
    cooldownHours: number;
    rules: {
        noCommitDays: number;
        prStuckDays: number;
        staleSpikeCount: number;
        staleWindowDays: number;
    };
};

type AlertState = {
    id: 'NO_COMMITS' | 'PR_STUCK' | 'STALE_SPIKE';
    title: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    active: boolean;
    threshold: number;
    value: number | null;
    message: string;
};

type AlertEvaluation = {
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
        stuckPullRequests: Array<{
            number: number;
            title: string;
            url: string;
            updatedAt: string;
            daysSinceUpdate: number;
        }>;
    };
};

type AlertsGetResponse = {
    success: boolean;
    repo: string;
    webhookConfigured: boolean;
    settings: AlertSettings;
    evaluation: AlertEvaluation;
    error?: string;
};

type AlertsDispatchResponse = {
    success: boolean;
    sent: boolean;
    reason: string;
    sentAlerts: Array<'NO_COMMITS' | 'PR_STUCK' | 'STALE_SPIKE'>;
    suppressed: Array<'NO_COMMITS' | 'PR_STUCK' | 'STALE_SPIKE'>;
    sentAt?: string;
    error?: string;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

function formatDate(isoDate: string | null) {
    if (!isoDate) return 'N/A';
    const date = new Date(isoDate);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function severityStyles(severity: AlertState['severity']) {
    if (severity === 'HIGH') {
        return { color: 'var(--error)', background: 'var(--error-bg)', borderColor: 'rgba(185, 28, 28, 0.28)' };
    }
    if (severity === 'MEDIUM') {
        return { color: 'var(--warning)', background: 'var(--warning-bg)', borderColor: 'rgba(180, 83, 9, 0.28)' };
    }
    return { color: 'var(--success)', background: 'var(--success-bg)', borderColor: 'rgba(4, 120, 87, 0.28)' };
}

export default function AlertsPage() {
    const { activeRepo } = useRepo();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dispatching, setDispatching] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [webhookConfigured, setWebhookConfigured] = useState(false);
    const [evaluation, setEvaluation] = useState<AlertEvaluation | null>(null);
    const [settings, setSettings] = useState<AlertSettings | null>(null);

    const activeAlertCount = evaluation?.activeAlerts.length || 0;

    const loadAlerts = useCallback(async () => {
        if (!activeRepo) {
            setLoading(false);
            setSettings(null);
            setEvaluation(null);
            return;
        }

        setLoading(true);
        setError(null);
        setNotice(null);
        try {
            const res = await fetch(`/api/alerts?repo=${encodeURIComponent(activeRepo)}`);
            const data = await res.json() as AlertsGetResponse;
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

            setWebhookConfigured(data.webhookConfigured);
            setSettings(data.settings);
            setEvaluation(data.evaluation);
        } catch (fetchError: unknown) {
            setError(getErrorMessage(fetchError));
        } finally {
            setLoading(false);
        }
    }, [activeRepo]);

    useEffect(() => {
        void loadAlerts();
    }, [loadAlerts]);

    async function saveSettings() {
        if (!activeRepo || !settings) return;

        setSaving(true);
        setError(null);
        setNotice(null);

        try {
            const res = await fetch(`/api/alerts?repo=${encodeURIComponent(activeRepo)}`, {
                method: 'PUT',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ settings }),
            });
            const data = await res.json() as AlertsGetResponse;
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

            setWebhookConfigured(data.webhookConfigured);
            setSettings(data.settings);
            setEvaluation(data.evaluation);
            setNotice('Alert settings saved.');
        } catch (saveError: unknown) {
            setError(getErrorMessage(saveError));
        } finally {
            setSaving(false);
        }
    }

    async function dispatch(force: boolean) {
        if (!activeRepo) return;

        setDispatching(true);
        setError(null);
        setNotice(null);

        try {
            const res = await fetch(`/api/alerts?repo=${encodeURIComponent(activeRepo)}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ force }),
            });
            const data = await res.json() as AlertsDispatchResponse;
            if (!res.ok || !data.success) throw new Error(data.error || `HTTP ${res.status}`);

            if (data.sent) {
                setNotice(`Alert sent (${data.sentAlerts.join(', ')})`);
            } else {
                setNotice(data.reason || 'No alert sent.');
            }

            await loadAlerts();
        } catch (dispatchError: unknown) {
            setError(getErrorMessage(dispatchError));
        } finally {
            setDispatching(false);
        }
    }

    const stuckSamples = useMemo(
        () => evaluation?.samples.stuckPullRequests || [],
        [evaluation]
    );

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">🚨 Smart Alerts</h1>
                <p className="page-subtitle">
                    Configure thresholds and send automatic repository health alerts to your webhook channel.
                </p>
            </div>

            {error && (
                <div className="banner error" style={{ marginBottom: '1rem' }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {notice && (
                <div className="banner info" style={{ marginBottom: '1rem' }}>
                    <span>✅</span> {notice}
                </div>
            )}

            {!webhookConfigured && (
                <div className="banner info" style={{ marginBottom: '1rem' }}>
                    <span>ℹ️</span> Webhook is not configured. Add <code>ALERT_WEBHOOK_URL</code> (or Slack/Discord variants) to enable dispatch.
                </div>
            )}

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-header-row">
                    <div>
                        <p className="card-title">Alert Settings</p>
                        <p className="card-subtitle">Repo: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeRepo || 'Not selected'}</strong></p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-ghost" onClick={loadAlerts} disabled={loading || saving || dispatching}>
                            {loading ? 'Refreshing...' : '↻ Refresh'}
                        </button>
                        <button className="btn btn-primary" onClick={saveSettings} disabled={loading || saving || dispatching || !settings}>
                            {saving ? <><span className="spinner" /> Saving...</> : 'Save Settings'}
                        </button>
                    </div>
                </div>

                {settings ? (
                    <div style={{ marginTop: '1rem', display: 'grid', gap: '0.9rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                            <input
                                type="checkbox"
                                checked={settings.enabled}
                                onChange={(event) =>
                                    setSettings(prev => prev ? { ...prev, enabled: event.target.checked } : prev)
                                }
                            />
                            Enable alerts for this repo
                        </label>

                        <div className="status-grid">
                            <div className="status-item">
                                <span className="status-label">No Commit Threshold (days)</span>
                                <input
                                    className="input-field"
                                    type="number"
                                    min={1}
                                    value={settings.rules.noCommitDays}
                                    onChange={(event) =>
                                        setSettings(prev => prev ? {
                                            ...prev,
                                            rules: { ...prev.rules, noCommitDays: Number.parseInt(event.target.value, 10) || 1 },
                                        } : prev)
                                    }
                                />
                            </div>
                            <div className="status-item">
                                <span className="status-label">PR Stuck Threshold (days)</span>
                                <input
                                    className="input-field"
                                    type="number"
                                    min={1}
                                    value={settings.rules.prStuckDays}
                                    onChange={(event) =>
                                        setSettings(prev => prev ? {
                                            ...prev,
                                            rules: { ...prev.rules, prStuckDays: Number.parseInt(event.target.value, 10) || 1 },
                                        } : prev)
                                    }
                                />
                            </div>
                            <div className="status-item">
                                <span className="status-label">Stale Spike Threshold (count)</span>
                                <input
                                    className="input-field"
                                    type="number"
                                    min={1}
                                    value={settings.rules.staleSpikeCount}
                                    onChange={(event) =>
                                        setSettings(prev => prev ? {
                                            ...prev,
                                            rules: { ...prev.rules, staleSpikeCount: Number.parseInt(event.target.value, 10) || 1 },
                                        } : prev)
                                    }
                                />
                            </div>
                            <div className="status-item">
                                <span className="status-label">Stale Window (days)</span>
                                <input
                                    className="input-field"
                                    type="number"
                                    min={1}
                                    value={settings.rules.staleWindowDays}
                                    onChange={(event) =>
                                        setSettings(prev => prev ? {
                                            ...prev,
                                            rules: { ...prev.rules, staleWindowDays: Number.parseInt(event.target.value, 10) || 1 },
                                        } : prev)
                                    }
                                />
                            </div>
                            <div className="status-item">
                                <span className="status-label">Cooldown (hours)</span>
                                <input
                                    className="input-field"
                                    type="number"
                                    min={1}
                                    value={settings.cooldownHours}
                                    onChange={(event) =>
                                        setSettings(prev => prev ? {
                                            ...prev,
                                            cooldownHours: Number.parseInt(event.target.value, 10) || 1,
                                        } : prev)
                                    }
                                />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>
                        {loading ? 'Loading settings...' : 'Settings unavailable.'}
                    </div>
                )}
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-header-row">
                    <div>
                        <p className="card-title">Current Evaluation</p>
                        <p className="card-subtitle">Latest scan from GitHub activity signals.</p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                        <button
                            className="btn btn-primary"
                            onClick={() => dispatch(false)}
                            disabled={dispatching || loading || !webhookConfigured}
                        >
                            {dispatching ? <><span className="spinner" /> Dispatching...</> : 'Send Alert'}
                        </button>
                        <button
                            className="btn btn-ghost"
                            onClick={() => dispatch(true)}
                            disabled={dispatching || loading || !webhookConfigured}
                        >
                            Force Send
                        </button>
                    </div>
                </div>

                {evaluation && (
                    <>
                        <div className="status-grid" style={{ marginTop: '0.85rem' }}>
                            <div className="status-item">
                                <span className="status-label">Active Alerts</span>
                                <span className="status-value" style={{ color: activeAlertCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                    {activeAlertCount}
                                </span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Last Commit</span>
                                <span className="status-value" style={{ fontSize: '0.88rem' }}>{formatDate(evaluation.metrics.lastCommitAt)}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Open PRs / Stuck</span>
                                <span className="status-value">{evaluation.metrics.totalOpenPrs} / {evaluation.metrics.stuckPrs}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Stale Window (current vs previous)</span>
                                <span className="status-value">
                                    {evaluation.metrics.staleCurrentWindow} / {evaluation.metrics.stalePreviousWindow}
                                </span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Open Stale Issues</span>
                                <span className="status-value">{evaluation.metrics.staleOpenNow ?? 'N/A'}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '1rem', display: 'grid', gap: '0.6rem' }}>
                            {evaluation.alerts.map(alert => {
                                const style = severityStyles(alert.severity);
                                return (
                                    <div
                                        key={alert.id}
                                        style={{
                                            border: `1px solid ${style.borderColor}`,
                                            background: style.background,
                                            color: style.color,
                                            borderRadius: '12px',
                                            padding: '0.7rem 0.85rem',
                                            opacity: alert.active ? 1 : 0.72,
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontWeight: 700 }}>
                                            <span>{alert.title}</span>
                                            <span>{alert.active ? 'ACTIVE' : 'OK'}</span>
                                        </div>
                                        <div style={{ marginTop: '0.28rem', fontSize: '0.82rem' }}>{alert.message}</div>
                                    </div>
                                );
                            })}
                        </div>

                        {stuckSamples.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <p className="section-label">Stuck PR Samples</p>
                                <div className="issue-list">
                                    {stuckSamples.map(pr => (
                                        <a key={pr.number} className="issue-row" href={pr.url} target="_blank" rel="noopener noreferrer">
                                            <div className="issue-main">
                                                <div className="issue-title-row">
                                                    <span className="issue-number">#{pr.number}</span>
                                                    <span className="issue-title">{pr.title}</span>
                                                </div>
                                                <div className="issue-meta">
                                                    Last update: {formatDate(pr.updatedAt)}
                                                </div>
                                            </div>
                                            <div className="issue-badge-wrap">
                                                <span className="issue-badge stale">{pr.daysSinceUpdate}d idle</span>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
