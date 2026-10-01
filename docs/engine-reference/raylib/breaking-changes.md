# Raylib Breaking Changes

## Cambios de Raylib 4 a 5
- Mejoras en la API de RLGL y modularización.
- Reestructuración de ciertas funciones matemáticas y de vector, que ahora utilizan la biblioteca `raymath`.
- Se requiere mayor control sobre las inicializaciones dependientes del estado global de la ventana antes de usar módulos específicos.

## Audio Device Changes
- La gestión de callbacks de audio y streams requiere configuración explícita, y la manera en la que los buffers se actualizan ha sido estandarizada en la nueva versión mayor.
