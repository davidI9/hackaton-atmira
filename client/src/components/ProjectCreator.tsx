import { useState, type FormEvent } from 'react';
import { useAppStore } from '../store';

export function ProjectCreator() {
  const crearNuevoProyecto = useAppStore((state) => state.crearNuevoProyecto);
  const cargando = useAppStore((state) => state.cargando);
  const [nombre, setNombre] = useState('');
  const [promptInicial, setPromptInicial] = useState('');

  const enviar = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await crearNuevoProyecto(nombre, promptInicial);
    setNombre('');
    setPromptInicial('');
  };

  return (
    <form onSubmit={enviar} className="space-y-4 rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-soft">
      <div>
        <h2 className="text-xl font-semibold text-white">Crear proyecto</h2>
        <p className="mt-1 text-sm text-slate-400">Genera documentación y diagrama inicial con IA.</p>
      </div>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>Nombre</span>
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          placeholder="Ej. Plataforma de gestión"
          required
        />
      </label>
      <label className="block space-y-2 text-sm text-slate-200">
        <span>Prompt inicial</span>
        <textarea
          value={promptInicial}
          onChange={(event) => setPromptInicial(event.target.value)}
          className="min-h-32 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-violet-400"
          placeholder="Describe el sistema que quieres diseñar..."
          required
        />
      </label>
      <button
        type="submit"
        disabled={cargando}
        className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {cargando ? 'Generando...' : 'Crear y generar'}
      </button>
    </form>
  );
}
