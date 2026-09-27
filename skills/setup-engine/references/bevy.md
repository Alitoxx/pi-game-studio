# Appendix B — Bevy (Rust) Configuration Reference

### B1. CLAUDE.md Technology Stack
```markdown
- **Engine**: Bevy [version]
- **Language**: Rust
- **Build System**: Cargo
- **Asset Pipeline**: Bevy AssetServer
```

### B2. Naming Conventions
- Structs / Enums / Components / Systems: UpperCamelCase (`PlayerController`, `Velocity`, `Health`)
- Functions / Methods / Variables: snake_case (`take_damage()`, `move_speed`)
- Modules / Files: snake_case (`player_controller.rs`, `combat/mod.rs`)
- Constants / Statics: SCREAMING_SNAKE_CASE (`MAX_HEALTH`, `BASE_SPEED`)

### B3. Engine Specialists Routing
```markdown
## Engine Specialists
- **Primary**: bevy-specialist
- **Language/Code Specialist**: bevy-specialist (Rust — single specialist covers all code)
- **Shader Specialist**: bevy-specialist (WGSL shaders, wgpu materials)
- **UI Specialist**: bevy-specialist (bevy_ui)
- **Additional Specialists**: None
- **Routing Notes**: Invoke primary for all Bevy code, Cargo build, and architecture decisions. The single specialist covers ECS, rendering, UI, assets, audio, and input.

### File Extension Routing

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (.rs files) | bevy-specialist |
| Shader files (.wgsl) | bevy-specialist |
| Asset / scene files (.ron, .gltf, .scene) | bevy-specialist |
| Cargo / build files (Cargo.toml, Cargo.lock) | bevy-specialist |
| General architecture review | bevy-specialist |
```
