---
name: code
description: "[ODD Fase 4] Implement Atomics. Implementación pura de código en motor (src/) en paquetes atómicos de ~400 líneas guiadas por tests directos y compilación limpia."
model: inherit
inheritProjectContext: true
tools:
  - read
  - glob
  - grep
  - write
  - edit
  - bash
  - subagent
---

## Fase 4 ODD: Code & Mechanics Implementation

Cuando se invoca `/code <feature>` (o `/code review`):

### 1. Lectura de Tareas Pendientes
- Abrir la Live Spec correspondiente en `design/gdd/<feature>.md`.
- Identificar la siguiente tarea atómica pendiente (`[ ]`).

### 2. Implementación en Motor
- Modificar o crear los archivos de código fuente en `src/`.
- Mantener la edición en paquetes pequeños (~400 líneas) para garantizar legibilidad, bajo consumo de tokens y verificación controlada.
- Aplicar los estándares idiomáticos del motor activo (Rust/Bevy, GDScript/Godot, C++/Raylib, C#/Unity, C++/Unreal).

### 3. Verificación de Compilación y Test por Motor
Routing de validación según el motor activo:
- **Godot**: `godot --headless --check-only`
- **Unity**: `Unity -batchmode -runTests` o análisis C# Roslyn
- **Unreal**: `Build.bat` / `UnrealEditor-Cmd`
- **Bevy**: `cargo check` o `cargo test`
- **Raylib**: `cmake --build build && ./build/game`
Asegurar que la compilación sea limpia (0 errores).

### 4. Cierre y Actualización de Tarea
- Marcar la tarea completada `[x]` en la Live Spec.
- Devolver el resumen ejecutivo de archivos modificados y estado de compilación.
