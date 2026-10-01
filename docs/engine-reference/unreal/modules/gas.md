# Unreal Engine - GAS (Gameplay Ability System)

## AbilitySystemComponent
- Componente principal que debe ser adherido al Actor (Pawn o PlayerState). Gestiona el ciclo de vida de las habilidades y atributos en la red.

## GameplayTags
- Identificadores jerárquicos y livianos que reemplazan variables booleanas complejas (ej: `State.Debuff.Stun`, `Action.Attack`).

## GameplayEffects y AttributeSets
- Usar `AttributeSet` para definir salud, maná, armadura. 
- Usar `GameplayEffects` generados en tiempo de ejecución o basados en clases para alterar esos atributos (daño inmediato, curación en el tiempo).
