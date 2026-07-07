import { useEffect, useMemo, useState } from 'react';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
  theme: 'base',
  darkMode: true,
  flowchart: {
    useMaxWidth: false,
    htmlLabels: true
  },
  er: {
    useMaxWidth: false
  },
  themeVariables: {
    background: '#020617',
    primaryColor: '#4f46e5',
    primaryTextColor: '#ffffff',
    primaryBorderColor: '#c7d2fe',
    secondaryColor: '#0891b2',
    secondaryTextColor: '#f8fafc',
    secondaryBorderColor: '#a5f3fc',
    tertiaryColor: '#1d4ed8',
    tertiaryTextColor: '#ffffff',
    tertiaryBorderColor: '#bfdbfe',
    lineColor: '#f8fafc',
    textColor: '#ffffff',
    mainBkg: '#312e81',
    nodeBkg: '#312e81',
    clusterBkg: '#0b1220',
    clusterBorder: '#e2e8f0'
  }
});

function sanitizarMermaid(contenido: string): string {
  // Evita patrones que suelen romper el parser en etiquetas de nodos.
  const conSaltosNormalizados = contenido.replace(/\\n/g, '<br/>');
  return conSaltosNormalizados.replace(
    /([A-Za-z0-9_]+)\[([^\]\n"]*[()][^\]\n"]*)\]/g,
    (_match, nodeId: string, label: string) => `${nodeId}["${label}"]`
  );
}

interface Props {
  contenido: string;
}

function normalizarSvg(svg: string): string {
  return svg.replace('<svg ', '<svg style="display:block; width:100%; height:auto; max-width:none;" ');
}

export function MermaidViewer({ contenido }: Props) {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const id = useMemo(() => `mermaid-${crypto.randomUUID()}`, []);

  useEffect(() => {
    let activo = true;
    setZoom(1);

    async function renderizar() {
      if (!contenido.trim()) {
        setSvg('');
        setError(null);
        return;
      }

      try {
        const resultado = await mermaid.render(id, contenido);
        if (activo) {
          setSvg(normalizarSvg(resultado.svg));
          setError(null);
        }
      } catch (renderError) {
        try {
          const contenidoSanitizado = sanitizarMermaid(contenido);
          const resultadoReintento = await mermaid.render(`${id}-sanitizado`, contenidoSanitizado);
          if (activo) {
            setSvg(normalizarSvg(resultadoReintento.svg));
            setError(null);
          }
        } catch (reintentoError) {
          if (activo) {
            setSvg('');
            setError(reintentoError instanceof Error ? reintentoError.message : (renderError instanceof Error ? renderError.message : 'No se pudo renderizar el diagrama'));
          }
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

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-xs text-slate-300">
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.max(0.5, Number((prev - 0.1).toFixed(2))))}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          >
            -
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          >
            100%
          </button>
          <button
            type="button"
            onClick={() => setZoom((prev) => Math.min(2.5, Number((prev + 0.1).toFixed(2))))}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 hover:bg-white/10"
          >
            +
          </button>
        </div>
      </div>
      <div className="overflow-auto p-4">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%`, minWidth: '960px' }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
