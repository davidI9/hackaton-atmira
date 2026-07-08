import { GoogleGenerativeAI } from '@google/generative-ai';
import { TipoVista, FormatoContenido } from '@prisma/client';
import dotenv from 'dotenv';
import {
  SYSTEM_PROMPT_DIAGRAMA,
  SYSTEM_PROMPT_DOCUMENTACION,
  SYSTEM_PROMPT_MODELO_DATOS,
  construirPromptDifusion,
  construirPromptEdicion,
  construirPromptModeloDatos
} from './prompts.js';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

function limpiarContenidoSegunFormato(texto: string, formato: FormatoContenido): string {
  if (formato === 'MERMAID') {
    return texto.replace(/```mermaid/g, '').replace(/```/g, '').trim();
  }
  return texto.trim();
}

function systemPromptPorTipo(tipoVista: TipoVista): string {
  if (tipoVista === 'DOCUMENTACION') return SYSTEM_PROMPT_DOCUMENTACION;
  if (tipoVista === 'DIAGRAMA') return SYSTEM_PROMPT_DIAGRAMA;
  if (tipoVista === 'MODELO_DATOS') return SYSTEM_PROMPT_MODELO_DATOS;
  return '';
}

export async function generarVistaInicial(promptUsuario: string, tipoVista: TipoVista, formato: FormatoContenido): Promise<string> {
  const instruccionesSistema = systemPromptPorTipo(tipoVista);
  const promptContenido = tipoVista === 'MODELO_DATOS'
    ? construirPromptModeloDatos(promptUsuario)
    : `Requisito del usuario:\n${promptUsuario}`;
  const prompt = `${instruccionesSistema}\n\n${promptContenido}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return limpiarContenidoSegunFormato(text, formato);
}

export async function generarEdicion(
  contenidoActual: string,
  instruccionUsuario: string,
  formato: FormatoContenido,
  tipoVista: TipoVista
): Promise<string> {
  const prompt = `${systemPromptPorTipo(tipoVista)}\n\n${construirPromptEdicion(contenidoActual, instruccionUsuario, formato)}`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return limpiarContenidoSegunFormato(text, formato);
}

export async function generarDifusion(
  contenidoModificadoOrigen: string,
  contenidoGuardadoDestino: string,
  tipoOrigen: TipoVista,
  tipoDestino: TipoVista,
  formatoDestino: FormatoContenido
): Promise<string> {
  const prompt = `${systemPromptPorTipo(tipoDestino)}\n\n${construirPromptDifusion(
    contenidoModificadoOrigen,
    contenidoGuardadoDestino,
    tipoOrigen,
    tipoDestino
  )}\n\nEl formato de salida debe ser ${formatoDestino}.`;
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  return limpiarContenidoSegunFormato(text, formatoDestino);
}