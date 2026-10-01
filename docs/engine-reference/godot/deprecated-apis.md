# Godot APIs Deprecadas

## Yield vs Await
- La palabra clave `yield` fue eliminada en Godot 4. Debe utilizarse `await` en su lugar (ej: `await get_tree().create_timer(1.0).timeout`).

## KinematicBody vs CharacterBody
- `KinematicBody2D/3D` fue renombrado a `CharacterBody2D/3D`. Sus propiedades de velocidad ahora están integradas en el nodo en lugar de pasarse por parámetro a `move_and_slide`.

## OS Methods
- Muchos métodos de la clase `OS` fueron movidos a `DisplayServer` (para el manejo de ventanas) o a `Time` (para obtener tiempos).
