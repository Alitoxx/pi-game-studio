# Appendix C — Raylib & C++ Configuration Reference

### C1. CLAUDE.md Technology Stack
```markdown
- **Engine**: Raylib [version] & EnTT
- **Language**: Modern C++ (C++17/20)
- **Build System**: Modern CMake (FetchContent)
- **Asset Pipeline**: Custom / Raylib LoadTexture & LoadSound
```

### C2. Naming Conventions
- Classes / Structs / Components: PascalCase (`PlayerController`, `PositionComponent`, `HealthComponent`)
- Functions / Methods: PascalCase or camelCase (`TakeDamage()` or `takeDamage()`)
- Member variables: `m_` prefix or camelCase (`m_moveSpeed` or `moveSpeed`)
- Files: snake_case or PascalCase (`player_controller.hpp`, `player_controller.cpp`)
- Constants: UPPER_SNAKE_CASE (`MAX_HEALTH`, `SCREEN_WIDTH`)

### C3. Engine Specialists Routing
```markdown
## Engine Specialists
- **Primary**: raylib-specialist
- **ECS & Data Specialist**: raylib-entt-specialist (EnTT components, views, pools, DOD architecture)
- **Shader Specialist**: raylib-shader-specialist (GLSL 2D/3D shaders, dynamic lighting, fog of war, VFX)
- **UI & Tools Specialist**: raylib-ui-specialist (In-game HUD, Raygui, Dear ImGui debug overlays via rlImGui)
- **Build Specialist**: raylib-build-specialist (Modern CMake, FetchContent, WebAssembly emscripten, compiler flags)
- **Routing Notes**: Invoke primary for overall loop architecture, windowing, and 2D/isometric camera math. Invoke EnTT specialist for entity systems and combat data. Invoke shader specialist for GLSL visual effects. Invoke UI specialist for menus and debug tooling. Invoke build specialist for CMake and packaging.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code & components (.cpp, .hpp, .h, .cxx) | raylib-specialist / raylib-entt-specialist |
| Shader files (.fs, .vs, .glsl) | raylib-shader-specialist |
| Build / project files (CMakeLists.txt, *.cmake) | raylib-build-specialist |
| UI & debug tooling files (ui_*, debug_*) | raylib-ui-specialist |
| Data / level files (.json, .ldtk, .tmx) | raylib-specialist |
| General architecture review | raylib-specialist |
```
