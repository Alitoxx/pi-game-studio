import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import { writeFileAtomicSync } from "./studio-fs.ts";
import { readProjectYaml, promptSelectSafe } from "./studio-setup.ts";
import {
	ACCENT,
	BOLD,
	BORDER,
	DIM,
	GRAY,
	GREEN,
	HEADING,
	RED,
	RESET,
	SECONDARY,
	WHITE,
	YELLOW,
} from "./studio-palette.ts";

export interface ScaffoldOptions {
	engine?: "Godot" | "Bevy" | "Raylib" | "Phaser";
	dimension?: "2d" | "3d";
	forceOverwrite?: boolean;
	useSuffix?: boolean;
}

export interface GeneratedFile {
	path: string;
	relPath: string;
	description: string;
	action: "created" | "overwritten" | "suffixed" | "skipped";
}

export interface ScaffoldResult {
	success: boolean;
	engine: string;
	dimension: "2d" | "3d";
	files: GeneratedFile[];
	runCommand: string;
	editCommand?: string;
	notes: string[];
}

/**
 * Finds an available unused file path by adding a numeric suffix before the extension.
 */
function getSuffixedPath(targetPath: string): string {
	const dir = dirname(targetPath);
	const ext = targetPath.includes(".") ? `.${targetPath.split(".").pop()}` : "";
	const nameWithoutExt = basename(targetPath, ext);

	let counter = 1;
	let candidate = join(dir, `${nameWithoutExt}_${counter}${ext}`);
	while (existsSync(candidate)) {
		counter++;
		candidate = join(dir, `${nameWithoutExt}_${counter}${ext}`);
	}
	return candidate;
}

/**
 * Resolves target engine and dimension from arguments, project.yaml, or project root files.
 */
export function resolveEngineAndDimension(
	studioRoot: string,
	argsString = "",
): { engine: "Godot" | "Bevy" | "Raylib" | "Phaser"; dimension: "2d" | "3d" } {
	const args = argsString.toLowerCase();

	// 1. Check dimension from args
	let dimension: "2d" | "3d" | undefined;
	if (/\b3d\b/.test(args)) {
		dimension = "3d";
	} else if (/\b2d\b/.test(args)) {
		dimension = "2d";
	}

	// 2. Check engine from args
	let engine: "Godot" | "Bevy" | "Raylib" | "Phaser" | undefined;
	if (args.includes("godot")) {
		engine = "Godot";
	} else if (args.includes("bevy")) {
		engine = "Bevy";
	} else if (args.includes("raylib")) {
		engine = "Raylib";
	} else if (args.includes("phaser")) {
		engine = "Phaser";
	}

	// 3. Fallback to project.yaml
	const yamlConfig = readProjectYaml(studioRoot);
	if (!dimension && yamlConfig.dimension) {
		dimension = yamlConfig.dimension;
	}

	if (!engine && yamlConfig.engine) {
		const raw = yamlConfig.engine.toLowerCase();
		if (raw.includes("bevy")) engine = "Bevy";
		else if (raw.includes("raylib")) engine = "Raylib";
		else if (raw.includes("godot")) engine = "Godot";
		else if (raw.includes("phaser")) engine = "Phaser";
	}

	// 4. Fallback to filesystem detection
	if (!engine) {
		const detected = detectProjectEngine(studioRoot);
		if (detected.detected) {
			if (detected.engine === "Bevy") engine = "Bevy";
			else if (detected.engine === "Raylib") engine = "Raylib";
			else if (detected.engine === "Godot") engine = "Godot";
			else if (detected.engine === "Phaser") engine = "Phaser";
		}
	}

	// 5. Dimension heuristic from project files if still unknown
	if (!dimension) {
		if (existsSync(join(studioRoot, "project.godot"))) {
			try {
				const godotContent = readFileSync(join(studioRoot, "project.godot"), "utf8");
				if (godotContent.includes("forward_plus") || godotContent.includes("3d")) {
					dimension = "3d";
				}
			} catch {}
		}
	}

	// Ultimate defaults
	return {
		engine: engine || "Godot",
		dimension: dimension || "2d",
	};
}

// ──────────────────────────────────────────────
// Godot 4 Templates
// ──────────────────────────────────────────────

function getGodot2DPlayerScript(): string {
	return `extends CharacterBody2D

## Pi Game Studio — 2D Player Controller Sandbox
## Soporta flechas, WASD, gravedad y salto reactivo out-of-the-box.

@export var speed: float = 300.0
@export var jump_velocity: float = -450.0

var gravity: float = ProjectSettings.get_setting("physics/2d/default_gravity", 980.0)

func _physics_process(delta: float) -> void:
	# 1. Gravedad
	if not is_on_floor():
		velocity.y += gravity * delta

	# 2. Salto (Espacio, W, Flecha Arriba o ui_accept)
	var jump_pressed := (
		Input.is_action_just_pressed("ui_accept")
		or Input.is_key_pressed(KEY_SPACE)
		or Input.is_key_pressed(KEY_W)
		or Input.is_key_pressed(KEY_UP)
	)
	if jump_pressed and is_on_floor():
		velocity.y = jump_velocity

	# 3. Movimiento horizontal (WASD / Flechas / ui_left / ui_right)
	var direction := 0.0
	if Input.is_action_pressed("ui_left") or Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		direction -= 1.0
	if Input.is_action_pressed("ui_right") or Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		direction += 1.0

	if direction != 0.0:
		velocity.x = direction * speed
	else:
		velocity.x = move_toward(velocity.x, 0.0, speed)

	move_and_slide()
`;
}

function getGodot2DScene(playerScriptRelPath: string): string {
	return `[gd_scene load_steps=4 format=3]

[ext_resource type="Script" path="res://${playerScriptRelPath}" id="1_player"]

[sub_resource type="RectangleShape2D" id="RectangleShape2D_floor"]
size = Vector2(1152, 64)

[sub_resource type="RectangleShape2D" id="RectangleShape2D_player"]
size = Vector2(32, 64)

[node name="Playground2D" type="Node2D"]

[node name="Floor" type="StaticBody2D" parent="."]
position = Vector2(576, 616)

[node name="CollisionShape2D" type="CollisionShape2D" parent="Floor"]
shape = SubResource("RectangleShape2D_floor")

[node name="ColorRect" type="ColorRect" parent="Floor"]
anchors_preset = 8
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -576.0
offset_top = -32.0
offset_right = 576.0
offset_bottom = 32.0
grow_horizontal = 2
grow_vertical = 2
color = Color(0.24, 0.27, 0.35, 1)

[node name="Player" type="CharacterBody2D" parent="."]
position = Vector2(576, 400)
script = ExtResource("1_player")

[node name="CollisionShape2D" type="CollisionShape2D" parent="Player"]
shape = SubResource("RectangleShape2D_player")

[node name="ColorRect" type="ColorRect" parent="Player"]
anchors_preset = 8
anchor_left = 0.5
anchor_top = 0.5
anchor_right = 0.5
anchor_bottom = 0.5
offset_left = -16.0
offset_top = -32.0
offset_right = 16.0
offset_bottom = 32.0
grow_horizontal = 2
grow_vertical = 2
color = Color(0.4, 0.7, 1, 1)

[node name="Camera2D" type="Camera2D" parent="Player"]
position_smoothing_enabled = true
`;
}

function getGodot3DPlayerScript(): string {
	return `extends CharacterBody3D

## Pi Game Studio — 3D Player Controller Sandbox
## CharacterBody3D con WASD, gravedad, salto y cámara de seguimiento.

@export var speed: float = 6.0
@export var jump_velocity: float = 4.8

var gravity: float = ProjectSettings.get_setting("physics/3d/default_gravity", 9.8)

func _physics_process(delta: float) -> void:
	# 1. Gravedad
	if not is_on_floor():
		velocity.y -= gravity * delta

	# 2. Salto (Espacio o ui_accept)
	var jump_pressed := Input.is_action_just_pressed("ui_accept") or Input.is_key_pressed(KEY_SPACE)
	if jump_pressed and is_on_floor():
		velocity.y = jump_velocity

	# 3. Input de movimiento WASD / Flechas
	var input_dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_action_pressed("ui_left"):
		input_dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_action_pressed("ui_right"):
		input_dir.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_action_pressed("ui_up"):
		input_dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_action_pressed("ui_down"):
		input_dir.y += 1.0

	input_dir = input_dir.normalized()
	var direction := (transform.basis * Vector3(input_dir.x, 0.0, input_dir.y)).normalized()

	if direction != Vector3.ZERO:
		velocity.x = direction.x * speed
		velocity.z = direction.z * speed
	else:
		velocity.x = move_toward(velocity.x, 0.0, speed)
		velocity.z = move_toward(velocity.z, 0.0, speed)

	move_and_slide()
`;
}

function getGodot3DScene(playerScriptRelPath: string): string {
	return `[gd_scene load_steps=5 format=3]

[ext_resource type="Script" path="res://${playerScriptRelPath}" id="1_player"]

[sub_resource type="CapsuleShape3D" id="CapsuleShape3D_player"]
radius = 0.5
height = 2.0

[sub_resource type="CapsuleMesh" id="CapsuleMesh_player"]
radius = 0.5
height = 2.0

[sub_resource type="Environment" id="Environment_default"]
background_mode = 1
background_color = Color(0.1, 0.12, 0.18, 1)
ambient_light_source = 2
ambient_light_color = Color(0.65, 0.65, 0.65, 1)

[node name="Playground3D" type="Node3D"]

[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
environment = SubResource("Environment_default")

[node name="DirectionalLight3D" type="DirectionalLight3D" parent="."]
transform = Transform3D(0.866025, -0.353553, 0.353553, 0, 0.707107, 0.707107, -0.5, -0.612372, 0.612372, 0, 10, 0)
shadow_enabled = true

[node name="Floor" type="CSGBox3D" parent="."]
use_collision = true
size = Vector3(40, 1, 40)
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, -0.5, 0)

[node name="Player" type="CharacterBody3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1.5, 0)
script = ExtResource("1_player")

[node name="CollisionShape3D" type="CollisionShape3D" parent="Player"]
shape = SubResource("CapsuleShape3D_player")

[node name="MeshInstance3D" type="MeshInstance3D" parent="Player"]
mesh = SubResource("CapsuleMesh_player")

[node name="Camera3D" type="Camera3D" parent="Player"]
transform = Transform3D(1, 0, 0, 0, 0.906308, 0.422618, 0, -0.422618, 0.906308, 0, 3, 6)
`;
}

// ──────────────────────────────────────────────
// Bevy (Rust) Templates
// ──────────────────────────────────────────────

function getBevy2DPlayground(): string {
	return `use bevy::prelude::*;

//! Pi Game Studio — 2D Playable Sandbox (Bevy)
//! Controls: [A/D] o Flechas para mover, [ESPACIO/W] para saltar.

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Pi Game Studio — 2D Sandbox (Bevy)".into(),
                resolution: (1280.0, 720.0).into(),
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, (player_movement, apply_gravity))
        .run();
}

#[derive(Component)]
struct Player {
    speed: f32,
    jump_velocity: f32,
    velocity_y: f32,
    is_grounded: bool,
}

#[derive(Component)]
struct Ground;

const GRAVITY: f32 = -980.0;
const FLOOR_Y: f32 = -260.0;

fn setup(mut commands: Commands) {
    // 2D Camera
    commands.spawn(Camera2dBundle::default());

    // Floor
    commands.spawn((
        SpriteBundle {
            sprite: Sprite {
                color: Color::srgb(0.24, 0.27, 0.35),
                custom_size: Some(Vec2::new(1280.0, 40.0)),
                ..default()
            },
            transform: Transform::from_xyz(0.0, FLOOR_Y, 0.0),
            ..default()
        },
        Ground,
    ));

    // Player
    commands.spawn((
        SpriteBundle {
            sprite: Sprite {
                color: Color::srgb(0.4, 0.7, 1.0),
                custom_size: Some(Vec2::new(32.0, 64.0)),
                ..default()
            },
            transform: Transform::from_xyz(0.0, FLOOR_Y + 52.0, 1.0),
            ..default()
        },
        Player {
            speed: 300.0,
            jump_velocity: 450.0,
            velocity_y: 0.0,
            is_grounded: true,
        },
    ));
}

fn player_movement(
    keyboard: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<(&mut Transform, &mut Player)>,
) {
    let delta = time.delta_seconds();
    for (mut transform, mut player) in query.iter_mut() {
        let mut direction = 0.0;
        if keyboard.pressed(KeyCode::KeyA) || keyboard.pressed(KeyCode::ArrowLeft) {
            direction -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyD) || keyboard.pressed(KeyCode::ArrowRight) {
            direction += 1.0;
        }

        transform.translation.x += direction * player.speed * delta;

        // Jump
        let jump = keyboard.just_pressed(KeyCode::Space)
            || keyboard.just_pressed(KeyCode::KeyW)
            || keyboard.just_pressed(KeyCode::ArrowUp);
        if jump && player.is_grounded {
            player.velocity_y = player.jump_velocity;
            player.is_grounded = false;
        }
    }
}

fn apply_gravity(time: Res<Time>, mut query: Query<(&mut Transform, &mut Player)>) {
    let delta = time.delta_seconds();
    for (mut transform, mut player) in query.iter_mut() {
        if !player.is_grounded {
            player.velocity_y += GRAVITY * delta;
            transform.translation.y += player.velocity_y * delta;

            let player_ground_level = FLOOR_Y + 52.0;
            if transform.translation.y <= player_ground_level {
                transform.translation.y = player_ground_level;
                player.velocity_y = 0.0;
                player.is_grounded = true;
            }
        }
    }
}
`;
}

function getBevy3DPlayground(): string {
	return `use bevy::prelude::*;

//! Pi Game Studio — 3D Playable Sandbox (Bevy)
//! Controls: [WASD] o Flechas para mover en el plano XZ.

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Pi Game Studio — 3D Sandbox (Bevy)".into(),
                resolution: (1280.0, 720.0).into(),
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, player_movement)
        .run();
}

#[derive(Component)]
struct Player {
    speed: f32,
}

fn setup(
    mut commands: Commands,
    mut meshes: ResMut<Assets<Mesh>>,
    mut materials: ResMut<Assets<StandardMaterial>>,
) {
    // Ground plane
    commands.spawn(PbrBundle {
        mesh: meshes.add(Plane3d::default().mesh().size(50.0, 50.0)),
        material: materials.add(Color::srgb(0.2, 0.22, 0.28)),
        ..default()
    });

    // Player capsule/cube
    commands.spawn((
        PbrBundle {
            mesh: meshes.add(Capsule3d::new(0.5, 1.5)),
            material: materials.add(Color::srgb(0.4, 0.7, 1.0)),
            transform: Transform::from_xyz(0.0, 1.25, 0.0),
            ..default()
        },
        Player { speed: 8.0 },
    ));

    // Directional Light
    commands.spawn(DirectionalLightBundle {
        directional_light: DirectionalLight {
            shadows_enabled: true,
            illuminance: 10000.0,
            ..default()
        },
        transform: Transform::from_xyz(10.0, 20.0, 10.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });

    // Camera 3D
    commands.spawn(Camera3dBundle {
        transform: Transform::from_xyz(0.0, 8.0, 14.0).looking_at(Vec3::ZERO, Vec3::Y),
        ..default()
    });
}

fn player_movement(
    keyboard: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<(&mut Transform, &Player)>,
) {
    let delta = time.delta_seconds();
    for (mut transform, player) in query.iter_mut() {
        let mut move_dir = Vec3::ZERO;
        if keyboard.pressed(KeyCode::KeyW) || keyboard.pressed(KeyCode::ArrowUp) {
            move_dir.z -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyS) || keyboard.pressed(KeyCode::ArrowDown) {
            move_dir.z += 1.0;
        }
        if keyboard.pressed(KeyCode::KeyA) || keyboard.pressed(KeyCode::ArrowLeft) {
            move_dir.x -= 1.0;
        }
        if keyboard.pressed(KeyCode::KeyD) || keyboard.pressed(KeyCode::ArrowRight) {
            move_dir.x += 1.0;
        }

        if move_dir.length_squared() > 0.0 {
            transform.translation += move_dir.normalize() * player.speed * delta;
        }
    }
}
`;
}

// ──────────────────────────────────────────────
// Raylib (C++) Templates
// ──────────────────────────────────────────────

function getRaylibPlayground(): string {
	return `#include "raylib.h"

// Pi Game Studio — Raylib C++ Playable Sandbox
// Controles: [A/D] o Flechas para mover | [ESPACIO/W] para saltar | [ESC] Salir

struct Player {
    Vector2 position;
    Vector2 velocity;
    Vector2 size;
    bool isGrounded;
};

int main(void) {
    const int screenWidth = 1280;
    const int screenHeight = 720;

    InitWindow(screenWidth, screenHeight, "Pi Game Studio — Playable Sandbox (Raylib)");
    SetTargetFPS(60);

    const float gravity = 980.0f;
    const float moveSpeed = 300.0f;
    const float jumpVelocity = -450.0f;

    Rectangle floor = { 0, (float)screenHeight - 80, (float)screenWidth, 80 };

    Player player;
    player.size = (Vector2){ 32.0f, 64.0f };
    player.position = (Vector2){ (float)screenWidth / 2.0f, floor.y - player.size.y };
    player.velocity = (Vector2){ 0.0f, 0.0f };
    player.isGrounded = true;

    while (!WindowShouldClose()) {
        float delta = GetFrameTime();

        // 1. Input horizontal (A/D o Flechas)
        float direction = 0.0f;
        if (IsKeyDown(KEY_A) || IsKeyDown(KEY_LEFT)) direction -= 1.0f;
        if (IsKeyDown(KEY_D) || IsKeyDown(KEY_RIGHT)) direction += 1.0f;
        player.velocity.x = direction * moveSpeed;

        // 2. Salto (ESPACIO, W o Flecha Arriba)
        if ((IsKeyPressed(KEY_SPACE) || IsKeyPressed(KEY_W) || IsKeyPressed(KEY_UP)) && player.isGrounded) {
            player.velocity.y = jumpVelocity;
            player.isGrounded = false;
        }

        // 3. Gravedad
        if (!player.isGrounded) {
            player.velocity.y += gravity * delta;
        }

        // 4. Aplicar movimiento
        player.position.x += player.velocity.x * delta;
        player.position.y += player.velocity.y * delta;

        // 5. Colisión con suelo
        Rectangle playerRec = { player.position.x - player.size.x / 2.0f, player.position.y, player.size.x, player.size.y };
        if (CheckCollisionRecs(playerRec, floor)) {
            player.position.y = floor.y - player.size.y;
            player.velocity.y = 0.0f;
            player.isGrounded = true;
        }

        // Renderizado
        BeginDrawing();
        ClearBackground((Color){ 24, 26, 36, 255 });

        // Suelo
        DrawRectangleRec(floor, (Color){ 60, 68, 88, 255 });

        // Jugador
        DrawRectangleV((Vector2){ player.position.x - player.size.x / 2.0f, player.position.y }, player.size, (Color){ 102, 178, 255, 255 });

        // HUD & Instrucciones
        DrawText("PI GAME STUDIO - RAYLIB SANDBOX", 20, 20, 20, (Color){ 167, 139, 250, 255 });
        DrawText("Controles: [A/D] Mover  |  [ESPACIO/W] Saltar  |  [ESC] Salir", 20, 50, 16, (Color){ 156, 163, 175, 255 });
        DrawFPS(screenWidth - 100, 20);

        EndDrawing();
    }

    CloseWindow();
    return 0;
}
`;
}

// ──────────────────────────────────────────────
// Phaser (TypeScript) Templates
// ──────────────────────────────────────────────

function getPhaserPlayground(): string {
	return `import Phaser from "phaser";

// Pi Game Studio — Phaser Playable Sandbox (Arcade Physics 2D)
// Controles: [A/D] o Flechas para mover | [ESPACIO/W] para saltar

export class PlaygroundScene extends Phaser.Scene {
    private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };

    constructor() {
        super({ key: "PlaygroundScene" });
    }

    preload(): void {
        const playerGfx = this.make.graphics({ x: 0, y: 0 });
        playerGfx.fillStyle(0x67e8f9, 1);
        playerGfx.fillRect(0, 0, 32, 64);
        playerGfx.generateTexture("player_box", 32, 64);

        const floorGfx = this.make.graphics({ x: 0, y: 0 });
        floorGfx.fillStyle(0x3d4458, 1);
        floorGfx.fillRect(0, 0, 1280, 48);
        floorGfx.generateTexture("floor_box", 1280, 48);
    }

    create(): void {
        const width = this.scale.width;
        const height = this.scale.height;

        const platforms = this.physics.add.staticGroup();
        const floor = platforms.create(width / 2, height - 24, "floor_box") as Phaser.Physics.Arcade.Sprite;
        floor.refreshBody();

        this.player = this.physics.add.sprite(width / 2, height - 200, "player_box");
        this.player.setBounce(0.0);
        this.player.setCollideWorldBounds(true);
        this.physics.add.collider(this.player, platforms);

        if (this.input.keyboard) {
            this.cursors = this.input.keyboard.createCursorKeys();
            this.wasd = {
                up: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
                left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
                down: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
                right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
            };
        }

        this.add.text(24, 24, "PI GAME STUDIO — PHASER 2D SANDBOX", {
            fontSize: "20px",
            color: "#a78bfa",
            fontStyle: "bold",
        });
        this.add.text(24, 52, "Controles: [A/D] o Flechas mover | [ESPACIO/W] Saltar", {
            fontSize: "14px",
            color: "#9ca3af",
        });
    }

    override update(): void {
        const speed = 300;
        const jumpVelocity = -450;
        const onFloor = this.player.body.blocked.down || this.player.body.touching.down;

        const leftPressed = this.cursors?.left.isDown || this.wasd?.left.isDown;
        const rightPressed = this.cursors?.right.isDown || this.wasd?.right.isDown;
        const jumpPressed =
            Phaser.Input.Keyboard.JustDown(this.cursors?.up) ||
            Phaser.Input.Keyboard.JustDown(this.wasd?.up) ||
            Phaser.Input.Keyboard.JustDown(this.cursors?.space);

        if (leftPressed) {
            this.player.setVelocityX(-speed);
        } else if (rightPressed) {
            this.player.setVelocityX(speed);
        } else {
            this.player.setVelocityX(0);
        }

        if (jumpPressed && onFloor) {
            this.player.setVelocityY(jumpVelocity);
        }
    }
}

export const gameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    parent: "game-container",
    backgroundColor: "#181a24",
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 980 },
            debug: false,
        },
    },
    scene: [PlaygroundScene],
};
`;
}

// ──────────────────────────────────────────────
// Scaffold Engine Generator
// ──────────────────────────────────────────────

interface FilePlan {
	targetPath: string;
	content: string;
	description: string;
}

export async function scaffoldPlayground(
	studioRoot: string,
	options: ScaffoldOptions,
	ctx?: ExtensionContext,
): Promise<ScaffoldResult> {
	const engine = options.engine || "Godot";
	const dimension = options.dimension || "2d";
	const files: GeneratedFile[] = [];
	const notes: string[] = [];

	const filePlans: FilePlan[] = [];

	if (engine === "Godot") {
		if (dimension === "2d") {
			const scenePath = join(studioRoot, "scenes", "playground_2d.tscn");
			const scriptPath = join(studioRoot, "scripts", "player_2d.gd");
			const scriptRel = "scripts/player_2d.gd";

			filePlans.push({
				targetPath: scriptPath,
				content: getGodot2DPlayerScript(),
				description: "Script CharacterBody2D con movimiento, salto y gravedad",
			});
			filePlans.push({
				targetPath: scenePath,
				content: getGodot2DScene(scriptRel),
				description: "Escena 2D con Player, CollisionShape2D, Camera2D y Suelo StaticBody2D",
			});
		} else {
			const scenePath = join(studioRoot, "scenes", "playground_3d.tscn");
			const scriptPath = join(studioRoot, "scripts", "player_3d.gd");
			const scriptRel = "scripts/player_3d.gd";

			filePlans.push({
				targetPath: scriptPath,
				content: getGodot3DPlayerScript(),
				description: "Script CharacterBody3D con WASD y salto",
			});
			filePlans.push({
				targetPath: scenePath,
				content: getGodot3DScene(scriptRel),
				description: "Escena 3D con Player Capsule, Camera3D, Light, WorldEnvironment y CSGBox3D",
			});
		}
	} else if (engine === "Bevy") {
		const targetPath = join(studioRoot, "src", "playground.rs");
		const content = dimension === "3d" ? getBevy3DPlayground() : getBevy2DPlayground();
		filePlans.push({
			targetPath,
			content,
			description: `Sandbox ejecutable de Bevy (${dimension.toUpperCase()}) con sistemas de control`,
		});
	} else if (engine === "Raylib") {
		const targetPath = join(studioRoot, "src", "playground.cpp");
		filePlans.push({
			targetPath,
			content: getRaylibPlayground(),
			description: "Game loop completo en Raylib (C++) con física de salto y piso",
		});
	} else if (engine === "Phaser") {
		const targetPath = join(studioRoot, "src", "playground.ts");
		filePlans.push({
			targetPath,
			content: getPhaserPlayground(),
			description: "Playground 2D en Phaser (TypeScript) con Arcade Physics, movimiento y salto",
		});
	}

	// Write files respecting collision policy
	for (const plan of filePlans) {
		const rel = relative(studioRoot, plan.targetPath);
		let finalPath = plan.targetPath;
		let action: GeneratedFile["action"] = "created";

		if (existsSync(plan.targetPath)) {
			if (options.forceOverwrite) {
				action = "overwritten";
			} else if (options.useSuffix) {
				finalPath = getSuffixedPath(plan.targetPath);
				action = "suffixed";
			} else if (ctx && ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
				const choice = await promptSelectSafe(
					ctx,
					`El archivo "${rel}" ya existe. ¿Cómo deseas proceder?`,
					[
						"1. Sobrescribir archivo existente",
						"2. Crear con sufijo numerado (mantener existente)",
						"3. Cancelar scaffold",
					],
				);

				if (!choice || choice.index === 2) {
					notes.push(`Operación cancelada por el usuario al llegar a ${rel}.`);
					return {
						success: false,
						engine,
						dimension,
						files,
						runCommand: "",
						notes,
					};
				}

				if (choice.index === 0) {
					action = "overwritten";
				} else {
					finalPath = getSuffixedPath(plan.targetPath);
					action = "suffixed";
				}
			} else {
				// Non-interactive fallback: avoid accidental overwrites
				finalPath = getSuffixedPath(plan.targetPath);
				action = "suffixed";
				notes.push(`El archivo ${rel} ya existía; se generó ${relative(studioRoot, finalPath)} para preservar cambios.`);
			}
		}

		mkdirSync(dirname(finalPath), { recursive: true });
		writeFileAtomicSync(finalPath, plan.content, "utf8");

		files.push({
			path: finalPath,
			relPath: relative(studioRoot, finalPath),
			description: plan.description,
			action,
		});
	}

	// Calculate executable next step commands
	let runCommand = "";
	let editCommand: string | undefined;

	if (engine === "Godot") {
		const sceneRel = dimension === "2d" ? "scenes/playground_2d.tscn" : "scenes/playground_3d.tscn";
		runCommand = `godot --scene ${sceneRel}`;
		editCommand = "godot -e";
	} else if (engine === "Bevy") {
		runCommand = "cargo run --bin playground";
		notes.push("Nota: Si ejecutas como binario independiente, añade [[bin]] name = 'playground' path = 'src/playground.rs' en tu Cargo.toml.");
	} else if (engine === "Raylib") {
		runCommand = "g++ src/playground.cpp -lraylib -o playground && ./playground";
		notes.push("Nota: Si usas CMake, añade src/playground.cpp como ejecutable en tu CMakeLists.txt.");
	} else if (engine === "Phaser") {
		runCommand = "npx vite || npm run dev";
		notes.push("Nota: Ejecuta tu servidor web (Vite o npm run dev) para visualizar el sandbox en el navegador.");
	}

	return {
		success: true,
		engine,
		dimension,
		files,
		runCommand,
		editCommand,
		notes,
	};
}

/**
 * CLI command handler for /studio:scaffold (or /scaffold)
 */
export async function handleStudioScaffold(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const cwd = ctx.cwd || process.cwd();
	const studioRoot = findStudioRoot(cwd) || cwd;

	const forceOverwrite = /\b(--force|-f|--overwrite)\b/i.test(args);
	const useSuffix = /\b(--suffix|-s|--new)\b/i.test(args);

	const resolved = resolveEngineAndDimension(studioRoot, args);

	console.log(`\n${ACCENT}${BOLD}PI GAME STUDIO · SANDBOX SCAFFOLD${RESET}`);
	console.log(`${DIM}Generando entorno jugable interactivo en ${resolved.engine} (${resolved.dimension.toUpperCase()})...${RESET}\n`);

	const result = await scaffoldPlayground(
		studioRoot,
		{
			engine: resolved.engine,
			dimension: resolved.dimension,
			forceOverwrite,
			useSuffix,
		},
		ctx,
	);

	if (!result.success) {
		console.log(`${YELLOW}Operación cancelada o incompleta.${RESET}`);
		return;
	}

	// Render created files
	console.log(`${WHITE}Archivos del Sandbox:${RESET}`);
	for (const f of result.files) {
		const actionBadge =
			f.action === "created"
				? `${GREEN}[NUEVO]${RESET}`
				: f.action === "overwritten"
				? `${YELLOW}[SOBRESCRITO]${RESET}`
				: `${SECONDARY}[SUFIJO]${RESET}`;

		console.log(`  ${actionBadge} ${f.relPath}${RESET}`);
		console.log(`         ${DIM}${f.description}${RESET}`);
	}

	if (result.notes.length > 0) {
		console.log("");
		for (const n of result.notes) {
			console.log(`  ${GRAY}• ${n}${RESET}`);
		}
	}

	// Executable instructions box
	console.log(`\n${BORDER}──────────────────────────────────────────────────────────────────────${RESET}`);
	console.log(`${HEADING}⚡ PRÓXIMO PASO PARA EJECUTAR:${RESET}`);
	console.log(`  ${GREEN}${result.runCommand}${RESET}`);
	if (result.editCommand) {
		console.log(`  ${DIM}Para abrir en el editor:${RESET} ${SECONDARY}${result.editCommand}${RESET}`);
	}
	console.log(`${BORDER}──────────────────────────────────────────────────────────────────────${RESET}\n`);

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(
			`Sandbox ${result.dimension.toUpperCase()} en ${result.engine} generado con éxito.`,
			"info",
		);
	}
}
