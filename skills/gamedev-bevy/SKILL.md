---
name: gamedev-bevy
description: "Trigger: Bevy, Rust game, Cargo.toml with bevy, bevy_ecs, ECS systems, WGSL shaders, Observers, States. Idiomatic Bevy Engine (Rust ECS) architecture and fast verification."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in a Rust project using Bevy (`Cargo.toml` depending on `bevy` or `bevy_ecs`).

## Hard Rules

- **Plugin Modularity**: Encapsulate each domain (player, combat, AI, camera, audio, UI) in its own `Plugin` (`fn build(&self, app: &mut App)`). Keep `main.rs` as a thin plugin composition root.
- **Modern Bevy ECS Standards (0.15–0.20+)**:
  - Prefer **Required Components** (`#[require(Transform, Visibility)]`) and `Mesh2d`/`Mesh3d` + `MeshMaterial2d`/`MeshMaterial3d` over deprecated `PbrBundle`/`SpriteBundle`.
  - Use reactive **Observers** (`app.add_observer(|trigger: On<Explode>, mut commands: Commands| ...)` and `commands.trigger(...)` / `#[derive(EntityEvent)]`) for immediate event reactions, and buffered `MessageWriter<T>`/`MessageReader<T>` (or `EventWriter`/`EventReader` matching `Cargo.lock`) for scheduled frame events.
  - Spawn one-shot SFX with `AudioPlayer` + `PlaybackSettings::DESPAWN` so finished audio entities never leak.
- **Query Safety & Disjointness**: Mutate existing components via `Query<&mut T>`; reserve `Commands` for structural changes (spawn/despawn/insert). Enforce query disjointness with `Without<T>` or `ParamSet` to prevent runtime panics.
- **Deterministic Schedules**: Gate systems with `States` (`OnEnter`, `OnExit`, `.run_if(in_state(...))`) and order dependent systems explicitly with `.chain()`, `.before()`, or `.after()`.
- **Zero Hot-Path Allocations**: Never call `.clone()`, `Vec::new()`, or `format!()` inside per-entity query loops in `Update`/`FixedUpdate`; reuse `Local<Vec<Entity>>` or resource buffers.

## Decision Gates

| Situation | Action |
| --- | --- |
| Immediate reaction to a targeted entity event (death, damage, pickup) | Use an ECS Observer (`add_observer` + `trigger` / `EntityEvent`) |
| High-throughput frame-buffered telemetry or collision stream | Use buffered `MessageWriter`/`MessageReader` (or `EventWriter`/`EventReader` per pinned Bevy version) |
| Two mutable queries in the same system touch the same component | Add `Without<Marker>` filters or use `ParamSet` |
| Testing ECS gameplay logic | Write headless unit tests with `App::new()`, `MinimalPlugins`, and `app.update()` |

## Execution Steps

1. Check `Cargo.toml` / `Cargo.lock` to confirm the exact pinned Bevy version and feature flags.
2. Implement small data `Component` structs, `Resource` configs, and focused `Plugin` systems.
3. Run `cargo check --workspace` and `cargo test` (using `MinimalPlugins`) to verify compilation and system behavior.

## Output Contract

Return:
- Affected crates, plugins, components, and schedule registrations.
- Exact `cargo check` / `cargo test` commands executed and their exit codes.
- Confirmation of query disjointness and zero per-frame heap allocations.
