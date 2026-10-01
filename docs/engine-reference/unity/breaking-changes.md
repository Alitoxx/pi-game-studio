# Unity Breaking Changes

## Legacy Input vs New Input System
- El viejo sistema de input (`Input.GetAxis`, `Input.GetKeyDown`) está obsoleto. La transición al paquete Input System requiere suscribirse a eventos de C# generados por los Action Maps.

## Built-in Pipeline vs URP
- El pipeline por defecto es URP (Universal Render Pipeline). Los shaders antiguos y materiales estándar no son compatibles sin un proceso de actualización, y el scripteo de rendering cambia de OnRenderImage a Render Features.

## Mono a CoreCLR / .NET Standard
- Unity 6000.x / recientes versiones avanzan hacia perfiles de .NET más modernos. Algunos paquetes y librerías antiguas dependientes de implementaciones Mono descontinuadas pueden fallar.
