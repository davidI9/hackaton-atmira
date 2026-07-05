import { useEffect } from 'react';
import { ProjectCreator } from './components/ProjectCreator';
import { ProjectList } from './components/ProjectList';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { ToastStack } from './components/ToastStack';
import { useAppStore } from './store';

export function App() {
  const proyectos = useAppStore((state) => state.proyectos);
  const proyectoActual = useAppStore((state) => state.proyectoActual);
  const cargarProyectos = useAppStore((state) => state.cargarProyectos);
  const cargarProyecto = useAppStore((state) => state.cargarProyecto);
  const error = useAppStore((state) => state.error);

  useEffect(() => {
    void cargarProyectos();
  }, [cargarProyectos]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.24),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-6 text-slate-100 lg:px-8">
      <ToastStack />
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <header className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-soft backdrop-blur">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Asistente de Diseño</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">Genera documentación y diagramas con IA</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Crea un proyecto, edita vistas con instrucciones naturales, confirma o descarta cambios y difúndelos entre artefactos.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void cargarProyectos()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white transition hover:bg-white/10"
            >
              Refrescar
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <ProjectCreator />
        <ProjectList proyectos={proyectos} onOpen={(id) => void cargarProyecto(id)} />
        {proyectoActual ? <ProjectWorkspace /> : null}
      </div>
    </main>
  );
}
