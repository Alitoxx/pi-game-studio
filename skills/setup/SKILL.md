---
name: setup
description: "[Studio] Interactive guided installation of Pi Game Studio. Explains every step, asks for your confirmation before writing files, and sets up agents and models."
model: inherit
inheritProjectContext: true
tools: read, glob, write, edit, bash, ask_user_question
---

# Pi Game Studio — Interactive Setup & Onboarding

This skill sets up your game studio in the current project.
**Rule #1: Transparency.** Never write files or make modifications silently. Always explain what is going to happen, present the proposed configuration, and wait for explicit user confirmation.

---

# Pi Game Studio — Setup & Engine Configuration

This skill configures the game studio environment for the current repository.

## Execution Guidance

Whenever possible in interactive Pi sessions, prefer invoking the native extension command `/studio:setup` (or `/studio:setup auto`) which handles atomic file generation, toolchain verification, and engine agent deployment through `extensions/hooks/studio-setup.ts`.

If running directly as a skill prompt:
1. **Rule #1: Transparency.** Never write files or make modifications silently. Always explain what is going to happen, present the proposed configuration, and wait for explicit user confirmation.
2. **Rule #2: Sober CLI & Zero Bleed.** Use clean ASCII tables and uppercase block headers (`STUDIO CONTEXT:`, `CHOICE REQUIRED:`, `DELIVERY RECEIPT:`). No decorative emojis, no excessive pleasantries, no conversational bleed.

---

## Phase 1: Environment & Engine Selection

Detect existing configuration:
- Check `project.yaml` for configured engine (`Godot`, `Unity`, `Unreal`, `Bevy`, `Raylib`).
- Check `.pi/settings.json` for package registration.
- Audit compiler/toolchain prerequisites for the selected engine.

If engine is not set, present the engine selection menu:
```text
CHOICE REQUIRED: Selecciona el motor de videojuegos principal:
[1] Godot 4 (GDScript / C# — Ligero, open source)
[2] Unity (C# — 2D/3D multiplataforma)
[3] Unreal Engine 5 (C++ / Blueprints — Alta fidelidad)
[4] Bevy (Rust ECS — Moderno y ultra rápido)
[5] Raylib (C++ / EnTT — Código puro, sin editores pesados)
```

Write or update `project.yaml`:
```yaml
schema_version: 1
engine: "Bevy" # Godot | Unity | Unreal | Bevy | Raylib
```

---

## Phase 2: Agent Deployment Policy (Enfoque A — Selective)

Deploy only the agents required for the active engine:
- **Core Studio (34 agentes)**: Directores (3), Leads (8) y Especialistas generales (23).
- **Especialistas dedicados**:
  - Godot: +5 (`godot-specialist`, `godot-gdscript-specialist`, `godot-csharp-specialist`, `godot-gdextension-specialist`, `godot-shader-specialist`) -> 39 total.
  - Unity: +5 (`unity-specialist`, `unity-dots-specialist`, `unity-addressables-specialist`, `unity-shader-specialist`, `unity-ui-specialist`) -> 39 total.
  - Unreal: +5 (`unreal-specialist`, `ue-gas-specialist`, `ue-blueprint-specialist`, `ue-replication-specialist`, `ue-umg-specialist`) -> 39 total.
  - Bevy: +1 (`bevy-specialist`) -> 35 total.
  - Raylib: +5 (`raylib-specialist`, `raylib-entt-specialist`, `raylib-shader-specialist`, `raylib-ui-specialist`, `raylib-build-specialist`) -> 39 total.

---

## Phase 3: Model Configuration Strategy

Map LLM models by Tier:
- **Tier 1 (Directores)**: High reasoning budget (`gpt-5.4-mini` o equivalente).
- **Tier 2 (Workhorses & Leads)**: Medium reasoning budget (`gpt-oss-120b:free` o equivalente).
- **Tier 3 (Ligeros & Soporte)**: Low reasoning budget (`gpt-oss-20b:free` o equivalente).
- **Modo Inherit**: Configurar todos los tiers en `inherit` para adoptar el modelo de la sesión activa de Pi.

Write `.pi/gentle-ai/models.json`.

---

## Phase 4: Delivery Receipt

Display a sober, executive delivery receipt:

```text
================================================================================
PI GAME STUDIO — INSTALACION COMPLETADA
================================================================================
Motor:               [Motor] (en project.yaml)
Agentes instalados:  [N] agentes en .pi/agents/
Modelos de IA:       .pi/gentle-ai/models.json
Registro de paquete: .pi/settings.json
Log de instalacion:  .pi/game-studio/install-log.md

SIGUIENTES PASOS:
- /studio:start  — Iniciar la sesion de onboarding o sprint actual con el Producer.
- /studio:doctor — Validar toolchain y prerrequisitos del motor instalado.
- /studio        — Ver paleta completa de comandos y herramientas del estudio.
================================================================================
```

