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
La Live Spec debe contener:
- **Fantasía del Jugador**: Qué experimenta en 1-2 oraciones.
- **Reglas del Sistema**: Lógica paso a paso sin ambigüedades.
- **Fórmulas y Tuning Knobs**: Parámetros numéricos expuestos (velocidad, cooldowns, daño, ratios).
- **Edge Cases**: Manejo de situaciones límite (desconexión, límites de pantalla, estados concurrentes).
- **Checklist Atómico de Implementación**: Tareas de ~400 líneas cada una con formato `[ ]`.

### 3. Resolución de Incertidumbre
Si existe un dilema de diseño (e.g. tipo de control o fórmula de progresión), se presenta una **TRADE-OFF MATRIX** concisa y se resuelve interactivamente con `ask_user_choice`.
