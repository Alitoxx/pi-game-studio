# Raylib - ECS

## EnTT y Ciclo de Vida
- Crear entidades con `registry.create()` y destruirlas con `registry.destroy()`. Evitar mantener handles a entidades que puedan ser destruidas; es mejor usar patrones robustos (ej: identificadores generacionales).

## Component Registries
- Almacenar los componentes en structs planos (POD) que agrupan los datos. Separar la lógica en "Sistemas" (funciones) que iteran sobre las entidades que tienen dichos componentes.

## Spatial Partitions
- Integrar grids espaciales o Quadtrees como Sistemas y Componentes auxiliares para acelerar las colisiones, dado que EnTT maneja de manera muy rápida los componentes pero carece de un sistema espacial inherente.
