---
name: narrative-flow
description: Pipeline de diseño narrativo, escritura de diálogos interactivos y preparación para localización internacional.
---

> Cadena multi-agente para arcos narrativos, ramificaciones de diálogo y catálogo de localización.

## narrative-director

reads: design/gdd/{quest}.md
output: docs/narrative/{quest}-beat-sheet.md
outputMode: file-only
progress: true

Estructura el arco dramático, motivaciones de personajes, tono, puntos de inflexión y bifurcaciones clave de la trama en `{quest}`.

## writer

reads: docs/narrative/{quest}-beat-sheet.md
output: docs/narrative/{quest}-dialogue-script.md
outputMode: file-only
progress: true

Redacta los árboles de diálogo, líneas de reacción (barks), descripciones de misiones y entradas de códice para `{quest}`, asignando IDs de texto únicos para cada cadena.

## localization-lead

reads: docs/narrative/{quest}-dialogue-script.md
output: docs/narrative/{quest}-i18n-catalog.md
outputMode: file-only
progress: true

Estructura las claves de internacionalización (i18n), detecta variables gramaticales/género, verifica restricciones de espacio en UI y congela el catálogo de cadenas a traducir para `{quest}`.
