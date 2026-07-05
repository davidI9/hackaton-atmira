# Especificación Técnica: Arquitectura del Sistema de Asistencia al Diseño de Software con IA Generativa

---

## 1. Visión General del Sistema

El sistema descrito es una herramienta de asistencia al diseño de software que permite a un usuario crear **Proyectos** y, dentro de ellos, generar y editar de forma iterativa distintas **Vistas técnicas** (documentación en Markdown, diagramas en Mermaid, y otros artefactos futuros) con ayuda de un modelo de Inteligencia Artificial Generativa (IA).

La arquitectura se divide en tres capas claramente diferenciadas:

* **Frontend**: capa de interacción con el usuario. Captura las acciones del usuario (creación de proyectos, introducción de prompts, edición de vistas, confirmación o descarte de cambios, difusión de cambios entre vistas) y renderiza el estado devuelto por el Backend.
* **Backend**: capa de orquestación. Recibe las peticiones del Frontend, gestiona la persistencia en la Base de Datos, construye los prompts que se envían a la IA y procesa las respuestas de esta para actualizar el estado correspondiente.
* **Base de Datos**: almacena la entidad `Proyecto` y sus `Vistas` asociadas, cada una con un **doble estado** (guardado y modificado), que constituye el patrón central de todo el sistema.

El flujo de datos principal sigue siempre el mismo patrón:

1. El **Usuario** ejecuta una acción en el **Frontend**.
2. El **Frontend** traduce esa acción en una petición al **Backend**.
3. El **Backend** consulta o actualiza la **Base de Datos** y, cuando la operación lo requiere, construye un prompt y lo envía a la **IA**.
4. La respuesta de la IA se persiste en la Base de Datos (normalmente en el **Estado Modificado** de una vista).
5. El Backend devuelve el resultado al Frontend, que actualiza la interfaz mostrada al usuario.

---

## 2. Modelo de Datos Central (El Patrón de Doble Estado)

De el diagrama se deduce una jerarquía de entidades de tres niveles:

```
Proyecto (Proy 1)
 ├── Vista 1 (Documentación)
 │     ├── Estado Guardado
 │     └── Estado Modificado
 ├── Vista 2 (Diagrama)
 │     ├── Estado Guardado (Vista 2)
 │     └── Estado Modificado (Vista 2)
 └── Vista N
       ├── Estado Guardado
       └── Estado Modificado
```

### 2.1. Proyecto

Es la entidad raíz. Agrupa todas las vistas generadas a partir de un mismo prompt inicial de usuario. Se crea en el momento en que el usuario solicita un nuevo proyecto y almacena, como mínimo, la referencia a sus vistas hijas.

### 2.2. Vistas

Cada Proyecto contiene múltiples Vistas, cada una representando un artefacto técnico distinto derivado del mismo prompt original:

* **Vista 1 – Documentación**: contenido generado en formato Markdown.
* **Vista 2 – Diagrama**: contenido generado en formato Mermaid.
* **Vista N**: patrón extensible a otros tipos de artefactos técnicos no detallados explícitamente en el diagrama, pero contemplados en el diseño (`Vista N`).

### 2.3. El patrón de doble estado

El elemento más relevante del modelo de datos es que **cada vista mantiene dos copias independientes de su contenido**:

* **Estado Guardado**: representa la última versión confirmada (persistida de forma definitiva) del contenido de la vista.
* **Estado Modificado**: representa la versión de trabajo actual, que puede contener cambios propuestos por el usuario (a través de la IA) que aún no han sido confirmados.

Este patrón permite al usuario iterar libremente sobre una vista sin comprometer la última versión válida conocida, y decidir posteriormente si **confirma** (el modificado pasa a ser el guardado) o **descarta** (el guardado sobrescribe al modificado) los cambios propuestos. Adicionalmente, el diagrama especifica que **la interfaz siempre muestra al usuario el Estado Modificado** de la vista, nunca el guardado directamente, de modo que el usuario trabaja siempre sobre la versión "viva" del contenido.

---

## 3. Casos de Uso Principales

A continuación se enumeran los casos de uso identificados a partir de las acciones de usuario (bloques naranjas) del diagrama:

* **Crear un proyecto**: el usuario inicia un nuevo proyecto vacío, que quedará almacenado en la Base de Datos.
* **Introducir un prompt inicial**: el usuario describe, en lenguaje natural, el sistema o funcionalidad que desea diseñar, disparando la generación automática de las vistas iniciales (documentación y diagrama) mediante la IA.
* **Acceder a un proyecto**: el usuario solicita recuperar todos los datos de un proyecto existente para visualizarlos.
* **Acceder a una vista concreta de un proyecto**: el usuario navega a una vista específica (por ejemplo, la documentación o el diagrama) dentro de un proyecto.
* **Pedir un cambio sobre un fragmento de una vista**: el usuario solicita, en lenguaje natural, una modificación puntual sobre el contenido actual de una vista (documento o diagrama).
* **Descartar cambios**: cuando el Estado Modificado difiere del Estado Guardado, el usuario puede pulsar un botón para desechar los cambios propuestos y volver al último estado confirmado.
* **Confirmar cambios**: de forma alternativa, el usuario puede pulsar un botón para consolidar el Estado Modificado como el nuevo Estado Guardado.
* **Difundir cambios a otras vistas**: desde la vista en la que se encuentra, el usuario puede propagar los cambios recién introducidos hacia el resto de vistas del proyecto, seleccionando cuáles deben actualizarse.

---

## 4. Interacciones Detalladas (Frontend ↔ Backend ↔ IA)

### 4.1. Creación inicial del proyecto

1. El **usuario crea un proyecto** desde el Frontend.
2. El Backend **almacena el proyecto en la Base de Datos**.
3. El **usuario introduce un prompt inicial** describiendo lo que quiere diseñar.
4. El Backend recibe el prompt y **crea las vistas iniciales** para ese proyecto (Vista 1, Vista 2, ..., Vista N) en la Base de Datos, en estado vacío/borrador.
5. El Backend **envía el prompt original a la IA**, solicitando la generación de la especificación en dos formatos en paralelo:
   * Documentación en formato **Markdown** (destinada a la Vista 1 – Documentación).
   * Diagrama en formato **Mermaid** (destinado a la Vista 2 – Diagrama).
6. La IA devuelve ambos contenidos generados.
7. El Backend **actualiza el Estado Guardado y el Estado Modificado de la Vista 1** (Documentación) con la respuesta obtenida.
8. El Backend **actualiza el Estado Guardado y el Estado Modificado de la Vista 2** (Diagrama) con la respuesta obtenida.
9. En este punto ambos estados (guardado y modificado) de cada vista son idénticos, ya que se trata de contenido recién generado y aún no editado por el usuario.

### 4.2. Modificación iterativa de una vista

1. El **usuario accede al proyecto**, lo que provoca que el Frontend **solicite todos los datos del proyecto** al Backend.
2. El Backend devuelve los datos del proyecto (todas sus vistas) y el Frontend los muestra.
3. El **usuario accede a una vista concreta** del proyecto. El Frontend **siempre muestra el Estado Modificado** de dicha vista.
4. El **usuario pide un cambio** sobre un fragmento concreto de la vista (documento o diagrama), redactando la instrucción en lenguaje natural.
5. El Backend **recibe la vista que se está modificando junto con la petición** de cambio.
6. El Backend **recupera el Estado Modificado actual** de esa vista desde la Base de Datos (no el guardado).
7. El Backend **construye un prompt combinando la versión actual del contenido (Estado Modificado) con la instrucción de cambio del usuario**, y lo envía a la IA.
8. La IA devuelve el contenido actualizado.
9. El Backend **actualiza el Estado Modificado de la vista** con la respuesta de la IA (el Estado Guardado permanece intacto).
10. El Frontend **actualiza el contenido mostrado de la vista** con el nuevo Estado Modificado.

> **Nota**: como consecuencia directa de este flujo, tras cualquier edición el Estado Modificado y el Estado Guardado de la vista dejan de coincidir, lo cual habilita el siguiente caso de uso.

### 4.3. Confirmación o descarte de cambios

Cuando **el Estado Modificado de una vista no coincide con su Estado Guardado**, el Frontend ofrece al usuario dos acciones excluyentes:

* **Descartar los cambios**:
  1. El usuario pulsa el botón de descartar cambios.
  2. El Backend **copia el Estado Guardado sobre el Estado Modificado**, eliminando así las modificaciones no confirmadas.

* **Confirmar los cambios**:
  1. El usuario pulsa el botón de confirmar cambios.
  2. El Backend **copia el Estado Modificado sobre el Estado Guardado**, consolidando las modificaciones como la nueva versión de referencia.

Ambas operaciones son puramente internas a la Base de Datos (no requieren invocar a la IA), ya que se limitan a sincronizar los dos campos de estado de la vista afectada.

### 4.4. Difusión / Propagación de cambios (sincronización entre vistas)

Este es el flujo más complejo del sistema y permite propagar un cambio realizado en una vista hacia el resto de vistas del proyecto, manteniendo la coherencia entre todos los artefactos generados.

1. El usuario se encuentra en una vista sobre la que **acaba de introducir cambios** (su Estado Modificado difiere del Guardado) y desea **actualizar el resto de vistas** con base en dichos cambios.
2. El usuario pulsa el **botón de difundir cambios**.
3. El Frontend le muestra una **lista de las vistas del proyecto disponibles** para ser actualizadas, permitiéndole seleccionar una o varias.
4. Por **cada vista de destino seleccionada**, el Backend ejecuta el siguiente subproceso:
   1. Recupera el **Estado Guardado de la vista destino** (la vista que va a recibir la propagación).
   2. Recupera el **Estado Modificado de la vista origen** (la vista desde la que se están difundiendo los cambios).
   3. Construye un prompt que combina ambos contenidos, solicitando a la IA que **actualice el código/contenido de la vista destino** para reflejar los cambios introducidos en la vista origen, partiendo de la última versión confirmada (guardada) de la vista destino.
   4. Envía dicho prompt a la IA.
   5. La IA devuelve el contenido actualizado para la vista destino.
   6. El Backend **actualiza el Estado Modificado de la vista destino** con la respuesta de la IA.
5. Este proceso se repite de forma independiente para cada vista seleccionada por el usuario, de modo que cada vista de destino recibe su propia actualización basada en su propio Estado Guardado combinado con el cambio propagado desde la vista origen.
6. Como resultado, cada vista destino actualizada queda en un estado análogo al descrito en la sección 4.2 (Estado Modificado distinto del Estado Guardado), por lo que el usuario deberá posteriormente **confirmar o descartar** dichos cambios en cada una de ellas de forma individual, siguiendo el flujo de la sección 4.3.

---

## Resumen del Patrón Arquitectónico

El sistema completo puede resumirse en un único principio de diseño: **toda modificación de contenido, ya sea manual o propagada, se materializa primero en el Estado Modificado de la vista afectada, nunca directamente en el Estado Guardado**. El Estado Guardado únicamente se actualiza mediante una acción explícita de confirmación por parte del usuario. Este patrón garantiza que el usuario mantenga en todo momento control total sobre qué cambios generados por la IA pasan a formar parte definitiva de cada vista del proyecto.
