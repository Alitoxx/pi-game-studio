# Pi Game Studio Skills — Catálogo y Referencia Oficial

Guía de referencia completa para el pipeline de **6 Skills ODD (Organic Driven Development)** y los comandos `studio:*` de Pi Game Studio.

---

## Filosofía del Pipeline ODD (6 Fases Oficiales)

Pi Game Studio opera bajo el flujo **Organic Driven Development (ODD)**:
1. **Cero burocracia documental**: Sin carpetas multi-fase obsoletas. Toda la especificación viva reside en `design/gdd/`.
2. **Tareas atómicas de ~400 líneas**: Cada ciclo de trabajo produce código compilable y validable en motor.
3. **Validación directa en motor**: Cero asignaciones en bucles de frame, FPS estables y *game feel* tangible.

```text
[1. /concept]  ──>  [2. /spec]  ──>  [3. /arch]  ──>  [4. /code]  ──>  [5. /test]  ──>  [6. /ship]
  (Visión &          (Live Spec        (Límites &       (Código &        (Smoke &        (Build &
   Pilares)          Mecánicas)         Budgets)         Shaders)         Leaks)         Parches)
```

---

## 1. Catálogo de las 6 Skills ODD

| Comando | Fase ODD | Agente Responsable | Entradas | Salidas Principales | Propósito |
|---|---|---|---|---|---|
| **`/concept`** | Fase 1: Visión | `creative-director` | Premisa, idea o arquetipo | `design/gdd/concept.md` | Define la fantasía central, 3-5 pilares inquebrantables, anti-pilares y ancla de identidad visual. |
| **`/spec`** | Fase 2: Live Spec | `game-designer` | `concept.md`, inputs | `design/gdd/<feature>.md`, `assets/manifest.yaml` | Live Spec de mecánica viva con reglas, fórmulas numéricas, tuning knobs, requisitos de shaders y tareas atómicas. |
| **`/arch`** | Fase 3: Arquitectura | `technical-director` | Live Spec, motor | `docs/architecture/adr-*.md`, `docs/architecture/mcp-ecosystem.md` | Fija presupuestos de RAM/VRAM, target FPS (60/120), ADRs, arquitectura de subsistemas y auditoría de 10 servidores MCP. |
| **`/code`** | Fase 4: Código | `gameplay-programmer` + Especialista de Motor | `design/gdd/<feature>.md`, ADRs | Código fuente en `src/`, shaders, escenas | Implementación idiomática en motor (Bevy, Godot, Raylib, Unity, Unreal) con cero allocs innecesarias en runtime. |
| **`/test`** | Fase 5: QA & Feel | `qa-lead` | Binario, código, telemetría | `production/qa/bugs.md`, métricas de framerate | Smoke checks sin crash, suites de regresión, detección de fugas de memoria (60s soak test) y validación de game feel. |
| **`/ship`** | Fase 6: Release | `producer` + `qa-lead` | Milestone, builds | `dist/`, release notes, checklist de store | Checklist de certificación, auditoría de placeholders en manifiesto, compilación WASM/nativa y parches de versión. |

---

## 2. Detalle de Operación por Skill

### `/concept` — Authorize & Vision (Fase 1)
- **Sub-acciones:** `/concept`, `/concept pitch`, `/concept jam`.
- **Herramientas activas:** `read, glob, grep, write, edit, ask_user_question`.
- **Contrato:**
  - Extrae la fantasía central del jugador en 1-2 oraciones.
  - Formula 3 a 5 pilares con test de diseño accionable.
  - Fija al menos 2 anti-pilares para proteger el alcance de producción.
  - Ofrece selección interactiva de ancla visual con `ask_user_question`.

### `/spec` — Live Specs & Design (Fase 2)
- **Sub-acciones:** `/spec <feature>`, `/spec review`.
- **Herramientas activas:** `read, glob, grep, write, edit, ask_user_question`.
- **Contrato:**
  - Redacta la Live Spec única en `design/gdd/<feature>.md`.
  - Excluye valores mágicos; expone tuning knobs para `assets/data/`.
  - Declara efectos de render y shaders en GPU requeridos.
  - Define estados de aplicación (pausa, menú, gameplay) y soporte de input teclado + gamepad.
  - Descompone la implementación en un checklist atómico de tareas (~400 líneas).

### `/arch` — Technical Boundaries & Engine (Fase 3)
- **Sub-acciones:** `/arch`, `/arch adr`, `/arch budget`, `/arch mcp`.
- **Herramientas activas:** `read, glob, grep, write, edit, bash, ask_user_question`.
- **Contrato:**
  - Redacta ADRs concisos en `docs/architecture/adr-<num>-<titulo>.md`.
  - Define presupuestos estrictos de memoria y framerate por plataforma.
  - Configura pipelines simétricos para los 6 motores oficiales (Bevy, Godot, Phaser, Raylib, Unity, Unreal).
  - Audita el estado de los 10 servidores MCP disponibles en `/studio:mcp`.

### `/code` — Idiomatic Implementation (Fase 4)
- **Sub-acciones:** `/code <feature>`, `/code review`.
- **Herramientas activas:** `read, glob, grep, write, edit, bash, subagent`.
- **Contrato:**
  - Delega implementación a paquetes atómicos de ~400 líneas vía `subagent_run`.
  - Cero asignaciones de memoria o recolecciones de basura en el bucle principal de render.
  - Compilación limpia sin advertencias críticas en el motor activo.

### `/test` — Quality, Smoke & Feel (Fase 5)
- **Sub-acciones:** `/test`, `/test smoke`, `/test regression`, `/test bugs`.
- **Herramientas activas:** `read, glob, grep, write, edit, bash, ask_user_question`.
- **Contrato:**
  - Smoke checks rápidos headless por motor (`godot --headless`, `cargo check`, etc.).
  - Soak test de memoria de al menos 60 segundos con consumo plano (sin fugas sostenidas > 1 MB/min).
  - Registro y triaje de bugs clasificados de P0 a P3 en `production/qa/bugs.md`.

### `/ship` — Release & Certification (Fase 6)
- **Sub-acciones:** `/ship`, `/ship build`, `/ship patch`, `/ship release`.
- **Herramientas activas:** `read, glob, grep, write, edit, bash, ask_user_question`.
- **Contrato:**
  - Auditoría de cero bugs P0/P1 y cero assets marcados como `placeholder` en `assets/manifest.yaml`.
  - Empaquetado multiplataforma y generación de binarios WASM (`wasm-opt`) o nativos.
  - Registro de versión y generación de notas de parche en `production/releases/`.

---

## 3. Comandos del Sistema (`studio:*`)

Comandos integrados en la terminal para administración del estudio, configuraciones y herramientas:

| Comando | Descripción |
|---|---|
| **`/studio`** o **`/studio:start`** | Panel principal e inicio guiado con auditoría de estado del proyecto. |
| **`/studio:new`** | Asistente interactivo para crear un nuevo juego a partir de 6 starters (Bevy, Godot, Phaser, Raylib, Unity, Unreal). |
| **`/studio:setup`** | Instalación y despliegue del roster 8+1 (9 agentes) en el proyecto. |
| **`/studio:models`** | Configuración interactiva de proveedores y modelos de IA por rol o nivel. |
| **`/studio:doctor`** | Diagnóstico técnico integral del entorno, herramientas CLI y estructura del proyecto. |
| **`/studio:tools`** | Verificación e instalación de herramientas multimedia FOSS (ImageMagick, oxipng, pngquant, FFmpeg, Assimp, wasm-opt, gltf-transform, gltfpack, butler). |
| **`/studio:mcp`** | Inspección y gestión de servidores MCP del ecosistema. |
| **`/studio:chains`** | Ejecutor de cadenas multi-agente (`feature-implement`, `gdd-review`, `perf-audit`, etc.). |
| **`/studio:subagents`** | Visor en vivo de tareas ejecutadas por especialistas en subprocesos aislados. |
| **`/studio:web`** | Compilador y servidor local para prototipos Web/WASM. |
| **`/studio:hud`** | Alternar visibilidad de widgets y barra de estado en terminal. |
