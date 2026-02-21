import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { RepoProvider } from './components/RepoProvider';
import { Sidebar } from './components/Sidebar';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-sans',
  weight: ['400', '500', '600', '700'],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-mono-app',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: 'GitHub Repo Doctor',
  description: 'All-in-one GitHub repository health tool — PR risk scoring, stale detection, changelog generation & more.',
};

const themeInitScript = `
(() => {
  try {
    const savedTheme = localStorage.getItem('repo-doctor-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme === 'dark' || savedTheme === 'light'
      ? savedTheme
      : (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const owner = process.env.NEXT_PUBLIC_GITHUB_OWNER?.trim() || '';
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO?.trim() || '';
  const defaultRepo = owner && repo ? `${owner}/${repo}` : '';

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
        <Script id="repo-doctor-theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <RepoProvider defaultRepo={defaultRepo}>
          <div className="app-shell">
            <Sidebar />

            {/* ── Page Content ── */}
            <div className="page-content">
              {children}
            </div>
          </div>
        </RepoProvider>
      </body>
    </html>
  );
}
