# Code Context

## Files Retrieved
1. `README.md` (lines 1-13, 294-349, 377-378) - source-of-truth counts and the homologation note; shows the stale 35/4 claims.
2. `package.json` (lines 1-28) - Pi manifest; confirms `skills`, `prompts`, and `extensions` are wired as package surfaces.
3. `extensions/hooks/index.ts` (lines 1-220) - single hook entrypoint; contains four logical handlers, but only one physical hook module.
4. `extensions/hooks/package.json` - hook package boundary; useful for checking whether a second hook artifact is expected.
5. `prompts/` (all files; 35 top-level, 3 nested) - template inventory; confirms actual template count is 38, not 35.
6. `skills/` (all `SKILL.md`; 75 files) - skill inventory; current count matches README, so no count gap here.
7. `models.default.json` (lines 1-55) - not a gap target, but confirms the current agent/model mapping is present and complete enough for homologation context.
8. `.atl/skill-registry.md` (lines 1-220) - registry exists and is current; not a missing artifact, but relevant for skill/doc resolution.

## Key Code
- `README.md:6-13`
  - Declares `49 agents. 75 skills. 35 templates. ... 4 Hooks.`
- `README.md:295-348`
  - Repeats `35 document templates` and `4 hooks extension` in the project tree/release notes.
- `README.md:377-378`
  - Homologation note says counts were normalized to `49 agents, 75 skills, 35 templates, 4 runtime hooks`, but the repo still only has 3 hook files and 38 prompt markdowns.
- `extensions/hooks/index.ts`
  - Implements 4 behaviors inside one file: git commit validation, skill-change advisory, agent audit trail, and documentation gap detection.
- `prompts/collaborative-protocols/*.md`
  - Three nested prompt docs account for the extra 3 templates beyond the README count.

## Architecture
- The package surface is split into `agents/`, `skills/`, `prompts/`, and `extensions/` via `package.json`.
- Agents and skills are aligned with the published counts.
- The remaining homologation drift is mostly in documentation/counting, not runtime wiring:
  - prompts: README still treats templates as 35 top-level items, but the tree has 38 markdowns because of `prompts/collaborative-protocols/*`.
  - hooks: README says 4 hooks, but `extensions/hooks/` contains one entrypoint file plus package metadata/tests; the 4 hooks are logical handlers inside `index.ts`, not separate hook artifacts.
- This suggests the repo is close to homogeneous, but the published inventory is still stale relative to the actual tree.

## Start Here
`README.md` first, because the remaining gaps are primarily count/documentation mismatches and the homologation note needs to be reconciled with the actual file tree.

## Supervisor coordination
Not needed; this was a read-only inventory pass.

## Remaining Homologation Gaps
- `README.md` counts are stale for templates/hooks.
- `prompts/collaborative-protocols/design-agent-protocol.md`
- `prompts/collaborative-protocols/implementation-agent-protocol.md`
- `prompts/collaborative-protocols/leadership-agent-protocol.md`
  - Rough scope: medium, because they create a nested prompt subfamily that is not reflected in the 35-template messaging.
  - Risk: medium, mostly discovery/UX/doc hygiene; low runtime risk.
- `extensions/hooks/index.ts`
  - Rough scope: medium, because four logical hooks are collapsed into one file while the README implies four hooks as a package feature.
  - Risk: medium-high if homologation expects one artifact per hook; low if logical handlers are acceptable.
- `README.md` sections around counts and release history
  - Rough scope: small, but high visibility.
  - Risk: medium, because stale counts undermine trust in the package inventory.
- `extensions/hooks/package.json`
  - Rough scope: small, but worth checking for whether it should declare a clearer hook entrypoint/manifest story.
  - Risk: low-medium.

## Count Mismatches
- `agents/`: 49 files, matches README.
- `skills/`: 75 `SKILL.md` files, matches README.
- `prompts/`: 38 markdown files total, README still says 35.
  - 35 top-level templates + 3 nested collaborative-protocol docs.
- `extensions/hooks/`: 3 physical files, README says 4 hooks.
  - The missing piece is likely not a runtime function, but a docs/packaging normalization so the inventory matches the logical hook split.
