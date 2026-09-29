# Changelog

All notable changes to **Pi Game Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.8.13] - 2026-09-29

### Added
- **Punto 6: Gentle Todo + `production/roadmap.md` con Stale Detection (`/studio:tasks`)**:
  - Implementación del nuevo comando `/studio:tasks` en `extensions/hooks/studio-tasks.ts` y registro en Pi CLI.
  - Parseo unificado de tareas atómicas desde `production/roadmap.md` y desde todas las Live Specs vivas en `design/gdd/*.md`.
  - Detección automática de tareas obsoletas (*Stale Tasks*): alerta con `⚠ STALE` si una tarea o su spec lleva más de 3 días sin registrar actividad o modificaciones.
  - Integración en el catálogo `/studio` bajo la categoría `PRODUCCION & RELEASES`.

---

## [0.8.12] - 2026-09-29

### Added
- **Punto 5: Strict Return Contract & Subagent Watchdogs**:
  - Implementación del validador y watchdog de retornos en `extensions/hooks/return-contract.ts`.
  - Verificación formal de campos mínimos en el esquema YAML de retorno de especialistas (`status`, `summary`, `files_changed`, `validation`, `gameplay_impact`, `risks`, `next_recommended_specialist`).
  - Detección de *Conversational Bleed*: Alertas ante frases de relleno conversacional o cortesía innecesaria en respuestas internas de subagentes.
  - Refuerzo en las directrices de runtime de `extensions/hooks/index.ts` obligando a subagentes delegados a emitir únicamente bloques YAML compactos.

---

## [0.8.11] - 2026-09-29

### Added
- **Punto 4: Gentle Changes para Videojuegos (`/studio:changes`)**:
  - Implementación del nuevo comando `/studio:changes` en `extensions/hooks/studio-changes.ts` y registro en Pi CLI.
  - Clasificación automática y rigurosa de archivos modificados por su naturaleza en gamedev:
    - `[DESIGN]`: Especificaciones vivas en `design/gdd/`, arte conceptual y audio (`design/art/`, `design/audio/`).
    - `[CODE]`: Código fuente de motor, sistemas y shaders (`src/`, `.rs`, `.cpp`, `.gd`, `.cs`, `.glsl`, `.shader`).
    - `[DATA/ASSETS]`: Sprites, texturas, audios, tablas de datos y balance (`assets/`, `data/`, `.png`, `.ogg`, `.json`, `.ron`, `.tres`, `.tscn`).
    - `[PRODUCTION]`: Roadmap de producción y logs de sesión (`production/roadmap.md`, `production/session-logs/`).
    - `[CONFIG]`: Configuración de proyecto y motor (`project.yaml`, `.pi/`, `Cargo.toml`, `CMakeLists.txt`).
  - Detección de *Drift* de ODD: Alerta si hay código de gameplay modificado sin haber actualizado la spec viva en `design/gdd/*.md`.
  - Integración en el catálogo interactivo de comandos `/studio` bajo la categoría `CONFIGURACION & ADMIN`.

---

## [0.8.10] - 2026-09-29

### Added
- **Punto 3: Organic Driven Development (ODD) como Flujo Oficial Único**:
  - Creación de la especificación completa en [`docs/odd-gamedev-workflow.md`](docs/odd-gamedev-workflow.md): pipeline de 7 pasos (*Authorize, Explore, Resolve Uncertainty, Classify, Live Spec, Implement, Validate & Close*).
  - Eliminación total de la burocracia de especificaciones muertas (SDD tradicional: propuestas, specs formales, planes de tareas separados y reportes de archivo que inducen *Paper Game Design*).
  - Adopción de la **Live Spec** única en `design/gdd/<feature>.md` para features sustanciales (≥ 2 pasos) y tareas atómicas de ~400 líneas.
  - Validación continua directa en pantalla y motor: compilación limpia, smoke test, estabilidad de FPS y bucle de cero allocations.
  - Actualización de [`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md), [`AGENTS.md`](AGENTS.md) y de los runtime prompt guidelines en `extensions/hooks/index.ts`.

---

## [0.8.9] - 2026-09-29

### Added
- **Punto 2: Persona de Estudio Senior (Cero Complacencia & Directivos Reales)**:
  - Inyectada la regla estricta de personalidad senior en el protocolo general ([`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md)), en el catálogo oficial ([`AGENTS.md`](AGENTS.md)) y en los **55 archivos de agentes** (`agents/*.md`).
  - Prohibidos los halagos vacíos, la condescendencia y las frases complacientes de chatbot (*"¡Excelente idea!", "¡Qué gran diseño!"*).
  - Tono de directores y leads de consola/PC: directo, fundamentado en *Game Feel / Jugabilidad, Rendimiento / FPS, Allocations en Bucle y Scope / Costo*.
  - Refuerzo en las directrices de runtime de los hooks de Pi (`extensions/hooks/index.ts`) para garantizar respuestas profesionales, sobrias y sin relleno conversacional.

---

## [0.8.8] - 2026-09-29

### Changed
- **Punto 1: Consolidación Zero Bleed & Eliminación Total de Emojis en CLI**:
  - Purga completa de emojis en todos los comandos y menús interactivos de Pi (`studio`, `studio:start`, `studio:setup`, `studio:models`, `studio:chains`, `studio:agents`, `studio:settings`, `studio:new`).
  - Categorías de comandos reformuladas a mayúsculas sobrias (`PRE-PRODUCCION & VISION`, `DISENO & SISTEMAS`, `INGENIERIA & MOTORES`, `ARTE & AUDIO`, `QA & TESTING`, `PRODUCCION & RELEASES`, `CONFIGURACION & ADMIN`).
  - Áreas técnicas de agentes convertidas a nomenclatura formal de ingeniería (`TIER 1 — DIRECTORES`, `TIER 2 — LEADS DE DEPARTAMENTO`, etc.).
  - Eliminados badges con emoji de los registros de comandos en Pi TUI (`[Studio]` en vez de `🎮 [Studio]`).
  - Homologación de todas las suites de tests unitarios (`npm test`: 160 tests pasados).

---

## [0.8.7] - 2026-09-29

### Changed
- **Auténtico Estilo Visual Gentle Shell (Purga de Emojis y Sobriedad TUI)**:
  - Eliminados todos los emojis decorativos y frívolos (`🎮`, `⚔️`, `👑`, `🗳️`, `📡`, `📋`, etc.) de los encabezados, tablas y menús de opciones en todo el estudio.
  - Adoptados encabezados estándar en mayúsculas sobrias y bloques ASCII limpios:
    - `┌── STUDIO CONTEXT: [Title] ───┐`
    - `### TRADE-OFF MATRIX:`
    - `> **VERDICT [Role]:**`
    - `┌── CHOICE REQUIRED: [Topic] ───┐`
    - `DELIVERY RECEIPT: [Filename]`
    - `NEXT STEPS:`
  - Actualizada la especificación completa en [`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md).
  - Actualizados los **55 archivos de agentes** en `agents/*.md` con la directiva estricta de no usar emojis y mantener tono de ingeniería de consola/PC.
  - Reforzada la directiva en los hooks de runtime (`extensions/hooks/index.ts`).

---

## [0.8.6] - 2026-09-29

### Added
- **Gentle Shell Interaction Standards (Executive Delivery & Zero Bleed)**:
  - Integrado formalmente el **Bloque 0: Executive Delivery & Zero Bleed** en [`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md).
  - Actualizados los **55 archivos de agentes** en `agents/*.md` con la directiva explícita de comunicación Gentle Shell.
  - Prohibido volcar borradores internos, tablas raw de 20+ filas o desgloses paso a paso en el chat: las especificaciones exhaustivas viven exclusivamente en disco (`design/gdd/systems-index.md`).
  - Prohibido exponer nombres de gates internos de prompts (`TD-SYSTEM-BOUNDARY`, `PR-SCOPE`, `CD-SYSTEMS`) o trazas de ejecución en las respuestas del chat.
  - El orquestador entrega únicamente síntesis ejecutivas concisas (10-15 líneas) con Choice Envelopes cerrados (`[1]`, `[2]`, `[3]`) y Recibos de Entrega.
- **Unificación de Rutas (Single Source of Truth)**:
  - Eliminada la duplicación y confusión de rutas entre `design/gdd/` y `production/design/`.
  - Estándar estricto del estudio:
    - `design/gdd/` y `design/art/`: Única fuente de verdad para el diseño de juego, mecánicas, conceptos y arte.
    - `production/`: Única fuente para seguimiento de proyectos (`production/roadmap.md`, `production/session-logs/`).

### Fixed
- **Corrección de Bug Latente en `runGuidedSetup`**:
  - Reemplazada la llamada inexistente a `handleManualSetup` por `runGuidedSetup` al volver a elegir motor tras la auditoría de prerrequisitos.
- **Limpieza de Código Muerto**:
  - Eliminados imports obsoletos (`symlinkSync`, `lstatSync`) en `studio-setup.ts`.

---

## [0.8.5] - 2026-09-29

### Added
- **Instalación Selectiva de Agentes por Motor (Enfoque A)**:
  - En lugar de saturar `.pi/agents/` con los 55 agentes (que incluye especialistas de motores no utilizados), el instalador ahora copia:
    - Los **34 agentes base (Core Studio)**: Directores, Leads y especialistas universales (diseño, mecánicas, arte, audio, narrativa, QA).
    - Los **especialistas dedicados del motor seleccionado**:
      - **Bevy**: +1 especialista (`bevy-specialist`) → 35 agentes en total.
      - **Godot**: +5 especialistas (General, GDScript, C#, GDExtension, Shaders) → 39 agentes en total.
      - **Raylib**: +5 especialistas (General, EnTT ECS, Shaders, UI/Dear ImGui, Build/CMake) → 39 agentes en total.
      - **Unity**: +5 especialistas (General, DOTS/ECS, Shaders, Addressables, UI Toolkit) → 39 agentes en total.
      - **Unreal**: +5 especialistas (General, GAS, Blueprints, Replication, UMG) → 39 agentes en total.
  - El setup interactivo solicita o valida el motor primero y crea `project.yaml`.
  - `inspectSetup()` y `isConfigured` calculan dinámicamente el umbral esperado según el motor seleccionado en vez de forzar un valor fijo de 50+.
  - Diagnósticos, banner TUI y resúmenes de instalación adaptados para reportar con exactitud los agentes instalados y activos.

---

## [0.8.4] - 2026-09-29

### Added
- **Detección Automática de Salud del Entorno (`isConfigured`)**:
  - Implementada inspección inteligente en `inspectSetup()` y `turn_start`: al iniciar Pi o escribir `"hola"`, el orquestador valida si los 55 agentes, el motor y las configuraciones están listos.
  - Si el ambiente está OK, confirma el estado del estudio y entra directo a la fase del proyecto sin preguntas de setup innecesarias.
  - Si el entorno está pendiente de configuración, ofrece de inmediato la elección clara entre **Instalación Automática** (recomendada, 55 agentes en modo 'inherit' y motor auto-sniffed) o **Instalación Manual / Guiada** (elección de motor, idioma y modelos).
  - Badge de salud de entorno añadido al banner TUI y a la notificación de arranque de sesión.
- **Seguimiento Directo de Línea de Producción para el Producer**:
  - El Producer ahora lee directamente `production/roadmap.md` (`<!-- PRODUCER_STATE -->`) para conocer con precisión el juego, hito activo, sprint en curso y siguiente tarea concreta.
  - Eliminadas las preguntas especulativas redundantes: el Producer toma el liderazgo directo del proyecto y presenta el siguiente paso sin rodeos.
- **Protocolo de Cierre Automático de Flujo (Flow Completion Protocol)**:
  - Nueva utilidad `recordFlowCompletion()` y captura automática de entregas en `tool_call`: al escribir artefactos en `design/gdd/` o `design/art/`, el roadmap se actualiza automáticamente con la tarea completada `[x]` y el relevo al siguiente especialista.

### Fixed
- **Homologación de Conteos y Textos de Agentes**:
  - Actualizado el conteo y comentarios residuales de 50 a 55 agentes en todos los scripts de instalación (`studio-setup.ts`).

---

## [0.8.3] - 2026-09-29

### Added
- **Aislamiento Local Inmediato y Reconocimiento de Raíz (`studio-root.ts`)**:
  - Detección automática de Pi Game Studio en carpetas vinculadas mediante `.pi/settings.json` local.
  - El dashboard y banner de bienvenida de Pi Game Studio ahora se muestran de inmediato al abrir `pi` en cualquier proyecto recién enlazado con `pi install ... -l`, sin requerir comandos intermedios.
  - Documentación de instalación limpia y aislada por proyecto con flag `-l` para evitar contaminación cruzada con herramientas globales o Gentle Shell.

### Fixed
- **Firma de Parámetros en TUI Selector (`studio-new.ts`)**:
  - Corregido el llamado a `ctx.ui.select` en `/studio:new`, pasando `(prompt, optionsArray)` en lugar de un objeto, eliminando el crash `Cannot read properties of undefined (reading 'length')`.

---

## [0.8.2] - 2026-09-27

### Added
- **Autodetección Proactiva de Motor y Versión (Zero-Config Engine Sniffing)**:
  - Creado módulo `extensions/hooks/engine-detector.ts` que escanea automáticamente los archivos clave del repositorio:
    - `Cargo.toml` con dependencia `bevy` $\rightarrow$ Detecta **Bevy** y extrae la versión y lenguaje (Rust).
    - `project.godot` $\rightarrow$ Detecta **Godot 4.x** e inspecciona si es GDScript o C#.
    - `CMakeLists.txt` con `raylib` o fuentes C/C++ $\rightarrow$ Detecta **Raylib** y su versión/lenguaje.
    - `ProjectSettings/ProjectVersion.txt` $\rightarrow$ Detecta **Unity** y la versión exacta del editor.
    - `*.uproject` $\rightarrow$ Detecta **Unreal Engine** y `EngineAssociation`.
  - Integrado en `banner.ts`, `session_start`, y `inspectSetup`: el estudio y el banner reconocen el motor y versión al instante sin requerir configuración manual previa.
- **Starters / Boilerplates de Inicio Rápido (`/studio:new`)**:
  - Nuevo comando `/studio:new` para inicializar proyectos listos para compilar:
    - `bevy-2d-arpg`: Starter 2D cenital/isométrico en Rust con Bevy 0.15, cámara ortográfica, movimiento en 8 direcciones y trigger de ataque.
    - `raylib-cpp-entt`: Starter C++20 con arquitectura ECS EnTT, ventana Raylib y configuración CMake FetchContent.
    - `godot-2d-character`: Escena base Godot 4.3 con CharacterBody2D, movimiento suave y cámara.
- **Auditoría de Versiones y Alertas de Conocimiento en `/studio:doctor`**:
  - Comprobación cruzada entre la versión detectada en el proyecto y la base técnica del estudio (`docs/engine-reference/`).
  - Avisos inteligentes sobre versiones de Bevy (breaking changes documentados hasta Bevy 0.19) o versiones heredadas de Godot (3.x vs 4.x).
  - Creada documentación simétrica de versiones para todos los motores: `docs/engine-reference/` (Bevy, Godot, Raylib, Unity, Unreal).

### Fixed
- **Inclusión de Raylib en Banner y Métricas de Agentes (`banner.ts`)**:
  - Actualizada la lista fallback de motores a `"Godot · Unity · Unreal · Bevy · Raylib"`.
  - Corregida la métrica del banner a `52 especialistas & leads` (+ 3 directores = 55 agentes en total).

---

## [0.8.1] - 2026-09-27

### Fixed
- **Subdirectory Workspace Resolution & TUI Banner Fix (`extensions/hooks/`)**:
  - Implemented recursive parent directory lookup (`findStudioRoot` in `extensions/hooks/studio-root.ts`) to discover `.pi/game-studio`, `project.yaml`, or `AGENTS.md` when launching Pi from nested folders (such as `sandbox/`, `src/`, or `design/`).
  - Fixed TUI startup screen and banner loading failure: properly mount custom header via `ctx.ui.setHeader` with component contract `{ render(width), invalidate() }` and `ui.notify` banner.
  - Eliminated raw terminal clearing (`\x1b[2J\x1b[3J\x1b[H`) and stdout logging in fullscreen TUI mode (`hasUI`), preventing scrollback buffer corruption and blank screen issues.
  - Ensured language policy (`es`), documentation gap detection, `/studio:settings`, and `/studio:status` reliably bind to the resolved project root.

### Added
- **Token Economy & Gentle Shell Return Contract**:
  - Modularized heavy skills (`skills/setup-engine/`) by decoupling engine-specific guides into on-demand references (`references/godot.md`, `bevy.md`, `raylib.md`), saving ~2,500 tokens per invocation.
  - Formalized standardized YAML Return Contract for delegated specialist subagents (`status`, `summary`, `files_changed`, `validation`, `gameplay_impact`, `risks`, `next_recommended_specialist`).
  - Compacted few-shot grounding dialogs in Tier 1 director agents (`agents/creative-director.md`).

---

## [0.8.0] - 2026-09-26

### Added
- **Engine Prerequisite Doctor (`/studio:doctor`)**:
  - Interactive and automated toolchain verification for Godot, Unity, Unreal, Bevy, and Raylib (compilers, build tools, runtimes).
- **GameForge Suite Integration (80 Skills & 44 Templates)**:
  - `/jam` (Game Jam 48-72h rapid development mode).
  - `/market-research` (Steam market intelligence, competitor mining, tag optimization).
  - Enhanced `/reverse-document` for brownfield repository adoption.
  - Formal Game Design Frameworks (`prompts/game-design-frameworks.md`: MDA, Flow, SDT, Bartle).
- **Live Engine MCP Layer ("Files First, MCP Accelerated")**:
  - `/connect-engine-mcp` hub for Godot, Unity, Unreal, and Bevy MCP servers.

---

## [0.7.1] - 2026-09-26

### Added
- **Raylib & C++ Specialist Quintet (55 Agents)**:
  - `raylib-specialist` (Modern C++17/20, Raylib architecture).
  - `raylib-entt-specialist` (ECS data-oriented architecture with EnTT).
  - `raylib-shader-specialist` (GLSL shaders, 2D lighting, post-processing).
  - `raylib-ui-specialist` (Raygui, Dear ImGui, ARPG interfaces).
  - `raylib-build-specialist` (CMake, FetchContent, WebAssembly emscripten pipelines).

---

## [0.6.3] - 2026-09-26

### Added
- **Automatic Language Detection & Bilingual Localization**:
  - Auto-detection of language preference (`es` / `en`) via `project.yaml` or `.pi/game-studio/language`.
  - Automatic injection of Spanish language policy in `before_agent_start`.

---

## [0.6.0] - 2026-09-25

### Added
- **Multi-Agent Guided Chains (`/studio:chains`)**:
  - Step-by-step sequential multi-agent execution pipelines for GDD reviews, feature implementation, and release gates (`chains/*.chain.md`).
- **Thinking Budgets & Structured YAML Tools**:
  - Tier-based reasoning budgets (`high`, `medium`, `low`) and structured tool definitions across all agents.

---

## [0.5.0] - 2026-09-25

### Added
- **Studio Command Visual Identity (`skills/*/SKILL.md`)**:
  - Added `🎮 [Studio]` prefix to all 77 skill descriptions so they stand out immediately from native Pi commands in the `/` autocomplete menu.
  - Added `/studio` slash command (`extensions/hooks/studio-command.ts`, `extensions/hooks/index.ts`) with interactive category browsing (Pre-producción, Diseño, Motores, Arte/Audio, QA, Producción, Configuración) and command cheatsheets.
- **Retro Gaming Startup Banner & Live Dashboard (`extensions/hooks/banner.ts`, `extensions/hooks/index.ts`)**:
  - ASCII art studio logo with pixel-perfect mathematical terminal centering (`center(line, width)`).
  - Live studio status card displaying active directors (3), specialists (44), detected game engine, live skill/template counts (77/43), storage status, and quick-start tips.
  - Integrated into Pi TUI header (`ctx.ui.setHeader`) on `session_start` with fallback console output.
  - Dynamic version reading directly from `package.json`.
- **Guided & Interactive Setup Flow (`skills/setup/SKILL.md`, `skills/assign-models/SKILL.md`)**:
  - Transparent step-by-step onboarding interview with bilingual support (ES/EN).
  - Explicit confirmation prompts (`ask_user_question`) before modifying any project files or copying agents.
- **Testing Sandbox**:
  - Added `sandbox/` and `playground/` to `.gitignore` for isolated development and testing.

### Changed
- **Decoupled Engram ("Files First, Memory Accelerated")**:
  - Removed hard dependencies on external `engram_mem_save` from skill tool lists across all skills (`architecture-decision`, `brainstorm`, `connect-engram`, `design-review`, `design-system`, `gate-check`, `setup`, `skill-improve`, `start`, `story-done`).
  - Guaranteed 100% functionality with local Markdown files in Git repository when Engram is not installed.
  - Refactored `/connect-engram` into an intelligent diagnostic and sync assistant with graceful degradation.

---

## [0.4.0] - 2026-09-24

### Added
- **Dual Upstream Homologation (CCGS v1.1.1 + OCGS v0.13.0)**:
  - Added 50th agent: `agents/bevy-specialist.md` with Bevy 0.19 docs in `docs/engine-reference/bevy/`.
  - Added 2 new skills: `skills/vertical-slice/SKILL.md` (pre-production gate) and `skills/settings/SKILL.md` (`project.yaml` manager).
  - Added 5 new templates in `prompts/`: `game-brief.md`, `prototype-report.md`, `vertical-slice-report.md`, `session-state.md`, `SKILL-CONTRACT-TEMPLATE.md`.
  - Added unified `project.yaml` configuration with `scripts/yaml-helper.sh`.

### Changed
- Updated `/prototype` skill with concept validation and `--spike` mode (time-boxed 4h technical spikes).
- Updated `prototyper` agent with spike protocols and risk burn-down templates.
- Updated `models.default.json` and `scripts/assign-models.js` to assign all 50 agents.

---

## [0.3.0] - 2026-05-16

### Added
- Automated Jest test infrastructure for homologation inventory integrity (`__tests__/homologation.test.js`, `__tests__/package.test.js`).
- Public inventory badges and provenance tables in `README.md`.

### Changed
- Aligned inventory to 49 agents, 75 skills, 38 templates, and 4 runtime hooks.

---

## [0.2.0] - 2026-05-12

### Added
- Engram persistent memory checkpoints and smart resume in `/brainstorm`.
- Context snapshotting in `/start`.

---

## [0.1.0] - 2026-05-11

### Added
- Initial release migrating Claude Code Game Studios to Pi package architecture.
