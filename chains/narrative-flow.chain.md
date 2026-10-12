---
name: narrative-flow
description: Pipeline de diseño narrativo, escritura de diálogos interactivos y preparación para localización internacional.
---

> Cadena multi-agente para arcos narrativos, ramificaciones de diálogo y catálogo de localización.

## creative-director

reads: design/gdd/{quest}.md
output: docs/narrative/{quest}-beat-sheet.md
outputMode: file-only
progress: true

Estructura el arco dramático, motivaciones de personajes, tono, puntos de inflexión y bifurcaciones clave de la trama en `{quest}` asegurando la coherencia con los pilares del juego.

## game-designer

reads: docs/narrative/{quest}-beat-sheet.md
output: docs/narrative/{quest}-dialogue-script.md
outputMode: file-only
progress: true

Redacta los árboles de diálogo interactivos, líneas de reacción (barks), descripciones de misiones y entradas de códice para `{quest}`, asignando IDs de texto únicos para cada cadena vinculada al gameplay.

## producer

reads: docs/narrative/{quest}-dialogue-script.md
output: docs/narrative/{quest}-i18n-catalog.md
outputMode: file-only
progress: true

Estructura el catálogo de cadenas de internacionalización (i18n), revisa la densidad textual para evitar desbordes en UI y consolida los activos de texto para traducción en `{quest}`.
