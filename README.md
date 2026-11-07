# Pi Game Studio — Skills de Gamedev para Gentle Shell

[![Validate](https://github.com/Alitoxx/pi-game-studio/actions/workflows/validate.yml/badge.svg)](https://github.com/Alitoxx/pi-game-studio/actions/workflows/validate.yml)
[![Release](https://img.shields.io/github/v/release/Alitoxx/pi-game-studio)](https://github.com/Alitoxx/pi-game-studio/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Paquete modular de **7 skills de ingeniería de videojuegos** diseñado para integrarse de forma nativa en **[Gentle Shell](https://github.com/gentleprogramming/gentle-ai)** y **[Pi](https://pi.dev)**.

---

## Filosofía: Directo al Código, Cero Arnés Duplicado

En lugar de mantener un arnés paralelo o exigir documentos de diseño intermedios (GDDs), **Pi Game Studio v2.0** delega toda la orquestación, el flujo **ODD (Organic Driven Development)** y la ejecución de subagentes (`gentle-ai-explore`, `gentle-ai-worker`, `gentle-ai-verify`) al motor nativo de **Gentle Shell**.

```text
[Tu Prompt en Gentle Shell]
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│ Gentle Shell (Orquestador Nativo + ODD + Subagentes)         │
└───────────┬──────────────────────────────────────┬───────────┘
            │ Carga bajo demanda                   │ Delega e inyecta skill
            ▼                                      ▼
┌───────────────────────────────────┐  ┌───────────────────────────────────┐
│ skills/gamedev-core/SKILL.md      │  │ skills/gamedev-<motor>/SKILL.md   │
│ • Movimiento con delta time       │  │ • Godot 4 / Bevy / Phaser         │
│ • Coyote time & Input buffering   │  │ • Raylib / Unity / Unreal 5       │
│ • Máquinas de estado limpias      │  │ • Patrones idiomáticos y shaders  │
│ • Cero heap allocations por frame │  │ • Verificación headless rápida    │
└───────────────────────────────────┘  └───────────────────────────────────┘
```

---

## Catálogo de Skills (`skills/`)

| Skill | Motor / Alcance | Qué aporta automáticamente |
|---|---|---|
| **`gamedev-core`** | Universal (Base) | Física en fixed-timestep, `delta` time, controles desacoplados (teclado + gamepad), *input buffering* (80–150 ms), *coyote time* (80–120 ms), *hitstop*, *screen shake*, cero *heap allocations* por frame, buses de audio y overlay de depuración `F3`. |
| **`gamedev-godot`** | **Godot 4.x** (GDScript / C#) | Composición de nodos sobre herencia, GDScript con tipado estático estricto, recursos de datos `.tres`, señales tipadas (`SignalBus`), pooling, `MultiMeshInstance`, shaders `.gdshader` y pruebas headless con watchdog en `SceneTree`. |
| **`gamedev-bevy`** | **Bevy Engine** (Rust ECS) | Arquitectura modular por `Plugin`, disyunción de `Query` (`Without<T>`), `Query` vs `Commands`, estados `OnEnter`/`OnExit`, componentes requeridos (`Mesh3d`, `AudioPlayer` con `DESPAWN`), WGSL y tests aislados con `MinimalPlugins`. |
| **`gamedev-phaser`** | **Phaser 3 / 4** (TypeScript) | Ciclo de vida estricto (`init`, `preload`, `create`, `update`, `shutdown`), limpieza obligatoria en `SHUTDOWN` contra fugas de memoria, Arcade vs Matter physics, pooling con `Group`, configuración pixel-art y bundling con Vite. |
| **`gamedev-raylib`** | **Raylib 5.x** (C++17/20 + EnTT) | Acumulador de timestep fijo desacoplado del render, wrappers RAII para recursos de GPU/audio, vistas EnTT cache-friendly (`registry.view`), ordenamiento Y-sort en 2D, caché de uniforms GLSL 330 y CMake + CTest. |
| **`gamedev-unity`** | **Unity** (C#) | Arquitectura orientada a datos con `ScriptableObjects`, partición modular con `.asmdef`, cero GC en `Update` (`RaycastNonAlloc`, `ObjectPool<T>`, `Shader.PropertyToID`, `MaterialPropertyBlock`), New Input System y tests EditMode. |
| **`gamedev-unreal`** | **Unreal Engine 5** (C++) | Seguridad estricta de Garbage Collection (`UPROPERTY`, `TObjectPtr`, `TWeakObjectPtr`, `TSoftObjectPtr`), supresión de `Tick` por defecto, Gameplay Ability System (GAS), Enhanced Input y reglas de replicación de red. |

---

## Instalación

Instala el paquete directamente en Pi desde GitHub:

```bash
pi install https://github.com/Alitoxx/pi-game-studio
# o fijado a una versión:
pi install git:github.com/Alitoxx/pi-game-studio@v2.0.0
```

O desde una copia local si clonaste el repositorio:

```bash
pi install /ruta/a/pi-game-studio
```

---

## Cómo se usa en el día a día

No necesitas ejecutar comandos de configuración previa ni mantener archivos de estado adicionales.

1. Abre tu terminal con **Gentle Shell** dentro de la carpeta de tu juego.
2. Pide la mecánica, el sistema o el prototipo directamente en lenguaje natural:
   - **Godot 4**: *"Implementa un controlador CharacterBody2D con dash, coyote time, buffer de salto y un shader de hit-flash al recibir daño."*
   - **Bevy**: *"Crea un plugin ECS de proyectiles con object pooling, colisiones desacopladas por eventos y pruebas unitarias con MinimalPlugins."*
   - **Phaser**: *"Arma la escena principal con Arcade Physics, pool de enemigos y limpieza completa de eventos al reiniciar la escena."*
   - **Raylib / C++**: *"Configura el bucle principal con timestep fijo a 60 Hz, cámara 2D con seguimiento suave y renderizado ordenado por eje Y usando EnTT."*
3. Gentle Shell detecta el motor del proyecto, carga **`gamedev-core`** junto con la skill del motor correspondiente y aplica las reglas directamente sobre tus archivos de código.

También puedes invocar cualquier skill de forma manual en el chat con `/skill:gamedev-core`, `/skill:gamedev-godot`, `/skill:gamedev-bevy`, `/skill:gamedev-phaser`, `/skill:gamedev-raylib`, `/skill:gamedev-unity` o `/skill:gamedev-unreal`.

---

## Servidores MCP Recomendados (Opcionales)

Para potenciar aún más el flujo en Gentle Shell al desarrollar videojuegos, se recomiendan estos 3 servidores MCP:

- **Engram (`mcp__engram`)**: Memoria persistente entre sesiones para conservar decisiones de arquitectura, balance y tareas ODD.
- **Context7 (`mcp__context7`)**: Consulta en tiempo real de documentación actualizada de motores (Godot 4, Bevy, Phaser, Raylib, Unity, Unreal).
- **Codegraph (`mcp__codegraph`)**: Grafo semántico de llamadas y dependencias entre sistemas ECS, nodos y componentes.

---

## Estructura del Repositorio

```text
pi-game-studio/
├── package.json                  # Manifiesto Pi ("pi": { "skills": ["./skills"] })
├── README.md                     # Documentación principal
├── AGENTS.md                     # Guía de arquitectura de skills y convenciones
├── CHANGELOG.md                  # Historial de versiones
├── LICENSE                       # Licencia MIT
└── skills/
    ├── gamedev-core/SKILL.md     # Ingeniería base de gameplay y cero allocations
    ├── gamedev-godot/SKILL.md    # Especialización Godot 4.x
    ├── gamedev-bevy/SKILL.md     # Especialización Bevy Engine (Rust)
    ├── gamedev-phaser/SKILL.md   # Especialización Phaser 3/4 (TypeScript)
    ├── gamedev-raylib/SKILL.md   # Especialización Raylib (C++17/20 + EnTT)
    ├── gamedev-unity/SKILL.md    # Especialización Unity (C#)
    └── gamedev-unreal/SKILL.md   # Especialización Unreal Engine 5 (C++)
```

---

## Licencia

Distribuido bajo la licencia **MIT**. Consulta el archivo [LICENSE](LICENSE) para más detalles.
