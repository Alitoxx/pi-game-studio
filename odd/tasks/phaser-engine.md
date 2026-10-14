# Phaser Engine Support

Phaser 3/4 (TypeScript, web/HTML5) as a first-class engine option: 8 Core + 1 Engine Specialist architecture now offers 6 engine choices, 14 agent templates total.

## Specs

- S1: New agent template `agents/phaser-specialist.md` following the existing specialist pattern (frontmatter with name/description/model: inherit/thinking: medium/tools, ODD workflow, Return Contract, Gamedev Decision Protocol sections).
- S2: Phaser selectable as engine everywhere the other 5 engines are offered: `ENGINE_AGENTS_MAP`, guided setup engine options, `studio-settings.ts` engine picker, `getEngineAgents` normalization.
- S3: Engine auto-detection recognizes a `package.json` with a `phaser` dependency (engine: "Phaser").
- S4: Prerequisite audit for Phaser checks Node.js >= 18 and npm.
- S5: Compile/build watch command for Phaser projects (`npx vite build` fallback chain).
- S6: Starter `starters/phaser-web-2d` (Vite + TypeScript + Phaser) recognized by scaffolding and `/studio:new`.
- S7: `docs/engine-reference/phaser/VERSION.md` exists with "Engine Version" content.
- S8: Engine Support Symmetry: skills `arch`, `code`, `test` mention Phaser; `scripts/yaml-helper.sh` engine enum includes Phaser; `models.default.json` maps `phaser-specialist`.
- S9: Branding surfaces list 6 engines: banner string, subagent widget badge `[Phaser]`, studio-agents tier text, studio-mcp docs description.
- S10: Tests updated: agent file count 13 -> 14, engine specialist tier check includes phaser-specialist, symmetry suites include Phaser, banner test string updated. Full jest suite green.
- S11: Docs updated: AGENTS.md (hierarchy, install counts, specialist section), README engine table, CHANGELOG entry.

## Tasks

- T1 (S1, S8): Template + models/tier — commit feat(agents)
- T2 (S2-S5, S9): Hook plumbing — commit feat(engines)
- T3 (S6, S7): Starter + engine-reference — commit feat(starters)
- T4 (S8): Skills routing + yaml-helper enum — commit feat(skills)
- T5 (S11): Docs — commit docs
- T6 (S10): Tests green — verification, fixes ride along their units

## Log

- L1 (user request, verbatim): "agrega phaser como nuevo motor"
- L2: Context: engines ranked for agent-work suitability (Godot #1); Phaser identified as the only real coverage gap (web/HTML5, TypeScript code-first).
