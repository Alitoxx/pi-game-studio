---
name: release-gate
description: Pre-release verification gate auditing build stability, performance targets, security, and store release readiness.
---

> Multi-agent studio pipeline auditing milestone builds before release.
> Cada paso declara `surfaces:` para acotar lo que puede editar y `section:` cuando aporta una sección a un documento compartido; dos pasos que reemplacen el mismo archivo sin secciones distintas invalidan la cadena.
> Ningún paso cierra sin un spot check: la cadena vuelve a correr un comando reportado en `validation`, o relee la propiedad declarada en `structural:`; el contrato valida forma, no verdad.

## qa-lead

reads: production/qa/bugs.md
output: production/qa/bugs.md
outputMode: file-only
section: Bugs — QA
surfaces:
  - production/qa/bugs.md
progress: true

Execute comprehensive test regression triage for `{build}`. Audit open bug counts, blocker/critical defects, platform compliance, and crash logs. Issue a formal GO / NO-GO recommendation with defect severity breakdown.

## technical-director

reads: production/qa/bugs.md
output: production/qa/bugs.md
outputMode: file-only
section: Evaluación Técnica
surfaces:
  - production/qa/bugs.md
progress: true

Audit framerate stability (1% and 0.1% lows), frame-time consistency, memory leaks, draw call count, savegame integrity, and build stability for `{build}` across target hardware profiles.

## producer

reads: production/qa/bugs.md
output: production/roadmap.md
outputMode: file-only
surfaces:
  - production/roadmap.md
progress: true

Assemble the final release package manifest for `{build}`. Draft release notes, platform store checklist (Steam, itch.io, Consoles, Mobile), version bump confirmation, and deployment rollback plan.

## qa-verifier

reads: production/qa/bugs.md
readOnly: true
progress: true

Independent read-only verification for `{build}` — final blocking gate of the chain. Do not trust the reports of the previous steps: re-derive the probes from the milestone spec, the release criteria and the original request, and execute the evidence commands yourself (`read`, `find`, `grep`, `bash`). For each release criterion (regression triage, performance targets, build stability, store readiness) issue a PASS / FAIL / UNVERIFIABLE verdict with the exact command and observed result as `cmd` evidence. Return the studio contract: `status: completed` (verdict PASS) or `status: blocked`, `summary`, `validation`, `risks`. A `blocked` verdict stops the release: the chain cannot be considered good while any criterion is open.
