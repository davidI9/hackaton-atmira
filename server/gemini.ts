import { GoogleGenerativeAI } from '@google/generative-ai';
import { TipoVista, FormatoContenido } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

export async function generarVistaInicial(promptUsuario: string, formato: FormatoContenido): Promise<string> {
  const instrucciones = formato === 'MARKDOWN'
    ? 'Genera documentación técnica completa en formato Markdown que describa la especificación del sistema solicitado. Responde ÚNICAMENTE con el contenido Markdown, sin introducciones ni explicaciones.'
    : 'Genera un diagrama en formato Mermaid que represente la arquitectura del sistema solicitado. Responde ÚNICAMENTE con el bloque de código Mermaid, sin explicaciones ni bloques de comillas Markdown al inicio o al final.';

  const prompt = `${instrucciones}\n\nRequisito del usuario:\n${promptUsuario}`;
  
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  
  // Limpiamos los backticks de markdown que suele meter la IA al generar código
  if (formato === 'MERMAID') {
      return text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  }
  return text.trim();
}

export async function generarEdicion(contenidoActual: string, instruccionUsuario: string, formato: FormatoContenido): Promise<string> {
  const prompt = `Contenido actual (formato ${formato}):\n\n${contenidoActual}\n\n---\n\nInstrucción de cambio solicitada por el usuario:\n${instruccionUsuario}\n\nDevuelve el contenido COMPLETO actualizado en formato ${formato}, aplicando el cambio solicitado. No incluyas explicaciones, solo el contenido resultante sin bloques de comillas extras.`;
  
  const result = await model.generateContent(prompt);
  let text = result.response.text();
  
  if (formato === 'MERMAID') {
      text = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  }
  return text.trim();
}

export async function generarDifusion(contenidoModificadoOrigen: string, contenidoGuardadoDestino: string, tipoOrigen: TipoVista, tipoDestino: TipoVista, formatoDestino: FormatoContenido): Promise<string> {
  const prompt = `Se ha modificado la vista de tipo "${tipoOrigen}" de un proyecto de diseño de software. Este es su contenido actualizado:\n\n${contenidoModificadoOrigen}\n\n---\n\nA continuación se muestra el contenido actual de la vista de tipo "${tipoDestino}", que debe mantenerse coherente con el cambio anterior:\n\n${contenidoGuardadoDestino}\n\n---\n\nActualiza el contenido de la vista "${tipoDestino}" para reflejar los cambios introducidos en la vista "${tipoOrigen}", manteniendo su formato y estructura original. Devuelve ÚNICAMENTE el contenido completo actualizado en formato ${formatoDestino} sin explicaciones extras.`;
  
  const result = await model.generateContent(prompt);
  let text = result.response.text();
  
  if (formatoDestino === 'MERMAID') {
      text = text.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  }
  return text.trim();
}