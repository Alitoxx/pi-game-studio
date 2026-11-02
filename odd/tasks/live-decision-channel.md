# A delegated specialist must be able to ask the human, not print the question

A specialist dispatched with `subagent_run` cannot open the native selector. `studio-agents-runner.ts:507` strips `ask_user_question` from the child's tool list, correctly, because a child has no UI: granting it only produces a cancelled request and a stalled run. Templates compensate with a rule that cannot be executed — `game-designer.md:295` tells the child to "return structured options in the Return Contract", but the contract the runner injects (`:584`) is `status, summary, files_changed, validation, gameplay_impact, risks`. There is no field for a choice, so the child dumps the decision into `summary` as prose, and the Producer relays it verbatim. That is the observed failure: a real design fork arrived as a numbered text list instead of a menu.

Gentle Shell solves this one level down. `docs/gentle-shell.md:292`: a child calls `subagent_parent_message`, a `kind: "query"` frame **waits** for one strictly correlated `subagent_reply`, and `lib/agents-runner.ts:290` injects that tool into every child unconditionally. The channel exists; the decision renders in the parent's UI; the child keeps working. This feature builds the same channel for the studio, with two deliberate divergences: the transport is a socket instead of the RDD session transport (the studio already owns the child process), and the wait budget is minutes, not 30 seconds, because the other end is a human choosing a game genre.

## Specs

- **S1** — A delegated child can ask the parent a blocking question and keeps running while it waits. The child's run does not end, and no numbered prose list is produced. Quoting the user: `el hijo no termina; pregunta y espera`.
- **S2** — Every child question reaches the human through the native selector (`ctx.ui.select` via `executeAskUserQuestion`), never as relayed prose. Quoting the user: `no deberiuan salir un menu para seleccionar las opciones`.
- **S3** — Correlation is strict: exactly one reply settles a query. Malformed, forged, duplicate, late, oversized or cross-id frames never settle it, and a second reply for the same id is ignored.
- **S4** — Bounds are faithful to Gentle Shell: at most four pending queries per child, and a bounded UTF-8 message size per frame.
- **S5** — The wait budget is our own and generous (minutes, not Gentle Shell's 30 s). Timeout, cancellation, parent disconnect and child exit each settle a pending query exactly once and are reported as such.
- **S6** — Least privilege is unchanged and proven: the child receives `studio_parent_message` only. `ask_user_question` and every `subagent_*` tool stay out of the child, and the strip stays on record.
- **S7** — No protocol regression: the child's stdio remains a pure Pi RPC JSON stream. Dispatch, receipts, allowed surfaces, budget accounting and task logs behave exactly as before.

## Tasks

- **T1** — Protocol module: framing, correlation, bounds, settle-once, over a real socket pair. `S3, S4, S5` · `90aeecc`
- **T2** — Parent-side server: `0700` socket directory, per-child lifecycle, reply API, settle on exit. `S1, S5` · `90aeecc`
- **T3** — Child-side extension registering `studio_parent_message`, plus runner wiring (`--extension`, env endpoint, `PI_GAME_STUDIO_CHILD` guard). `S1, S6` · `c47739f`
- **T4** — Parent relay: a query opens the native selector and the committed answer goes back as a reply. `S2` · `c47739f`
- **T5** — Docs, templates and verification. `S1-S7` · `a36a50c`

## Delivery

Three slices on `feat/live-decision-channel`:

| Slice | Files | Lines | Why it is a unit |
|---|---|---|---|
| `90aeecc` | `studio-channel.ts`, both channel suites | 791 | A protocol without its tests is unverifiable; the tests without the module do not run. |
| `c47739f` | `studio-child-tool.ts`, runner, subagents relay | 315 | The child tool, the wiring that loads it and the relay that answers it only build together. |
| `a36a50c` | templates, `AGENTS.md`, protocol doc, changelog, this record | 119 | Instruction layer: without it the channel exists and nothing calls it. |

The first two exceed the ~400-line slice guidance. They were not split further because the intermediate commits would not build or would ship a channel with no caller, which is worse for review than one large coherent unit; the boundaries above are the smallest buildable ones.

## Verification

Every assertion RED before the change. Evidence collected:

- `__tests__/studio-channel.test.js` — 11 tests, observed RED (module absent, 11 failures) before the module existed.
- `__tests__/studio-channel-lifecycle.test.js` — 2 tests. The leak test was observed RED twice: once with the spawn-failure cleanup removed, and once while `closeChannel()` was still async (the process exited before the socket directory was reclaimed).
- `npx tsc -p extensions/hooks/tsconfig.json --noEmit` → exit 0.
- Full suite: 30 suites / 361 tests green before the cleanup hardening; re-run after it.
- **Live proof** with a real Pi child through the real runner (`antigravity/gemini-3.8-flash`, 8 s): the child called `studio_parent_message` with `"Which engine should this wargame use?"` and two choices, the parent responder answered `Godot 4 [parent-answer-marker]`, and the child's receipt came back `status: completed` with `summaryMentionsAnswer: true`. The task log recorded `consulta q1` and `decisión q1`. Two earlier runs of the same probe returned the child's receipt but were rejected by the pre-existing return-contract validator, which requires `validation` as a YAML *list* — unrelated to the channel and not changed here.

Two defects found by verification and fixed, not by the happy path: a spawn failure emits `error` and never `close`, so the channel outlived the dispatch that never started; and an async `closeChannel()` raced process exit, leaving the socket directory behind. `ParentChannel.close()` is now synchronous for that reason.

`Risk: item 4 (concurrency: correlation, settle-once, disconnect) and item 6 (no pre-existing test could catch a channel regression)` → independent `qa-verifier` is required before delivery.

## Log

- **L1** — User, verbatim: `tengo un tema aca , no deberiuan salir un menu para seleccionar las opciones` — con la pregunta de por qué antes todo pedía seleccionar.
- **L2** — User, verbatim: `como lo hace gentle-shell`
- **L3** — User selection, verbatim: `Canal vivo con query bloqueante, fiel a Gentle Shell`
- **L4** — Diagnóstico verificado: el hijo no puede abrir el selector (`studio-agents-runner.ts:507`); el Return Contract no tiene campo donde devolver opciones (`:584`); `PI_GAME_STUDIO_CHILD` está seteado (`:649`) y leído por nadie; `pi --extension, -e <path>` permite forzar la carga del canal en el hijo sin depender de la config del proyecto.
