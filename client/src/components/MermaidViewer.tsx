import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'dark'
});

interface Props {
  contenido: string;
}

export function MermaidViewer({ contenido }: Props) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const id = useMemo(() => `mermaid-${crypto.randomUUID()}`, []);

  useEffect(() => {
    let activo = true;

    async function renderizar() {
      if (!contenido.trim()) {
        setSvg('');
        setError(null);
        return;
      }

      try {
        const resultado = await mermaid.render(id, contenido);
        if (activo) {
          setSvg(resultado.svg);
          setError(null);
        }
      } catch (renderError) {
        if (activo) {
          setSvg('');
          setError(renderError instanceof Error ? renderError.message : 'No se pudo renderizar el diagrama');
        }
      }
    }

    void renderizar();

    return () => {
      activo = false;
    };
  }, [contenido, id]);

  if (error) {
    return <pre className="whitespace-pre-wrap rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">{error}</pre>;
  }

  if (!svg) {
    return <div className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 text-sm text-slate-400">Sin diagrama todavía.</div>;
  }

  return <div className="overflow-auto rounded-2xl border border-white/10 bg-slate-950/80 p-4" dangerouslySetInnerHTML={{ __html: svg }} />;
}
