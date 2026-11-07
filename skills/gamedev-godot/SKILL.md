---
name: gamedev-godot
description: "Trigger: Godot, Godot 4, GDScript, .tscn, .tres, project.godot, CharacterBody2D, CharacterBody3D, gdshader, GDExtension. Idiomatic Godot 4.x engineering and headless verification."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in a Godot 4.x project (`project.godot`, `.gd`, `.tscn`, `.tres`, `.gdshader`). Do not activate for Godot 3 legacy codebases without adapting annotations.

## Hard Rules

- **Strict Static Typing**: Write explicitly typed GDScript (`var speed: float = 240.0`, `func apply_damage(amount: int) -> void:`, and typed signal callbacks `func _on_body_entered(body: Node2D) -> void:`).
- **Composition Over Inheritance**: Build entities from focused component nodes (`HealthComponent`, `HitboxComponent`, `StateMachine`) rather than deep script inheritance chains.
- **Signal Up, Call Down**: Parents call child methods directly; children emit typed `signal` events upward or via an Autoload `SignalBus`. Cache node references with `@onready` or `@export`—never call `get_node()` or `$` inside `_process`/`_physics_process`.
- **Custom Resource (`.tres`) Serialization Contract**:
  - Define data assets as top-level scripts (`class_name WeaponStats extends Resource`). Never define a serialized `Resource` as an inner `class` inside a `Node` script, or `.tres` deserialization will fail.
  - Every parameter in `Resource._init()` MUST declare a default value (`func _init(p_damage: int = 0) -> void:`) so the Godot Inspector and loader can instantiate it cleanly.
- **Physics & Rendering Discipline**: Run `move_and_slide()` and raycasts in `_physics_process(delta: float)`. `preload()` scenes at init, pool projectiles, use `MultiMeshInstance2D/3D` for crowds, and attach `VisibleOnScreenNotifier2D/3D` for off-screen culling.
- **Headless SceneTree Probe Contract**: Any headless test script run with `godot --headless -s` MUST extend `SceneTree`, enforce a frame watchdog (`MAX_FRAMES`) in `_process()`, and call `quit(0)` or `quit(1)` explicitly with a bounded CLI timeout.

## Decision Gates

| Situation | Action |
| --- | --- |
| Shared tuning data across scenes/entities | Create a top-level `class_name ... extends Resource` (`.tres`) with default `_init` args |
| Visual hit-flash, outline, or distortion effect | Write a `.gdshader` (`canvas_item` or `spatial`) with `uniform` parameters instead of CPU loops |
| High-frequency spawning (bullets, particles, debris) | Pre-allocate a node pool in `_ready()` and toggle processing/visibility instead of `queue_free()` |
| Verifying changes from CLI | Run `godot --headless --editor --quit` (or `godot --headless --quit`) and headless `SceneTree` probes |

## Execution Steps

1. Inspect `project.godot` for input actions, autoloads, and collision layer names.
2. Implement typed GDScript/C# modules and compose scenes (`.tscn`) and resources (`.tres`).
3. Verify zero parse/import errors via `godot --headless --quit` and execute applicable headless `SceneTree` test scripts.

## Output Contract

Return:
- Modified `.gd`, `.tscn`, `.tres`, or `.gdshader` paths.
- Output and exit code of `godot --headless` verification.
- Any new input actions or collision layers registered in `project.godot`.
