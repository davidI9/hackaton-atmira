import type { Proyecto } from '../../../shared/domain';

interface Props {
  proyectos: Proyecto[];
  onOpen: (id: string) => void;
}

export function ProjectList({ proyectos, onOpen }: Props) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-soft">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">Proyectos</h2>
          <p className="mt-1 text-sm text-slate-400">Abre un proyecto para editar sus vistas.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {proyectos.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
            Aún no hay proyectos creados.
          </div>
        ) : (
          proyectos.map((proyecto) => (
            <article key={proyecto.id} className="rounded-2xl border border-white/10 bg-slate-950/80 p-5">
              <h3 className="text-lg font-semibold text-white">{proyecto.nombre}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-slate-400">{proyecto.promptInicial}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                <span>{proyecto.vistas.length} vistas</span>
                <button
                  type="button"
                  onClick={() => onOpen(proyecto.id)}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/15"
                >
                  Abrir
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
