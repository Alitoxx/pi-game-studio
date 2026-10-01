# Godot Breaking Changes

## Cambios de Godot 3.x a 4.x
- **Sintaxis de Callable/Signal:** Las señales ahora son objetos de primera clase. En vez de `connect("signal", self, "method")` usa `signal.connect(method)`.
- **GDExtension vs GDNative:** GDNative fue reemplazado por GDExtension, ofreciendo una integración más profunda y mejor rendimiento con C++.
- **TileMap a TileMapLayer:** En Godot 4.3, `TileMapLayer` es la opción preferida por sobre un único nodo `TileMap` complejo para mejor rendimiento y flexibilidad.
