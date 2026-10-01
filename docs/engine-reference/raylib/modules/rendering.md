# Raylib - Rendering

## BeginDrawing y EndDrawing
- Siempre rodear las operaciones de dibujado de cada fotograma con `BeginDrawing()` y `EndDrawing()`. Estas funciones manejan la presentación del buffer subyacente.

## Cámara 2D
- Utilizar `Camera2D` con `BeginMode2D()` para habilitar el desplazamiento visual (scrolling), rotación y zoom, abstrayéndose de la posición en pantalla y trabajando en coordenadas de mundo.

## Custom Shader Passes
- Para efectos como aberración cromática o bloom, inicializar shaders con `LoadShader()` y dibujarlos usando `BeginShaderMode()`. Renderizar a `RenderTexture2D` para aplicar los efectos sobre toda la escena.
