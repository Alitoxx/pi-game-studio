# Unreal Engine Mejores Prácticas (5.4 / 5.5+)

Arquitectura de producción, patrones de ingeniería y directrices de rendimiento para Unreal Engine 5.

---

## 1. División C++ vs Blueprints
- **C++ como Núcleo**: Implementar en C++ las clases base (`ACharacter`, `APlayerController`), la lógica de sistemas de juego pesados, los algoritmos matemáticos intensivos, las estructuras de datos y el código de replicación de red.
- **Blueprints como Capa de Configuración**: Restringir el uso de Blueprints a la asignación de assets visuales/sonoros, afinado de valores expuestos (`UPROPERTY(EditDefaultsOnly)`), animaciones y eventos de disparo superficiales. Evitar lógica compleja en el *Event Graph* de Blueprint para prevenir problemas de mantenimiento y sobrecoste de CPU.

## 2. Gameplay Ability System (GAS)
- **Integración Temprana**: Para títulos con combate, habilidades activas/pasivas, estados o estadísticas (RPG, MOBA, Shooters tácticos), adoptar GAS desde la base arquitectónica.
- **AbilitySystemComponent (ASC)**: Adherir el ASC al `APlayerState` en juegos multijugador para que las habilidades y atributos persistan a través de respawns o cambios de Pawn.
- **GameplayTags**: Reemplazar variables booleanas y enumeraciones frágiles con etiquetas jerárquicas declarativas (ej: `State.Debuff.Stun`, `Ability.Melee.HeavyAttack`, `Status.Dead`).
- **AttributeSets y GameplayEffects**:
  - Definir atributos numéricos (`Health`, `Mana`, `Shield`, `MovementSpeed`) dentro de subclases de `UAttributeSet`.
  - Modificar atributos exclusivamente a través de `GameplayEffects` (instantáneos, de duración definida o periódicos) para garantizar predicción y replicación determinista en el servidor.

## 3. Enhanced Input y Contextos Dinámicos
- Utilizar el framework de **Enhanced Input** (`UInputMappingContext` e `UInputAction`).
- Activar y desactivar contextos de entrada de forma dinámica según el estado del jugador (`IMC_Default`, `IMC_Vehicle`, `IMC_MenuUI`). Esto garantiza que los inputs se procesen limpiamente sin cadenas de condicionales en el código del personaje.

## 4. Subsystems vs Managers Monolíticos
- Reemplazar Singletons globales o actores managers dependientes del nivel por **Subsystems** nativos (`UGameInstanceSubsystem`, `ULocalPlayerSubsystem`, `UWorldSubsystem`, `UEngineSubsystem`).
- Los Subsystems gestionan su propio ciclo de vida automáticamente junto con el contexto del motor, reducen el acoplamiento y son inmediatamente accesibles tanto desde C++ como desde Blueprints.

## 5. Renderizado: Nanite, Lumen y Niagara
- **Directrices de Nanite**: Activar Nanite en todas las mallas estáticas opacas y geometría masiva. Elimina la necesidad de generar LODs manuales y erradica el efecto pop-in de nivel de detalle. Evitar Nanite en geometrías con materiales translúcidos complejos o deformación de vértices por World Position Offset agresivo.
- **Lumen GI y Reflejos**: Lumen proporciona iluminación global dinámica en tiempo real. En hardware de gama media/baja o consolas portátiles, calibrar las configuraciones de escalabilidad o alternar a Screen Space Reflections (SSR) y Static Lighting según sea necesario.
- **Niagara VFX**: Utilizar exclusivamente Niagara para efectos visuales, descartando el sistema Cascade obsoleto. Priorizar emisores que ejecuten simulaciones en GPU para enjambres masivos de partículas y diseñar emisores modulares que compartan parámetros globales del juego.

## 6. Replicación en Red y Multijugador
- **Movimiento Server-Authoritative**: Utilizar `CharacterMovementComponent` para manejar automáticamente la predicción del cliente, interpolación y corrección autoritativa del servidor en el movimiento.
- **Replicación Eficiente con FastArraySerializer**: Para sincronizar listas o inventarios de items dinámicos por la red, estructurarlos con el patrón `FFastArraySerializer` en lugar de replicar un `TArray<FItem>` estándar; esto previene el reenvío completo de la lista cada vez que cambia un único elemento.
- **Buenas Prácticas de RPCs**:
  - Emplear RPCs `Server` con validación obligatoria (`WithValidation`) para transmitir únicamente las intenciones del jugador, jamás los resultados directos.
  - Minimizar el uso de `NetMulticast` (restringirlos a efectos cosméticos inmediatos que no afecten el estado del juego).
  - Preferir variables replicadas con `RepNotify` para asegurar que clientes con conexiones tardías reciban siempre el estado final correcto.

## 7. Interfaz de Usuario con CommonUI
- **CommonUI sobre UMG Estándar**: Utilizar el plugin `CommonUI` para interfaces profesionales. Resuelve nativamente la navegación con cruceta/gamepad en consolas, el historial de retroceso (*Back button navigation*) y la alternancia dinámica de iconos según el dispositivo de entrada.
- **Enrutamiento de Foco (Input Routing)**: Diseñar menús sobre widgets activables (`UCommonActivatableWidget`). Esto garantiza que la ventana modal superior capture el foco de entrada de forma exclusiva y previene el bug clásico de "foco robado" por elementos secundarios.
- **Data Assets para Estilizado**: Centralizar tipografías, colores, bordes y estilos de botones en Data Assets dedicados para aplicar cambios temáticos masivos a toda la UI sin tener que editar manualmente cada widget.
