'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navLinks = [
    { href: '/', icon: '◈', label: 'Dashboard' },
    { href: '/pr', icon: '⚡', label: 'PR Analyzer' },
    { href: '/commits', icon: '📈', label: 'Commit History' },
    { href: '/actions', icon: '✅', label: 'Action Center' },
    { href: '/alerts', icon: '🚨', label: 'Smart Alerts' },
    { href: '/stale', icon: '🕓', label: 'Stale Issues' },
    { href: '/changelog', icon: '📋', label: 'Changelog' },
    { href: '/report', icon: '📊', label: 'Weekly Report' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
            </aside>
        </>
    );
}
