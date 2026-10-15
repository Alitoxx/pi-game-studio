---
name: release-gate
description: Pre-release verification gate auditing build stability, performance targets, security, and store release readiness.
---

> Multi-agent studio pipeline auditing milestone builds before release.

## qa-lead

reads: production/qa/bugs.md
output: production/qa/bugs.md
outputMode: file-only
progress: true

Execute comprehensive test regression triage for `{build}`. Audit open bug counts, blocker/critical defects, platform compliance, and crash logs. Issue a formal GO / NO-GO recommendation with defect severity breakdown.

## technical-director

reads: production/qa/bugs.md
output: production/qa/bugs.md
outputMode: file-only
progress: true

Audit framerate stability (1% and 0.1% lows), frame-time consistency, memory leaks, draw call count, savegame integrity, and build stability for `{build}` across target hardware profiles.

## producer

reads: production/qa/bugs.md
output: production/roadmap.md
outputMode: file-only
progress: true

Assemble the final release package manifest for `{build}`. Draft release notes, platform store checklist (Steam, itch.io, Consoles, Mobile), version bump confirmation, and deployment rollback plan.
