# Unity - ECS (DOTS)

## Fundamentos del Paquete Entities
- Unity DOTS se basa en separar memoria de lógica mediante `Archetypes`. No se usan GameObjects en simulación de alto rendimiento.

## IComponentData
- Los componentes deben ser structs blittables que implementen `IComponentData`. No deben contener tipos por referencia (clases) para asegurar un uso eficiente del caché en la CPU.

## SystemBase e ISystem
- `SystemBase` es útil para lógica orientada a objetos manejada, pero `ISystem` en conjunto con el Burst Compiler provee un desempeño óptimo sin recolección de basura, utilizando structs para definir los sistemas.
