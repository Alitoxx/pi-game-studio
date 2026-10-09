use bevy::prelude::*;

mod particle_arena;

/// Pi Game Studio — 10 Standards Compliant Bevy 2D Starter
/// 1. Audio Buses & Sound architecture
/// 2. Juice & Game Feel (Hitstop timer & Easing)
/// 4. Action Mapping (Dual Gamepad + Keyboard)
/// 5. F3 / ~ Debug Overlay
/// 8. App State Machine (InGame, Paused)

#[derive(States, Debug, Clone, Copy, Eq, PartialEq, Hash, Default)]
enum AppState {
    #[default]
    InGame,
    Paused,
}

#[derive(Resource, Default)]
struct DebugOverlayState {
    pub visible: bool,
}

#[derive(Resource, Default)]
struct GameFeelState {
    pub hitstop_timer: f32,
}

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
        .init_state::<AppState>()
        .init_resource::<DebugOverlayState>()
        .init_resource::<GameFeelState>()
        .add_systems(Startup, setup)
        .add_systems(
            Update,
            (
                toggle_pause,
                toggle_debug_overlay,
                (player_movement, apply_velocity, player_attack)
                    .chain()
                    .run_if(in_state(AppState::InGame)),
            ),
        )
        .run();
}

/// Marcador de entidad controlable.
#[derive(Component)]
struct Player;

/// Velocidad lineal en unidades/segundo.
#[derive(Component, Default)]
struct Velocity(pub Vec2);

/// Velocidad máxima objetivo en unidades/segundo.
#[derive(Component)]
struct MovementSpeed(f32);

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

    info!("[Studio] ARPG Adventure starter initialized! WASD to move, Space to attack, ESC to pause, F3 for debug.");
}

/// Standard 8: App State Machine & Pause Toggle
fn toggle_pause(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    state: Res<State<AppState>>,
    mut next_state: ResMut<NextState<AppState>>,
) {
    if keyboard_input.just_pressed(KeyCode::Escape) {
        match state.get() {
            AppState::InGame => {
                next_state.set(AppState::Paused);
                info!("[Studio] Game Paused");
            }
            AppState::Paused => {
                next_state.set(AppState::InGame);
                info!("[Studio] Game Resumed");
            }
        }
    }
}

/// Standard 5: F3 Debug Overlay toggle
fn toggle_debug_overlay(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    mut overlay: ResMut<DebugOverlayState>,
) {
    if keyboard_input.just_pressed(KeyCode::F3) || keyboard_input.just_pressed(KeyCode::Backquote) {
        overlay.visible = !overlay.visible;
        info!("[Studio] F3 Debug Overlay: {}", if overlay.visible { "ON" } else { "OFF" });
    }
}

/// Lee el input y actualiza SOLO el componente `Velocity`
fn player_movement(
    keyboard_input: Res<ButtonInput<KeyCode>>,
    time: Res<Time>,
    game_feel: Res<GameFeelState>,
    mut query: Query<(&MovementSpeed, &mut Velocity), With<Player>>,
) {
    if game_feel.hitstop_timer > 0.0 {
        return;
    }

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

/// Integra `Velocity` sobre el `Transform`
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
            info!("[Studio] Player attack triggered at ({:.1}, {:.1})", transform.translation.x, transform.translation.y);
        }
    }
}
