---
name: concept
description: "[ODD Phase 1] Authorize & Vision. Role Owner: creative-director (Tier 1 Director). From the initial idea to an executable game vision: defines the core fantasy, the 3-5 unbreakable Pillars, the anti-pillars, and the visual anchor."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - ask_user_question
---

## ODD Phase 1: Concept & Vision

- **Role Owner**: `creative-director` (Tier 1 Director)
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/concept` is invoked (or `/concept pitch`, `/concept jam`):

### 1. Exploration & Premise
- If the user provides a premise or idea, analyze the player's core fantasy and the mechanical references.
- If there is no premise, request a short brief via `ask_user_question` with starting archetypes or custom input.

### 2. Pillar Definition (3 to 5 Pillars)
- Each Pillar must contain:
  1. **Name & Philosophy**: What makes the game unique.
  2. **Actionable Design Test**: A concrete binary question to settle doubts ("¿Esto refuerza el pilar X?" — example: "Does this reinforce Pillar X?").
- Define at least 2 **Anti-Pillars**: What the game explicitly will NOT try to be, to protect scope.

### 3. Inline Validation & Visual Anchor
- Run the coherence validation directly in the conversation (no external thread waits).
- Present 2-3 options for the **Visual Identity Anchor** (palette, rendering style and feasibility in the active engine).
- Offer interactive selection with `ask_user_question`.

### 4. Living Delivery
- Save the living document in `design/gdd/concept.md`.
- Announce the phase closure and suggest the next step: `/spec` to detail the first system.

### 5. Verifiable Closure (Done When)

The phase **does not close when the file is saved**: saving an empty document also saves a file. It closes when what was written can be read back and asserted.

It closes in `completed` only if `design/gdd/concept.md` meets these four binary conditions:
- **Countable Pillars**: there are between 3 and 5 Pillars, not one and not eight.
- **A verb per Pillar**: each Pillar names a repeatable verb the player executes (run, build, negotiate), never a feeling or an adjective (fun, immersive).
- **Loop of three steps or fewer**: the core loop reads complete in ≤ 3 steps, with no hidden sub-loops inside.
- **Explicit platform and dimension**: the document declares the target (PC, console, web) and `2d` or `3d`, consistent with `project.yaml`.

Evidence reported (an agent without `bash` cannot run commands):

`structural: design/gdd/concept.md: 4 pilares con verbo, loop de 3 pasos, target PC, dimensión 3d`

If a condition fails, the phase returns `partial` naming which one is missing. A hollow concept does not carry over into `/spec`: the Live Spec is the source of truth for every following phase, so its first entry inherits this void.
