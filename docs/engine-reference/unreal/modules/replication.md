# Unreal Engine - Replication

## Movimiento Server-Authoritative
- Utilizar `CharacterMovementComponent` para manejar predicciones cliente y correcciones desde el servidor, evitando implementar sincronización de físicas desde cero.

## FastArraySerializer
- Para replicar arrays de structs grandes eficientemente (ej: inventario dinámico), implementar el patrón `FastArraySerializer` en lugar de una replicación ingenua por defecto que consumiría mucho ancho de banda.

## RPC Best Practices
- Usar `Server` RPC para validar intenciones de cliente (con la macro de Validation).
- Usar `NetMulticast` con cuidado (generalmente efectos visuales/sonido), preferir usar `RepNotify` con variables replicadas para asegurar un estado final consistente al conectarse tardíamente.
