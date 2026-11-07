---
name: gamedev-raylib
description: "Trigger: Raylib, C++ game, CMakeLists.txt with raylib, EnTT ECS, rlgl, GLSL 330 shaders, rlImGui. Modern C++17/20 Raylib and EnTT game engineering."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in a C or C++ project using Raylib (`raylib.h`, `CMakeLists.txt` with `raylib`, `entt`).

## Hard Rules

- **Banned Raylib Traps**:
  - Never call `LoadTexture`, `LoadShader`, `LoadFont`, or `LoadRenderTexture` before `InitWindow()` (causes immediate segfault due to missing OpenGL context).
  - Never call `BeginTextureMode(target)` inside `BeginDrawing()` / `EndDrawing()` -> Execute all off-screen `BeginTextureMode` / `EndTextureMode` passes **before** `BeginDrawing()`.
  - Never draw a `RenderTexture2D` with positive height -> Always flip `Rectangle source = { 0.0f, 0.0f, (float)target.texture.width, -(float)target.texture.height }` to account for OpenGL bottom-left UV coordinates.
  - Never call `GetShaderLocation(shader, "name")` inside the draw loop -> Cache the `int` uniform location once at load time.
- **RAII GPU & Audio Resource Safety**: Wrap `Texture2D`, `Shader`, `Sound`, `Music`, and `RenderTexture2D` in move-only C++ RAII structs that automatically call `Unload*` in their destructors before `CloseWindow()`.
- **Fixed-Timestep Accumulator & EnTT ECS**:
  - Clamp `GetFrameTime()` (max `0.25f`), step physics/simulation in fixed `dt = 1.0f / 60.0f` increments, and render between `BeginDrawing()` and `EndDrawing()`.
  - Keep EnTT components as plain POD structs, iterate via `registry.view<const Velocity, Position>().each(...)`, and perform zero heap allocations (`new`, `malloc`, unreserved `std::vector::push_back`) per frame.

## Decision Gates

| Situation | Action |
| --- | --- |
| World-space vs. HUD rendering | Draw world entities inside `BeginMode2D(camera)` / `EndMode2D()`, then draw HUD and `F3` debug overlay in screen space before `EndDrawing()` |
| Top-down or isometric 2D depth sorting | Sort draw keys into a pre-reserved `std::vector` by Y-coordinate and atlas ID before issuing draw calls |
| Core gameplay/ECS math verification | Decouple simulation from `InitWindow` and verify via headless CTest unit binaries |

## Execution Steps

1. Inspect `CMakeLists.txt` and source structure to identify C++ standard, EnTT usage, and target binaries.
2. Implement simulation/ECS modules and rendering passes with RAII resource management, cached shader locations, and proper `BeginTextureMode` ordering.
3. Build and test with `cmake -B build && cmake --build build && ctest --test-dir build --output-on-failure`.

## Output Contract

Return:
- C/C++ source, header, shader, and `CMakeLists.txt` files modified.
- Exact CMake build and CTest verification output.
- Confirmation of RAII resource cleanup, OpenGL context ordering, and zero per-frame allocations.
