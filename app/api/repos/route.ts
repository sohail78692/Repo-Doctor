import { NextResponse } from 'next/server';
import { octokit } from '@/lib/github';

export async function GET() {
    try {
        const { data } = await octokit.rest.repos.listForAuthenticatedUser({
            sort: 'updated',
            per_page: 50,
        });

        const repos = data.map((r) => ({
            name: r.name,
            full_name: r.full_name,
            owner: r.owner.login,
            description: r.description,
            updated_at: r.updated_at,
        }));

        return NextResponse.json({ success: true, repos });
    } catch (error: unknown) {
        console.error('Failed to list repos:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
