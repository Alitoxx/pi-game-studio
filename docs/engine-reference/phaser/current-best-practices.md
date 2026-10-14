# Phaser Current Best Practices (Phaser 3.88+)

Modern engineering patterns and idiomatic practices for production-grade web games in Phaser 3.88+.

---

## 1. Scene Lifecycle Management

Phaser scenes follow a deterministic lifecycle sequence. Understanding and adhering to this sequence prevents race conditions and initialization bugs.

```text
[ constructor ] -> [ init(data) ] -> [ preload() ] -> [ create(data) ] -> [ update(time, delta) ] -> [ shutdown() / destroy() ]
```

### Lifecycle Phases
- **`init(data)`**: Receives parameters passed from `scene.start('Key', data)`. Use for initializing scene variables, resetting state counters, and reading navigation parameters.
- **`preload()`**: Queues asset downloads (`this.load.image`, `this.load.audioSprite`, `this.load.atlas`). Never instantiate visual game objects in `preload()` (except loader progress bars).
- **`create(data)`**: Executed once all queued assets in `preload()` finish loading. Instantiate GameObjects, register physics colliders, configure cameras, and bind event listeners here.
- **`update(time, delta)`**: Executed on every game step (typically ~60 FPS).
  - Use `delta` (milliseconds since last frame) to scale variable frame rate simulations.
  - Never allocate new objects, closures, or temporary arrays inside `update()` to avoid triggering Garbage Collection (GC) pauses.
- **`shutdown()`**: Invoked when the scene stops or transitions away. Clear timers, remove listeners, and clean up subscriptions.

```typescript
export class LevelScene extends Phaser.Scene {
  constructor() {
    super({ key: 'LevelScene' });
  }

  init(data: { levelIndex: number }): void {
    this.levelIndex = data.levelIndex ?? 1;
  }

  preload(): void {
    this.load.image('tiles', 'assets/tiles.png');
  }

  create(): void {
    // Setup game objects
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  update(time: number, delta: number): void {
    // Constant speed updates using delta
  }

  private onShutdown(): void {
    // Explicit cleanup
  }
}
```

---

## 2. Memory Cleanup & Preventing Leaks

In single-page applications and web games, failing to release resources leads to compounding memory leaks, canvas context loss, and mobile browser crashes.

### Rules for Safe Scene Cleanup

1. **Unregister Custom and Global Events**:
   Listeners registered on `this.events` (scene event emitter) or `this.game.events` (global emitter) retain strong references to the scene context unless explicitly removed.
   ```typescript
   // In create():
   const onResize = () => this.handleResize();
   this.scale.on('resize', onResize);

   // In shutdown:
   this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
     this.scale.off('resize', onResize);
     this.input.keyboard?.removeAllListeners();
   });
   ```

2. **Stop Timers and Tweens**:
   Active tweens and clock timer events that loop indefinitely will persist across scene restarts if not cleared or bound to the scene lifecycle.
   ```typescript
   this.time.removeAllEvents();
   this.tweens.killAll();
   ```

3. **Destroy Display Objects**:
   When dynamically spawning and despawning entities (bullets, particles, enemies), call `gameObject.destroy(true)` so child geometry and WebGL pipeline bindings are freed.

4. **Evict Unused Textures from TextureManager**:
   When transitioning between large levels with distinct art sets, remove old textures from cache:
   ```typescript
   if (this.textures.exists('old-level-atlas')) {
     this.textures.remove('old-level-atlas');
   }
   ```

---

## 3. Arcade Physics vs. Matter.js Physics

Phaser provides two primary built-in physics engines. Selecting the right engine is critical for performance and game feel.

| Feature | Arcade Physics | Matter.js Physics |
|---|---|---|
| **Collision Type** | Axis-Aligned Bounding Box (AABB) & Circle | Arbitrary Convex Polygons, Concave (decomposed), Circles |
| **Rotation** | Sprite visually rotates; bounding box remains AABB | Full rotational dynamics and inertia tensors |
| **Constraints / Joints** | Not supported | Springs, pins, distance constraints, revolute joints |
| **Performance** | Extremely fast (~10,000+ active bodies on mobile) | Moderate (~500–1,500 active bodies) |
| **Restitution & Friction** | Simple coefficient bounce/drag | Realistic mass, density, friction, restitution, collision filtering |
| **Best Used For** | 2D Platformers, Retro Shooters, Top-down RPGs | Physics puzzlers (Angry Birds), Ragdolls, Vehicles with suspension |

### Guideline
- Default to **Arcade Physics** for responsive, tightly-tuned platformers or arcade action where instantaneous input response and predictable jumps are prioritized.
- Opt into **Matter.js** only when complex polygon collisions, joint linkages, or momentum-conserving mass interactions are fundamental mechanics.

---

## 4. Typed Keys & Type-Safe Identifiers

Avoid raw magic strings for scene names, asset keys, audio identifiers, and animation keys. Use TypeScript const maps or enums to make refactoring safe and enable compiler auto-completion.

```typescript
// constants/keys.ts
export const SceneKeys = {
  Boot: 'BootScene',
  Preloader: 'PreloaderScene',
  MainMenu: 'MainMenuScene',
  Game: 'GameScene',
  GameOver: 'GameOverScene',
} as const;

export const AssetKeys = {
  Atlas: {
    Characters: 'atlas_characters',
    Environment: 'atlas_environment',
  },
  Audio: {
    SfxSprite: 'sfx_sprite',
    BgmTheme: 'bgm_theme',
  },
} as const;

export type SceneKey = typeof SceneKeys[keyof typeof SceneKeys];
```

Usage in scenes:
```typescript
this.scene.start(SceneKeys.Game);
this.add.sprite(100, 100, AssetKeys.Atlas.Characters, 'hero_idle_01');
```

---

## 5. Audio Sprites & Web Audio Optimization

Mobile browsers heavily throttle multiple concurrent HTTP requests and impose strict autoplay policies on audio elements.

### Best Practices for Game Audio

1. **Pack Sound Effects into Audio Sprites**:
   Combine dozens of small SFX files (jumps, hits, coins, explosions) into a single `.m4a`/`.ogg` audio file and accompanying `.json` marker file.
   - Reduces 30+ separate network roundtrips to 1 download.
   - Prevents latency when playing audio for the first time.

2. **Loading Audio Sprites**:
   ```typescript
   preload(): void {
     this.load.audioSprite(
       AssetKeys.Audio.SfxSprite,
       'assets/audio/sfx.json',
       ['assets/audio/sfx.m4a', 'assets/audio/sfx.ogg']
     );
   }

   // Playing markers
   create(): void {
     this.sound.playAudioSprite(AssetKeys.Audio.SfxSprite, 'player_jump', { volume: 0.8 });
   }
   ```

3. **Handling Browser Audio Unlock**:
   Modern browsers block audio until the first user interaction (touch or mouse click). Phaser automatically handles the `AudioContext` unlocking gesture, but UI cues should invite an initial click or tap on boot before high-stakes gameplay begins.
