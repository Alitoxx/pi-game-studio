# Pi Game Studio Agents — Manual y Referencia Oficial

Guía de referencia completa para los **55 agentes especializados** de Pi Game Studio.

## Jerarquía del Estudio

```text
Tier 1 — Directors (Estrategia y Gobernanza)
  creative-director    technical-director    producer

Tier 2 — Department Leads (Gestión de Área y Quality Gates)
  game-designer        lead-programmer       art-director
  audio-director       narrative-director    qa-lead
  release-manager      localization-lead

Tier 3 — Specialists (Implementación, Motores y Operaciones)
  gameplay-programmer  engine-programmer     ai-programmer
  network-programmer   tools-programmer      ui-programmer
  systems-designer     level-designer        economy-designer
  technical-artist     sound-designer        writer
  world-builder        ux-designer           prototyper
  performance-analyst  devops-engineer       analytics-engineer
  security-engineer    qa-tester             accessibility-specialist
  live-ops-designer    community-manager     bevy-specialist
  raylib-specialist    raylib-entt-specialist  raylib-shader-specialist
  raylib-ui-specialist raylib-build-specialist
  godot-specialist     godot-gdscript-specialist  godot-csharp-specialist
  godot-gdextension-specialist  godot-shader-specialist
  unity-specialist     unity-dots-specialist  unity-addressables-specialist
  unity-shader-specialist  unity-ui-specialist
  unreal-specialist    ue-gas-specialist     ue-blueprint-specialist
  ue-replication-specialist   ue-umg-specialist
```

## Model Mapping y Reasoning Budget

| Tier | Default model | Thinking Budget | Rol Principal |
|---|---|---|---|
| **Director** (Tier 1) | `openai-codex/gpt-5.4-mini` | `high` | Visión de juego, arquitectura base, triaje de alcance |
| **Workhorse** (Tier 2-3) | `openrouter/openai/gpt-oss-120b:free` | `medium` | Diseño de mecánicas, programación, arte, testing |
| **Lightweight** (Tier 3) | `openrouter/openai/gpt-oss-20b:free` | `low` | Comunidad, logs, tareas operativas ligeras |

## Language Policy

- Todos los agentes se adaptan dinámicamente a la preferencia de idioma configurada en `.pi/game-studio/language` o `project.yaml`.
- Cuando el idioma activo es español (`es`), todos los agentes responden, estructuran opciones, explican trade-offs y conducen el diálogo en **español**. Los símbolos técnicos, APIs de motor y palabras clave de código se mantienen en su nomenclatura estándar.

---

## Directorio Detallado de los 50 Agentes

### Tier 1: Directores (Estrategia y Visión)

#### `creative-director`
- **Archivo:** [`agents/creative-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/creative-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Creative Director is the highest-level creative authority for the project. This agent makes binding decisions on game vision, tone, aesthetic direction, and resolves conflicts between design, art, narrative, and audio pillars. Use this agent when a decision affects the fundamental identity of the game or when department leads cannot reach consensus.

#### `technical-director`
- **Archivo:** [`agents/technical-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/technical-director.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, bash, web_search`
- **Misión y Alcance:** The Technical Director owns all high-level technical decisions including engine architecture, technology choices, performance strategy, and technical risk management. Use this agent for architecture-level decisions, technology evaluations, cross-system technical conflicts, and when a technical choice will constrain or enable design possibilities.

#### `producer`
- **Archivo:** [`agents/producer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/producer.md)
- **Presupuesto de Razonamiento:** `high` | **Herramientas:** `read, glob, grep, write, edit, bash, web_search`
- **Misión y Alcance:** The Producer manages all production concerns: sprint planning, milestone tracking, risk management, scope negotiation, and cross-department coordination. This is the primary coordination agent. Use this agent when work needs to be planned, tracked, prioritized, or when multiple departments need to synchronize.

### Tier 2: Jefes de Departamento (Leads)

#### `game-designer`
- **Archivo:** [`agents/game-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/game-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Game Designer owns the mechanical and systems design of the game. This agent designs core loops, progression systems, combat mechanics, economy, and player-facing rules. Use this agent for any question about \

#### `lead-programmer`
- **Archivo:** [`agents/lead-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/lead-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Lead Programmer owns code-level architecture, coding standards, code review, and the assignment of programming work to specialist programmers. Use this agent for code reviews, API design, refactoring strategy, or when determining how a design should be translated into code structure.

#### `art-director`
- **Archivo:** [`agents/art-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/art-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Art Director owns the visual identity of the game: style guides, art bible, asset standards, color palettes, UI/UX visual design, and the art production pipeline. Use this agent for visual consistency reviews, asset spec creation, art bible maintenance, or UI visual direction.

#### `audio-director`
- **Archivo:** [`agents/audio-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/audio-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Audio Director owns the sonic identity of the game: music direction, sound design philosophy, audio implementation strategy, and mix balance. Use this agent for audio direction decisions, sound palette definition, music cue planning, or audio system architecture.

#### `narrative-director`
- **Archivo:** [`agents/narrative-director.md`](file:///Users/alexis/Developer/pi-game-studio/agents/narrative-director.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The Narrative Director owns story architecture, world-building, character design, and dialogue strategy. Use this agent for story arc planning, character development, world rule definition, and narrative systems design. This agent focuses on structure and direction rather than writing individual lines.

#### `qa-lead`
- **Archivo:** [`agents/qa-lead.md`](file:///Users/alexis/Developer/pi-game-studio/agents/qa-lead.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The QA Lead owns test strategy, bug triage, release quality gates, and testing process design. Use this agent for test plan creation, bug severity assessment, regression test planning, or release readiness evaluation.

#### `release-manager`
- **Archivo:** [`agents/release-manager.md`](file:///Users/alexis/Developer/pi-game-studio/agents/release-manager.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** Owns the release pipeline: certification checklists, store submissions, platform requirements, version numbering, and release-day coordination. Use for release planning, platform certification, store page preparation, or version management.

#### `localization-lead`
- **Archivo:** [`agents/localization-lead.md`](file:///Users/alexis/Developer/pi-game-studio/agents/localization-lead.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** Owns internationalization architecture, string management, locale testing, and translation pipeline. Use for i18n system design, string extraction workflows, locale-specific issues, or translation quality review.

### Tier 3: Especialistas de Motor — Godot 4

#### `godot-specialist`
- **Archivo:** [`agents/godot-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Godot Engine Specialist is the authority on all Godot-specific patterns, APIs, and optimization techniques. They guide GDScript vs C# vs GDExtension decisions, ensure proper use of Godot

#### `godot-gdscript-specialist`
- **Archivo:** [`agents/godot-gdscript-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-gdscript-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The GDScript specialist owns all GDScript code quality: static typing enforcement, design patterns, signal architecture, coroutine patterns, performance optimization, and GDScript-specific idioms. They ensure clean, typed, and performant GDScript across the project.

#### `godot-csharp-specialist`
- **Archivo:** [`agents/godot-csharp-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-csharp-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Godot C# specialist owns all C# code quality in Godot 4 projects: .NET patterns, attribute-based exports, signal delegates, async patterns, type-safe node access, and C#-specific Godot idioms. They ensure clean, performant, type-safe C# that follows .NET and Godot 4 idioms correctly.

#### `godot-gdextension-specialist`
- **Archivo:** [`agents/godot-gdextension-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-gdextension-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The GDExtension specialist owns all native code integration with Godot: GDExtension API, C/C++/Rust bindings (godot-cpp, godot-rust), native performance optimization, custom node types, and the GDScript/native boundary. They ensure native code integrates cleanly with Godot

#### `godot-shader-specialist`
- **Archivo:** [`agents/godot-shader-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/godot-shader-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Godot Shader specialist owns all Godot rendering customization: Godot shading language, visual shaders, material setup, particle shaders, post-processing, and rendering performance. They ensure visual quality within Godot

### Tier 3: Especialistas de Motor — Unity

#### `unity-specialist`
- **Archivo:** [`agents/unity-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unity Engine Specialist is the authority on all Unity-specific patterns, APIs, and optimization techniques. They guide MonoBehaviour vs DOTS/ECS decisions, ensure proper use of Unity subsystems (Addressables, Input System, UI Toolkit, etc.), and enforce Unity best practices.

#### `unity-dots-specialist`
- **Archivo:** [`agents/unity-dots-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-dots-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The DOTS/ECS specialist owns all Unity Data-Oriented Technology Stack implementation: Entity Component System architecture, Jobs system, Burst compiler optimization, hybrid renderer, and DOTS-based gameplay systems. They ensure correct ECS patterns and maximum performance.

#### `unity-addressables-specialist`
- **Archivo:** [`agents/unity-addressables-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-addressables-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Addressables specialist owns all Unity asset management: Addressable groups, asset loading/unloading, memory management, content catalogs, remote content delivery, and asset bundle optimization. They ensure fast load times and controlled memory usage.

#### `unity-shader-specialist`
- **Archivo:** [`agents/unity-shader-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-shader-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unity Shader/VFX specialist owns all Unity rendering customization: Shader Graph, custom HLSL shaders, VFX Graph, render pipeline customization (URP/HDRP), post-processing, and visual effects optimization. They ensure visual quality within performance budgets.

#### `unity-ui-specialist`
- **Archivo:** [`agents/unity-ui-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unity-ui-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unity UI specialist owns all Unity UI implementation: UI Toolkit (UXML/USS), UGUI (Canvas), data binding, runtime UI performance, input handling, and cross-platform UI adaptation. They ensure responsive, performant, and accessible UI.

### Tier 3: Especialistas de Motor — Unreal Engine 5

#### `unreal-specialist`
- **Archivo:** [`agents/unreal-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/unreal-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Unreal Engine Specialist is the authority on all Unreal-specific patterns, APIs, and optimization techniques. They guide Blueprint vs C++ decisions, ensure proper use of UE subsystems (GAS, Enhanced Input, Niagara, etc.), and enforce Unreal best practices across the codebase.

#### `ue-gas-specialist`
- **Archivo:** [`agents/ue-gas-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ue-gas-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Gameplay Ability System specialist owns all GAS implementation: abilities, gameplay effects, attribute sets, gameplay tags, ability tasks, and GAS prediction. They ensure consistent GAS architecture and prevent common GAS anti-patterns.

#### `ue-blueprint-specialist`
- **Archivo:** [`agents/ue-blueprint-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ue-blueprint-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, subagent`
- **Misión y Alcance:** The Blueprint specialist owns Blueprint architecture decisions, Blueprint/C++ boundary guidelines, Blueprint optimization, and ensures Blueprint graphs stay maintainable and performant. They prevent Blueprint spaghetti and enforce clean BP patterns.

#### `ue-replication-specialist`
- **Archivo:** [`agents/ue-replication-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ue-replication-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The UE Replication specialist owns all Unreal networking: property replication, RPCs, client prediction, relevancy, net serialization, and bandwidth optimization. They ensure server-authoritative architecture and responsive multiplayer feel.

#### `ue-umg-specialist`
- **Archivo:** [`agents/ue-umg-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ue-umg-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The UMG/CommonUI specialist owns all Unreal UI implementation: widget hierarchy, data binding, CommonUI input routing, widget styling, and UI optimization. They ensure UI follows Unreal best practices and performs well.

### Tier 3: Especialistas de Motor — Bevy (Rust)

#### `bevy-specialist`
- **Archivo:** [`agents/bevy-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/bevy-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Bevy Specialist is the authority on all Bevy-specific patterns, APIs, and build integration. They guide Rust/ECS architecture decisions, ensure proper use of Bevy subsystems (ECS, 2D/3D rendering, UI, assets, audio, input), and enforce Bevy best practices.

### Tier 3: Especialistas de Motor — Raylib & C++ Puro (EnTT)

#### `raylib-specialist`
- **Archivo:** [`agents/raylib-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib Specialist is the authority on Raylib, modern C++ (C++17/20), and EnTT ECS game development. They guide code-first architecture, 2D/isometric rendering, math, shaders, entity architectures, CMake build pipelines, and performance optimization without visual editor overhead.

#### `raylib-entt-specialist`
- **Archivo:** [`agents/raylib-entt-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-entt-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib EnTT Specialist is the authority on Data-Oriented Design and Entity-Component-System (ECS) architecture using EnTT in C++. They guide cache-friendly component design, linear system iterations, memory pools, spatial indexing, and high-performance game logic for entities, hordes, and combat.

#### `raylib-shader-specialist`
- **Archivo:** [`agents/raylib-shader-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-shader-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib Shader Specialist is the authority on GLSL shaders, 2D lighting, post-processing, and visual effects in Raylib C++ projects. They guide fragment/vertex shader authoring, custom materials, fog of war, spell effects, screen-space shaders, and GPU performance optimization.

#### `raylib-ui-specialist`
- **Archivo:** [`agents/raylib-ui-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-ui-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib UI Specialist is the authority on user interfaces, HUDs, menus, and developer tooling in Raylib C++ projects. They guide Raygui implementation, Dear ImGui integration (via rlImGui), ARPG inventory interfaces, health globes, dialog boxes, and live debug inspectors.

#### `raylib-build-specialist`
- **Archivo:** [`agents/raylib-build-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/raylib-build-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Raylib Build Specialist is the authority on CMake configuration, multi-platform compilation, dependency management via FetchContent, compiler optimizations, WebAssembly (emscripten), and automated distribution pipelines for Raylib C++ games.

### Tier 3: Especialistas de Programación e Ingeniería

#### `gameplay-programmer`
- **Archivo:** [`agents/gameplay-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/gameplay-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Gameplay Programmer implements game mechanics, player systems, combat, and interactive features as code. Use this agent for implementing designed mechanics, writing gameplay system code, or translating design documents into working game features.

#### `engine-programmer`
- **Archivo:** [`agents/engine-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/engine-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Engine Programmer works on core engine systems: rendering pipeline, physics, memory management, resource loading, scene management, and core framework code. Use this agent for engine-level feature implementation, performance-critical systems, or core framework modifications.

#### `ai-programmer`
- **Archivo:** [`agents/ai-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ai-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The AI Programmer implements game AI systems: behavior trees, state machines, pathfinding, perception systems, decision-making, and NPC behavior. Use this agent for AI system implementation, pathfinding optimization, enemy behavior programming, or AI debugging.

#### `network-programmer`
- **Archivo:** [`agents/network-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/network-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Network Programmer implements multiplayer networking: state replication, lag compensation, matchmaking, and network protocol design. Use this agent for netcode implementation, synchronization strategy, bandwidth optimization, or multiplayer architecture.

#### `ui-programmer`
- **Archivo:** [`agents/ui-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ui-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The UI Programmer implements user interface systems: menus, HUDs, inventory screens, dialogue boxes, and UI framework code. Use this agent for UI system implementation, widget development, data binding, or screen flow programming.

#### `tools-programmer`
- **Archivo:** [`agents/tools-programmer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/tools-programmer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Tools Programmer builds internal development tools: editor extensions, content authoring tools, debug utilities, and pipeline automation. Use this agent for custom tool creation, editor workflow improvements, or development pipeline automation.

#### `security-engineer`
- **Archivo:** [`agents/security-engineer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/security-engineer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** The Security Engineer protects the game from cheating, exploits, and data breaches. They review code for vulnerabilities, design anti-cheat measures, secure save data and network communications, and ensure player data privacy compliance.

#### `performance-analyst`
- **Archivo:** [`agents/performance-analyst.md`](file:///Users/alexis/Developer/pi-game-studio/agents/performance-analyst.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Performance Analyst profiles game performance, identifies bottlenecks, recommends optimizations, and tracks performance metrics over time. Use this agent for performance profiling, memory analysis, frame time investigation, or optimization strategy.

#### `devops-engineer`
- **Archivo:** [`agents/devops-engineer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/devops-engineer.md)
- **Presupuesto de Razonamiento:** `low` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The DevOps Engineer maintains build pipelines, CI/CD configuration, version control workflow, and deployment infrastructure. Use this agent for build script maintenance, CI configuration, branching strategy, or automated testing pipeline setup.

#### `analytics-engineer`
- **Archivo:** [`agents/analytics-engineer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/analytics-engineer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, web_search`
- **Misión y Alcance:** The Analytics Engineer designs telemetry systems, player behavior tracking, A/B test frameworks, and data analysis pipelines. Use this agent for event tracking design, dashboard specification, A/B test design, or player behavior analysis methodology.

### Tier 3: Especialistas de Diseño, Arte, Audio y Narrativa

#### `systems-designer`
- **Archivo:** [`agents/systems-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/systems-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The Systems Designer creates detailed mechanical designs for specific game subsystems -- combat formulas, progression curves, crafting recipes, status effect interactions. Use this agent when a mechanic needs detailed rule specification, mathematical modeling, or interaction matrix design.

#### `level-designer`
- **Archivo:** [`agents/level-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/level-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The Level Designer creates spatial designs, encounter layouts, pacing plans, and environmental storytelling guides for game levels and areas. Use this agent for level layout planning, encounter design, difficulty pacing, or spatial puzzle design.

#### `economy-designer`
- **Archivo:** [`agents/economy-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/economy-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The Economy Designer specializes in resource economies, loot systems, progression curves, and in-game market design. Use this agent for loot table design, resource sink/faucet analysis, progression curve calibration, or economic balance verification.

#### `technical-artist`
- **Archivo:** [`agents/technical-artist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/technical-artist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Technical Artist bridges art and engineering: shaders, VFX, rendering optimization, art pipeline tools, and performance profiling for visual systems. Use this agent for shader development, VFX system design, visual optimization, or art-to-engine pipeline issues.

#### `sound-designer`
- **Archivo:** [`agents/sound-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/sound-designer.md)
- **Presupuesto de Razonamiento:** `low` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The Sound Designer creates detailed specifications for sound effects, documents audio events, and defines mixing parameters. Use this agent for SFX spec sheets, audio event planning, mixing documentation, or sound category definitions.

#### `writer`
- **Archivo:** [`agents/writer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/writer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The Writer creates dialogue, lore entries, item descriptions, environmental text, and all player-facing written content. Use this agent for dialogue writing, lore creation, item/ability descriptions, or in-game text of any kind.

#### `world-builder`
- **Archivo:** [`agents/world-builder.md`](file:///Users/alexis/Developer/pi-game-studio/agents/world-builder.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit`
- **Misión y Alcance:** The World Builder designs detailed world lore: factions, cultures, history, geography, ecology, and the rules that govern the game world. Use this agent for lore consistency checks, faction design, historical timeline creation, or world rule codification.

#### `ux-designer`
- **Archivo:** [`agents/ux-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/ux-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, web_search`
- **Misión y Alcance:** The UX Designer owns user experience flows, interaction design, accessibility, information architecture, and input handling design. Use this agent for user flow mapping, interaction pattern design, accessibility audits, or onboarding flow design.

#### `accessibility-specialist`
- **Archivo:** [`agents/accessibility-specialist.md`](file:///Users/alexis/Developer/pi-game-studio/agents/accessibility-specialist.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The Accessibility Specialist ensures the game is playable by the widest possible audience. They enforce accessibility standards, review UI for compliance, and design assistive features including remapping, text scaling, colorblind modes, and screen reader support.

#### `live-ops-designer`
- **Archivo:** [`agents/live-ops-designer.md`](file:///Users/alexis/Developer/pi-game-studio/agents/live-ops-designer.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, subagent`
- **Misión y Alcance:** The live-ops designer owns post-launch content strategy: seasonal events, battle passes, content cadence, player retention mechanics, live service economy, and engagement analytics. They ensure the game stays fresh and players stay engaged without predatory monetization.

### Tier 3: Testing, Prototipado y Comunidad

#### `qa-tester`
- **Archivo:** [`agents/qa-tester.md`](file:///Users/alexis/Developer/pi-game-studio/agents/qa-tester.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash`
- **Misión y Alcance:** The QA Tester writes detailed test cases, bug reports, and test checklists. Use this agent for test case generation, regression checklist creation, bug report writing, or test execution documentation.

#### `prototyper`
- **Archivo:** [`agents/prototyper.md`](file:///Users/alexis/Developer/pi-game-studio/agents/prototyper.md)
- **Presupuesto de Razonamiento:** `medium` | **Herramientas:** `read, glob, grep, write, edit, bash, subagent`
- **Misión y Alcance:** Throwaway builds — concept prototypes after brainstorm to test an idea is fun before GDDs; vertical slices pre-production. Speed over standards.

#### `community-manager`
- **Archivo:** [`agents/community-manager.md`](file:///Users/alexis/Developer/pi-game-studio/agents/community-manager.md)
- **Presupuesto de Razonamiento:** `low` | **Herramientas:** `read, glob, grep, write, edit, subagent`
- **Misión y Alcance:** The community manager owns player-facing communication: patch notes, social media posts, community updates, player feedback collection, bug report triage from players, and crisis communication. They translate between development team and player community.

---

## Notas de Uso

- Los agentes se distribuyen como plantillas de origen en `agents/*.md`.
- `/setup` o `/studio:setup` copia y activa los 55 agentes en `.pi/agents/` en tu proyecto.
- `/assign-models` o `/studio:models` permite cambiar qué modelo ejecuta cada agente o nivel.
