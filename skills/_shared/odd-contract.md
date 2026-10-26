# ODD Universal Protocol & Return Contracts

This file defines the shared contracts and standards for the **6 ODD Skills of Pi Game Studio**.

## 1. Zero Bleed & Executive Delivery (Gentle Shell Neutral Protocol)
- Printing raw tool calls (`ask_user_question`, `subagent_run`), internal pipeline traces, or reasoning monologues into the user's chat is strictly forbidden.
- All human interaction happens through interactive terminal modals (`ctx.ui.select` / `ask_user_question`).
- **Professional Neutral Mode:** All conversational output, explanations and summaries from the skills operate under the Gentle Shell neutral protocol: standard informal address (`tú tienes`, `haz`, `revisa` — the parenthetical strings are output examples), no voseo or regionalisms, zero opening flattery (*"Buena pregunta"*), zero condescension (*"en lenguaje llano"*), and zero decorative emojis.

## 2. Live Specs Single Source of Truth
- All system or mechanic design lives exclusively in `design/gdd/<feature>.md`.
- Production and sprint tracking lives exclusively in `production/roadmap.md`.
- **Task Hygiene & Zero Checkbox Bloat:** In `production/roadmap.md` each sprint carries **a single main checkbox** for the macro task. Verification notes (`cargo check limpio`, `tests verdes` — the parenthetical strings are example notes, constraints) go as plain bullets (`-`), never as `[ ]` or `[x]`. Duplicating future task queues that already exist in the GDD is forbidden.
- Zero dead specification files or intermediate-document bureaucracy.

## 3. Atomic Scoping & Execution Budgets (~400 Lines)
- All implementation delegated to a subagent is done in atomic packages of **~400 lines** (code + tests/data).
- Delegating 800+ line monoliths in a single pass is forbidden. If a mechanic is bigger, implement the functional core first, report `status: partial`, and continue in the next cycle.
- **Zero Intermediate Dialogues during Execution**: Delegated tasks are already authorized by the user/producer. The specialist must not ask conversational questions or request intermediate confirmations; it executes directly on disk.

## 4. Scoped Engine Validation (Protection against Build Monoliths)
- In compiled or web engines (Rust/Bevy, C++/Raylib, C++/Unreal, TypeScript/Phaser, Godot):
  - Pure-logic tasks or decoupled crates (e.g. `crates/radio-core`) **must** be validated exclusively with scoped commands (`cargo test -p radio-core`, `cargo check -p radio-core`).
  - Running global workspace builds or full suites that force engine recompilation (such as Bevy in test mode) inside a subagent with a bounded timeout is **forbidden**.
  - Building the complete game or visual smoke testing is reserved for the orchestrator's integration step or the `/test` skill.

## 5. Compact YAML Return Contract
When a sub-task or skill delegates execution to an engine specialist, the specialist returns exclusively a compact YAML block. The shape is unique and is the one the runtime validates (`extensions/hooks/return-contract.ts`); the example below is the contract, and a test runs it through the validator so the document and the parser cannot drift apart.

```yaml
status: completed
summary: "Qué se implementó en una oración precisa"
files_changed:
  - "src/player.rs"
validation:
  - "cargo check -p game: 0 errores"
gameplay_impact:
  - "salto responsivo, 60 FPS estables"
risks:
  - "ninguno"
next_recommended_specialist: qa-lead
```

`status` accepts `completed`, `partial`, `blocked` or `interaction_required`. A `completed` requires non-empty `validation`: `files_changed` names files, not verification, and is not evidence by itself.

Each `validation` entry takes one of three shapes, and the admissible family depends on whether the agent declares `bash` (the shapes below are shown as they appear in a delivery: the runtime matches the `structural:` and `exception:` prefixes case-insensitively and tolerates surrounding whitespace):

| Shape | Who reports it | What it proves |
|---|---|---|
| `<comando exacto>: <resultado observado>` | agents with `bash` | that something ran, and what it returned |
| `structural: <propiedad leída>: <resultado>` | agents without `bash` | that the documented property exists and was read |
| `exception: <razón>` | agents without `bash` | that there is no runnable command, and why |

A `bash`-capable agent that could not verify returns `status: partial`, never a passive shape. An agent without `bash` does not report command results: it cannot observe them. The validator (`extensions/hooks/return-contract.ts`) applies the rule with the tools the runner passes it, so the family is not chosen at will.

The validator checks shape, never truth: a fabricated result has the correct shape. That is why whoever receives the delivery re-runs a reported command before considering it closed.

A specialist without `bash` cannot run anything, and its delivery is worth no less for that: the evidence form changes, not the bar. This is the same contract in passive mode — the agent read the document and names the property it checked:

```yaml
status: completed
summary: "Art bible con paleta, silueta y escala de valores cerrada"
files_changed:
  - "design/art/art-bible.md"
validation:
  - "structural: design/art/art-bible.md secciones obligatorias: presentes"
gameplay_impact:
  - "lectura de silueta a 1080p sin ambigüedad de clase"
risks:
  - "ninguno"
```

If the work has no checkable property at all, the delivery is `partial` with the reason, not a `completed` with an excuse.

A dispatched specialist **has no UI**: it cannot ask. If the decision is above its role, it stops and delivers the payload, which the parent relays as a blocking choice:

```yaml
status: interaction_required
summary: "Dos arquitecturas válidas; la decisión no es del especialista"
question: "¿ECS con sistemas o jerarquía de escenas?"
options:
  - "ECS con sistemas"
  - "Jerarquía de escenas"
blocking: true
```

`question` is mandatory in an escalation; `options` and `blocking` are recommended. An `interaction_required` without a question counts as an invalid delivery: it is not actionable, and the child would hang anyway.

## 6. FOSS CLI Media & Distribution Toolchain
Agents and specialists with the `bash` tool run asset transformation and distribution tasks using the studio's audited binaries (`/studio:tools`):
- **2D Sprites & Textures**:
  - `magick`: Atlas/spritesheet generation (`magick montage *.png -tile 4x4 -geometry +0+0 atlas.png`) and transparency trims.
  - `free-tex-packer-cli`: Algorithmic spritesheet packing (MaxRects), transparency trimming, and JSON/Godot/Raylib descriptor export.
  - `oxipng`: Immediate lossless optimization after saving or regenerating sprites (`oxipng -o 2 -strip safe assets/**/*.png`).
- **Audio & SFX**:
  - `ffmpeg`: Normalization and conversion of WAV masters into compressed runtime formats (`ffmpeg -i input.wav -c:a libvorbis -q:a 4 output.ogg`).
- **3D Models**:
  - `assimp`: Ultra-fast conversion to the standard GLTF/GLB format without overhead (`assimp export model.obj model.glb`).
  - `gltfpack`: glTF/GLB mesh optimization for GPU, LOD simplification, and meshopt compression (`gltfpack -i model.glb -o model_opt.glb -cc`).
- **WebAssembly & Distribution**:
  - `wasm-opt`: WASM bytecode optimization in web builds (`wasm-opt -O3 input.wasm -o output.wasm`).
  - `butler`: Delta deployment to itch.io (`butler push dist/ user/game:web`).
  - `gh`: Releases and binary versioning (`gh release create <tag> ./dist/*`).
- **Live-Reload & Watcher**:
  - `watchexec`: Continuous monitoring and testing on change (`watchexec -e rs,gd,cpp,ts,fs -- <test-command>`).
