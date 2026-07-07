import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prisma from './db.js';
import { generarVistaInicial, generarEdicion, generarDifusion } from './gemini.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistPath = path.resolve(__dirname, '../client');

const PORT = process.env.PORT || 3000;

interface ModeloDatosPayload {
  diagramaMermaid: string;
  scriptSQL: string;
  esquemaJSON: string;
}

// 1. Obtener todos los proyectos
app.get('/api/proyectos', async (req, res) => {
  try {
    const proyectos = await prisma.proyecto.findMany({
      include: { vistas: true },
      orderBy: { actualizadoEn: 'desc' }
    });
    res.json({ ok: true, data: proyectos });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener proyectos' });
  }
});

// 1b. Obtener un proyecto concreto
app.get('/api/proyectos/:proyectoId', async (req, res) => {
  try {
    const proyecto = await prisma.proyecto.findUnique({
      where: { id: req.params.proyectoId },
      include: { vistas: true }
    });

    if (!proyecto) {
      return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });
    }

    res.json({ ok: true, data: proyecto });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al obtener el proyecto' });
  }
});

// 2. Crear proyecto e inicializar vistas con IA
app.post('/api/proyectos', async (req, res) => {
  const { nombre, promptInicial } = req.body;
  if (!nombre || !promptInicial) return res.status(400).json({ ok: false, error: 'Faltan datos' });

  try {
    console.log(`[BACKEND] Solicitando a Gemini para el proyecto: ${nombre}`);
    
    const [docContent, diagContent, modeloDatosRaw] = await Promise.all([
      generarVistaInicial(promptInicial, 'DOCUMENTACION', 'MARKDOWN'),
      generarVistaInicial(promptInicial, 'DIAGRAMA', 'MERMAID'),
      generarVistaInicial(promptInicial, 'MODELO_DATOS', 'JSON_COMPUESTO')
    ]);

    let modeloDatos: ModeloDatosPayload;
    try {
      const parsed = JSON.parse(modeloDatosRaw) as Partial<ModeloDatosPayload>;
      modeloDatos = {
        diagramaMermaid: parsed.diagramaMermaid ?? '',
        scriptSQL: parsed.scriptSQL ?? '',
        esquemaJSON: parsed.esquemaJSON ?? ''
      };
    } catch (parseError) {
      console.error('[ERROR MODELO_DATOS PARSE]:', parseError);
      return res.status(500).json({ ok: false, error: 'La IA devolvio un modelo de datos invalido' });
    }
    
    console.log(`[BACKEND] ¡Gemini contestó con éxito! Guardando en BD...`);

    const proyecto = await prisma.proyecto.create({
      data: {
        nombre,
        promptInicial,
        vistas: {
          create: [
            {
              tipo: 'DOCUMENTACION',
              nombre: 'Especificación Técnica',
              formato: 'MARKDOWN',
              contenidoGuardado: docContent,
              contenidoModificado: docContent
            },
            {
              tipo: 'DIAGRAMA',
              nombre: 'Arquitectura del Sistema',
              formato: 'MERMAID',
              contenidoGuardado: diagContent,
              contenidoModificado: diagContent
            },
            {
              tipo: 'MODELO_DATOS',
              nombre: 'Modelo de Datos',
              formato: 'JSON_COMPUESTO',
              contenidoGuardado: JSON.stringify(modeloDatos),
              contenidoModificado: JSON.stringify(modeloDatos)
            }
          ]
        }
      },
      include: { vistas: true }
    });

    res.json({ ok: true, data: proyecto });
  } catch (error) {
    console.error("[ERROR GEMINI/BD]:", error); 
    res.status(500).json({ ok: false, error: 'Fallo al contactar con la IA o guardar en BD' });
  }
});

// 3. Solicitar edición de una vista
app.post('/api/proyectos/:proyectoId/vistas/:vistaId/editar', async (req, res) => {
  const { instruccion } = req.body;
  const { vistaId } = req.params;

  try {
    const vistaActual = await prisma.vista.findUnique({ where: { id: vistaId } });
    if (!vistaActual) return res.status(404).json({ ok: false, error: 'Vista no encontrada' });

    const nuevoContenido = await generarEdicion(vistaActual.contenidoModificado, instruccion, vistaActual.formato, vistaActual.tipo);

    const vistaActualizada = await prisma.vista.update({
      where: { id: vistaId },
      data: {
        contenidoModificado: nuevoContenido,
        tieneCambiosSinConfirmar: true
      }
    });

    res.json({ ok: true, data: vistaActualizada });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error en la edición con IA' });
  }
});

// 4. Confirmar y Descartar cambios
app.post('/api/proyectos/:proyectoId/vistas/:vistaId/confirmar', async (req, res) => {
  try {
    const vista = await prisma.vista.findUnique({ where: { id: req.params.vistaId } });
    const vistaActualizada = await prisma.vista.update({
      where: { id: req.params.vistaId },
      data: { contenidoGuardado: vista?.contenidoModificado, tieneCambiosSinConfirmar: false }
    });
    res.json({ ok: true, data: vistaActualizada });
  } catch (error) { res.status(500).json({ ok: false, error: 'Error al confirmar' }); }
});

app.post('/api/proyectos/:proyectoId/vistas/:vistaId/descartar', async (req, res) => {
  try {
    const vista = await prisma.vista.findUnique({ where: { id: req.params.vistaId } });
    const vistaActualizada = await prisma.vista.update({
      where: { id: req.params.vistaId },
      data: { contenidoModificado: vista?.contenidoGuardado, tieneCambiosSinConfirmar: false }
    });
    res.json({ ok: true, data: vistaActualizada });
  } catch (error) { res.status(500).json({ ok: false, error: 'Error al descartar' }); }
});

// 5. Difundir cambios a otras vistas
app.post('/api/proyectos/:proyectoId/vistas/:vistaId/difundir', async (req, res) => {
  const { vistasDestinoIds } = req.body;
  const { vistaId } = req.params;

  try {
    const vistaOrigen = await prisma.vista.findUnique({ where: { id: vistaId } });
    if (!vistaOrigen) return res.status(404).json({ ok: false, error: 'Vista origen no encontrada' });

    const vistasActualizadas = await Promise.all(
      vistasDestinoIds.map(async (destinoId: string) => {
        const vistaDestino = await prisma.vista.findUnique({ where: { id: destinoId } });
        if (!vistaDestino) return null;

        const nuevoContenido = await generarDifusion(
          vistaOrigen.contenidoModificado,
          vistaDestino.contenidoGuardado,
          vistaOrigen.tipo,
          vistaDestino.tipo,
          vistaDestino.formato
        );

        return prisma.vista.update({
          where: { id: destinoId },
          data: { contenidoModificado: nuevoContenido, tieneCambiosSinConfirmar: true }
        });
      })
    );

    res.json({ ok: true, data: vistasActualizadas.filter(v => v !== null) });
  } catch (error) {
    res.status(500).json({ ok: false, error: 'Error al difundir cambios' });
  }
});

app.use(express.static(clientDistPath));

app.get(/^(?!\/api\/).*/, (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(clientDistPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
});