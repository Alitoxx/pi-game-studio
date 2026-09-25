# Pi Game Studio

<p align="center">
  Turn a Pi session into a full game development studio.
  <br />
  50 agents. 77 skills. 43 templates. One coordinated AI team.
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="agents"><img src="https://img.shields.io/badge/agents-50-blueviolet" alt="50 Agents"></a>
  <a href="skills"><img src="https://img.shields.io/badge/skills-77-green" alt="77 Skills"></a>
  <a href="prompts"><img src="https://img.shields.io/badge/templates-43-orange" alt="43 Templates"></a>
  <a href="extensions"><img src="https://img.shields.io/badge/hooks-4-red" alt="4 Hooks"></a>
  <img src="https://img.shields.io/badge/built%20for-Pi-8B5CF6?logo=pinokio" alt="Built for Pi">
</p>

---

## Why This Exists

Building a game solo with AI is powerful — but a single chat session has no structure. No one stops you from hardcoding magic numbers, skipping design docs, or writing spaghetti code. There's no QA pass, no design review, no one asking "does this actually fit the game's vision?"

**Pi Game Studio** solves this by giving your AI session the structure of a real studio. Instead of one general-purpose assistant, you get 50 specialized agents organized into a studio hierarchy — directors who guard the vision, department leads who own their domains, and specialists who do the hands-on work. Each agent has defined responsibilities, escalation paths, and quality gates.

The result: you still make every decision, but now you have a team that asks the right questions, catches mistakes early, and keeps your project organized from first brainstorm to launch.

---

## Table of Contents

- [What's Included](#whats-included)
- [Key Mappings (CCGS → Pi)](#key-mappings-ccgs--pi)
- [Studio Hierarchy](#studio-hierarchy)
- [Model Mapping](#model-mapping)
- [Customizing Models](#customizing-models)
- [Slash Commands](#slash-commands)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Design Philosophy](#design-philosophy)
- [Source & Credits](#source--credits)
- [License](#license)

---

## What's Included

| Category      | Count | Description                                                                                                              |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------ |
| **Agents**    | 50    | Specialized agents across design, programming, art, audio, narrative, QA, and production                                 |
| **Skills**    | 77    | Slash commands for every workflow phase (`/start`, `/settings`, `/prototype`, `/vertical-slice`, `/dev-story`, etc.)     |
| **Templates** | 43    | Document templates for GDDs, UX specs, ADRs, sprint plans, vertical slice reports, game briefs, and more                  |
| **Hooks**     | 4     | Automated validation on commits, pushes, skill changes, and session audit/gap detection                                  |
| **Engram**    | 1     | Optional persistent memory — decisions auto-save across sessions when Engram is connected                                |
| **Setup**     | 2     | `/setup` — install agents and model config; `/assign-models` — customize models per agent                                |

## Key Mappings (CCGS → Pi)

| CCGS (Claude Code)            | Pi Game Studio                                        |
| ----------------------------- | ----------------------------------------------------- |
| `.claude/agents/*.md`         | `agents/*.md` (source) → `.pi/agents/` (via `/setup`) |
| `.claude/skills/*/SKILL.md`   | `skills/*/SKILL.md`                                   |
| `.claude/docs/templates/*.md` | `prompts/*.md`                                        |
| `.claude/hooks/*.sh`          | `extensions/hooks/index.ts`                           |
| `.claude/rules/*.md`          | _Handled in-line by skills_                           |
| `CLAUDE.md`                   | `package.json` (pi manifest)                          |
| `.claude/settings.json`       | `models.default.json`                                 |

## Studio Hierarchy

Agents are organized into three tiers, matching how real studios operate:

```
Tier 1 — Directors
  creative-director    technical-director    producer

Tier 2 — Department Leads
  game-designer        lead-programmer       art-director
  audio-director       narrative-director    qa-lead
  release-manager      localization-lead

Tier 3 — Specialists
  gameplay-programmer  engine-programmer     ai-programmer
  network-programmer   tools-programmer      ui-programmer
  systems-designer     level-designer        economy-designer
  technical-artist     sound-designer        writer
  world-builder        ux-designer           prototyper
  performance-analyst  devops-engineer       analytics-engineer
  security-engineer    qa-tester             accessibility-specialist
  live-ops-designer    community-manager     bevy-specialist
```

### Engine Specialists

| Engine              | Lead Agent          | Sub-Specialists                                 |
| ------------------- | ------------------- | ----------------------------------------------- |
| **Godot 4**         | `godot-specialist`  | GDScript, Shaders, GDExtension                  |
| **Unity**           | `unity-specialist`  | DOTS/ECS, Shaders/VFX, Addressables, UI Toolkit |
| **Unreal Engine 5** | `unreal-specialist` | GAS, Blueprints, Replication, UMG/CommonUI      |
| **Bevy (Rust)**     | `bevy-specialist`   | ECS, 2D/3D (wgpu), bevy_ui, Assets, Cargo/WASM  |

## Model Mapping

Pi Game Studio uses **model inheritance**: all agents ship with `model: inherit`, meaning they use the default model of your Pi session. This avoids hardcoding model choices into agent definitions.

The recommended model assignment lives in `models.default.json`:

| Tier                      | Default model                         | Rationale                                                                     |
| ------------------------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| **Directors** (Tier 1)    | `openai-codex/gpt-5.4-mini`           | Heaviest model for strategic planning, architecture, and cross-team decisions |
| **Workhorses** (Tier 2–3) | `openrouter/openai/gpt-oss-120b:free` | Balanced model for day-to-day design, implementation, and review              |
| **Lightweight** (Special) | `openrouter/openai/gpt-oss-20b:free`  | Fast model for simple, repetitive tasks                                       |

After running `/setup`, the mapping is written to `.pi/gentle-ai/models.json`. You can edit it directly or use `/assign-models` to change models interactively.

## Customizing Models

### Via `/assign-models` (interactive)

```bash
/assign-models
```

The skill guides you through:

- Assign a model to an entire tier (director, workhorse, lightweight)
- Assign a model to a specific agent
- Preview changes before applying (dry-run)
- Reset to package defaults

### Via `models.json` (manual)

Edit `.pi/gentle-ai/models.json`:

```json
{
  "creative-director": "anthropic/claude-sonnet-4",
  "technical-director": "anthropic/claude-sonnet-4",
  "producer": "anthropic/claude-sonnet-4",
  "game-designer": "openai/gpt-4o",
  "lead-programmer": "openai/gpt-4o",
  "community-manager": "ollama/llama3.2"
}
```

Agents not listed use the session default.

### Provider examples

| Provider             | Model ID Format                 | Example                               |
| -------------------- | ------------------------------- | ------------------------------------- |
| **Anthropic Claude** | `anthropic/<model>`             | `anthropic/claude-sonnet-4`           |
| **OpenAI**           | `openai/<model>`                | `openai/gpt-4o`, `openai/o3`          |
| **Google Gemini**    | `google/<model>`                | `google/gemini-2.5-pro`               |
| **OpenRouter**       | `openrouter/<provider>/<model>` | `openrouter/openai/gpt-oss-120b:free` |
| **Ollama** (local)   | `ollama/<model>`                | `ollama/llama3.2`                     |

## Slash Commands

Type `/` in Pi to browse all 75 skills:

### Onboarding & Navigation

`/start` `/help` `/project-stage-detect` `/setup-engine` `/adopt`

### Game Design

`/brainstorm` `/map-systems` `/design-system` `/quick-design` `/review-all-gdds` `/propagate-design-change`

### Art & Assets

`/art-bible` `/asset-spec` `/asset-audit`

### UX & Interface Design

`/ux-design` `/ux-review`

### Architecture

`/create-architecture` `/architecture-decision` `/architecture-review` `/create-control-manifest`

### Stories & Sprints

`/create-epics` `/create-stories` `/dev-story` `/sprint-plan` `/sprint-status` `/story-readiness` `/story-done` `/estimate`

### Reviews & Analysis

`/design-review` `/code-review` `/balance-check` `/content-audit` `/scope-check` `/perf-profile` `/tech-debt` `/gate-check` `/consistency-check`

### QA & Testing

`/qa-plan` `/smoke-check` `/soak-test` `/regression-suite` `/test-setup` `/test-helpers` `/test-evidence-review` `/test-flakiness` `/skill-test` `/skill-improve`

### Production

`/milestone-review` `/retrospective` `/bug-report` `/bug-triage` `/reverse-document` `/playtest-report`

### Release

`/release-checklist` `/launch-checklist` `/changelog` `/patch-notes` `/hotfix`

### Creative & Content

`/prototype` `/onboard` `/localize`

### Team Orchestration

`/team-combat` `/team-narrative` `/team-ui` `/team-release` `/team-polish` `/team-audio` `/team-level` `/team-live-ops` `/team-qa`

### Package Admin

`/setup` `/assign-models` `/connect-engram`

## Getting Started

### Prerequisites

- [Pi](https://pi.dev) (`npm install -g @earendil-works/pi-coding-agent`)
- [Git](https://git-scm.com/)

### Install

```bash
pi install git:github.com/<your-org>/pi-game-studio
```

Or from a local path during development:

```bash
pi install ./pi-game-studio -l
```

### Setup

```bash
/setup
```

This copies the 49 agents to `.pi/agents/` and creates `.pi/gentle-ai/models.json` with the default model mapping.

### Start

```bash
/start
```

The system asks where you are — no idea, vague concept, clear design, or existing work — and guides you to the right workflow. No assumptions.

Or jump directly to a specific skill:

- `/brainstorm` — explore game ideas from scratch
- `/setup-engine godot 4.6` — configure your engine
- `/project-stage-detect` — analyze an existing project

### Customize models (optional)

```bash
/assign-models
```

Or edit `.pi/gentle-ai/models.json` directly.

### Connect Engram (optional)

If you have [Engram](https://pi.dev/engram) installed, `/setup` detects it and asks if you want to use it as a decision repository. You can also connect later:

```bash
/connect-engram
```

This scans your existing project files (GDDs, ADRs, gate checks, stories) and syncs them to Engram for cross-session searchable persistence. Once connected, key skills auto-save decisions:

| Skill                    | What it persists                         |
| ------------------------ | ---------------------------------------- |
| `/brainstorm`            | Game concept (genre, setting, core loop) |
| `/architecture-decision` | ADR with rationale and alternatives      |
| `/gate-check`            | Phase gate verdict with blockers         |
| `/design-system`         | GDD per system with player fantasy       |
| `/design-review`         | Review findings and recommendations      |
| `/story-done`            | Story completion with criteria status    |

Engram is **optional** — without it, everything works with project files only, just like the original CCGS.

---

## Project Structure

```
pi-game-studio/                     # Package root
├── package.json                    # Pi manifest (skills, prompts, extensions)
├── README.md                       # This file
├── LICENSE                         # MIT
├── AGENTS.md                       # Full agent roster
├── models.default.json             # Recommended 3-tier model mapping
├── agents/                         # 49 source agents (model: inherit)
├── skills/                         # 75 skills (SKILL.md per directory)
├── prompts/                        # 38 document templates
├── extensions/                     # Hooks extension
│   └── hooks/
│       ├── index.ts                # 4 ported hooks
│       └── package.json
└── scripts/                        # Utility scripts
```

## How It Works

Pi Game Studio is a **Pi package** (not a file copy). Everything lives in the package and is loaded by Pi at runtime:

1. **`pi install`** — registers the package in Pi's settings
2. **`/setup`** — copies agents to `.pi/agents/` and configures model mapping
3. **Skills** — loaded directly from the package; available as `/` commands
4. **Templates** — available through Pi's prompt template expansion
5. **Hooks** — loaded as a Pi extension; run automatically on relevant events

Agents use `model: inherit` — they adopt the model from your Pi session configuration. The `models.default.json` provides a recommended tier-based mapping that gets installed to `.pi/gentle-ai/models.json` and can be customized per agent.

Delegation between agents works through Pi's `subagent` tool. A director spawns a lead, a lead spawns specialists. Each agent returns structured results and passes decisions back up. Director gates enforce quality checkpoints.

## Design Philosophy

- **You are the boss.** The studio makes recommendations, asks questions, and catches mistakes — but you make the final call.
- **Structured, not rigid.** The framework provides process, but you can skip, reorder, or customize any step.
- **Model-agnostic.** All agents use `model: inherit`. Choose any provider, any model, and change it whenever you want.
- **Familiar hierarchy.** Agents mirror real game studio roles. If you've worked in a studio, the structure makes immediate sense.
- **Review work matters.** No design doc, architecture decision, or implementation passes without review from the right agent.
- **Quality gates.** Director gates (APPROVE / CONCERNS / REJECT) prevent advancing with unresolved issues.

## Changelog

### v0.4.0 — 2026-09-24

- **Dual Upstream Homologation Pass** — synchronized with CCGS (Donchitos v1.1.1) and OCGS (striderZA v0.13.0):
  - **50 agents** (+`bevy-specialist` covering Bevy 0.19 / Rust ECS, wgpu 2D/3D, bevy_ui, audio, input, Cargo/WASM)
  - **77 skills** (+`/vertical-slice` for pre-production loop validation; +`/settings` for project configuration; updated `/prototype` with `--spike` mode; updated `/setup-engine`)
  - **43 templates** (+`game-brief.md`, `prototype-report.md`, `vertical-slice-report.md`, `session-state.md`, `SKILL-CONTRACT-TEMPLATE.md`)
  - **4 runtime hooks**
- **Unified Configuration**: added `project.yaml` support with `/settings` and `scripts/yaml-helper.sh`
- **Prototype Overhaul**: `/prototype` updated with concept validation, `--spike` mode (4-hour technical spikes), and updated `prototyper` agent
- **Engine Reference & Support**: Added Bevy Engine reference docs (`docs/engine-reference/bevy/`) and specialist routing in `/setup-engine`

### v0.3.0 — 2026-05-16

- **Homologation pass** — aligned the Pi inventory with the current tree and normalized the public counts:
  - 49 agents
  - 75 skills
  - 38 templates
  - 4 runtime hooks
- **README provenance note** — added explicit source/origin and Pi-homologation notes for upstream parity tracking
- **Regression coverage** — added inventory tests so README counts stay in sync with the actual file tree
- **Setup completion** — generated `.pi/gentle-ai/models.json` from `models.default.json`

### v0.2.0 — 2026-05-12

- **`/brainstorm`** — rewritten with professional studio ideation structure:
  - Assigned to `creative-director` agent for vision-aligned brainstorming
  - **Engram checkpoints** at each phase (Creative Discovery, Concept Generation, Core Loop, Pillars) — if a session is interrupted, `/brainstorm` detects the last checkpoint and offers to resume
  - **Smart resume** — checks both `game-concept.md` and Engram memory, then asks: resume, start fresh with backup, or overwrite
  - **Auto-backup** existing `game-concept.md` with timestamp before overwriting

- **`/start`** — smarter first-run detection:
  - **Silent Engram availability check** — detects if Engram CLI is installed and connected without cluttering the output
  - **Context snapshot** — saves user's onboarding state to Engram for continuity across sessions

### v0.1.0 — 2026-05-11

- Initial release. Port of CCGS (49 agents, 75 skills) to Pi package format.
  - 49 agents with `model: inherit` architecture
  - 75 skills covering design → production → release
  - 38 document templates
  - 4 hooks extension
  - SDD agents for structured development
  - Optional Engram integration

---

## Source & Credits

This project is a migration of **Claude Code Game Studios** to run natively on Pi. All the credit for the original work goes to its creators.

### Original creators

- **[Donchitos](https://github.com/Donchitos)** — creador de [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios) (CCGS), el framework original de 49 agents y 72 skills para Claude Code. Es la fuente primaria de todo en este package: agents, skills, templates, hooks, y la jerarquía del estudio.

- **[striderZA](https://github.com/striderZA)** — creador de [OpenCode Game Studios](https://github.com/striderZA/OpenCodeGameStudios) (OCGS), el port a OpenCode que pioneeró los patrones de migración cross-platform, el utility de model assignment (`assign-models.js`), y el formato de documentación de port status.

- **[Gentle Programming](https://github.com/gentleprogramming)** — creador de [Gentle AI](https://github.com/gentleprogramming/gentle-ai) y del sistema **Engram**, la memoria persistente para agentes que permite el seguimiento de decisiones cross-session. La integración con Engram en este package sigue el modelo iniciado por Gentle AI.

### Qué cambia este port

- **Provenance**: README inventory counts reflect the current Pi tree; imported content and intentional Pi divergences are called out in the homologation note below.

- **Plataforma**: Agents, skills y templates adaptados de `.claude/` (Claude Code) y `.opencode/` (OpenCode) al formato de package de Pi
- **Arquitectura de modelos**: Todos los agents usan `model: inherit` en vez de tiers hardcodeados — los modelos se asignan via `models.json` (estilo Gentle AI)
- **Sistema de package**: Todo se distribuye como un Pi package instalable (`pi install`), no una copia de archivos
- **Integración con Engram**: Memoria persistente opcional para seguimiento de decisiones cross-session

### Homologation note

- Imported counts were normalized to the current Pi tree: 50 agents, 77 skills, 43 templates, 4 runtime hooks.
- `extensions/hooks/index.ts` remains the single hook entrypoint; hook behavior is split across four handlers.

Este port no existiría sin el trabajo fundacional de Donchitos y striderZA. Gracias.

## License

MIT — see [LICENSE](LICENSE).
