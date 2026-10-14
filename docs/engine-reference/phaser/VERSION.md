# Phaser Engine — Version Reference

| Field | Value |
|-------|-------|
| **Engine Version** | Phaser 3.88.2 (Phaser 3.88+ / Phaser 4-ready architecture) |
| **Language Support** | TypeScript >= 5.x / JavaScript (ESNext / ESM) |
| **Bundler & Tooling** | Vite 6, Webpack 5, or Rollup |
| **Rendering Backends** | WebGL (default with Multi-Texture pipeline) & HTML5 Canvas fallback |
| **Physics Engines** | Arcade Physics (AABB fast platformer), Matter.js (rigid-body simulation) |
| **Platform Target** | Web Browsers (Desktop & Mobile), PWA, Electron, Cordova / Capacitor |

## Overview & Architecture

Phaser is the industry-standard open-source 2D HTML5 game engine created by Richard Davey / Photon Storm.
- **Scene-Driven Architecture**: Decoupled scenes for booting, preloading, UI HUDs, main gameplay, and pause states running concurrently or in stacks.
- **Fast WebGL Batching**: Sprite batching and multi-texture shaders providing 60+ FPS across mobile and desktop browsers.
- **Built-in Physics Options**: Lightweight Arcade Physics for standard 2D arcade/platformer/top-down games, and integrated Matter.js for full rigid body physics with constraints and polygon hulls.
- **Modern Web Ecosystem**: Fully modular ESM architecture compatible with Vite, TypeScript, NPM packaging, and modern web developer workflows.

## Key Subsystems

| Subsystem | Primary Namespace | Purpose |
|---|---|---|
| Core Game | `Phaser.Game`, `Phaser.Core` | Game instance, canvas configuration, loop step dispatching |
| Scene Manager | `Phaser.Scenes.ScenePlugin`, `Phaser.Scene` | Scene lifecycle hooks, transitions, pause/resume, layered scenes |
| Display & Factory | `Phaser.GameObjects.GameObjectFactory` (`this.add`) | Sprites, Images, Text, Tilemaps, Containers, Particle Emitters |
| Physics | `Phaser.Physics.Arcade`, `Phaser.Physics.Matter` | Velocity, gravity, collisions, raycasts, sensors |
| Input | `Phaser.Input`, `Phaser.Input.Keyboard` | Keyboard keys, pointers (touch/mouse), gamepads |
| Tweens & Timeline | `Phaser.Tweens.TweenManager` (`this.tweens`) | Interpolation, ease curves, elastic animations, chains |
| Audio | `Phaser.Sound.WebAudioSoundManager` (`this.sound`) | Spatial sound, audio sprites, volume fades, Web Audio graph |
| Asset Loader | `Phaser.Loader.LoaderPlugin` (`this.load`) | Preloading atlases, spritesheets, audio, JSON, fonts |
