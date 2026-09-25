---
name: connect-engram
description: "🎮 [Studio] Diagnostic & sync assistant for Engram persistent memory. Checks connection, enables/disables memory cache, or syncs project decisions to Engram."
model: inherit
inheritProjectContext: true
tools: read, glob, write, bash, ask_user_question
---

# /connect-engram — Engram Memory Assistant

This skill manages the connection between **Pi Game Studio** and **Engram** (persistent cross-session memory).

> **Important**: Engram is strictly **optional**. All game design documents, ADRs, gate checks, and sprint stories are stored permanently in local Markdown files in your Git repository. Engram acts as an accelerated semantic memory cache.

---

## Phase 1: Environment & Connection Diagnosis

Run diagnostic checks via bash:
1. `which engram 2>/dev/null` — check if Engram CLI is installed.
2. If installed, run `engram doctor 2>/dev/null` — verify daemon or SQLite storage health.
3. Check `.pi/mcp.json` or `~/.pi/agent/mcp.json` for engram MCP server configuration.
4. Read `.pi/game-studio/engram-enabled` to check current studio state.

### If Engram is NOT detected:

Inform the user clearly:

> "ℹ️ **Engram no está detectado en tu sistema.**
>
> **No te preocupes:** Pi Game Studio funciona al 100% sin Engram. Todas las decisiones de diseño, GDDs, ADRs y sprints se guardan directamente en archivos Markdown de tu proyecto (`design/`, `docs/`, `production/`).
>
> Si en el futuro deseas memoria persistente semántica entre sesiones:
> 1. Instala Engram CLI: `npm install -g @gentle-ai/engram`
> 2. O configura el servidor MCP en `~/.pi/agent/mcp.json`
> 3. Vuelve a ejecutar `/connect-engram`"

Ensure `.pi/game-studio/engram-enabled` is set to `false`. Stop here cleanly.

---

## Phase 2: Action Selection (When Engram is available)

If Engram is detected:

```
ask_user_question: Engram está disponible en tu sistema. ¿Qué deseas hacer?
  - sync_all: "Activar y sincronizar todo el proyecto (GDDs, ADRs, Gates, Sprints)"
  - sync_decisions: "Activar y sincronizar solo decisiones de arquitectura y diseño"
  - status: "Ver estado actual de la conexión y memoria"
  - disable: "Desactivar Engram (usar solo almacenamiento local en archivos)"
```

---

## Phase 3: Sincronización (Si eligió sync)

Scan project files and register memories using the available Engram interface:

1. **GDDs** in `design/gdd/*.md` → topic key `game-design/<slug>`
2. **ADRs** in `docs/architecture/*.md` → topic key `architecture/<slug>`
3. **Gate checks** in `production/gate-checks/*.md` → topic key `gates/<slug>`
4. **Stories** in `production/stories/*.md` → topic key `stories/<slug>`

If an item is already present or sync encounters an error on a specific file, log the notice and continue with the remaining files.

---

## Phase 4: Update Studio Status

Write `.pi/game-studio/engram-enabled`:
- `true` (si se activó/sincronizó)
- `false` (si se desactivó)

Report summary to the user:
```
# /connect-engram — Estado de Memoria

Estado: [CONECTADO Y ACTIVO / DESACTIVADO]
Archivos sincronizados: N documentos
Almacenamiento primario: Archivos locales Git (design/, docs/, production/)
Memoria semántica: [Activa / Inactiva]
```
