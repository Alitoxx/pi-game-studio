# Roadmap de Producción — LINDE

<!-- PRODUCER_STATE -->
Juego: LINDE (título provisional)
Motor: Bevy (Rust)
Hito Actual: M0 — Visión
Sprint Activo: Sprint 0
Última Tarea Completada: Visión v2 cerrada — formato Desktop Companion, motor ticks+pulsaciones, 5 pilares (design/gdd/concept.md)
En Progreso: Nada
Siguiente Paso: Spike técnico — overlay de franja de escritorio en Bevy (sin robo de foco, click-through, CPU en reposo)
Actualizado: 2026-10-11T02:07:09.125Z
<!-- /PRODUCER_STATE -->

## Hitos del Proyecto

### M0 — Visión
- [x] Investigación de mercado y selección de nicho (Colony Sim, hit rate 13,7%)
- [x] Investigación de la categoría Desktop Companion (design/gdd/market-research.md)
- [x] Visión v2: formato Desktop Companion, 5 pilares, 5 anti-pilares, ancla visual
- [ ] Confirmar título definitivo

### M1 — Viabilidad Técnica (SPIKE)
- [ ] Spike: ventana franja siempre visible y click-through en Bevy (Windows)
- [ ] Spike: no robo de foco de la ventana activa (WS_EX_NOACTIVATE)
- [ ] Spike: medición de CPU en reposo — objetivo < 2%
- [ ] Veredicto técnico: ¿el formato es viable? Si no, revisión de Visión

### M2 — Spec del bucle de expedición
- [ ] Live Spec: design/gdd/expedition-loop.md
- [ ] Live Spec: recursos y construcción del asentamiento
- [ ] Systems index

### M3 — Prototipo Jugable
- [ ] Scaffold Bevy 2D + debug overlay (F3) + contador de CPU
- [ ] Primera expedición jugable end-to-end en la franja
- [ ] Prueba de 8 horas abierto: ¿molesta? ¿consume? ¿se entiende?
