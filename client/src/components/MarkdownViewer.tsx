import ReactMarkdown from 'react-markdown';

interface Props {
  contenido: string;
}

export function MarkdownViewer({ contenido }: Props) {
  return (
    <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-li:text-slate-200">
      <ReactMarkdown>{contenido || 'Sin contenido todavía.'}</ReactMarkdown>
    </article>
  );
}
