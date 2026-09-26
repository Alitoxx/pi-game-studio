# Pi Game Studio Skills — Catálogo y Referencia Oficial

Guía de referencia completa para las **77 skills** (comandos slash) de Pi Game Studio, organizadas por etapas del ciclo de desarrollo de videojuegos.

---

## Índice de Fases

1. [Concepto, Onboarding e Ideación](#1-concepto-onboarding-e-ideación)
2. [Arquitectura y Configuración Técnica](#2-arquitectura-y-configuración-técnica)
3. [Pre-Producción, UX y Prototipado](#3-pre-producción-ux-y-prototipado)
4. [Gestión de Producción y Sprints](#4-gestión-de-producción-y-sprints)
5. [Desarrollo, Código e Implementación](#5-desarrollo-código-e-implementación)
6. [Control de Calidad (QA) y Testing](#6-control-de-calidad-qa-y-testing)
7. [Lanzamiento (Release) y Operaciones](#7-lanzamiento-release-y-operaciones)
8. [Cadenas y Orquestaciones de Equipo (team-*)](#8-cadenas-y-orquestaciones-de-equipo-team-)
9. [Comandos del Sistema (studio:*)](#9-comandos-del-sistema-studio)

---

## 1. Concepto, Onboarding e Ideación

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/start`** | `game-designer` | First-time onboarding — asks where you are, then guides you to the right workflow. No assumptions. |
| **`/brainstorm`** | `creative-director` | Guided game concept ideation — from zero idea to a structured game concept document. Uses professional studio ideation techniques, player psychology frameworks, and structured creative exploration. |
| **`/art-bible`** | _Dinámico / Contextual_ | Guided, section-by-section Art Bible authoring. Creates the visual identity specification that gates all asset production. Run after /brainstorm is approved and before /map-systems or any GDD authoring begins. |
| **`/design-system`** | _Dinámico / Contextual_ | Guided, section-by-section GDD authoring for a single game system. Gathers context from existing docs, walks through each required section collaboratively, cross-references dependencies, and writes incrementally to file. |
| **`/map-systems`** | _Dinámico / Contextual_ | Decompose a game concept into individual systems, map dependencies, prioritize design order, and create the systems index. |
| **`/review-all-gdds`** | _Dinámico / Contextual_ | Holistic cross-GDD consistency and game design review. Reads all system GDDs simultaneously and checks for contradictions between them, stale references, ownership conflicts, formula incompatibilities, and game design theory violations (dominant strategies, economic imbalance, cognitive overload, pillar drift). Run after all MVP GDDs are written, before architecture begins. |
| **`/design-review`** | _Dinámico / Contextual_ | Reviews a game design document for completeness, internal consistency, implementability, and adherence to project design standards. Run this before handing a design document to programmers. |
| **`/adopt`** | `technical-director` | Brownfield onboarding — audits existing project artifacts for template format compliance (not just existence), classifies gaps by impact, and produces a numbered migration plan. Run this when joining an in-progress project or upgrading from an older template version. Distinct from /project-stage-detect (which checks what exists) — this checks whether what exists will actually work with the template |
| **`/quick-design`** | _Dinámico / Contextual_ | Lightweight design spec for small changes — tuning adjustments, minor mechanics, balance tweaks. Skips full GDD authoring when a system GDD already exists or the change is too small to warrant one. Produces a Quick Design Spec that embeds directly into story files. |
| **`/propagate-design-change`** | `technical-director` | When a GDD is revised, scans all ADRs and the traceability index to identify which architectural decisions are now potentially stale. Produces a change impact report and guides the user through resolution. |
| **`/project-stage-detect`** | _Dinámico / Contextual_ | Automatically analyze project state, detect stage, identify gaps, and recommend next steps based on existing artifacts. Use when user asks |
| **`/onboard`** | _Dinámico / Contextual_ | Generates a contextual onboarding document for a new contributor or agent joining the project. Summarizes project state, architecture, conventions, and current priorities relevant to the specified role or area. |

---

## 2. Arquitectura y Configuración Técnica

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/setup-engine`** | _Dinámico / Contextual_ | Configure the project |
| **`/create-architecture`** | `technical-director` | Guided, section-by-section authoring of the master architecture document for the game. Reads all GDDs, the systems index, existing ADRs, and the engine reference library to produce a complete architecture blueprint before any code is written. Engine-version-aware: flags knowledge gaps and validates decisions against the pinned engine version. |
| **`/architecture-decision`** | _Dinámico / Contextual_ | Creates an Architecture Decision Record (ADR) documenting a significant technical decision, its context, alternatives considered, and consequences. Every major technical choice should have an ADR. |
| **`/create-control-manifest`** | `technical-director` | After architecture is complete, produces a flat actionable rules sheet for programmers — what you must do, what you must never do, per system and per layer. Extracted from all Accepted ADRs, technical preferences, and engine reference docs. More immediately actionable than ADRs (which explain why). |
| **`/architecture-review`** | `technical-director` | Validates completeness and consistency of the project architecture against all GDDs. Builds a traceability matrix mapping every GDD technical requirement to ADRs, identifies coverage gaps, detects cross-ADR conflicts, verifies engine compatibility consistency across all decisions, and produces a PASS/CONCERNS/FAIL verdict. The architecture equivalent of /design-review. |
| **`/security-audit`** | `security-engineer` | Audit the game for security vulnerabilities: save tampering, cheat vectors, network exploits, data exposure, and input validation gaps. Produces a prioritised security report with remediation guidance. Run before any public release or multiplayer launch. |
| **`/connect-engram`** | _Dinámico / Contextual_ | Diagnostic & sync assistant for Engram persistent memory. Checks connection, enables/disables memory cache, or syncs project decisions to Engram. |
| **`/perf-profile`** | `performance-analyst` | Structured performance profiling workflow. Identifies bottlenecks, measures against budgets, and generates optimization recommendations with priority rankings. |

---

## 3. Pre-Producción, UX y Prototipado

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/prototype`** | `prototyper` | Concept prototype before GDDs — throwaway HTML, Engine or Paper build, PROCEED/PIVOT/KILL. After /brainstorm and /setup-engine. |
| **`/vertical-slice`** | `prototyper` | Pre-production validation — end-to-end build to confirm the full loop is achievable before committing to Production. After GDDs, architecture, UX specs. |
| **`/playtest-report`** | _Dinámico / Contextual_ | Generates a structured playtest report template or analyzes existing playtest notes into a structured format. Use this to standardize playtest feedback collection and analysis. |
| **`/ux-design`** | `ux-designer` | Guided, section-by-section UX spec authoring for a screen, flow, or HUD. Reads game concept, player journey, and relevant GDDs to provide context-aware design guidance. Produces ux-spec.md (per screen/flow) or hud-design.md using the studio templates. |
| **`/ux-review`** | `ux-designer` | Validates a UX spec, HUD design, or interaction pattern library for completeness, accessibility compliance, GDD alignment, and implementation readiness. Produces APPROVED / NEEDS REVISION / MAJOR REVISION NEEDED verdict with specific gaps. |
| **`/gate-check`** | _Dinámico / Contextual_ | Validate readiness to advance between development phases. Produces a PASS/CONCERNS/FAIL verdict with specific blockers and required artifacts. Use when user says |
| **`/asset-spec`** | _Dinámico / Contextual_ | Generate per-asset visual specifications and AI generation prompts from GDDs, level docs, or character profiles. Produces structured spec files and updates the master asset manifest. Run after art bible and GDD/level design are approved, before production begins. |
| **`/asset-audit`** | _Dinámico / Contextual_ | Audits game assets for compliance with naming conventions, file size budgets, format standards, and pipeline requirements. Identifies orphaned assets, missing references, and standard violations. |

---

## 4. Gestión de Producción y Sprints

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/create-epics`** | `technical-director` | Translate approved GDDs + architecture into epics — one epic per architectural module. Defines scope, governing ADRs, engine risk, and untraced requirements. Does NOT break into stories — run /create-stories [epic-slug] after each epic is created. |
| **`/create-stories`** | `lead-programmer` | Break a single epic into implementable story files. Reads the epic, its GDD, governing ADRs, and control manifest. Each story embeds its GDD requirement TR-ID, ADR guidance, acceptance criteria, story type, and test evidence path. Run after /create-epics for each epic. |
| **`/story-readiness`** | _Dinámico / Contextual_ | Validate that a story file is implementation-ready. Checks for embedded GDD requirements, ADR references, engine notes, clear acceptance criteria, and no open design questions. Produces READY / NEEDS WORK / BLOCKED verdict with specific gaps. Use when user says |
| **`/sprint-plan`** | _Dinámico / Contextual_ | Generates a new sprint plan or updates an existing one based on the current milestone, completed work, and available capacity. Pulls context from production documents and design backlogs. |
| **`/sprint-status`** | _Dinámico / Contextual_ | Fast sprint status check. Reads the current sprint plan, scans story files for status, and produces a concise progress snapshot with burndown assessment and emerging risks. Run at any time during a sprint for quick situational awareness. Use when user asks |
| **`/story-done`** | _Dinámico / Contextual_ | End-of-story completion review. Reads the story file, verifies each acceptance criterion against the implementation, checks for GDD/ADR deviations, prompts code review, updates story status to Complete, and surfaces the next ready story from the sprint. |
| **`/milestone-review`** | _Dinámico / Contextual_ | Generates a comprehensive milestone progress review including feature completeness, quality metrics, risk assessment, and go/no-go recommendation. Use at milestone checkpoints or when evaluating readiness for a milestone deadline. |
| **`/tech-debt`** | _Dinámico / Contextual_ | Track, categorize, and prioritize technical debt across the codebase. Scans for debt indicators, maintains a debt register, and recommends repayment scheduling. |
| **`/scope-check`** | _Dinámico / Contextual_ | Analyze a feature or sprint for scope creep by comparing current scope against the original plan. Flags additions, quantifies bloat, and recommends cuts. Use when user says |
| **`/estimate`** | _Dinámico / Contextual_ | Estimates task effort by analyzing complexity, dependencies, historical velocity, and risk factors. Produces a structured estimate with confidence levels. |
| **`/retrospective`** | _Dinámico / Contextual_ | Generates a sprint or milestone retrospective by analyzing completed work, velocity, blockers, and patterns. Produces actionable insights for the next iteration. |

---

## 5. Desarrollo, Código e Implementación

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/dev-story`** | _Dinámico / Contextual_ | Read a story file and implement it. Loads the full context (story, GDD requirement, ADR guidelines, control manifest), routes to the right programmer agent for the system and engine, implements the code and test, and confirms each acceptance criterion. The core implementation skill — run after /story-readiness, before /code-review and /story-done. |
| **`/code-review`** | `lead-programmer` | Performs an architectural and quality code review on a specified file or set of files. Checks for coding standard compliance, architectural pattern adherence, SOLID principles, testability, and performance concerns. |
| **`/reverse-document`** | _Dinámico / Contextual_ | Generate design or architecture documents from existing implementation. Works backwards from code/prototypes to create missing planning docs. |
| **`/consistency-check`** | _Dinámico / Contextual_ | Scan all GDDs against the entity registry to detect cross-document inconsistencies: same entity with different stats, same item with different values, same formula with different variables. Grep-first approach — reads registry then targets only conflicting GDD sections rather than full document reads. |
| **`/balance-check`** | `economy-designer` | Analyzes game balance data files, formulas, and configuration to identify outliers, broken progressions, degenerate strategies, and economy imbalances. Use after modifying any balance-related data or design. Use when user says |
| **`/content-audit`** | `producer` | Audit GDD-specified content counts against implemented content. Identifies what |

---

## 6. Control de Calidad (QA) y Testing

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/test-setup`** | _Dinámico / Contextual_ | Scaffold the test framework and CI/CD pipeline for the project |
| **`/test-helpers`** | _Dinámico / Contextual_ | Generate engine-specific test helper libraries for the project |
| **`/qa-plan`** | `qa-lead` | Generate a QA test plan for a sprint or feature. Reads GDDs and story files, classifies stories by test type (Logic/Integration/Visual/UI), and produces a structured test plan covering automated tests required, manual test cases, smoke test scope, and playtest sign-off requirements. Run before sprint begins or when starting a major feature. |
| **`/smoke-check`** | _Dinámico / Contextual_ | Run the critical path smoke test gate before QA hand-off. Executes the automated test suite, verifies core functionality, and produces a PASS/FAIL report. Run after a sprint |
| **`/bug-report`** | _Dinámico / Contextual_ | Creates a structured bug report from a description, or analyzes code to identify potential bugs. Ensures every bug report has full reproduction steps, severity assessment, and context. |
| **`/bug-triage`** | _Dinámico / Contextual_ | Read all open bugs in production/qa/bugs/, re-evaluate priority vs. severity, assign to sprints, surface systemic trends, and produce a triage report. Run at sprint start or when the bug count grows enough to need re-prioritization. |
| **`/test-evidence-review`** | _Dinámico / Contextual_ | Quality review of test files and manual evidence documents. Goes beyond existence checks — evaluates assertion coverage, edge case handling, naming conventions, and evidence completeness. Produces ADEQUATE/INCOMPLETE/MISSING verdict per story. Run before QA sign-off or on demand. |
| **`/test-flakiness`** | _Dinámico / Contextual_ | Detect non-deterministic (flaky) tests by reading CI run logs or test result history. Aggregates pass rates per test, identifies intermittent failures, recommends quarantine or fix, and maintains a flaky test registry. Best run during Polish phase or after multiple CI runs. |
| **`/soak-test`** | _Dinámico / Contextual_ | Generate a soak test protocol for extended play sessions. Defines what to observe, measure, and log during long play sessions to surface slow leaks, fatigue effects, and edge cases that only appear after sustained play. Primarily used in Polish and Release phases. |
| **`/regression-suite`** | _Dinámico / Contextual_ | Map test coverage to GDD critical paths, identify fixed bugs without regression tests, flag coverage drift from new features, and maintain tests/regression-suite.md. Run after implementing a bug fix or before a release gate. |
| **`/skill-test`** | `qa-lead` | Validate skill files for structural compliance and behavioral correctness. Three modes: static (linter), spec (behavioral), audit (coverage report). |
| **`/skill-improve`** | `qa-lead` | Improve a skill using a test-fix-retest loop. Runs static checks, proposes targeted fixes, rewrites the skill, re-tests, and keeps or reverts based on score change. DEPENDENCY: Requires /skill-test to be functional. |

---

## 7. Lanzamiento (Release) y Operaciones

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/release-checklist`** | _Dinámico / Contextual_ | Generates a comprehensive pre-release validation checklist covering build verification, certification requirements, store metadata, and launch readiness. |
| **`/launch-checklist`** | _Dinámico / Contextual_ | Complete launch readiness validation covering every department: code, content, store, marketing, community, infrastructure, legal, and go/no-go sign-offs. |
| **`/patch-notes`** | `community-manager` | Generate player-facing patch notes from git history, sprint data, and internal changelogs. Translates developer language into clear, engaging player communication. |
| **`/changelog`** | _Dinámico / Contextual_ | Auto-generates a changelog from git commits, sprint data, and design documents. Produces both internal and player-facing versions. |
| **`/hotfix`** | _Dinámico / Contextual_ | Emergency fix workflow that bypasses normal sprint processes with a full audit trail. Creates hotfix branch, tracks approvals, and ensures the fix is backported correctly. |
| **`/localize`** | `localization-lead` | Full localization pipeline: scan for hardcoded strings, extract and manage string tables, validate translations, generate translator briefings, run cultural/sensitivity review, manage VO localization, test RTL/platform requirements, enforce string freeze, and report coverage. |

---

## 8. Cadenas y Orquestaciones de Equipo (team-*)

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/team-combat`** | _Dinámico / Contextual_ | Orchestrate the combat team: coordinates game-designer, gameplay-programmer, ai-programmer, technical-artist, sound-designer, and qa-tester to design, implement, and validate a combat feature end-to-end. |
| **`/team-level`** | _Dinámico / Contextual_ | Orchestrate level design team: level-designer + narrative-director + world-builder + art-director + systems-designer + qa-tester for complete area/level creation. |
| **`/team-ui`** | _Dinámico / Contextual_ | Orchestrate the UI team through the full UX pipeline: from UX spec authoring through visual design, implementation, review, and polish. Integrates with /ux-design, /ux-review, and studio UX templates. |
| **`/team-audio`** | _Dinámico / Contextual_ | Orchestrate audio team: audio-director + sound-designer + technical-artist + gameplay-programmer for full audio pipeline from direction to implementation. |
| **`/team-narrative`** | _Dinámico / Contextual_ | Orchestrate the narrative team: coordinates narrative-director, writer, world-builder, and level-designer to create cohesive story content, world lore, and narrative-driven level design. |
| **`/team-polish`** | _Dinámico / Contextual_ | Orchestrate the polish team: coordinates performance-analyst, technical-artist, sound-designer, and qa-tester to optimize, polish, and harden a feature or area for release quality. |
| **`/team-qa`** | `qa-lead` | Orchestrate the QA team through a full testing cycle. Coordinates qa-lead (strategy + test plan) and qa-tester (test case writing + bug reporting) to produce a complete QA package for a sprint or feature. Covers: test plan generation, test case writing, smoke check gate, manual QA execution, and sign-off report. |
| **`/team-release`** | _Dinámico / Contextual_ | Orchestrate the release team: coordinates release-manager, qa-lead, devops-engineer, and producer to execute a release from candidate to deployment. |
| **`/team-live-ops`** | _Dinámico / Contextual_ | Orchestrate the live-ops team for post-launch content planning: coordinates live-ops-designer, economy-designer, analytics-engineer, community-manager, writer, and narrative-director to design and plan a season, event, or live content update. |

---

## 9. Comandos del Sistema (studio:*)

| Comando | Agente Asignado | Descripción y Propósito |
|---|---|---|
| **`/help`** | _Dinámico / Contextual_ | Analyzes what is done and the users query and offers advice on what to do next. Use if user says what should I do next or what do I do now or I |
| **`/setup`** | _Dinámico / Contextual_ | Interactive guided installation of Pi Game Studio. Explains every step, asks for your confirmation before writing files, and sets up agents and models. |
| **`/assign-models`** | _Dinámico / Contextual_ | Reassign models for Pi Game Studio agents. Change models by tier (director/workhorse/lightweight) or per-agent. Dry-run preview available. |

---

## Comandos de Extensión (`studio:*`)

Además de las skills ejecutadas por el modelo, Pi Game Studio incluye comandos directos de extensión TypeScript con interfaz interactiva TUI:

| Comando | Tipo | Propósito |
|---|---|---|
| **`/studio`** | Comando Extensión | Hub principal y catálogo interactivo de todos los comandos y categorías. |
| **`/studio:start`** | Comando Extensión | Asistente de inicio rápido con auditoría de estado en tiempo real. |
| **`/studio:setup`** | Comando Extensión | Asistente interactivo de instalación (Modo Automático de 1-click o Manual guiado). |
| **`/studio:models`** | Comando Extensión | Selector interactivo de modelos de IA por nivel o por agente individual. |
| **`/studio:chains`** | Comando Extensión | Ejecutor interactivo de pipelines multi-agente guiados. |
| **`/studio:settings`** | Comando Extensión | Gestor interactivo de motor (Godot, Unity, Unreal, Bevy) e idioma (es/en). |
| **`/studio:agents`** | Comando Extensión | Navegador interactivo del catálogo de los 50 agentes del estudio. |
| **`/studio:status`** | Comando Extensión | Tablero de salud y diagnóstico en vivo del estudio y archivos de proyecto. |
| **`/studio:help`** | Comando Extensión | Ayuda rápida y cheatsheet de comandos de Pi Game Studio. |
