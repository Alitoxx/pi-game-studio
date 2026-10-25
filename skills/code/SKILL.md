---
name: code
description: "[ODD Fase 4] Implement Atomics. Role Owner: gameplay-programmer (Tier 2 Lead) + Active Engine Specialist (Tier 3). Implementación pura de código en motor (src/) en paquetes atómicos de ~400 líneas guiadas por tests directos y compilación limpia."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - subagent_run
  - ask_user_question
---

## Fase 4 ODD: Code & Mechanics Implementation

- **Role Owner**: `gameplay-programmer` (Tier 2 Lead) + Active Engine Specialist (Tier 3)
- **Contrato ODD Compartido**: Consulta [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) para las reglas compartidas de tareas atómicas (~400 líneas), Live Specs en `design/gdd/`, límites de compilación (compiler bounds) y el formato del Return Contract en YAML.

Cuando se invoca `/code <feature>` (o `/code review`):

### 1. Lectura de Tareas Pendientes
- Abrir la Live Spec correspondiente en `design/gdd/<feature>.md`.
- Identificar la siguiente tarea atómica pendiente (`[ ]`).

### 2. Implementación en Motor
- Modificar o crear los archivos de código fuente en `src/`.
- **Implementación de Shaders y Materiales**: Si la tarea involucra efectos visuales, iluminación, niebla o distorsión, crear los archivos de shader correspondientes en `assets/shaders/` (.wgsl, .gdshader, .fs) con sus bindings/uniforms limpios, en lugar de intentar emularlos con lógica pesada en CPU.
- **Debug Overlay & Gizmos en Dev (`F3`)**: En la primera tarea de scaffold o subsistema (`TASK-01` o `02`), habilitar una capa de depuración activable con tecla `F3` o `~` que proyecte FPS reales, métricas de gameplay, estados de IA y gizmos de colisión/visión en pantalla.
- **Mapeo de Acciones Desacoplado**: Usar siempre acciones virtuales (`ActionState` o `InputMap`) que soporten Teclado/Ratón y Gamepad de forma nativa sin `hardcoding` de teclas individuales en los controladores.
- **Micro-retroalimentación de Game Feel**: Aplicar los valores de sacudida de cámara, hitstop y curvas de easing definidos en la Live Spec en lugar de saltos o movimientos secos.
- **Transformación & Optimización de Assets por CLI**:
  - Si la tarea introduce nuevos sprites o atlas 2D: utilizar `magick` para armar spritesheets y `oxipng` para comprimir PNGs sin pérdida.
  - Si la tarea introduce efectos de audio: convertir a `.ogg` con `ffmpeg` y aplicar reverberación/ecualización con los filtros de audio de `ffmpeg` (`aecho`, `equalizer`).
  - Si la tarea importa modelos 3D: convertir formatos propietarios o `.obj` a `.glb` optimizados con `assimp`.
  - Durante desarrollo iterativo: utilizar `watchexec` para relanzar validaciones en caliente ante cambios de código.
- Mantener la edición en paquetes pequeños (~400 líneas) para garantizar legibilidad, bajo consumo de tokens y verificación controlada.
- Aplicar los estándares idiomáticos del motor activo (Rust/Bevy, GDScript/Godot, C++/Raylib, C#/Unity, C++/Unreal, TypeScript/Phaser).

### 3. Verificación de Compilación y Test por Motor
Routing de validación y especialista según el motor activo (priorizar validación rápida y acotada):
- **Godot** (`godot-specialist`): `godot --headless --check-only`
- **Unity** (`unity-specialist`): `Unity -batchmode -runTests` o análisis C# Roslyn
- **Unreal** (`unreal-specialist`): `Build.bat` / `UnrealEditor-Cmd`
- **Bevy** (`bevy-specialist`): `cargo check` para el proyecto, o `cargo test -p <crate>` para crates desacoplados de lógica (e.g. `radio-core`). Evitar `cargo test` del root completo si recompila Bevy con perfiles pesados de debug.
- **Raylib** (`raylib-specialist`): `cmake --build build && ./build/game`
- **Phaser** (`phaser-specialist`): `npm test` o `npx vitest run` / `npx vite build`
Asegurar que la compilación sea limpia (0 errores).

### 4. Cierre Automático de Tarea & Producer Handoff
Tras recibir el Delivery Receipt del especialista con `status: completed`:
- **Live Spec**: Abrir `design/gdd/<feature>.md` y marcar la tarea completada de `[ ]` (o `[/]`) a `[x] <tarea>` con su fecha y hash/resumen de validación.
- **Roadmap & Estado**: Actualizar `production/roadmap.md` dentro del bloque `<!-- PRODUCER_STATE -->` actualizando:
  - `Última Tarea Completada: <ID de la tarea>`
  - `Siguiente Paso: <siguiente tarea pendiente [ ]>`
- **Resumen Ejecutivo**: Devolver exclusivamente el Delivery Receipt en 10-15 líneas indicando el siguiente paso ejecutable sin especulación.
