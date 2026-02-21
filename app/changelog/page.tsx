'use client';

import { useState } from 'react';
import { useRepo } from './../components/RepoProvider';

export default function ChangelogPage() {
    const { activeRepo } = useRepo();
    const [changelog, setChangelog] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    async function generate() {
        setLoading(true);
        setError(null);
        setChangelog(null);
        try {
            const res = await fetch(`/api/changelog?repo=${encodeURIComponent(activeRepo)}`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.error);
            setChangelog(data.changelog);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to generate changelog';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    async function handleCopy() {
        if (changelog) {
            try {
                await navigator.clipboard.writeText(changelog);
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
                <h1 className="page-title">📋 Auto-Changelog</h1>
                <p className="page-subtitle">
                    Generate clean, categorized markdown changelogs from your recently merged pull requests.
                </p>
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <p className="card-title">Generate Report</p>
                <p className="card-subtitle">
                    Fetches all merged PRs since the last release (or within the last 30 days) and organizes them by label (e.g. <code>bug</code>, <code>enhancement</code>).
                </p>

                <button
                    className="btn btn-primary"
                    onClick={generate}
                    disabled={loading}
                >
                    {loading ? <><span className="spinner" /> Generating...</> : '🚀 Build Changelog'}
                </button>

                {error && (
                    <div className="banner error" style={{ marginTop: '1rem' }}>
                        <span>⚠️</span> {error}
                    </div>
                )}
            </div>

            {changelog && (
                <div className="glass-card" style={{ animation: 'fadeUp 0.3s ease both' }}>
                    <div className="card-header-row" style={{ marginBottom: '1rem' }}>
                        <p className="card-title" style={{ marginBottom: 0 }}>Result (Markdown)</p>
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
                        {changelog}
                    </pre>
                </div>
            )}
        </>
    );
}
