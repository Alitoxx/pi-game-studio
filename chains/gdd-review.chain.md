---
name: gdd-review
description: Comprehensive Game Design Document review pipeline across vision, systems, technical feasibility, and production scope.
---

> Multi-agent studio pipeline for reviewing game design documents before implementation.

## creative-director

reads: docs/gdd/{doc}.md
output: docs/gdd/reviews/{doc}-creative-audit.md
outputMode: file-only
progress: true

Audit the Game Design Document for `{doc}` against project core pillars, emotional resonance, aesthetic identity, and player experience goals. Flag tonal dissonance, generic tropes lacking distinctive hooks, and propose high-impact creative refinements. Deliver an APPROVE / CONCERNS / REJECT verdict with clear rationale.

## game-designer

reads: docs/gdd/{doc}.md+docs/gdd/reviews/{doc}-creative-audit.md
output: docs/gdd/reviews/{doc}-systems-audit.md
outputMode: file-only
progress: true

Analyze the gameplay mechanics, progression loops, economy levers, player agency, feedback loops, and edge cases in `{doc}`. Verify balance models and mathematical consistency. Identify exploitable loops or pacing bottlenecks. Propose concrete mechanic adjustments addressing any creative concerns.

## technical-director

reads: docs/gdd/{doc}.md+docs/gdd/reviews/{doc}-systems-audit.md
output: docs/gdd/reviews/{doc}-technical-audit.md
outputMode: file-only
progress: true

Evaluate the technical feasibility of `{doc}` in the active engine (Godot, Unity, Unreal, or Bevy). Identify architectural requirements, state machine complexity, networking constraints, asset pipeline requirements, and performance risk. Provide technical recommendations and define data contract structures.

## producer

reads: docs/gdd/reviews/{doc}-creative-audit.md+docs/gdd/reviews/{doc}-systems-audit.md+docs/gdd/reviews/{doc}-technical-audit.md
output: docs/gdd/reviews/{doc}-final-signoff.md
outputMode: file-only
progress: true

Synthesize all department audits for `{doc}`. Construct milestone timeline estimates, resource allocation breakdown, MVP scope cuts if schedule is constrained, and a finalized sign-off action plan.
