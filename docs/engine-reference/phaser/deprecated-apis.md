# Phaser Deprecated APIs & Migration Equivalents

Reference of obsolete, legacy, and deprecated APIs in Phaser 3 along with their modern replacements.

---

## 1. Camera System Deprecations

In older Phaser 3 versions, camera visual effects relied on inline callback functions passed at the end of method arguments. These callbacks caused memory retention issues when scenes stopped before the effect completed.

| Deprecated Call | Modern Replacement | Reason for Change |
|---|---|---|
| `camera.shake(dur, intensity, force, callback)` | `camera.shake(dur, intensity);`<br>`camera.once(Phaser.Cameras.Scene2D.Events.SHAKE_COMPLETE, fn);` | Decoupled event-driven architecture prevents dangling callback closures if the scene is halted early. |
| `camera.fade(dur, r, g, b, force, callback)` | `camera.fadeOut(dur, r, g, b);`<br>`camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, fn);` | Explicit `fadeOut` / `fadeIn` methods and standard event listeners. |
| `camera.flash(dur, r, g, b, force, callback)` | `camera.flash(dur, r, g, b);`<br>`camera.once(Phaser.Cameras.Scene2D.Events.FLASH_COMPLETE, fn);` | Unified with event emitter system. |
| Direct property assignment: `camera.bounds.width = 2000` | `camera.setBounds(x, y, width, height)` | Bounding updates require internal matrix recalculation and cull rectangle updates. |

---

## 2. Physics & Body Helpers

Arcade Physics evolved to provide encapsulated setter methods rather than direct scalar mutations.

| Deprecated Pattern | Modern Equivalent | Explanation |
|---|---|---|
| `game.physics.arcade.enable(sprite)` | `this.physics.add.existing(sprite)` or `this.physics.world.enable(sprite)` | Legacy Phaser 2 global namespace. Phaser 3 scopes physics systems to scenes. |
| `body.acceleration.x = 200` | `body.setAccelerationX(200)` | Direct assignment skips internal sleep state wakeup and flags. |
| `body.velocity.x = 100` | `body.setVelocityX(100)` or `sprite.setVelocityX(100)` | Direct vector mutations can cause desynchronization with spatial hash grids in dense scenes. |
| `body.customSeparateX = true` | Use `body.setImmovable(true)` or custom process callbacks in `physics.add.collider(a, b, null, processCallback)` | Custom separation flags have been consolidated into standard collision filtering. |
| `body.setSize(w, h, center)` | `body.setSize(w, h).setOffset(offsetX, offsetY)` | Explicit offset setting prevents unexpected displacement when scaling sprites. |

---

## 3. Scene Management & Global State

Phaser 3 replaced the old Phaser 2 `StateManager` with a multi-scene `SceneManager`.

| Obsolete API | Modern Phaser 3 API | Note |
|---|---|---|
| `game.state.add('Play', PlayState)` | `this.scene.add('Play', PlayScene)` or configure in `GameConfig.scene` | `State` was renamed to `Scene` across all APIs. |
| `game.state.start('Play')` | `this.scene.start('Play')` | Scenes are managed via the ScenePlugin per scene or `game.scene`. |
| `this.scene.bringToTop()` without key | `this.scene.bringToTop(sceneKey)` | Always specify the explicit scene key to prevent ambiguity in layered stacks. |

---

## 4. Loader & Audio APIs

| Deprecated Signature | Modern Signature | Note |
|---|---|---|
| `load.audioSprite(key, urls, jsonUrl)` | `load.audioSprite(key, jsonUrl, urls, audioConfig)` | `jsonUrl` must precede audio URLs so the loader can parse marker boundaries before streaming data. |
| `sound.play(key, { loop: true, volume: 1 })` with string audio tags | Use Web Audio sound manager and audio sprite markers | HTML5 Audio mode does not support sample-accurate looping or volume ducking. |
| `this.load.image({ key, url })` passing untyped generic hashes | `this.load.image(key, url)` | Typed signatures provide cleaner bundler optimization and autocomplete. |
