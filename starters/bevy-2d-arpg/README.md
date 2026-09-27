# Bevy 2D ARPG Starter — Pi Game Studio

Starter boilerplate optimizado para juegos 2D cenitales o isométricos tipo ARPG usando **Bevy 0.15** en Rust.

## Estructura

- `src/main.rs`: Configuración de ventana (1280x720), cámara 2D ortográfica, entidad de jugador con movimiento en 8 direcciones y trigger de ataque con la barra espaciadora.
- `Cargo.toml`: Dependencia `bevy` configurada con `dynamic_linking` para acelerar tiempos de compilación iterativa en desarrollo.

## Cómo ejecutar

```bash
# Ejecutar en modo desarrollo
cargo run

# Compilar build optimizada
cargo build --release
```

## Controles

- **Mover:** Teclas `W`, `A`, `S`, `D` o Flechas del teclado
- **Acción / Ataque:** Barra espaciadora (`Space`)
