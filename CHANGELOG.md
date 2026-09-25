# Changelog

All notable changes to **Pi Game Studio** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.5.0] - 2026-09-25

### Added
- **Studio Command Visual Identity (`skills/*/SKILL.md`)**:
  - Added `🎮 [Studio]` prefix to all 77 skill descriptions so they stand out immediately from native Pi commands in the `/` autocomplete menu.
  - Added `/studio` slash command (`extensions/hooks/studio-command.ts`, `extensions/hooks/index.ts`) with interactive category browsing (Pre-producción, Diseño, Motores, Arte/Audio, QA, Producción, Configuración) and command cheatsheets.
- **Retro Gaming Startup Banner & Live Dashboard (`extensions/hooks/banner.ts`, `extensions/hooks/index.ts`)**:
  - ASCII art studio logo with pixel-perfect mathematical terminal centering (`center(line, width)`).
  - Live studio status card displaying active directors (3), specialists (44), detected game engine, live skill/template counts (77/43), storage status, and quick-start tips.
  - Integrated into Pi TUI header (`ctx.ui.setHeader`) on `session_start` with fallback console output.
  - Dynamic version reading directly from `package.json`.
- **Guided & Interactive Setup Flow (`skills/setup/SKILL.md`, `skills/assign-models/SKILL.md`)**:
  - Transparent step-by-step onboarding interview with bilingual support (ES/EN).
  - Explicit confirmation prompts (`ask_user_question`) before modifying any project files or copying agents.
- **Testing Sandbox**:
  - Added `sandbox/` and `playground/` to `.gitignore` for isolated development and testing.

### Changed
- **Decoupled Engram ("Files First, Memory Accelerated")**:
  - Removed hard dependencies on external `engram_mem_save` from skill tool lists across all skills (`architecture-decision`, `brainstorm`, `connect-engram`, `design-review`, `design-system`, `gate-check`, `setup`, `skill-improve`, `start`, `story-done`).
  - Guaranteed 100% functionality with local Markdown files in Git repository when Engram is not installed.
  - Refactored `/connect-engram` into an intelligent diagnostic and sync assistant with graceful degradation.

---

## [0.4.0] - 2026-09-24

### Added
- **Dual Upstream Homologation (CCGS v1.1.1 + OCGS v0.13.0)**:
  - Added 50th agent: `agents/bevy-specialist.md` with Bevy 0.19 docs in `docs/engine-reference/bevy/`.
  - Added 2 new skills: `skills/vertical-slice/SKILL.md` (pre-production gate) and `skills/settings/SKILL.md` (`project.yaml` manager).
  - Added 5 new templates in `prompts/`: `game-brief.md`, `prototype-report.md`, `vertical-slice-report.md`, `session-state.md`, `SKILL-CONTRACT-TEMPLATE.md`.
  - Added unified `project.yaml` configuration with `scripts/yaml-helper.sh`.

### Changed
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
