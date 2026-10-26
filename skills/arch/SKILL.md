---
name: arch
description: "[ODD Phase 3] Technical Boundaries. Role Owner: technical-director (Tier 1 Director). Records Architecture Decision Records (ADRs), VRAM/RAM budgets, target FPS, the control manifest, and engine/MCP configuration."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - ask_user_question
---

## ODD Phase 3: Architecture & Engine Boundaries

- **Role Owner**: `technical-director` (Tier 1 Director)
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/arch` is invoked (or `/arch adr`, `/arch budget`, `/arch mcp`):

### 1. Set Technical Boundaries
- Define the target FPS (e.g. a stable 60 FPS) and the maximum memory budget for the target platform.
- Declare strict architecture rules (e.g. decoupling state from rendering, zero memory allocations in frame loops).

### 2. Architecture Decision Records (ADRs)
For every non-trivial decision (ECS pattern, audio library, networking integration, level format):
- Write a concise ADR in `docs/architecture/adr-<numero>-<titulo>.md`.
- Sections: Context, Alternatives considered, Grounded decision, and Consequences.

### 3. Engine Integration, Shader Pipeline & Core Subsystems
Symmetric support for the 6 official engines with their shader, audio, input and persistence architecture:
- **Godot**: `project.godot`, GDScript, C#, GDExtension, `canvas_item` / `spatial` shaders (`.gdshader`) (`Appendix A — Godot`). Audio Buses in `default_bus_layout.tres` (Master/BGM/SFX/UI). Native decoupled InputMap. Serialization with `ConfigFile` or `ResourceFormatSaver`.
- **Bevy**: `Cargo.toml`, idiomatic Rust ECS, `wgpu`, WGSL shaders (`.wgsl`) integrated with `Material2d` / `MaterialPlugin` (`Appendix B — Bevy`). Reactive audio with `bevy_kira_audio` or `bevy_audio` with isolated channels. Input via `leafwing-input-manager` or `ActionState` mapping. RON / Serde serialization.
- **Raylib**: `CMakeLists.txt`, Modern C++, EnTT ECS, GLSL fragment/vertex shaders (`.fs` / `.vs`) with `LoadShader()` and `BeginShaderMode()` (`Appendix C — Raylib`). Audio via miniaudio/raudio by channels. Gamepad mapping with `IsGamepadButtonDown()`. Binary or JSON serialization.
- **Unity**: MonoBehaviour / DOTS, Burst, URP/HDRP, Shader Graph and custom HLSL (`.shader`). AudioMixer with Snapshots and ducking. Input System (Actions). JSON/Binary serialization.
- **Unreal**: C++, GAS, Enhanced Input, Blueprints, Material Editor and Niagara. Sound Cues and MetaSounds with Submixes. Native SaveGame.
- **Phaser**: `package.json`, TypeScript, Vite, WebGL/Canvas pipelines, custom GLSL shaders via `PostFXPipeline` (`Appendix D — Phaser`). Reactive audio with Web Audio API / `Phaser.Sound` (decoupled Master/BGM/SFX channels). Input via `Phaser.Input` (Keyboard, Pointer, Gamepad). Physics engine: Arcade Physics or Matter.js. Serialization with `localStorage` / IndexedDB or JSON.

#### Guided Mode, Stack Templates & Engine Routing
- **Godot**: `godot-specialist` — Stack: GDScript / C#, SceneTree (`Appendix A — Godot`).
- **Bevy**: `bevy-specialist` — Stack: Rust ECS, `wgpu`, WGSL (`Appendix B — Bevy`).
- **Raylib**: `raylib-specialist` — Stack: Modern C++, EnTT ECS, GLSL (`Appendix C — Raylib`).
- **Unity**: `unity-specialist` — Stack: C#, MonoBehaviour / DOTS, Shader Graph.
- **Unreal**: `unreal-specialist` — Stack: C++, GAS, Enhanced Input, Niagara.
- **Phaser**: `phaser-specialist` — Stack: TypeScript, Vite, WebGL / Arcade Physics (`Appendix D — Phaser`).

### 4. MCP Server Ecosystem ("Files First, MCP Accelerated")
When `/arch mcp` or `/studio:mcp` runs:
- **Environment Audit**: Check the status of the 10 available MCP servers (REA, Playwright, Context7, Codegraph, SQLite, Chroma/Vector, Blender, Image Gen, Audio SFX, Live Engine).
- **ODD Acceleration**: MCP servers do not replace files on disk (`design/gdd/`); they accelerate the specialists' inspection capabilities. Generate or update `docs/architecture/mcp-ecosystem.md` with the servers recommended and enabled for the project.

### 5. Verifiable Closure (Done When)

A budget that cannot be measured **is not a budget**: it is an intention. The phase does not close by declaring numbers.

It closes in `completed` only if these four binary conditions hold:
- **Numeric threshold per budget**: every FPS, RAM and VRAM row declares a number and a unit (`60 FPS`, `350 MB`, `1.5 GB`).
- **Measurement command per threshold**: every budget names the command or instrumentation that observes it; `/test` is the one that runs it on every delivery, and `arch` does not close with a number nobody can read.
- **Complete ADR**: every ADR in `docs/architecture/adr-<numero>-<titulo>.md` declares the decision, the rejected alternative and the consequence; an ADR without a rejected alternative is an announcement, not a decision.
- **Proven toolchain**: the active engine's build/check command runs at least once and its exact result goes into the evidence.

Evidence reported:

`structural: docs/architecture/adr-001-ecs-vs-jerarquia.md: decisión + alternativa + consecuencia, 3 presupuestos con umbral y comando` plus `cargo check -p game: 0 errors` (or the active engine's command) once the scaffold exists.

If a budget has no measurement command, the phase returns `partial`: declaring a limit with no way to observe it is exactly the debt `/test` ends up paying alone.
