# Changelog

All notable changes to **Pi Game Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
