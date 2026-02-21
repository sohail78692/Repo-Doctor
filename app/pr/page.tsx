'use client';

import { useState } from 'react';
import { useRepo } from './../components/RepoProvider';

interface RiskAnalysis {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH';
    reasons: string[];
}

interface PRResult {
    success: boolean;
    risk: RiskAnalysis;
    checklist: string;
    error?: string;
}

interface ChecklistEntry {
    label: string;
    checked: boolean;
}

function parseChecklist(raw: string): ChecklistEntry[] {
    return raw.split('\n').filter(Boolean).map((line) => ({
        checked: line.includes('[x]'),
        label: line.replace(/- \[.\] /, ''),
    }));
}

// SVG arc ring for the risk score
function RiskRing({ score, level }: { score: number; level: 'LOW' | 'MEDIUM' | 'HIGH' }) {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const colorMap = {
        LOW: '#10b981',
        MEDIUM: '#f59e0b',
        HIGH: '#ef4444',
    };
    const color = colorMap[level];

    return (
        <svg width="120" height="120" viewBox="0 0 120 120" className="risk-ring-svg">
            {/* Track */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(15, 23, 42, 0.16)"
                strokeWidth="10" />
            {/* Progress */}
            <circle cx="60" cy="60" r={radius} fill="none" stroke={color}
                strokeWidth="10" strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 60 60)"
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)' }}
            />
            {/* Center text */}
            <text x="60" y="55" textAnchor="middle" fill="var(--text-main)"
                fontSize="22" fontWeight="800" fontFamily="var(--font-sans), sans-serif">
                {score}
            </text>
            <text x="60" y="72" textAnchor="middle" fill="var(--text-muted)"
                fontSize="10" fontFamily="var(--font-sans), sans-serif">
                / 100
            </text>
        </svg>
    );
}

export default function PRAnalyzerPage() {
    const { activeRepo } = useRepo();
    const [prNumber, setPrNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PRResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function handleAnalyze() {
        const num = parseInt(prNumber, 10);
        if (!prNumber || isNaN(num) || num < 1) {
            setError('Please enter a valid PR number.');
            return;
        }

        setLoading(true);
        setResult(null);
        setError(null);

        try {
            const res = await fetch(`/api/analyze-pr?repo=${encodeURIComponent(activeRepo)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pull_number: num }),
            });

            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.error || `HTTP ${res.status}`);
            }

            setResult(data);
        } catch (err: unknown) {
            const message = err instanceof Error
                ? err.message
                : 'Something went wrong. Check your PR number and try again.';
            setError(message);
        } finally {
            setLoading(false);
        }
    }

    const checklist = result ? parseChecklist(result.checklist) : [];
    const doneCount = checklist.filter((c) => c.checked).length;

    return (
        <>
            {/* ── Page Header ── */}
            <div className="page-header">
                <h1 className="page-title">⚡ PR Analyzer</h1>
                <p className="page-subtitle">
                    Enter a pull request number to get an instant risk score, checklist, and GitHub comment.
                </p>
            </div>

            {/* ── Input Card ── */}
            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <p className="card-title">Analyze a Pull Request</p>
                <p className="card-subtitle">
                    Fetches PR details from <strong style={{ color: 'var(--text-subtle)' }}>
                        {activeRepo}
                    </strong> and runs the health checks.
                </p>

                <div className="input-group">
                    <label htmlFor="pr-number-input" className="input-label">Pull Request Number</label>
                    <div className="input-row">
                        <input
                            id="pr-number-input"
                            className="input-field"
                            type="number"
                            min="1"
                            placeholder="e.g. 42"
                            value={prNumber}
                            onChange={(e) => { setPrNumber(e.target.value); setError(null); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                        />
                        <button
                            id="analyze-pr-btn"
                            className="btn btn-primary"
                            onClick={handleAnalyze}
                            disabled={loading}
                        >
                            {loading ? <><div className="spinner" /> Analyzing…</> : '🔍 Analyze PR'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="banner error">
                        <span>⚠️</span> {error}
                    </div>
                )}
            </div>

            {/* ── Results ── */}
            {result && (
                <>
                    {/* Risk Score Card */}
                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <p className="card-title">Risk Analysis</p>
                        <p className="card-subtitle">Overall health score for PR #{prNumber}</p>

                        <div className="risk-score-ring-wrapper">
                            <RiskRing score={result.risk.score} level={result.risk.level} />
                            <div className="risk-score-info">
                                <div className={`risk-badge ${result.risk.level}`}>
                                    {result.risk.level === 'HIGH' ? '🔴' :
                                        result.risk.level === 'MEDIUM' ? '🟡' : '🟢'} {result.risk.level} RISK
                                </div>
                                <div className="risk-score-number" style={{
                                    color: result.risk.level === 'HIGH' ? 'var(--risk-high)' :
                                        result.risk.level === 'MEDIUM' ? 'var(--risk-medium)' : 'var(--risk-low)',
                                }}>
                                    {result.risk.score}
                                </div>
                                <div className="risk-score-label">out of 100 risk points</div>
                            </div>
                        </div>

                        {result.risk.reasons.length > 0 && (
                            <>
                                <p className="section-label">Risk Factors</p>
                                <div className="reasons-list">
                                    {result.risk.reasons.map((r, i) => (
                                        <div
                                            key={i}
                                            className="reason-item"
                                            style={{ animationDelay: `${i * 80}ms` }}
                                        >
                                            <span>⚠</span> {r}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {result.risk.reasons.length === 0 && (
                            <div className="banner info">
                                <span>✅</span> No risk factors detected — this PR looks clean!
                            </div>
                        )}
                    </div>

                    {/* Checklist Card */}
                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-header-row">
                            <div>
                                <p className="card-title">📝 PR Checklist</p>
                                <p className="card-subtitle">Auto-generated based on changed files</p>
                            </div>
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                                borderRadius: '20px', padding: '0.3rem 0.8rem',
                                fontSize: '0.78rem', fontWeight: '700', color: 'var(--success)',
                            }}>
                                {doneCount}/{checklist.length} done
                            </div>
                        </div>

                        <div className="divider" />

                        <div className="checklist-items">
                            {checklist.map((item, i) => (
                                <div
                                    key={i}
                                    className={`checklist-item ${item.checked ? 'checked' : 'unchecked'}`}
                                    style={{ animationDelay: `${i * 60}ms` }}
                                >
                                    <div className={`check-icon ${item.checked ? 'done' : 'todo'}`}>
                                        {item.checked ? '✓' : '○'}
                                    </div>
                                    <span>{item.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* GitHub Comment Preview Card */}
                    <div className="glass-card">
                        <p className="card-title">💬 GitHub Comment</p>
                        <p className="card-subtitle">
                            A comment with this analysis was automatically posted (or updated) on PR #{prNumber}.
                        </p>
                        <div className="banner info" style={{ marginTop: '0.5rem' }}>
                            <span>ℹ️</span>
                            Check your PR on GitHub — Repo Doctor left a health summary comment.
                        </div>
                    </div>
                </>
            )}

            {/* ── Empty State ── */}
            {!result && !loading && (
                <div className="glass-card" style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '3rem 2rem', textAlign: 'center',
                    gap: '0.75rem', border: '1px dashed var(--card-border)',
                }}>
                    <div style={{ fontSize: '2.5rem' }}>🔬</div>
                    <p style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>No analysis yet</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', maxWidth: '360px' }}>
                        Enter a PR number above and click <strong>Analyze PR</strong> to run the health check.
                    </p>
                </div>
            )}
        </>
    );
}
