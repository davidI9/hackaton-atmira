type AnthropicArgs = {
  prompt: string;
  system: string;
  formato: 'MARKDOWN' | 'MERMAID' | 'TEXTO_PLANO';
};

function fallbackResponse(prompt: string, system: string, formato: AnthropicArgs['formato']) {
  const resumen = prompt.trim().slice(0, 240).replace(/\s+/g, ' ');

  if (formato === 'MARKDOWN') {
    return `# Documento generado\n\n## Resumen\n${resumen}\n\n## Siguientes pasos\n- Refinar requisitos\n- Validar arquitectura\n- Iterar con feedback\n`;
  }

  if (formato === 'MERMAID') {
    return `flowchart TD\n  A[Usuario] --> B[Frontend]\n  B --> C[Backend]\n  C --> D[(PostgreSQL)]\n  C --> E[IA Generativa]\n  E --> C\n  C --> B\n`;
  }

  return `${system}\n\n${resumen}`;
}

async function solicitarAnthropic({ prompt, system, formato }: AnthropicArgs) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (!apiKey) {
    return fallbackResponse(prompt, system, formato);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Anthropic respondió con ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const texto = data.content?.map((bloque) => bloque.text ?? '').join('\n').trim();
  if (!texto) {
    throw new Error('La IA devolvió una respuesta vacía');
  }
  return texto;
}

export async function generarVistaInicial(promptUsuario: string, formato: 'MARKDOWN' | 'MERMAID') {
  return solicitarAnthropic({
    prompt: promptUsuario,
    system: formato === 'MARKDOWN'
      ? 'Genera documentación técnica completa en formato Markdown. Devuelve únicamente el Markdown final.'
      : 'Genera un diagrama Mermaid que represente la arquitectura solicitada. Devuelve únicamente el bloque Mermaid final.',
    formato
  });
}

export async function editarVistaConIA(contenidoActual: string, instruccion: string, formato: 'MARKDOWN' | 'MERMAID' | 'TEXTO_PLANO') {
  return solicitarAnthropic({
    prompt: `${contenidoActual}\n\n---\n\n${instruccion}`,
    system: formato === 'MARKDOWN'
      ? 'Actualiza el contenido en Markdown devolviendo únicamente el documento completo actualizado.'
      : formato === 'MERMAID'
        ? 'Actualiza el diagrama Mermaid devolviendo únicamente el bloque completo actualizado.'
        : 'Actualiza el texto devolviendo únicamente el contenido completo actualizado.',
    formato
  });
}

export async function difundirVistaConIA(contenidoOrigen: string, contenidoDestino: string, tipoOrigen: string, tipoDestino: string) {
  return solicitarAnthropic({
    prompt: `${contenidoOrigen}\n\n---\n\n${contenidoDestino}\n\n---\n\n${tipoOrigen} -> ${tipoDestino}`,
    system: 'Actualiza el contenido de destino para reflejar la coherencia con el contenido de origen. Devuelve únicamente el contenido completo actualizado.',
    formato: 'TEXTO_PLANO'
  });
}
