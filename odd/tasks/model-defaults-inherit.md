# Model defaults must not ship unresolved ids

`models.default.json` maps every tier and the six engine specialists to concrete model ids. In the environment where this was verified, none of them resolve: `openai-codex` is not a registered provider, bare `openai/` and `anthropic/` prefixes are not either, and `openrouter/openai/gpt-oss-120b:free` is absent from the catalog. Pi warns `Model "<id>" not found for provider "<p>". Using custom model id.`, the child returns nothing, and the runner reports a **return-contract violation** — the failure blames the agent for a wrong phone number.

A package cannot ship model ids that depend on providers it does not control, and it already documents the opposite behaviour: all 15 templates declare `model: inherit`, and `project.yaml` documents `models: mode: inherit-session`.

## Specs

- **S1** — `models.default.json` assigns no concrete model. Each of the three tiers declares `"inherit"`, and no engine specialist carries its own key.
- **S2** — With the shipped default, `chooseModelForAgent` returns the session model instead of a package id.
- **S3** — The tier panel and `/studio:models default` report inheritance instead of applying dead ids.
- **S4** — The invariant holds and is tested: every key in `models.default.json` is a known tier, and every value is either `"inherit"` or a `provider/model` pair. Tests that pinned the old mapping are rewritten to the new truth, not deleted.
- **S5** — `AGENTS.md`, `README.md` and `CHANGELOG.md` describe tiers as reasoning budgets, not as concrete models, and say where an override belongs.

## Tasks

- **T1** — `models.default.json` → three tiers at `inherit`; six specialist keys removed. `S1` · delegated
- **T2** — Panel + `/studio:models default` report inheritance. `S3` · delegated
- **T3** — Tests rewritten and the invariant added. `S2, S4` · delegated
- **T4** — Docs. `S5` · inline

## Verification

29 suites / 350 tests, `tsc -p extensions/hooks/tsconfig.json --noEmit` exit 0, and the shipped manifest reads `{"director":"inherit","workhorse":"inherit","lightweight":"inherit"}`. Every new assertion was RED before the change.

Live evidence for the decision came from a real dispatch in `test-game`: with the old ids, `qa-verifier` returned an empty result reported as a contract violation; remapped to existing ids, the same dispatch returned `status=completed` with bash evidence in 4 seconds.

## Log

- **L1** — User, verbatim: `si hazlo de forma completa`
- **L2** — Evidence for the defect: a real dispatch of `qa-verifier` in `test-game` failed with `Warning: Model "openai/gpt-oss-120b:free" not found for provider "openrouter"` and an empty result, reported as a contract violation. After remapping to existing ids the same dispatch returned `status=completed` with real bash evidence in 4 seconds.
- **L3** — This reverses part of the earlier `subagent-contract-enforcement` spec S5 (which required the six specialist keys in `models.default.json`). The reason is the new evidence: a default that cannot resolve in an unknown environment is worse than no default.
- **L4** — Follow-up closed: `assign-models.js --apply` wrote `--map` keys into the package manifest while printing that per-agent overrides belong in the project. It now writes `<cwd>/.pi/game-studio/models.json`, seeding it from the shipped defaults when the project has no config, so the CLI cannot plant an id in every project that installs the package. The shipped manifest is hand-edited and CI-guarded.
- **L5** — Test-margin follow-up: `studio-subagents.test.js` "a long running tool gets its own budget" gave a 800ms plain idle budget to a spawn whose boot (66-170ms measured) is charged to that budget, with the kill landing at 800-1000ms (tick = budget/4). Raised to 1200ms: 7-13x headroom, and `1200 + 300 tick = 1500 < 2000` of scripted tool silence keeps the scenario proving its claim. The flake itself was not reproduced (0/6 runs); only the thin margin was addressed.
