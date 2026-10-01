# Godot - Rendering

## Compatibility vs Forward+ vs Mobile
- **Forward+**: Destinado a PC y consolas modernas. Usa Vulkan.
- **Mobile**: Optimizado para dispositivos móviles y hardware menos potente.
- **Compatibility**: Utiliza OpenGL3 para máximo soporte en dispositivos antiguos y web.

## Canvas Shaders
Los shaders 2D en Godot operan en `canvas_item`. Permiten efectos de post-procesado 2D de alta eficiencia utilizando el pipeline estándar del motor.
