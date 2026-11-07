---
name: gamedev-bevy
description: "Bevy Engine (Rust ECS) game development for Gentle Shell. Trigger: Bevy, Rust game, Cargo.toml with bevy, ECS systems, WGSL shaders, bevy_ecs."
---

# Bevy Engine (Rust ECS) Engineering

Apply these standards whenever working in a Bevy project (`Cargo.toml` with `bevy`).

## 1. Idiomatic Bevy ECS Architecture

- **Plugin Modularity**: Encapsulate every domain (player, combat, enemies, camera, audio, UI) into its own `Plugin` implementing `fn build(&self, app: &mut App)`. Keep `main.rs` as a thin plugin composer.
- **Small Components, Focused Systems**: Design components as small data structs (`#[derive(Component, Reflect, Default)]`). Prefer multiple focused systems over monolithic systems with 10+ query parameters.
- **Query Disjointness**: Use `Without<T>` or `ParamSet` when two queries in the same system access overlapping components mutably, preventing runtime panics.
- **Query vs. Commands**: Mutate existing component data directly through `Query<&mut Transform>`. Use `Commands` only for structural ECS changes (spawning/despawning entities, inserting/removing components).
- **Explicit System Ordering**: Chain dependent systems deterministically with `.chain()` or `.before()` / `.after()` inside `Update` and `FixedUpdate` schedules.
- **State-Driven Schedules**: Drive game flow (`AppState::Menu`, `AppState::InGame`, `AppState::Paused`) using `States`, `OnEnter`, `OnExit`, and `.run_if(in_state(AppState::InGame))`.

## 2. Modern Bevy API Standards (0.15+ / 0.19+)

- **Required Components over Legacy Bundles**: Use `#[require(Transform, Visibility)]` on custom components and spawn `Mesh2d`/`Mesh3d` + `MeshMaterial2d`/`MeshMaterial3d` directly instead of deprecated `PbrBundle` or `SpriteBundle`.
- **Events & Messages**: Use buffered events (`EventWriter<T>` / `EventReader<T>` or `MessageWriter`/`MessageReader` depending on the pinned Bevy version in `Cargo.lock`) and observers (`Trigger<T>`) to decouple combat hits, audio triggers, and UI updates.
- **Audio Playback**: Spawn audio entities with `AudioPlayer` and `PlaybackSettings::DESPAWN` for one-shot SFX so finished audio entities do not leak in the ECS world.
- **Hot-Path Allocation Discipline**: Never call `.clone()`, `Vec::new()`, or `format!()` inside per-entity query loops in `Update` or `FixedUpdate`. Reuse `Local<Vec<Entity>>` or resources for scratch buffers.

## 3. Verification & Fast Builds

- **Fast Compile Check**: Run `cargo check --workspace` for rapid feedback before running full binaries.
- **Headless Unit Tests**: Test gameplay systems in isolation using `App::new()` with `MinimalPlugins`, inserting test resources/entities, calling `app.update()`, and asserting component states via `cargo test`.
- **Dev Compile Speed**: Recommend `opt-level = 1` for workspace crates and `opt-level = 3` for dependencies (`[profile.dev.package."*"]`) in `Cargo.toml` so physics and rendering stay at 60 FPS during development.
