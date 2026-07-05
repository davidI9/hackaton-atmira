export function construirPromptEdicion(contenidoActual: string, instruccionUsuario: string, formato: string) {
  return `Contenido actual (formato ${formato}):\n\n${contenidoActual}\n\n---\n\nInstrucción de cambio solicitada por el usuario:\n${instruccionUsuario}\n\nDevuelve el contenido COMPLETO actualizado en formato ${formato}, aplicando el cambio solicitado. No incluyas explicaciones, solo el contenido resultante.`;
}

export function construirPromptDifusion(
  contenidoModificadoOrigen: string,
  contenidoGuardadoDestino: string,
  tipoOrigen: string,
  tipoDestino: string,
) {
  return `Se ha modificado la vista de tipo "${tipoOrigen}" de un proyecto de diseño de software. Este es su contenido actualizado:\n\n${contenidoModificadoOrigen}\n\n---\n\nA continuación se muestra el contenido actual de la vista de tipo "${tipoDestino}", que debe mantenerse coherente con el cambio anterior:\n\n${contenidoGuardadoDestino}\n\n---\n\nActualiza el contenido de la vista "${tipoDestino}" para reflejar los cambios introducidos en la vista "${tipoOrigen}", manteniendo su formato y estructura original. Devuelve ÚNICAMENTE el contenido completo actualizado.`;
}

export function instruccionesIniciales(formato: 'MARKDOWN' | 'MERMAID') {
  return formato === 'MARKDOWN'
    ? 'Genera documentación técnica completa en formato Markdown que describa la especificación del sistema solicitado. Responde ÚNICAMENTE con el contenido Markdown, sin explicaciones adicionales.'
    : 'Genera un diagrama en formato Mermaid que represente la arquitectura del sistema solicitado. Responde ÚNICAMENTE con el bloque de código Mermaid, sin explicaciones adicionales.';
}
