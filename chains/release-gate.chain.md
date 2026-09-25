---
name: release-gate
description: Pre-release verification gate auditing build stability, performance targets, security, and store release readiness.
---

> Multi-agent studio pipeline auditing milestone builds before release.

## qa-lead

reads: docs/release/{build}-test-log.md
output: docs/release/{build}-qa-verdict.md
outputMode: file-only
progress: true

Execute comprehensive test regression triage for `{build}`. Audit open bug counts, blocker/critical defects, platform compliance, and crash logs. Issue a formal GO / NO-GO recommendation with defect severity breakdown.

## performance-analyst

reads: docs/release/{build}-qa-verdict.md
output: docs/release/{build}-performance-audit.md
outputMode: file-only
progress: true

Audit framerate stability (1% and 0.1% lows), frame-time consistency, memory leaks, draw call count, and asset loading bottlenecks for `{build}` across target hardware profiles. Flag optimization targets.

## security-engineer

reads: docs/release/{build}-qa-verdict.md
output: docs/release/{build}-security-audit.md
outputMode: file-only
progress: true

Perform security and anti-tamper inspection on `{build}`. Verify save game integrity/encryption, credential exposure, cheat vulnerability in multiplayer/leaderboards, and data privacy compliance.

## release-manager

reads: docs/release/{build}-qa-verdict.md+docs/release/{build}-performance-audit.md+docs/release/{build}-security-audit.md
output: docs/release/{build}-release-package.md
outputMode: file-only
progress: true

Assemble the final release package manifest for `{build}`. Draft release notes, platform store checklist (Steam, itch.io, Consoles, Mobile), version bump confirmation, and deployment rollback plan.
