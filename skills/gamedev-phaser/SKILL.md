---
name: gamedev-phaser
description: "Trigger: Phaser, Phaser 3, Phaser 4, TypeScript web game, HTML5 Canvas, WebGL 2D game, Arcade Physics, Matter.js. Idiomatic Phaser TypeScript scene architecture and pooling."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in a Phaser 3 or Phaser 4 project (`package.json` with `phaser`, TypeScript/JavaScript 2D web games).

## Hard Rules

- **Banned Phaser Anti-Patterns**:
  - Never dump new enemy, projectile, or mechanic logic directly into a monolithic `Scene.update()` -> Isolate entities into subclasses (`extends Phaser.Physics.Arcade.Sprite`) or modular system classes.
  - Never call `sprite.destroy()` inside an Arcade Physics overlap/collider callback or combat loop -> Deactivate and return to a pooled `Phaser.Physics.Arcade.Group` via `setActive(false).setVisible(false)` and `body.enable = false`.
  - Never use raw millisecond `delta` directly as seconds -> Normalize `const dt = delta / 1000` in `update(time: number, delta: number)`.
- **Strict Scene Lifecycle & `SHUTDOWN` Cleanup**:
  - Separate `init(data)` (reset state), `preload()` (queue assets), `create()` (world setup, pools, input), and `update(time, delta)`.
  - In `create()`, always register `this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { ... })` to remove custom `EventEmitter` listeners, timers, tweens, and keyboard handlers so restarting a scene never duplicates callbacks.
- **Zero Per-Frame GC Pressure**: Never allocate temporary `{ x, y }` literals, arrays, or closures inside `update()`; reuse pre-allocated `Phaser.Math.Vector2` fields on the class.

## Decision Gates

| Situation | Action |
| --- | --- |
| Fast AABB platformer, top-down action, or bullet hell | Use **Arcade Physics** with pooled `this.physics.add.group({ classType, maxSize, runChildUpdate: true })` |
| Complex polygon collisions, joints, or rotational rigid bodies | Use **Matter.js** physics |
| Pixel-art rendering | Set `pixelArt: true` and `roundPixels: true` in game config and pack sprites into texture atlases |
| Testable combat, inventory, or grid math | Extract pure TypeScript modules with zero Phaser DOM imports and test via `vitest` |

## Execution Steps

1. Inspect `package.json`, `vite.config.ts`, and scene registration in `main.ts`.
2. Implement modular entity/system classes in TypeScript and wire Phaser scenes with pooled groups and `SHUTDOWN` cleanup.
3. Verify types and bundle integrity with `npx tsc --noEmit`, `npx vite build`, and `npx vitest run`.

## Output Contract

Return:
- Scene, entity, and logic files created or updated.
- Results of TypeScript type-checking, bundler build, and unit tests.
- Confirmation of `SHUTDOWN` listener cleanup and object pooling.
