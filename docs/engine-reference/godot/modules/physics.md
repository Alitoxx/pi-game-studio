# Godot - Physics

## CharacterBody y move_and_slide
En Godot 4, `CharacterBody2D/3D` maneja internamente la propiedad `velocity`. El método `move_and_slide()` ya no toma parámetros y utiliza el estado interno de velocidad, devolviendo un booleano.

## Shape Queries y Raycasting
- Usar `PhysicsDirectSpaceState` para queries como `intersect_ray` o `intersect_shape`.
- Evitar instanciar nodos `RayCast` temporalmente para checks; usar el SpaceState es más directo y eficiente desde código.
