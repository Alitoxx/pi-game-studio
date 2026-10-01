use bevy::prelude::*;

mod particle_arena;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "ARPG Adventure — Pi Game Studio (Bevy 2D)".into(),
                resolution: (1280.0_f32, 720.0_f32).into(),
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(
            Update,
            (player_movement, apply_velocity, player_attack).chain(),
        )
        .run();
}

/// Marcador de entidad controlable. Solo datos: la lógica vive en los sistemas.
#[derive(Component)]
struct Player;

/// Velocidad lineal en unidades/segundo. Componente de datos puro.
#[derive(Component, Default)]
struct Velocity(pub Vec2);

/// Velocidad máxima objetivo en unidades/segundo.
#[derive(Component)]
struct MovementSpeed(f32);

/// Aceleración y frenado por segundo (curva de respuesta del control).
const ACCELERATION: f32 = 2400.0;
const DECELERATION: f32 = 3000.0;

#[derive(Component)]
struct MainCamera;

fn setup(mut commands: Commands) {
    // 2D Orthographic Camera
    commands.spawn((
        Camera2d,
        MainCamera,
    ));

    // Player Entity (represented as a 2D colored quad)
    commands.spawn((
        Player,
        Velocity::default(),
        MovementSpeed(280.0),
        Sprite {
            color: Color::srgb(0.2, 0.7, 0.9),
            custom_size: Some(Vec2::new(32.0, 32.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
    ));

    info!("[Studio] ARPG Adventure starter initialized! Use WASD/Arrows to move, Space to attack.");
}

/// Lee el input y actualiza SOLO el componente `Velocity` (sin allocs, Query sobre `&mut Velocity`).
fn player_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<(&MovementSpeed, &mut Velocity), With<Player>>,
) {
    let delta = time.delta_secs();
    for (speed, mut velocity) in &mut query {
        let mut direction = Vec2::ZERO;

        if keyboard_input.pressed(KeyCode::KeyW) || keyboard_input.pressed(KeyCode::ArrowUp) {
            direction.y += 1.0;
        }
        if keyboard_input.pressed(KeyCode::KeyS) || keyboard_input.pressed(KeyCode::ArrowDown) {
            direction.y -= 1.0;
        }
        if keyboard_input.pressed(KeyCode::KeyA) || keyboard_input.pressed(KeyCode::ArrowLeft) {
            direction.x -= 1.0;
        }
        if keyboard_input.pressed(KeyCode::KeyD) || keyboard_input.pressed(KeyCode::ArrowRight) {
            direction.x += 1.0;
        }

        // Aceleración hacia el objetivo; frenado exponencial-lineal al soltar.
        let target = if direction == Vec2::ZERO {
            Vec2::ZERO
        } else {
            direction.normalize() * speed.0
        };

        let rate = if target == Vec2::ZERO { DECELERATION } else { ACCELERATION };
        let step = rate * delta;
        velocity.0 = velocity.0.move_towards(target, step);
    }
}

/// Integra `Velocity` sobre el `Transform` (separado para poder testearlo aislado).
fn apply_velocity(time: Res<Time>, mut query: Query<(&Velocity, &mut Transform), With<Player>>) {
    let delta = time.delta_secs();
    for (velocity, mut transform) in &mut query {
        transform.translation += (velocity.0 * delta).extend(0.0);
    }
}

fn player_attack(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    query: Query<&Transform, With<Player>>,
) {
    if keyboard_input.just_pressed(KeyCode::Space) {
        if let Ok(transform) = query.get_single() {
            info!("⚔️ Player attack triggered at ({:.1}, {:.1})!", transform.translation.x, transform.translation.y);
        }
    }
}
