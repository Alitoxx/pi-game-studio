---
name: setup
description: "🎮 [Studio] Interactive guided installation of Pi Game Studio. Explains every step, asks for your confirmation before writing files, and sets up agents and models."
model: inherit
inheritProjectContext: true
tools: read, glob, write, edit, bash, ask_user_question
---

# Pi Game Studio — Interactive Setup & Onboarding

This skill sets up your game studio in the current project.
**Rule #1: Transparency.** Never write files or make modifications silently. Always explain what is going to happen, present the proposed configuration, and wait for explicit user confirmation.

---

## Phase 1: Welcome & Pre-Installation Briefing

Detect the user's preferred language from recent context (use Spanish if the user addresses you in Spanish, otherwise English).

Present a clear, friendly briefing explaining what Pi Game Studio is and what this setup will do:

> "¡Bienvenido a **Pi Game Studio**! 🎮
> Vamos a transformar este proyecto en un estudio de desarrollo de videojuegos completo con un equipo de IA coordinado.
>
> **Esto es lo que configuraremos:**
> 1. **Agentes especializados optimizados** en `.pi/agents/` (34 agentes base del estudio + especialistas dedicados a tu motor: Godot, Unity, Unreal, Bevy o Raylib).
> 2. **Configuración de motor** en `project.yaml`.
> 3. **Configuración de modelos de IA** en `.pi/gentle-ai/models.json` optimizada por niveles de responsabilidad (Estrategia, Desarrollo y Tareas ligeras).
> 4. **Registro de 80 skills** de diseño, prototipado y producción en `.pi/settings.json`.
> 5. **Detección de memoria persistente (Engram)** para recordar tus decisiones cross-session."

Ask using `ask_user_question`:

```
ask_user_question: "¿Cómo deseas proceder con la instalación?"
  - standard: "1. Instalación recomendada (Rápida y balanceada — motor auto-detectado + agentes optimizados)"
  - custom: "2. Instalación guiada paso a paso (Seleccionar motor, idioma y modelos)"
  - cancel: "3. Cancelar instalación"
```

If `cancel`: Stop immediately without writing any file. Inform the user: *"Instalación cancelada. No se ha modificado ningún archivo."*

---

## Phase 2: Game Engine Selection

If `project.yaml` exists, detect the configured engine. Otherwise ask the user:

```
ask_user_question: "Selecciona el motor de videojuegos principal para tu proyecto:"
  - godot: "1. Godot 4 (GDScript / C# — Ligero, open source)"
  - unity: "2. Unity (C# — 2D/3D multiplataforma)"
  - unreal: "3. Unreal Engine 5 (C++ / Blueprints — Alta fidelidad)"
  - bevy: "4. Bevy (Rust ECS — Moderno y ultra rápido)"
  - raylib: "5. Raylib (C++ / EnTT — Puro código, sin editores pesados)"
```

Write or update `project.yaml` with the chosen engine:
```yaml
schema_version: 1
engine: "Godot" # or Unity, Unreal, Bevy, Raylib
```

---

## Phase 3: Check Existing Project State

Check if the project already has files:
1. Glob `.pi/agents/**/*.md`
2. Check if `.pi/gentle-ai/models.json` exists.

If existing agents are detected:
```
ask_user_question: "Este proyecto ya tiene agentes instalados. ¿Qué deseas hacer?"
  - overwrite: "Actualizar e instalar los agentes del motor seleccionado"
  - backup-overwrite: "Hacer un respaldo antes de actualizar"
  - keep: "Mantener los agentes actuales y solo configurar modelos/skills"
```

---

## Phase 4: Model Configuration Selection

Present the recommended model assignment with clear rationale:

> "Para que el equipo funcione, cada agente necesita un modelo de IA asignado según su rol:
> • **Directores (3 agentes)**: Razonamiento de alto nivel para visión y arquitectura (`gpt-5.4-mini` o equivalente).
> • **Workhorses**: Desarrollo diario de código, diseño, testing y motor elegido (`gpt-oss-120b:free` o equivalente).
> • **Ligeros**: Tareas auxiliares rápidas (`gpt-oss-20b:free`)."

Ask using `ask_user_question`:

```
ask_user_question: "¿Qué configuración de modelos prefieres usar?"
  - default: "Usar la configuración recomendada por defecto (Lista para usar)"
  - inherit: "Usar 'model: inherit' (Todos los agentes usarán el modelo activo en tu sesión de Pi)"
  - custom: "Personalizar los modelos por Tier ahora mismo (/assign-models)"
```

---

## Phase 5: Engram Detection & Confirmation

Before creating `.pi/game-studio/`, create the directory:
`bash: mkdir -p .pi/game-studio`

Check `.pi/mcp.json` and run `which engram 2>/dev/null`:
- If Engram is detected and connected:
  Inform the user: *"Se detectó Engram (memoria persistente). Las decisiones de diseño y checkpoints se guardarán automáticamente entre sesiones."*
  Write `.pi/game-studio/engram-enabled`: `true`
- If Engram is not found:
  Inform the user: *"Engram no está configurado. Las decisiones se guardarán en archivos Markdown locales del proyecto (modo estándar)."*
  Write `.pi/game-studio/engram-enabled`: `false`

---

## Phase 6: Execute Installation (with visual progress)

Inform the user: *"Instalando componentes..."*

1. **Deploy Engine-Filtered Agents**:
   - Create `.pi/agents/` if needed.
   - Copy the 34 Core Studio Agents + the specialists for the chosen engine (Godot: +5, Unity: +5, Unreal: +5, Bevy: +1, Raylib: +5). Total: ~35–39 agents.
   - Clean any specialists belonging to other unused engines if upgrading or switching.
2. **Deploy Model Config**:
   - If `.pi/gentle-ai/models.json` exists, back it up to `.pi/gentle-ai/models.json.backup`.
   - If user chose `default`: Copy `models.default.json` to `.pi/gentle-ai/models.json`.
   - If user chose `inherit`: Write `.pi/gentle-ai/models.json` where all tiers map to `inherit`.
3. **Configure Engine**:
   - Ensure `project.yaml` contains `engine: "<selected_engine>"`.
4. **Register Package**:
   - In `.pi/settings.json`, ensure `pi-game-studio` is added to the `packages` array.
5. **Write Install Log**:
   - Record timestamp, engine, and installed count in `.pi/game-studio/install-log.md`.

---

## Phase 7: Completion & Next Steps

Display a clean, celebratory summary:

> "🎉 **¡Pi Game Studio ha sido instalado con éxito!**
>
> • **Agentes listos**: [N] agentes en `.pi/agents/` (Core Studio + Especialistas de [Motor])
> • **Motor activo**: [Motor] (en `project.yaml`)
> • **Configuración de modelos**: `.pi/gentle-ai/models.json`
> • **Skills registradas**: 80 comandos slash listos
> • **Modo de almacenamiento**: [Engram activo / Archivos Markdown locales]
>
> ---
>
> ### ¿Cómo empezar?
> Para dar los primeros pasos con tu juego, escribe:
> **`/start`** — Onboarding interactivo para definir tu idea o proyecto existente.
>
> *(Otras opciones: `/brainstorm` para idear mecánicas, `/studio:doctor` para verificar compiladores, o `/studio` para ver todos los comandos).* "

