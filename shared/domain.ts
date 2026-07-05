export type TipoVista = 'DOCUMENTACION' | 'DIAGRAMA' | 'OTRO';
export type FormatoContenido = 'MARKDOWN' | 'MERMAID' | 'TEXTO_PLANO';

export interface Vista {
  id: string;
  proyectoId: string;
  tipo: TipoVista;
  nombre: string;
  formato: FormatoContenido;
  contenidoGuardado: string;
  contenidoModificado: string;
  tieneCambiosSinConfirmar: boolean;
  actualizadoEn: string;
}

export interface Proyecto {
  id: string;
  nombre: string;
  promptInicial: string;
  vistas: Vista[];
  creadoEn: string;
  actualizadoEn: string;
}

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
