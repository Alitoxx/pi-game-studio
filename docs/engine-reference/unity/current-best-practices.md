# Unity Mejores Prácticas (2022.3 LTS / 6000.x)

## Input System y Action Maps
- Utilizar el nuevo Input System y definir `Action Maps` para separar lógicas (ej: "Gameplay", "UI"). Esto facilita remapear teclas y manejar múltiples dispositivos.

## Addressables vs Resources
- Evitar por completo la carpeta `Resources`. Usar el sistema de Addressables para la carga asíncrona de recursos, lo que optimiza la memoria y simplifica el empaquetado de DLCs y parches.

## Arquitecturas basadas en ScriptableObjects
- Usar `ScriptableObjects` para almacenar datos inmutables y para crear un sistema de eventos desacoplado o variables compartidas entre sistemas (arquitectura tipo Ryan Hipple).

## Zero-GC Physics Queries
- Emplear métodos como `Physics.RaycastNonAlloc` o `Physics.OverlapSphereNonAlloc` en lugar de aquellos que devuelven arreglos, para evitar generar basura (Garbage Collection) en el game loop.
