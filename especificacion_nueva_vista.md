He creado el documento con todo lo necesario para pasárselo a tu IA constructora:

prompts.ts: dos system prompts nuevos (uno que prohíbe explícitamente a Gemini mezclar el modelo de datos en la documentación general, y otro dedicado exclusivamente a generar el modelo de datos), más la estructura JSON exacta que Gemini debe devolver (diagramaMermaid, scriptSQL, esquemaJSON).
DataModelViewer.tsx: componente completo con sub-pestañas (Diagrama ER / Script), reutilizando tu MermaidViewer.tsx existente — solo verifica que el nombre de la prop chart coincida con tu implementación real.
Cambios en el modelo de datos (shared/domain.ts y schema.prisma): nuevo tipo de vista MODELO_DATOS y formato JSON_COMPUESTO, sin romper el patrón de doble estado ya existente.
Párrafo de especificación listo para pegar en tus archivos especificacion_....

Una cosa a verificar antes de pasarlo a la IA constructora: no tenía acceso al contenido real de MermaidViewer.tsx ni de prompts.ts (solo vi la captura del árbol de archivos), así que asumí una prop chart: string. Si el nombre real difiere, dímelo y ajusto el snippet.

** Lo especificado previamente es un prompt de la IA que ha generado el markdown, explicando que le faltaba información, la IA que utilice este markdown tiene que asegurarse de investigar el resto del código en su totalidad para analizar como funciona y como debe implementarse cada cosa para que se integre adecuadamente con el resto del código.**

# Instrucciones de Implementación: Vista de Modelo de Datos

> Documento de trabajo para IA constructora. Objetivo: separar el Modelo de Datos (actualmente mezclado dentro de la Documentación general) en una **nueva vista independiente** con dos sub-pestañas: Diagrama ER (Mermaid) y DDL/JSON del esquema.

---

## 1. Actualización de `server/prompts.ts` (motor Gemini)

### 1.1. Problema a corregir

Actualmente el prompt de generación de documentación no restringe explícitamente a Gemini, por lo que el modelo mezcla tablas, campos y relaciones dentro del Markdown general. Es necesario **segmentar la generación en tres salidas independientes**, cada una con su propio system prompt y su propio destino en el modelo de datos (`Vista` de tipo `DOCUMENTACION`, `DIAGRAMA` y la nueva `MODELO_DATOS`).

### 1.2. Nuevo System Prompt para Documentación general (excluir modelo de datos)

Añadir/editar en `prompts.ts`:

```typescript
export const SYSTEM_PROMPT_DOCUMENTACION = `
Eres un asistente experto en documentación técnica de software.
Genera documentación técnica en formato Markdown puro sobre el sistema descrito por el usuario.

REGLA ESTRICTA E INNEGOCIABLE:
No incluyas, bajo ningún concepto, definiciones de tablas, campos, tipos de columna,
claves primarias/foráneas, ni diagramas entidad-relación. Todo lo relativo al modelo
de datos se documenta en una vista separada y NO debe aparecer aquí, ni siquiera
como resumen o mención tabular.

Si necesitas referenciar una entidad de datos, hazlo únicamente por su nombre conceptual
(ej. "el sistema almacena Usuarios y Pedidos"), sin detallar su estructura interna.

Responde ÚNICAMENTE con el contenido Markdown final, sin explicaciones adicionales,
sin bloques de código envolventes (\`\`\`), y sin front-matter.
`;
```

### 1.3. Nuevo System Prompt para el Modelo de Datos (Mermaid ER + DDL/JSON)

```typescript
export const SYSTEM_PROMPT_MODELO_DATOS = `
Eres un asistente experto en modelado de bases de datos relacionales.
A partir de la descripción del sistema proporcionada por el usuario, genera EXCLUSIVAMENTE
el modelo de datos correspondiente, en los dos formatos indicados a continuación.

Debes responder ÚNICAMENTE con un objeto JSON válido, sin texto adicional, sin explicaciones,
y sin bloques de código Markdown envolventes (nada de \`\`\`json). El JSON debe tener
exactamente esta forma:

{
  "diagramaMermaid": "string con el diagrama en formato erDiagram de Mermaid",
  "scriptSQL": "string con las sentencias CREATE TABLE en SQL estándar",
  "esquemaJSON": "string con el esquema serializado como JSON (lista de entidades, campos, tipos y relaciones)"
}

Reglas para "diagramaMermaid":
- Debe comenzar literalmente con "erDiagram".
- Debe representar todas las entidades y relaciones del sistema con su cardinalidad
  (ej. ||--o{, }o--||, etc.).
- No incluyas comentarios ni texto fuera de la sintaxis Mermaid.

Reglas para "scriptSQL":
- Sentencias CREATE TABLE completas, con tipos de datos, claves primarias (PRIMARY KEY)
  y claves foráneas (FOREIGN KEY) explícitas.
- Debe ser SQL válido y ejecutable, en un único bloque de texto.

Reglas para "esquemaJSON":
- Estructura de la forma:
  [
    {
      "entidad": "NombreEntidad",
      "campos": [
        { "nombre": "id", "tipo": "uuid", "esPrimaria": true },
        { "nombre": "campoX", "tipo": "varchar", "esPrimaria": false }
      ],
      "relaciones": [
        { "tipo": "uno_a_muchos", "entidadDestino": "OtraEntidad" }
      ]
    }
  ]

No omitas ninguna de las tres claves. Si alguna no aplica, devuélvela como string vacío,
pero nunca la elimines del objeto.
`;
```

### 1.4. Función de construcción de prompt para el modelo de datos

```typescript
export function construirPromptModeloDatos(promptUsuario: string): string {
  return `Descripción del sistema:\n\n${promptUsuario}\n\nGenera el modelo de datos correspondiente siguiendo estrictamente el formato JSON indicado en tus instrucciones.`;
}
```

### 1.5. Impacto en `server/gemini.ts` / `server/index.ts`

* La llamada de inicialización de proyecto (equivalente al endpoint `POST /api/proyectos`) debe pasar de **2 llamadas paralelas a la IA** (Documentación + Diagrama) a **3 llamadas paralelas**: Documentación (`SYSTEM_PROMPT_DOCUMENTACION`), Diagrama de arquitectura (sin cambios) y Modelo de Datos (`SYSTEM_PROMPT_MODELO_DATOS`).
* La respuesta de la llamada de Modelo de Datos debe parsearse como JSON (`JSON.parse`) antes de persistirla; si el `JSON.parse` falla, se debe tratar como error de generación (no persistir contenido corrupto) y devolver `ok: false` en la respuesta del endpoint.
* La nueva vista se persiste como un nuevo `tipo` de `Vista` en el modelo de datos: `MODELO_DATOS`, con `formato: JSON_COMPUESTO` (ver sección 3), conteniendo internamente los tres strings (`diagramaMermaid`, `scriptSQL`, `esquemaJSON`) serializados en `contenidoGuardado` / `contenidoModificado`.
* Los flujos de edición iterativa (`/editar`) y difusión (`/difundir`) ya definidos en la especificación de implementación aplican igual sobre esta nueva vista, usando `SYSTEM_PROMPT_MODELO_DATOS` como contexto de sistema cuando la vista editada/destino sea de tipo `MODELO_DATOS`.

---

## 2. Nuevo componente `client/src/components/DataModelViewer.tsx`

Asunciones sobre el componente existente `MermaidViewer.tsx`: expone una prop `chart: string` con el código Mermaid a renderizar (ajustar el nombre de la prop si difiere en tu implementación real).

```tsx
import { useState } from "react";
import MermaidViewer from "./MermaidViewer";

type SubPestanaModeloDatos = "diagrama" | "script";

export interface DataModelViewerProps {
  diagramaMermaid: string;
  scriptSQL: string;
  esquemaJSON?: string;
  /** Formato preferido a mostrar en la pestaña de código: "sql" o "json". Por defecto "sql". */
  formatoScript?: "sql" | "json";
}

export default function DataModelViewer({
  diagramaMermaid,
  scriptSQL,
  esquemaJSON,
  formatoScript = "sql",
}: DataModelViewerProps) {
  const [pestanaActiva, setPestanaActiva] = useState<SubPestanaModeloDatos>("diagrama");

  const contenidoScript = formatoScript === "json" ? (esquemaJSON ?? "") : scriptSQL;
  const lenguajeScript = formatoScript === "json" ? "json" : "sql";

  return (
    <div className="flex flex-col h-full w-full">
      <div className="flex border-b border-gray-200 mb-4">
        <button
          type="button"
          onClick={() => setPestanaActiva("diagrama")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            pestanaActiva === "diagrama"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Diagrama ER
        </button>
        <button
          type="button"
          onClick={() => setPestanaActiva("script")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            pestanaActiva === "script"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {formatoScript === "json" ? "Esquema JSON" : "Script SQL"}
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {pestanaActiva === "diagrama" ? (
          diagramaMermaid ? (
            <MermaidViewer chart={diagramaMermaid} />
          ) : (
            <p className="text-gray-400 text-sm p-4">
              No hay diagrama entidad-relación disponible para este proyecto.
            </p>
          )
        ) : (
          <pre className="bg-gray-900 text-gray-100 rounded-md p-4 text-sm overflow-auto">
            <code className={`language-${lenguajeScript}`}>
              {contenidoScript || "No hay contenido disponible."}
            </code>
          </pre>
        )}
      </div>
    </div>
  );
}
```

### 2.1. Integración esperada en `ProjectWorkspace.tsx`

* Añadir una nueva entrada en la barra lateral de vistas (`BarraLateralVistas`) para el tipo `MODELO_DATOS`, con icono/label "Modelo de Datos".
* Al seleccionar dicha vista, `ProjectWorkspace.tsx` debe parsear el `contenidoModificado` de la vista (JSON string con las claves `diagramaMermaid`, `scriptSQL`, `esquemaJSON`) y pasar esos valores como props a `<DataModelViewer />` en lugar de a `<MarkdownViewer />`.
* El panel de edición (`PanelEdicion`) y la barra de confirmar/descartar cambios (`BarraEstadoCambios`) funcionan de forma idéntica a las demás vistas, sin cambios adicionales.

---

## 3. Actualización del modelo de datos (`shared/domain.ts` y `schema.prisma`)

```typescript
export type TipoVista = "DOCUMENTACION" | "DIAGRAMA" | "MODELO_DATOS" | "OTRO";
export type FormatoContenido = "MARKDOWN" | "MERMAID" | "JSON_COMPUESTO" | "TEXTO_PLANO";
```

En `schema.prisma`, añadir el nuevo valor a los enums `TipoVista` y `FormatoContenido` correspondientes. El contenido de la vista `MODELO_DATOS` se serializa como un único string JSON con la forma `{ diagramaMermaid, scriptSQL, esquemaJSON }` dentro de `contenidoGuardado` / `contenidoModificado`, reutilizando así el mismo esquema de doble estado sin cambios estructurales en la tabla `Vista`.

---

## 4. Párrafo para añadir a los documentos de especificación (`especificacion_...`)

> **Vista de Modelo de Datos.** Además de las vistas de Documentación y Diagrama de arquitectura, el proyecto incorpora una tercera vista de tipo `MODELO_DATOS`, dedicada exclusivamente a la estructura de la base de datos del sistema diseñado. Esta vista se genera a partir de un prompt independiente dirigido a la IA, con instrucciones estrictas para que la documentación general no incluya definiciones de tablas, campos o relaciones. La IA devuelve el modelo de datos en un único objeto JSON con tres representaciones equivalentes del mismo esquema: un diagrama Entidad-Relación en sintaxis Mermaid (`erDiagram`), un script DDL en SQL (`CREATE TABLE`) y un esquema JSON estructurado. Estas tres representaciones se persisten conjuntamente como el contenido (guardado y modificado) de la vista `MODELO_DATOS`, siguiendo el mismo patrón de doble estado que el resto de vistas del proyecto. En el Frontend, esta vista se renderiza mediante el componente `DataModelViewer.tsx`, que ofrece dos sub-pestañas de navegación: una para el diagrama ER (reutilizando `MermaidViewer.tsx`) y otra para el script SQL o el esquema JSON. Los flujos de edición iterativa, confirmación/descarte y difusión de cambios se aplican a esta vista de forma idéntica al resto, sin requerir lógica adicional en el Backend más allá del uso del system prompt específico `SYSTEM_PROMPT_MODELO_DATOS`.