---
name: test
description: "[ODD Fase 5] Validate & Feel. Verificación de calidad, smoke checks de arranque, pruebas de regresión, detección de memory leaks y triaje de bugs."
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

## Fase 5 ODD: Quality, Smoke Checks & Feel

Cuando se invoca `/test` (o `/test smoke`, `/test regression`, `/test bugs`):

### 1. Smoke Checks y Arranque Rápido por Motor
Ejecutar el juego en modo headless o ventana mínima para verificar que arranca sin crashes ni panics:
- **Godot**: `godot --headless`
- **Unity**: `Unity.exe -batchmode`
- **Unreal**: `UnrealEditor-Cmd.exe`
- **Bevy**: `cargo run`
- **Raylib**: `./build/game`
Comprobar que los sistemas esenciales (player loop, render básico, inputs) responden.

### 2. Suites de Regresión y Pruebas Unitarias
- Ejecutar la suite de pruebas automatizadas del motor.
- Confirmar que ningún cambio reciente rompió mecánicas previamente validadas.

### 3. Evaluación de Game Feel y Rendimiento
- Verificar que el framerate se mantiene en el target esperado.
- Monitorear asignaciones de memoria para descartar memory leaks.

### 4. Triaje de Bugs
Si se detecta un defecto:
- Registrar en `production/qa/bugs.md` con severidad (P0 Crítico a P3 Menor), pasos de reproducción y comportamiento observado vs. esperado.
