'use client';

import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { useRepo } from './../components/RepoProvider';

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

type ActionTask = {
    id: string;
    kind: 'CLOSE_STALE' | 'MARK_STALE' | 'STUCK_PR' | 'ADD_REVIEWERS' | 'STUCK_PR_AND_REVIEWERS';
    severity: Severity;
    title: string;
    detail: string;
    url: string;
    number: number;
    updatedAt: string;
};

type BulkAction = {
    id: 'CLOSE_STALE' | 'MARK_STALE' | 'REVIEW_STUCK_PRS' | 'ADD_REVIEWERS';
    title: string;
    description: string;
    count: number;
    severity: Severity;
    url: string;
};

type ActionCenterPayload = {
    success: boolean;
    repo: string;
    generatedAt: string;
    summary: {
        totalTasks: number;
        high: number;
        medium: number;
        low: number;
        staleToClose: number;
        staleToMark: number;
        stuckPrs: number;
        prsMissingReviewers: number;
    };
    bulkActions: BulkAction[];
    tasks: ActionTask[];
    error?: string;
};

function getErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'Unexpected error';
}

function formatDate(value: string) {
    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function severityColor(severity: Severity) {
    if (severity === 'HIGH') return 'var(--error)';
    if (severity === 'MEDIUM') return 'var(--warning)';
    return 'var(--success)';
}

function severityBackground(severity: Severity) {
    if (severity === 'HIGH') return 'var(--error-bg)';
    if (severity === 'MEDIUM') return 'var(--warning-bg)';
    return 'var(--success-bg)';
}

export default function ActionsPage() {
    const { activeRepo } = useRepo();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ActionCenterPayload | null>(null);

    const loadActionCenter = useCallback(async () => {
        if (!activeRepo) {
            setData(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/action-center?repo=${encodeURIComponent(activeRepo)}`);
            const json = await res.json() as ActionCenterPayload;
            if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
            setData(json);
        } catch (fetchError: unknown) {
            setError(getErrorMessage(fetchError));
        } finally {
            setLoading(false);
        }
    }, [activeRepo]);

    useEffect(() => {
        void loadActionCenter();
    }, [loadActionCenter]);

    const generatedAtText = useMemo(
        () => (data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : 'N/A'),
        [data?.generatedAt]
    );

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">✅ Action Center</h1>
                <p className="page-subtitle">
                    Prioritized maintainer tasks from stale issues, stuck PRs, and missing reviewer signals.
                </p>
            </div>

            {error && (
                <div className="banner error" style={{ marginBottom: '1rem' }}>
                    <span>⚠️</span> {error}
                </div>
            )}

            {loading && (
                <div className="glass-card" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="spinner" />
                        Building action queue...
                    </div>
                </div>
            )}

            {data && !loading && (
                <>
                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-header-row">
                            <div>
                                <p className="card-title">Queue Summary</p>
                                <p className="card-subtitle">
                                    Repo: <strong style={{ fontFamily: 'var(--font-mono)' }}>{data.repo}</strong>
                                </p>
                            </div>
                            <button className="btn btn-ghost" onClick={loadActionCenter}>
                                ↻ Refresh
                            </button>
                        </div>

                        <div className="status-grid" style={{ marginTop: '0.8rem' }}>
                            <div className="status-item">
                                <span className="status-label">Total Tasks</span>
                                <span className="status-value">{data.summary.totalTasks}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">High Priority</span>
                                <span className="status-value" style={{ color: 'var(--error)' }}>{data.summary.high}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Medium Priority</span>
                                <span className="status-value" style={{ color: 'var(--warning)' }}>{data.summary.medium}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Low Priority</span>
                                <span className="status-value" style={{ color: 'var(--success)' }}>{data.summary.low}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Stuck PRs</span>
                                <span className="status-value">{data.summary.stuckPrs}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Missing Reviewers</span>
                                <span className="status-value">{data.summary.prsMissingReviewers}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '0.8rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Last updated: {generatedAtText}
                        </div>
                    </div>

                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <p className="card-title">Bulk Actions</p>
                        <p className="card-subtitle">Open direct GitHub queries for immediate cleanup.</p>

                        <div className="feature-grid" style={{ marginTop: '0.8rem' }}>
                            {data.bulkActions.map(action => (
                                <a
                                    key={action.id}
                                    className="feature-card"
                                    href={action.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        '--feature-color': severityColor(action.severity),
                                    } as CSSProperties}
                                >
                                    <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                        {action.title}
                                    </span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        {action.description}
                                    </span>
                                    <span
                                        style={{
                                            marginTop: '0.1rem',
                                            fontSize: '0.72rem',
                                            fontWeight: 700,
                                            color: severityColor(action.severity),
                                        }}
                                    >
                                        {action.count} item{action.count === 1 ? '' : 's'} {'->'} Open in GitHub
                                    </span>
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card">
                        <p className="card-title">Priority Queue</p>
                        <p className="card-subtitle">Direct action tasks with one-click GitHub targets.</p>

                        {data.tasks.length === 0 ? (
                            <div style={{ marginTop: '1rem', color: 'var(--text-subtle)' }}>
                                No immediate actions. Repository looks healthy.
                            </div>
                        ) : (
                            <div className="issue-list" style={{ marginTop: '1rem' }}>
                                {data.tasks.map(task => (
                                    <a
                                        key={task.id}
                                        href={task.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="issue-row"
                                    >
                                        <div className="issue-main">
                                            <div className="issue-title-row">
                                                <span className="issue-number">#{task.number}</span>
                                                <span className="issue-title">{task.title}</span>
                                            </div>
                                            <div className="issue-meta">
                                                {task.detail} • Last update: {formatDate(task.updatedAt)}
                                            </div>
                                        </div>

                                        <div className="issue-badge-wrap" style={{ gap: '0.5rem' }}>
                                            <span
                                                className="issue-badge"
                                                style={{
                                                    color: severityColor(task.severity),
                                                    background: severityBackground(task.severity),
                                                    borderColor: 'transparent',
                                                }}
                                            >
                                                {task.severity}
                                            </span>
                                            <span className="issue-badge active">Open</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </>
    );
}
