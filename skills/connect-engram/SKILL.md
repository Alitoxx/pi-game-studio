---
name: connect-engram
description: "🎮 [Studio] Sync existing project decisions to Engram. Scans design docs, ADRs, gate verdicts, and story completions — migrates them to persistent memory."
model: inherit
inheritProjectContext: true
tools: read, glob, write, ask_user_question, engram_mem_save, engram_mem_search
---

# /connect-engram — Sync to Engram

This skill scans your existing project files and saves them to Engram for
cross-session searchable persistence. Run this when:

- You installed Engram **after** setting up the game studio
- You want retroactive persistence of past decisions
- You switched projects and want continuity

---

## Phase 1: Verify Engram

Check if Engram is actually connected:

```
read: .pi/game-studio/engram-enabled
```

If it says `false` or doesn't exist, check if `engram_mem_save` is available
by trying a simple call. If not available, inform:

```
Engram is not available. Install it first:
1. Install the engram package for Pi
2. Configure it in MCP settings
3. Ensure directTools: true
4. Run /connect-engram again
```

---

## Phase 2: Confirm migration mode

```
ask_user_question: What would you like to sync to Engram?
  - all: "Scan and sync everything (design docs, ADRs, gates, stories)"
  - decisions: "Only architecture decisions and design reviews"
  - gates: "Only gate verdicts and phase completions"
  - stories: "Only story completions and sprint plans"
  - incremental: "Sync everything, but skip docs already in Engram"
```

---

## Phase 3: Sync design docs

If mode includes design docs (`all`, `decisions`, or `incremental`):

1. Scan `design/` for markdown files:

```
glob: design/**/*.md
```

2. For each file (unless `incremental` and already synced):

```
read: design/gdd/<name>.md
```

3. Save to Engram:

```
engram_mem_save:
  title: "GDD: <system-name>"
  type: "decision"
  topic_key: "game-design/<system-name>"
  content: |
    **What**: <first heading or summary>
    **Where**: design/gdd/<name>.md
```

---

## Phase 4: Sync architecture docs

If mode includes decisions (`all`, `decisions`, or `incremental`):

1. Scan for ADRs:

```
glob: docs/architecture/**/*.md
```

2. For each ADR:

```
read: docs/architecture/<name>.md
```

3. Save to Engram:

```
engram_mem_save:
  title: "ADR: <title>"
  type: "architecture"
  topic_key: "architecture/<name>"
  content: |
    **What**: <decision>
    **Why**: <rationale>
    **Where**: docs/architecture/<name>.md
```

---

## Phase 5: Sync gate verdicts

If mode includes gates (`all`, `gates`, or `incremental`):

1. Scan for gate records:

```
glob: production/**/gate-*.md
```

2. For each gate record, save to Engram:

```
engram_mem_save:
  title: "Gate: <phase>"
  type: "decision"
  topic_key: "gates/<phase>"
  content: |
    **Verdict**: PASS/CONCERNS/FAIL
    **Where**: production/<file>
```

---

## Phase 6: Sync story completions

If mode includes stories (`all`, `stories`, or `incremental`):

```
glob: production/stories/**/done.md
```

For each completion record:

```
engram_mem_save:
  title: "Story: <story-name>"
  type: "pattern"
  topic_key: "stories/<story-name>"
  content: |
    **What**: <story summary>
    **Where**: production/stories/<path>
```

---

## Phase 7: Update Engram flag

Enable Engram going forward:

```
write: .pi/game-studio/engram-enabled
  true
```

---

## Phase 8: Summary

```
# /connect-engram — Complete

Design docs synced:     N
Architecture decisions: N
Gate verdicts:          N
Story completions:      N
Engram mode:            ACTIVE

From now on, new decisions in /brainstorm, /architecture-decision,
/gate-check, and /design-review will auto-save to Engram.
```

---

## Edge cases

- **No Engram available**: Stop and guide user to install Engram first
- **Already synced**: Deduplicate by checking topic_key (incremental mode)
- **No project files**: Nothing to sync — just enable Engram for future use
- **Sync failed on one file**: Log error, continue with next, report at end
