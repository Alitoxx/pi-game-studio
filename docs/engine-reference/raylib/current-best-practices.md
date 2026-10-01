# Raylib Mejores Prácticas (Raylib 5.0 + EnTT / Modern C++)

## Gestión de Memoria y Texturas
- Utilizar el patrón RAII para envolver recursos de C en C++.
- Asegurar la descarga de texturas (`UnloadTexture`) dentro de los destructores.

## EnTT Registry Views vs Groups
- Usar Views (`registry.view<A, B>()`) para iteración general, son seguras y no alteran el orden en memoria.
- Usar Groups cuando el rendimiento es sumamente crítico y los componentes se leen siempre juntos, asegurando su localidad de memoria estricta.

## Bucles de Juego Zero-Alloc
- Evitar asignaciones dinámicas (new/malloc) o el uso de std::vector de tamaño dinámico durante el game loop `UpdateDrawFrame`. Preasignar los búferes y recursos antes de iniciar el loop.
