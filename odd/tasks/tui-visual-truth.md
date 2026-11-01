# TUI visual truth and consistency

Nine defects found in a read-only audit of the studio's terminal surface. Three of them display numbers that were never measured; the rest are wiring and geometry. Filed as #107-#115 before any source write.

## Specs

- **S1** — The visual findings are filed in GitHub with verifiable evidence, one issue per fix unit: `genera los issues en github`.
- **S2** — The footer never displays a performance value that was not measured. `#107`.
- **S3** — The context gauge never displays `100%` as a stand-in for "unknown". `#108`.
- **S4** — The sidebar rail renders its cards with the same theme role as the dock. `#109`.
- **S5** — The subagents card has exactly one owner, one recency threshold, and a distinct glyph for `interaction_required`. `#110`.
- **S6** — Every panel derives every line from one inner width; no surface renders wider than the width it was given. `#111`.
- **S7** — `/changes` has one card idiom and no unreachable renderer. `#112`.
- **S8** — The subagents widget subscribes once per session. `#113`.
- **S9** — The roster count has one source, each state has one label, each card has one language. `#114`.
- **S10** — The theme contract already asserted by `palette.test.js` is applied where it was skipped: overlays use roles, reverse video honours `NO_COLOR`, and the theme files are documented as chrome-only. `#115`.

## Tasks

- **T1** — Footer truthfulness: remove the fabricated FPS and memory baseline, make the perf segment reachable, render an explicit unknown state for context. `S2, S3` · inline · **`fix(hud): stop inventing metrics`**
- **T2** — Rail passes the theme role down to all three cards. `S4` · inline · part of **`fix(chrome): one owner, one role, one threshold`**
- **T3** — Subscribe once per session. `S8` · inline · same commit as T2
- **T4** — One owner for the subagents card, one recency threshold, distinct `interaction_required` glyph. `S5` · inline · same commit as T2
- **T5** — Panel geometry: one inner width for the timeline frame, footer truncation, rail clipping, palette overlay narrow fallback. `S6` · delegated · **`fix(chrome): panels keep their own width`** (+ T6)
- **T6** — `/changes` single card idiom; dead `renderChangesCard` resolved. `S7` · delegated · same commit as T5
- **T7** — Roster, engine label and language drift. `S9` · inline · **`fix(copy): one roster, one label, one language`**
- **T8** — Theme contract applied: overlays through roles, `NO_COLOR` reverse video, theme files documented as chrome-only. `S10` · delegated · **`docs(theme): the studio owns its palette`**

## Slices

- **Slice 1** — `4e7ac51` + `9f8f1a7`, 572 authored lines. T1-T4: `#107`, `#108`, `#109`, `#110`, `#113`.
- **Slice 2** — `38a7b49`. T5, T5b, T6: `#111`, `#112`.
- **Slice 3** — `80e6ada` + `4cf22fe`. T7, T8: `#114`, `#115`.

Verification for the branch: 29 suites / 347 tests, `tsc -p extensions/hooks/tsconfig.json --noEmit` exit 0. Every slice ran RED before GREEN; `__tests__/palette.test.js` was never modified.

## Log

- **L1** — User, verbatim: `genera los issues en github, y los comienzas a solucionar`
- **L2** — Audit verifier: the explorer's claim that the subagents split frame is 2 columns wider than its content is **false** (`studio-subagents-viewer.ts:506` sets `rightWidth = totalWidth - leftWidth - 1`, so top and body agree). Not filed.
- **L3** — `#52` already recorded "no theme integration" as analysis; `#115` is filed as its scoped wiring follow-up instead of a duplicate.
- **L4** — The theme question is not open: `palette.test.js` already asserts "semantic roles follow the theme, the brand does not" and "no theme keeps today's palette". `#115` applies that contract rather than reopening it.
- **L5** — Slice 2 delivered by `gentle-ai-worker` (mvxt9nnf). Reviewed and accepted with one correction: the worker left the timeline frame 2 columns wider than the surface (it was told not to touch `rightWidth`), so `totalWidth = Math.max(76, width) - 2` now makes the frame fit exactly. Its `panelRow` change is global — every panel now clips instead of overflowing — which is the invariant S6 asked for, and it is covered by the full suite.
- **L6** — Residual for T8: `renderChangesCard` imports raw `SUCCESS`/`WARNING`/`ERROR`/`ACCENT` constants instead of taking a `role`, so `/changes` does not follow the theme's semantic states. That is exactly #115.
- **L7** — One flake observed and attributed: a full-suite run reported 1 of 334 failing; the name was lost to output truncation, and the suite that fails in a full run but passes alone is `studio-stderr-bound.test.js` (it failed again in the T7 full run and passed alone twice). Pre-existing, unrelated to the chrome work.
- **L8** — T8 delivered by `gentle-ai-worker` (mvxu0zu3) and reviewed. Its `role` parameter on `formatChangesOutput` had no production caller — the host hands a theme to the footer factory, not to a command handler — so an accepted parameter nobody passed was the same dead-capability pattern the whole slice exists to remove. Added `setActiveThemeRole`/`getActiveThemeRole` in `studio-palette.ts`, published by the footer on every render and read by the `/changes` handler.
- **L9** — Correction to my own test: the theme marker for deletions arrives clipped (`MARK:err`) because the card is 66 columns wide, so the assertion checks that the palette escape for deletions is gone instead of a marker substring that cannot fit.
