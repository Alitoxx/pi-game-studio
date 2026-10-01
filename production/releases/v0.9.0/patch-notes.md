# Pi Game Studio v0.9.0 — Cinco motores, un mismo estudio

Esta versión es el salto de "un asistente que sabe de juegos" a "un estudio que conoce tu motor". La instalación ya no despliega los 55 agentes indiscriminadamente: elige tu línea de trabajo y el estudio se rearma a medida, sin especialistas peleándose por el mismo problema.


---

## Nuevo Contenido

### Instalación selectiva de motores (Enfoque A)

`/setup` ahora detecta tu motor desde `project.yaml` e instala **únicamente** los especialistas que vas a usar.

| Motor | Especialistas | Agentes totales |
|---|---|---|
| **Bevy** (Rust) | 1 | 35 |
| **Godot 4** | GDScript, C#, GDExtension, Shaders + General | 39 |
| **Raylib** (C++/EnTT) | EnTT ECS, Shaders, UI/ImGui, CMake/Build + General | 39 |
| **Unity** | DOTS/ECS, Addressables, Shader/VFX, UI + General | 39 |
| **Unreal 5** | GAS, Blueprints, Replication, UMG + General | 39 |

Los **34 agentes base** (directores, leads de departamento, especialistas de diseño, QA, DevOps, live-ops) están siempre presentes: la estructura del estudio no depende del motor.

### Especialistas por motor

- **Bevy** — `bevy-specialist`: ECS, scheduling, render pipeline, assets.
- **Godot** — separación real entre GDScript tipado, C#, GDExtension nativa y GLSL.
- **Raylib** — Data-Oriented Design con EnTT, build multiplataforma, Dear ImGui.
- **Unity** — DOTS/ECS, Addressables para contenido, HLSL/VFX, UI Toolkit.
- **Unreal** — GAS, predicción de cliente en red, Widgets UMG/CommonUI.

Cada especialista conoce los patrones, APIs y trampas de su motor. La diferencia entre "un modelo que alguna vez leyó sobre GAS" y uno que te avisa que estás usando predicción donde no toca.

---

## Cambios de Gameplay (del flujo de trabajo)

- **`/assign-models` acepta configuración por nivel.** Elegís un modelo para directives, uno para workhorses y uno para las tareas ligeras de comunidad y logs, o afinás motor por motor.
- **Prompts de agente con presupuesto de razonamiento visible.** Cada agente declara en qué rung piensa; sabés por qué una respuesta de dirección cuesta más que un triage de bug.

## Correcciones

- **Selección interactiva con respuesta libre.** `ask_user_choice` y `ask_user_question` ahora ofrecen "Otro (escribir respuesta personalizada)..." — escribís tu alternativa y el flujo sigue. Tests funcionales incluidos (`test(choice)`).
- **Errores de render en el HUD.** `ReferenceError CYAN` y `branch variable` en `renderStudioFooterBar` — el pie de estado podía romper en condiciones de tema claro.
- **Emojis decorativos eliminados del HUD.** El estado del estudio ya no rompe la lectura de terminal sobria.

---

## Problemas Conocidos

- La instalación selectiva es por motor, no por tarea: un proyecto que toca dos motores (ej. tooling en Godot + build en Unity) exige reinstalar el paquete completo.
- Las versiones pinneadas de motor se documentan por proyecto; la configuración global todavía no distingue motores por directorio.

---

## Notas del Equipo

Este release no agrega una función de juego: agrega criterio. El patrón de fondo es que un estudio real no contrata a 55 personas para un proyecto — contrata un equipo y lo ajusta al proyecto. El kit hace lo mismo con los agentes: estructura completa, especialistas donde hay riesgo técnico real, cero relleno donde nadie va a trabajar.

La próxima línea: soporte multi-motor por proyecto y presets por vertical slice.
