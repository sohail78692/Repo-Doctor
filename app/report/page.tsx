'use client';

import { useState } from 'react';
import { useRepo } from './../components/RepoProvider';
import { GeneratedMarkdownCard } from './../components/GeneratedMarkdownCard';

export default function WeeklyReportPage() {
    const { activeRepo } = useRepo();
    const [report, setReport] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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
                <GeneratedMarkdownCard
                    title="Maintainer Newsletter"
                    content={report}
                    fileName="weekly-report.md"
                />
            )}
        </>
    );
}
