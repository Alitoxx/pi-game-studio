---
name: concept
description: "[ODD Fase 1] Authorize & Vision. De la idea inicial a la visión de juego ejecutable: define la fantasía central, los 3-5 pilares inquebrantables, los anti-pilares y el ancla visual."
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

## Fase 1 ODD: Concept & Vision

Cuando se invoca `/concept` (o `/concept pitch`, `/concept jam`):

### 1. Exploración y Premisa
- Si el usuario proporciona una premisa o idea, se analiza la fantasía central del jugador y las referencias mecánicas.
- Si no hay premisa, se solicita una descripción breve mediante `ask_user_choice` con arquetipos de partida o entrada personalizada.

### 2. Definición de Pilares (3 a 5 Pilares)
- Cada pilar debe contener:
  1. **Nombre y Filosofía**: Lo que hace único al juego.
  2. **Test de Diseño Accionable**: Una pregunta binaria concreta para resolver dudas ("¿Esto refuerza el pilar X?").
- Definir al menos 2 **Anti-Pilares**: Lo que el juego explícitamente NO intentará ser para proteger el alcance.

### 3. Validación Inline y Ancla Visual
- Realizar la validación de coherencia directamente en la conversación (sin esperas de subprocesos externos).
- Presentar 2-3 opciones de **Ancla de Identidad Visual** (paleta, estilo de renderizado y viabilidad en el motor activo).
- Ofrecer selección interactiva con `ask_user_choice`.

### 4. Entrega Viva
- Guardar el documento vivo en `design/gdd/concept.md`.
- Notificar el cierre de fase y sugerir el paso siguiente: `/spec` para detallar el primer sistema.
