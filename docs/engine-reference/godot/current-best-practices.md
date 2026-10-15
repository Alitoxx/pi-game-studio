# Godot Mejores Prácticas (Godot 4.3+)

Guía de arquitectura y patrones idiomáticos modernos para desarrollo en Godot 4.3+.

---

## 1. Ciclo de Vida de Nodos
- Entender el orden de inicialización: `_enter_tree`, `_ready`, `_process` y `_physics_process`.
- Evitar inicializaciones costosas o bloqueantes dentro de `_ready`; diferir tareas pesadas mediante llamadas diferidas (`call_deferred`) o corrutinas.
- Respetar la regla de oro de la jerarquía de nodos: *"Las llamadas bajan, las señales suben"*. Los nodos padres invocan métodos de sus hijos; los hijos emiten señales para notificar a sus padres sin acoplarlos.

## 2. GDScript Tipado
- Utilizar tipado estático riguroso en variables (`var vida: int = 100`) y firmas de funciones (`func aplicar_danio(cantidad: int) -> bool:`).
- El tipado estático previene bugs en tiempo de edición, optimiza la velocidad del bytecode en la máquina virtual de Godot y provee autocompletado confiable.

## 3. Signals vs Call Group
- **Signals (Señales)**: Utilizarlas para comunicación desacoplada ascendente (hijo a padre) o entre componentes específicos.
- **Call Groups**: Usar `get_tree().call_group("grupo", "metodo", args)` para difundir eventos a múltiples entidades no relacionadas (por ejemplo, pausar todos los enemigos o notificar cambios climáticos globales) sin crear dependencias circulares.

## 4. Gestión de Recursos y Memoria
- Cargar recursos grandes de forma asíncrona mediante `ResourceLoader.load_threaded_request()` para evitar micro-tirones (frame drops) durante el gameplay.
- Compartir instancias de `Resource` (datos inmutables, tablas de loot, estadísticas base) entre múltiples nodos para minimizar el consumo de memoria.

## 5. Ticks Físicos y Movimiento
- **Simulación en `_physics_process(delta)`**: Realizar todos los cálculos de colisiones, fuerzas y traslaciones físicas exclusivamente en el ciclo físico con delta fijo.
- **`CharacterBody2D/3D` y `move_and_slide()`**: En Godot 4, `CharacterBody` gestiona internamente la propiedad `velocity`. El método `move_and_slide()` no recibe parámetros y opera directamente sobre dicho estado interno.
- **Shape Queries y Raycasting directos**: Usar `PhysicsDirectSpaceState2D/3D` (`get_world_2d().direct_space_state.intersect_ray(...)`) para comprobaciones programáticas. Evitar instanciar nodos `RayCast` temporales en el árbol de escena únicamente para chequeos de línea de visión o colisión.

## 6. Arquitectura SceneTree vs ECS
- **SceneTree orientado a objetos**: Idóneo para la mayoría de elementos con lógica contextualizada, menús, jerarquías de entidades complejas y estados interactivos.
- **Optimización para multitudes (Massive Entities)**: Cuando se simulan miles de proyectiles, partículas u hordas, el árbol de nodos introduce sobrecostes de memoria y pérdida de localidad en caché.
- **GDExtension y EnTT**: Para cargas masivas, implementar sistemas ECS en C++ vía GDExtension (utilizando bibliotecas como `EnTT`) combinados con `MultiMeshInstance2D/3D` para renderizar miles de instancias en un único draw call.

## 7. Renderizado y Shaders
- **Selección de Renderer**:
  - **Forward+**: Pipeline Vulkan de alta fidelidad para PC y consolas modernas; soporte completo de iluminación volumétrica y sombras avanzadas.
  - **Mobile**: Optimizado para dispositivos móviles y hardware integrado con balance entre fidelidad gráfica y consumo térmico.
  - **Compatibility**: Backend OpenGL3 diseñado para máxima compatibilidad con web (HTML5/WebGL) y hardware legacy.
- **Canvas Shaders**: Los shaders 2D operan bajo `shader_type canvas_item`. Permiten efectos de post-procesado, distorsión, desenfoques y transiciones de pantalla con coste mínimo dentro del pipeline gráfico estándar.

## 8. Interfaz de Usuario (UI)
- **Nodos Control y Anclas**: Usar el sistema de anclas (anchors) y presets de layout para interfaces completamente adaptativas a múltiples resoluciones y relaciones de aspecto.
- **Contenedores Dinámicos**: Construir menús escalables utilizando `HBoxContainer`, `VBoxContainer`, `GridContainer` y `MarginContainer`, evitando posicionar elementos con coordenadas de píxel fijas.
- **Theme Overrides**: Personalizar variaciones visuales menores directamente mediante *Theme Overrides* (fuentes, márgenes, colores de borde) en lugar de duplicar nodos de control o crear temas globales redundantes.

## 9. Audio y Mezcla
- **Buses de AudioServer**: Distribuir el audio en canales jerárquicos (*Master*, *Music*, *SFX*, *Voice*, *Ambience*) a través de `AudioServer`. Facilita la aplicación de efectos globales (reverberación, ecualización, ducking o atenuación automática) sin tocar emisores individuales.
- **Pooling de AudioStreamPlayer**: Evitar instanciar y destruir nodos `AudioStreamPlayer` dinámicamente para cada efecto repetitivo. Crear un pool reutilizable de reproductores pre-instanciados para evitar picos de Garbage Collection y pausas de instanciación en tiempo de ejecución.
