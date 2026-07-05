import { useMemo, useState } from 'react';
import type { Vista } from '../../../shared/domain';
import { useAppStore } from '../store';
import { MarkdownViewer } from './MarkdownViewer';
import { MermaidViewer } from './MermaidViewer';

export function ProjectWorkspace() {
  const proyecto = useAppStore((state) => state.proyectoActual);
  const vistaActivaId = useAppStore((state) => state.vistaActivaId);
  const cargando = useAppStore((state) => state.cargando);
  const seleccionarVista = useAppStore((state) => state.seleccionarVista);
  const editar = useAppStore((state) => state.editarVista);
  const confirmar = useAppStore((state) => state.confirmarCambios);
  const descartar = useAppStore((state) => state.descartarCambios);
  const difundir = useAppStore((state) => state.difundirCambios);

  const [instruccion, setInstruccion] = useState('');
  const [mostrarDifusion, setMostrarDifusion] = useState(false);
  const [destinosSeleccionados, setDestinosSeleccionados] = useState<string[]>([]);

  const vistaActiva = useMemo(() => proyecto?.vistas.find((vista) => vista.id === vistaActivaId) ?? null, [proyecto, vistaActivaId]);

  if (!proyecto || !vistaActiva) {
    return (
      <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 text-slate-300 shadow-soft">
        Selecciona un proyecto para comenzar.
      </section>
    );
  }

  const otrasVistas = proyecto.vistas.filter((vista) => vista.id !== vistaActiva.id);

  const enviarEdicion = async () => {
    if (!instruccion.trim()) return;
    await editar(vistaActiva.id, instruccion);
    setInstruccion('');
  };

  const enviarDifusion = async () => {
    await difundir(vistaActiva.id, destinosSeleccionados);
    setMostrarDifusion(false);
    setDestinosSeleccionados([]);
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-soft">
        <h3 className="px-2 text-sm font-semibold uppercase tracking-[0.25em] text-slate-400">Vistas</h3>
        <div className="mt-3 hidden lg:flex lg:flex-col lg:gap-2">
          {proyecto.vistas.map((vista) => (
            <button
              key={vista.id}
              type="button"
              onClick={() => seleccionarVista(vista.id)}
              className={`rounded-2xl px-3 py-3 text-left transition ${vista.id === vistaActiva.id ? 'bg-violet-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{vista.nombre}</span>
                {vista.tieneCambiosSinConfirmar ? <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-200">Pendiente</span> : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">{vista.formato}</p>
            </button>
          ))}
        </div>
        <label className="mt-3 block lg:hidden">
          <span className="sr-only">Vista activa</span>
          <select
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-white"
            value={vistaActiva.id}
            onChange={(event) => seleccionarVista(event.target.value)}
          >
            {proyecto.vistas.map((vista) => (
              <option key={vista.id} value={vista.id}>{vista.nombre}</option>
            ))}
          </select>
        </label>
      </aside>

      <div className="space-y-4">
        <header className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm text-slate-400">Proyecto</p>
              <h2 className="text-2xl font-semibold text-white">{proyecto.nombre}</h2>
              <p className="mt-2 text-sm text-slate-400">{vistaActiva.nombre} · {vistaActiva.formato}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-sm ${vistaActiva.tieneCambiosSinConfirmar ? 'bg-amber-500/15 text-amber-200' : 'bg-emerald-500/15 text-emerald-200'}`}>
              {vistaActiva.tieneCambiosSinConfirmar ? 'Cambios sin confirmar' : 'Sin cambios pendientes'}
            </span>
          </div>
        </header>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-white">Contenido modificado</h3>
            {cargando ? <span className="text-sm text-slate-400">Procesando...</span> : null}
          </div>
          <div className="mt-4 min-h-[280px] rounded-3xl border border-white/10 bg-slate-950/80 p-5">
            {vistaActiva.formato === 'MARKDOWN' ? <MarkdownViewer contenido={vistaActiva.contenidoModificado} /> : <MermaidViewer contenido={vistaActiva.contenidoModificado} />}
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-soft">
          <label className="block space-y-2 text-sm text-slate-200">
            <span>Instrucción de cambio</span>
            <textarea
              value={instruccion}
              onChange={(event) => setInstruccion(event.target.value)}
              className="min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
              placeholder="Describe el ajuste que quieres pedir a la IA..."
              disabled={cargando}
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={enviarEdicion}
              disabled={cargando || !instruccion.trim()}
              className="rounded-2xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Enviar cambio
            </button>
            <button
              type="button"
              onClick={() => confirmar(vistaActiva.id)}
              disabled={cargando || !vistaActiva.tieneCambiosSinConfirmar}
              className="rounded-2xl bg-emerald-600 px-5 py-3 font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => descartar(vistaActiva.id)}
              disabled={cargando || !vistaActiva.tieneCambiosSinConfirmar}
              className="rounded-2xl bg-slate-700 px-5 py-3 font-medium text-white transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Descartar
            </button>
            <button
              type="button"
              onClick={() => {
                setMostrarDifusion(true);
                setDestinosSeleccionados([]);
              }}
              disabled={cargando || otrasVistas.length === 0}
              className="rounded-2xl bg-amber-600 px-5 py-3 font-medium text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Difundir cambios
            </button>
          </div>
        </section>
      </div>

      {mostrarDifusion ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-xl font-semibold text-white">Difundir cambios</h3>
              <button type="button" onClick={() => setMostrarDifusion(false)} className="text-slate-400 hover:text-white">Cerrar</button>
            </div>
            <p className="mt-2 text-sm text-slate-400">Selecciona las vistas destino distintas a la vista activa.</p>
            <div className="mt-4 grid gap-3">
              {otrasVistas.map((vista) => (
                <label key={vista.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={destinosSeleccionados.includes(vista.id)}
                    onChange={(event) => {
                      setDestinosSeleccionados((actual) => event.target.checked
                        ? [...actual, vista.id]
                        : actual.filter((id) => id !== vista.id));
                    }}
                  />
                  <span>{vista.nombre}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setMostrarDifusion(false)} className="rounded-2xl bg-slate-700 px-5 py-3 text-white">Cancelar</button>
              <button type="button" onClick={enviarDifusion} disabled={cargando || destinosSeleccionados.length === 0} className="rounded-2xl bg-amber-600 px-5 py-3 text-white disabled:opacity-60">
                Difundir
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
