---
name: gamedev-phaser
description: "Phaser 3/4 HTML5 & TypeScript game development for Gentle Shell. Trigger: Phaser, TypeScript web game, Canvas/WebGL 2D game, Arcade Physics, Matter.js."
---

# Phaser (TypeScript) Game Engineering

Apply these standards whenever working in a Phaser 3 or Phaser 4 project.

## 1. Scene Lifecycle & Memory Safety

- **Strict Scene Lifecycle**: Separate responsibilities cleanly across `init(data)` (reset state/params), `preload()` (asset queueing), `create()` (world setup, pools, input bindings), and `update(time, delta)` (frame logic).
- **Mandatory Shutdown Cleanup**: Register `this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { ... })` in `create()` to remove custom event listeners, timers, tweens, and keyboard bindings so restarting a scene never duplicates handlers or leaks memory.
- **Delta Normalization**: Convert Phaser's `delta` (milliseconds) to seconds (`const dt = delta / 1000`) for frame-rate independent movement math when updating custom velocities outside physics bodies.

## 2. Physics, Rendering & Pooling

- **Arcade vs. Matter Physics**: Use **Arcade Physics** for fast AABB platformers, top-down action, and bullet-hell games. Use **Matter.js** only when rotational rigid-body physics, constraints, or complex polygons are genuinely required.
- **Object Pooling with Groups**: Pre-allocate projectiles, enemies, and particles with `this.physics.add.group({ classType: Bullet, maxSize: 100, runChildUpdate: true })`. Recycle via `get()` and `setActive(false).setVisible(false)` instead of `destroy()` inside combat loops.
- **Zero Per-Frame GC Pressure**: Avoid allocating temporary `{ x, y }` objects, arrays, or closures inside `update()`. Reuse pre-allocated `Phaser.Math.Vector2` instances on the scene or entity class.
- **Pixel-Art & Atlas Best Practices**: For pixel-art games, enable `pixelArt: true` and `roundPixels: true` in the game config to prevent sub-pixel blurring. Pack sprites into texture atlases rather than loading dozens of individual PNGs.

## 3. Verification & Build

- **Typecheck & Bundling**: Verify zero TypeScript and bundler errors with `pnpm run build` (or `npx tsc --noEmit && npx vite build`).
- **Pure Logic Unit Tests**: Decouple state machines, damage math, grid/pathfinding, and progression into pure TypeScript modules and test them directly with `vitest`.
