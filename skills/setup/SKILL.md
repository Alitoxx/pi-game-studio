---
name: setup
description: "Install Pi Game Studio agents and model config into your project. Copies agents/ → .pi/agents/ and models.default.json → .pi/gentle-ai/models.json."
model: inherit
inheritProjectContext: true
tools: read, glob, write, ask_user_question, engram_mem_save, mcp
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
glob: path/to/agents/**/*.md
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

Check if Engram is available as a decision repository:

```
mcp: {}
```

If `engram` MCP server is connected (directTools: true), Engram is available. Ask the user:

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

If Engram is **not** available, create `.pi/game-studio/engram-enabled` with `false` and inform:

```
Engram not detected. Decisions will be saved as project files only.
To add Engram later: install engram and run /connect-engram
```

---

## Phase 3: Install agents

If mode is `setup` or `agents-only`:

1. Create `.pi/agents/` directory if it doesn't exist
2. For each agent in the package `agents/` directory:
   - Copy the file to `.pi/agents/<name>.md`
3. Confirm count:

```
write: .pi/game-studio/install-log.md
  # Pi Game Studio — Install Log
  Installed: YYYY-MM-DD HH:MM
  Agents: 49
```

---

## Phase 4: Install model config

If mode is `setup` or `models-only`:

1. If `.pi/gentle-ai/models.json` already exists, back it up:
   - Rename to `.pi/gentle-ai/models.json.backup`
2. Copy `models.default.json` from the package root to `.pi/gentle-ai/models.json`
3. Confirm:

```
write: .pi/game-studio/install-log.md (append)
  Model config: installed
  Previous config backed up to: .pi/gentle-ai/models.json.backup
```

---

## Phase 5: Show summary

Print summary:

```
# Pi Game Studio — Installed

- Agents: 49 (in .pi/agents/)
- Model config: .pi/gentle-ai/models.json

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
- **Partial failure**: If an agent fails to copy, log the error and continue with the next one.
