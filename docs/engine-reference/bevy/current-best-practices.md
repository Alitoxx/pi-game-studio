# Bevy Current Best Practices (0.17–0.19)

**Last verified:** 2026-08-09

Practices below are 0.17–0.19 idioms that differ from pre-0.17 training data,
verified against official migration guides and engine sources. Rule: anything not
verifiable against an official Bevy 0.17–0.19 source is omitted.

---

## 1. ECS Architecture

- **Practice**: Buffered events are now *messages*. Derive `Message` (not `Event`) for anything you send/read with writers/readers, and use `MessageWriter`/`MessageReader`/`Messages<M>`. Reserve `Event` for observer events.
  ```rust
  #[derive(Message)]
  struct PlayerDied { player: Entity }

  fn send_death(mut messages: MessageWriter<PlayerDied>) { /* ... */ }
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#event-trait-split-rename

- **Practice**: Observers take `On<E>` (renamed from `Trigger<E>`); entity-targeted events derive `EntityEvent` and are fired with `world.trigger(...)` (not `trigger_targets`).
  ```rust
  #[derive(EntityEvent)]
  #[entity_event(propagate)] // defaults to ChildOf propagation
  struct Explode { entity: Entity }

  commands.add_observer(|explode: On<Explode>| {
      info!("{} exploded!", explode.entity);
  });
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#observer-event-api-changes

- **Practice**: In 0.19 resources are components stored on dedicated entities. Do NOT derive both `Component` and `Resource` on one type — split into distinct types. When using broad queries (`Query<EntityMut>`, `Query<Entity>`...), exclude resource entities with `Without<IsResource>` to avoid conflicts with `Res<T>`/`NonSend<T>` params.
  ```rust
  #[derive(Component)]
  struct MyDataComp(f32);

  #[derive(Resource)]
  struct MyDataRes(f32);

  fn system(entity_query: Query<EntityMut, Without<IsResource>>, res: Res<MyDataRes>) { /* ... */ }
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#resources-as-components

- **Practice**: Use `NextState::set_if_neq` instead of `set` when you do not want same-state transitions; `set` always runs `OnEnter`/`OnExit` on same-state transitions (and `DespawnOnEnter`/`DespawnOnExit` since 0.19 — in 0.18 they were skipped due to a bug).
  ```rust
  next_state.set_if_neq(State::Menu);
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-17-to-0-18/#same-state-transitions and https://bevy.org/learn/migration-guides/0-18-to-0-19/#despawnonenter-despawnonexit-can-now-trigger-during-same-state-transitions

- **Practice**: Main schedule order runs `Startup` once, then each frame `PreUpdate`, `Update`, `PostUpdate`, `Last`. Fixed-timestep logic runs inside `FixedUpdate`.
  ```rust
  app.add_systems(Update, movement_system);
  app.add_systems(FixedUpdate, physics_step);
  ```

- **Practice**: Name system sets with the `*Systems` suffix and schedule with executors passed as instances (0.19 removed `ExecutorKind`).
  ```rust
  #[derive(SystemSet, Debug, Clone, PartialEq, Eq, Hash)]
  enum MySystems { Movement, Physics }

  schedule.set_executor(MultiThreadedExecutor::new());
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#consistent-systems-naming-convention-for-system-sets and https://bevy.org/learn/migration-guides/0-18-to-0-19/#set-executor-replaced-executorkind

- **Practice**: Reflection auto-registration: with `reflect_auto_register` (a Bevy default feature) enabled, non-generic `Reflect` types register automatically — drop explicit `register_type` calls in app code. Generic types still need manual registration.
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#changes-to-type-registration-for-reflection

---

## 2. 2D Rendering & Sprites

- **Practice**: Spawn sprites directly as component tuples without `SpriteBundle` (removed in 0.16+). `Transform`, `Visibility`, `VisibilityClass`, and `Anchor` are auto-inserted required components.
  ```rust
  commands.spawn(Camera2d);
  commands.spawn((
      Sprite::from_image(asset_server.load("textures/player.png")),
      Transform::from_xyz(0.0, 0.0, 1.0), // Z controls 2D draw order
  ));
  ```

- **Practice**: Sprite sheets use the `TextureAtlasLayout` asset and `TextureAtlas` struct stored inside `Sprite.texture_atlas` (it is not a standalone component).
  ```rust
  let layout = TextureAtlasLayout::from_grid(UVec2::splat(24), 7, 1, None, None);
  let atlas_layout = texture_atlas_layouts.add(layout);

  commands.spawn(Sprite::from_atlas_image(
      texture,
      TextureAtlas { layout: atlas_layout, index: 0 },
  ));
  ```
  Animate by querying `&mut Sprite` and updating `sprite.texture_atlas.as_mut().unwrap().index` on a timer.

- **Practice**: `Anchor` is a required component on sprites (defaults to `Anchor::CENTER`). Since 0.17 the `anchor` field was removed from `Sprite`, and variants are constants (e.g., `Anchor::TOP_LEFT`).
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#anchor-is-now-a-required-component-on-sprite

---

## 3. 3D Rendering & Meshes

- **Practice**: Spawn 3D entities as `(Mesh3d(handle), MeshMaterial3d(material), Transform)` tuples. `PbrBundle` no longer exists.
  ```rust
  commands.spawn((
      Mesh3d(meshes.add(Cuboid::new(1.0, 1.0, 1.0))), // Note: Cuboid, not Cube
      MeshMaterial3d(materials.add(StandardMaterial {
          base_color: Color::srgb(0.8, 0.2, 0.2),
          ..default()
      })),
      Transform::from_xyz(0.0, 0.5, 0.0),
  ));
  ```

- **Practice**: Mesh primitives implement `Meshable` (`Cuboid::new`, `Sphere::new`, `Plane3d::new`, `Cylinder::new`, `Torus::new`). There is no `Cube` primitive in 0.19.

- **Practice**: Spawn lights as plain components (`DirectionalLight`, `PointLight`, `SpotLight`) with `Transform`. Directional illuminance is in lux; point/spot intensity is in lumens. Scene ambient lighting is controlled via the `GlobalAmbientLight` resource or the per-camera `AmbientLight` component.

- **Practice**: Load glTF scenes using `WorldAssetRoot` (0.19 renamed `SceneRoot` / `bevy_scene` to `bevy_world_serialization`).
  ```rust
  commands.spawn((
      WorldAssetRoot(asset_server.load("models/character.gltf#Scene0")),
      Transform::from_xyz(0.0, 0.0, 0.0),
  ));
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#the-old-bevy-scene-is-now-bevy-world-serialization

---

## 4. Rendering Pipeline & Shaders

- **Practice**: Custom render passes are now systems (the `RenderGraph` API was removed in 0.19). Use a `ViewQuery` param + `RenderContext` system param, and order with `.before()`/`.after()` on actual pass systems, scoped by `Core3dSystems::Prepass` / `MainPass` / `EarlyPostProcess` / `PostProcess`.
  ```rust
  pub fn my_render_pass(
      world: &World,
      view: ViewQuery<(&ExtractedCamera, &ViewTarget)>,
      mut ctx: RenderContext,
  ) {
      let (camera, target) = view.into_inner();
      // ...
  }

  render_app.add_systems(
      Core3d,
      my_render_pass
          .after(main_opaque_pass_3d)
          .in_set(Core3dSystems::MainPass),
  );
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#render-graph-as-systems

- **Practice**: Import render types from the crates they were split into (0.17+): cameras from `bevy::camera`, shaders from `bevy::shader`, lights/skybox from `bevy::light`, meshes from `bevy::mesh`, images from `bevy::image`, post-process from `bevy::post_process`, AA from `bevy::anti_alias`. Do not use `bevy::render::` paths for these (re-exports were removed).
  ```rust
  use bevy::camera::Camera3d;
  use bevy::mesh::Mesh;
  use bevy::post_process::Bloom;
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#bevy-render-reorganization

- **Practice**: `RenderTarget` is a required component, not a `Camera` field (0.18).
  ```rust
  commands.spawn((
      Camera3d::default(),
      RenderTarget::Image(image_handle.into()),
  ));
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-17-to-0-18/#rendertarget-is-now-a-component

- **Practice**: Many render pipeline resources are initialized in the `RenderStartup` schedule (0.17+), not in `Plugin::finish`. Initialize render resources from a system added to `RenderStartup` instead of `FromWorld`.
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#many-render-resources-now-initialized-in-renderstartup

- **Practice**: Material config moved onto the `Material` trait (0.18): implement `enable_prepass()`/`enable_shadows()` instead of configuring `MaterialPlugin` fields.
  **Source**: https://bevy.org/learn/migration-guides/0-17-to-0-18/#enable-prepass-and-enable-shadows-are-now-material-methods

- **Practice**: Bloom luma is computed in linear space since 0.19 — tune `Bloom::intensity` and `prefilter` rather than assuming the legacy sRGB look.
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#bloom-luma-calculation-now-in-linear-space

---

## 5. UI Architecture & Layout

- **Practice**: Construct UI hierarchies using `Node` components arranged with Flexbox or CSS Grid, parenting nodes with `with_children`.
  ```rust
  commands.spawn(Camera2d);
  commands.spawn(Node {
      width: Val::Percent(100.0),
      height: Val::Percent(100.0),
      justify_content: JustifyContent::Center,
      align_items: AlignItems::Center,
      ..default()
  }).with_children(|parent| {
      parent.spawn((
          Button,
          Node {
              width: Val::Px(160.0),
              height: Val::Px(50.0),
              border_radius: BorderRadius::all(Val::Px(6.0)), // field on Node in 0.18+
              justify_content: JustifyContent::Center,
              align_items: AlignItems::Center,
              ..default()
          },
          BackgroundColor(Color::srgb(0.2, 0.2, 0.2)),
      ));
  });
  ```

- **Practice**: Handle button interactions by querying `(&Interaction, &mut BackgroundColor)` with `Changed<Interaction>`.
  ```rust
  fn button_system(
      mut query: Query<(&Interaction, &mut BackgroundColor), (Changed<Interaction>, With<Button>)>,
  ) {
      for (interaction, mut color) in &mut query {
          *color = match *interaction {
              Interaction::Pressed => BackgroundColor(Color::srgb(0.35, 0.75, 0.35)),
              Interaction::Hovered => BackgroundColor(Color::srgb(0.25, 0.25, 0.25)),
              Interaction::None => BackgroundColor(Color::srgb(0.15, 0.15, 0.15)),
          };
      }
  }
  ```

- **Practice**: `TextFont` in 0.19 takes `FontSource` (`Handle<Font>.into()`) and `FontSize::Px(f32)`. `LineHeight` is a separate component, and text alignment uses `TextLayout::justify(Justify::Center)`.
  ```rust
  commands.spawn((
      Text::new("Score: 0"),
      TextFont {
          font: asset_server.load("fonts/bold.ttf").into(),
          font_size: FontSize::Px(24.0),
          ..default()
      },
      TextColor(Color::WHITE),
  ));
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#changes-to-textfont-s-font-size-and-font-fields

- **Practice**: `BorderRadius` is a field on `Node`, not a separate component (0.18).
  **Source**: https://bevy.org/learn/migration-guides/0-17-to-0-18/#borderradius-has-been-added-to-node-and-is-no-longer-a-component

- **Practice**: `UiWidgetsPlugins` and `InputDispatchPlugin` are already part of `DefaultPlugins` since 0.19 — do not add them manually.
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#uiwidgetsplugins-and-inputdispatchplugin-are-now-in-defaultplugins

- **Practice**: `Window` is split into multiple components (0.17): configure cursor settings via the `CursorOptions` component / `WindowPlugin::primary_cursor_options`, not `Window.cursor_options`.
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#window-is-now-split-into-multiple-components

---

## 6. Asset Management & Hot Reload

- **Practice**: Prefer `AssetServer::load_builder()` for advanced loads (untyped loads, settings, guards) — old `load_*` variants are deprecated in 0.19.
  ```rust
  asset_server
      .load_builder()
      .with_settings(settings)
      .override_unapproved()
      .load(path)
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#advanced-assetserver-load-variants-are-now-exposed-through-a-builder-pattern

- **Practice**: `Assets::get_mut` returns `Option<AssetMut<A>>` in 0.19. `AssetEvent::Modified` fires only on actual mutation through dereferencing.
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#avoiding-unnecessary-assetevent-modified-events-that-lead-to-rendering-performance-costs

- **Practice**: `Assets::insert` / `get_or_insert_with` return `Result` since 0.17 — handle or unwrap the error instead of panicking.
  ```rust
  assets.insert(handle, my_asset).unwrap();
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#assets-insert-and-assets-get-or-insert-with-now-return-result

- **Practice**: `AssetPath::resolve`/`resolve_embed` take `&AssetPath` (0.19); use `resolve_str` for string paths.
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#assetpath-resolve-and-resolve-embed-now-take-assetpath

- **Practice**: Asset hot reload requires the `watch` cargo feature at dev-time and optional runtime config via `AssetPlugin::watch_for_changes_override: Some(true)`.
  ```rust
  app.add_plugins(DefaultPlugins.set(AssetPlugin {
      watch_for_changes_override: Some(true),
      ..default()
  }));
  ```

---

## 7. Input Handling

- **Practice**: Query `ButtonInput<KeyCode>` for physical keys (in 0.19 `KeyCode` is the physical key; there is no separate `PhysicalKey` type) and `ButtonInput<MouseButton>` for mouse clicks.
  ```rust
  fn input_system(keyboard: Res<ButtonInput<KeyCode>>, mouse: Res<ButtonInput<MouseButton>>) {
      if keyboard.just_pressed(KeyCode::Space) { /* jump */ }
      if mouse.just_pressed(MouseButton::Left) { /* fire */ }
  }
  ```

- **Practice**: In 0.19 gamepads are entities with a `Gamepad` component, not a resource. Query `Query<&Gamepad>` and check digital buttons or analog axes directly.
  ```rust
  fn gamepad_system(gamepads: Query<&Gamepad>) {
      for gamepad in &gamepads {
          if gamepad.just_pressed(GamepadButton::South) { /* A button */ }
          if let Some(x) = gamepad.get(GamepadAxis::LeftStickX) { /* [-1.0, 1.0] */ }
      }
  }
  ```

- **Practice**: Touch input uses the `Res<Touches>` resource and `TouchInput` messages. There is no `TouchEvents` or `TouchPress` type in 0.19.
  ```rust
  fn touch_system(touches: Res<Touches>) {
      for touch in touches.iter_just_pressed() {
          info!("touch at {}", touch.position());
      }
  }
  ```

- **Practice**: Pointer events use `Pointer<Press>` / `Pointer<Release>` (0.17 renamed from `Pressed`/`Released`); `Pressed` is now a marker component meaning "held down".
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#rename-pointer-pressed-and-pointer-released-to-pointer-press-and-pointer-release

- **Practice**: With `default-features = false`, explicitly enable input sources in Cargo.toml: `mouse`, `keyboard`, `gamepad`, `touch`, `gestures`.
  **Source**: https://bevy.org/learn/migration-guides/0-17-to-0-18/#put-input-sources-for-bevy-input-under-features

---

## 8. Audio System & Spatial Sound

- **Practice**: Spawn sounds with `AudioPlayer::new(handle)` + `PlaybackSettings` (`ONCE`, `LOOP`, `DESPAWN`). `AudioBundle` and `SpatialAudioBundle` no longer exist.
  ```rust
  commands.spawn((
      AudioPlayer::new(asset_server.load("sounds/laser.ogg")),
      PlaybackSettings::DESPAWN, // Auto-despawns entity when playback completes
  ));
  ```

- **Practice**: For spatial audio, set `PlaybackSettings.with_spatial(true)` on emitters with a `Transform`, and spawn exactly one `SpatialListener` entity in the scene.
  ```rust
  commands.spawn((
      Transform::default(),
      SpatialListener::new(4.0), // Ear separation distance
  ));
  ```

- **Practice**: Mutate the `AudioSink` or `SpatialAudioSink` component (auto-inserted once playback starts) to control volume, pausing, or pitch of active sounds at runtime.

- **Practice**: Use `increase_by_percentage` instead of `+`/`-` on `Volume::Linear` (Add/Sub impls removed in 0.17).
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#remove-the-add-sub-impls-on-volume

- **Practice**: Audio features are not implied by `2d`/`3d`/`ui` in 0.19. When using `default-features = false`, enable `"audio"` and format features (`vorbis`, `wav`, `mp3`, `flac`) explicitly. Use `mp3` (symphonia), not the deprecated `minimp3`.
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#audio-feature-is-now-no-longer-implied-by-the-3d-2d-or-ui-features

---

## 9. Testing & System Isolation

- **Practice**: Test game logic headlessly using `App::new()` with `MinimalPlugins`. Advance frames with `app.update()`. Never call `app.run()` in tests as it blocks execution.
  ```rust
  #[test]
  fn test_movement() {
      let mut app = App::new();
      app.add_plugins(MinimalPlugins);
      app.add_systems(Update, movement_system);

      let entity = app.world_mut().spawn((
          Position { x: 0.0, y: 0.0 },
          Velocity { x: 10.0, y: 0.0 },
      )).id();

      app.update();

      let pos = app.world().entity(entity).get::<Position>().unwrap();
      assert_eq!(pos.x, 10.0);
  }
  ```

- **Practice**: Run single isolated systems with `world.run_system_once(system)`. It applies deferred commands automatically and returns `Result<Out, RunSystemError>`.
  ```rust
  let result = world.run_system_once(my_system).unwrap();
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#system-run-returns-result

- **Practice**: `SystemState::get`/`get_mut` return `Result<_, SystemParamValidationError>` in 0.19 — unwrap them when extracting parameters for repeated testing.
  ```rust
  let mut state: SystemState<(Query<&Position>, ResMut<Score>)> = SystemState::new(&mut world);
  let (query, mut score) = state.get_mut(&mut world).unwrap();
  state.apply(&mut world);
  ```
  **Source**: https://bevy.org/learn/migration-guides/0-18-to-0-19/#systemparam-validation-is-now-done-when-fetching-the-data

- **Practice**: Manual entity creation in tests uses `Entity::from_raw_u32` (returns `Option`) and `EntityGeneration::FIRST.after_versions(...)`.
  **Source**: https://bevy.org/learn/migration-guides/0-16-to-0-17/#manual-entity-creation-and-representation
