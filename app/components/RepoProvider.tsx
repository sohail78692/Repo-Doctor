'use client';

import { createContext, useContext, useSyncExternalStore } from 'react';

type RepoContextType = {
    activeRepo: string;
    setActiveRepo: (repo: string) => void;
};

const RepoContext = createContext<RepoContextType>({
    activeRepo: '',
    setActiveRepo: () => { },
});

const ACTIVE_REPO_KEY = 'repo-doctor-active-repo';
const ACTIVE_REPO_CHANGE_EVENT = 'repo-doctor-active-repo-change';

export function RepoProvider({
    children,
    defaultRepo,
}: {
    children: React.ReactNode;
    defaultRepo: string;
}) {
    const activeRepo = useSyncExternalStore(
        (onStoreChange) => {
            const handleStorage = (event: Event) => {
                if (event instanceof StorageEvent && event.key && event.key !== ACTIVE_REPO_KEY) {
                    return;
                }
                onStoreChange();
            };

            window.addEventListener('storage', handleStorage);
            window.addEventListener(ACTIVE_REPO_CHANGE_EVENT, handleStorage);
            return () => {
                window.removeEventListener('storage', handleStorage);
                window.removeEventListener(ACTIVE_REPO_CHANGE_EVENT, handleStorage);
            };
        },
        () => localStorage.getItem(ACTIVE_REPO_KEY) || defaultRepo,
        () => defaultRepo
    );

    const setActiveRepo = (newRepo: string) => {
        localStorage.setItem(ACTIVE_REPO_KEY, newRepo);
        window.dispatchEvent(new Event(ACTIVE_REPO_CHANGE_EVENT));
    };

    return (
        <RepoContext.Provider value={{ activeRepo, setActiveRepo }}>
            {children}
        </RepoContext.Provider>
    );
}

export const useRepo = () => useContext(RepoContext);
