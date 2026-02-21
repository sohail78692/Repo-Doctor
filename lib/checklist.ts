export function generateChecklist(pr: {
    filenames: string[];
}): string {
    const items: string[] = [];

    // Basic checks
    const hasTests = pr.filenames.some(f => f.includes('test') || f.includes('spec'));
    const hasDocs = pr.filenames.some(f => f.endsWith('.md') || f.includes('docs/'));

    items.push(`- [${hasTests ? 'x' : ' '}] Tests updated/added`);
    items.push(`- [${hasDocs ? 'x' : ' '}] Documentation updated`);

    // Contextual checks
    const isSchemaTouched = pr.filenames.some(f =>
        f.includes('schema') || f.includes('migration') || f.includes('model')
    );
    if (isSchemaTouched) {
        items.push(`- [ ] Migration notes included (Schema/DB touched)`);
    }

    const isRisky = pr.filenames.some(f =>
        /auth/i.test(f) || /infra/i.test(f) || /\.env/i.test(f)
    );
    if (isRisky) {
        items.push(`- [ ] Rollback plan verified (Risky files touched)`);
    }

    return items.join('\n');
}
