# Propuesta Arquitectónica: Ejecución Eficiente de Agentes al Estilo Gentle Shell en Pi Game Studio

**Objetivo:** Transformar la ejecución de los agentes de Pi Game Studio para eliminar la lentitud, los timeouts, el sangrado de trazas internas en el chat y el consumo masivo de tokens, adoptando la arquitectura probada de **Gentle Shell (`agy`)**.

---

## 1. El Problema Actual vs. La Solución Gentle Shell

```
ARQUITECTURA ACTUAL (Pesada y Frágil)
Usuario ──► Orquestador
              │
              ├──► Subproceso con Prompt Masivo (16 KB)
              │    (creative-director / art-director)
              │    - Thinking "high" (demora 30-45s)
              │    - Intenta hacer búsquedas web
              │    - Causa TIMEOUT ──► Fallback escupe "modo lean" y tool calls rotas en el chat
              ▼

ARQUITECTURA PROPUESTA: GENTLE GAMEDEV (Delgada, Rápida y Limpia)
Usuario ──► Orquestador Senior (Studio Director)
              │ (Mantiene la conversación limpia, el TUI y los modales interactivos)
              │
              ├──► Worker Especialista Delgado (1-2 KB de Prompt)
              │    - Inyecta únicamente: Allowed Edit Surfaces + Tarea Concreta + Verification
              │    - Thinking "medium" / "low" (Responde en 2-4 segundos)
              │    - Prohibido hablar o imprimir texto: Devuelve SOLO el Return Contract YAML
              ▼
Orquestador presenta el resultado consolidado al usuario sin trazas internas
```

---

## 2. Los 4 Pilares del Rediseño

### Pilar 1: Poda de Prompts de Agentes (De 16 KB a Directivas Ejecutivas de 2 KB)
- **Situación actual:** `creative-director.md` tiene 313 líneas de teoría abstracta (psicología de Deci & Ryan, ejemplos de God of War, etc.).
- **Rediseño:** Trasladar la teoría de fondo a manuales en `docs/` y dejar en los archivos `.md` del agente únicamente:
  1. Rol y límites de autoridad.
  2. Superficies de archivo habituales (`design/gdd/`, `src/`).
  3. Contrato de retorno estructurado (`status`, `summary`, `files_changed`, `validation`).
- **Ahorro:** Reducción de más del **75% de tokens de entrada** en cada llamada.

---

### Pilar 2: Thinking Budget y Model Profiles Racionales
- **Situación actual:** Los directores usan `thinking: high` forzado en todas partes, generando hasta 16,000 tokens invisibles de pensamiento por un simple chequeo de 4 pilares.
- **Rediseño (esquema `subagents.json` de Gentle Shell):**
  - **Exploración y Búsqueda (`explore`):** Thinking `low` / modelo `flash` (ultra-rápido, ~1-2s).
  - **Implementación y Código (`worker`):** Thinking `medium` (balance perfecto de razonamiento y velocidad).
  - **Juicio y Conflicto Mayor (`director-gate`):** Thinking `high` **únicamente** cuando hay contradicciones técnicas graves o cambios de arquitectura de motor.

---

### Pilar 3: Separación Estricta entre Conversación y Ejecución (Zero Bleed)
- **Regla inquebrantable:** Un subagente **nunca interactúa directamente con el usuario** ni muestra herramientas interactivas.
- Solo el **Orquestador Principal** en la sesión padre tiene permitido:
  1. Hablar con el usuario.
  2. Invocar `ask_user_choice` / `ask_user_question` (modales interactivos nativos).
  3. Mostrar el Banner TUI y los resúmenes ejecutivos.
- Si un subagente necesita una decisión humana, responde con:
  ```yaml
  status: interaction_required
  interaction_required:
    question: "Solape entre pilar 2 y 4"
    options:
      - "Mantener como están"
      - "Fusionar en un solo pilar"
      - "Ajustar redacción"
  ```
  El Orquestador lee ese bloque y renderiza el modal nativo en la terminal de forma limpia y transparente.

---

### Pilar 4: Optimización del Runner RPC (`studio-agents-runner.ts`)
- Configurar el timeout y el watchdog de inactividad de forma adaptativa:
  - Tareas de exploración/revisión: timeout corto (30s).
  - Tareas de compilación/tests (`cargo build`, `npm test`): watchdog extendido sólo mientras hay salida viva de herramientas.
- Auto-descarte de `web_search` en subagentes para evitar bloqueos de red externos no solicitados.
- Eliminar los mensajes de rescate que imprimen *"modo lean"* o *"ventana de respuesta excedida"* en el chat; el fallback debe ser silencioso y elegante.

---

## 3. Plan de Acción Inmediato

| Fase | Tarea | Impacto |
|---|---|---|
| **Fase 1** | Podar y optimizar `creative-director.md` y `art-director.md` eliminando monólogos teóricos. | Reducción inmediata de 10k tokens por turno y arranque instantáneo. |
| **Fase 2** | Ajustar `thinking` de `high` a `medium` en los agentes de dirección en `models.default.json` y agentes locales. | Respuestas 3x más rápidas sin esperas congeladas. |
| **Fase 3** | Corregir la Fase 4 de `/brainstorm` para que la validación inicial de pilares ocurra inline (en la misma sesión) y delegue sólo cuando se requiera código o archivos pesados. | Cero fallos de timeout en la fase de ideación. |
| **Fase 4** | Sincronizar los cambios a `juegosprueba` y correr la prueba de validación. | Verificación práctica con el juego del usuario. |
