import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prisma } from './db.js';
import { construirPromptDifusion, construirPromptEdicion } from './prompts.js';
import { editarVistaConIA, generarVistaInicial, difundirVistaConIA } from './anthropic.js';
import type { FormatoContenido, Proyecto, TipoVista, Vista, ApiResponse } from '../shared/domain.js';
import type { Prisma, Proyecto as ProyectoPrisma, Vista as VistaPrisma } from '@prisma/client';
import type { Request, Response } from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

function responder<T>(res: express.Response, payload: ApiResponse<T>, status = 200) {
  return res.status(status).json(payload);
}

function vistaADominio(vista: Pick<VistaPrisma, 'id' | 'proyectoId' | 'tipo' | 'nombre' | 'formato' | 'contenidoGuardado' | 'contenidoModificado' | 'tieneCambiosSinConfirmar' | 'actualizadoEn'>): Vista {
  return {
    ...vista,
    actualizadoEn: vista.actualizadoEn.toISOString()
  };
}

function proyectoADominio(proyecto: Pick<ProyectoPrisma, 'id' | 'nombre' | 'promptInicial' | 'creadoEn' | 'actualizadoEn'> & { vistas: Vista[] }): Proyecto {
  return {
    ...proyecto,
    creadoEn: proyecto.creadoEn.toISOString(),
    actualizadoEn: proyecto.actualizadoEn.toISOString()
  };
}

async function obtenerProyectoCompleto(proyectoId: string) {
  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    include: { vistas: true }
  });

  if (!proyecto) return null;

  return proyectoADominio({
    ...proyecto,
    vistas: proyecto.vistas.map(vistaADominio)
  });
}

async function validarVistaDeProyecto(proyectoId: string, vistaId: string) {
  const vista = await prisma.vista.findFirst({
    where: { id: vistaId, proyectoId }
  });

  return vista;
}

app.get('/api/proyectos', async (_req: Request, res: Response) => {
  const proyectos = await prisma.proyecto.findMany({
    orderBy: { actualizadoEn: 'desc' },
    include: { vistas: true }
  });

  responder(res, {
    ok: true,
    data: proyectos.map((proyecto: ProyectoPrisma & { vistas: VistaPrisma[] }) => proyectoADominio({
      ...proyecto,
      vistas: proyecto.vistas.map(vistaADominio)
    }))
  });
});

app.post('/api/proyectos', async (req: Request, res: Response) => {
  const { nombre, promptInicial } = req.body as { nombre?: string; promptInicial?: string };

  if (!nombre?.trim() || !promptInicial?.trim()) {
    return responder(res, { ok: false, error: 'Nombre y prompt inicial son obligatorios' }, 400);
  }

  try {
    const proyecto = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const creado = await tx.proyecto.create({
        data: {
          nombre: nombre.trim(),
          promptInicial: promptInicial.trim()
        }
      });

      const documentacion = await tx.vista.create({
        data: {
          proyectoId: creado.id,
          tipo: 'DOCUMENTACION',
          nombre: 'Documentación',
          formato: 'MARKDOWN',
          contenidoGuardado: '',
          contenidoModificado: '',
          tieneCambiosSinConfirmar: false
        }
      });

      const diagrama = await tx.vista.create({
        data: {
          proyectoId: creado.id,
          tipo: 'DIAGRAMA',
          nombre: 'Diagrama',
          formato: 'MERMAID',
          contenidoGuardado: '',
          contenidoModificado: '',
          tieneCambiosSinConfirmar: false
        }
      });

      const [contenidoDocumentacion, contenidoDiagrama] = await Promise.all([
        generarVistaInicial(promptInicial.trim(), 'MARKDOWN'),
        generarVistaInicial(promptInicial.trim(), 'MERMAID')
      ]);

      await tx.vista.update({
        where: { id: documentacion.id },
        data: {
          contenidoGuardado: contenidoDocumentacion,
          contenidoModificado: contenidoDocumentacion,
          tieneCambiosSinConfirmar: false
        }
      });

      await tx.vista.update({
        where: { id: diagrama.id },
        data: {
          contenidoGuardado: contenidoDiagrama,
          contenidoModificado: contenidoDiagrama,
          tieneCambiosSinConfirmar: false
        }
      });

      return tx.proyecto.findUniqueOrThrow({
        where: { id: creado.id },
        include: { vistas: true }
      });
    });

    return responder(res, {
      ok: true,
      data: proyectoADominio({
        ...proyecto,
        vistas: proyecto.vistas.map(vistaADominio)
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo crear el proyecto';
    return responder(res, { ok: false, error: message }, 500);
  }
});

app.get('/api/proyectos/:proyectoId', async (req: Request, res: Response) => {
  const { proyectoId } = req.params as { proyectoId: string };
  const proyecto = await obtenerProyectoCompleto(proyectoId);
  if (!proyecto) {
    return responder(res, { ok: false, error: 'Proyecto no encontrado' }, 404);
  }
  return responder(res, { ok: true, data: proyecto });
});

app.post('/api/proyectos/:proyectoId/vistas/:vistaId/editar', async (req: Request, res: Response) => {
  const { proyectoId, vistaId } = req.params as { proyectoId: string; vistaId: string };
  const { instruccion } = req.body as { instruccion?: string };

  if (!instruccion?.trim()) {
    return responder(res, { ok: false, error: 'La instrucción no puede estar vacía' }, 400);
  }

  const vista = await validarVistaDeProyecto(proyectoId, vistaId);
  if (!vista) {
    return responder(res, { ok: false, error: 'Vista no encontrada en el proyecto indicado' }, 404);
  }

  try {
    const contenidoActual = vista.contenidoModificado;
    construirPromptEdicion(contenidoActual, instruccion.trim(), vista.formato);
    const contenidoNuevo = await editarVistaConIA(contenidoActual, instruccion.trim(), vista.formato);

    const actualizada = await prisma.vista.update({
      where: { id: vista.id },
      data: {
        contenidoModificado: contenidoNuevo,
        tieneCambiosSinConfirmar: contenidoNuevo !== vista.contenidoGuardado
      }
    });

    return responder(res, { ok: true, data: vistaADominio(actualizada) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'No se pudo editar la vista';
    return responder(res, { ok: false, error: message }, 500);
  }
});

app.post('/api/proyectos/:proyectoId/vistas/:vistaId/confirmar', async (req: Request, res: Response) => {
  const { proyectoId, vistaId } = req.params as { proyectoId: string; vistaId: string };
  const vista = await validarVistaDeProyecto(proyectoId, vistaId);
  if (!vista) {
    return responder(res, { ok: false, error: 'Vista no encontrada en el proyecto indicado' }, 404);
  }

  const actualizada = await prisma.vista.update({
    where: { id: vista.id },
    data: {
      contenidoGuardado: vista.contenidoModificado,
      tieneCambiosSinConfirmar: false
    }
  });

  return responder(res, { ok: true, data: vistaADominio(actualizada) });
});

app.post('/api/proyectos/:proyectoId/vistas/:vistaId/descartar', async (req: Request, res: Response) => {
  const { proyectoId, vistaId } = req.params as { proyectoId: string; vistaId: string };
  const vista = await validarVistaDeProyecto(proyectoId, vistaId);
  if (!vista) {
    return responder(res, { ok: false, error: 'Vista no encontrada en el proyecto indicado' }, 404);
  }

  const actualizada = await prisma.vista.update({
    where: { id: vista.id },
    data: {
      contenidoModificado: vista.contenidoGuardado,
      tieneCambiosSinConfirmar: false
    }
  });

  return responder(res, { ok: true, data: vistaADominio(actualizada) });
});

app.post('/api/proyectos/:proyectoId/vistas/:vistaOrigenId/difundir', async (req: Request, res: Response) => {
  const { proyectoId, vistaOrigenId } = req.params as { proyectoId: string; vistaOrigenId: string };
  const { vistasDestinoIds } = req.body as { vistasDestinoIds?: string[] };

  if (!Array.isArray(vistasDestinoIds) || vistasDestinoIds.length === 0) {
    return responder(res, { ok: false, error: 'Debes indicar al menos una vista destino' }, 400);
  }

  const vistaOrigen = await validarVistaDeProyecto(proyectoId, vistaOrigenId);
  if (!vistaOrigen) {
    return responder(res, { ok: false, error: 'Vista origen no encontrada en el proyecto indicado' }, 404);
  }

  const vistasDestino = await prisma.vista.findMany({
    where: {
      proyectoId,
      id: { in: vistasDestinoIds.filter((id) => id !== vistaOrigenId) }
    }
  });

  if (vistasDestino.length === 0) {
    return responder(res, { ok: false, error: 'No se encontraron vistas destino válidas' }, 404);
  }

  const resultados = await Promise.all(
    vistasDestino.map(async (vistaDestino: VistaPrisma) => {
      try {
        construirPromptDifusion(
          vistaOrigen.contenidoModificado,
          vistaDestino.contenidoGuardado,
          vistaOrigen.tipo,
          vistaDestino.tipo
        );
        const contenidoNuevo = await difundirVistaConIA(
          vistaOrigen.contenidoModificado,
          vistaDestino.contenidoGuardado,
          vistaOrigen.tipo,
          vistaDestino.tipo
        );
        const actualizada = await prisma.vista.update({
          where: { id: vistaDestino.id },
          data: {
            contenidoModificado: contenidoNuevo,
            tieneCambiosSinConfirmar: contenidoNuevo !== vistaDestino.contenidoGuardado
          }
        });
        return vistaADominio(actualizada);
      } catch {
        return null;
      }
    })
  );

  const vistasActualizadas = resultados.filter((vista): vista is Vista => Boolean(vista));
  const fallidas = vistasDestino.length - vistasActualizadas.length;

  return responder(res, {
    ok: vistasActualizadas.length > 0,
    data: vistasActualizadas,
    error: fallidas > 0 ? `${fallidas} vista(s) destino no pudieron actualizarse` : undefined
  }, vistasActualizadas.length > 0 ? 200 : 500);
});

app.use(express.static(path.resolve(__dirname, '../client')));
const indexPath = path.resolve(__dirname, '../client/index.html');
app.use((req: Request, res: Response, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  if (req.method !== 'GET') {
    return next();
  }

  return res.sendFile(indexPath);
});

app.listen(port, () => {
  console.log(`Servidor escuchando en http://localhost:${port}`);
});
