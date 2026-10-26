---
name: ship
description: "[ODD Phase 6] Release & Ship. Role Owner: producer (Tier 1 Director) + qa-lead. Final build packaging for distribution, emergency hotfix patches, changelogs, and certification checklists."
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - ask_user_question
---

## ODD Phase 6: Release, Certification & Patching

- **Role Owner**: `producer` (Tier 1 Director) + `qa-lead`
- **Shared ODD Contract**: See [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) for the shared rules on atomic tasks (~400 lines), Live Specs in `design/gdd/`, compiler bounds, and the YAML Return Contract format.

When `/ship` is invoked (or `/ship build`, `/ship patch`, `/ship release`):

### 1. Pre-Release Checklist & Asset Audit
- Verify there are no open blocking bugs (P0/P1) in `production/qa/bugs.md`.
- **Asset Manifest Audit**: Inspect `assets/manifest.yaml` and certify that no critical gameplay asset is listed as `placeholder`.
- Confirm the game meets the memory and framerate budgets measured in `/test`.
- Ensure text strings are internationalized if the game supports multiple languages.

### 2. Multiplatform Build Generation, Optimization & Packaging
- **Native Build**: Generate clean binaries for the desktop platforms (Windows, macOS, Linux).
- **Web / WASM Target**: Build the web artifact for browser / itch.io distribution (`wasm32-unknown-unknown` + `wasm-bindgen` on Bevy/Rust, HTML5 export on Godot/Raylib). Ensure all asset paths are relative and the CORS and canvas configuration is correct.
- **WASM Bytecode Optimization with `wasm-opt`**: If `wasm-opt` exists on the system (`which wasm-opt`), run `wasm-opt -O3 dist/game.wasm -o dist/game.wasm` to cut web load size by up to 65%.
- **Final Asset Compression with `oxipng`**: Run `oxipng -o 2 dist/assets/**/*.png` to guarantee minimal packaging.
- Validate checksums and the distribution directory structure (`dist/` or `releases/`).

### 3. Automated Publishing & Distribution
- **Itch.io with `butler`**: If `butler` is available and configured, publish the web or desktop build using delta patches: `butler push dist/ <usuario>/<juego>:<canal>`.
- **GitHub Releases with `gh`**: Create the formal release, tag the version, and attach the packaged binaries or zips: `gh release create <version> dist/* --title "<version>" --notes-file CHANGELOG.md`.

### 4. Version Records & Changelog
- Update `CHANGELOG.md` with the notable changes under the Keep a Changelog standard.
- Update the semantic version in the project manifest (`project.yaml`, `package.json` or `Cargo.toml`).

### 5. Support & Patching
- For production errors, run the atomic hotfix flow to generate a focused emergency patch.
