'use client';

import { useSyncExternalStore } from 'react';

type ThemeMode = 'light' | 'dark';
const THEME_CHANGE_EVENT = 'repo-doctor-theme-change';
const THEME_STORAGE_KEY = 'repo-doctor-theme';

function getThemeSnapshot(): ThemeMode {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function getServerThemeSnapshot(): ThemeMode {
    return 'light';
}

function subscribeTheme(onStoreChange: () => void) {
    if (typeof window === 'undefined') {
        return () => { };
    }

    const handleStorage = (event: StorageEvent) => {
        if (event.key && event.key !== THEME_STORAGE_KEY) return;
        onStoreChange();
    };

    const handleThemeEvent = () => onStoreChange();

    window.addEventListener('storage', handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeEvent);
    return () => {
        window.removeEventListener('storage', handleStorage);
        window.removeEventListener(THEME_CHANGE_EVENT, handleThemeEvent);
    };
}

export function ThemeToggle() {
    const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);

    const toggleTheme = () => {
        const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
        localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        document.documentElement.setAttribute('data-theme', nextTheme);
        window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
    };

    return (
        <button
            type="button"
            className="theme-switch"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
            <span className="theme-switch-icon">{theme === 'dark' ? '🌙' : '☀️'}</span>
            <span className="theme-switch-text">{theme === 'dark' ? 'Dark' : 'Light'}</span>
        </button>
    );
}
