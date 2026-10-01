# Unity - Audio

## AudioMixer y Grupos
- Rutear los `AudioSource` a grupos de un `AudioMixer` maestro. Permite manejar el volumen y efectos globales fácilmente, permitiendo "ducking" o snapshots por escenas.

## Audio Espacial
- Configurar correctamente la atenuación (Rolloff) a modo logarítmico para resultados realistas. Asegurarse de que "Spatial Blend" esté en 1 para fuentes de sonido en 3D pleno.

## Sound Banks
- Si se requiere mayor control, evaluar middlewares (FMOD, Wwise) que manejan agrupaciones avanzadas en Sound Banks, o usar Addressables para gestionar los clips de audio base y cargarlos on-demand.
