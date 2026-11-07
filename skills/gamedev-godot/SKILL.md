---
name: gamedev-godot
description: "Godot 4.x game development for Gentle Shell. Trigger: Godot, GDScript, .tscn, .tres, project.godot, CharacterBody2D, CharacterBody3D, gdshader, GDExtension."
---

# Godot 4.x Engineering

Apply these standards whenever working in a Godot 4 project (`project.godot`).

## 1. Architecture & Scene Organization

- **Composition Over Inheritance**: Build entities as scenes composed of focused child nodes (`HealthComponent`, `HitboxComponent`, `VelocityComponent`, `StateMachine`) rather than deep script inheritance chains.
- **Static Typing Everywhere**: Write strictly typed GDScript (`var speed: float = 240.0`, `func apply_damage(amount: int) -> void:`). Enable static type warnings to catch errors at parse time and maximize GDScript VM performance.
- **Node References**: Cache child references with `@onready var sprite: Sprite2D = $Sprite2D` or `@export var target: Node2D`. Never call `get_node()` or `$` repeatedly inside `_process` or `_physics_process`.
- **Signal Up, Call Down**: Parents call methods on children directly; children emit typed `signal` events upward or through a global Autoload `SignalBus` for decoupled UI/audio reactions.
- **Data-Driven Custom Resources (`.tres`)**: Define stats, weapon configs, and movement tuning as `class_name MovementStats extends Resource` with `@export` properties so values can be swapped and tuned without code edits.

## 2. Physics, Rendering & Performance

- **Physics Loops**: Run `move_and_slide()` and raycasts inside `_physics_process(delta: float)`. Use `_process(delta: float)` only for visual interpolation, camera smoothing, and UI updates.
- **Collision Layers & Masks**: Name collision layers explicitly in `project.godot` (e.g., Layer 1: World, Layer 2: Player, Layer 3: Enemies, Layer 4: Projectiles) and set bitmasks intentionally.
- **Object Pooling & Instancing**: `preload()` frequently spawned scenes. For bullets, particles, or crowds, use an object pool or `MultiMeshInstance2D`/`MultiMeshInstance3D` instead of calling `instantiate()` and `queue_free()` dozens of times per second.
- **Off-Screen Culling**: Attach `VisibleOnScreenNotifier2D`/`3D` to disable expensive AI or animation processing when entities leave the camera view.
- **Shaders (`.gdshader`)**: Implement hit flashes, dissolve effects, water, and post-processing in `shader_type canvas_item` or `spatial` using exposed `uniform` parameters rather than CPU per-pixel loops.

## 3. Headless Verification & Testing

- **Syntax & Import Check**:
  ```bash
  godot --headless --quit
  ```
- **Headless SceneTree Probe Contract**: When running a verification script via `godot --headless -s res://tests/probe.gd`, always extend `SceneTree`, run assertions inside `_process()` with a strict frame watchdog (`MAX_FRAMES`), and exit explicitly via `quit(0)` on pass or `quit(1)` on failure so the CLI never hangs.
