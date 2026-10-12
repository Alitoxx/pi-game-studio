---
name: level-pipeline
description: Pipeline de diseño, grayboxing, ambientación visual y validación de jugabilidad para niveles y entornos.
---

> Cadena multi-agente para concepción, prototipado, arte técnico y control de calidad en diseño de niveles.

## creative-director

reads: design/gdd/{level}.md
output: docs/levels/{level}-concept-guide.md
outputMode: file-only
progress: true

Define la premisa ambiental, tono, anclas de escala, narrativa ambiental y puntos de interés visual para `{level}` alineados con los pilares del juego.

## game-designer

reads: docs/levels/{level}-concept-guide.md
output: docs/levels/{level}-blockout-guide.md
outputMode: file-only
progress: true

Diseña los objetivos de juego, ritmo de encuentros, geometría graybox, líneas de visión, zonas de cobertura y métricas de movimiento para `{level}`.

## art-director

reads: docs/levels/{level}-blockout-guide.md
output: docs/levels/{level}-art-budget.md
outputMode: file-only
progress: true

Audita y especifica el presupuesto de draw calls, iluminación, paleta cromática, niveles de detalle (LODs), materiales y assets visuales modulares para `{level}`.

## qa-lead

reads: docs/levels/{level}-blockout-guide.md+docs/levels/{level}-art-budget.md
output: docs/levels/{level}-qa-report.md
outputMode: file-only
progress: true

Valida colisiones, zonas fuera de límites, problemas de navegación/NavMesh, atascos de jugador y estabilidad de framerate en el entorno de `{level}`.
