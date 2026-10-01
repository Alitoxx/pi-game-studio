---
name: audio-production
description: Pipeline de diseño e integración de audio desde el concepto sonoro hasta la mezcla e implementación en código.
---

> Cadena multi-agente para producción, diseño sonoro e integración interactiva de audio.

## audio-director

reads: design/gdd/{feature}.md
output: docs/audio/{feature}-audio-spec.md
outputMode: file-only
progress: true

Define la visión sonora, paleta acústica, rangos dinámicos y requerimientos de música y efectos para `{feature}` conforme a los pilares artísticos del proyecto.

## sound-designer

reads: docs/audio/{feature}-audio-spec.md
output: docs/audio/{feature}-foley-sheet.md
outputMode: file-only
progress: true

Diseña y especifica la lista de activos sonoros (Foley, SFX, transiciones, loops ambientales), frecuencias, capas de variación y parámetros de pitch/volumen para evitar fatiga auditiva en `{feature}`.

## gameplay-programmer

reads: docs/audio/{feature}-foley-sheet.md
output: docs/audio/{feature}-implementation-plan.md
outputMode: file-only
progress: true

Define la integración técnica en motor: buses de audio, triggers de animación, pooling de AudioStreams, atenuación espacial 2D/3D y vinculación con la lógica de eventos de `{feature}`.
