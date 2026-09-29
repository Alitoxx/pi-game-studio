use bevy::prelude::*;

fn main() {
    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "ARPG Adventure — Pi Game Studio (Bevy 2D)".into(),
                resolution: (1280.0, 720.0).into(),
                ..default()
            }),
            ..default()
        }))
        .add_systems(Startup, setup)
        .add_systems(Update, (player_movement, player_attack))
        .run();
}

#[derive(Component)]
struct Player {
    speed: f32,
}

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
        Player { speed: 280.0 },
        Sprite {
            color: Color::srgb(0.2, 0.7, 0.9),
            custom_size: Some(Vec2::new(32.0, 32.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
    ));

    info!("[Studio] ARPG Adventure starter initialized! Use WASD/Arrows to move, Space to attack.");
}

fn player_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    mut query: Query<(&Player, &mut Transform)>,
) {
    for (player, mut transform) in &mut query {
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

        if direction != Vec2::ZERO {
            direction = direction.normalize();
            transform.translation.x += direction.x * player.speed * time.delta_secs();
            transform.translation.y += direction.y * player.speed * time.delta_secs();
        }
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
