---
name: setup
description: "Interactive guided installation of Pi Game Studio. Explains every step, asks for your confirmation before writing files, and sets up agents and models."
model: inherit
inheritProjectContext: true
tools: read, glob, write, edit, bash, ask_user_question, engram_mem_save, mcp
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
> 1. **50 Agentes especializados** en `.pi/agents/` (Directores, Leads de área, Programadores, Diseñadores, Artistas, QA y Especialistas de Motor: Godot, Unity, Unreal y Bevy).
> 2. **Configuración de modelos de IA** en `.pi/gentle-ai/models.json` optimizada por niveles de responsabilidad (Estrategia, Desarrollo y Tareas ligeras).
> 3. **Registro de 77 skills** de diseño, prototipado y producción en `.pi/settings.json`.
> 4. **Detección de memoria persistente (Engram)** para recordar tus decisiones cross-session."

Ask using `ask_user_question`:

```
ask_user_question: "¿Cómo deseas proceder con la instalación?"
  - standard: "1. Instalación recomendada (Rápida y balanceada — 50 agentes + modelos sugeridos)"
  - custom: "2. Instalación guiada paso a paso (Revisar y personalizar cada opción)"
  - cancel: "3. Cancelar instalación"
```

If `cancel`: Stop immediately without writing any file. Inform the user: *"Instalación cancelada. No se ha modificado ningún archivo."*

---

## Phase 2: Check Existing Project State

Check if the project already has files:
1. Glob `.pi/agents/**/*.md`
2. Check if `.pi/gentle-ai/models.json` exists.

If existing agents are detected:
```
ask_user_question: "Este proyecto ya tiene agentes instalados. ¿Qué deseas hacer?"
  - overwrite: "Reemplazar los agentes existentes con los del estudio"
  - backup-overwrite: "Hacer un respaldo antes de actualizar"
  - keep: "Mantener los agentes actuales y solo configurar modelos/skills"
```

---

## Phase 3: Model Configuration Selection

Present the recommended model assignment with clear rationale:

> "Para que el equipo funcione, cada agente necesita un modelo de IA asignado según su rol:
> • **Directores (3 agentes)**: Razonamiento de alto nivel para visión y arquitectura (`gpt-5.4-mini` o equivalente).
> • **Workhorses (44 agentes)**: Desarrollo diario de código, diseño, testing y motores (`gpt-oss-120b:free` o equivalente).
> • **Ligeros (3 agentes)**: Tareas auxiliares rápidas (`gpt-oss-20b:free`)."

Ask using `ask_user_question`:

```
ask_user_question: "¿Qué configuración de modelos prefieres usar?"
  - default: "Usar la configuración recomendada por defecto (Lista para usar)"
  - inherit: "Usar 'model: inherit' (Todos los agentes usarán el modelo activo en tu sesión de Pi)"
  - custom: "Personalizar los modelos por Tier ahora mismo (/assign-models)"
```

If `custom`: Note the user's intent to customize models after file installation.

---

## Phase 4: Engram Detection & Confirmation

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

## Phase 5: Execute Installation (with visual progress)

Inform the user: *"Instalando componentes..."*

1. **Deploy Agents**:
   - Create `.pi/agents/` if needed.
   - Copy only package agents from `agents/*.md` to `.pi/agents/`.
   - Validate copy count: count of source package agents MUST equal destination count in `.pi/agents/` (50 = 50).
2. **Deploy Model Config**:
   - If `.pi/gentle-ai/models.json` exists, back it up to `.pi/gentle-ai/models.json.backup`.
   - If user chose `default`: Copy `models.default.json` to `.pi/gentle-ai/models.json`.
   - If user chose `inherit`: Write `.pi/gentle-ai/models.json` where all tiers map to `inherit`.
3. **Register Package**:
   - In `.pi/settings.json`, ensure `pi-game-studio` is added to the `packages` array.
4. **Write Install Log**:
   - Record timestamp and installed counts in `.pi/game-studio/install-log.md`.

---

## Phase 6: Completion & Next Steps

Display a clean, celebratory summary:

> "🎉 **¡Pi Game Studio ha sido instalado con éxito!**
>
> • **Agentes listos**: 50 agentes en `.pi/agents/`
> • **Configuración de modelos**: `.pi/gentle-ai/models.json`
> • **Skills registradas**: 77 comandos slash listos
> • **Modo de almacenamiento**: [Engram activo / Archivos Markdown locales]
>
> ---
>
> ### ¿Cómo empezar?
> Para dar los primeros pasos con tu juego, escribe:
> **`/start`** — Onboarding interactivo para definir tu idea o proyecto existente.
>
> *(Otras opciones: `/brainstorm` para idear mecánicas, `/setup-engine` para configurar Godot/Unity/Unreal/Bevy, o `/settings` para ajustar preferencias).* "
