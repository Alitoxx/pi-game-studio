---
name: setup
description: "Install Pi Game Studio agents and model config into your project. Copies agents/ → .pi/agents/ and models.default.json → .pi/gentle-ai/models.json."
model: inherit
inheritProjectContext: true
tools: read, glob, write, edit, bash, ask_user_question, engram_mem_save, mcp
---

# Pi Game Studio — Setup

This skill installs the game studio into your project. It:

1. **Copies agents** from the Pi Game Studio package to `.pi/agents/`
2. **Copies model config** (`models.default.json`) to `.pi/gentle-ai/models.json`
3. Shows you a summary of what was installed

## Prerequisites

- You've installed the Pi Game Studio package (`pi install pi-game-studio`)
- You're in the root of the project you want to use

---

## Phase 1: Check current state

Before anything, check if agents already exist:

```
glob: .pi/agents/**/*.md
```

If `.pi/agents/` has agent files, ask:

```
ask_user_question: This project already has agents installed. Overwrite them?
  - yes: "Replace all agents with the game studio agents"
  - no: "Skip installation (use with existing agents)"
  - reconfigure: "Only copy the model config, keep existing agents"
```

If `.pi/gentle-ai/models.json` exists, note that it will be backed up.

---

## Phase 2: Confirm

Ask the user:

```
ask_user_question: Ready to install Pi Game Studio?
  - setup: "Install agents + model config"
  - agents-only: "Only install agents, keep current model config"
  - models-only: "Only update model config, keep current agents"
  - cancel: "Do nothing"
```

Route based on response.

---

## Phase 2.5: Engram detection

Before writing anything under `.pi/game-studio/`, create the directory:

```
bash: mkdir -p .pi/game-studio
```

Check the project's MCP config explicitly for an Engram server with direct tools enabled:

```
read: .pi/mcp.json
```

If `.pi/mcp.json` contains `mcpServers.engram` and `directTools: true`, Engram is available. Ask the user:

```
ask_user_question: Engram is available — persistent memory for decisions. Use it?
  - engram-yes: "Save decisions to Engram (cross-session persistence, searchable)"
  - engram-no: "Use files only (classic CCGS mode, no persistence needed)"
```

If they choose `engram-yes`, create the flag file:

```
write: .pi/game-studio/engram-enabled
  true
```

If `engram-no`, create:

```
write: .pi/game-studio/engram-enabled
  false
```

If Engram is not available, or the MCP config does not show `mcpServers.engram.directTools: true`, create `.pi/game-studio/engram-enabled` with `false` and inform:

```
Engram not detected. Decisions will be saved as project files only.
To add Engram later: install engram and run /connect-engram
```

---

## Phase 3: Install agents

If mode is `setup` or `agents-only`:

1. Create `.pi/agents/` directory if it doesn't exist
2. Copy only the package agents from `agents/` into `.pi/agents/<name>.md`
   - Do not copy `.pi/agents/sdd-*.md`; those SDD agents are managed separately
3. Validate the copy before continuing:
   - Count source agent files in `agents/`
   - Count copied package agents in `.pi/agents/` using the same selection rules
   - The destination count must match the source count exactly
   - If counts differ, report the missing files and retry the failed copies
4. Confirm count:

```
write: .pi/game-studio/install-log.md
  # Pi Game Studio — Install Log
  Installed: YYYY-MM-DD HH:MM
  Agents: dynamic (count from package `agents/`; do not hardcode)
  Validation: source count matches copied package agents
```

---

## Phase 4: Install model config

If mode is `setup` or `models-only`:

1. If `.pi/gentle-ai/models.json` already exists, back it up:
   - Rename to `.pi/gentle-ai/models.json.backup`
2. Copy `models.default.json` from the package root to `.pi/gentle-ai/models.json`.
   - The bundled defaults use the real tier models:
     - director: `openai-codex/gpt-5.4-mini`
     - workhorse: `openrouter/openai/gpt-oss-120b:free`
     - lightweight: `openrouter/openai/gpt-oss-20b:free`
3. Confirm:

```
write: .pi/game-studio/install-log.md (append)
  Model config: installed
  Previous config backed up to: .pi/gentle-ai/models.json.backup
```

---

## Phase 4.5: Register package in .pi/settings.json

At the end of setup, register this package in the project's Pi settings:

1. `read: .pi/settings.json`
2. `edit: .pi/settings.json`
   - Add `pi-game-studio` to the `packages` array if it is not already present
   - Preserve any existing settings and package entries
3. Confirm:

```
write: .pi/game-studio/install-log.md (append)
  Package registration: pi-game-studio added to .pi/settings.json
```

---

## Phase 5: Show summary

Print summary:

```
# Pi Game Studio — Installed

- Agents: dynamic count from package `agents/` (package agents only; SDD agents remain separate)
- Model config: .pi/gentle-ai/models.json
- Package registration: pi-game-studio in .pi/settings.json

Next steps:
  - /start — Begin game development workflow
  - /assign-models — Customize model assignments
  - /connect-engram — Sync existing decisions to Engram (if enabled)
  - Edit .pi/gentle-ai/models.json to change models
```

---

## Edge cases

- **No .pi/ directory**: Create it. Pi projects use `.pi/` for runtime config.
- **Already installed**: Offer backup + replace or skip.
- **Package not found**: If `agents/` or `models.default.json` are not in the expected locations, inform the user that the package may not be installed correctly.
- **Partial failure**: If an agent fails to copy, log the error and continue with the next one; validation will catch any mismatch.
