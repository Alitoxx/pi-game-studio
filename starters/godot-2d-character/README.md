# Godot 4 2D Character Starter — Pi Game Studio

Starter boilerplate para proyectos 2D en **Godot 4.3+** usando **GDScript tipado**.

## Estructura

- `main.tscn`: Escena raíz con `Camera2D` y entidad `CharacterBody2D`.
- `scripts/player.gd`: Script con aceleración suave, fricción y movimiento en 8 direcciones usando `move_and_slide()`.
- `project.godot`: Configuración de ventana 1280x720, renderizado `forward_plus` y viewport escalable.

## Cómo abrir y ejecutar

1. Abre **Godot 4.x**.
2. Selecciona **Importar** y elige la carpeta de este proyecto (`project.godot`).
3. Presiona **F5** (o el botón Play) para probar la escena.
