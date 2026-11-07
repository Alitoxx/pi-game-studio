---
name: gamedev-phaser
description: "Trigger: Phaser, Phaser 3, Phaser 4, TypeScript web game, HTML5 Canvas, WebGL 2D game, Arcade Physics, Matter.js. Idiomatic Phaser TypeScript scene architecture and pooling."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in a Phaser 3 or Phaser 4 project (`package.json` with `phaser`, TypeScript/JavaScript 2D web games).

## Hard Rules

- **Strict Scene Lifecycle Separation**: Divide scene logic cleanly across `init(data)` (reset state), `preload()` (queue assets), `create()` (world setup, object pools, input bindings), and `update(time, delta)` (frame tick).
- **Mandatory `SHUTDOWN` Cleanup**: In `create()`, always register `this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { ... })` to remove custom event listeners, keyboard bindings, timers, and external references when a scene stops or restarts (note: `ArcadePhysics.World` auto-clears its colliders on `SHUTDOWN`, while custom `EventEmitter` listeners will leak and fire twice if not removed). Pair with `DESTROY` for permanent teardown.
- **Delta Time Normalization**: Convert Phaser's `update(time, delta)` millisecond `delta` to seconds (`const dt = delta / 1000`) for custom frame-rate independent movement math.
- **Object Pooling & Zero GC in `update()`**:
  - Pre-allocate bullets, enemies, and VFX using `this.physics.add.group({ classType: Entity, maxSize: N, runChildUpdate: true })` and recycle via `get()` + `setActive(false).setVisible(false)` instead of `destroy()`.
  - Never allocate temporary `{ x, y }` objects, arrays, or closures inside `update()`; reuse pre-allocated `Phaser.Math.Vector2` fields.

## Decision Gates

| Situation | Action |
| --- | --- |
| Fast AABB platformer, top-down action, or bullet hell | Use **Arcade Physics** for minimal CPU overhead |
| Complex polygon collisions, joints, or rotational rigid bodies | Use **Matter.js** physics |
| Pixel-art rendering | Set `pixelArt: true` and `roundPixels: true` in game config and pack sprites into texture atlases |
| Testable combat, inventory, or grid math | Extract pure TypeScript modules with zero Phaser DOM imports and test via `vitest` |

## Execution Steps

1. Inspect `package.json`, bundler config (`vite.config.ts`), and scene registration in `main.ts`.
2. Implement pure TypeScript game logic modules and wire Phaser scenes with pooled groups and `SHUTDOWN` cleanup.
3. Verify types and bundle integrity with `npx tsc --noEmit`, `vite build`, and `vitest run`.

## Output Contract

Return:
- Scene and logic files created or updated.
- Results of TypeScript type-checking, bundler build, and unit tests.
- Confirmation of `SHUTDOWN` listener cleanup and object pooling.
