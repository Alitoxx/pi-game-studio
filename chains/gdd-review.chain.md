---
name: gdd-review
description: Comprehensive Game Design Document review pipeline across vision, systems, technical feasibility, and production scope.
---

> Multi-agent studio pipeline for reviewing game design documents before implementation.
> Cada paso declara `surfaces:` para acotar lo que puede editar y `section:` cuando aporta una sección a un documento compartido; dos pasos que reemplacen el mismo archivo sin secciones distintas invalidan la cadena.
> Ningún paso cierra sin un spot check: la cadena vuelve a correr un comando reportado en `validation`, o relee la propiedad declarada en `structural:`; el contrato valida forma, no verdad.

## creative-director

reads: design/gdd/{doc}.md
output: design/gdd/{doc}.md
outputMode: file-only
section: Revisión de Visión
surfaces:
  - design/gdd/{doc}.md
progress: true

Audit the Game Design Document for `{doc}` against project core pillars, emotional resonance, aesthetic identity, and player experience goals. Flag tonal dissonance, generic tropes lacking distinctive hooks, and propose high-impact creative refinements. Deliver an APPROVE / CONCERNS / REJECT verdict with clear rationale.

## game-designer

reads: design/gdd/{doc}.md
output: design/gdd/{doc}.md
outputMode: file-only
section: Revisión de Mecánicas
surfaces:
  - design/gdd/{doc}.md
progress: true

Analyze the gameplay mechanics, progression loops, economy levers, player agency, feedback loops, and edge cases in `{doc}`. Verify balance models and mathematical consistency. Identify exploitable loops or pacing bottlenecks. Propose concrete mechanic adjustments addressing any creative concerns.

## technical-director

reads: design/gdd/{doc}.md
output: design/gdd/{doc}.md
outputMode: file-only
section: Revisión de Arquitectura
surfaces:
  - design/gdd/{doc}.md
progress: true

Evaluate the technical feasibility of `{doc}` in the active engine (Godot, Unity, Unreal, Phaser, Raylib, or Bevy). Identify architectural requirements, state machine complexity, networking constraints, asset pipeline requirements, and performance risk. Provide technical recommendations and define data contract structures.

## producer

reads: design/gdd/{doc}.md
output: production/roadmap.md
outputMode: file-only
surfaces:
  - production/roadmap.md
progress: true

Synthesize all department audits for `{doc}`. Construct milestone timeline estimates, resource allocation breakdown, MVP scope cuts if schedule is constrained, and a finalized sign-off action plan.
