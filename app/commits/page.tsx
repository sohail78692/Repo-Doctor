'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { useRepo } from './../components/RepoProvider';

type Scope = 'full' | 'range';

type CommitHistoryPayload = {
    success: boolean;
    repo: string;
    scope: Scope;
    days: number | null;
    truncated: boolean;
    totals: {
        commits: number;
        contributors: number;
        mergeCommits: number;
    };
    range: {
        from: string | null;
        to: string | null;
    };
    charts: {
        daily: Array<{ date: string; count: number }>;
        monthly: Array<{ month: string; count: number }>;
        contributors: Array<{ author: string; count: number }>;
        weekdays: Array<{ day: string; count: number }>;
    };
    error?: string;
};

type TrendWindow = '7' | '30' | '90';

type TrendWindowMetrics = {
    commits: number;
    commitVelocity: number;
    mergedPrs: number;
    avgMergeHours: number | null;
    issuesOpened: number;
    issuesClosed: number;
    issueCloseRate: number | null;
    staleMarked: number;
    staleResolved: number;
    staleGrowth: number;
};

type TimeTrendsPayload = {
    success: boolean;
    repo: string;
    generatedAt: string;
    lookbackDays: number;
    metrics: Record<TrendWindow, TrendWindowMetrics>;
    totals: {
        staleOpenNow: number | null;
        commitsLast90d: number;
        mergedPrsLast90d: number;
        issuesOpenedLast90d: number;
        issuesClosedLast90d: number;
    };
    series: {
        commits: Array<{ date: string; count: number }>;
        mergeTime: Array<{ date: string; mergedPrs: number; avgHours: number | null }>;
        issueCloseRate: Array<{ date: string; opened: number; closed: number; closeRate: number | null }>;
        staleGrowth: Array<{ date: string; marked: number; resolved: number; net: number; cumulative: number }>;
    };
    truncated: {
        commits: boolean;
        pulls: boolean;
        issues: boolean;
    };
    error?: string;
};

function formatIsoDate(value: string | null) {
    if (!value) return 'N/A';
    const date = new Date(value);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function formatNumber(value: number | null, fallback = 'N/A') {
    if (value === null || Number.isNaN(value)) return fallback;
    return value.toLocaleString();
}

function formatDecimal(value: number | null, suffix = '', fallback = 'N/A') {
    if (value === null || Number.isNaN(value)) return fallback;
    return `${value.toFixed(2)}${suffix}`;
}

export default function CommitsPage() {
    const { activeRepo } = useRepo();
    const [scope, setScope] = useState<Scope>('full');
    const [days, setDays] = useState<number>(365);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<CommitHistoryPayload | null>(null);
    const [trendsLoading, setTrendsLoading] = useState(false);
    const [trendsError, setTrendsError] = useState<string | null>(null);
    const [trends, setTrends] = useState<TimeTrendsPayload | null>(null);
    const [trendWindow, setTrendWindow] = useState<TrendWindow>('30');

    const dayRangeOptions = useMemo(() => [30, 90, 180, 365, 730], []);
    const trendWindows = useMemo(() => ['7', '30', '90'] as const, []);
    const axisTickStyle = useMemo(() => ({ fill: 'var(--text-muted)', fontSize: 11 }), []);
    const tooltipStyle = useMemo(() => ({
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--card-border)',
        borderRadius: '10px',
        color: 'var(--text-main)',
    }), []);
    const selectedTrendMetrics = trends?.metrics[trendWindow] ?? null;

    useEffect(() => {
        if (!activeRepo) return;

        let cancelled = false;
        async function loadCommitHistory() {
            setLoading(true);
            setError(null);

            try {
                const params = new URLSearchParams({
                    repo: activeRepo,
                    scope,
                });
                if (scope === 'range') params.set('days', String(days));

                const res = await fetch(`/api/commit-history?${params.toString()}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.error || `HTTP ${res.status}`);
                }

                if (!cancelled) setData(json);
            } catch (fetchError: unknown) {
                const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch commit history';
                if (!cancelled) setError(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void loadCommitHistory();
        return () => {
            cancelled = true;
        };
    }, [activeRepo, scope, days]);

    useEffect(() => {
        if (!activeRepo) {
            setTrends(null);
            return;
        }

        let cancelled = false;
        async function loadTimeTrends() {
            setTrendsLoading(true);
            setTrendsError(null);

            try {
                const res = await fetch(`/api/time-trends?repo=${encodeURIComponent(activeRepo)}`);
                const json = await res.json();

                if (!res.ok || !json.success) {
                    throw new Error(json.error || `HTTP ${res.status}`);
                }

                if (!cancelled) setTrends(json);
            } catch (fetchError: unknown) {
                const message = fetchError instanceof Error ? fetchError.message : 'Failed to fetch time trends';
                if (!cancelled) setTrendsError(message);
            } finally {
                if (!cancelled) setTrendsLoading(false);
            }
        }

        void loadTimeTrends();
        return () => {
            cancelled = true;
        };
    }, [activeRepo]);

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">📈 Commit History</h1>
                <p className="page-subtitle">
                    Complete commit activity view with trend graphs, contributor charts, and total commit numbers.
                </p>
            </div>

            <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                <div className="card-header-row">
                    <div>
                        <p className="card-title">History Settings</p>
                        <p className="card-subtitle">
                            Repo: <strong style={{ fontFamily: 'var(--font-mono)' }}>{activeRepo || 'Not selected'}</strong>
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            className={`btn ${scope === 'full' ? 'btn-primary' : ''}`}
                            onClick={() => setScope('full')}
                            disabled={loading}
                        >
                            Full History
                        </button>
                        <button
                            className={`btn ${scope === 'range' ? 'btn-primary' : ''}`}
                            onClick={() => setScope('range')}
                            disabled={loading}
                        >
                            Date Range
                        </button>
                        {scope === 'range' && (
                            <select
                                className="input-field"
                                value={days}
                                onChange={(e) => setDays(Number.parseInt(e.target.value, 10))}
                                style={{ width: '130px' }}
                            >
                                {dayRangeOptions.map(option => (
                                    <option key={option} value={option}>
                                        Last {option}d
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>
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
                        Loading commit history...
                    </div>
                </div>
            )}

            {data && !loading && (
                <>
                    {data.truncated && (
                        <div className="banner info" style={{ marginBottom: '1rem' }}>
                            <span>ℹ️</span> Large repository detected. Showing the latest 5,000 commits for performance.
                        </div>
                    )}

                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <p className="card-title">Commit Totals</p>
                        <div className="status-grid" style={{ marginTop: '0.75rem' }}>
                            <div className="status-item">
                                <span className="status-label">Total Commits</span>
                                <span className="status-value">{data.totals.commits.toLocaleString()}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Contributors</span>
                                <span className="status-value">{data.totals.contributors.toLocaleString()}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Merge Commits</span>
                                <span className="status-value">{data.totals.mergeCommits.toLocaleString()}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">History Range</span>
                                <span className="status-value" style={{ fontSize: '0.9rem' }}>
                                    {formatIsoDate(data.range.from)} - {formatIsoDate(data.range.to)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.2rem',
                            maxWidth: '980px',
                        }}
                    >
                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Daily Commit Graph</p>
                            <p className="card-subtitle">Commit count by day</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={data.charts.daily}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="date" tick={axisTickStyle} minTickGap={36} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="#0f766e"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Monthly Commit Trend</p>
                            <p className="card-subtitle">Commits aggregated by month</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={data.charts.monthly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="month" tick={axisTickStyle} minTickGap={20} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Bar dataKey="count" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Top Contributors</p>
                            <p className="card-subtitle">Most commits by author</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={data.charts.contributors}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="author" tick={axisTickStyle} minTickGap={24} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Bar dataKey="count" fill="#ea580c" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Weekday Activity</p>
                            <p className="card-subtitle">Commit distribution across the week</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={data.charts.weekdays}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="day" tick={axisTickStyle} interval={0} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Bar dataKey="count" fill="#be123c" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {trendsError && (
                <div className="banner error" style={{ marginBottom: '1rem' }}>
                    <span>⚠️</span> Time trends: {trendsError}
                </div>
            )}

            {trendsLoading && (
                <div className="glass-card" style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className="spinner" />
                        Loading 7/30/90 day trends...
                    </div>
                </div>
            )}

            {trends && selectedTrendMetrics && !trendsLoading && (
                <>
                    <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
                        <div className="card-header-row">
                            <div>
                                <p className="card-title">Time Trends (7 / 30 / 90 days)</p>
                                <p className="card-subtitle">
                                    Windowed engineering signals across commits, PRs, issues, and stale backlog.
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                                {trendWindows.map(windowValue => (
                                    <button
                                        key={windowValue}
                                        className={`btn ${trendWindow === windowValue ? 'btn-primary' : ''}`}
                                        onClick={() => setTrendWindow(windowValue)}
                                    >
                                        {windowValue}d
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="status-grid" style={{ marginTop: '0.8rem' }}>
                            <div className="status-item">
                                <span className="status-label">Commit Velocity</span>
                                <span className="status-value">{formatDecimal(selectedTrendMetrics.commitVelocity, ' / day')}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Avg PR Merge Time</span>
                                <span className="status-value">{formatDecimal(selectedTrendMetrics.avgMergeHours, 'h')}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Issue Close Rate</span>
                                <span className="status-value">{formatDecimal(selectedTrendMetrics.issueCloseRate, '%')}</span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Stale Growth</span>
                                <span
                                    className="status-value"
                                    style={{ color: selectedTrendMetrics.staleGrowth > 0 ? 'var(--warning)' : 'var(--success)' }}
                                >
                                    {selectedTrendMetrics.staleGrowth > 0 ? '+' : ''}
                                    {selectedTrendMetrics.staleGrowth.toLocaleString()}
                                </span>
                            </div>
                            <div className="status-item">
                                <span className="status-label">Open Stale Issues</span>
                                <span className="status-value">{formatNumber(trends.totals.staleOpenNow)}</span>
                            </div>
                        </div>

                        <div style={{ marginTop: '0.9rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                            Selected window totals: {selectedTrendMetrics.commits.toLocaleString()} commits,{' '}
                            {selectedTrendMetrics.mergedPrs.toLocaleString()} merged PRs,{' '}
                            {selectedTrendMetrics.issuesOpened.toLocaleString()} opened issues,{' '}
                            {selectedTrendMetrics.issuesClosed.toLocaleString()} closed issues.
                        </div>

                        {(trends.truncated.commits || trends.truncated.pulls || trends.truncated.issues) && (
                            <div className="banner info" style={{ marginTop: '0.9rem' }}>
                                <span>ℹ️</span> Some trend data was capped for performance on large repositories.
                            </div>
                        )}
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                            gap: '1rem',
                            marginBottom: '1.2rem',
                            maxWidth: '980px',
                        }}
                    >
                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Commit Velocity (Daily)</p>
                            <p className="card-subtitle">Commits per day over the last 90 days</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={trends.series.commits}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="date" tick={axisTickStyle} minTickGap={36} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            name="Commits"
                                            stroke="#0f766e"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">PR Merge Time (Daily Avg)</p>
                            <p className="card-subtitle">Average hours from PR creation to merge</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <LineChart data={trends.series.mergeTime}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="date" tick={axisTickStyle} minTickGap={36} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="avgHours"
                                            name="Avg merge hours"
                                            stroke="#2563eb"
                                            strokeWidth={2}
                                            connectNulls
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Issue Open vs Close Flow</p>
                            <p className="card-subtitle">Daily issue inflow and resolution trend</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <BarChart data={trends.series.issueCloseRate}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="date" tick={axisTickStyle} minTickGap={36} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="opened" name="Opened" fill="#ea580c" radius={[6, 6, 0, 0]} />
                                        <Bar dataKey="closed" name="Closed" fill="#16a34a" radius={[6, 6, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="glass-card" style={{ marginBottom: 0 }}>
                            <p className="card-title">Stale Growth (Net + Backlog Trend)</p>
                            <p className="card-subtitle">Daily net stale change and cumulative trajectory</p>
                            <div style={{ width: '100%', height: 280 }}>
                                <ResponsiveContainer>
                                    <ComposedChart data={trends.series.staleGrowth}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.24)" />
                                        <XAxis dataKey="date" tick={axisTickStyle} minTickGap={36} />
                                        <YAxis tick={axisTickStyle} />
                                        <Tooltip
                                            cursor={{ stroke: 'transparent', fill: 'transparent' }}
                                            contentStyle={tooltipStyle}
                                            labelStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
                                            itemStyle={{ color: 'var(--text-main)' }}
                                        />
                                        <Legend />
                                        <Bar dataKey="net" name="Net stale growth" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                                        <Line
                                            type="monotone"
                                            dataKey="cumulative"
                                            name="Cumulative net"
                                            stroke="#be123c"
                                            strokeWidth={2}
                                            dot={false}
                                            activeDot={{ r: 4 }}
                                        />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
