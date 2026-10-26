---
name: spec
description: "[ODD Phase 2] Live Specs. Role Owner: game-designer (Tier 2 Lead). Living design of mechanics, systems and formulas in design/gdd/<feature>.md with balance variables (tuning knobs) and acceptance criteria."
tools:
  - read
  - find
  - grep
  - write
  - edit
  - ask_user_question
---

## ODD Phase 2: Live Specs & Design

- **Role Owner**: `game-designer` (Tier 2 Lead)
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/spec <feature>` is invoked (or `/spec review`):

### 1. Read the Current State
- Read `design/gdd/concept.md` to align the system with the game's Pillars.
- If prior code exists in `src/`, inspect the existing structures and APIs.

### 2. Writing the Single Live Spec
Create or update exclusively the living file: `design/gdd/<feature>.md`.
The Live Spec must mandatorily contain:
- **Player Fantasy**: What they experience, in 1-2 sentences.
- **System Rules**: Step-by-step logic without ambiguities.
- **Formulas & Tuning Knobs**: Exposed numeric parameters (speed, cooldowns, damage, ratios) in external data files (`assets/data/`), never hardcoded.
- **Render & Shader Requirements**: Explicitly identify which visual effects of the mechanic require GPU shaders (e.g. light attenuation, volumetric fog/noise, water distortion, post-processing, dissolution) instead of emulating them with CPU-side logic.
- **Juice & Game Feel**: Mandatory haptic and visual micro-feedback: *hitstop/freeze* timings, screen shake curves (*screen shake* with exponential decay), *coyote time* and *input buffering* tolerances, and *easing* interpolation curves.
- **Input Mapping & Multi-device**: Define semantic actions (`Move`, `Interact`, `ActionPrimary`) mapped simultaneously to keyboard/mouse and Gamepad (analog stick + standard buttons). Binding the design to fixed physical keys is forbidden.
- **App Lifecycle & App States**: Define the behavior under global transitions (`Boot`, `MainMenu`, `InGame`, `Paused`, `GameOver`). The `Paused` state must freeze game time and the physics simulation while keeping the UI interactive and ducking the audio.
- **Asset Manifest & Placeholders**: Register every required sprite, texture, audio or shader in `assets/manifest.yaml` with its dimensions/format and mark its state (`placeholder` vs `final`).
- **State Schema & Persistence (Save/Load)**: Exact structure of the data that must persist between sessions (saveable components, inventory, progress, discovered fog).
- **Diagnostic Tools & Debug Overlay**: Declare which state variables and debug indicators (collision gizmos, perception radii, counters) must be exposed in the debug layer (`F3`).
- **Edge Cases**: Handling of boundary situations (disconnection, screen limits, concurrent states).
- **Atomic Implementation Checklist**: Tasks of ~400 lines each with `[ ]` format, explicitly including the tasks for shader creation, debug overlay, pause states and sound assets.

### 3. Resolving Uncertainty
If there is a design dilemma (e.g. control scheme or progression formula), present a concise **TRADE-OFF MATRIX** and resolve it interactively with `ask_user_question`.

### 4. Verifiable Closure (Done When)

The Live Spec **does not close because it is written**: it closes when another role can execute it without asking anything.

It closes in `completed` only if `design/gdd/<feature>.md` meets these five binary conditions:
- **Complete sections**: all the mandatory sections above are present and none is empty.
- **Knobs with unit and owner**: every numeric parameter declares a number, a unit (`px/s`, `ms`, `%`) and the actual file exposing it in `assets/data/`; no balance value lives in prose.
- **Shader named per effect**: every render requirement names the concrete effect (light attenuation, fog, water distortion, dissolution), never the generic "lighting".
- **Checklist covers the mechanisms**: every mechanism in *System Rules* has at least one `[ ]` task in the atomic checklist.
- **Assets registered**: every named sprite, audio or shader appears in `assets/manifest.yaml` with its state (`placeholder` or `final`).

Evidence reported:

`structural: design/gdd/<feature>.md: 12/12 secciones, 7 knobs con unidad y archivo, checklist cubre 5 mecanismos, 4 assets en manifiesto`

If a condition fails, the phase returns `partial` with the exact list of what is missing. An incomplete Live Spec is worse than none: it reads as truth and the implementation obeys it.
