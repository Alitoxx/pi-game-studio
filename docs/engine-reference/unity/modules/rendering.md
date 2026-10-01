# Unity - Rendering

## URP Render Passes
- Extender el pipeline usando `ScriptableRendererFeature` y custom `ScriptableRenderPass` para inyectar lógica de renderizado propia en etapas específicas (ej: después de los opacos).

## Shader Graph
- Utilizar Shader Graph para la creación visual de materiales en URP, lo que asegura compatibilidad y optimización en diferentes plataformas sin escribir código HLSL manualmente.

## MaterialPropertyBlocks
- Usar `MaterialPropertyBlock` en vez de modificar `renderer.material` o `renderer.sharedMaterial` para instanciar propiedades de manera eficiente y no romper el SRP Batcher innecesariamente.
