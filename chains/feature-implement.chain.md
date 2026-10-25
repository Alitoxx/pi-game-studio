---
name: feature-implement
description: End-to-end game feature pipeline from design specification to engine code and QA verification checklist.
---

> Multi-agent studio pipeline for turning designed features into working, verified engine code.
> Cada paso declara `surfaces:` para acotar lo que puede editar y `section:` cuando aporta una sección a un documento compartido; dos pasos que reemplacen el mismo archivo sin secciones distintas invalidan la cadena.
> Ningún paso cierra sin un spot check: la cadena vuelve a correr un comando reportado en `validation`, o relee la propiedad declarada en `structural:`; el contrato valida forma, no verdad.

## game-designer

reads: design/gdd/{feature}.md
output: design/gdd/{feature}.md
outputMode: file-only
section: Diseño Técnico
surfaces:
  - design/gdd/{feature}.md
progress: true

Create a detailed technical design specification for `{feature}`. Define player input actions, state transitions, mathematical formulas, timing windows, audiovisual cues, error recovery, and edge-case behavior.

## technical-director

reads: design/gdd/{feature}.md
output: design/gdd/{feature}.md
outputMode: file-only
section: Arquitectura
surfaces:
  - design/gdd/{feature}.md
progress: true

Architect the code structure for `{feature}` following best practices for the active game engine. Define classes, node/component hierarchies, event buses/signals, state machines, and data models. Specify integration touchpoints with existing gameplay systems.

## gameplay-programmer

reads: design/gdd/{feature}.md
output: src/
outputMode: interactive
surfaces:
  - src/
progress: true

Implement `{feature}` cleanly and performantly according to the architecture specification. Write data-driven code, decouple presentation from logic, and implement ~400-line verifiable units.

## qa-lead

reads: design/gdd/{feature}.md+src/
output: production/qa/bugs.md
outputMode: file-only
section: Bugs — QA
surfaces:
  - production/qa/bugs.md
progress: true

Construct a rigorous QA test matrix for `{feature}`. Detail step-by-step verification procedures, boundary conditions, cheat/debug commands for testing, stress tests, and automated/manual assertions.
