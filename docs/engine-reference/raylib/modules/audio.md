# Raylib - Audio

## InitAudioDevice
- Es obligatorio inicializar el dispositivo de audio con `InitAudioDevice()` antes de cargar o reproducir cualquier sonido o música, y cerrarlo con `CloseAudioDevice()` al salir.

## Music Streams
- La música grande o en streaming debe ser cargada con `LoadMusicStream()` en lugar de cargarse toda en memoria. Requiere llamar periódicamente a `UpdateMusicStream()` en el game loop para rellenar los buffers.

## Sound Pooling
- Para efectos de sonido repetitivos, cargar con `LoadSound()` y manejar la reproducción secuencial o simultánea. Se puede crear un pool manual si se requiere controlar el tono, volumen o paneo independiente para múltiples instancias concurrentes.
