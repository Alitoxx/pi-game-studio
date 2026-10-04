---
name: spec
description: "[ODD Fase 2] Live Specs. Diseño de mecánicas, sistemas y fórmulas vivas en design/gdd/<feature>.md con variables de balance (tuning knobs) y criterios de aceptación."
model: inherit
inheritProjectContext: true
tools:
  - read
  - glob
  - grep
  - write
  - edit
  - ask_user_choice
  - ask_user_question
---

## Fase 2 ODD: Live Specs & Design

Cuando se invoca `/spec <feature>` (o `/spec review`):

### 1. Lectura del Estado Actual
- Leer `design/gdd/concept.md` para alinear el sistema con los pilares del juego.
- Si existe código previo en `src/`, inspeccionar estructuras y APIs existentes.

### 2. Redacción de la Live Spec Única
Crear o actualizar exclusivamente el archivo vivo: `design/gdd/<feature>.md`.
La Live Spec debe contener obligatoriamente:
- **Fantasía del Jugador**: Qué experimenta en 1-2 oraciones.
- **Reglas del Sistema**: Lógica paso a paso sin ambigüedades.
- **Fórmulas y Tuning Knobs**: Parámetros numéricos expuestos (velocidad, cooldowns, daño, ratios) en archivos de datos externos (`assets/data/`), nunca hardcodeados.
- **Requisitos de Render & Shaders**: Identificar explícitamente qué efectos visuales de la mecánica requieren shaders en GPU (e.g. atenuación de luz, niebla volumétrica/ruido, distorsión de agua, post-procesado, disolución) en lugar de intentar emularlos con lógica de CPU.
- **Juice & Game Feel**: Micro-retroalimentación háptica y visual obligatoria: tiempos de *hitstop/freeze*, curvas de sacudida de pantalla (*screen shake* con decay exponencial), tolerancia de *coyote time* e *input buffering*, y curvas de interpolación (*easing*).
- **Mapeo de Input & Multi-dispositivo**: Definir acciones semánticas (`Move`, `Interact`, `ActionPrimary`) mapeadas simultáneamente a teclado/ratón y Gamepad (stick analógico + botones estándar). Prohibido atar el diseño a teclas físicas fijas.
- **Ciclo de Vida & Máquina de Estados de la App (App States)**: Definir el comportamiento ante transiciones globales (`Boot`, `MainMenu`, `InGame`, `Paused`, `GameOver`). El estado `Paused` debe congelar el tiempo del juego y la simulación física mientras mantiene la UI interactiva y atenúa el audio.
- **Manifiesto de Assets & Placeholders**: Registrar en `assets/manifest.yaml` cada sprite, textura, audio o shader requerido con sus dimensiones/formato y marcar su estado (`placeholder` vs `final`).
- **Esquema de Estado & Persistencia (Save/Load)**: Estructura exacta de los datos que deben persistir entre sesiones (componentes guardables, inventario, progreso, niebla descubierta).
- **Herramientas de Diagnóstico & Debug Overlay**: Declarar qué variables de estado e indicadores de depuración (gizmos de colisión, radios de percepción, contadores) deben exponerse en la capa de depuración (`F3`).
- **Edge Cases**: Manejo de situaciones límite (desconexión, límites de pantalla, estados concurrentes).
- **Checklist Atómico de Implementación**: Tareas de ~400 líneas cada una con formato `[ ]`, incluyendo explícitamente las tareas de creación de shaders, debug overlay, estados de pausa y assets de sonido.

### 3. Resolución de Incertidumbre
Si existe un dilema de diseño (e.g. tipo de control o fórmula de progresión), se presenta una **TRADE-OFF MATRIX** concisa y se resuelve interactivamente con `ask_user_choice`.
