import Phaser from 'phaser';

export class GameScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;

  // Responsive game feel parameters
  private readonly MOVE_SPEED = 260;
  private readonly JUMP_VELOCITY = -520;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // 1. Static environment platforms
    this.platforms = this.physics.add.staticGroup();

    // Main floor
    const floor = this.platforms.create(400, 584, 'platform') as Phaser.Physics.Arcade.Sprite;
    floor.setDisplaySize(800, 32).refreshBody();

    // Stepping platforms
    const ledgeLeft = this.platforms.create(200, 430, 'platform') as Phaser.Physics.Arcade.Sprite;
    ledgeLeft.setDisplaySize(240, 24).refreshBody();

    const ledgeRight = this.platforms.create(600, 330, 'platform') as Phaser.Physics.Arcade.Sprite;
    ledgeRight.setDisplaySize(260, 24).refreshBody();

    const ledgeTop = this.platforms.create(350, 210, 'platform') as Phaser.Physics.Arcade.Sprite;
    ledgeTop.setDisplaySize(200, 24).refreshBody();

    // 2. Player setup with Arcade Physics
    this.player = this.physics.add.sprite(150, 350, 'player');
    this.player.setBounce(0.05);
    this.player.setCollideWorldBounds(true);
    this.player.setDragX(1200);

    // Collisions
    this.physics.add.collider(this.player, this.platforms);

    // 3. Input controls
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
    }

    // 4. Instructions and HUD
    this.add.text(20, 20, 'Phaser 2D Web Starter\nControls: Left/Right to run, Up/Space to jump', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000a0',
      padding: { x: 10, y: 8 },
    });

    // Cleanup on scene shutdown for memory hygiene
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  update(): void {
    if (!this.cursors || !this.player || !this.player.body) {
      return;
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const isGrounded = body.touching.down || body.blocked.down;

    // Horizontal movement: responsive velocity with immediate direction changes
    if (this.cursors.left.isDown) {
      this.player.setVelocityX(-this.MOVE_SPEED);
      this.player.setFlipX(true);
    } else if (this.cursors.right.isDown) {
      this.player.setVelocityX(this.MOVE_SPEED);
      this.player.setFlipX(false);
    } else {
      this.player.setVelocityX(0);
    }

    // Jump: responsive immediate impulse when grounded
    const jumpPressed = Phaser.Input.Keyboard.JustDown(this.cursors.up) ||
      (this.cursors.space && Phaser.Input.Keyboard.JustDown(this.cursors.space));

    if (jumpPressed && isGrounded) {
      this.player.setVelocityY(this.JUMP_VELOCITY);
      // Subtle game feel: jump stretch
      this.tweens.add({
        targets: this.player,
        scaleY: 1.15,
        scaleX: 0.9,
        duration: 80,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  private cleanup(): void {
    this.input.keyboard?.removeAllListeners();
  }
}
