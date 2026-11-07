---
name: gamedev-godot
description: "Trigger: Godot, Godot 4, GDScript, .tscn, .tres, project.godot, CharacterBody2D, CharacterBody3D, gdshader, GDExtension. Idiomatic Godot 4.x engineering and headless verification."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in a Godot 4.x project (`project.godot`, `.gd`, `.tscn`, `.tres`, `.gdshader`). Do not use Godot 3 syntax under any circumstance.

## Hard Rules

- **Banned Godot 3 Hallucinations (NEVER write the left column)**:
  - `KinematicBody2D` / `KinematicBody` -> Always use `CharacterBody2D` / `CharacterBody3D`.
  - `velocity = move_and_slide(velocity, Vector2.UP)` -> Set `velocity` property, then call `move_and_slide()` with **zero arguments**.
  - `Sprite` / `Position2D` / `Spatial` -> Always use `Sprite2D`, `Marker2D`, `Node3D`.
  - `yield(t, "timeout")` -> Always use `await get_tree().create_timer(1.0).timeout`.
  - `export var` / `onready var` -> Always use `@export var` / `@onready var`.
  - `connect("sig", self, "_fn")` -> Always use callable syntax `sig.connect(_fn)`.
  - `scene.instance()` -> Always use `scene.instantiate()`.
  - `Tween.new()` node -> Always use `create_tween()`.
  - `PhysicsRayQueryParameters2D.create(from, to, mask, [self])` -> `exclude` requires `Array[RID]`, so always pass `[get_rid()]`, never `[self]`.
- **Strict Static Typing & Composition**: Write explicitly typed GDScript (`var speed: float = 240.0`, `func _on_body_entered(body: Node2D) -> void:`). Compose scenes from child component nodes; follow **Call Down, Signal Up** (never hardcode brittle upward paths like `get_parent().get_node("../UI")`).
- **Custom Resource (`.tres`) Serialization Contract**:
  - Define custom resources as top-level scripts (`class_name WeaponStats extends Resource`), never as an inner `class` inside a `Node` script.
  - Every parameter in `Resource._init()` MUST declare a default value (`func _init(p_damage: int = 0) -> void:`) so the Inspector and `.tres` loader can instantiate it.
- **Physics vs Render Loop**: Run `move_and_slide()`, `move_and_collide()`, and raycasts strictly inside `_physics_process(delta: float)`, never inside `_process()`.

## Decision Gates

| Situation | Action |
| --- | --- |
| Validating a single edited GDScript file | Run `godot --headless --path . --check-only --script res://path/to/file.gd` |
| Smoke-testing the main scene from CLI | Run `godot --headless --path . --quit-after 120` and grep output for `SCRIPT ERROR` or `Parse Error` |
| Custom headless test script (`-s`) | Extend `SceneTree`, enforce a frame watchdog in `_process()`, and call `quit(0)` / `quit(1)` |
| Exporting to Web / itch.io | Use the `Compatibility` renderer, GDScript (not C#), and disable `Thread Support` to avoid `SharedArrayBuffer` header blocks |

## Execution Steps

1. Inspect `project.godot` for Godot version, input actions, autoloads, and collision layers.
2. Implement typed GDScript modules, scenes (`.tscn`), and resources (`.tres`) with zero Godot 3 syntax.
3. Run `godot --headless --path . --check-only --script <script>` or `godot --headless --path . --quit-after 60` and verify zero `SCRIPT ERROR` / `Parse Error` lines in stdout/stderr (do not trust exit code `0` alone).

## Output Contract

Return:
- Modified `.gd`, `.tscn`, `.tres`, or `.gdshader` paths.
- Exact `godot --headless` command run and confirmation that zero `SCRIPT ERROR` or `Parse Error` lines appeared.
- Any new input actions or collision layers registered in `project.godot`.
