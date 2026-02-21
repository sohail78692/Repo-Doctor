import { Octokit } from '@octokit/rest';
import { env } from './env';

export const octokit = new Octokit({
    auth: env.GITHUB_TOKEN,
});

export type RepoParams = {
    owner: string;
    repo: string;
};

type RepoInput =
    | string
    | {
        nextUrl?: {
            searchParams?: URLSearchParams;
        };
    };

function parseRepoString(repoStr: string): RepoParams | null {
    const parts = repoStr.split('/').map(part => part.trim());
    if (parts.length !== 2) return null;

    const [owner, repo] = parts;
    if (!owner || !repo) return null;

    return { owner, repo };
}

export function getRepoParams(reqOrString?: RepoInput) {
    let repoStr = '';

    if (typeof reqOrString === 'string') {
        repoStr = reqOrString;
    } else if (reqOrString?.nextUrl?.searchParams) {
        repoStr = reqOrString.nextUrl.searchParams.get('repo') || '';
    }

    const parsedRepo = parseRepoString(repoStr);
    if (parsedRepo) {
        return parsedRepo;
    }

    return {
        owner: env.GITHUB_OWNER.trim(),
        repo: (env.GITHUB_REPO || '').trim(),
    };
}

export function hasValidRepoParams(repoParams: RepoParams) {
    return Boolean(repoParams.owner && repoParams.repo);
}
