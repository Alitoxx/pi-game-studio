---
name: perf-audit
description: Pipeline de análisis de rendimiento, perfilado de frame-time, optimización de motor y ajuste de assets.
---

> Cadena multi-agente para auditoría de cuello de botella de rendimiento, CPU, memoria y GPU.

## performance-analyst

reads: docs/perf/{target}-telemetry.md
output: docs/perf/{target}-perf-diagnostic.md
outputMode: file-only
progress: true

Analiza frame times, percentiles 1% / 0.1% low, conteo de draw calls, recolecciones de basura (GC) y consumo de VRAM/RAM para `{target}`, localizando el subsistema responsable del pico.

## engine-programmer

reads: docs/perf/{target}-perf-diagnostic.md
output: docs/perf/{target}-engine-optimizations.md
outputMode: file-only
progress: true

Diseña y aplica optimizaciones en código de bajo nivel: iteraciones de sistemas ECS, paralelización de tareas en hilos de trabajo, layouts de datos cache-friendly y mitigación de asignaciones dinámicas en `{target}`.

## technical-artist

reads: docs/perf/{target}-perf-diagnostic.md+docs/perf/{target}-engine-optimizations.md
output: docs/perf/{target}-asset-budget-adjustments.md
outputMode: file-only
progress: true

Optimiza shaders de fragmentos, compresión de texturas, batched mesh rendering, niveles de detalle de geometría (LODs) y oclusión de cámaras para que `{target}` cumpla con la tasa objetivo de 60/120 FPS.
