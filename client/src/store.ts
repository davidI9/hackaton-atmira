import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import type { Proyecto, Vista } from '../../shared/domain';
import { confirmarVista, crearProyecto, descartarVista, difundirVistas, editarVista, obtenerProyecto, obtenerProyectos } from './api';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface AppState {
  proyectos: Proyecto[];
  proyectoActual: Proyecto | null;
  vistaActivaId: string | null;
  cargando: boolean;
  error: string | null;
  toasts: ToastItem[];

  pushToast: (type: ToastType, message: string) => void;
  limpiarError: () => void;
  cargarProyectos: () => Promise<void>;
  cargarProyecto: (id: string) => Promise<void>;
  seleccionarVista: (vistaId: string) => void;
  crearNuevoProyecto: (nombre: string, promptInicial: string) => Promise<void>;
  editarVista: (vistaId: string, instruccion: string) => Promise<void>;
  confirmarCambios: (vistaId: string) => Promise<void>;
  descartarCambios: (vistaId: string) => Promise<void>;
  difundirCambios: (vistaOrigenId: string, vistasDestinoIds: string[]) => Promise<void>;
  eliminarToast: (id: number) => void;
}

function reemplazarVista(proyecto: Proyecto | null, vistaActualizada: Vista) {
  if (!proyecto) return proyecto;
  return {
    ...proyecto,
    vistas: proyecto.vistas.map((vista) => (vista.id === vistaActualizada.id ? vistaActualizada : vista))
  };
}

let toastSequence = 1;

const createAppState: StateCreator<AppState> = (set, get) => ({
  proyectos: [],
  proyectoActual: null,
  vistaActivaId: null,
  cargando: false,
  error: null,
  toasts: [],

  pushToast: (type, message) => {
    const id = toastSequence += 1;
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    window.setTimeout(() => {
      get().eliminarToast(id);
    }, 3500);
  },

  eliminarToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),

  limpiarError: () => set({ error: null }),

  cargarProyectos: async () => {
    set({ cargando: true, error: null });
    try {
      const proyectos = await obtenerProyectos();
      set({ proyectos });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar los proyectos';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  cargarProyecto: async (id) => {
    set({ cargando: true, error: null });
    try {
      const proyecto = await obtenerProyecto(id);
      set({ proyectoActual: proyecto, vistaActivaId: proyecto.vistas[0]?.id ?? null });
      get().pushToast('success', `Proyecto "${proyecto.nombre}" cargado`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el proyecto';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  seleccionarVista: (vistaId) => set({ vistaActivaId: vistaId }),

  crearNuevoProyecto: async (nombre, promptInicial) => {
    set({ cargando: true, error: null });
    try {
      const proyecto = await crearProyecto(nombre, promptInicial);
      set((state) => ({
        proyectoActual: proyecto,
        vistaActivaId: proyecto.vistas[0]?.id ?? null,
        proyectos: [proyecto, ...state.proyectos.filter((item) => item.id !== proyecto.id)]
      }));
      get().pushToast('success', 'Proyecto creado correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo crear el proyecto';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  editarVista: async (vistaId, instruccion) => {
    const { proyectoActual } = get();
    if (!proyectoActual) return;
    set({ cargando: true, error: null });
    try {
      const vistaActualizada = await editarVista(proyectoActual.id, vistaId, instruccion);
      set({
        proyectoActual: reemplazarVista(get().proyectoActual, vistaActualizada),
        vistaActivaId: vistaId
      });
      get().pushToast('success', 'Vista actualizada');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo editar la vista';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  confirmarCambios: async (vistaId) => {
    const { proyectoActual } = get();
    if (!proyectoActual) return;
    set({ cargando: true, error: null });
    try {
      const vistaActualizada = await confirmarVista(proyectoActual.id, vistaId);
      set({ proyectoActual: reemplazarVista(get().proyectoActual, vistaActualizada) });
      get().pushToast('success', 'Cambios confirmados');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron confirmar los cambios';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  descartarCambios: async (vistaId) => {
    const { proyectoActual } = get();
    if (!proyectoActual) return;
    set({ cargando: true, error: null });
    try {
      const vistaActualizada = await descartarVista(proyectoActual.id, vistaId);
      set({ proyectoActual: reemplazarVista(get().proyectoActual, vistaActualizada) });
      get().pushToast('info', 'Cambios descartados');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron descartar los cambios';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  },

  difundirCambios: async (vistaOrigenId, vistasDestinoIds) => {
    const { proyectoActual } = get();
    if (!proyectoActual) return;
    set({ cargando: true, error: null });
    try {
      const vistasActualizadas = await difundirVistas(proyectoActual.id, vistaOrigenId, vistasDestinoIds);
      set({
        proyectoActual: {
          ...proyectoActual,
          vistas: proyectoActual.vistas.map((vista) => vistasActualizadas.find((actualizada) => actualizada.id === vista.id) ?? vista)
        }
      });
      get().pushToast('success', 'Difusión completada');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron difundir los cambios';
      set({ error: message });
      get().pushToast('error', message);
    } finally {
      set({ cargando: false });
    }
  }
});

export const useAppStore = create<AppState>()(createAppState);
