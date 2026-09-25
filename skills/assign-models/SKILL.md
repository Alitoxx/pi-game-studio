---
name: assign-models
description: "Reassign models for Pi Game Studio agents. Change models by tier (director/workhorse/lightweight) or per-agent. Dry-run preview available."
model: inherit
inheritProjectContext: true
tools: read, write, ask_user_question
---

# /assign-models — Agent Model Assignment

This skill lets you change which model each agent uses. You can:

- **Assign by tier**: Set a model for all directors, workhorses, or lightweight agents at once
- **Assign per-agent**: Set a specific model for individual agents
- **Dry-run**: Preview changes before applying
- **Reset to defaults**: Restore `models.default.json` from the package

---

## Phase 1: Check current model config

Read the current `models.json`:

```
glob: .pi/gentle-ai/models.json
```

If it doesn't exist, create it from the package default:

```
read: path/to/models.default.json
```

Show the current mapping:

```
Currently active models (50 agents):
  Directors (3 agents):
    creative-director → openai-codex/gpt-5.4-mini
    technical-director → openai-codex/gpt-5.4-mini
    producer → openai-codex/gpt-5.4-mini

  Workhorses (44 agents):
    game-designer → openrouter/openai/gpt-oss-120b:free
    lead-programmer → openrouter/openai/gpt-oss-120b:free
    bevy-specialist, godot-specialist, unity-specialist, ...
    ...

  Lightweight (3 agents):
    community-manager → openrouter/openai/gpt-oss-20b:free
    devops-engineer → openrouter/openai/gpt-oss-20b:free
    sound-designer → openrouter/openai/gpt-oss-20b:free
```

---

## Phase 2: Ask what to do

Detect the user's language (Spanish/English).

```
ask_user_question: What would you like to change? / ¿Qué deseas modificar?
  - preview: "Mantener la configuración actual sin cambios (Continuar)"
  - tier: "Asignar un modelo a un Tier completo (Directores / Workhorses / Ligeros)"
  - agent: "Asignar un modelo a un agente específico"
  - reset: "Restaurar modelos a los valores por defecto del paquete"
```

---

## Phase 2a: Tier assignment

If `tier`:

```
ask_user_question: Which tier? / ¿A qué nivel de agentes?
  - director: "3 directores — creative-director, technical-director, producer (Estrategia)"
  - workhorse: "44 especialistas — leads, programadores, diseñadores, motores (Desarrollo)"
  - lightweight: "3 auxiliares — community-manager, devops-engineer, sound-designer (Tareas ligeras)"
```

Then:

```
ask_user_question: What model for all {tier} agents?
  - gpt-5.4: "openai-codex/gpt-5.4-mini (Codex, best for creative direction)"
  - sonnet: "anthropic/claude-sonnet-4 (strong reasoning)"
  - k2.6: "opencode-go/kimi-k2.6 (OpenCode tier 1)"
  - qwen: "openrouter/qwen-3-plus (OpenCode tier 2)"
  - gpt-oss-120b: "openrouter/openai/gpt-oss-120b:free (free 120b)"
  - gpt-oss-20b: "openrouter/openai/gpt-oss-20b:free (free 20b)"
  - custom: "Type a custom provider/model ID"
```

If `custom`, ask:

```
ask_user_question: Enter model ID for all {tier} agents
```

---

## Phase 2b: Per-agent assignment

If `agent`:

```
ask_user_question: Which agent?
  - creative-director
  - technical-director
  - producer
  - game-designer
  - lead-programmer
  - ... (list all agents)
  - other: "Type agent name"
```

Then ask for the model ID (same model options as tier assignment).

---

## Phase 3: Show preview (dry-run)

Before applying, show what will change:

```
Changes to apply:

  creative-director:   openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4
  technical-director:  openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4
  producer:           openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4

3 agents affected. Proceed?
```

```
ask_user_question: Apply these changes?
  - apply: "Write changes to .pi/gentle-ai/models.json"
  - redo: "Start over with different choices"
  - cancel: "Do nothing"
```

---

## Phase 4: Write changes

If `apply`:

1. Back up current `.pi/gentle-ai/models.json` → `.pi/gentle-ai/models.json.assign-backup`
2. Write updated `models.json` with the new mapping
3. Confirm:

```
# /assign-models — Done

3 agents updated:
  creative-director:  openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4
  technical-director: openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4
  producer:          openai-codex/gpt-5.4-mini → anthropic/claude-sonnet-4

Backup saved: .pi/gentle-ai/models.json.assign-backup

Note: Agents loaded AFTER this change will use the new model.
You may need to restart your Pi session for changes to take effect.
```

---

## Edge cases

- **No models.json yet**: Create fresh from `models.default.json` in the package
- **Partial tier**: If using tier assignment but some agents have custom overrides, ask: "Keep per-agent customizations or overwrite all?"
- **Rollback**: User can restore from `.pi/gentle-ai/models.json.assign-backup` manually
- **Invalid model ID**: Warn if the model name doesn't match common patterns, but don't block — the user's provider may support it
