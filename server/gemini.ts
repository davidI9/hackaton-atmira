type GeminiArgs = {
  prompt: string;
  system: string;
  formato: 'MARKDOWN' | 'MERMAID' | 'TEXTO_PLANO';
};

function fallbackResponse(prompt: string, system: string, formato: GeminiArgs['formato']) {
  const resumen = prompt.trim().slice(0, 240).replace(/\s+/g, ' ');

  if (formato === 'MARKDOWN') {
    return `# Documento generado\n\n## Resumen\n${resumen}\n\n## Siguientes pasos\n- Refinar requisitos\n- Validar arquitectura\n- Iterar con feedback\n`;
  }

  if (formato === 'MERMAID') {
    return `flowchart TD\n  A[Usuario] --> B[Frontend]\n  B --> C[Backend]\n  C --> D[(PostgreSQL)]\n  C --> E[IA Generativa]\n  E --> C\n  C --> B\n`;
  }

  return `${system}\n\n${resumen}`;
}

async function solicitarGemini({ prompt, system, formato }: GeminiArgs) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();

  if (!apiKey) {
    return fallbackResponse(prompt, system, formato);
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 4096
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini respondió con ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  const texto = data.candidates?.[0]?.content?.parts?.map((bloque) => bloque.text ?? '').join('\n').trim();
  if (!texto) {
    throw new Error('La IA devolvió una respuesta vacía');
  }
  return texto;
}

export async function generarVistaInicial(promptUsuario: string, formato: 'MARKDOWN' | 'MERMAID') {
  return solicitarGemini({
    prompt: promptUsuario,
    system: formato === 'MARKDOWN'
      ? 'Genera documentación técnica completa en formato Markdown. Devuelve únicamente el Markdown final.'
      : 'Genera un diagrama Mermaid que represente la arquitectura solicitada. Devuelve únicamente el bloque Mermaid final.',
    formato
  });
}

export async function editarVistaConIA(contenidoActual: string, instruccion: string, formato: 'MARKDOWN' | 'MERMAID' | 'TEXTO_PLANO') {
  return solicitarGemini({
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
  return solicitarGemini({
    prompt: `${contenidoOrigen}\n\n---\n\n${contenidoDestino}\n\n---\n\n${tipoOrigen} -> ${tipoDestino}`,
    system: 'Actualiza el contenido de destino para reflejar la coherencia con el contenido de origen. Devuelve únicamente el contenido completo actualizado.',
    formato: 'TEXTO_PLANO'
  });
}