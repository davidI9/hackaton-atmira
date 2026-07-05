# Especificación de Implementación Técnica

## Guía de construcción para IA generadora de código — Herramienta de Asistencia al Diseño de Software

> Este documento es una **especificación de implementación**, complementaria al documento de arquitectura previo. Está diseñado para ser entregado directamente a un asistente de IA de generación de código con el objetivo de construir la aplicación completa (Frontend + Backend + Base de Datos). Define stack tecnológico, modelos de datos, contratos de API, estructura de componentes y reglas de estilo.

---

## 0. Stack Tecnológico Propuesto

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite |
| Estilos | Tailwind CSS |
| Gestión de estado global | Zustand |
| Renderizado de Markdown | `react-markdown` |
| Renderizado de diagramas Mermaid | `mermaid` |
| Backend | Node.js + Express + TypeScript |
| Base de Datos | PostgreSQL |
| ORM | Prisma |
| IA Generativa | API de Anthropic (Claude), modelo `claude-sonnet-4-6`, endpoint `/v1/messages` |
| Comunicación Frontend↔Backend | REST API (JSON), autenticación por sesión/JWT (opcional según alcance) |

> Si la IA generadora de código decide sustituir alguna tecnología (p. ej. otra librería de estado o de renderizado Mermaid), debe **mantener intactos los contratos de datos y de API** definidos en las secciones 2 y 3.

---

## 1. Principios de Implementación Obligatorios

1. **Nunca modificar el Estado Guardado directamente desde una edición del usuario.** Toda edición, manual o vía IA, escribe siempre en `contenido_modificado`.
2. **El Estado Guardado solo cambia mediante confirmación explícita** (endpoint de confirmar) o mediante inicialización del proyecto.
3. **El Frontend renderiza siempre `contenido_modificado`**, nunca `contenido_guardado`, salvo en vistas de comparación/diff si se implementan a futuro.
4. **Cada llamada a la IA debe ser idempotente y transaccional** desde la perspectiva del Backend: si la llamada a la IA falla, el estado en Base de Datos no debe modificarse parcialmente.
5. **Toda vista pertenece a un único proyecto** y tiene un `tipo` fijo (`documentacion`, `diagrama`, u otro) que determina el formato del contenido (`markdown` o `mermaid`) y el componente de renderizado a usar en el Frontend.

---

## 2. Modelo de Datos

### 2.1. Esquema Prisma (PostgreSQL)

```prisma
model Proyecto {
  id          String   @id @default(uuid())
  nombre      String
  promptInicial String @db.Text
  creadoEn    DateTime @default(now())
  actualizadoEn DateTime @updatedAt
  vistas      Vista[]
}

enum TipoVista {
  DOCUMENTACION
  DIAGRAMA
  OTRO
}

enum FormatoContenido {
  MARKDOWN
  MERMAID
  TEXTO_PLANO
}

model Vista {
  id                  String           @id @default(uuid())
  proyectoId          String
  proyecto            Proyecto         @relation(fields: [proyectoId], references: [id], onDelete: Cascade)
  tipo                TipoVista
  nombre              String
  formato             FormatoContenido
  contenidoGuardado   String           @db.Text
  contenidoModificado String           @db.Text
  tieneCambiosSinConfirmar Boolean     @default(false)
  creadoEn            DateTime         @default(now())
  actualizadoEn       DateTime         @updatedAt
}
```

`tieneCambiosSinConfirmar` es un campo derivado (puede calcularse en el backend comparando ambos strings, o mantenerse como flag denormalizado para evitar comparar strings largos en cada petición).

### 2.2. Tipos TypeScript compartidos (Frontend/Backend)

```typescript
// types/domain.ts

export type TipoVista = "DOCUMENTACION" | "DIAGRAMA" | "OTRO";
export type FormatoContenido = "MARKDOWN" | "MERMAID" | "TEXTO_PLANO";

export interface Vista {
  id: string;
  proyectoId: string;
  tipo: TipoVista;
  nombre: string;
  formato: FormatoContenido;
  contenidoGuardado: string;
  contenidoModificado: string;
  tieneCambiosSinConfirmar: boolean;
  actualizadoEn: string; // ISO date
}

export interface Proyecto {
  id: string;
  nombre: string;
  promptInicial: string;
  vistas: Vista[];
  creadoEn: string;
  actualizadoEn: string;
}
```

---

## 3. Contrato de API (REST)

Todas las respuestas siguen el formato:

```typescript
interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
```

### 3.1. Crear proyecto e inicializar vistas

```
POST /api/proyectos
Body:  { "nombre": string, "promptInicial": string }
Response: ApiResponse<Proyecto>
```

**Lógica del Backend:**
1. Crea el registro `Proyecto` con el `promptInicial`.
2. Crea las vistas iniciales (`DOCUMENTACION`, `DIAGRAMA`) vacías, asociadas al proyecto.
3. Dispara en paralelo dos llamadas a la IA (ver sección 4.1).
4. Al recibir cada respuesta, actualiza `contenidoGuardado` **y** `contenidoModificado` de la vista correspondiente con el mismo valor.
5. Devuelve el proyecto completo con sus vistas ya generadas.

### 3.2. Obtener proyecto completo

```
GET /api/proyectos/:proyectoId
Response: ApiResponse<Proyecto>
```

### 3.3. Solicitar un cambio sobre una vista (edición vía IA)

```
POST /api/proyectos/:proyectoId/vistas/:vistaId/editar
Body:  { "instruccion": string }
Response: ApiResponse<Vista>
```

**Lógica del Backend:**
1. Recupera `contenidoModificado` actual de la vista (no el guardado).
2. Construye el prompt combinando `contenidoModificado` + `instruccion` (ver plantilla 4.2).
3. Envía a la IA.
4. Sobrescribe `contenidoModificado` con la respuesta.
5. Marca `tieneCambiosSinConfirmar = true`.
6. Devuelve la vista actualizada.

### 3.4. Confirmar cambios de una vista

```
POST /api/proyectos/:proyectoId/vistas/:vistaId/confirmar
Response: ApiResponse<Vista>
```

**Lógica:** `contenidoGuardado = contenidoModificado`; `tieneCambiosSinConfirmar = false`. No invoca IA.

### 3.5. Descartar cambios de una vista

```
POST /api/proyectos/:proyectoId/vistas/:vistaId/descartar
Response: ApiResponse<Vista>
```

**Lógica:** `contenidoModificado = contenidoGuardado`; `tieneCambiosSinConfirmar = false`. No invoca IA.

### 3.6. Difundir cambios a otras vistas

```
POST /api/proyectos/:proyectoId/vistas/:vistaOrigenId/difundir
Body:  { "vistasDestinoIds": string[] }
Response: ApiResponse<Vista[]>   // vistas destino actualizadas
```

**Lógica del Backend (por cada `vistaDestinoId`):**
1. Recupera `contenidoModificado` de la vista **origen**.
2. Recupera `contenidoGuardado` de la vista **destino**.
3. Construye el prompt de propagación (ver plantilla 4.3).
4. Envía a la IA.
5. Sobrescribe `contenidoModificado` de la vista destino con la respuesta.
6. Marca `tieneCambiosSinConfirmar = true` en la vista destino.
7. Repite para cada vista seleccionada; las llamadas a la IA deben ejecutarse en paralelo (`Promise.all`), pero cada una debe manejar su propio error sin abortar las demás.
8. Devuelve el array de vistas destino actualizadas.

---

## 4. Comunicación con la IA (Anthropic API)

### 4.1. Prompt de inicialización de proyecto

```javascript
async function generarVistaInicial(promptUsuario, formato) {
  const instruccionesPorFormato = {
    MARKDOWN: "Genera documentación técnica completa en formato Markdown que describa la especificación del sistema solicitado. Responde ÚNICAMENTE con el contenido Markdown, sin explicaciones adicionales.",
    MERMAID: "Genera un diagrama en formato Mermaid que represente la arquitectura del sistema solicitado. Responde ÚNICAMENTE con el bloque de código Mermaid, sin explicaciones adicionales."
  };

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: instruccionesPorFormato[formato],
      messages: [{ role: "user", content: promptUsuario }]
    })
  });

  const data = await response.json();
  return data.content.map(b => b.text || "").join("\n").trim();
}
```

### 4.2. Prompt de edición iterativa

```javascript
function construirPromptEdicion(contenidoActual, instruccionUsuario, formato) {
  return `Contenido actual (formato ${formato}):\n\n${contenidoActual}\n\n---\n\nInstrucción de cambio solicitada por el usuario:\n${instruccionUsuario}\n\nDevuelve el contenido COMPLETO actualizado en formato ${formato}, aplicando el cambio solicitado. No incluyas explicaciones, solo el contenido resultante.`;
}
```

### 4.3. Prompt de propagación/difusión

```javascript
function construirPromptDifusion(contenidoModificadoOrigen, contenidoGuardadoDestino, tipoOrigen, tipoDestino) {
  return `Se ha modificado la vista de tipo "${tipoOrigen}" de un proyecto de diseño de software. Este es su contenido actualizado:\n\n${contenidoModificadoOrigen}\n\n---\n\nA continuación se muestra el contenido actual de la vista de tipo "${tipoDestino}", que debe mantenerse coherente con el cambio anterior:\n\n${contenidoGuardadoDestino}\n\n---\n\nActualiza el contenido de la vista "${tipoDestino}" para reflejar los cambios introducidos en la vista "${tipoOrigen}", manteniendo su formato y estructura original. Devuelve ÚNICAMENTE el contenido completo actualizado.`;
}
```

**Regla de manejo de errores para todas las llamadas a la IA:** envolver en `try/catch`; si falla, devolver `ok: false` con `error` descriptivo y **no** modificar ningún estado en Base de Datos.

---

## 5. Estructura del Frontend

### 5.1. Árbol de componentes

```
App
 ├── PantallaListaProyectos
 │     └── TarjetaProyecto (onClick -> navega a PantallaProyecto)
 ├── PantallaCrearProyecto
 │     └── FormularioPromptInicial
 └── PantallaProyecto
       ├── BarraLateralVistas         // lista de vistas del proyecto (tabs/menú)
       ├── VisorVista
       │     ├── VisorMarkdown        // usado si formato === MARKDOWN
       │     └── VisorMermaid         // usado si formato === MERMAID
       ├── PanelEdicion               // input de instrucción de cambio + botón "Enviar"
       ├── BarraEstadoCambios         // visible solo si tieneCambiosSinConfirmar === true
       │     ├── BotonConfirmarCambios
       │     └── BotonDescartarCambios
       └── ModalDifundirCambios
             └── ListaSeleccionVistasDestino (checkboxes)
```

### 5.2. Estado global (Zustand)

```typescript
interface AppState {
  proyectoActual: Proyecto | null;
  vistaActivaId: string | null;
  cargando: boolean;
  error: string | null;

  cargarProyecto: (id: string) => Promise<void>;
  seleccionarVista: (vistaId: string) => void;
  editarVista: (vistaId: string, instruccion: string) => Promise<void>;
  confirmarCambios: (vistaId: string) => Promise<void>;
  descartarCambios: (vistaId: string) => Promise<void>;
  difundirCambios: (vistaOrigenId: string, vistasDestinoIds: string[]) => Promise<void>;
}
```

**Reglas de interacción entre componentes:**
* `BarraLateralVistas` actualiza `vistaActivaId` → `VisorVista` reacciona renderizando `contenidoModificado` de la vista con dicho id.
* `PanelEdicion` invoca `editarVista`; mientras la petición está en curso, `VisorVista` debe mostrar un estado de carga (skeleton/spinner) sin bloquear la navegación entre vistas.
* `BarraEstadoCambios` se muestra/oculta de forma reactiva según `vistaActiva.tieneCambiosSinConfirmar`.
* `ModalDifundirCambios` solo permite seleccionar vistas **distintas** a la vista activa (la vista origen no puede ser su propio destino).
* Tras `confirmarCambios` o `descartarCambios`, refrescar únicamente la vista afectada (no todo el proyecto) para minimizar renders.

### 5.3. Guía de estilo visual

* **Paleta**: usar tonalidades diferenciadas por capa conceptual, consistentes con el diagrama de origen (naranja para acciones del usuario/Frontend, azul/morado para procesos de Backend e IA, rosa para actualizaciones de estado) únicamente como referencia semántica en badges o indicadores de estado — no es obligatorio replicar literalmente estos colores en la UI final, pero sí mantener un color distintivo para el indicador de "cambios sin confirmar" (p. ej. ámbar/naranja) y otro para "confirmado" (p. ej. verde).
* **Tipografía**: fuente sans-serif del sistema (`Inter`, `system-ui`); tamaño base 16px; jerarquía clara entre títulos de vista, contenido y metadatos.
* **Layout**: diseño de dos columnas en `PantallaProyecto` — barra lateral fija de navegación entre vistas (ancho ~240px) y panel principal de contenido a ancho flexible.
* **Estado de carga**: cualquier acción que dispare una llamada a la IA (creación de proyecto, edición, difusión) debe deshabilitar el control que la originó y mostrar un indicador visual explícito, dado que estas operaciones pueden tardar varios segundos.
* **Feedback de confirmación/descarte**: usar notificaciones tipo *toast* no bloqueantes tras cada acción exitosa o fallida.
* **Responsive**: prioridad *desktop-first*, con colapso de la barra lateral de vistas a un menú desplegable en anchos de pantalla reducidos.

---

## 6. Comunicación Frontend ↔ Backend

* Toda comunicación se realiza vía **HTTP/JSON** contra los endpoints REST definidos en la sección 3.
* El Frontend nunca llama directamente a la API de Anthropic: **todas las llamadas a la IA pasan exclusivamente por el Backend**, que es quien conoce la clave de API y construye los prompts.
* El Backend debe validar en cada endpoint que la vista solicitada (`vistaId`) pertenece efectivamente al proyecto indicado (`proyectoId`) antes de operar sobre ella.
* Formato de error estándar en todos los endpoints:

```json
{ "ok": false, "error": "Descripción legible del error" }
```

* Códigos HTTP: `200` éxito, `400` petición inválida (p. ej. instrucción vacía), `404` proyecto/vista no encontrados, `500` error interno o fallo de la IA.

---

## 7. Resumen de Flujo Extremo a Extremo (para la IA generadora de código)

1. Implementar el esquema Prisma (sección 2.1) y ejecutar la migración inicial.
2. Implementar los 6 endpoints REST (sección 3), cada uno con la lógica descrita.
3. Implementar el módulo de comunicación con Anthropic (sección 4), reutilizado por los endpoints 3.1, 3.3 y 3.6.
4. Implementar el store Zustand (sección 5.2) que consuma dichos endpoints.
5. Implementar los componentes React (sección 5.1) respetando el árbol de dependencias y las reglas de interacción.
6. Aplicar la guía de estilo (sección 5.3) con Tailwind CSS.
7. Verificar que en ningún punto del código se escribe sobre `contenidoGuardado` fuera de los endpoints de confirmación (3.4) e inicialización (3.1).
