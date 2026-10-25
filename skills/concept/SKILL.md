---
name: concept
description: "[ODD Fase 1] Authorize & Vision. Role Owner: creative-director (Tier 1 Director). De la idea inicial a la visión de juego ejecutable: define la fantasía central, los 3-5 pilares inquebrantables, los anti-pilares y el ancla visual."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - ask_user_question
---

## Fase 1 ODD: Concept & Vision

- **Role Owner**: `creative-director` (Tier 1 Director)
- **Contrato ODD Compartido**: Consulta [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) para las reglas compartidas de tareas atómicas (~400 líneas), Live Specs en `design/gdd/`, límites de compilación (compiler bounds) y el formato del Return Contract en YAML.

Cuando se invoca `/concept` (o `/concept pitch`, `/concept jam`):

### 1. Exploración y Premisa
- Si el usuario proporciona una premisa o idea, se analiza la fantasía central del jugador y las referencias mecánicas.
- Si no hay premisa, se solicita una descripción breve mediante `ask_user_question` con arquetipos de partida o entrada personalizada.

### 2. Definición de Pilares (3 a 5 Pilares)
- Cada pilar debe contener:
  1. **Nombre y Filosofía**: Lo que hace único al juego.
  2. **Test de Diseño Accionable**: Una pregunta binaria concreta para resolver dudas ("¿Esto refuerza el pilar X?").
- Definir al menos 2 **Anti-Pilares**: Lo que el juego explícitamente NO intentará ser para proteger el alcance.

### 3. Validación Inline y Ancla Visual
- Realizar la validación de coherencia directamente en la conversación (sin esperas de subprocesos externos).
- Presentar 2-3 opciones de **Ancla de Identidad Visual** (paleta, estilo de renderizado y viabilidad en el motor activo).
- Ofrecer selección interactiva con `ask_user_question`.

### 4. Entrega Viva
- Guardar el documento vivo en `design/gdd/concept.md`.
- Notificar el cierre de fase y sugerir el paso siguiente: `/spec` para detallar el primer sistema.

### 5. Cierre Verificable (Done When)

La fase **no cierra cuando el archivo se guarda**: guardar un documento vacío también guarda un archivo. Cierra cuando lo escrito se puede leer y afirmar.

Cierra en `completed` solo si `design/gdd/concept.md` cumple estas cuatro condiciones binarias:
- **Pilares contables**: hay entre 3 y 5 pilares, no uno ni ocho.
- **Verbo por pilar**: cada pilar nombra un verbo repetible que el jugador ejecuta (correr, construir, negociar), nunca una sensación ni un adjetivo (divertido, inmersivo).
- **Loop de tres pasos o menos**: el core loop se lee completo en ≤ 3 pasos, sin sub-loops escondidos dentro.
- **Plataforma y dimensión explícitas**: el documento declara el target (PC, consola, web) y `2d` o `3d`, coherentes con `project.yaml`.

Evidencia que se reporta (un agente sin `bash` no puede ejecutar comandos):

`structural: design/gdd/concept.md: 4 pilares con verbo, loop de 3 pasos, target PC, dimensión 3d`

Si una condición falla, la fase devuelve `partial` nombrando cuál falta. Un concepto hueco no se arrastra a `/spec`: la Live Spec es la fuente de verdad de todas las fases siguientes, así que su primera entrada hereda este vacío.
