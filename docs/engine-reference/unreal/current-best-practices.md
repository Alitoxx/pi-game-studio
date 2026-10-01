# Unreal Engine Mejores Prácticas (5.4+)

## Gameplay Ability System (GAS)
- Para juegos con múltiples habilidades o atributos (RPG, MOBA, Hero Shooters), integrar GAS de manera temprana provee robustez sobre el manejo y replicación del estado.

## Enhanced Input Actions & Contexts
- Configurar Input Mapping Contexts según el estado del jugador (ej: "A pie", "Vehículo", "Menú") y activarlos dinámicamente, asegurando respuestas limpias sin excesos condicionales.

## Subsystems
- Usar GameInstance, LocalPlayer, World, o Engine Subsystems en lugar de Singletons globales o managers atados a GameMode o PlayerController para sistemas desacoplados y fácilmente accesibles.

## Blueprint vs C++ Division
- Usar C++ para definir las clases base, lógica pesada de sistemas, estructuras de datos, y replicación de red compleja.
- Usar Blueprints exclusivamente para configuración visual, referencias de assets y pequeñas uniones de alto nivel.
