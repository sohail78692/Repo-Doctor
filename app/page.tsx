'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRepo } from './components/RepoProvider';

interface Feature {
  href: string;
  icon: string;
  title: string;
  description: string;
  color: string;
  soon?: boolean;
}

const features: Feature[] = [
  {
    href: '/pr',
    icon: '⚡',
    title: 'PR Analyzer',
    description: 'Get instant risk scores, auto-checklists, and GitHub comments for any pull request.',
    color: '#0f766e',
  },
  {
    href: '/alerts',
    icon: '🚨',
    title: 'Smart Alerts',
    description: 'Set thresholds and dispatch webhook alerts when repo health signals cross your limits.',
    color: '#b91c1c',
  },
  {
    href: '/stale',
    icon: '🕓',
    title: 'Stale Issues',
    description: 'Detect and surface stale PRs and issues that need attention from maintainers.',
    color: '#ea580c',
  },
  {
    href: '/commits',
    icon: '📈',
    title: 'Commit History',
    description: 'Visualize full commit history with trend graphs, contributor charts, and totals.',
    color: '#be123c',
  },
  {
    href: '/changelog',
    icon: '📋',
    title: 'Changelog',
    description: 'Auto-generate a structured changelog from merged pull requests.',
    color: '#2563eb',
  },
  {
    href: '/report',
    icon: '📊',
    title: 'Weekly Report',
    description: 'A full weekly health report card for your repository.',
    color: '#be123c',
  },
];

export default function Dashboard() {
  const { activeRepo } = useRepo();
  const [status, setStatus] = useState({
    db: 'Loading...',
    github: 'Loading...',
    repo: activeRepo,
    node: '...',
  });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/status?repo=${encodeURIComponent(activeRepo)}`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setStatus(data);
      })
      .catch(e => console.error(e));

    return () => {
      cancelled = true;
    };
  }, [activeRepo]);

  return (
    <>
      {/* ── Page Header ── */}
      <div className="page-header">
        <h1 className="page-title">🩺 Dashboard</h1>
        <p className="page-subtitle">
          Overview of connected services and available tools.
        </p>
      </div>

      {/* ── Service Status ── */}
      <div className="glass-card" style={{ marginBottom: '1.25rem' }}>
        <p className="card-title">Service Status</p>
        <p className="card-subtitle">Real-time health check of connected services.</p>

        <div className="status-grid">
          <div className="status-item">
            <span className="status-label">MongoDB Atlas</span>
            <span className={`status-value ${status.db === 'Online' ? 'status-online' : status.db === 'Offline' ? 'status-offline' : ''}`}>
              {status.db === 'Online' ? '● ' : status.db === 'Offline' ? '○ ' : ''}{status.db}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">GitHub API</span>
            <span className={`status-value ${status.github === 'Online' ? 'status-online' : status.github === 'Offline' ? 'status-offline' : ''}`}>
              {status.github === 'Online' ? '● ' : status.github === 'Offline' ? '○ ' : ''}{status.github}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Target Repository</span>
            <span className="status-value" style={{ fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
              {activeRepo || status.repo || 'Not configured'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Runtime</span>
            <span className="status-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem' }}>
              {status.node}
            </span>
          </div>
        </div>
      </div>

      {/* ── Feature Cards ── */}
      <div className="glass-card" style={{ maxWidth: '860px' }}>
        <p className="card-title">Tools</p>
        <p className="card-subtitle">Choose a tool to get started.</p>

        <div className="feature-grid">
          {features.map(({ href, icon, title, description, color, soon }) => (
            <Link
              key={href}
              href={soon ? '#' : href}
              className="feature-card"
              style={{
                '--feature-color': color,
                cursor: soon ? 'default' : 'pointer',
              } as React.CSSProperties}
            >
              {soon && (
                <span style={{
                  position: 'absolute', top: '0.6rem', right: '0.75rem',
                  fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color, background: color + '22',
                  border: `1px solid ${color}44`, borderRadius: '20px',
                  padding: '0.15rem 0.5rem',
                }}>
                  Coming soon
                </span>
              )}
              <span style={{ fontSize: '1.4rem' }}>{icon}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                {title}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                {description}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
