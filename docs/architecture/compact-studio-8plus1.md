# Arquitectura Oficial del Estudio: 8 Core + 1 Motor

**Pi Game Studio** adopta formalmente una arquitectura compacta inspirada en la eficiencia ejecutiva de **Gentle Shell**, eliminando el catálogo disperso y reduciendo la dotación a **8 roles esenciales de desarrollo + 1 especialista dedicado del motor activo**.

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
