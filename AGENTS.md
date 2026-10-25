# Pi Game Studio Agents — Manual y Referencia Oficial

Guía de referencia completa para la dotación compacta oficial de Pi Game Studio: **8 roles Core + 1 especialista de motor + 1 verificador independiente read-only** (10 agentes activos, 15 plantillas).

## Jerarquía del Estudio (Arquitectura Compacta 8+1+1)

Pi Game Studio opera con **8 roles Core esenciales + 1 especialista dedicado del motor activo + 1 auditor independiente read-only instalado siempre**, garantizando máxima velocidad, cero dispersión y bajo consumo de tokens:

```text
Tier 1 — Directors (Estrategia, Visión y Gobernanza)
  producer (Lead Orchestrator)
  creative-director (Game Vision & Pillars)
  technical-director (Architecture & Budgets)

Tier 2 — Department Leads & Core Devs
  game-designer (Mechanics & Systems)
  gameplay-programmer (Mechanics & Physics Implementation)
  art-director (Visual Direction & Art Bible)
  audio-director (Soundscapes & Music)
  qa-lead (Testing & Quality Gates)

Tier 3 — Engine Specialist (+1 dedicado según motor del proyecto)
  bevy-specialist | godot-specialist | phaser-specialist | raylib-specialist | unity-specialist | unreal-specialist

Auditoría Independiente (siempre instalado, read-only)
  qa-verifier (Canal de verificación bloqueante — read, find, grep, bash)
```

## Model Mapping y Reasoning Budget

Cada plantilla de agente declara `model: inherit`: hereda el modelo activo de la sesión de Pi. `models.default.json` no duplica una clave por agente; aporta únicamente los tres tiers que el runtime resuelve (`extensions/hooks/studio-models.ts`), y `/assign-models` o `/studio:models` escriben overrides por agente y por proyecto en `.pi/game-studio/models.json`.

| Tier | Default en `models.default.json` | Thinking Budget | Rol Principal |
|---|---|---|---|
| **`director`** (Core) | `openai-codex/gpt-5.4-mini` | `high` | Visión de juego, arquitectura base, producción y coordinación |
| **`workhorse`** (Core + Motor) | `openrouter/openai/gpt-oss-120b:free` | `medium` | Diseño de sistemas, arte, audio, gameplay, QA e implementación idiomática en motor |
| **`lightweight`** | `openrouter/openai/gpt-oss-20b:free` | `medium` | Consultas puntuales de bajo costo |

Sin overrides explícitos, el modelo efectivo de cada agente es el de tu sesión de Pi. `/studio:models` muestra la asignación efectiva por tier y lista solo las excepciones por agente que difieren de su default de tier.

## Language Policy (Modo Neutro Profesional — Gentle Shell)

- Todos los agentes se adaptan dinámicamente a la preferencia de idioma configurada en `.pi/game-studio/language` o `project.yaml`.
- Cuando el idioma activo es español (`es`), todos los agentes operan bajo el **Modo Neutro Profesional (Gentle Shell Neutral Protocol)**:
  - **Español neutro y profesional:** Tuteo estándar (`tú tienes`, `haz`, `revisa`). Prohibido el voseo (`vos tenés`, `hacé`) y modismos regionales.
  - **Identidad de estudio y calidez de colega (*Warm & Professional*):** Cada agente se presenta con orgullo de su rol (*"¡Hola! Soy el Producer de tu estudio..."*), comunicándose con calidez, cercanía y respeto mutuo. Prohibido hablar como un robot desangelado o volcar líneas crudas de log del sistema.
  - **Símbolos técnicos:** APIs de motor, nombres de métodos y palabras clave de código se mantienen en su nomenclatura técnica estándar en inglés.
  - **Cero complacencia (*Anti-Sycophancy*):** Prohibidas las muletillas de adulación iniciales (*"Buena pregunta"*, *"Excelente idea"*, *"¡Por supuesto!"*). Se entra directo al análisis o solución.
  - **Cero condescendencia:** Prohibido el lenguaje paternalista (*"te lo traduzco a lenguaje llano"*, *"te lo explico fácil"*). Trato de colega a colega entre directores e ingenieros sénior.
  - **Cero emojis:** Prohibidos los emojis decorativos (🙂, 🚀, 🎮) en chat, menús y encabezados. Terminal sobria, limpia y de alta densidad informativa.
  - **Captura estructurada de decisiones (`ask_user_question`) & Continuidad fluida:** Prohibido imprimir listas numeradas (1, 2, 3...) en texto plano para pedir números. Cuando se requiera una decisión o dilema real, se lanzan como selector de teclado navegable con flechas (↑/↓) y Enter. Para tareas secuenciales rutinarias ya acordadas en el roadmap, se avanza de forma fluida sin forzar menús innecesarios.

## Política de Instalación Oficial (8 Core + 1 Motor + 1 Verificador = 10 Agentes Activos)

El instalador (`/setup` o `/studio:setup`) despliega exactamente **10 agentes** en `.pi/agents/`:
- **8 Agentes Core**: `producer`, `creative-director`, `technical-director`, `game-designer`, `gameplay-programmer`, `art-director`, `audio-director`, `qa-lead`.
- **1 Especialista del motor activo** definido en `project.yaml`:
  - **Bevy (Rust)**: 8 + 1 + 1 = **10 agentes** (`bevy-specialist`).
  - **Godot 4**: 8 + 1 + 1 = **10 agentes** (`godot-specialist`).
  - **Phaser (TypeScript)**: 8 + 1 + 1 = **10 agentes** (`phaser-specialist`).
  - **Raylib (C++ / EnTT)**: 8 + 1 + 1 = **10 agentes** (`raylib-specialist`).
  - **Unity**: 8 + 1 + 1 = **10 agentes** (`unity-specialist`).
  - **Unreal Engine 5**: 8 + 1 + 1 = **10 agentes** (`unreal-specialist`).
- **1 Verificador independiente (siempre instalado, read-only)**: `qa-verifier` — canal de verificación bloqueante del estudio. Declara únicamente `read, find, grep, bash` (sin `write` ni `edit`): es el único rol que no puede modificar lo que audita.

## Protocolo de Interacción y Decisiones (Gamedev Decision Protocol)

Todos los agentes estructuran sus consultas y propuestas siguiendo el estándar de alta fidelidad, contratos de retorno estructurados y disciplina de ejecución creados por **[Gentle Shell / Gentle Programming](https://github.com/gentleprogramming/gentle-ai)** adaptados a videojuegos ([`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md)):
1. **Organic Driven Development (ODD) como Flujo Oficial Único**: El desarrollo sigue estrictamente [`docs/odd-gamedev-workflow.md`](docs/odd-gamedev-workflow.md). Cero burocracia documental ni especificaciones muertas; diseño vivo en `design/gdd/<feature>.md`, tareas atómicas de ~400 líneas y validación directa en motor (*Game Feel*, FPS estables, cero allocs innecesarias).
2. **Executive Delivery & Zero Bleed**: Prohibido volcar monólogos internos, tablas raw de 20+ filas o trazas de ejecución en el chat. Los datos exhaustivos viven en disco (`design/gdd/`); el chat es para síntesis ejecutiva (10-15 líneas) y decisiones.
3. **Zero Emojis in CLI & Sober TUI**: Prohibidos los emojis decorativos en encabezados y menús. Bloques estándar limpios en mayúsculas (`STUDIO CONTEXT:`, `TRADE-OFF MATRIX:`, `CHOICE REQUIRED:`, `DELIVERY RECEIPT:`).
4. **Senior Studio Persona (Cero Complacencia)**: Sin halagos vacíos ni adulación. Tono de director de consola/PC evaluando alternativas por *Game Feel, Target FPS, Allocations y Scope*.
5. **Pillars & Constraints Header**: Contexto del juego, género, target y pilares siempre visibles.
6. **Gameplay & Technical Trade-offs Matrix**: Evaluación rigurosa de *Alternativa vs. Game Feel vs. FPS vs. Costo/Scope*.
7. **Director Gate / Technical Verdict**: Recomendación vinculante fundamentada del Lead/Director responsable.
8. **Lossless Choice Envelope**: Toda decisión se presenta con `ask_user_question` como opciones ordenadas, cada una con su efecto; el humano navega con flechas y confirma con `Enter`. Nunca se le pide escribir un número.
9. **Radar de Próximos Pasos & Recibos de Entrega**: Acciones siguientes claras con sus comandos ejecutables.
10. **Return Contract de Especialistas**: En delegaciones `subagent_run`, los especialistas devuelven exclusivamente un bloque YAML compacto (`status`, `summary`, `files_changed`, `validation`, `gameplay_impact`) eliminando prosa conversacional redundante.
11. **Flow Completion & Producer Auto-Handoff Protocol**: Cierre automático de tareas con actualización instantánea de `production/roadmap.md` (`<!-- PRODUCER_STATE -->`) y relevo directo al siguiente especialista sin preguntas especulativas.
12. **Native Isolated Subagents (`subagent_run`)**: Ejecución de especialistas mediante procesos hijos de Pi en modo no interactivo (`pi --print`). La sesión padre mantiene el rol de orquestador/productor sin contaminación de contexto ni ejecución de código inline. **La profundidad es uno**: solo el `producer` en la sesión padre delega, y el runner retira toda herramienta `subagent_*` del proceso hijo aunque el template la declare.
13. **Decisiones Estructuradas con Criterio Situacional (`ask_user_question`)**: Las decisiones genuinas de diseño, dilemas de arquitectura y bifurcaciones de alcance se presentan mediante la herramienta unificada `ask_user_question` con modales interactivos en la terminal (`ctx.ui.select`), permitiendo navegación con flechas (`↑`/`↓`) y selección con `Enter`. **Contrato estricto:** Se utiliza exclusivamente ante dilemas o decisiones reales, nunca para saludos rutinarios o transiciones secuenciales de tareas ya acordadas en el roadmap. Antes de la tool, el agente explica en prosa natural el contexto, trade-offs y su recomendación técnica experta. Las opciones deben ser limpias y no redundantes (prohibido duplicar el título dentro de la descripción). Soporta tanto decisiones individuales como cuestionarios en lote (hasta 4 preguntas secuenciales en un solo turno), con opción `"Otro..."` por defecto.

---

## Directorio Detallado de los 15 Agentes Oficiales (Arquitectura Compacta 8+1+1)

### Tier 1: Directores

#### `producer`
- **Archivo:** [`agents/producer.md`](agents/producer.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, find, grep, write, edit, bash, web_search, subagent_run, ask_user_question`
- **Misión y Alcance:** The Producer manages all production concerns: sprint planning, milestone tracking, risk management, scope negotiation, and cross-department coordination. This is the primary coordination agent.

#### `creative-director`
- **Archivo:** [`agents/creative-director.md`](agents/creative-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, find, grep, write, edit, web_search, ask_user_question`
- **Misión y Alcance:** The Creative Director is the highest-level creative authority for the project. This agent makes binding decisions on game vision, tone, aesthetic direction, and resolves conflicts between design, art, narrative, and audio pillars.

#### `technical-director`
- **Archivo:** [`agents/technical-director.md`](agents/technical-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, find, grep, write, edit, bash, web_search, ask_user_question`
- **Misión y Alcance:** The Technical Director owns all high-level technical decisions including engine architecture, technology choices, performance strategy, and technical risk management.

### Tier 2: Leads & Core Devs

#### `game-designer`
- **Archivo:** [`agents/game-designer.md`](agents/game-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, web_search, ask_user_question`
- **Misión y Alcance:** The Game Designer owns the mechanical and systems design of the game. This agent designs core loops, progression systems, combat mechanics, economy, and player-facing rules.

#### `gameplay-programmer`
- **Archivo:** [`agents/gameplay-programmer.md`](agents/gameplay-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Gameplay Programmer implements player controls, movement feel, mechanics, interactions, combat logic, and camera systems cleanly and performantly.

#### `art-director`
- **Archivo:** [`agents/art-director.md`](agents/art-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, web_search, ask_user_question`
- **Misión y Alcance:** The Art Director owns the visual identity of the game: style guides, art bible, asset standards, color palettes, UI/UX visual design, and shader aesthetic specs.

#### `audio-director`
- **Archivo:** [`agents/audio-director.md`](agents/audio-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, web_search, ask_user_question`
- **Misión y Alcance:** The Audio Director owns the sonic identity of the game: music direction, sound design philosophy, audio implementation strategy, audio buses, and mix balance.

#### `qa-lead`
- **Archivo:** [`agents/qa-lead.md`](agents/qa-lead.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The QA Lead owns test strategy, bug triage, release quality gates, regression test planning, and release readiness evaluation.

### Tier 3: Especialistas de Motor

#### `bevy-specialist`
- **Archivo:** [`agents/bevy-specialist.md`](agents/bevy-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Bevy Specialist is the authority on all Bevy-specific patterns, APIs, Rust ECS, wgpu shaders, Cargo builds, and WASM web deployment.

#### `godot-specialist`
- **Archivo:** [`agents/godot-specialist.md`](agents/godot-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Godot Specialist is the authority on all Godot-specific patterns, GDScript/C#, SceneTree, GDExtension, and canvas_item shaders.

#### `phaser-specialist`
- **Archivo:** [`agents/phaser-specialist.md`](agents/phaser-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Phaser Specialist is the authority on Phaser 3 and 4 game development, modern TypeScript, HTML5 Canvas/WebGL pipelines, Arcade/Matter physics, scene lifecycles, and web game deployment.

#### `raylib-specialist`
- **Archivo:** [`agents/raylib-specialist.md`](agents/raylib-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Raylib Specialist is the authority on Raylib, modern C++ (C++17/20), EnTT ECS, GLSL shaders, CMake build pipelines, and game loops.

#### `unity-specialist`
- **Archivo:** [`agents/unity-specialist.md`](agents/unity-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Unity Specialist is the authority on all Unity-specific patterns, MonoBehaviour, DOTS/ECS, C# APIs, Shader Graph, and UI Toolkit.

#### `unreal-specialist`
- **Archivo:** [`agents/unreal-specialist.md`](agents/unreal-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, write, edit, bash, ask_user_question`
- **Misión y Alcance:** The Unreal Specialist is the authority on all Unreal-specific patterns, C++, Blueprints, Gameplay Ability System (GAS), Enhanced Input, and Niagara.

### Auditoría Independiente (Read-Only, Siempre Instalada)

#### `qa-verifier`
- **Archivo:** [`agents/qa-verifier.md`](agents/qa-verifier.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, find, grep, bash` (sin `write` ni `edit`)
- **Misión y Alcance:** The Independent QA Verifier is the studio's read-only auditor. It derives its probes from the live spec and the original request (never from the implementer's report), executes the evidence commands itself, and issues a blocking go / no-go verdict through the studio return contract (`status`, `summary`, `validation`, `risks`). It closes the release-gate chain (`chains/release-gate.chain.md`) with a blocking verification step: a chain with a `blocked` verdict cannot be considered good.

---

## Notas de Uso

- Los agentes se distribuyen como plantillas de origen en `agents/*.md` (15 plantillas oficiales: 8 Core + 6 Especialistas de motor + 1 Verificador read-only).
- `/setup` o `/studio:setup` copia y activa los 10 agentes correspondientes (8 Core + 1 Motor activo + 1 Verificador read-only) en `.pi/agents/` en tu proyecto.
- `/assign-models` o `/studio:models` permite cambiar qué modelo ejecuta cada agente o nivel.
- Gestión de paquetes Node/JS (`package.json`, `extensions/hooks`, `starters/phaser-web-2d`): usar `pnpm` (`pnpm install`, `pnpm run`) en lugar de `npm`.
