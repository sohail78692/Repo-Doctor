'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRepo } from './RepoProvider';

interface Repo {
    full_name: string;
    updated_at: string;
}

const REPO_FULL_NAME_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function RepoSwitcher() {
    const { activeRepo, setActiveRepo } = useRepo();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [repos, setRepos] = useState<Repo[]>([]);
    const [loading, setLoading] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (open) {
            searchRef.current?.focus({ preventScroll: true });
        }
    }, [open]);

    const filteredRepos = useMemo(
        () => repos.filter(repo => repo.full_name.toLowerCase().includes(search.toLowerCase())),
        [repos, search]
    );

    const toggleOpen = async () => {
        const next = !open;
        setOpen(next);
        setSearch('');

        if (next && repos.length === 0) {
            setLoading(true);
            try {
                const response = await fetch('/api/repos');
                const data = await response.json();
                if (data.success) {
                    setRepos(data.repos);
                }
            } catch (error) {
                console.error('Failed to load repos:', error);
            } finally {
                setLoading(false);
            }
        }
    };

    const selectRepo = (repoFullName: string) => {
        setActiveRepo(repoFullName);
        setOpen(false);
        searchRef.current?.blur();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== 'Enter') return;
        const trimmed = search.trim();
        if (!REPO_FULL_NAME_PATTERN.test(trimmed)) return;

        selectRepo(trimmed);
    };

    return (
        <div className="repo-switcher" ref={rootRef}>
            <button type="button" className="repo-switcher-trigger" onClick={toggleOpen}>
                <span className="repo-switcher-icon">📁</span>
                <span className="repo-switcher-content">
                    <span className="repo-switcher-label">Workspace Repository</span>
                    <span className="repo-switcher-value">{activeRepo || 'Select repository'}</span>
                </span>
                <span className="repo-switcher-action">{open ? 'Close' : 'Change'}</span>
                <span className="repo-switcher-caret">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="repo-switcher-menu">
                    <div className="repo-switcher-menu-header">
                        <span>Choose Repository</span>
                        <span>{repos.length > 0 ? `${repos.length} available` : 'Type owner/repo'}</span>
                    </div>

                    <div className="dropdown-search">
                        <input
                            ref={searchRef}
                            type="text"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            onKeyDown={handleKeyDown}
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
                                        onClick={() => selectRepo(repo.full_name)}
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
    );
}
