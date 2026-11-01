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
- **T5** — Panel geometry: one inner width for the timeline frame, footer truncation, rail clipping, palette overlay narrow fallback. `S6` · inline · **`fix(chrome): panels keep their own width`** (+ T6)
- **T6** — `/changes` single card idiom; dead `renderChangesCard` resolved. `S7` · inline · same commit as T5
- **T7** — Roster, engine label and language drift. `S9` · inline · **`fix(copy): one roster, one label, one language`**
- **T8** — Theme contract applied: overlays through roles, `NO_COLOR` reverse video, theme files documented as chrome-only. `S10` · inline · **`docs(theme): the studio owns its palette`**

## Slices

- **Slice 1** — `fix/tui-visual-truth`, commits `4e7ac51` + `9f8f1a7`, 572 authored lines. T1-T4: `#107`, `#108`, `#109`, `#110`, `#113`.
- **Slice 2** — T5, T6: `#111`, `#112`.
- **Slice 3** — T7, T8: `#114`, `#115`.

## Log

- **L1** — User, verbatim: `genera los issues en github, y los comienzas a solucionar`
- **L2** — Audit verifier: the explorer's claim that the subagents split frame is 2 columns wider than its content is **false** (`studio-subagents-viewer.ts:506` sets `rightWidth = totalWidth - leftWidth - 1`, so top and body agree). Not filed.
- **L3** — `#52` already recorded "no theme integration" as analysis; `#115` is filed as its scoped wiring follow-up instead of a duplicate.
- **L4** — The theme question is not open: `palette.test.js` already asserts "semantic roles follow the theme, the brand does not" and "no theme keeps today's palette". `#115` applies that contract rather than reopening it.
