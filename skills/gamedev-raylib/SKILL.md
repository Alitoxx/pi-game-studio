---
name: gamedev-raylib
description: "Trigger: Raylib, C++ game, CMakeLists.txt with raylib, EnTT ECS, rlgl, GLSL 330 shaders, rlImGui. Modern C++17/20 Raylib and EnTT game engineering."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in a C or C++ project using Raylib (`raylib.h`, `CMakeLists.txt` with `raylib`, `entt`).

## Hard Rules

- **RAII GPU & Audio Resource Safety**: Wrap `Texture2D`, `Shader`, `Sound`, `Music`, and `RenderTexture2D` in move-only C++ RAII handles (or a central `ResourceManager`) that call `UnloadTexture`, `UnloadShader`, `UnloadRenderTexture`, etc. before `CloseWindow()`. Never load GPU resources before `InitWindow()`.
- **Fixed-Timestep Accumulator Loop**: Clamp `GetFrameTime()` (max `0.25f`), step physics/simulation in fixed `dt = 1.0f / 60.0f` increments, and render between `BeginDrawing()` and `EndDrawing()`.
- **RenderTexture & Camera Discipline**:
  - Perform off-screen rendering inside `BeginTextureMode(target)` / `EndTextureMode()` **before** `BeginDrawing()`, never nested inside `BeginDrawing()`. Flip `sourceRec.height = -(float)target.texture.height` when drawing `RenderTexture2D` due to OpenGL bottom-left UV origin.
  - Separate world-space draws inside `BeginMode2D(camera)` / `BeginMode3D(camera)` from screen-space UI/HUD draws after `EndMode2D()`.
- **Shader Uniform Caching**: Query `GetShaderLocation(shader, "uniformName")` once at initialization and store the `int` location index; never look up uniform strings inside the per-frame draw loop. Bind texture uniforms with `SetShaderValueTexture`.
- **Cache-Friendly EnTT ECS**: Keep components as plain POD structs, iterate via `registry.view<const Velocity, Position>().each(...)`, and perform zero heap allocations (`new`, `malloc`, unreserved `std::vector::push_back`) per frame.

## Decision Gates

| Situation | Action |
| --- | --- |
| Top-down or isometric 2D depth sorting | Sort draw keys into a pre-reserved buffer by Y-coordinate and atlas ID before drawing |
| Post-processing or CRT/bloom shader pass | Render scene to `RenderTexture2D` in `BeginTextureMode`, then draw flipped texture with `BeginShaderMode` |
| Core gameplay/ECS math verification | Decouple simulation from `InitWindow` and verify via headless CTest unit binaries |

## Execution Steps

1. Inspect `CMakeLists.txt` and source structure to identify C++ standard, EnTT usage, and target binaries.
2. Implement simulation/ECS modules and rendering passes with RAII resource management and cached shader locations.
3. Build and test with `cmake -B build && cmake --build build && ctest --test-dir build --output-on-failure`.

## Output Contract

Return:
- C/C++ source, header, shader, and `CMakeLists.txt` files modified.
- Exact CMake build and CTest verification output.
- Confirmation of RAII resource cleanup and zero per-frame allocations.
