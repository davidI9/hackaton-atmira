import { useState } from 'react';
import { MermaidViewer } from './MermaidViewer';

type SubPestanaModeloDatos = 'diagrama' | 'script';

interface DataModelViewerProps {
  diagramaMermaid: string;
  scriptSQL: string;
  esquemaJSON: string;
}

export function DataModelViewer({ diagramaMermaid, scriptSQL, esquemaJSON }: DataModelViewerProps) {
  const [pestanaActiva, setPestanaActiva] = useState<SubPestanaModeloDatos>('diagrama');
  const [formatoScript, setFormatoScript] = useState<'sql' | 'json'>('sql');

  const contenidoScript = formatoScript === 'json' ? esquemaJSON : scriptSQL;

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPestanaActiva('diagrama')}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              pestanaActiva === 'diagrama' ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Diagrama ER
          </button>
          <button
            type="button"
            onClick={() => setPestanaActiva('script')}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              pestanaActiva === 'script' ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'
            }`}
          >
            Script
          </button>
        </div>

        {pestanaActiva === 'script' ? (
          <div className="inline-flex rounded-xl border border-white/10 bg-slate-950 p-1 text-sm">
            <button
              type="button"
              onClick={() => setFormatoScript('sql')}
              className={`rounded-lg px-3 py-1 ${formatoScript === 'sql' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}
            >
              SQL
            </button>
            <button
              type="button"
              onClick={() => setFormatoScript('json')}
              className={`rounded-lg px-3 py-1 ${formatoScript === 'json' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}
            >
              JSON
            </button>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        {pestanaActiva === 'diagrama' ? (
          <MermaidViewer contenido={diagramaMermaid} />
        ) : (
          <pre className="h-full overflow-auto rounded-2xl border border-white/10 bg-slate-950 p-4 text-sm text-slate-100">
            <code>{contenidoScript || 'Sin contenido todavia.'}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
