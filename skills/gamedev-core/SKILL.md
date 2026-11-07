---
name: gamedev-core
description: "Core game development engineering for Gentle Shell. Trigger: building games, implementing gameplay mechanics, player movement, combat, physics, camera feel, state machines, input handling, audio buses, or frame-rate optimization."
---

# Gamedev Core Engineering (Direct-to-Code)

Use this skill when designing or implementing gameplay mechanics, controls, physics, game loops, or interactive systems in any engine. Go straight to working code in the project—never generate detached GDD trees or bureaucracy files.

## 1. Direct-to-Playable Workflow

1. **Detect the Engine First**: Inspect the workspace root (`project.godot`, `Cargo.toml`, `package.json`, `CMakeLists.txt`, `Packages/manifest.json`, or `*.uproject`) and load the matching engine skill (`gamedev-godot`, `gamedev-bevy`, `gamedev-phaser`, `gamedev-raylib`, `gamedev-unity`, or `gamedev-unreal`).
2. **Code First, Zero Paper**: Implement mechanics directly in `src/` or the engine's source tree. Keep tunable values (speeds, gravity, cooldowns, damage, easing) at the top of the module or in engine-native data assets (`.tres`, `ScriptableObject`, `Resource`, JSON/TOML) so the developer can tweak feel immediately.
3. **Atomic Playable Slices**: Keep each implementation slice focused (~400 lines max) and verify it compiles cleanly before moving to the next mechanic.

## 2. Universal Gameplay Programming Rules

### Frame-Rate Independence
- Multiply all continuous movement, velocity integration, damping, and timers by frame `delta` time.
- Run physics and collision integration inside the engine's fixed-timestep tick (`_physics_process`, `FixedUpdate`, `FixedMain`), never tied to variable display refresh rates.

### Responsive Controls & Game Feel
- **Decoupled Input Actions**: Map controls through named virtual actions (`move_left`, `jump`, `dash`, `attack`) supporting both Keyboard/Mouse and Gamepad deadzones. Never hardcode raw keycodes inside movement or combat logic.
- **Input Buffering**: Buffer jump/attack presses for `80–150 ms` before landing or animation recovery so inputs never feel dropped.
- **Coyote Time**: Allow jump execution for `80–120 ms` after walking off a ledge.
- **Variable Jump Height**: Cut upward velocity (or increase gravity multiplier by `2.0x–3.0x`) when the jump button is released early, and apply higher fall gravity than rise gravity for crisp arcs.
- **Micro-Feedback**: Pair impactful actions (hits, dashes, landings) with subtle camera trauma/shake (exponential decay), brief hitstop/freeze frames (`30–80 ms`), and easing curves instead of linear interpolation.

### State Machines & Decoupling
- Model entity lifecycle (Idle, Move, Jump, Fall, Dash, Attack, Hitstun, Dead) with explicit state transitions so illegal combinations (e.g., attacking while dead or dashing during hitstun) are impossible.
- Separate core gameplay state from UI and audio presentation using typed events, signals, or ECS messages.

### Zero Per-Frame Heap Allocations (Hot-Path Discipline)
Never allocate heap memory or trigger garbage collection inside per-frame update, physics, or render loops:
- **Rust / Bevy**: No `.clone()`, `Vec::new()`, `format!()`, or `Box::new()` inside hot query loops; reuse resources or pre-allocated buffers.
- **GDScript / Godot**: No `Node.new()`, `load()`, or array/dictionary reallocation in `_process`/`_physics_process`; `preload()` at init and pool projectiles/VFX.
- **C# / Unity**: No `GetComponent<T>()`, LINQ, string concatenation, `new List<T>()`, or `Physics.Raycast()` (use `RaycastNonAlloc` and `ObjectPool<T>`) in `Update`.
- **C++ / Raylib / Unreal**: No raw `new`/`malloc` or unreserved `std::vector::push_back` per frame; use `entt::registry` views, object pools, or `UPROPERTY`/`TObjectPtr` pooled actors.
- **TypeScript / Phaser**: No `new` object literals or closure allocations inside `Scene.update()`; reuse pooled `Phaser.GameObjects.Group` instances.

### Built-In Dev Overlay (`F3`)
- Include a lightweight toggleable debug overlay (`F3` or `~`) displaying live FPS, frame time, player velocity/state, active entity count, and collision gizmos.

### Audio Bus Hierarchy
- Route audio through structured buses (`Master` -> `BGM`, `SFX`, `Ambience`, `UI`) with slight random pitch variation (`0.92–1.08`) on repetitive SFX to prevent ear fatigue.
