# Code Context

## Files Retrieved
1. `README.md` - Source-of-truth counts and user documentation.
2. `package.json` - Pi manifest; confirms `skills`, `prompts`, `extensions`, and `themes` are wired as package surfaces.
3. `extensions/hooks/index.ts` - Single hook entrypoint.
4. `chains/` - Declarative multi-agent pipelines (3 chains).
5. `skills/` - Skill inventory; 6 ODD skills (`concept`, `spec`, `arch`, `code`, `test`, `ship`).
6. `agents/` - 14 agent templates (Compact 8+1 Studio Architecture: 8 Core roles + 6 Engine Specialists).
7. `chains/` - 3 multi-agent workflow chains.
8. `starters/` - 6 starters (Bevy, Godot, Phaser, Raylib, Unity, Unreal).

## Architecture
- The package surface is organized into `agents/`, `skills/`, `extensions/`, `chains/`, and `starters/` via `package.json`.
- Studio operates on the Compact 8+1 Architecture (8 Core roles + 1 active Engine Specialist per project).
- Development strictly follows Organic Driven Development (ODD) across 6 lifecycle skills.

## Count Verification
All file inventories and counts match the expected state:
- `agents/`: 14 templates (8 Core + 6 Specialists)
- `skills/`: 6 ODD skills
- `chains/`: 3 multi-agent pipelines
- `chains/`: 3 chains
- `starters/`: 6 starters
