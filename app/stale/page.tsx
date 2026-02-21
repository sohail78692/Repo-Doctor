'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRepo } from './../components/RepoProvider';

interface StaleIssue {
    number: number;
    title: string;
    url: string;
    updatedAt: string;
    labels: string[];
    isStale: boolean;
    action: 'MARK_STALE' | 'CLOSE' | 'NONE';
    reason: string;
}

interface ScanResult {
    number: number;
    action: string;
}

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

export default function StalePage() {
    const { activeRepo } = useRepo();
    const [issues, setIssues] = useState<StaleIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [runningAction, setRunningAction] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<{ processed: number; results: ScanResult[] } | null>(null);

    const fetchStaleIssues = useCallback(async () => {
        setLoading(true);
        setSummary(null);
        try {
            const res = await fetch(`/api/stale?repo=${encodeURIComponent(activeRepo)}`);
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
            setIssues(data.issues);
        } catch (err: unknown) {
            setError(getErrorMessage(err) || 'Failed to fetch issues');
        } finally {
            setLoading(false);
        }
    }, [activeRepo]);

    useEffect(() => {
        if (activeRepo) {
            void fetchStaleIssues();
        }
    }, [activeRepo, fetchStaleIssues]);

    async function handleRunScan() {
        if (!confirm('This will leave comments and close issues on GitHub. Are you sure?')) return;
        setRunningAction(true);
        setError(null);
        try {
            const res = await fetch(`/api/stale?repo=${encodeURIComponent(activeRepo)}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
            setSummary({ processed: data.processed, results: data.results });
            await fetchStaleIssues(); // Refresh list after DB mutations
        } catch (err: unknown) {
            setError(getErrorMessage(err) || 'Failed to run stale scan');
        } finally {
            setRunningAction(false);
        }
    }

    const markedForStaleCount = issues.filter((i) => i.action === 'MARK_STALE').length;
    const markedForCloseCount = issues.filter((i) => i.action === 'CLOSE').length;
    const actionableCount = markedForStaleCount + markedForCloseCount;

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">🕓 Stale Issues</h1>
                <p className="page-subtitle">
                    Detect PRs and issues sitting idle. The system can automatically label, warn, and close them.
                </p>
            </div>

            {error && (
                <div className="banner error" style={{ marginBottom: '1.25rem' }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {summary && (
                <div className="banner info" style={{ marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div>
                        <span>✅</span> <strong>Scan complete!</strong> Processed {summary.processed} open issues/PRs.
                    </div>
                    {summary.results.length > 0 && (
                        <ul style={{ paddingLeft: '2rem', marginTop: '0.5rem', fontSize: '0.8rem', color: '#93c5fd' }}>
                            {summary.results.map((r, i) => (
                                <li key={i}>#{r.number} — {r.action}</li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-header-row">
                    <div>
                        <p className="card-title">Pending Actions Pipeline</p>
                        <p className="card-subtitle">Snapshot of the currently open repository items</p>
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleRunScan}
                        disabled={loading || runningAction || actionableCount === 0}
                        style={{
                            background: actionableCount > 0 ? 'var(--primary)' : 'rgba(255,255,255,0.05)',
                            color: actionableCount > 0 ? '#fff' : 'var(--text-muted)'
                        }}
                    >
                        {runningAction ? (
                            <><span className="spinner" /> Executing Action...</>
                        ) : (
                            `Run Stale Action (${actionableCount})`
                        )}
                    </button>
                </div>

                <div className="status-grid" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                    <div className="status-item">
                        <span className="status-label">Items to Mark Stale</span>
                        <span className="status-value" style={{ color: markedForStaleCount > 0 ? 'var(--warning)' : 'var(--text-main)' }}>
                            {loading ? '-' : markedForStaleCount}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">Items to Close</span>
                        <span className="status-value" style={{ color: markedForCloseCount > 0 ? 'var(--error)' : 'var(--text-main)' }}>
                            {loading ? '-' : markedForCloseCount}
                        </span>
                    </div>
                    <div className="status-item">
                        <span className="status-label">Total Open</span>
                        <span className="status-value">{loading ? '-' : issues.length}</span>
                    </div>
                </div>
            </div>

            <div className="glass-card">
                <div className="card-header-row" style={{ marginBottom: '1.5rem' }}>
                    <p className="card-title">Queue</p>
                    <button className="btn btn-ghost" onClick={fetchStaleIssues} disabled={loading || runningAction} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        {loading ? 'Refreshing...' : '↻ Refresh'}
                    </button>
                </div>

                {loading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div className="spinner" style={{ margin: '0 auto 1rem', width: '24px', height: '24px', borderTopColor: 'var(--primary)' }} />
                        Fetching queue from GitHub...
                    </div>
                ) : issues.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-subtle)' }}>
                        No open issues or pull requests found in this repository.
                    </div>
                ) : (
                    <div className="issue-list">
                        {issues.map((issue) => (
                            <a
                                key={issue.number}
                                href={issue.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="issue-row"
                            >
                                <div className="issue-main">
                                    <div className="issue-title-row">
                                        <span className="issue-number">#{issue.number}</span>
                                        <span className="issue-title">{issue.title}</span>
                                    </div>
                                    <div className="issue-meta">
                                        Last updated: {new Date(issue.updatedAt).toLocaleDateString()}
                                        {issue.labels.length > 0 && ` • Labels: ${issue.labels.join(', ')}`}
                                    </div>
                                </div>

                                <div className="issue-badge-wrap">
                                    {issue.action === 'CLOSE' ? (
                                        <span className="issue-badge close">
                                            WILL CLOSE
                                        </span>
                                    ) : issue.action === 'MARK_STALE' ? (
                                        <span className="issue-badge stale">
                                            MARKING STALE
                                        </span>
                                    ) : issue.isStale ? (
                                        <span className="issue-badge dormant">
                                            ALREADY STALE
                                        </span>
                                    ) : (
                                        <span className="issue-badge active">
                                            ACTIVE
                                        </span>
                                    )}
                                </div>
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
