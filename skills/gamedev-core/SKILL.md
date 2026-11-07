---
name: gamedev-core
description: "Trigger: game development, gameplay mechanics, player controller, movement, combat, physics, camera feel, state machine, input buffering, coyote time, audio buses, frame-rate optimization. Core direct-to-code game engineering rules for Gentle Shell."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Use this skill whenever designing, implementing, or refactoring gameplay mechanics, player controls, combat, physics loops, camera feel, audio routing, or frame-time optimizations in any game engine. Pair it with the active engine skill (`gamedev-godot`, `gamedev-bevy`, `gamedev-phaser`, `gamedev-raylib`, `gamedev-unity`, or `gamedev-unreal`). Do not use for non-game web/CRUD apps.

## Hard Rules

- **Direct-to-Code (Zero GDD Bureaucracy)**: Implement mechanics directly in source files. Never generate detached `design/gdd/` trees or paper roadmaps unless explicitly requested.
- **Pin the Engine Version Before Coding**: Always inspect the engine config file first (`project.godot`, `Cargo.toml`, `package.json`, `CMakeLists.txt`, `ProjectVersion.txt`, `*.uproject`) and strictly obey the banned legacy API table in the matching `gamedev-<engine>` skill.
- **Frame-Rate Independence**: Multiply continuous movement, damping, and timers by `delta`. Run physics and collision integration inside the engine's fixed-timestep loop (`_physics_process`, `FixedUpdate`, `FixedMain`), never inside variable render frames.
- **Decoupled Input & Game Feel**:
  - Bind controls to named virtual actions (Keyboard/Mouse + Gamepad deadzones), never raw keycodes inside gameplay logic.
  - Implement **input buffering** (`80–150 ms`) for jump/attack presses and **coyote time** (`80–120 ms`) after leaving ledges.
  - Apply **variable jump height** (cut upward velocity or increase fall gravity `2.0x–3.0x` on early release) and micro-feedback (exponential camera trauma/shake, `30–80 ms` hitstop, easing curves).
- **Explicit State Machines & Entity Isolation**: Model entity states (Idle, Move, Jump, Fall, Dash, Attack, Hitstun, Dead) with explicit transition guards. Isolate each new enemy, weapon, or mechanic into its own component/module instead of bloating the main game loop.
- **Zero Per-Frame Heap Allocations**: Never allocate heap memory, instantiate unpooled objects, or trigger GC inside per-frame update, physics, or draw loops.
- **Dev Overlay (`F3`) & Audio Buses**: Expose a toggleable `F3` debug overlay (FPS, frame time, state, velocity, collision gizmos) and route audio through `Master` -> `BGM`, `SFX`, `Ambience`, `UI` with slight pitch randomization (`0.92–1.08`) on repetitive SFX.

## Decision Gates

| Situation | Action |
| --- | --- |
| Workspace has an engine project file | Load the matching `gamedev-<engine>` skill alongside `gamedev-core` |
| Feature spawns frequent projectiles, VFX, or enemies | Use an object pool or instanced renderer instead of per-frame spawn/destroy |
| Tuning constants (speed, gravity, cooldown, damage) needed | Expose as inspector/resource fields or top-of-file constants, never buried magic numbers |
| CLI check returns exit code `0` | Inspect stdout/stderr for `SCRIPT ERROR`, `Parse Error`, or runtime panics—never trust exit code `0` alone |

## Execution Steps

1. Inspect the workspace root to identify the exact engine version and load its `gamedev-<engine>` skill.
2. Implement one bounded mechanic per slice (~400 lines max) with exposed tuning knobs and zero hot-path allocations.
3. Wire decoupled input actions, state transition guards, and visual/audio feedback hooks.
4. Run the engine's CLI syntax/compile check and inspect stdout/stderr for script or shader errors before finishing.

## Output Contract

Return:
- Files created or modified with their exposed tuning parameters.
- Exact compile/test verification command run and its observed stdout/stderr result.
- Confirmation of version-accurate APIs and zero per-frame allocations.
