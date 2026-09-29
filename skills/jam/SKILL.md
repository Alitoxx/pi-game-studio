---
name: jam
agent: producer
description: "[Studio] Game Jam Mode — compressed 48-72h development workflow. Suspends heavy bureaucracy and enforces rapid iteration."
model: inherit
inheritProjectContext: true
tools: read, glob, grep, write, edit, ask_user_question, bash
---

# Game Jam Mode (48-72h Compressed Workflow)

> **Misión**: Entregar un prototipo jugable, divertido y libre de crashes antes de que termine el reloj de la Game Jam (Ludum Dare, GMTK, Global Game Jam, etc.). En una jam, **el alcance implacable vence a la perfección**.

---

## Protocolo de Reglas Relajadas (Jam Overrides)

Durante la activación de `/jam`, las reglas habituales del estudio quedan **explícitamente suspendidas**:

| Práctica Estándar del Estudio | Modificación en Modo Jam |
|---|---|
| **GDD Completo** (`/gdd`) | **Suspendido.** Usar el *One-Page Jam Spec* generado por esta skill. |
| **Revisiones de Código Rigurosas** (`/code-review`) | **Suspendido.** Si funciona sin crashear a 60 FPS, se aprueba. Código rápido sobre arquitectura abstracta. |
| **Auditoría de Accesibilidad Completa** | **Suspendida.** Solo controles básicos estándar (WASD, ratón, barra espaciadora / Gamepad). |
| **Sprints y Velocidad** (`/sprint-plan`) | **Suspendido.** Sprints ultra cortos de 2 horas con objetivos atómicos y un timer estricto. |
| **Testing Unitario Masivo** (`/test-setup`) | **Suspendido.** Pruebas manuales inmediatas y smoke check mínimo. Presiona Play: ¿arranca y responde? Pasa. |
| **Localización / i18n** (`/localize`) | **Suspendida.** Un solo idioma (o interfaz visual sin texto). La claridad visual triunfa sobre cadenas traducidas. |

### Reglas NO Negociables (Guardrails de Jam)
1. **Control de versiones implacable**: Hacer `git commit` cada 30-45 minutos. Perder 3 horas por un archivo corrupto destruye la jam.
2. **Build Pipeline en las primeras 2 horas**: Probar el pipeline de exportación (HTML5/Web o binario ejecutable) de inmediato. Descubrir que el build falla en la hora 46 es fatal.
3. **Mecánica Única (One Core Hook)**: Un juego de jam necesita UNA sola mecánica distintiva ejecutada con excelente *game feel*.

---

## Fase 1: Briefing y Configuración de la Jam

Detecta el idioma (es/en) y solicita los datos de la jam con `ask_user_question`:

1. **Nombre y Duración**: (e.g. GMTK Jam 48h, Ludum Dare Compo 48h, Jam 72h).
2. **Tema de la Jam**: El tema revelado (e.g., "Roles Reversos", "Construido para Romperse", etc.).
3. **Motor Seleccionado**: Godot, Raylib, Bevy, Unity o Unreal.

---

## Fase 2: Brainstorming Rápido de Jam (30 min máx)

Genera 3 ideas de juego ultra enfocadas basadas en el tema:

Para cada idea evalúa:
* **The Hook**: ¿Por qué es divertida o memorable en los primeros 10 segundos?
* **Riesgo Técnico (1 a 5)**: ¿Se puede implementar en menos de 8 horas de código?
* **Art/Audio Feasibility**: ¿Depende de assets complejos o se puede resolver con geometría simple/shaders/CC0?

Usa `ask_user_question` para que el desarrollador elija el concepto ganador.

---

## Fase 3: The One-Page Jam Spec

Crea el archivo `design/jam-spec.md` con esta estructura concisa:

```markdown
# Jam Game Spec: [Nombre del Proyecto]
> **Jam**: [Nombre / Horas] | **Tema**: [Tema] | **Fecha Límite**: [Timestamp]

## 1. El Core Loop (10 Segundos)
- Acción del jugador -> Reacción del mundo -> Recompensa/Feedback.

## 2. Controles
- Input mínimo requerido (Teclado/Mouse o Gamepad).

## 3. Scope Cut Tiers
- **Must Have (MVP - Primeras 12 horas)**: Movimiento, core hook funcional, pantalla de Game Over/Win.
- **Should Have (Horas 13-30)**: 3 tipos de enemigos/obstáculos, audio SFX, pulido visual/screen shake.
- **Could Have (Horas 31-42)**: Música de fondo, menú principal estilizado, tabla de puntuación local.
- **Cut List (Lo primero que se descarta si falta tiempo)**: Historia profunda, cinemáticas, múltiples niveles.

## 4. Pipeline de Build
- Target de entrega: [Web HTML5 / PC Windows / Linux / macOS].
```

---

## Fase 4: Jam Sprint Board (Bloques de 2 Horas)

Organiza el desarrollo en 4 bloques críticos:

* **Bloque 1: Cimientos y Smoke Test de Build (Horas 0-4)**
  - Proyecto inicializado.
  - Export probada y verificada (Web o binario ejecutable).
  - Actor principal moviéndose en pantalla.
* **Bloque 2: Core Loop Jugable (Horas 4-16)**
  - Mecánica central interactiva.
  - Condición de victoria y derrota implementada.
  - Primera prueba de diversión del loop.
* **Bloque 3: Variedad y Feedback Jugable (Horas 16-36)**
  - Sonidos de impacto y feedback de audio.
  - Efectos visuales mínimos (partículas, destellos, animación simple).
  - Ajuste de dificultad y curva de reto.
* **Bloque 4: Freeze de Features y Empaque (Horas 36-48)**
  - FEATURE FREEZE total en la hora 40. Cero mecánicas nuevas.
  - Limpieza de bugs bloqueantes.
  - Creación de capturas de pantalla, descripción y página de itch.io / jam submission.
  - Entrega de build final con al menos 2 horas de margen de seguridad.

---

## Fase 5: Handoff y Radar de Acciones

Presenta al usuario su plan de batalla inmediato:
* "¿Comenzamos con el Bloque 1 implementando el movimiento base y verificando el build export?"
