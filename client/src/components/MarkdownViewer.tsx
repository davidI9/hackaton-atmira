import type { ReactNode } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';

interface Props {
  contenido: string;
}

function flattenToText(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(flattenToText).join('');
  }

  if (node && typeof node === 'object' && 'props' in node) {
    return flattenToText(node.props.children);
  }

  return '';
}

function looksLikeTableBlock(text: string): boolean {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) return false;

  return lines.some((line) => /^\|?\s*:?-{3,}/.test(line) && line.includes('|')) && lines.every((line) => line.includes('|'));
}

function parsePipeTable(text: string) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const filteredLines = lines.filter((line) => !/^\|?\s*:?-{3,}/.test(line));
  const rows = filteredLines.map((line) =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim())
  );

  const header = rows[0] ?? [];
  const body = rows.slice(1);

  return { header, body };
}

function TableFromMarkdown({ text }: { text: string }) {
  const { header, body } = parsePipeTable(text);

  if (!header.length) {
    return <p className="mb-4 text-base leading-7 text-slate-200">{text}</p>;
  }

  return (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full border-collapse bg-slate-950 text-left text-sm text-slate-200">
        <thead>
          <tr>
            {header.map((cell, index) => (
              <th key={`${cell}-${index}`} className="border-b border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className="odd:bg-slate-900/40 hover:bg-violet-500/10">
              {row.map((cell, cellIndex) => (
                <td key={`${rowIndex}-${cellIndex}`} className="border-b border-white/5 px-4 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-8 border-b border-violet-400/30 pb-3 text-3xl font-bold tracking-tight text-white first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mb-3 mt-7 text-2xl font-semibold tracking-tight text-white first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-xl font-semibold text-violet-200 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="mb-2 mt-5 text-lg font-semibold text-slate-100 first:mt-0">
      {children}
    </h4>
  ),
  p: ({ children }) => {
    const text = flattenToText(children).trim();

    if (looksLikeTableBlock(text)) {
      return <TableFromMarkdown text={text} />;
    }

    return (
      <p className="mb-4 text-base leading-7 text-slate-200">
        {children}
      </p>
    );
  },
  ul: ({ children }) => (
    <ul className="mb-4 list-disc space-y-2 pl-6 text-slate-200">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-6 text-slate-200">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="pl-1 leading-7 text-slate-200">
      {children}
    </li>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-4 border-l-4 border-violet-400/60 bg-violet-500/10 px-4 py-3 text-slate-100">
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-violet-300 underline decoration-violet-400/60 underline-offset-4 transition hover:text-violet-200"
    >
      {children}
    </a>
  ),
  code: ({ children, className }) => {
    const isInline = !className;

    if (isInline) {
      return (
        <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-sm text-violet-200">
          {children}
        </code>
      );
    }

    return (
      <code className="block overflow-x-auto rounded-2xl bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-4 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100">
      {children}
    </pre>
  ),
  hr: () => <hr className="my-6 border-white/10" />,
  table: ({ children }) => (
    <div className="mb-4 overflow-x-auto rounded-2xl border border-white/10">
      <table className="min-w-full border-collapse bg-slate-950 text-left text-sm text-slate-200">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-white/5 px-4 py-3 align-top">
      {children}
    </td>
  )
};

export function MarkdownViewer({ contenido }: Props) {
  return (
    <article className="markdown-content max-w-none">
      <ReactMarkdown components={markdownComponents}>
        {contenido || 'Sin contenido todavía.'}
      </ReactMarkdown>
    </article>
  );
}
