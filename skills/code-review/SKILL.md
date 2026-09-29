---
name: code-review
description: "[Studio] Ejecuta una revisión técnica de código bajo las 3 lentes nativas de videojuegos: Game Feel & Controles, Rendimiento & FPS (Zero Alloc Loop) y Robustez de QA & Edge Cases."
agent: lead-programmer
model: inherit
inheritProjectContext: true
tools: read, glob, grep, bash, subagent
---

## Phase 1: Load Target Files

Read the target file(s) in full. Read CLAUDE.md for project coding standards.

---

## Phase 2: Identify Engine Specialists

Read `.pi/game-studio/technical-preferences.md`, section `## Engine Specialists`. Note:

- The **Primary** specialist (used for architecture and broad engine concerns)
- The **Language/Code Specialist** (used when reviewing the project's primary language files)
- The **Shader Specialist** (used when reviewing shader files)
- The **UI Specialist** (used when reviewing UI code)

If the section reads `[TO BE CONFIGURED]`, no engine is pinned — skip engine specialist steps.

---

## Phase 3: ADR Compliance Check

Search for ADR references in the story file, commit messages, and header comments. Look for patterns like `ADR-NNN` or `docs/architecture/ADR-`.

If no ADR references found, note: "No ADR references found — skipping ADR compliance check."

For each referenced ADR: read the file, extract the **Decision** and **Consequences** sections, then classify any deviation:

- **ARCHITECTURAL VIOLATION** (BLOCKING): Uses a pattern explicitly rejected in the ADR
- **ADR DRIFT** (WARNING): Meaningfully diverges from the chosen approach without using a forbidden pattern
- **MINOR DEVIATION** (INFO): Small difference from ADR guidance that doesn't affect overall architecture

---

## Phase 4: Standards Compliance

Identify the system category (engine, gameplay, AI, networking, UI, tools) and evaluate:

- [ ] Public methods and classes have doc comments
- [ ] Cyclomatic complexity under 10 per method
- [ ] No method exceeds 40 lines (excluding data declarations)
- [ ] Dependencies are injected (no static singletons for game state)
- [ ] Configuration values loaded from data files
- [ ] Systems expose interfaces (not concrete class dependencies)

---

## Phase 5: Architecture and SOLID

**Architecture:**
- [ ] Correct dependency direction (engine <- gameplay, not reverse)
- [ ] No circular dependencies between modules
- [ ] Proper layer separation (UI does not own game state)
- [ ] Events/signals used for cross-system communication
- [ ] Consistent with established patterns in the codebase

**SOLID:**
- [ ] Single Responsibility: Each class has one reason to change
- [ ] Open/Closed: Extendable without modification
- [ ] Liskov Substitution: Subtypes substitutable for base types
- [ ] Interface Segregation: No fat interfaces
- [ ] Dependency Inversion: Depends on abstractions, not concretions

---

## Phase 6: Game-Specific Concerns

- [ ] Frame-rate independence (delta time usage)
- [ ] No allocations in hot paths (update loops)
- [ ] Proper null/empty state handling
- [ ] Thread safety where required
- [ ] Resource cleanup (no leaks)

---

## Phase 7: Specialist Reviews (Parallel)

Spawn all applicable specialists simultaneously via subagent — do not wait for one before starting the next.

### Engine Specialists

If an engine is configured, determine which specialist applies to each file and spawn in parallel:

- Primary language files (`.gd`, `.cs`, `.cpp`) → Language/Code Specialist
- Shader files (`.gdshader`, `.hlsl`, shader graph) → Shader Specialist
- UI screen/widget code → UI Specialist
- Cross-cutting or unclear → Primary Specialist

Also spawn the **Primary Specialist** for any file touching engine architecture (scene structure, node hierarchy, lifecycle hooks).

### QA Testability Review

For Logic and Integration stories, also spawn `qa-tester` via subagent in parallel with the engine specialists. Pass:
- The implementation files being reviewed
- The story's `## QA Test Cases` section (the pre-written test specs from qa-lead)
- The story's `## Acceptance Criteria`

Ask the qa-tester to evaluate:
- [ ] Are all test hooks and interfaces exposed (not hidden behind private/internal access)?
- [ ] Do the QA test cases from the story's `## QA Test Cases` section map to testable code paths?
- [ ] Are any acceptance criteria untestable as implemented (e.g., hardcoded values, no seam for injection)?
- [ ] Does the implementation introduce any new edge cases not covered by the existing QA test cases?
- [ ] Are there any observable side effects that should have a test but don't?

For Visual/Feel and UI stories: qa-tester reviews whether the manual verification steps in `## QA Test Cases` are achievable with the implementation as written — e.g., "is the state the manual checker needs to reach actually reachable?"

Collect all specialist findings before producing output.

---

## Phase 8: Output Review (Native Gamedev Lenses)

```text
┌── GAME ENGINE TECHNICAL REVIEW: [File / System] ────────────────────┐
│ Revisor Principal: lead-programmer & engine-programmer             │
│ Target & Motor:    [Engine Activo] · Target FPS: [60/144]          │
└─────────────────────────────────────────────────────────────────────┘

### LENTE 1: GAME FEEL & CONTROLS (Jugabilidad & Latencia)
• Latencia de Input:      [ZERO DELAY / SMOOTH / BUFFERING ISSUES]
• Frame-Rate Delta:       [INDEPENDENT / DEPENDENT ON FPS (FIX!)]
• Tuning Knobs Expuestos: [DATA DRIVEN / HARDCODED VALUES FOUND]
• Veredicto Game Feel:    [APROBADO / AJUSTES REQUERIDOS]

### LENTE 2: PERFORMANCE & FPS (Cero Allocations & Memoria)
• Hot Path Loop Allocations: [0 ALLOCS (PASS) / ALLOCATIONS DETECTED (FAIL)]
• Cache & Memory Layout:     [DATA-ORIENTED CONTIGUOUS / OOP POINTER SCATTER]
• Shaders & GPU Overhead:    [CLEAN BATCHING / HIGH DRAW CALLS]
• Veredicto Rendimiento:     [APROBADO / BLOQUEANTE]

### LENTE 3: QA ROBUSTNESS & EDGE CASES (qa-lead & qa-tester)
• Testability & Inyección:   [SEAMS EXPOSED / TIGHTLY COUPLED]
• Edge Cases de Física/Sync: [HANDLED / RISK DETECTED]
• Resource Cleanup:          [0 LEAKS VERIFIED / RISK FOUND]
• Veredicto QA:              [APROBADO / TESTS REQUERIDOS]

───────────────────────────────────────────────────────────────────────
VERDICT FINAL: [APPROVED / CHANGES REQUIRED]
• Acciones Obligatorias: [Lista de cambios bloqueantes o 'Ninguno']
• Recomendaciones:       [Optimizaciones de pulido o jugo]
───────────────────────────────────────────────────────────────────────
```

This skill is read-only — no files are written.

---

## Phase 9: Next Steps

- If verdict is APPROVED: run `/story-done [story-path]` or proceed to next task.
- If verdict is CHANGES REQUIRED: fix the blocking issues and re-run `/code-review`.
