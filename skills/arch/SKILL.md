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

### 3. Integración con el Motor, Pipeline de Shaders y Subsistemas Base
Soporte simétrico para los 5 motores oficiales con su arquitectura de shaders, audio, input y persistencia:
- **Godot**: `project.godot`, GDScript, C#, GDExtension, shaders `canvas_item` / `spatial` (`.gdshader`) (`Appendix A — Godot`). Audio Buses en `default_bus_layout.tres` (Master/BGM/SFX/UI). InputMap nativo desacoplado. Serialización con `ConfigFile` o `ResourceFormatSaver`.
- **Bevy**: `Cargo.toml`, Rust ECS idiomático, `wgpu`, shaders WGSL (`.wgsl`) integrados con `Material2d` / `MaterialPlugin` (`Appendix B — Bevy`). Audio reactivo con `bevy_kira_audio` o `bevy_audio` con canales aislados. Input con `leafwing-input-manager` o mapeo `ActionState`. Serialización RON / Serde.
- **Raylib**: `CMakeLists.txt`, Modern C++, EnTT ECS, fragment/vertex shaders en GLSL (`.fs` / `.vs`) con `LoadShader()` y `BeginShaderMode()` (`Appendix C — Raylib`). Audio con miniaudio/raudio por canales. Mapeo de gamepad con `IsGamepadButtonDown()`. Serialización binaria o JSON.
- **Unity**: MonoBehaviour / DOTS, Burst, URP/HDRP, Shader Graph y custom HLSL (`.shader`). AudioMixer con Snapshots y ducking. Input System (Actions). Serialización JSON/Binary.
- **Unreal**: C++, GAS, Enhanced Input, Blueprints, Material Editor y Niagara. Sound Cues y MetaSounds con Submixes. SaveGame nativo.

Verificar toolchains locales, extensiones de assets para shaders, buses de audio y servidores MCP según el motor configurado en `project.yaml`.
