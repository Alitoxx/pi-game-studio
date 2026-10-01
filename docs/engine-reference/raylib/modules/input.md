# Raylib - Input

## Polling vs Gamepads
- El método principal de input en Raylib es a través de polling (ej: `IsKeyDown()`, `IsGamepadButtonDown()`). 
- Manejar los gamepads dinámicamente verificando `IsGamepadAvailable(gamepad_id)`.

## Coordenadas Virtuales
- Para juegos que soportan múltiples resoluciones, es buena práctica renderizar a un `RenderTexture2D` de resolución fija, y escalar este en pantalla. 
- Mapear el `GetMousePosition()` restando márgenes y re-escalando a las coordenadas del mundo virtual.
