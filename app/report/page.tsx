'use client';

import { useState } from 'react';
import { useRepo } from './../components/RepoProvider';

export default function WeeklyReportPage() {
    const { activeRepo } = useRepo();
    const [report, setReport] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    async function generate() {
        setLoading(true);
        setError(null);
        setReport(null);
        try {
            const res = await fetch(`/api/weekly-report?repo=${encodeURIComponent(activeRepo)}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
            setReport(data.report);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to generate weekly report';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleCopy() {
        if (report) {
            try {
                await navigator.clipboard.writeText(report);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
            } catch {
                setError('Failed to copy to clipboard');
            }
        }
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">📊 Weekly Health Report</h1>
                <p className="page-subtitle">
                    Generates a comprehensive summary of repository activity over the last 7 days.
                </p>
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <p className="card-title">Run Maintainer Report</p>
                <p className="card-subtitle">
                    Analyzes merged PRs, opened issues, closed issues, and stale candidates to give you a full overview of the project&apos;s health.
                </p>

                <button
                    className="btn btn-primary"
                    onClick={generate}
                    disabled={loading}
                >
                    {loading ? <><span className="spinner" /> Analyzing GitHub Data...</> : '📈 Generate Report'}
                </button>

                {error && (
                    <div className="banner error" style={{ marginTop: '1rem' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}
            </div>

            {report && (
                <div className="glass-card" style={{ animation: 'fadeUp 0.3s ease both' }}>
                    <div className="card-header-row" style={{ marginBottom: '1rem' }}>
                        <p className="card-title" style={{ marginBottom: 0 }}>Maintainer Newsletter (Markdown)</p>
                        <button className="btn btn-ghost" onClick={handleCopy} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                            📋 Copy Raw
                        </button>
                    </div>

                    {copied && (
                        <div className="banner info" style={{ marginBottom: '0.85rem' }}>
                            <span>✅</span> Copied to clipboard
                        </div>
                    )}

                    <pre style={{
                        background: 'var(--bg-secondary)',
                        padding: '1.25rem',
                        borderRadius: '14px',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-main)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        overflowX: 'auto',
                        whiteSpace: 'pre-wrap',
                        lineHeight: 1.6
                    }}>
                        {report}
                    </pre>
                </div>
            )}
        </>
    );
}
