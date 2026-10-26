# Organic Driven Development para Videojuegos (ODD Gamedev Protocol)

> **Flujo de Trabajo Oficial y Único de Pi Game Studio.**
> **Metodología y Créditos:** Creada originalmente por **[Gentle AI / Gentle Programming](https://github.com/gentleprogramming/gentle-ai)** como estándar de rigor, gobernanza y desarrollo orgánico para agentes de código. Este documento adapta la disciplina formal de ODD a la realidad iterativa de motores de videojuegos, compiladores y *Game Feel*.

---

## 1. Principio Fundamental: Código Vivo vs. Burocracia Muerta

En el desarrollo de software tradicional es común escribir especificaciones de decenas de páginas antes de codificar. En videojuegos, esto genera la trampa del **Paper Game Design**: sistemas diseñados en frío que resultan aburridos, pesados o rotos al jugarlos.

**ODD establece una regla de oro:**
El diseño se valida en pantalla mediante *Game Feel*, respuesta de controles y fluidez de cuadros por segundo (FPS). No existen fases burocráticas separadas ni comités de aprobación entre documentos efímeros.

---

## 2. Los 7 Pasos del Protocolo ODD en Videojuegos

```text
┌── ODD GAMEDEV PIPELINE ─────────────────────────────────────────────┐
│ 1. AUTHORIZE:  Confirmar intención de implementación               │
│ 2. EXPLORE:    Leer código de motor (src/), GDD vivo y dependencias │
│ 3. UNCERTAINTY:Una sola pregunta enfocada si hay duda de diseño     │
│ 4. CLASSIFY:   ¿Entendida, acotada y reanudable? Si no: Live Spec   │
│ 5. LIVE SPEC:  Para features sustanciales: design/gdd/<feature>.md  │
│ 6. IMPLEMENT:  Especialista codifica en paquetes de ~400 líneas     │
│ 7. VALIDATE:   Compilación limpia + Smoke Check + FPS + Handoff     │
└─────────────────────────────────────────────────────────────────────┘
```

### Paso 1: Authorize (Autorización)
El agente no modifica archivos hasta que el usuario exprese una intención clara de cambio o implementación. Si la petición es ambigua, hace una sola pregunta de clarificación.

### Paso 2: Explore (Exploración)
Antes de proponer o escribir código, el especialista o lead lee el estado actual:
- Código del motor activo en `src/` (estructuras, componentes, sistemas existentes).
- Documento de diseño vivo en `design/gdd/`.
- Nunca asume APIs inexistentes o patrones no utilizados en el proyecto.

### Paso 3: Resolve Uncertainty (Resolución de Incertidumbre)
Si hay un conflicto real de diseño o arquitectura (e.g. *¿Cámara isométrica fija o rotacional?*, *¿Daño por porcentaje o plano?*):
- Se resuelve mediante una matriz concisa de trade-offs (**TRADE-OFF MATRIX**) en el chat, cerrada con un selector interactivo (**CHOICE REQUIRED** vía `ask_user_question`): opciones cerradas que el usuario navega con las flechas (↑/↓) y confirma con `Enter`. Nunca se le pide escribir un número.
- No se hacen cuestionarios abiertos ni debates abstractos.

### Paso 4: Classify (Clasificación de Tarea)

El tamaño no se decide contando pasos, archivos ni tests. Se decide con **tres condiciones que deben cumplirse juntas**:

1. **Entendida**: el resultado esperado, qué cambiar y dónde ya se conocen; no queda ninguna decisión de producto o diseño abierta.
2. **Riesgo contenido**: no toca datos que no se puedan reconstruir, seguridad, contratos que otros ya consumen, concurrencia ni entrega/entorno.
3. **Reanudable desde el diff**: si la sesión se cortara ahora, otra persona podría terminarla con el pedido original y el `git diff`. Si hace falta contexto que no está en ninguno de los dos, la tarea no es pequeña.

- **Tarea Pequeña / Mecánica directa** (las tres condiciones se cumplen, e.g. ajustar velocidad de personaje, corregir colisión, agregar un shader simple):
  - No genera documentos nuevos.
  - Pasa directo a implementación y verificación.
- **Feature Sustancial** (alguna condición falla, e.g. sistema de inventario, combate con combos, IA de hordas, o un cambio de formato de guardado):
  - Requiere un único documento vivo de feature (**Live Spec**).

La cantidad de pasos, archivos o tests es una **pista**, nunca el criterio: un cambio de una línea en el esquema de guardado es sustancial porque rompe partidas existentes y no se reanuda sin contexto, mientras que dos renombres triviales son pequeños.

### Paso 5: Live Spec (Documento Único Vivo de Feature)
Se almacena como la única fuente de verdad en `design/gdd/<feature-name>.md`:
- **Fantasía del Jugador & Objetivo**: Qué experimenta el jugador en 1-2 oraciones.
- **Fórmulas y Parámetros**: Valores de balance, timers, hitboxes, costos expuestos en archivos de datos externos (`assets/data/`).
- **Requisitos de Render & Shaders**: Declaración explícita de qué efectos visuales requieren shaders en GPU (luz dinámica, niebla, agua, distorsiones) para evitar simulaciones costosas en CPU.
- **Game Feel & Micro-feedback**: Tiempos de hitstop, curvas de sacudida de pantalla (*screen shake*), coyote time, input buffer y amortiguaciones (*easing*).
- **Mapeo de Input & Multi-dispositivo**: Acciones semánticas desacopladas con soporte simultáneo para Teclado/Ratón y Gamepad.
- **Esquema de Estado & Guardado**: Estructura de serialización de componentes persistentes para guardar/cargar partida.
- **Checklist de Tareas**: Tareas atómicas con IDs estables (`[x]` completado, `[/]` en progreso, `[ ]` pendiente), incluyendo tareas de shaders y debug overlay.
- **Evidencia de Validación**: Comandos de build, logs de smoke check, métricas de rendimiento observadas (FPS, 0 allocations por frame).

### Paso 6: Implement Task by Task (Implementación Atómica)
- Cada tarea del checklist se implementa mediante el especialista de motor correspondiente (`bevy-specialist`, `raylib-specialist`, `godot-specialist`, etc.).
- Los efectos visuales se implementan directamente como shaders en `assets/shaders/` integrados en el pipeline de materiales del motor.
- En la primera tarea de scaffold o subsistema (`TASK-01` o `02`), se habilita un **Debug Overlay (`F3`)** con FPS en vivo, datos de telemetría y gizmos de colisión/visión en pantalla.
- **Tamaño de entrega**: Bloques coherentes de unas 400 líneas cambiadas (código + tests/data).
- Cero código muerto, cero métodos de más de 40 líneas.

### Paso 7: Validate & Close (Validación y Cierre)
1. **Compilación y Smoke Check**: Verificación con el compilador nativo (`cargo check`, `cmake --build`, `godot --headless`).
2. **Impacto en Rendimiento**: Confirmación de que el game loop no sufre regresiones de FPS ni allocations dinámicas innecesarias.
3. **Delivery Receipt**: Emisión del recibo de entrega en la terminal.
4. **Producer Auto-Handoff**: El Producer actualiza `production/roadmap.md` (`<!-- PRODUCER_STATE -->`) y presenta el siguiente paso sin preguntar *"¿qué hacemos ahora?"*.

---

## 3. Resumen de Diferencias: ODD vs. Burocracia Tradicional

| Dimensión | Burocracia Tradicional (SDD corporativo) | ODD Gamedev (Pi Game Studio) |
| :--- | :--- | :--- |
| **Documentos** | 5 archivos por cambio (proposal, spec, design, tasks, archive) | **1 solo documento vivo** por sistema (`design/gdd/*.md`) |
| **Tareas pequeñas** | Obliga a llenar formularios y pasar por gates | **Directo a código** con compilación y verificación |
| **Iteración** | Rígida; cambiar el salto requiere reescribir la spec | **Orgánica**; ajuste inmediato de parámetros de tuning |
| **Validación** | Pruebas abstractas | **Game Feel en pantalla** + Métricas duras (FPS, Allocations) |
| **Agilidad** | Semanas debatiendo en texto | **Horas iterando** mecánicas funcionales |
