# Changelog

All notable changes to **Pi Game Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.0] - 2026-09-24

### Added
- **Retro Gaming Startup Banner & Dashboard (`extensions/hooks/banner.ts`, `extensions/hooks/index.ts`)**:
  - Implemented ASCII art studio logo with pixel-perfect visual width calculation.
  - Studio status card displaying:
    - **Directors**: 3 active (`creative-director`, `technical-director`, `producer`).
    - **Workhorses**: 44 domain specialists across design, code, art, audio, and QA.
    - **Game Engine**: Dynamic detection from `project.yaml` or `.pi/game-studio/technical-preferences.md` (Godot, Unity, Unreal, Bevy).
    - **Skills & Templates**: Live counts (77 skills, 43 templates).
    - **Storage**: Detection of Engram persistent memory vs local storage.
    - **Tips**: Quick shortcuts (`/start`, `/brainstorm`, `/settings`).
  - Integrated with Pi TUI header (`ctx.ui.setHeader`) and fallback console rendering for non-TUI runs.
- **Studio Command Identity & Prefix (`skills/*/SKILL.md`)**:
  - Added `🎮 [Studio]` prefix to all 77 skill descriptions so they stand out immediately from native Pi commands in the `/` autocomplete menu.
  - Added `/studio` slash command (`extensions/hooks/studio-command.ts`, `extensions/hooks/index.ts`) with interactive category browsing and cheat sheets.
- **Guided & Interactive Setup Flow (`skills/setup/SKILL.md`, `skills/assign-models/SKILL.md`)**:
  - Replaced immediate automated file copies with an interactive interview and explanation step.
  - Displays what will be copied and checks for existing installations before modifying files.
  - Added bilingual prompt instructions (detecting user language: Spanish / English) to respond and guide in the user's preferred language.
  - Interactive confirmation gates via `ask_user_question` before applying agent files or model configurations.
- **Dual Upstream Homologation (CCGS v1.1.1 + OCGS v0.13.0)**:
  - Added 50th agent: `agents/bevy-specialist.md` with Bevy 0.19 docs in `docs/engine-reference/bevy/`.
  - Added 2 new skills: `skills/vertical-slice/SKILL.md` (pre-production gate) and `skills/settings/SKILL.md` (`project.yaml` manager).
  - Added 5 new templates in `prompts/`: `game-brief.md`, `prototype-report.md`, `vertical-slice-report.md`, `session-state.md`, `SKILL-CONTRACT-TEMPLATE.md`.
  - Added unified `project.yaml` configuration with `scripts/yaml-helper.sh`.
- **Testing Sandbox**:
  - Added `sandbox/` and `playground/` to `.gitignore` for isolated testing.

### Changed
- **Decoupled Engram ("Files First, Memory Accelerated")**:
  - Removed hard dependencies on external `engram_mem_save` from skill tool lists across all skills (`architecture-decision`, `brainstorm`, `connect-engram`, `design-review`, `design-system`, `gate-check`, `setup`, `skill-improve`, `start`, `story-done`).
  - Guaranteed 100% functionality with local Markdown files in Git repository when Engram is not installed.
  - Refactored `/connect-engram` into an intelligent diagnostic and sync assistant with graceful degradation.
- Updated `/prototype` skill with concept validation and `--spike` mode (time-boxed 4h technical spikes).
- Updated `prototyper` agent with spike protocols and risk burn-down templates.
- Updated `models.default.json` and `scripts/assign-models.js` to assign all 50 agents.

---

## [0.3.0] - 2026-05-16

### Added
- Automated Jest test infrastructure for homologation inventory integrity (`__tests__/homologation.test.js`, `__tests__/package.test.js`).
- Public inventory badges and provenance tables in `README.md`.

### Changed
- Aligned inventory to 49 agents, 75 skills, 38 templates, and 4 runtime hooks.

---

## [0.2.0] - 2026-05-12

### Added
- Engram persistent memory checkpoints and smart resume in `/brainstorm`.
- Context snapshotting in `/start`.

---

## [0.1.0] - 2026-05-11

### Added
- Initial release migrating Claude Code Game Studios to Pi package architecture.
