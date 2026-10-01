# Code Context

## Files Retrieved
1. `README.md` - source-of-truth counts.
2. `package.json` - Pi manifest; confirms `skills`, `prompts`, and `extensions` are wired as package surfaces.
3. `extensions/hooks/index.ts` - single hook entrypoint.
4. `prompts/` - template inventory; 49 templates.
5. `skills/` - skill inventory; 80 skills.
6. `agents/` - 55 agents.
7. `chains/` - 7 chains.
8. `starters/` - 5 starters.

## Architecture
- The package surface is split into `agents/`, `skills/`, `prompts/`, `extensions/`, `chains/`, and `starters/` via `package.json`.
- Agents and skills are aligned with the published counts.

## Count Mismatches
None. All file inventories and counts match the expected state:
- `agents/`: 55 files
- `skills/`: 80 files
- `prompts/`: 49 files
- `chains/`: 7 files
- `starters/`: 5 templates
