# Retire the Orphaned Template Layer

Remove `prompts/` from the package: a second, older methodology layer that nothing referenced, that still shipped as Pi prompt templates, and that contradicted the ODD contract enforced everywhere else.

## Specs

- S1: `prompts/` (10 files including `collaborative-protocols/`) is deleted from the repository.
- S2: `package.json` no longer lists `prompts/` in `files` nor registers `prompts` in the `pi` manifest block.
- S3: No document points at a path that no longer exists: README badge, inventory table, CCGS mapping row, repository tree and runtime list, plus `context.md`, are updated.
- S4: The retirement is guarded by invariants: the manifest must not register prompt templates or ship the directory, and `README.md` must not reference the removed path.

## Tasks

- [x] T1 (S1-S3): Delete the layer, clean the manifest, docs and context — commit `59acb3a` refactor(prompts)
- [x] T2 (S4): Retirement invariants in `__tests__/package.test.js` and `__tests__/homologation.test.js` — same commit (RED observed before the deletion)
- [x] T3: Suite green 177/177

## Log

- L1 (user request, verbatim): "retira promtps"
- L2: Motivo: auditoría de fidelidad ODD. `prompts/` era una capa huérfana (ningún skill, agente ni extensión la referenciaba) que igual se publicaba como templates de comando. `game-concept.md:316-321` terminaba en un checklist con seis comandos inexistentes (`/design-review`, `/map-systems`, `/architecture-decision`, `/prototype`, `/playtest-report`, `/sprint-plan new`, todos verificados con cero registros) y los tres `collaborative-protocols` prescribían aprobación por archivo ("May I write this to [filepath]?"), emojis ✅/❌ y celebración — lo contrario de Zero Bleed, cero emojis y anti-sicofancia.
- L3: Slice boundary: 9 commits, 2112 líneas de cambio acumuladas (dominadas por las 1579 líneas eliminadas de `prompts/`). Es un slice de borrado, no de lógica nueva: no infla la carga de revisión como 2000 líneas de implementación.
- L4: Drift residual detectado y NO tocado (fuera de alcance): `README.md:318` y `:446-447` documentan `/setup-engine` y `skills/setup-engine/references/godot.md`, que tampoco existen en este repo. Queda como hallazgo para una pasada posterior.
