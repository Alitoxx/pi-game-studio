# Pi Game Studio Agents — Manual y Referencia Oficial

Guía de referencia completa para la dotación compacta oficial **8+1** de Pi Game Studio.

## Jerarquía del Estudio (Arquitectura Compacta 8+1)

Pi Game Studio opera con **8 roles Core esenciales + 1 especialista dedicado del motor activo**, garantizando máxima velocidad, cero dispersión y bajo consumo de tokens:

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
  bevy-specialist | godot-specialist | raylib-specialist | unity-specialist | unreal-specialist
```

## Model Mapping y Reasoning Budget

| Tier | Default model | Thinking Budget | Rol Principal |
|---|---|---|---|
| **Directors & Leads** (Core) | `openai-codex/gpt-5.4-mini` | `medium` | Visión de juego, arquitectura base, diseño y coordinación |
| **Specialist** (Motor) | `openrouter/openai/gpt-oss-120b:free` | `medium` | Implementación idiomática en motor, build y shaders |

## Language Policy

- Todos los agentes se adaptan dinámicamente a la preferencia de idioma configurada en `.pi/game-studio/language` o `project.yaml`.
- Cuando el idioma activo es español (`es`), todos los agentes responden, estructuran opciones, explican trade-offs y conducen el diálogo en **español**. Los símbolos técnicos, APIs de motor y palabras clave de código se mantienen en su nomenclatura estándar.

## Política de Instalación Oficial (8 Core + 1 Motor = 9 Agentes Activos)

El instalador (`/setup` o `/studio:setup`) despliega exactamente **9 agentes** en `.pi/agents/`:
- **8 Agentes Core**: `producer`, `creative-director`, `technical-director`, `game-designer`, `gameplay-programmer`, `art-director`, `audio-director`, `qa-lead`.
- **1 Especialista del motor activo** definido en `project.yaml`:
  - **Bevy (Rust)**: 8 + 1 = **9 agentes** (`bevy-specialist`).
  - **Godot 4**: 8 + 1 = **9 agentes** (`godot-specialist`).
  - **Raylib (C++ / EnTT)**: 8 + 1 = **9 agentes** (`raylib-specialist`).
  - **Unity**: 8 + 1 = **9 agentes** (`unity-specialist`).
  - **Unreal Engine 5**: 8 + 1 = **9 agentes** (`unreal-specialist`).

## Protocolo de Interacción y Decisiones (Gamedev Decision Protocol)

Todos los agentes estructuran sus consultas y propuestas siguiendo el estándar de alta fidelidad inspirado en **Gentle Shell** adaptado a videojuegos ([`docs/gamedev-interaction-protocol.md`](docs/gamedev-interaction-protocol.md)):
1. **Organic Driven Development (ODD) como Flujo Oficial Único**: El desarrollo sigue estrictamente [`docs/odd-gamedev-workflow.md`](docs/odd-gamedev-workflow.md). Cero burocracia documental ni especificaciones muertas; diseño vivo en `design/gdd/<feature>.md`, tareas atómicas de ~400 líneas y validación directa en motor (*Game Feel*, FPS estables, cero allocs innecesarias).
2. **Executive Delivery & Zero Bleed**: Prohibido volcar monólogos internos, tablas raw de 20+ filas o trazas de ejecución en el chat. Los datos exhaustivos viven en disco (`design/gdd/`); el chat es para síntesis ejecutiva (10-15 líneas) y decisiones.
3. **Zero Emojis in CLI & Sober TUI**: Prohibidos los emojis decorativos en encabezados y menús. Bloques estándar limpios en mayúsculas (`STUDIO CONTEXT:`, `TRADE-OFF MATRIX:`, `CHOICE REQUIRED:`, `DELIVERY RECEIPT:`).
4. **Senior Studio Persona (Cero Complacencia)**: Sin halagos vacíos ni adulación. Tono de director de consola/PC evaluando alternativas por *Game Feel, Target FPS, Allocations y Scope*.
5. **Pillars & Constraints Header**: Contexto del juego, género, target y pilares siempre visibles.
6. **Gameplay & Technical Trade-offs Matrix**: Evaluación rigurosa de *Alternativa vs. Game Feel vs. FPS vs. Costo/Scope*.
7. **Director Gate / Technical Verdict**: Recomendación vinculante fundamentada del Lead/Director responsable.
8. **Lossless Choice Envelope**: Menú cerrado, numerado y sin opciones ambiguas ([1], [2], [3]).
9. **Radar de Próximos Pasos & Recibos de Entrega**: Acciones siguientes claras con sus comandos ejecutables.
10. **Return Contract de Especialistas**: En delegaciones `subagent`, los especialistas devuelven exclusivamente un bloque YAML compacto (`status`, `summary`, `files_changed`, `validation`, `gameplay_impact`) eliminando prosa conversacional redundante.
11. **Flow Completion & Producer Auto-Handoff Protocol**: Cierre automático de tareas con actualización instantánea de `production/roadmap.md` (`<!-- PRODUCER_STATE -->`) y relevo directo al siguiente especialista sin preguntas especulativas.
12. **Native Isolated Subagents (`subagent_run`)**: Ejecución de especialistas mediante procesos hijos de Pi en modo no interactivo (`pi --print`). La sesión padre mantiene el rol de orquestador/productor sin contaminación de contexto ni ejecución de código inline.
13. **Menús Nativos, Preguntas en Lote y Respuestas Personalizadas (`ask_user_question`)**: Todas las decisiones, dilemas de diseño y configuraciones se presentan mediante la herramienta unificada `ask_user_question` con modales interactivos en la terminal (`ctx.ui.select`), permitiendo navegación con flechas (`↑`/`↓`) y selección con `Enter`. Soporta tanto decisiones individuales como cuestionarios en lote (hasta 4 preguntas secuenciales en un solo turno). Asimismo, se incluye por defecto la opción `"Otro (escribir respuesta personalizada)..."` que abre un prompt de texto (`ctx.ui.input`) para que el usuario pueda escribir su propia alternativa libremente.

---

## Directorio Detallado de los 13 Agentes Oficiales (Arquitectura Compacta 8+1)

### Tier 1: Directores

#### `producer`
- **Archivo:** [`agents/producer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/producer.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, bash, web_search, subagent, ask_user_question`
- **Misión y Alcance:** The Producer manages all production concerns: sprint planning, milestone tracking, risk management, scope negotiation, and cross-department coordination. This is the primary coordination agent.

#### `creative-director`
- **Archivo:** [`agents/creative-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/creative-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, web_search, subagent, ask_user_question`
- **Misión y Alcance:** The Creative Director is the highest-level creative authority for the project. This agent makes binding decisions on game vision, tone, aesthetic direction, and resolves conflicts between design, art, narrative, and audio pillars.

#### `technical-director`
- **Archivo:** [`agents/technical-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/technical-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, bash, web_search, subagent, ask_user_question`
- **Misión y Alcance:** The Technical Director owns all high-level technical decisions including engine architecture, technology choices, performance strategy, and technical risk management.

### Tier 2: Leads & Core Devs

#### `game-designer`
- **Archivo:** [`agents/game-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/game-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Game Designer owns the mechanical and systems design of the game. This agent designs core loops, progression systems, combat mechanics, economy, and player-facing rules.

#### `gameplay-programmer`
- **Archivo:** [`agents/gameplay-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/gameplay-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Gameplay Programmer implements player controls, movement feel, mechanics, interactions, combat logic, and camera systems cleanly and performantly.

#### `art-director`
- **Archivo:** [`agents/art-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/art-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Art Director owns the visual identity of the game: style guides, art bible, asset standards, color palettes, UI/UX visual design, and shader aesthetic specs.

#### `audio-director`
- **Archivo:** [`agents/audio-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/audio-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Audio Director owns the sonic identity of the game: music direction, sound design philosophy, audio implementation strategy, audio buses, and mix balance.

#### `qa-lead`
- **Archivo:** [`agents/qa-lead.md`](file:///Users/alexis/Developer/pi-game-studio/agents/qa-lead.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The QA Lead owns test strategy, bug triage, release quality gates, regression test planning, and release readiness evaluation.

### Tier 3: Especialistas de Motor

#### `bevy-specialist`
- **Archivo:** [`agents/bevy-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/bevy-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Bevy Specialist is the authority on all Bevy-specific patterns, APIs, Rust ECS, wgpu shaders, Cargo builds, and WASM web deployment.

#### `godot-specialist`
- **Archivo:** [`agents/godot-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Godot Specialist is the authority on all Godot-specific patterns, GDScript/C#, SceneTree, GDExtension, and canvas_item shaders.

#### `raylib-specialist`
- **Archivo:** [`agents/raylib-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib Specialist is the authority on Raylib, modern C++ (C++17/20), EnTT ECS, GLSL shaders, CMake build pipelines, and game loops.

#### `unity-specialist`
- **Archivo:** [`agents/unity-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unity Specialist is the authority on all Unity-specific patterns, MonoBehaviour, DOTS/ECS, C# APIs, Shader Graph, and UI Toolkit.

#### `unreal-specialist`
- **Archivo:** [`agents/unreal-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unreal-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unreal Specialist is the authority on all Unreal-specific patterns, C++, Blueprints, Gameplay Ability System (GAS), Enhanced Input, and Niagara.

---

## Notas de Uso

- Los agentes se distribuyen como plantillas de origen en `agents/*.md` (13 agentes oficiales: 8 Core + 5 Especialistas de motor).
- `/setup` o `/studio:setup` copia y activa los 9 agentes correspondientes (8 Core + 1 Motor activo) en `.pi/agents/` en tu proyecto.
- `/assign-models` o `/studio:models` permite cambiar qué modelo ejecuta cada agente o nivel.
