'use client';

import { Fragment, ReactNode, useMemo, useState } from 'react';

type Block =
    | { type: 'heading'; level: number; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'unordered-list'; items: string[] }
    | { type: 'ordered-list'; items: string[] }
    | { type: 'blockquote'; text: string }
    | { type: 'code'; language: string; code: string }
    | { type: 'divider' };

type GeneratedMarkdownCardProps = {
    title: string;
    content: string;
    fileName: string;
};

function parseMarkdown(content: string): Block[] {
    const lines = content.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];
    let index = 0;

    function isSpecialLine(line: string) {
        const trimmed = line.trim();
        return (
            trimmed.startsWith('```') ||
            /^#{1,6}\s+/.test(trimmed) ||
            /^[-*]\s+/.test(trimmed) ||
            /^\d+\.\s+/.test(trimmed) ||
            /^>\s?/.test(trimmed) ||
            /^---+$/.test(trimmed)
        );
    }

    while (index < lines.length) {
        const raw = lines[index] ?? '';
        const line = raw.trimEnd();
        const trimmed = line.trim();

        if (!trimmed) {
            index += 1;
            continue;
        }

        if (trimmed.startsWith('```')) {
            const language = trimmed.slice(3).trim();
            const codeLines: string[] = [];
            index += 1;
            while (index < lines.length && !lines[index].trim().startsWith('```')) {
                codeLines.push(lines[index]);
                index += 1;
            }
            if (index < lines.length) index += 1;
            blocks.push({ type: 'code', language, code: codeLines.join('\n') });
            continue;
        }

        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length,
                text: headingMatch[2],
            });
            index += 1;
            continue;
        }

        if (/^---+$/.test(trimmed)) {
            blocks.push({ type: 'divider' });
            index += 1;
            continue;
        }

        if (/^>\s?/.test(trimmed)) {
            const quoteLines: string[] = [];
            while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
                quoteLines.push(lines[index].trim().replace(/^>\s?/, ''));
                index += 1;
            }
            blocks.push({ type: 'blockquote', text: quoteLines.join(' ') });
            continue;
        }

        if (/^[-*]\s+/.test(trimmed)) {
            const items: string[] = [];
            while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^[-*]\s+/, ''));
                index += 1;
            }
            blocks.push({ type: 'unordered-list', items });
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            const items: string[] = [];
            while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
                items.push(lines[index].trim().replace(/^\d+\.\s+/, ''));
                index += 1;
            }
            blocks.push({ type: 'ordered-list', items });
            continue;
        }

        const paragraphLines: string[] = [trimmed];
        index += 1;
        while (index < lines.length) {
            const next = lines[index]?.trim() ?? '';
            if (!next || isSpecialLine(next)) break;
            paragraphLines.push(next);
            index += 1;
        }
        blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    }

    return blocks;
}

function renderInline(text: string) {
    const chunks = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
    return chunks.map((chunk, idx) => {
        if (/^`[^`]+`$/.test(chunk)) {
            return (
                <code key={idx} className="generated-md-inline-code">
                    {chunk.slice(1, -1)}
                </code>
            );
        }
        if (/^\*\*[^*]+\*\*$/.test(chunk)) {
            return <strong key={idx}>{chunk.slice(2, -2)}</strong>;
        }
        return <Fragment key={idx}>{chunk}</Fragment>;
    });
}

export function GeneratedMarkdownCard({ title, content, fileName }: GeneratedMarkdownCardProps) {
    const [viewMode, setViewMode] = useState<'preview' | 'raw'>('preview');
    const [copied, setCopied] = useState(false);
    const blocks = useMemo(() => parseMarkdown(content), [content]);

    async function handleCopy() {
        try {
            await navigator.clipboard.writeText(content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    }

    function handleDownload() {
        const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    function renderBlock(block: Block, idx: number): ReactNode {
        switch (block.type) {
            case 'heading': {
                const Tag = (`h${Math.min(Math.max(block.level, 1), 4)}`) as 'h1' | 'h2' | 'h3' | 'h4';
                return (
                    <Tag key={idx} className={`generated-md-heading level-${block.level}`}>
                        {renderInline(block.text)}
                    </Tag>
                );
            }
            case 'paragraph':
                return (
                    <p key={idx} className="generated-md-paragraph">
                        {renderInline(block.text)}
                    </p>
                );
            case 'unordered-list':
                return (
                    <ul key={idx} className="generated-md-list unordered">
                        {block.items.map((item, itemIdx) => (
                            <li key={itemIdx}>{renderInline(item)}</li>
                        ))}
                    </ul>
                );
            case 'ordered-list':
                return (
                    <ol key={idx} className="generated-md-list ordered">
                        {block.items.map((item, itemIdx) => (
                            <li key={itemIdx}>{renderInline(item)}</li>
                        ))}
                    </ol>
                );
            case 'blockquote':
                return (
                    <blockquote key={idx} className="generated-md-quote">
                        {renderInline(block.text)}
                    </blockquote>
                );
            case 'divider':
                return <hr key={idx} className="generated-md-divider" />;
            case 'code':
                return (
                    <pre key={idx} className="generated-md-code-block">
                        {block.language ? <span className="generated-md-code-lang">{block.language}</span> : null}
                        <code>{block.code}</code>
                    </pre>
                );
            default:
                return null;
        }
    }

    return (
        <div className="glass-card generated-md-card" style={{ animation: 'fadeUp 0.3s ease both' }}>
            <div className="generated-md-toolbar">
                <div>
                    <p className="card-title" style={{ marginBottom: 0 }}>{title}</p>
                    <p className="card-subtitle" style={{ marginTop: '0.2rem' }}>
                        Styled preview and raw markdown export.
                    </p>
                </div>
                <div className="generated-md-toolbar-actions">
                    <button
                        className={`btn ${viewMode === 'preview' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('preview')}
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
                    >
                        Preview
                    </button>
                    <button
                        className={`btn ${viewMode === 'raw' ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={() => setViewMode('raw')}
                        style={{ padding: '0.4rem 0.7rem', fontSize: '0.75rem' }}
                    >
                        Raw
                    </button>
                    <button className="btn btn-ghost" onClick={handleCopy} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button className="btn btn-ghost" onClick={handleDownload} style={{ padding: '0.4rem 0.8rem', fontSize: '0.75rem' }}>
                        Download .md
                    </button>
                </div>
            </div>

            {viewMode === 'preview' ? (
                <article className="generated-md-preview">
                    {blocks.map((block, idx) => renderBlock(block, idx))}
                </article>
            ) : (
                <pre className="generated-md-raw">{content}</pre>
            )}
        </div>
    );
}
