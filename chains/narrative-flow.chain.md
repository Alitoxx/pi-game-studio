---
name: narrative-flow
description: Pipeline de diseño narrativo, escritura de diálogos interactivos, catálogo de i18n y auditoría de scope de localización.
---

> Cadena multi-agente para arcos narrativos, ramificaciones de diálogo, catálogo de localización y control de scope.

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

## game-designer

reads: docs/narrative/{quest}-dialogue-script.md
output: docs/narrative/{quest}-i18n-catalog.md
outputMode: file-only
progress: true

Extrae y estructura el catálogo de cadenas de internacionalización (i18n) a partir del guion de `{quest}`, definiendo las claves de traducción (`LOC_*`), variables contextuales y límites de caracteres por UI para todas las cadenas de mecánicas y narrativa.

## producer

reads: docs/narrative/{quest}-i18n-catalog.md
output: docs/narrative/{quest}-localization-scope.md
outputMode: file-only
progress: true

Audita el volumen de palabras, costo de traducción y viabilidad de calendario para la localización de `{quest}`. Emite el veredicto formal de Localization Scope & Budget Gate (`[PR-SCOPE]: REALISTIC` o `[PR-SCOPE]: CONCERNS`) respetando el principio de que el Producer no genera activos de contenido directamente.
