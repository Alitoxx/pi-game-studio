---
name: gamedev-bevy
description: "Trigger: Bevy, Rust game, Cargo.toml with bevy, bevy_ecs, ECS systems, WGSL shaders, Observers, States. Idiomatic Bevy Engine (Rust ECS) architecture and fast verification."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in a Rust project using Bevy (`Cargo.toml` depending on `bevy` or `bevy_ecs`).

## Hard Rules

- **Banned Legacy Bevy Hallucinations (0.15–0.20+ Standards)**:
  - Never use `app.add_system(sys)` -> Always use `app.add_systems(Update, (sys_a, sys_b).chain())`.
  - Never spawn deprecated `PbrBundle`, `SpriteBundle`, or `Camera2dBundle` -> Use **Required Components** (`#[require(Transform, Visibility)]`, `Camera2d`, `Sprite`, `Mesh2d`/`Mesh3d` + `MeshMaterial2d`/`MeshMaterial3d`).
  - Never put two overlapping mutable queries (`Query<&mut Transform, With<Player>>`, `Query<&mut Transform, With<Enemy>>`) in the same system without `Without<Enemy>` / `Without<Player>` or `ParamSet` (causes immediate runtime panic `B0001`).
  - Never use `AudioBundle` -> Spawn `AudioPlayer` with `PlaybackSettings::DESPAWN` for one-shot SFX so entities do not leak.
- **Plugin Modularity**: Encapsulate each domain (player, combat, AI, camera, audio, UI) in its own `Plugin` (`fn build(&self, app: &mut App)`). Keep `main.rs` as a thin plugin composition root.
- **Observers vs. Buffered Events**:
  - Use reactive **Observers** (`app.add_observer(|trigger: On<Explode>, mut commands: Commands| ...)` and `commands.trigger(...)` / `#[derive(EntityEvent)]`) for immediate targeted reactions.
  - Use buffered `MessageWriter<T>`/`MessageReader<T>` (or `EventWriter`/`EventReader` matching `Cargo.lock`) for scheduled frame streams.
- **Query vs. Commands & Hot-Path Discipline**: Mutate existing components via `Query<&mut T>`; reserve `Commands` for structural changes (spawn/despawn/insert). Never call `.clone()`, `Vec::new()`, or `format!()` inside per-entity query loops in `Update`/`FixedUpdate`.

## Decision Gates

| Situation | Action |
| --- | --- |
| Immediate reaction to a targeted entity event (death, damage, pickup) | Use an ECS Observer (`add_observer` + `trigger` / `EntityEvent`) |
| Two queries in the same system access `&mut Transform` | Add explicit `Without<T>` disjoint filters or wrap in `ParamSet` |
| Testing ECS gameplay logic without a GPU window | Write headless unit tests with `App::new()`, `MinimalPlugins`, and `app.update()` |
| Slow dev-mode physics/frame rate | Set `opt-level = 1` for workspace and `opt-level = 3` for `[profile.dev.package."*"]` in `Cargo.toml` |

## Execution Steps

1. Inspect `Cargo.toml` / `Cargo.lock` first to confirm the exact pinned Bevy version (e.g., `0.15`, `0.18`, `0.20`) and match its exact event/observer syntax.
2. Implement small data `Component` structs, `Resource` configs, and focused `Plugin` systems with disjoint queries.
3. Run `cargo check --workspace` and `cargo test` (using `MinimalPlugins`) to verify compilation and runtime query safety.

## Output Contract

Return:
- Affected crates, plugins, components, and schedule registrations.
- Exact `cargo check` / `cargo test` commands executed and their exit codes.
- Confirmation of query disjointness (`B0001` safe) and zero per-frame heap allocations.
