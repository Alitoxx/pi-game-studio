---
name: code
description: "[ODD Phase 4] Implement Atomics. Role Owner: gameplay-programmer (Tier 2 Lead) + Active Engine Specialist (Tier 3). Pure in-engine code implementation (src/) in atomic ~400-line packages guided by direct tests and clean compilation."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - subagent_run
  - ask_user_question
---

## ODD Phase 4: Code & Mechanics Implementation

- **Role Owner**: `gameplay-programmer` (Tier 2 Lead) + Active Engine Specialist (Tier 3)
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/code <feature>` is invoked (or `/code review`):

### 1. Read the Pending Tasks
- Open the corresponding Live Spec in `design/gdd/<feature>.md`.
- Identify the next pending atomic task (`[ ]`).

### 2. In-Engine Implementation
- Modify or create the source files in `src/`.
- **Shader & Material Implementation**: If the task involves visual effects, lighting, fog or distortion, create the corresponding shader files in `assets/shaders/` (.wgsl, .gdshader, .fs) with clean bindings/uniforms, instead of emulating them with heavy CPU-side logic.
- **Debug Overlay & Gizmos in Dev (`F3`)**: In the first scaffold or subsystem task (`TASK-01` or `02`), enable a debug layer toggled with the `F3` or `~` key that projects real FPS, gameplay metrics, AI states and collision/vision gizmos on screen.
- **Decoupled Action Mapping**: Always use virtual actions (`ActionState` or `InputMap`) that natively support Keyboard/Mouse and Gamepad without hardcoding individual keys into controllers.
- **Game Feel Micro-feedback**: Apply the camera shake, hitstop and easing curve values defined in the Live Spec instead of dry jumps or movements.
- **CLI Asset Transformation & Optimization**:
  - If the task introduces new 2D sprites or atlases: use `magick` to assemble spritesheets and `oxipng` to compress PNGs losslessly.
  - If the task introduces audio effects: convert to `.ogg` with `ffmpeg` and apply reverb/EQ with the `ffmpeg` audio filters (`aecho`, `equalizer`).
  - If the task imports 3D models: convert proprietary or `.obj` formats into optimized `.glb` with `assimp`.
  - During iterative development: use `watchexec` to re-run validations hot on code changes.
- Keep edits in small packages (~400 lines) to guarantee readability, low token consumption and controlled verification.
- Apply the active engine's idiomatic standards (Rust/Bevy, GDScript/Godot, C++/Raylib, C#/Unity, C++/Unreal, TypeScript/Phaser).

### 3. Per-Engine Build & Test Verification
Validation and specialist routing per active engine (prioritize fast, scoped validation):
- **Godot** (`godot-specialist`): `godot --headless --check-only`
- **Unity** (`unity-specialist`): `Unity -batchmode -runTests` or C# Roslyn analysis
- **Unreal** (`unreal-specialist`): `Build.bat` / `UnrealEditor-Cmd`
- **Bevy** (`bevy-specialist`): `cargo check` for the project, or `cargo test -p <crate>` for logic-decoupled crates (e.g. `radio-core`). Avoid the full root `cargo test` if it recompiles Bevy with heavy debug profiles.
- **Raylib** (`raylib-specialist`): `cmake --build build && ./build/game`
- **Phaser** (`phaser-specialist`): `npm test` or `npx vitest run` / `npx vite build`
Ensure the build is clean (0 errors).

### 4. Automatic Task Closure & Producer Handoff
After receiving the specialist's Delivery Receipt with `status: completed`:
- **Live Spec**: Open `design/gdd/<feature>.md` and mark the completed task from `[ ]` (or `[/]`) to `[x] <tarea>` (task-line format; the placeholder stays as documented) with its date and validation hash/summary.
- **Roadmap & State**: Update `production/roadmap.md` inside the `<!-- PRODUCER_STATE -->` block, updating (the field labels below are human-facing roadmap content and stay in the project's configured language):
  - `Última Tarea Completada: <ID de la tarea>`
  - `Siguiente Paso: <siguiente tarea pendiente [ ]>`
- **Executive Summary**: Return exclusively the Delivery Receipt in 10-15 lines, naming the next executable step without speculation.
