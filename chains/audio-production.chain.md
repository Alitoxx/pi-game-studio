---
name: audio-production
description: Pipeline de diseño e integración de audio desde el concepto sonoro hasta la mezcla e implementación en código.
---

> Cadena multi-agente para producción, diseño sonoro e integración interactiva de audio.

## game-designer

reads: design/gdd/{feature}.md
output: docs/audio/{feature}-audio-requirements.md
outputMode: file-only
progress: true

Define las necesidades de retroalimentación sonora para `{feature}`: eventos que requieren feedback, pistas contextuales, señales de advertencia y balance de volumen relativo al gameplay.

## audio-director

reads: docs/audio/{feature}-audio-requirements.md
output: docs/audio/{feature}-audio-spec.md
outputMode: file-only
progress: true

Define la visión sonora, paleta acústica, rangos dinámicos, especificación de activos de audio (SFX, Foley, loops ambientales, variaciones de pitch) y mapeo de buses de mezcla para `{feature}`.

## gameplay-programmer

reads: docs/audio/{feature}-audio-spec.md
output: docs/audio/{feature}-implementation-plan.md
outputMode: file-only
progress: true

Define la integración técnica en motor: buses de audio, triggers de animación, pooling de AudioStreams, atenuación espacial 2D/3D y vinculación con la lógica de eventos de `{feature}`.
