---
name: reverse-document
agent: technical-director
description: "[Studio] Reverse Document Existing Codebase — scan an entire game repo or specific systems (Godot, Unity, Unreal, Bevy, Raylib) to reconstruct GDD, architecture, and preferences."
model: inherit
inheritProjectContext: true
tools: read, glob, grep, write, edit, ask_user_question, bash
---

# Reverse Documentation & Codebase Ingestion (`/reverse-document`)

> **Misión**: Analizar código existente (ya sea un repositorio completo sin documentar o un sistema específico implementado sin GDD previo) y reconstruir hacia atrás su **Concepto de Juego**, **GDD base**, **Decisiones de Arquitectura (ADRs)** y **Preferencias Técnicas**.

---

## Modos de Operación

1. **Modo Adopción de Repositorio Completo** (`/reverse-document` sin argumentos o `/reverse-document repo`):
   - Escanea todo el repositorio, detecta motor, cataloga assets, infiere mecánicas globales y genera `design/gdd/game-concept.md` y `.pi/game-studio/technical-preferences.md`.
2. **Modo Sistema Específico** (`/reverse-document <type> <path>`):
   - `<type>`: `design` (GDD de subsistema), `architecture` (ADR técnico), o `concept` (documento conceptual desde prototipo).
   - `<path>`: Directorio o archivo a analizar (e.g. `src/combat/`, `Scripts/Player.cs`).

---

## Modo 1: Adopción y Reconstrucción de Repositorio Completo

### Fase 1a: Auditoría Silenciosa del Repositorio
Escanea la estructura de archivos en busca de huellas digitales de motor:

| Motor | Archivos y Patrones Identificadores |
|---|---|
| **Godot 4** | `project.godot`, scripts `*.gd`, escenas `*.tscn`, shaders `*.gdshader` |
| **Unity** | `ProjectSettings/ProjectVersion.txt`, carpetas `Assets/`, scripts `*.cs` |
| **Unreal Engine** | `*.uproject`, carpetas `Source/`, `Config/DefaultEngine.ini` |
| **Bevy (Rust)** | `Cargo.toml` con dependencia `bevy = "..."`, archivos `src/*.rs` |
| **Raylib (C++)** | `CMakeLists.txt` con `find_package(raylib)` o FetchContent, `#include <raylib.h>`, `#include <entt/entt.hpp>` |

Determina motor, versión, lenguajes, volumen de código e inventario de assets (`.png`, `.aseprite`, `.wav`, `.ogg`, `.gltf`).

### Fase 1b: Mapeo de Entidades y Mecánicas
- **Movimiento y Control**: Búsqueda de `Player`, `Character`, `MovementComponent`, `InputHandler`.
- **Combate y Estado**: Variables de `health`, `damage`, `attack`, `stats`, colisionadores.
- **UI y Menús**: Pantallas de inicio, barras de salud, inventarios.
- **Persistencia**: `SaveGame`, serialización JSON/Resource.

### Fase 1c: Generación de Documentos Base
- Escribe `design/gdd/game-concept.md` con la premisa inferida y estado de sistemas.
- Escribe `.pi/game-studio/technical-preferences.md` con el ruteo de especialistas según el motor detectado.
- Actualiza `project.yaml` con el motor y lenguaje detectados.

---

## Modo 2: Documentación Reversa de Subsistemas Específicos

### Fase 2a: Análisis Profundo de Código
Lee la ruta especificada y extrae:
- Patrones arquitectónicos (Componentes, Singletons, EventBus, State Machines, Queries ECS).
- Fórmulas matemáticas y constantes numéricas en código.
- Nodos, entidades o prefabs que componen el sistema.

### Fase 2b: Aclaración de Intención con el Desarrollador
Presenta los hallazgos con `ask_user_question`:
```
He analizado el código de [path]. Hallazgos:
- Mecánicas detectadas: [Lista]
- Fórmulas: [Fórmulas encontradas]
- Dudas de intención: ¿El sistema de [recurso] fue diseñado para ritmo o escasez táctica?
```

### Fase 2c: Redacción con Plantilla Correspondiente
- Para `design`: Escribe `design/gdd/[system-name].md` usando `prompts/design-doc-from-implementation.md`.
- Para `architecture`: Escribe `docs/adr/ADR-XXXX-[decision-name].md` usando `prompts/architecture-decision-record.md`.
- Para `concept`: Escribe `design/concepts/[name].md` usando `prompts/concept-doc-from-prototype.md`.

---

## Fase 3: Handoff y Radar de Acciones

Presenta el veredicto:
- **COMPLETE**: Documentos creados e indexados.
- Acciones recomendadas inmediatas:
  1. `/smoke-check` para verificar compilación y ejecución base.
  2. `/balance-check` si se detectaron fórmulas numéricas complejas.
  3. `/dev-story` para continuar desarrollando la siguiente feature sobre la arquitectura documentada.
