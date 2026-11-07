---
name: gamedev-raylib
description: "Raylib C/C++ (C++17/20 & EnTT ECS) game development for Gentle Shell. Trigger: Raylib, CMakeLists.txt with raylib, EnTT, rlgl, GLSL 330 shaders in C/C++."
---

# Raylib & Modern C++ (EnTT) Game Engineering

Apply these standards whenever working in a Raylib C or C++ project.

## 1. Architecture & Memory Management

- **RAII for GPU/Audio Resources**: Wrap `Texture2D`, `Shader`, `Sound`, `Music`, and `RenderTexture2D` in move-only C++ RAII structs (or a centralized `ResourceManager`) that automatically call `UnloadTexture`, `UnloadShader`, etc. in their destructor, strictly after `InitWindow` and before `CloseWindow`.
- **Fixed-Timestep Accumulator Loop**: Decouple simulation from rendering:
  - Accumulate `GetFrameTime()` clamped to a safe maximum (e.g., `0.25f`).
  - Step physics and gameplay in fixed `dt = 1.0f / 60.0f` increments.
  - Render between `BeginDrawing()` and `EndDrawing()` using interpolated transforms.
- **Cache-Friendly EnTT ECS**: When using `entt::registry`, keep components as plain POD structs and iterate with `registry.view<const Velocity, Position>().each(...)`. Never allocate heap memory (`new`, `malloc`, unreserved `std::vector`) inside per-frame system loops.

## 2. Rendering, Shaders & Input

- **Camera & World Space**: Separate world rendering inside `BeginMode2D(camera)` / `BeginMode3D(camera)` from screen-space HUD/debug rendering drawn after `EndMode2D()` / `EndMode3D()`.
- **2D Draw Ordering**: Sort top-down or isometric sprites by Y-coordinate (or depth key) into a reusable pre-reserved render buffer before issuing draw calls, grouping by texture atlas to minimize `rlgl` batch flushes.
- **GLSL 330 Shaders**: Cache uniform locations once at load time with `GetShaderLocation(shader, "uTime")`—never query uniform names by string inside the draw loop.
- **Debug Overlay**: Provide an `F3` toggle showing `DrawFPS`, frame time (`GetFrameTime() * 1000.0f`), entity counts, and wireframe collision bounds (`DrawRectangleLinesEx`, `DrawCircleLines`).

## 3. Build & Verification

- **CMake Build & Test**:
  ```bash
  cmake -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build
  ctest --test-dir build --output-on-failure
  ```
- Keep core gameplay math and ECS systems decoupled from window initialization so unit tests can execute in headless CLI environments.
