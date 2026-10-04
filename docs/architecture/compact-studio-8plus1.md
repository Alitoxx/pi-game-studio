# Arquitectura Oficial del Estudio: 8+1 Agentes y 6 Skills ODD

**Pi Game Studio v1.0.0** adopta formalmente la arquitectura compacta de alta velocidad y bajo consumo de tokens inspirada en **Gentle Shell**, eliminando el catálogo disperso y reduciendo la dotación a:
- **8 roles esenciales de desarrollo Core + 1 especialista dedicado del motor activo** (9 agentes activos).
- **6 skills esenciales de ciclo de vida ODD** (Organic Driven Development).

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

## 3. Las 6 Skills Oficiales de Ciclo de Vida ODD

Siguiendo el estándar de **Organic Driven Development (ODD)**, el estudio opera con 6 fases continuas:

```text
┌── ODD GAMEDEV PIPELINE (6 SKILLS) ────────────────────────────────────┐
│ 1. /concept  ──► Visión, 3-5 Pilares, Anti-Pilares y Ancla Visual      │
│ 2. /spec     ──► Live Specs vivas en design/gdd/<feature>.md          │
│ 3. /arch     ──► ADRs, Manifiesto de Control y Configuración de Motor  │
│ 4. /code     ──► Implementación Atómica en Motor (~400 líneas / test) │
│ 5. /test     ──► Smoke Checks, Playtest, Regresiones y Triaje de Bugs │
│ 6. /ship     ──► Builds de Lanzamiento, Parches y Certificación        │
└───────────────────────────────────────────────────────────────────────┘
```

### 1. `/concept` (Fase de Ideación y Fundamentos)
- **Comando:** `/concept` (o `/concept pitch`, `/concept jam`)
- **Responsables:** `creative-director` & `art-director`
- **Propósito:** De la idea inicial a la visión ejecutable. Define la fantasía del jugador, los 3-5 pilares inquebrantables, los anti-pilares y el ancla de identidad visual sin generar burocracia documental.

### 2. `/spec` (Fase de Live Specs y Diseño de Mecánicas)
- **Comando:** `/spec <sistema>` (o `/spec review`)
- **Responsable:** `game-designer`
- **Propósito:** Creación y mantenimiento de Live Specs en `design/gdd/<feature>.md`. Define reglas de gameplay, fórmulas matemáticas, variables de balance (tuning knobs) y criterios de aceptación claros.

### 3. `/arch` (Fase de Arquitectura Técnica y Motor)
- **Comando:** `/arch` (o `/arch adr`, `/arch budget`, `/arch mcp`)
- **Responsable:** `technical-director`
- **Propósito:** Establece los Architecture Decision Records (ADRs), presupuestos de VRAM/RAM, target de FPS, manifiesto de reglas técnicas estrictas y conexión con herramientas locales o servidores MCP del motor.

### 4. `/code` (Fase de Implementación ODD)
- **Comando:** `/code <feature>` (o `/code review`)
- **Responsables:** `gameplay-programmer` + Especialista de Motor activo
- **Propósito:** Implementación pura y directa en código (`src/`) en paquetes atómicos de ~400 líneas guiados por tests. Cero código no testeado, compilación limpia en motor y actualización instantánea de tareas.

### 5. `/test` (Fase de Calidad, Estabilidad y Balance)
- **Comando:** `/test smoke` (o `/test regression`, `/test balance`, `/test bugs`)
- **Responsable:** `qa-lead`
- **Propósito:** Verificación de calidad continua: smoke checks de arranque, pruebas de regresión, detección de memory leaks (soak tests) y triaje estructurado de bugs con pasos de reproducción.

### 6. `/ship` (Fase de Lanzamiento y Mantenimiento)
- **Comando:** `/ship build` (o `/ship patch`, `/ship release`)
- **Responsable:** `producer`
- **Propósito:** Empaquetado final de builds para distribución (Steam, itch, consolas), verificación de checklists de certificación, extracción de traducciones (i18n), parches de emergencia (hotfix) y changelogs.
