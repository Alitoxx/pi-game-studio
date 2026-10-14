# Phaser Breaking Changes & Migration Guide

A reference for breaking API changes across Phaser 3 minor versions and the upcoming Phaser 4 architectural transition.

---

## 1. Phaser 3 Minor Version Transitions

Phaser 3 maintains strong backward compatibility within major releases, but notable architectural evolutions across recent versions require migration awareness.

### Phaser 3.60: FX Pipeline & Post-Processing
- **Old Pattern**: Custom post-render shaders required extending `PostFXPipeline` and registering it via `renderer.pipelines.addPostPipeline`.
- **3.60+ Change**: Built-in FX controller on all GameObjects (`gameObject.fx.addGlow()`, `gameObject.fx.addShadow()`, `gameObject.fx.addBloom()`).
- **Breaking**: Legacy pipeline parameters passed through config objects were streamlined. Old custom pipeline class signatures must now extend `Phaser.Renderer.WebGL.Pipelines.PostFXPipeline` with typed uniform binders.

### Phaser 3.60: Spatial Audio & SoundManager Overhaul
- **Audio Context Management**: Sound system refactored to comply with Chrome and iOS audio context suspension rules.
- **Breaking**: `sound.setRate()` and playback rate modulation requires Web Audio; fallback HTML5 Audio ignores rate parameters silently without error.

### Phaser 3.70–3.80: WebGL Batching & Multi-Texture
- **Texture Units**: Automatic dynamic detection of maximum WebGL texture units (`maxTextures`) per GPU.
- **Breaking**: Hard-coded texture slot assumptions in custom shaders will fail on low-end mobile devices where only 4 or 8 texture units are available.

### Phaser 3.80–3.88+: Native ESM, Bundler Compliance, & DOM Events
- **Vite and Modern ESM Exports**: `package.json` updated with explicit `"exports"` map for ESM and CJS entry points.
- **Passive Event Listeners**: Pointer event listeners in `InputManager` default to `{ passive: false }` only when `preventDefault` is explicitly needed (e.g. touch gestures on mobile), resolving browser console warnings.
- **Breaking**: Importing internal utility paths like `phaser/src/...` is no longer permitted by bundlers adhering to package export encapsulation. All imports must reference the public root package or type declarations.

---

## 2. Phaser 4 Architectural Roadmap

Phaser 4 represents the next-generation ground-up modernization of the engine.

### Core Strategic Differences

| Dimension | Phaser 3 | Phaser 4 |
|---|---|---|
| **Language & Types** | Written in JavaScript (ES6+), types generated via JSDoc | Written in native TypeScript from source |
| **Packaging** | Monolithic bundle (~1MB uncompressed) | Modular tree-shakable packages (`@phaserjs/core`, `@phaserjs/math`, etc.) |
| **Renderer** | WebGL 1/2 + 2D Canvas fallback | Modern WebGPU first with WebGL2 fallback |
| **Architecture** | Object-Oriented Scene graph & GameObjects | Composition-focused, modular components and render nodes |
| **Build Tooling** | Custom Webpack pipeline | Vite / Rollup native ESM |

### Preparing Codebases for Phaser 4

To ensure your Phaser 3.88+ codebases are easily adaptable to Phaser 4:
1. **Decouple Game Logic from Phaser Display Objects**: Keep business logic, inventory, stats, and rule calculation in plain TypeScript classes/modules rather than subclassing `Phaser.GameObjects.Sprite`.
2. **Use ES Modules Exclusively**: Do not rely on global `window.Phaser`. Always import through standard ES module syntax (`import Phaser from 'phaser'`).
3. **Avoid Subclassing Internal Render Pipelines**: Use Phaser's built-in FX API or standard shaders rather than coupling deeply to internal WebGL buffer management.
