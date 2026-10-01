# Godot Mejores Prácticas (Godot 4.3+)

## Ciclo de vida de nodos
- Entender el orden de `_enter_tree`, `_ready`, `_process` y `_physics_process`.
- Evitar inicializaciones pesadas en `_ready` si se pueden diferir.

## GDScript Tipado
- Utilizar tipado estático `var vida: int = 10` y tipos de retorno `func obtener_vida() -> int:` para mejorar el rendimiento y autocompletado.

## Signals vs Call Group
- Usar Signals (Señales) para comunicación de abajo hacia arriba (hijo a padre).
- Usar `call_group` para notificar a múltiples entidades desconectadas de un evento global sin crear dependencias.

## Gestión de Recursos
- Cargar recursos de forma asíncrona usando `ResourceLoader` para evitar tirones en el juego.
- Compartir instancias de `Resource` para datos comunes entre múltiples nodos.

## Ticks Físicos
- Realizar todos los cálculos relacionados con colisiones y movimiento en `_physics_process(delta)`.
- Evitar mezclar lógica visual dependiente del framerate dentro del paso de simulación física.
