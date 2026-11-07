# Changelog

Todos los cambios relevantes de **Pi Game Studio** se documentan en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto sigue [Semantic Versioning](https://semver.org/lang/es/).

---

## [2.0.0] - 2026-04-19

### Changed (Arquitectura Pura de Skills para Gentle Shell)
- **Transformación completa a paquete nativo de skills (`skills/`) para Gentle Shell**:
  - Se delega el 100% de la orquestación, el seguimiento ODD y los subagentes (`gentle-ai-explore`, `gentle-ai-worker`, `gentle-ai-verify`) al arnés nativo de **Gentle Shell**.
  - Flujo directo al código (*Direct-to-Code*): cero generación obligatoria de GDDs (`design/gdd/`) ni roadmaps paralelos.
- **Nuevas Skills Modulares de Ingeniería de Videojuegos**:
  - `gamedev-core`: Reglas universales de *game loop*, movimiento independiente de framerate (`delta`), *input buffering*, *coyote time*, máquinas de estado, jerarquía de buses de audio, overlay de depuración `F3` y disciplina estricta de cero *heap allocations* por frame.
  - `gamedev-godot`: Ingeniería en Godot 4.x (GDScript tipado, composición de nodos, recursos `.tres`, señales tipadas, pooling, `MultiMeshInstance`, shaders `.gdshader` y pruebas headless con `SceneTree`).
  - `gamedev-bevy`: Ingeniería en Bevy Engine (Rust ECS modular por `Plugin`, `Query` vs `Commands`, estados `OnEnter`/`OnExit`, `Mesh3d`, shaders WGSL, audio y pruebas con `MinimalPlugins`).
  - `gamedev-phaser`: Ingeniería en Phaser 3/4 con TypeScript (ciclo de vida de escenas, limpieza en `SHUTDOWN`, física Arcade vs Matter, pooling con `Group`, pixel-art WebGL y Vite).
  - `gamedev-raylib`: Ingeniería en Raylib 5.x con C++17/20 y EnTT ECS (bucle de timestep fijo, wrappers RAII para GPU/audio, vistas EnTT cache-friendly, ordenamiento Y-sort, shaders GLSL 330 y CMake).
  - `gamedev-unity`: Ingeniería en Unity C# (`ScriptableObjects`, partición con `.asmdef`, cero GC en `Update`, `RaycastNonAlloc`, `ObjectPool<T>`, New Input System y URP/HDRP).
  - `gamedev-unreal`: Ingeniería en Unreal Engine 5 C++ (seguridad GC con `UPROPERTY`/`TObjectPtr`, Gameplay Ability System - GAS, Enhanced Input, supresión de Tick por defecto y Niagara).

### Removed
- Eliminado el arnés paralelo de subagentes y extensiones TUI (`agents/`, `chains/`, `extensions/`, `bin/pi-studio.mjs`, `models.default.json`, `project.yaml`).
- Eliminadas las antiguas skills acopladas a GDD (`concept`, `spec`, `arch`, `code`, `test`, `ship`) y los directorios auxiliares (`scripts/`, `starters/`, `templates/`, `design/`, `production/`, `docs/`, `themes/`).
