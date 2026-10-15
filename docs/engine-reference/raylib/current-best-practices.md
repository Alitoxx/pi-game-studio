# Raylib Mejores Prácticas (Raylib 5.5 + EnTT / Modern C++)

Patrones idiomáticos y arquitectura moderna en C++17/20 para desarrollo de alto rendimiento con Raylib y EnTT.

---

## 1. Gestión de Memoria y Recursos (RAII)
- Envolver todos los recursos en bruto de C (`Texture2D`, `Sound`, `Music`, `Font`, `Shader`) en wrappers modernos de C++ siguiendo el patrón RAII (*Resource Acquisition Is Initialization*).
- Garantizar la liberación determinista en destructores (`UnloadTexture`, `UnloadSound`, `UnloadShader`, `UnloadFont`) para evitar fugas de memoria VRAM y RAM.
- Diseñar tipos no copiables (`= delete` en constructor de copia y operador de asignación) y transferibles mediante movimiento (`std::move`).

## 2. Bucles de Juego Zero-Alloc
- Prohibir terminantemente asignaciones dinámicas (`new`, `malloc`) o redimensionamientos dinámicos de colecciones (`std::vector::push_back` con realocación) dentro del ciclo principal `UpdateDrawFrame`.
- Preasignar búferes, pools de entidades y estructuras de trabajo en la fase de inicialización (`Init`) para garantizar un frame-time 100% predecible y evitar pausas de caché o fragmentación.

## 3. Renderizado y Pipeline Gráfico
- **Delimitación de Frames con `BeginDrawing()` / `EndDrawing()`**: Toda emisión de comandos de dibujado en cada fotograma debe estar estrictamente encapsulada entre `BeginDrawing()` y `EndDrawing()`.
- **Cámara 2D (`Camera2D`)**: Utilizar `BeginMode2D(camera)` y `EndMode2D()` para gestionar zoom, rotación y desplazamiento de mundo (scrolling) de forma desacoplada de las coordenadas de pantalla.
- **Resolución Virtual y Render Targets**: Para soportar múltiples relaciones de aspecto y escalados limpios, dibujar la simulación completa dentro de un `RenderTexture2D` de resolución fija nativa. Posteriormente, proyectar dicha textura sobre la ventana escalándola con letterboxing o pillarboxing.
- **Pases de Shaders Personalizados**: Cargar efectos de post-procesado (aberración cromática, viñeta, bloom) mediante `LoadShader()` y ejecutarlos envolviendo el dibujado del render texture con `BeginShaderMode(shader)` y `EndShaderMode()`.

## 4. Control de Entrada e Input Mapping
- **Polling de Teclado y Ratón**: Utilizar el modelo de sondeo de Raylib (`IsKeyDown()`, `IsKeyPressed()`, `IsMouseButtonPressed()`).
- **Remapeo de Coordenadas de Ratón**: Al utilizar una textura virtual renderizada con barras negras o márgenes, re-escalar la posición de `GetMousePosition()` restando el offset de la ventana y multiplicando por la relación de escala para obtener la coordenada virtual exacta.
- **Detección Dinámica de Gamepads**: Comprobar siempre `IsGamepadAvailable(gamepad_id)` antes de consultar ejes analógicos (`GetGamepadAxisMovement`) o botones (`IsGamepadButtonPressed`), soportando desconexiones en caliente sin fallos.

## 5. Arquitectura ECS con EnTT
- **Componentes POD**: Definir componentes como structs planos (*Plain Old Data*) que agrupen exclusivamente estado sin lógica de comportamiento ni herencia.
- **Sistemas como Funciones Libres**: Implementar la lógica como funciones o métodos estáticos puros que acepten referencias al `entt::registry` o vistas específicas (`view`), iterando de forma lineal.
- **EnTT Views vs Groups**:
  - Utilizar **Views** (`registry.view<Position, Velocity>()`) para la iteración estándar del gameplay; son seguras, flexibles y no imponen reordenamientos globales.
  - Utilizar **Groups** (`registry.group<Position, Velocity>()`) únicamente en sistemas hipercríticos de alto rendimiento (simulaciones de partículas masivas o boids) donde los componentes deban empaquetarse de forma contigua en memoria.
- **Ciclo de Vida de Entidades**: Crear entidades mediante `registry.create()` y destruirlas con `registry.destroy()`. Evitar persistir identificadores enteros brutos que puedan quedar desactualizados; emplear identificadores generacionales cuando se requieran referencias duraderas.
- **Particiones Espaciales Auxiliares**: Dado que EnTT optimiza la contigüidad de memoria pero no la proximidad geométrica, integrar un Grid Espacial o Quadtree como sistema y recurso de apoyo para acelerar las comprobaciones de colisión de $O(N^2)$ a $O(N)$.

## 6. Sistema de Audio y Streaming
- **Inicialización de Dispositivo**: Es indispensable inicializar el hardware de audio llamando a `InitAudioDevice()` al arranque del juego y liberarlo con `CloseAudioDevice()` al salir.
- **Music Streams vs SFX en Memoria**:
  - Efectos de sonido cortos: Cargar directamente en memoria RAM con `LoadSound()`.
  - Pistas de música extensas o ambientales: Cargar mediante `LoadMusicStream()`. Es fundamental llamar a `UpdateMusicStream(music)` en cada iteración del bucle principal para rellenar los búferes de audio en streaming sin cortes.
- **Sound Pooling**: Para efectos concurrentes repetitivos (disparos rápidos, pasos), mantener un pool de sonidos o instanciar copias con `LoadSoundAlias()` para modular tono (`SetSoundPitch`), volumen y paneo de forma independiente por canal.
