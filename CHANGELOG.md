# Changelog

All notable changes to **Pi Game Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed (Visual Identity)
- **A sober palette with a single accent.** The studio shipped two palettes at once: `studio-palette.ts` (soft pastels) and hardcoded Tailwind-400 literals in seventeen other files. Nine of the fourteen colours sat at 90%+ brightness, so status competed with body text and nothing had visual rank; the error colour was pink and three different reds were in use.
  - Hierarchy now comes from brightness, not hue: text 83% · states 69-76% · muted 56% · faint 36% · borders 25%.
  - One brand accent (`#7A93C9`, slate blue); `SECONDARY` is the same family, quieter.
  - States: sage `#7FB08A`, muted gold `#C2A15E`, clay `#C0736E` instead of neon mint, amber and pink.
  - Every legacy export name still resolves, so no component changed its imports.
- **`NO_COLOR` is honoured**: with it set, every escape becomes an empty string instead of the studio imposing its palette.
- **Invariant**: no file outside `studio-palette.ts` may hardcode an RGB escape, and the test asserts the brightness order (text > states > borders) so a future palette cannot flatten it again.
- **`scripts/palette-preview.js`** prints the live palette with saturation and brightness, plus a sample panel, reading the module itself — the swatches cannot drift from the code.


### Fixed (Runner Lifecycle & Observability)
- **Specialist reasoning budget reaches the child** (`--thinking`): every agent template declared it and the runner never passed it, so all 14 ran at the session default. The loader now validates the value against Pi's vocabulary, so a typo falls back to the tier default instead of reaching the process.
- **The RPC prompt response is read**: the prompt is sent with an id and its `success`/`disposition` is honoured. A rejected prompt fails the task immediately with the reason instead of burning the watchdog, and `agent_settled.aborted` is reported as cancelled rather than completed.
- **Replaced studio tools are visible**: when another package already owns `subagent_run`, `subagent_list`, `subagent_status`, `subagent_result` or `ask_user_question`, the skip is recorded and surfaced at `session_start` and in `/studio:doctor`, instead of leaving the runner inert with no log line.
- **Specialists can escalate a decision**: `ask_user_question` is no longer granted to children (it can never work — a child has no UI). A specialist stops with `status: interaction_required` carrying `question`, `options` and `blocking`, and `subagent_run` returns it as a blocking choice for the parent to relay.
- **Specialists can persist a durable discovery** (`mem_save`): no agent declared a memory tool, so an engine API that changed, a subsystem that must not be touched or a constraint the spec omits existed only inside the child process and the prose of its receipt, and the next specialist paid for it again.
  - The 14 knowledge-producing templates declare `mem_save`; `qa-verifier` does not, because its independence is provable only while it stays read-only.
  - The provider is optional and the studio does not ship one. The runner probes the host before dispatching: with a provider the tool is granted and the executive prompt states what to persist and what never to; without one the tool is stripped, recorded on the task (`memoryUnavailable`) and the child is told to route the discovery through `risks`/`summary` instead.
  - An unanswered probe grants, because Pi ignores a tool name it does not know: granting is the harmless direction, stripping a provider that is actually installed is not.
- **Delegation depth is one, enforced by the runner**: `creative-director` and `technical-director` declared `subagent_run` while no agent declared `subagent_status`, `subagent_result` or `subagent_cancel`. Dispatched as a child — which is how a director normally runs — one of them could launch a specialist it had no tool to inspect, collect or cancel, and its own parent saw a completed director that produced nothing.
  - The runner now strips the whole `subagent_*` family from every child's `--tools`, not just `subagent_run`, so a template cannot reopen the hole by declaring a sibling tool. The strip is recorded on the task (`delegationStripped`) and as its first activity line, never silent.
  - `subagent_run` is gone from both director frontmatters: declared capability and actual boundary now agree. Their bodies state the rule and route the work as a recommendation for the Producer to dispatch.
  - Escalation keeps working through `status: interaction_required`, which is the channel a child already had.
- **Child process trees are terminated**: cooperative `abort` first, then `SIGTERM` and `SIGKILL` to the whole process group, plus a `session_shutdown` hook that cancels every live specialist. Grandchildren spawned by a build no longer survive cancellation.
- **Critical-path failures are recorded**: `recordFailure(area, error)` keeps the last 50 failures, prints one line per distinct cause and feeds `/studio:doctor`, replacing silent `catch {}` blocks in spawn, signalling, stdin close and roadmap writes.
- **Children no longer persist discarded sessions**: `--no-session` in the child, with the last 20 stderr lines kept on the record so a failed run stays diagnosable.
- **Dispatch root is bounded and proven**: `subagent_run` refuses to start outside a Game Studio project (`allow_outside_studio: true` overrides it) and stamps `resolvedRoot` on every receipt.
- **Chains declare bounded surfaces and owned sections**: steps accept `surfaces:` and `section:`, and `validateChain` refuses a chain where two steps replace the same artifact without distinct sections. All three shipped chains collided before this change.
- **The watchdog judges silence, not elapsed time**: activity refreshes the budget, a tool in flight gets a larger allowance, and concurrency is capped instead of unbounded.
- **Token accounting uses reported usage**: accumulated from `message_end`, with the character heuristic surviving only as a flagged estimate.

### Fixed (Build & CI)
- The CI type check could not fail: `pnpm dlx typescript tsc --noEmit || echo "skipped"` swallowed every exit code and never compiled a file. `typescript` is now a real devDependency, `allowImportingTsExtensions` is enabled, and the step fails the job. Fixing it surfaced two latent runtime bugs: an out-of-scope variable in the subagent log view and a continuity flow calling an export that never existed.
- GitHub Pages deploy no longer turns `main` red when the repository has no Pages site: the job probes the API first and skips.
- Actions moved off the deprecated `node20` runtime, and the runner image is pinned to `ubuntu-24.04`.
- Pull request checks run for stacked branches too: the workflows filtered by base branch, so a PR targeting another feature branch ran no CI at all.


### Fixed (Contract Enforcement & Sources of Truth)
- **Return Contract gate**: `StudioAgentsRunner` validates every specialist delivery with the previously unused `return-contract.ts` validator. A delivery that breaks the contract marks the task as failed with each violation named, instead of reporting a green receipt; the raw report is preserved for the Producer. `status: completed` additionally requires `files_changed` or `validation`, because a delivery that names neither was never verified.
  - Behavioral tests replace the source-grep assertion that only checked the validator existed. New end-to-end coverage drives the real runner over a fake RPC child.
- **Bounded edit surfaces reach the specialist**: the task's `## Allowed edit surfaces` block is forwarded to the child process as `PI_STUDIO_ALLOWED_SURFACES` and loaded by the child-side guard on session start. The guard previously lived only in the parent session, so the declared scope was advisory. Tasks without declared surfaces keep the unbounded behavior.
- **`target_dir` scoping** now also emits the canonical `## Allowed edit surfaces` block.
- **`PI_PATH` is honored** by the runner, so isolated profiles and tests can pin the child binary instead of resolving `pi` from `PATH`.

### Changed (Model Configuration)
- `models.default.json` no longer ships the legacy 50+ agent roster (`narrative-director`, `release-manager`, `localization-lead`, per-engine sub-specialists). It keeps the `director`/`workhorse`/`lightweight` tiers plus the six engine specialists, all mapped to the defaults `AGENTS.md` documents.
- `scripts/assign-models.js` classifies `art-director` and `audio-director` as `workhorse`, matching runtime resolution. The `lightweight` tier ships with no agent and remains available as a model value.
- `/studio:models` agent picker includes `phaser-specialist`.
- `AGENTS.md` and `README.md` describe the real resolution: templates declare `model: inherit`, tiers live in `models.default.json`, overrides land in `.pi/game-studio/models.json`.

### Added (Guards)
- Invariant test: every key in `models.default.json` is a known tier or a real agent of the 8+1 roster.

### Removed (Orphaned Template Layer)
- Retired the `prompts/` directory: game concept, GDD and ADR masters, art and sound bibles, release checklist, automation modes, and the three `collaborative-protocols` agent protocols. Nothing referenced the directory — no skill, agent, or extension — while the package still published it as prompt templates.
- It was not neutral dead paper. `prompts/game-concept.md` closed with a checklist that told the user to run six commands that do not exist (`/design-review`, `/map-systems`, `/architecture-decision`, `/prototype`, `/playtest-report`, `/sprint-plan new`), and the collaboration protocols instructed per-file write approval ("May I write this to [filepath]?"), emoji pros/cons, and praise — the exact behaviours the ODD contract forbids.
- The package manifest no longer registers prompt templates, README and `context.md` no longer advertise the layer, and an invariant test keeps it retired.

---

## [1.10.0] - 2026-10-18

### Added & Expanded (Gamedev Pro Suite)
- **Fast-Forward Continuity Pipeline (`/studio:next`, `/studio:continuity`, `/next`)**:
  - Handoff automático entre tareas atómicas ODD al verificar el Return Contract con tests limpios.
  - Selector interactivo nativo para avanzar de inmediato a la siguiente tarea sin fricción de tipeo ni pérdida de contexto.
- **Inspector de Balance & Game Feel (`/studio:tuning`, `/tuning`)**:
  - Visor interactivo y calibrador de variables de gameplay en YAML (`assets/data/*.yaml`, `assets/roles.yaml`, etc.).
  - Modificación en caliente de valores numéricos y booleanos con persistencia atómica en disco preservando comentarios y formato.
- **Optimización Automatizada de Assets FOSS (`/studio:assets optimize`)**:
  - Integración nativa de `oxipng` para reducción sin pérdida de texturas y sprites PNG con reporte de porcentaje y bytes ahorrados.
- **Runner Unificado de Runtime y Live Preview (`/studio:play`, `/play`)**:
  - Lanzamiento y supervisión en background del juego según el motor activo (`cargo run`, `pnpm run dev`, `godot`, `raylib`) con registro de PID y captura de logs en `.pi/game-studio/play-output.log`.
  - Subcomandos `/studio:play status` y `/studio:play stop`.
- **Generador Guiado de Live Specs ODD (`/studio:feature`, `/feature`)**:
  - Creación interactiva de documentos Live Spec en `design/gdd/<feature>.md` con estructura formal de 6 tareas atómicas T1-T6 (~400 líneas c/u) y sincronización con el roadmap.
- **Foco en Feature Activo y Protocolo Anti-Bloat de Tareas**:
  - Tarjeta de tareas TUI enfocada en el Live Spec en progreso, erradicando la sobrecarga cognitiva de checklists históricos.
  - Filtro inteligente de notas técnicas y sub-bullets en `studio-tasks.ts`.
- **Purificación de Tooling Node/pnpm**:
  - Eliminado el lockfile residual `package-lock.json`.
  - Declarado `"packageManager": "pnpm@11.28.5"` en `package.json` para máxima reproducibilidad.

## [1.9.1] - 2026-10-17

### Added & Improved
- **Contrato de Rationale Previo Obligatorio para Menús Nativos (`ask_user_question`)**:
  - Erradicado el comportamiento de menús en seco o sin contexto previo en los 14 agentes oficiales (`agents/*.md`, `docs/gamedev-interaction-protocol.md`, `AGENTS.md` y `extensions/hooks/index.ts`).
  - Antes de invocar `ask_user_question`, el agente debe emitir obligatoriamente en el chat: (1) `SITUACIÓN ACTUAL` (qué se completó o en qué hito de ODD estamos), (2) `ANÁLISIS DEL DILEMA` (impacto en Game Feel, FPS y alcance), y (3) `RECOMENDACIÓN DEL LEAD/DIRECTOR` (veredicto técnico y argumentado).
  - Prohibida la auto-repetición de labels dentro de la descripción en las opciones interactivas.
- **Activación Eager de Herramientas Web (Erradicación del Error 400 en OpenCode Go / Kimi)**:
  - Configurado `toolActivation: "eager"` en `web-search.json` dentro de `bin/pi-studio.mjs` para activar las herramientas de `pi-web-access` desde el inicio de la sesión.
  - Se elimina la herramienta intermedia `web_enable` y las mutaciones dinámicas de tools mid-conversation que causaban fallos `400: Upstream request failed` con modelos como `kimi-k3`.
- **Aprovisionamiento Aditivo y Soberanía de Paquetes en `pi-studio`**:
  - Eliminado el filtro restrictivo que purgaba paquetes del usuario (`cleanPackages = packages.filter(...)`). Ahora `pi-studio` opera bajo aprovisionamiento **estrictamente aditivo**: asegura que `pi-game-studio` y las utilidades esenciales (`pi-web-access`, `pi-antigravity`, `pi-btw`) estén presentes, pero respeta y preserva íntegramente cualquier paquete, tema o extensión que el usuario configure.
  - Herencia de preferencias base: si el perfil de estudio no existe, hereda temas, modelos y configuraciones del entorno base de Pi (`~/.pi/agent/settings.json`) de forma transparente.
- **Registro Defensivo de Herramientas (*Graceful Tool Coexistence*)**:
  - `studio-choice.ts` y `studio-subagents.ts` verifican la existencia previa de herramientas (`ask_user_question`, `subagent_run`, `subagent_list`, `subagent_status`, `subagent_result`) mediante `hasTool` y `getAllTools()`, envolviendo los registros en bloques seguros `try/catch` para evitar fallos de arranque en caso de colisiones en el runtime de Pi.
- **Riel Lateral TUI Desacoplado y Libre de Duplicación (Opción B)**:
  - Tarjeta `◈ System` ultra compacta (5 líneas), especializada exclusivamente en Proyecto (Título y ruta), Motor e Hito, y estado de Memoria (`Memory · ✓ conectado`).
  - Eliminada la duplicación de `Model` y `Context Gauge` en la tarjeta lateral, manteniéndolos en su posición canónica en la barra inferior.
  - Tarjeta `▶ Tasks [fase] · X of Y` con el chip de fase ODD en su cabecera y el siguiente paso sugerido (`→ Siguiente: ...`) al pie.
  - Incorporado soporte de estado inicial (*empty state*) elegante cuando no hay tareas activas (`0 tareas`), mostrando `○ Sin tareas activas (/concept o /spec)` en lugar de desaparecer.
- **Erradicación de Íconos de Gentle Shell**:
  - Reemplazados los íconos florales heredados (`✿`, `❀`) por glifos sobrios de ingeniería y desarrollo de videojuegos (`◈ System`, `▶ Tasks`, `◈ INSPECTOR`, `◈ TIMELINE`, `◈ ESTIMATED BUDGET`).
- **Corrección de Rebote de Colapso por Mouse (`press` + `click`)**:
  - Incorporado guard de debounce de 250ms en `studio-sidebar.ts` para evitar la re-apertura inmediata en un solo clic físico.
- **Barra Inferior Minimalista y Responsive**:
  - Rediseñada la telemetría del footer (`renderStudioFooterBar`), eliminando texto repetitivo burocrático (`Motor:`, `Hito:`, `Sprint: Sprint Activo`, `Modelo:`, `Context:`) y reduciendo el ancho de 155 caracteres a ~38 caracteres (`▎ <Engine> · <Model> · [<Gauge>] <Percent>%`).
- **Banner de Bienvenida y Mascota GameBot**:
  - Rediseñado el arte Braille de `banner.ts` con la mascota **GameBot** de 11 líneas simétricas emparejadas 1 a 1 con la tabla de metadatos.
  - Alineado el banner al margen izquierdo con 2 espacios fijos (`padStr = "  "`), eliminando la sangría de 80+ columnas en pantallas anchas.

---

## [1.9.0] - 2026-10-17

### Added
- **Launcher Oficial CLI Aislado (`pi-studio`)**:
  - Nuevo comando ejecutable `pi-studio` (`bin/pi-studio.mjs` registrado en `bin` de `package.json`), diseñado para iniciar sesiones de Pi en un entorno completamente aislado (`~/.pi/game-studio/agent`).
  - **Aislamiento Total respecto a Gentle Shell**: Filtro estricto en el launcher que excluye `gentle-pi`, `gentle-engram` y variables de entorno conflictivas (`GENTLE_PI_CONFIG_HOME`, `GENTLE_PI_AGENT_HOME`, etc.), garantizando que la sesión cargue exclusivamente los 9 agentes gamedev del estudio (8 Core + 1 Motor activo).
  - **Auto-Aprovisionamiento de Paquetes Auxiliares Limpios**: Configuración automática de herramientas libres de agentes ajenos: `pi-web-access` (búsqueda web de documentación y APIs para directores y especialistas), `pi-antigravity` (soporte de proveedores Google Antigravity y Gemini) y `pi-btw` (atajos de teclado y ayuda en UI).
  - **Compartición Automática de Credenciales y Confianza**: Enlaza dinámicamente `auth.json`, `models-store.json`, `trust.json` y `keybindings.json` desde el perfil principal de Pi, evitando que el desarrollador deba re-autenticar proveedores o volver a aprobar directorios de confianza.
  - **Auto-Limpieza de Skills Redundantes**: Rutina en `extensions/hooks/studio-setup.ts` (`/studio:setup` y `/setup`) que purga copias locales heredadas en `.pi/skills/` para evitar colisiones y advertencias en Pi, sirviendo las skills ODD directamente desde el manifiesto del paquete.
  - **Soporte de Aislamiento Automático por Carpeta**: Configuración documentada para `mise` (`mise.toml`) que activa el perfil de forma transparente al entrar a carpetas de juegos.

---

## [1.8.2] - 2026-10-14

### Added
- **Soporte Oficial de Phaser 3/4 y Especialista de Motor (`phaser-specialist`)**:
  - **Nuevo Engine Specialist (`phaser-specialist`)**: Especialista dedicado para desarrollo moderno de videojuegos web con Phaser 3/4 (TypeScript, WebGL/Canvas, físicas Arcade y Matter.js, y empaquetado con Vite).
  - **Starter Web 2D (`starters/phaser-web-2d`)**: Plantilla oficial lista para jugar con TypeScript estricto, Vite HMR, inicialización procedural en `BootScene` y control responsivo de Arcade Physics en `GameScene`.
  - **6 Opciones de Motores en `/studio:setup` y `/studio:new`**: Integración completa de Phaser como 6º motor soportado (Bevy, Godot 4, Phaser, Raylib, Unity, Unreal Engine 5), manteniendo la arquitectura 8+1 (9 agentes activos por proyecto) y ampliando el catálogo a 14 plantillas en `agents/`.
  - **Simetría Completa en Skills ODD y Herramientas CLI**:
    - Skills del ciclo ODD (`arch`, `code`, `test`) con directivas y patrones idiomáticos para Phaser y Web Audio API.
    - Soporte integrado en `/studio:scaffold` (generación de sandbox interactivo 2D para Phaser con Arcade Physics).
    - Soporte en `/studio:watch` (compilación y recarga en caliente con Vite/TypeScript).
    - Soporte en `/studio:game-feel` (snippets de coyote time, jump buffering, variable jump, inercia y feedback visual para Phaser/TypeScript).
    - Soporte en `/studio:audio-bus` (scaffolding de `PhaserBusManager` con Web Audio API y ducking sidechain).
    - Soporte en `/studio:doctor` (auditoría de runtime Node.js/npm para desarrollo web).
    - Detección automática en tiempo de ejecución en `engine-detector.ts` ante proyectos con dependencia `phaser`.

---

## [1.8.1] - 2026-10-14

### Added
- **Mascota Oficial del Estudio ("Pibot") y Banner Panorámico de Consola**:
  - Incorporada la mascota oficial **Pibot**: el droide asistente de cabina gamedev con chasis cerámico/grafito, corona $\pi$ luminosa, D-pad en el pecho y gamepad holográfico (`docs/assets/mascot.png`).
  - Nuevo banner panorámico oficial para la consola de desarrollo y vista previa social (`docs/assets/pibot-banner.png` y `docs/assets/social-preview.png`) con puente de mando gamedev, wireframes holográficos 3D y telemetría de motor.
  - Actualizado el campo `image` del paquete en `package.json` hacia la nueva mascota oficial.
- **Banner TUI Adaptativo para Terminales Estándar (80 columnas)**:
  - Soporte de renderizado centrado y apilado del isotipo nórdico/Braille en terminales de 55 a 103 columnas, garantizando que el logo nunca se oculte en terminales estándar de 80 columnas o paneles divididos.
- **Inteligencia Comercial y Gobernanza Financiera del Productor**:
  - Incorporada la sección `Market Intelligence & Commercial Governance (Steam Strategy)` en las directivas de sistema de `producer.md`.
  - Integrado el **Método Multiplicador de Boxleiter** en `/market` para estimar automáticamente copias vendidas y facturación neta de los competidores (`Reviews * 30-50x`, comisiones de Valve -30%, retenciones fiscales -20%, reembolsos -10% y precios regionales -8%).
  - Nuevo bloque de **Análisis Financiero y Reglas del Productor** en el reporte de `/market`:
    - Presupuesto temporal máximo de desarrollo en meses para 1 dev según saturación.
    - Metas críticas de wishlists (barrera de 7.000 a 10.000 antes del lanzamiento para 'Popular Upcoming').
    - Veto de Scope Preventivo (*Ruthless Descoping*) contra features trampas que destruyen el ROI (multijugador no presupuestado, mundos abiertos desmedidos o bloat procedural).

---

## [1.8.0] - 2026-10-14

### Added
- **Suite de Inteligencia de Mercado y Validación Implacable en Steam (`/market`)**:
  - Comando `/market` (alias `/studio:market`) conectado directamente a la API oficial de búsqueda y catálogo de Steam (`storesearch`, `appdetails` y `appreviews`).
  - Métrica de saturación del género en vivo con volumen real de competencia indexada (>1.000+ juegos en géneros saturados).
  - Matriz comparativa de competidores directos con AppID, precio en USD, recuento de reseñas, rating de la comunidad y enlaces directos a la tienda de Steam.
  - Veredicto de producción sin rodeos (`RECHAZADO: CEMENTERIO DE STEAM`, `PIVOTE OBLIGATORIO`, `LUZ VERDE`).
  - Diagnóstico "Cero Filtro" del Creative Director y Producer: crítica despiadada de tropos gastados y gancho mecánico diferenciador (USP) indispensable para la viabilidad comercial.
- **Suite Pro de Herramientas de Desarrollo y Calidad Comercial**:
  - **`/scaffold` (o `/studio:scaffold`)**: Generador instantáneo de sandbox jugable según motor activo (Godot 4, Bevy, Raylib) y dimensión (`2D` o `3D`), con protección contra sobreescritura accidental.
  - **`/game-feel` (o `/studio:game-feel`)**: Auditor estático de código para los 5 pilares de respuesta de control (*Coyote Time*, *Jump Buffering*, *Salto Variable/Jump Cut*, *Aceleración/Inercia* y *Game Juice/Screen Shake*), con generadores de snippets listos para copiar adaptados al lenguaje del motor (GDScript, Rust, C++, C#).
  - **`/capsule-check` (o `/studio:capsule`)**: Validador de portadas y assets de marketing contra las 5 resoluciones oficiales de Steamworks (Header 460x215, Small Capsule 231x87 crítica para CTR, Main 616x353, Vertical 374x448, Hero 1920x620) con simulación de reducción de escala y contraste vía ImageMagick.
  - **`/steam-page` (o `/studio:steam-page`)**: Generador de ficha oficial de Steamworks en BBCode (`[h2]`, `[b]`, `[list]`) a partir de `design/gdd/concept.md`, con Short Description (<300 chars) y lista de features de alta conversión exportada a `production/steam_store_page.md`.
  - **`/audio-bus` (o `/studio:audio-bus`)**: Scaffolding de jerarquía de audio profesional con buses Master, Music (-3dB con ducking), SFX, Voice (disparador del sidechain), UI y Ambient (-4dB), con formatos nativos para Godot 4 (`default_bus_layout.tres` con compresor sidechain), Bevy y Raylib.
- **Integración con la Paleta Interactiva**:
  - Todos los nuevos comandos agregados a `STUDIO_COMMAND_REGISTRY` en `extensions/hooks/studio-palette.ts`, accesibles mediante búsqueda difusa en `Alt+K` o `/palette`.

---

## [1.7.0] - 2026-10-14

### Added
- **Detección y Especialización Dinámica de Pipelines 2D y 3D**:
  - Función heurística `detectDimensionFromText` para inferir automáticamente la dimensión del juego (`2d` vs `3d`) a partir de la intención del usuario en lenguaje natural.
  - Nuevo paso interactivo de selección de dimensión en `/studio:setup` (`Paso 2/4: 2D vs 3D`).
  - Persistencia formal del campo `dimension: "2d" | "3d"` en `project.yaml` y en los metadatos de producción `<!-- PRODUCER_STATE -->` de `production/roadmap.md`.
  - Directivas especializadas en los prompts de sistema de los 9 agentes del estudio (`studio-agents-runner.ts` e `index.ts`):
    - **Pipeline 2D**: prioriza `free-tex-packer-cli`, `oxipng`, `pngquant`, `TileMaps` y física de sprites.
    - **Pipeline 3D**: prioriza `gltf-transform inspect` para auditar presupuestos de polígonos/draw calls, `gltfpack` para compresión GPU y metodología de arquitectura **Graybox CSG -> Kits Modulares en Grilla**.
- **Modernización y Poda del Toolchain FOSS CLI (`MEDIA_TOOLS_REGISTRY`)**:
  - Incorporado **`gltf-transform`** (`@gltf-transform/cli`): Diagnóstico e inspección de modelos 3D directamente en terminal (`gltf-transform inspect`), dando a los agentes "ojos 3D" en modo headless.
  - Incorporado **`gltfpack`** (`meshoptimizer`): Optimización extrema de mallas glTF/GLB para GPU, generación de LODs y compresión de vertex cache (`meshopt`).
  - Incorporado **`free-tex-packer-cli`**: Empaquetado algorítmico MaxRects de spritesheets 2D con recorte de transparencias y exportación de metadatos de coordenadas para Godot, Raylib y JSON genérico.
  - Incorporado **`pngquant`**: Cuantización lossy a 8-bit con canal alfa para texturas PBR y UI, reduciendo hasta un 70% de VRAM antes del pase lossless de `oxipng`.
  - Documentada la matriz y guía de herramientas en `docs/architecture/mcp-ecosystem.md`.

### Removed
- **Eliminación de Herramientas Obsoletas y Sobredimensionadas**:
  - Removido `blender` (headless) del registro obligatorio de herramientas CLI, eliminando más de 1 GB de peso en disco y reduciendo tiempos de setup.
  - Removido `sox` en favor de la normalización por `ffmpeg` y los buses de audio DSP nativos en runtime del motor.
  - Purgadas referencias residuales a SoX en `/studio:start`, `/studio:setup` y `/studio:tools`.

---

## [1.6.0] - 2026-10-13

### Added
- **Identidad Soberana de Consola de Motor (Gamedev Console & TUI)**:
  - Header de subagentes renovado con **`◈ ENGINE DISPATCH`**, badges de telemetría de consola (`● COMPILANDO`, `▲ OK`, `■ BLOQUEADO`, `○ EN COLA`), barra lateral sólida `▌` y etiquetas de motor por especialista (`[Bevy]`, `[Godot]`, `[Raylib]`, `[Unity]`, `[Unreal]`).
  - Visor interactivo split-screen para subagentes con logs en vivo y atajos (`↑/↓`, `Esc`, `c`).
  - Chips reactivos de fase ODD en HUD y banner: `[concept 1/6]` a `[ship 6/6]`.
  - Cuestionarios en pestañas con indicadores paso a paso `[ 1. Motor* ]  [ 2. Género ]`.
- **Gamedev Fuzzy Command Palette (`Alt+K` / `/palette` / `/studio:commands`)**:
  - Paleta difusa flotante con 31 comandos categorizados (`ODD Pipeline`, `Engine & Dev Tools`, `Studio & Models`, `Media & MCP`).
  - Algoritmo de ranking difuso con bonus por separadores, prefijos, mayúsculas y adyacencia.
  - Navegación con flechas, ciclado de categorías con `Tab` / `Shift+Tab` y ejecución instantánea con `Enter`.
- **Blindaje de Motor y Control de Emergencia**:
  - **Double-Escape Panic Button**: `Esc x 2` en $\le 1000$ms aborta de inmediato todos los subagentes colgados (`cancelAll`) con `SIGTERM` limpio y alerta sonora retro, permitiendo que el primer `Esc` cierre modales normalmente.
  - **Destructive Command Guard**: Intercepta comandos de shell peligrosos (`git reset --hard`, `git clean -fd`, `rm -rf`, `dd`, `format`) sobre carpetas clave del juego (`src/`, `assets/`, `design/`).
  - **Bounded Edit Surfaces Guard**: Aplica las restricciones de `## Allowed edit surfaces` en herramientas de escritura/edición para evitar mutaciones no autorizadas entre disciplinas.
- **Herramientas Avanzadas de Gamedev**:
  - **Performance & Allocation Guard (`/perf-guard`)**: Escanea código en Rust, GDScript, C++ y C# detectando allocations en caliente en bucles de frame (`.clone()`, `Box::new`, `malloc`, `new`, `Vec::new`) y llamadas bloqueantes a I/O.
  - **Live Engine Hot-Reload & Watcher (`/watch`)**: Compilación automática en segundo plano para Bevy (`cargo check`), Godot (`headless`) y Raylib (`cmake`) con telemetría de tiempos y warnings.
  - **Asset Pipeline Inspector (`/assets`)**: Auditoría de compresión PNG con `oxipng`, presupuestos de peso para modelos 3D y detección de placeholders en `assets/manifest.yaml`.
  - **Sintetizador Chiptune de 8-Bits (`/sound`)**: Audio PCM procedural nativo sin dependencias externas (arpegio de moneda ascendente, daño retro descendente y blip de menú arcade).
  - **Modo Game Jam (`/jam`)**: Modo de prototipado rápido de 48h que silencia confirmaciones innecesarias y convierte alertas estrictas de performance en advertencias suaves.
  - **Studio Token & Cost Tracker (`/budget`)**: Medición precisa de tokens por disciplina (Directores, Diseñadores, Especialistas) con estimación de costos en USD y barras ASCII.
  - **Production Timeline & Lore (`/timeline`)**: Visor interactivo split-screen que unifica hitos de `production/roadmap.md`, ADRs de arquitectura y Live Specs de diseño.
- **Visor Interactivo de Cambios Git (`/changes`)**:
  - Modal interactivo con estadísticas de líneas `+X -Y` e inspección de diffs unificados.

---

## [1.5.2] - 2026-10-13

### Added
- **Homologación Integral de la Dotación Oficial 8+1 (13 Agentes)**:
  - **Tier 1 (Directores)**: `producer`, `creative-director` y `technical-director` homologados con roster idéntico de 9 herramientas, `thinking: high`, y adopción explícita de `ask_user_question` para el patrón interactivo `Explain → Capture`.
  - **Tier 2 (Leads & Core Devs)**: `game-designer`, `gameplay-programmer`, `art-director`, `audio-director` y `qa-lead` sincronizados con `web_search` y `ask_user_question`, incorporando menús interactivos de decisión estructurada.
  - **Tier 3 (Especialistas de Motor)**: `bevy-specialist`, `godot-specialist`, `raylib-specialist`, `unity-specialist` y `unreal-specialist` habilitados como implementadores idiomáticos directos de motor, con inclusión canónica del bloque de código YAML de `Return Contract` y herramienta interactiva `ask_user_question`.
- **Pipeline de 6 Skills ODD (`skills/`)**:
  - Declaración explícita del Lead Role Owner (8+1) en las cabeceras de `concept` (`creative-director`), `spec` (`game-designer`), `arch` (`technical-director`), `code` (`gameplay-programmer` + motor), `test` (`qa-lead`) y `ship` (`producer` + `qa-lead`).
  - Vinculación explícita al contrato maestro `skills/_shared/odd-contract.md` en todas las fases.
  - Inclusión de `ask_user_question` en `skills/code/SKILL.md`.

### Fixed
- **Producer como Orquestador Interactivo en Sesión Padre**:
  - Corrección de fuga de responsabilidades en `chains/narrative-flow.chain.md` (extracción de strings delegada a `game-designer`; `producer` enfocado en compuerta `[PR-SCOPE]`).
  - Parser resiliente y bilingüe para `<!-- PRODUCER_STATE -->` en `extensions/hooks/studio-start.ts` (`Juego`/`Game`, `Hito Actual`/`Milestone`, `Sprint Activo`/`Sprint`, `En Progreso`/`In Progress`, `Siguiente Paso`/`Next Step`).
- **Eliminación de Auto-Parálisis y Sub-especialistas Fantasma**:
  - Removida la prohibición de escribir código en `godot-specialist`, `unity-specialist` y `unreal-specialist`.
  - Purgadas referencias a sub-especialistas inexistentes y al falso "Task tool".
  - Completada la sección de restricciones negativas en `raylib-specialist`.
  - Purgados roles retirados (`lead-programmer`, `systems-designer`, `sound-designer`, `devops-engineer`, etc.) en `extensions/hooks/studio-mcp.ts` y `studio-models.ts`.
  - Corregida la numeración duplicada en `skills/ship/SKILL.md`.

---

## [1.5.1] - 2026-10-12

### Added
- **Unificación de Herramientas de Pregunta Interactiva (`ask_user_question`)**:
  - Homologación de herramientas interactivas en una única herramienta canónica `ask_user_question`, soportando preguntas individuales, cuestionarios en lote (hasta 4 preguntas) y respuesta libre por defecto.
  - Removida la herramienta redundante `ask_user_choice`.
  - Homologadas las 6 cadenas multi-agente en `chains/` a los 8 roles Core.
  - Limpieza del catálogo de tests huérfano `skills/test-catalog.yaml`.

---

### Added
- **Hub Interactivo de Servidores MCP (`/studio:mcp` y `extensions/hooks/studio-mcp.ts`)**:
  - Soporte y registro nativo para **10 servidores MCP especializados** bajo la filosofía *"Files First, MCP Accelerated"*: REA MCP (ingeniería inversa de WebAssembly, JS y binarios con `morluto/rea`), Playwright MCP (testing visual y WebGL), Context7 MCP (APIs oficiales de Bevy/Godot/Raylib), Codegraph MCP (árbol AST y grafos de dependencias), SQLite MCP (balance y economía de tablas), Knowledge Vector DB MCP (Lore y biblia narrativa), Blender MCP (3D y colisiones con Python), Image Gen MCP (sprites y texturas), Audio/SFX MCP (síntesis procedural y voces) y Live Engine MCPs (Bevy BRP, Godot y Unreal en caliente).
  - Presets en 1 clic: *Preset Rápido* (REA + Context7 + Codegraph), *Preset Completo* (10 MCPs) y menú interactivo de gestión por proyecto en `.pi/mcp.json`.
- **Diagnóstico de Viabilidad Multimedia e Instalador FOSS CLI (`/studio:tools` y `extensions/hooks/studio-media-tools.ts`)**:
  - Diagnóstico interactivo e instalación guiada con Homebrew para 11 herramientas esenciales de terminal: **FFmpeg** (audio/video y compresión), **ImageMagick** (empaquetado de spritesheets y atlas), **Assimp** (conversión ultra rápida de modelos 3D a `.glb`), **Git LFS** (gestión de assets pesados sin inflar Git), **SoX** (efectos y filtros de audio), **Blender** (mallas de colisión y exportación Python headless), **oxipng** (optimizador multihilo sin pérdida para sprites PNG), **wasm-opt** (Binaryen; optimizador de bytecode WASM para builds web ultralivianas), **butler** (Itch.io CLI para publicación delta), **gh** (GitHub CLI para PRs, workflows y releases con binarios adjuntos) y **watchexec** (live-reload y recompilación en caliente ante cambios de código).
  - Integrado de forma transparente en `/start`, `/studio:setup` (Paso 4) y `/studio:doctor`.

### Changed
- **Homologación 100% Dual-Mode ODD en Agentes y Subagentes**:
  - Los agentes operan de forma dual: interactivos en chat directo con el usuario, pero **100% autónomos** cuando son delegados vía `subagent_run`, eliminando pausas conversacionales o bloqueos de aprobación.
  - Watchdog de background adaptativo con timeout por defecto de 900s (15 min) configurable vía `timeout_seconds`.
  - Herencia dinámica del modelo activo de la sesión del padre para subagentes con `model: inherit`.
  - Cierre ordenado y graceful shutdown tras `agent_settled`.
- **Purga de Roles Obsoletos y Homologación Compacta Oficial a 13 Agentes**:
  - Eliminados los 42 archivos de especialistas obsoletos de `agents/`.
  - La biblioteca oficial queda fijada estrictamente en **13 agentes** (8 Core esenciales + 5 especialistas principales de motor: Bevy, Godot, Raylib, Unity, Unreal).
  - Actualizados `scripts/assign-models.js`, `studio-agents.ts`, `AGENTS.md`, `README.md` y la suite completa de pruebas de Jest (9 suites, 98 tests en verde).

---

## [1.4.0] - 2026-10-09

### Added
- **Live Performance & Budget Tracker HUD (`/studio:profile`)**: Monitor de telemetría in-terminal para comprobar el cumplimiento de presupuestos técnicos (Target FPS, 16.6ms frame budget, RSS Memory MB). Integrado con el pie de estado TUI de Pi mostrando alertas visuales en vivo (`⚡ 60fps (48MB)`).
- **Audio Synthesizer & Shader Palette Studio (`/studio:sfx`, `/studio:palettes` y `scripts/synth-studio.js`)**:
  - Sintetizador procedural de audio WAV en Node.js puro compatible con formas de onda sine, square, saw y noise con curvas de envolvente ADSR y frequency sweeps.
  - Generador de paletas retro (Pico-8, Cyberpunk, GameBoy, Solarized) y exportador automático de shaders cuantizadores para Godot (`.gdshader`) y Raylib C++ (`.fs`).

---

## [1.3.0] - 2026-10-09

### Added
- **One-Click WebAssembly Build & Dev Server (`/studio:web`)**: Nuevo comando de estudio y scripts npm (`npm run build:web`, `npm run serve:web`) con compilación unificada para Bevy (`wasm-bindgen`), Raylib (`emscripten`) y Godot 4 (export headless).
- **Servidor HTTP con Aislamiento Cross-Origin (`scripts/serve-web.js`)**: Servidor local ligero sin dependencias que inyecta cabeceras `Cross-Origin-Opener-Policy: same-origin` y `Cross-Origin-Embedder-Policy: require-corp` para habilitar `SharedArrayBuffer` y multithreading WebAssembly en navegadores modernos.
- **Plantillas CI/CD de GitHub Actions (`templates/.github/workflows/gamedev-ci.yml`)**: Workflow estándar para repositorios gamedev que automatiza la suite de tests, generación de placeholders, soak testing de memoria de 60s, compilación Web/WASM y despliegue a GitHub Pages en ramas principales.

---

## [1.2.1] - 2026-10-05

### Added
- **Starters Zero-Day Compliant con los 10 Estándares**: Los 5 starters de motor (Godot 4, Bevy 2D, Raylib C++, Unity 2D, Unreal Engine 5) ahora incluyen de fábrica la máquina de estados con menú de pausa, overlay de telemetría `F3` / `~`, action mapping dual simultáneo (Gamepad + Teclado), jerarquía de buses de audio y manifiestos de assets.
- **Auditoría Integral de Proyecto ODD en `/studio:doctor`**: Expansión del comando de diagnóstico para verificar no solo compiladores locales y toolchains en `$PATH`, sino la integridad del árbol de carpetas ODD (`design/gdd/`, `production/roadmap.md`, `production/qa/bugs.md`) y el recuento de placeholders vs assets finales en `assets/manifest.yaml`. Formato TUI sobrio sin emojis.
- **Runner Headless de Soak Testing (`scripts/soak-test.sh` y `npm run test:soak`)**: Monitoreo de memoria RSS en tiempo real cada 2s para detectar fugas de memoria y validar estabilidad en pruebas de 60 segundos.
- **Generador Procedural de Placeholders (`scripts/generate-placeholders.js` y `npm run assets:placeholders`)**: Generación procedural en Node.js puro de audio WAV (16-bit PCM mono 44.1kHz para saltos, golpes, monedas, láser y explosiones) y texturas BMP (checkered/UV de 32x32 y 64x64), con auto-registro en `assets/manifest.yaml`.
- **Plantilla Oficial de QA Bug Triage (`templates/production/qa/bugs.md`)**: Inicialización automática en `/studio:setup` y resolución definitiva de advertencias de referencias cruzadas en el pipeline de testing.

---

## [1.2.0] - 2026-10-04

### Added
- **Visor en Vivo de Subagentes (`/studio:subagents` y `/studio:logs`)**: Nuevo inspector interactivo a pantalla completa para visualizar en tiempo real la ejecución, herramientas invocadas (`bash`, `write`, `edit`), progreso y entrega final de cualquier especialista aislado.
- **Acceso Rápido en Widget de Actividad**: Inclusión del acceso directo interactivo `[ver: /studio:subagents]` en el pie del widget flotante de subagentes en la terminal TUI.
- **Buffer de Streaming de Logs**: Captura activa y buffer circular de logs por especialista en `studio-agents-runner.ts`.

---

## [1.0.0] - 2026-10-03

### Changed
- **Arquitectura Compacta 8+1**: Se consolida la dotación activa a **8 roles Core esenciales + 1 Especialista de motor** (`9 agentes activos` por proyecto), dejando atrás el catálogo de 55 agentes dispersos para una experiencia de desarrollo enfocada y ágil.
- **Optimización de Ejecución de Agentes**: Subprocesos de inferencia rápidos con presupuesto de razonamiento calibrado (`medium`/`low`), eliminación de herramientas pesadas innecesarias (`web_search`) en directores creativos y de arte.
- **Validación Inline en Skills**: La fase 4 de `/brainstorm` (evaluación de pilares y ancla visual) ahora evalúa en línea durante la conversación, evitando retardos de 30-45s y llamadas asíncronas pesadas en el chat.

### Fixed
- **RPC Hang en `studio-agents-runner.ts`**: Cierre inmediato de `stdin` al recibir `agent_settled`, permitiendo que el subproceso hijo de Pi finalice limpiamente en milisegundos sin depender del watchdog de timeout.
- **Cero Bleed en UI**: Eliminada la impresión accidental de sintaxis de llamadas de herramientas o modales de fallback ("modo lean") en el chat de usuario.

---

## [0.9.3] - 2026-10-03

### Documentation
- Integrado el banner oficial de la terminal TUI con tipografía editorial y emblema Braille en el `README.md` principal de GitHub.
- Sincronizados los assets visuales de GitHub Social Preview (`docs/assets/social-preview.png`).

---

## [0.9.2] - 2026-10-03

### Added
- Implementado el nuevo emblema Braille de alta resolución del $\pi$ D-Pad en el banner TUI (`extensions/hooks/banner.ts`).
- Incorporada la tipografía editorial limpia (`P I   G A M E   S T U D I O`) con métricas tabuladas a 11 caracteres y degradado *Glacial Cyan* a *Midnight Amethyst*.

---

## [0.9.1] - 2026-10-03

### Fixed
- Corregido `ParseError: Unexpected token` en `extensions/hooks/index.ts` eliminando bloque sintáctico residual que impedía la carga de extensiones en Pi.
- Actualizada la rama predeterminada oficial de `master` a `main` tanto localmente como en GitHub.

---

## [0.9.0] - 2026-10-01

### Added
- 4 new studio execution chains (`audio-production.chain.md`, `level-pipeline.chain.md`, `narrative-flow.chain.md`, `perf-audit.chain.md`).
- Full 5-engine starter suite (added Unity 2D Platformer & Unreal Engine 5 Third Person).
- Complete engine reference documentation for Godot, Raylib, Unity, and Unreal.
- Comprehensive cross-reference and script test suites.

### Changed
- Native subagent execution of multi-agent chains (`executeChain`).

### Fixed
- Full CI/CD repairs (`validate.yml`).
- Script bug fixes (`assign-models.js`, `yaml-helper.sh`).

---

## [0.8.29] - 2026-09-30

### Changed
- **Sober TUI Cleanups (Zero Decorative Emojis in Status Card)**:
  - Eliminados los emojis decorativos (`🧠`, `🤖`, `📊`) de la sección de Integraciones en la tarjeta `Status`.
  - Reemplazados por etiquetas de texto limpias y sobrias (`Memory`, `Model`, `Context`) conforme a las reglas de estilo y sobriedad de Gentle Shell / Pi Game Studio.

---

## [0.8.28] - 2026-09-30

### Changed
- **Sidebar Rail Positioned on the Right Side (Gentle Shell Parity)**:
  - Se alineó el orden de las entradas en `hstackHost` con la arquitectura oficial de Gentle Shell: el transcript/chat se mantiene en el área principal de la izquierda (`entries[0]`, grow: 1) y el panel lateral de `Status` y `Tasks` se ubica en el carril derecho (`entries[1]`, basis: 50).
  - Actualizados comentarios y sincronización del widget para reflejar la orientación en el carril derecho.

---

## [0.8.27] - 2026-09-30

### Added
- **Default Fullscreen TUI Mode (`tuiMode: "fullscreen"`)**:
  - Al instalar el estudio (`installStudioFiles` / `/studio:setup`) o al iniciar sesión (`session_start`), Pi Game Studio configura automáticamente `"tuiMode": "fullscreen"` en el archivo local `.pi/settings.json` del proyecto.
  - Esto garantiza que el carril lateral izquierdo (*sidebar rail* con `Status` y `Tasks`) aparezca activo de inmediato desde el primer momento en terminales de $\ge$ 140 columnas, sin necesidad de banderas de línea de comando ni configuración manual.

---

## [0.8.26] - 2026-09-30

### Added
- **Fullscreen Left Sidebar Rail (`studio-sidebar.ts`)**:
  - Implementado carril lateral izquierdo nativo inspirado en Gentle Shell (`SIDEBAR_BREAKPOINT = 140` columnas) en modo fullscreen de Pi TUI.
  - Presenta las tarjetas `✿ Status` y `❀ Tasks` en una columna dedicada de 50 columnas con scroll suave (`ScrollView`), manteniendo el transcript/chat en el área principal de la derecha.
  - Supresión automática del widget inferior cuando el sidebar lateral está activo, evitando duplicación en pantalla.
  - Degradación elegante y segura: si la terminal mide menos de 140 columnas o no está en pantalla completa, las tarjetas se muestran apiladas en el dock inferior sobre el prompt.

---

## [0.8.25] - 2026-09-30

### Added
- **Visualización Conjunta de Status + Tareas en Widget TUI**:
  - Incorporada la tarjeta `✿ Status` al widget interactivo acoplado encima del prompt, mostrándose en bloque armónico junto a `❀ Tasks` (Proyecto, Motor, Modelo, Contexto e Integraciones).
  - Estructuración idéntica a la disposición de tarjetas de Gentle Shell.

---

## [0.8.24] - 2026-09-30

### Added
- **Default Local Project Theme (`GameStudio-Gentle`)**:
  - Al inicializar o instalar Pi Game Studio (`installStudioFiles` / `studio-setup.ts`), se configura automáticamente `"theme": "GameStudio-Gentle"` en el archivo local `.pi/settings.json` del proyecto sin alterar la configuración global del usuario.
  - Al iniciar sesión (`session_start`), si el proyecto local carece de tema definido en `.pi/settings.json`, se adopta `GameStudio-Gentle` por defecto.

---

## [0.8.23] - 2026-09-30

### Fixed
- **Hotfix ReferenceError: CYAN is not defined en `renderStudioFooterBar`**:
  - Reemplazada la referencia residual a la constante `CYAN` por `BLUE` en la barra inferior de estado (`studio-hud.ts`).
  - Añadida prueba de regresión unitaria en `__tests__/studio-hud-and-widgets.test.js` para asegurar que no queden referencias a variables de color heredadas no definidas.

---

## [0.8.22] - 2026-09-30

### Added
- **Nuevo Tema `GameStudio-Gentle` y Rediseño de Tarjetas estilo Gentle Shell**:
  - Incorporado el tema oficial `GameStudio-Gentle.json` con la paleta de colores nórdica mate y relajante (`#06080f`, bordes `#313342`, acento azul `#7FB4CA`, salvia `#B7CC85`, ámbar `#DEBA87`, lavanda `#B5B2D0`).
  - Rediseño de la tarjeta de estado `renderStudioStatusCard` (`studio-hud.ts`) con tipografía jerárquica limpia (`Project`, `Engine`, `Integrations / Engram`, `Progress ODD`), glifos sobrios `✿ Status` y bordes sutiles.
  - Rediseño del widget de tareas `renderTasksWidgetCard` (`studio-tasks-widget.ts`) imitando la tarjeta de tareas de Gentle Shell con cabecera `❀ Tasks · X of Y`, estados `✓` (completado), `◐` (en progreso) y `○` (pendiente).

---

## [0.8.21] - 2026-09-30

### Added
- **Custom Free-Text Response en Cuestionarios en Lote (`ask_user_question`)**:
  - Habilitada la opción interactiva `"Otro (escribir respuesta personalizada)..."` de manera automática por defecto en cada pregunta del lote (`allowCustomResponse`).
  - Al seleccionar `"Otro..."` con las teclas de dirección (`↑`/`↓`) y presionar `Enter`, se abre de inmediato el prompt de entrada de texto (`ctx.ui.input`) para redactar una respuesta libre en el TUI.
  - La respuesta libre queda registrada de forma estructurada con bandera `{ custom: true }` y se consolida con el resto de respuestas del lote.

---

## [0.8.16] - 2026-09-29

### Added
- **Punto 9: Sober Curated Command Palette (`/studio:commands`)**:
  - Registro oficial del comando `/studio:commands` en `extensions/hooks/index.ts`.
  - Navegación rápida y búsqueda interactiva por palabras clave o categorías de ingeniería y diseño de videojuegos.
  - Paleta curada y sobria sin emojis, con alias directo `/studio` y `/studio:help`.

---

## [0.8.15] - 2026-09-29

### Added
- **Punto 8: Usage & Tier Quota Monitor (`/studio:models`)**:
  - Estandarización del monitor de asignaciones y presupuesto de razonamiento (*Reasoning Budget*) en `extensions/hooks/studio-models.ts`.
  - Mapeo visible y transparente de los 3 niveles del estudio:
    - Tier 1 (Directores): Thinking `high` (gpt-5.4-mini / arquitectura, visión, triaje).
    - Tier 2 (Workhorses & Leads): Thinking `medium` (gpt-oss-120b / código, mecánicas, testing).
    - Tier 3 (Ligeros & Soporte): Thinking `low` (gpt-oss-20b / ops, comunidad, logs).
  - Eliminación de emojis en los informes de modelos y presentación limpia en caja ASCII.

---

## [0.8.14] - 2026-09-29

### Added
- **Punto 7: Game Engine Native Review Lenses (`/code-review`)**:
  - Reestructuración de la habilidad `code-review` (`skills/code-review/SKILL.md`) bajo las 3 lentes nativas de desarrollo de videojuegos:
    - **Lente 1 (Game Feel & Controls)**: Latencia de input, fluidez, independencia de frame-rate (`delta_time`) y exposición de knobs de balance data-driven.
    - **Lente 2 (Performance & FPS)**: Bucle de cero allocations en hot paths, layout de memoria contigua en caché (Data-Oriented vs OOP scatter), y optimización de shaders/draw calls.
    - **Lente 3 (QA Robustness & Edge Cases)**: Testability de inyección, edge cases de física/red, sincronización y verificación de cero memory leaks (`qa-lead`, `qa-tester`).
  - Purga de emojis decorativos en las cabeceras de la habilidad y estandarización a la plantilla sobria ASCII.

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
