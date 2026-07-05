import type { ApiResponse, Proyecto, Vista } from '../../shared/domain';

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {})
    },
    ...init
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    throw new Error(payload.error ?? 'Solicitud fallida');
  }
  return payload.data;
}

export function obtenerProyectos() {
  return request<Proyecto[]>('/api/proyectos');
}

export function crearProyecto(nombre: string, promptInicial: string) {
  return request<Proyecto>('/api/proyectos', {
    method: 'POST',
    body: JSON.stringify({ nombre, promptInicial })
  });
}

export function obtenerProyecto(proyectoId: string) {
  return request<Proyecto>(`/api/proyectos/${proyectoId}`);
}

export function editarVista(proyectoId: string, vistaId: string, instruccion: string) {
  return request<Vista>(`/api/proyectos/${proyectoId}/vistas/${vistaId}/editar`, {
    method: 'POST',
    body: JSON.stringify({ instruccion })
  });
}

export function confirmarVista(proyectoId: string, vistaId: string) {
  return request<Vista>(`/api/proyectos/${proyectoId}/vistas/${vistaId}/confirmar`, {
    method: 'POST'
  });
}

export function descartarVista(proyectoId: string, vistaId: string) {
  return request<Vista>(`/api/proyectos/${proyectoId}/vistas/${vistaId}/descartar`, {
    method: 'POST'
  });
}

export function difundirVistas(proyectoId: string, vistaOrigenId: string, vistasDestinoIds: string[]) {
  return request<Vista[]>(`/api/proyectos/${proyectoId}/vistas/${vistaOrigenId}/difundir`, {
    method: 'POST',
    body: JSON.stringify({ vistasDestinoIds })
  });
}
