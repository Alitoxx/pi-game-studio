---
name: arch
description: "[ODD Fase 3] Technical Boundaries. Registra Architecture Decision Records (ADRs), presupuestos de VRAM/RAM, target FPS, manifiesto de control y configuración de motor/MCP."
model: inherit
inheritProjectContext: true
tools:
  - read
  - glob
  - grep
  - write
  - edit
  - bash
  - ask_user_choice
  - ask_user_question
---

## Fase 3 ODD: Architecture & Engine Boundaries

Cuando se invoca `/arch` (o `/arch adr`, `/arch budget`, `/arch mcp`):

### 1. Establecer Límites Técnicos (Technical Boundaries)
- Definir el target de FPS (e.g. 60 FPS estables) y budget máximo de memoria para la plataforma objetivo.
- Declarar reglas de arquitectura estrictas (e.g. desacoplamiento de estado y render, cero asignaciones de memoria en bucles de frame).

### 2. Architecture Decision Records (ADRs)
Para cada decisión no trivial (patrón ECS, librería de audio, integración de red, formato de niveles):
- Redactar un ADR conciso en `docs/architecture/adr-<numero>-<titulo>.md`.
- Secciones: Contexto, Alternativas evaluadas, Decisión fundamentada y Consecuencias.

### 3. Integración con el Motor y Pipeline de Shaders
Soporte simétrico para los 5 motores oficiales con su arquitectura de shaders y materiales:
- **Godot**: `project.godot`, GDScript, C#, GDExtension, shaders `canvas_item` / `spatial` (`.gdshader`) (`Appendix A — Godot`).
- **Bevy**: `Cargo.toml`, Rust ECS idiomático, `wgpu`, shaders WGSL (`.wgsl`) integrados con `Material2d` / `MaterialPlugin` (`Appendix B — Bevy`).
- **Raylib**: `CMakeLists.txt`, Modern C++, EnTT ECS, fragment/vertex shaders en GLSL (`.fs` / `.vs`) con `LoadShader()` y `BeginShaderMode()` (`Appendix C — Raylib`).
- **Unity**: MonoBehaviour / DOTS, Burst, URP/HDRP, Shader Graph y custom HLSL (`.shader`).
- **Unreal**: C++, GAS, Enhanced Input, Blueprints, Material Editor y Niagara.

Verificar toolchains locales, extensiones de assets para shaders y servidores MCP según el motor configurado en `project.yaml`.
