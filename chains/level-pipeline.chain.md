---
name: level-pipeline
description: Pipeline de diseño, grayboxing, ambientación visual y validación de jugabilidad para niveles y entornos.
---

> Cadena multi-agente para concepción, prototipado, arte técnico y control de calidad en diseño de niveles.

## game-designer

reads: design/gdd/{level}.md
output: docs/levels/{level}-encounter-spec.md
outputMode: file-only
progress: true

Define los objetivos de juego, ritmo de encuentros, curvas de tensión, mecánicas requeridas, colocación de recompensas y puntos de interés para `{level}`.

## level-designer

reads: docs/levels/{level}-encounter-spec.md
output: docs/levels/{level}-blockout-guide.md
outputMode: file-only
progress: true

Diseña la geometría de graybox, líneas de visión, rutas principales y secundarias, zonas de cobertura, pacing espacial y métricas de navegación para `{level}`.

## technical-artist

reads: docs/levels/{level}-blockout-guide.md
output: docs/levels/{level}-techart-budget.md
outputMode: file-only
progress: true

Audita y especifica el presupuesto de draw calls, iluminación estática/dinámica, mallas de colisión, niveles de detalle (LODs), materiales y oclusión ambiental en `{level}`.

## qa-tester

reads: docs/levels/{level}-blockout-guide.md+docs/levels/{level}-techart-budget.md
output: docs/levels/{level}-qa-report.md
outputMode: file-only
progress: true

Valida colisiones, zonas fuera de límites, problemas de navegación/NavMesh, atascos de jugador y consistencia visual en el entorno de `{level}`.
