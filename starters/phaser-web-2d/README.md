# Phaser Web 2D Starter — Pi Game Studio

Modern 2D web starter template powered by **Phaser 3.88+**, **TypeScript 5.7+**, and **Vite 6**.

Designed for fast iteration, responsive game feel, and zero-configuration asset bootstrapping.

## Features

- **Phaser 3.88+** with Arcade Physics and high-performance WebGL/Canvas rendering.
- **Vite 6** lightning-fast Hot Module Replacement (HMR) development server.
- **Strict TypeScript** configuration with DOM and ESNext module resolution.
- **Procedural placeholder generation** in `BootScene` so the game runs immediately without missing external asset dependencies.
- **Responsive Arcade Physics controller** in `GameScene` featuring instantaneous direction changes, grounded jumping checks, and dynamic tween feedback.

## Requirements

- Node.js >= 18
- npm >= 9

## Quickstart

```bash
# 1. Install dependencies
npm install

# 2. Start local Vite development server
npm run dev

# 3. Build for production distribution
npm run build

# 4. Preview the production build locally
npm run preview
```

## Controls

- **Move Left / Right:** Left / Right Arrow keys
- **Jump:** Up Arrow or Spacebar

## Project Structure

```text
starters/phaser-web-2d/
├── index.html              # Canvas container and entry point
├── package.json            # Dependencies and scripts (vite, tsc, phaser)
├── tsconfig.json           # Strict TypeScript bundler settings
├── README.md               # Quickstart and overview
└── src/
    ├── main.ts             # Phaser Game configuration (Arcade physics, scenes)
    └── scenes/
        ├── BootScene.ts    # Procedural texture generator & bootloader
        └── GameScene.ts    # Playable player character, platforms & input
```
