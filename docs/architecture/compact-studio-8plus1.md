# Arquitectura Oficial del Estudio: 8+1 Agentes y 16 Skills Compactas

**Pi Game Studio v1.0.0** adopta formalmente la arquitectura compacta de alta velocidad y bajo consumo de tokens inspirada en **Gentle Shell**, eliminando el catálogo disperso y reduciendo la dotación a:
- **8 roles esenciales de desarrollo Core + 1 especialista dedicado del motor activo** (9 agentes activos).
- **16 skills esenciales agrupadas en 4 categorías claras** (reemplazando las 80 micro-skills).

---

## 1. El Equipo Oficial de 8 Agentes Core

| Agente | Nombre Archivo | Rol y Responsabilidad Principal |
|---|---|---|
| **1. Producer (Lead Orchestrator)** | `producer.md` | Orquestador principal de la sesión, planning, milestones, roadmap y gating. |
| **2. Creative Director** | `creative-director.md` | Máxima autoridad creativa: visión de juego, los 3-5 pilares, estética y tono. |
| **3. Technical Director** | `technical-director.md` | Arquitectura técnica global, target FPS, budget de memoria y viabilidad de motor. |
| **4. Game Designer** | `game-designer.md` | Core loop, diseño de mecánicas, sistemas de progresión y balance numérico. |
| **5. Gameplay Programmer** | `gameplay-programmer.md` | Programador de mecánicas, controladores, físicas y lógica central de juego. |
| **6. Art Director** | `art-director.md` | Dirección visual, biblia de arte, paleta de color y especificaciones de assets. |
| **7. Audio Director** | `audio-director.md` | Identidad sonora, música reactiva, efectos de sonido y mezcla de audio. |
| **8. QA Lead** | `qa-lead.md` | Testing continuo, verificación ODD, regresiones, smoke checks y triaje de bugs. |

---

## 2. El Especialista de Motor Activo (+1)

Dependiendo del motor configurado en `project.yaml`, se activa **un único especialista de motor**:

- **Bevy (Rust)** ──► `bevy-specialist.md` (ECS idiomático, wgpu, WASM, cargo)
- **Godot 4** ────────► `godot-specialist.md` (Nodos, GDScript/C#, shaders, GDExtension)
- **Raylib (C++)** ───► `raylib-specialist.md` (EnTT ECS, GLSL shaders, ImGui, CMake)
- **Unity** ──────────► `unity-specialist.md` (MonoBehaviour, DOTS, Shader Graph, UI)
- **Unreal Engine 5** ► `unreal-specialist.md` (C++, GAS, Blueprints, UMG, Replication)

**Total activo por proyecto:** Exactamente **9 agentes** (8 Core + 1 Motor).

---

## 3. Las 16 Skills Compactas del Estudio

### Categoría 1: Concepto, Diseño y Arte
1. **`/brainstorm`**: Ideación, visión, definición de los 3-5 pilares, anti-pilares y benchmarking de mercado.
2. **`/gdd-write`**: Redacción y actualización de Game Design Documents (GDD) vivos en `design/gdd/`.
3. **`/gdd-review`**: Auditoría de coherencia, solapamientos, economía y reglas de diseño.
4. **`/art-bible`**: Dirección de arte, paletas de color, especificación y auditoría de assets visuales y sonoros.

### Categoría 2: Arquitectura y Motor
5. **`/architecture`**: Documento maestro de arquitectura, manifiesto de control y reglas técnicas estrictas.
6. **`/adr`**: Registro de decisiones de arquitectura técnica (Architecture Decision Records) con trade-offs.
7. **`/perf-audit`**: Auditoría de rendimiento, memory leaks, target FPS y vectores de seguridad.
8. **`/engine-hub`**: Configuración de motor, diagnósticos de toolchain local y conexión con servidores MCP / memoria Engram.

### Categoría 3: Producción y Desarrollo ODD
9. **`/roadmap`**: Planificación de hitos, sprint planning, tracking y burndown en `production/roadmap.md`.
10. **`/dev-story`**: Implementación ODD de tareas atómicas (~400 líneas) guiadas por tests directamente en código.
11. **`/code-review`**: Revisión de código, memory safety, convenciones y cierre formal de tareas.
12. **`/tech-debt`**: Registro, priorización y triaje de deuda técnica y refactorizaciones.

### Categoría 4: QA, Playtesting y Lanzamiento
13. **`/qa-verify`**: Suite integral de control de calidad, smoke checks, regresiones y triaje de bugs.
14. **`/playtest`**: Registro y síntesis de playtesting con jugadores y balance de curvas numéricas.
15. **`/release`**: Checklist de certificación en tiendas (Steam, itch, consoles) y empaquetado de builds.
16. **`/patch`**: Parches de emergencia (hotfix), parche día uno, changelog y notas de comunidad.
