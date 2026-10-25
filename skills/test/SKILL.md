---
name: test
description: "[ODD Fase 5] Validate & Feel. Role Owner: qa-lead (Tier 2 Lead). Verificación de calidad, smoke checks de arranque, pruebas de regresión, detección de memory leaks y triaje de bugs."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - ask_user_question
---

## Fase 5 ODD: Quality, Smoke Checks & Feel

- **Role Owner**: `qa-lead` (Tier 2 Lead)
- **Contrato ODD Compartido**: Consulta [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) para las reglas compartidas de tareas atómicas (~400 líneas), Live Specs en `design/gdd/`, límites de compilación (compiler bounds) y el formato del Return Contract en YAML.

Cuando se invoca `/test` (o `/test smoke`, `/test regression`, `/test bugs`):

### 1. Smoke Checks y Arranque Rápido por Motor
Ejecutar el juego en modo headless, timeout acotado o verificación rápida para validar arranque sin crashes ni panics:
- **Godot**: `godot --headless`
- **Unity**: `Unity.exe -batchmode`
- **Unreal**: `UnrealEditor-Cmd.exe`
- **Bevy**: `cargo check` (validación estática instantánea) o `cargo test -p <crate>` para lógica pura. Para smoke de runtime con ventana: `cargo run` sólo con el usuario presente o mediante flag de timeout/headless para no bloquear procesos automatizados.
- **Raylib**: `./build/game` (o compilación previa con `cmake --build build`)
- **Phaser**: `npm test` / `vitest run` / `npx vite build`
Comprobar que los sistemas esenciales (player loop, render básico, inputs) responden.

### 2. Suites de Regresión y Pruebas Unitarias
- Ejecutar la suite de pruebas automatizadas del motor (e.g. GUT para Godot, `cargo test` para Bevy, CTest para Raylib, `npm test` / `vitest run` para Phaser).
- Confirmar que ningún cambio reciente rompió mecánicas previamente validadas.

### 3. Evaluación de Game Feel, Rendimiento y Fugas de Memoria (Soak Test)
- **Framerate Benchmark**: Verificar que el framerate se mantiene en el target (e.g. 60 FPS estables) bajo carga máxima de entidades y partículas.
- **Soak Test de Memoria (Detección de Leaks)**: Ejecutar una sesión continua de al menos 60 segundos y monitorizar la memoria RAM (RSS) y VRAM. La retención de memoria debe ser plana; cualquier crecimiento monotónico sostenido (> 1 MB/min sin retorno del GC o allocator) se clasifica como fuga de memoria crítica.
- **Budget Gate Estricto**: Si el consumo excede el presupuesto técnico fijado en `/arch` (e.g. > 350 MB RAM o caídas bajo 60 FPS), el test se marca como FALLIDO (`BLOCKED`) impidiendo avanzar hacia release hasta su optimización.

### 4. Triaje de Bugs y Registro
Si se detecta un defecto o regresión de rendimiento:
- Registrar en `production/qa/bugs.md` con severidad (P0 Crítico a P3 Menor), pasos de reproducción y comportamiento observado vs. esperado.
- Notificar el estado al Producer para priorizar la corrección atómica inmediata.
