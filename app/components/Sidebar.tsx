'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRepo } from './RepoProvider';
import { useState, useRef, useEffect } from 'react';

const navLinks = [
    { href: '/', icon: '◈', label: 'Dashboard' },
    { href: '/pr', icon: '⚡', label: 'PR Analyzer' },
    { href: '/commits', icon: '📈', label: 'Commit History' },
    { href: '/stale', icon: '🕓', label: 'Stale Issues' },
    { href: '/changelog', icon: '📋', label: 'Changelog' },
    { href: '/report', icon: '📊', label: 'Weekly Report' },
];

interface Repo {
    full_name: string;
    updated_at: string;
}

type ThemeMode = 'light' | 'dark';

const REPO_FULL_NAME_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function Sidebar() {
    const pathname = usePathname();
    const { activeRepo, setActiveRepo } = useRepo();
    const [isOpen, setIsOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [theme, setTheme] = useState<ThemeMode>('light');
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleDropdown = async () => {
        const nextState = !isOpen;
        setIsOpen(nextState);
        setSearch('');

        if (nextState && repos.length === 0) {
            setLoading(true);
            try {
                const res = await fetch('/api/repos');
                const data = await res.json();
                if (data.success) {
                    setRepos(data.repos);
                }
            } catch (err) {
                console.error('Failed to load repos:', err);
            } finally {
                setLoading(false);
            }
        }
    };

    // Auto-focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchRef.current) {
            searchRef.current.focus();
        }
    }, [isOpen]);

    useEffect(() => {
        setMobileNavOpen(false);
    }, [pathname]);

    useEffect(() => {
        const savedTheme = localStorage.getItem('repo-doctor-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const nextTheme: ThemeMode = savedTheme === 'dark' || savedTheme === 'light'
            ? savedTheme
            : (prefersDark ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', nextTheme);
        setTheme(nextTheme);
    }, []);

    const toggleTheme = () => {
        const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
        setTheme(nextTheme);
        localStorage.setItem('repo-doctor-theme', nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
    };

    const handleSelectRepo = (repoName: string) => {
        setActiveRepo(repoName);
        setIsOpen(false);
    };

    const handleCustomSubmit = (e: React.KeyboardEvent) => {
        const trimmedSearch = search.trim();
        if (e.key === 'Enter' && REPO_FULL_NAME_PATTERN.test(trimmedSearch)) {
            setActiveRepo(trimmedSearch);
            setIsOpen(false);
        }
    };

    const filteredRepos = repos.filter(r =>
        r.full_name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <>
            <button
                type="button"
                className={`mobile-nav-toggle ${mobileNavOpen ? 'active' : ''}`}
                onClick={() => setMobileNavOpen(prev => !prev)}
                aria-expanded={mobileNavOpen}
                aria-controls="app-sidebar"
            >
                <span className="mobile-nav-toggle-icon">{mobileNavOpen ? '✕' : '☰'}</span>
                <span>{mobileNavOpen ? 'Close' : 'Menu'}</span>
            </button>

            <button
                type="button"
                className="theme-switch"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
                <span className="theme-switch-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
                <span className="theme-switch-text">{theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            {mobileNavOpen && (
                <button
                    type="button"
                    className="sidebar-overlay"
                    aria-label="Close navigation menu"
                    onClick={() => setMobileNavOpen(false)}
                />
            )}

            <aside id="app-sidebar" className={`sidebar ${mobileNavOpen ? 'mobile-open' : ''}`}>
            <Link href="/" className="sidebar-logo">
                <div className="sidebar-logo-icon">🩺</div>
                <div className="sidebar-logo-text">
                    <span className="sidebar-logo-title">Repo Doctor</span>
                    <span className="sidebar-logo-sub">Health Toolkit</span>
                </div>
            </Link>

            <span className="sidebar-section-label">Navigation</span>

            {navLinks.map(({ href, icon, label }) => {
                const isActive = pathname === href;
                return (
                    <Link
                        key={href}
                        href={href}
                        className={`sidebar-link ${isActive ? 'active' : ''}`}
                        onClick={() => setMobileNavOpen(false)}
                    >
                        <span className="sidebar-link-icon">{icon}</span>
                        {label}
                    </Link>
                );
            })}

            <div className="sidebar-footer" style={{ position: 'relative' }} ref={dropdownRef}>
                <span className="sidebar-section-label" style={{ padding: '0 0.75rem 0.5rem' }}>Active Target</span>

                <div
                    className="sidebar-repo-badge"
                    onClick={toggleDropdown}
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
                        <span>📁</span>
                        <span>{activeRepo || 'No repo selected'}</span>
                    </div>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
                </div>

                {/* Dropdown Menu */}
                {isOpen && (
                    <div className="dropdown-menu">
                        <div className="dropdown-search">
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleCustomSubmit}
                                placeholder="Search or type owner/repo..."
                                className="dropdown-input"
                            />
                        </div>

                        <div className="dropdown-list">
                            {loading ? (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    <span className="spinner" style={{ display: 'inline-block', width: '12px', height: '12px', borderTopColor: 'var(--text-subtle)' }} /> Loading repos...
                                </div>
                            ) : filteredRepos.length > 0 ? (
                                filteredRepos.map((repo) => {
                                    const isActive = repo.full_name === activeRepo;
                                    return (
                                        <button
                                            key={repo.full_name}
                                            onClick={() => handleSelectRepo(repo.full_name)}
                                            className={`dropdown-item ${isActive ? 'active' : ''}`}
                                        >
                                            <span className="dropdown-item-icon">✓</span>
                                            <span className="dropdown-item-text">{repo.full_name}</span>
                                        </button>
                                    );
                                })
                            ) : (
                                <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    {REPO_FULL_NAME_PATTERN.test(search.trim())
                                        ? 'Press Enter to select custom repo'
                                        : 'No matches found.'}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            </aside>
        </>
    );
}
