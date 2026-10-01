# Unreal Engine - Rendering

## Nanite Mesh Guidelines
- Habilitar Nanite en todas las mallas estáticas opacas y masivas para eliminar el costo de overdraw y pop-in de LODs. No usar para materiales con alta transparencia.

## Lumen GI / Reflections
- Sistema dinámico de iluminación global. Es costoso; ajustar la calidad o proveer fallbacks a screen space reflections (SSR) si el rendimiento en consola/hardware menor no es el adecuado.

## Niagara VFX
- Sustituto total de Cascade. Utilizar simulación en GPU para enjambres masivos de partículas y crear emisores modulares que compartan parámetros globales.
