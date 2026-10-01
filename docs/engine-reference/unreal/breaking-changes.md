# Unreal Engine Breaking Changes

## Chaos Physics
- PhysX fue reemplazado totalmente por Chaos. Existen cambios significativos en el comportamiento de simulación y vehículos.

## Requisitos de Hardware para Lumen y Nanite
- Con UE5+, estas funciones requieren hardware moderno (SM6). Para soporte de plataformas más débiles, se requiere un fallback explícito al sistema de rendering clásico (LODs convencionales, lightmaps horneados).

## Enhanced Input Transition
- Los mapeos Legacy Axis/Action están obsoletos y generan warnings. Los proyectos deben migrarse al Enhanced Input Plugin creando Input Actions y Contextos.
