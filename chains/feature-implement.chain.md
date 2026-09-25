---
name: feature-implement
description: End-to-end game feature pipeline from design specification to engine code and QA verification checklist.
---

> Multi-agent studio pipeline for turning designed features into working, verified engine code.

## game-designer

reads: docs/features/{feature}.md
output: docs/features/specs/{feature}-spec.md
outputMode: file-only
progress: true

Create a detailed technical design specification for `{feature}`. Define player input actions, state transitions, mathematical formulas, timing windows, audiovisual cues, error recovery, and edge-case behavior.

## lead-programmer

reads: docs/features/specs/{feature}-spec.md
output: docs/features/specs/{feature}-architecture.md
outputMode: file-only
progress: true

Architect the code structure for `{feature}` following best practices for the active game engine. Define classes, node/component hierarchies, event buses/signals, state machines, and data models. Specify integration touchpoints with existing gameplay systems.

## gameplay-programmer

reads: docs/features/specs/{feature}-spec.md+docs/features/specs/{feature}-architecture.md
output: docs/features/reports/{feature}-implementation-report.md
outputMode: file-only
progress: true

Implement `{feature}` cleanly and performantly according to the architecture specification. Write data-driven code, decouple presentation from logic, and produce the implementation report documenting created files, key functions, and integration steps.

## qa-tester

reads: docs/features/specs/{feature}-spec.md+docs/features/reports/{feature}-implementation-report.md
output: docs/features/reports/{feature}-qa-plan.md
outputMode: file-only
progress: true

Construct a rigorous QA test matrix for `{feature}`. Detail step-by-step verification procedures, boundary conditions, cheat/debug commands for testing, stress tests, and automated/manual assertions.
