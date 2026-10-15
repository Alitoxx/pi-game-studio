# Unity Mejores Prácticas (2022.3 LTS / Unity 6)

Arquitectura y patrones recomendados para desarrollo profesional y de alto rendimiento en Unity.

---

## 1. Input System y Action Maps
- Utilizar el paquete moderno de **Input System** (`com.unity.inputsystem`) descartando el Input Manager heredado.
- Definir **Action Maps** desacoplados según el contexto del jugador (ej: `"Gameplay"`, `"UI"`, `"Vehicle"`). Esto simplifica el remapeo de controles, el soporte para múltiples mandos y previene filtraciones de pulsaciones entre menús y jugabilidad.

## 2. Gestión de Assets: Addressables vs Resources
- Eliminar completamente el uso de la carpeta `Resources`, ya que incrementa artificialmente el tiempo de arranque de la aplicación e infla el build binario principal.
- Implementar **Addressables** para la carga y descarga asíncrona de recursos en memoria bajo demanda (`Addressables.LoadAssetAsync<T>()`), permitiendo además particionar assets en bundles remotos o descargables (DLCs y parches).

## 3. Arquitecturas Basadas en ScriptableObjects
- Emplear `ScriptableObject` para estructurar datos inmutables de diseño (estadísticas base, tablas de loot, definiciones de armas).
- Implementar arquitecturas modulares desacopladas (patrón Ryan Hipple) donde variables compartidas y canales de eventos vivan en `ScriptableObjects`, eliminando la necesidad de Singletons globales estáticos o referencias directas entre prefabs.

## 4. Consultas Físicas Zero-GC
- Prohibir en el game loop las llamadas físicas que alocan memoria dinámica (`Physics.RaycastAll`, `Physics.OverlapSphere`).
- Utilizar exclusivamente las variantes **NonAlloc** reutilizando búferes preasignados:
  ```csharp
  private readonly RaycastHit[] _hitBuffer = new RaycastHit[16];

  int hitCount = Physics.RaycastNonAlloc(origin, direction, _hitBuffer, maxDistance, layerMask);
  for (int i = 0; i < hitCount; i++) {
      // procesar _hitBuffer[i]
  }
  ```

## 5. Renderizado en Universal Render Pipeline (URP)
- **Extensión con Custom Render Passes**: Personalizar el pipeline de renderizado utilizando `ScriptableRendererFeature` y `ScriptableRenderPass` para inyectar pases de dibujado en etapas precisas (después de opacos, post-transparencias o antes de post-procesado).
- **Shader Graph**: Construir materiales visuales mediante Shader Graph para asegurar compatibilidad multiplataforma y compilación automática optimizada para el SRP Batcher.
- **MaterialPropertyBlock y SRP Batcher**: Evitar modificar `renderer.material` en tiempo de ejecución (lo que genera una copia única del material e interrumpe el instanciado por lotes). Usar `MaterialPropertyBlock` para modificar colores o parámetros dinámicos sin duplicar materiales en VRAM.

## 6. Arquitectura ECS y DOTS (Data-Oriented Technology Stack)
- **Archetypes y Chunk Memory**: Para simulaciones masivas (hordas, proyectiles, boids), migrar de GameObjects a entidades de Unity Entities (DOTS). Las entidades agrupan componentes en chunks continuos de 16 KB organizados por arquetipo.
- **Componentes `IComponentData` Blittables**: Los componentes deben ser `struct` blittables sin tipos por referencia (sin clases, `string` ni arrays de C#) para garantizar máxima localidad en las líneas de caché L1/L2/L3 del procesador.
- **`ISystem` con Burst Compiler**: Implementar la lógica de simulación mediante `ISystem` (`[BurstCompile]`) en structs en lugar de `SystemBase`. El compilador Burst vectoriza las instrucciones SIMD y asegura ejecución con cero recolección de basura (Zero-GC).

## 7. Interfaz de Usuario: UI Toolkit vs UGUI
- **Adopción de UI Toolkit**: Priorizar UI Toolkit (`UnityEngine.UIElements`) sobre Canvas/UGUI para nuevos desarrollos e interfaces de usuario complejas. Elimina el coste de recalcular jerarquías de transformación en el árbol de GameObjects.
- **Separación UXML / USS**: Separar estrictamente la jerarquía visual (estructurada en documentos declarativos `.uxml`) de las reglas de diseño y estilos (declaradas en hojas de estilo `.uss`), facilitando el mantenimiento y permitiendo reutilizar estilos tanto en el runtime del juego como en herramientas personalizadas de editor.

## 8. Sistema de Audio y Mezcla
- **Ruteo Jerárquico en AudioMixer**: Enrutar todas las fuentes `AudioSource` a través de grupos del `AudioMixer` principal (*Master*, *BGM*, *SFX*, *Ambience*). Permite crear Snapshots dinámicos (efecto de ensordecimiento en explosiones, pausar música) y aplicar ducking automático.
- **Audio Espacial 3D**: Configurar el "Spatial Blend" en 1.0 para emisores tridimensionales con curva de atenuación logarítmica ajustada a distancias lógicas del juego.
- **Sound Banks y Streaming**: Configurar clips extensos con compresión adecuada (Vorbis) y modo "Streaming" o "Compressed in Memory" para no sobrecargar la RAM del sistema.
