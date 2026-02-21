'use client';

import { useState } from 'react';
import { useRepo } from './../components/RepoProvider';
import { GeneratedMarkdownCard } from './../components/GeneratedMarkdownCard';

export default function ChangelogPage() {
    const { activeRepo } = useRepo();
    const [changelog, setChangelog] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                <GeneratedMarkdownCard
                    title="Release Changelog"
                    content={changelog}
                    fileName="changelog.md"
                />
            )}
        </>
    );
}
