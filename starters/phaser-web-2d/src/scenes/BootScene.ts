import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate placeholder textures programmatically for immediate standalone execution
    const graphics = this.make.graphics({ x: 0, y: 0 });

    // Player placeholder: 32x48 cyan rectangle with rounded head indicator
    graphics.fillStyle(0x00d2d3, 1);
    graphics.fillRect(0, 0, 32, 48);
    // Add eye/visor highlight for direction readability
    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(18, 8, 10, 6);
    graphics.generateTexture('player', 32, 48);
    graphics.clear();

    // Platform placeholder: 400x32 slate block with bright top edge
    graphics.fillStyle(0x34495e, 1);
    graphics.fillRect(0, 0, 400, 32);
    graphics.fillStyle(0x1dd1a1, 1);
    graphics.fillRect(0, 0, 400, 4);
    graphics.generateTexture('platform', 400, 32);
    graphics.clear();
  }

  create(): void {
    this.scene.start('GameScene');
  }
}
