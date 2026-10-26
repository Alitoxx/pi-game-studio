---
name: test
description: "[ODD Phase 5] Validate & Feel. Role Owner: qa-lead (Tier 2 Lead). Quality verification, startup smoke checks, regression testing, memory leak detection, and bug triage."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - ask_user_question
---

## ODD Phase 5: Quality, Smoke Checks & Feel

- **Role Owner**: `qa-lead` (Tier 2 Lead)
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/test` is invoked (or `/test smoke`, `/test regression`, `/test bugs`):

### 1. Smoke Checks & Fast Startup per Engine
Run the game headless, with a bounded timeout, or as a quick verification to validate startup without crashes or panics:
- **Godot**: `godot --headless`
- **Unity**: `Unity.exe -batchmode`
- **Unreal**: `UnrealEditor-Cmd.exe`
- **Bevy**: `cargo check` (instant static validation) or `cargo test -p <crate>` for pure logic. For runtime smoke with a window: `cargo run` only with the user present, or via a timeout/headless flag so automated processes are not blocked.
- **Raylib**: `./build/game` (or a prior build with `cmake --build build`)
- **Phaser**: `npm test` / `vitest run` / `npx vite build`
Check that the essential systems (player loop, basic render, inputs) respond.

### 2. Regression Suites & Unit Tests
- Run the engine's automated test suite (e.g. GUT for Godot, `cargo test` for Bevy, CTest for Raylib, `npm test` / `vitest run` for Phaser).
- Confirm that no recent change broke previously validated mechanics.

### 3. Game Feel, Performance & Memory Leak Evaluation (Soak Test)
- **Framerate Benchmark**: Verify the framerate holds at target (e.g. a stable 60 FPS) under maximum entity and particle load.
- **Memory Soak Test (Leak Detection)**: Run a continuous session of at least 60 seconds and monitor RAM (RSS) and VRAM. Memory retention must be flat; any sustained monotonic growth (> 1 MB/min with no GC or allocator recovery) is classified as a critical memory leak.
- **Strict Budget Gate**: If consumption exceeds the technical budget set in `/arch` (e.g. > 350 MB RAM or drops below 60 FPS), the test is marked FAILED (`BLOCKED`), preventing progress toward release until it is optimized.

### 4. Bug Triage & Logging
If a defect or a performance regression is detected:
- Log it in `production/qa/bugs.md` with severity (P0 Critical to P3 Minor), reproduction steps, and observed vs. expected behavior.
- Notify the Producer to prioritize the immediate atomic fix.
