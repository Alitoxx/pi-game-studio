---
name: gamedev-unreal
description: "Unreal Engine 5 (C++ & Blueprints) game development for Gentle Shell. Trigger: Unreal Engine, UE5, .uproject, UCLASS, UPROPERTY, Actor, Pawn, Gameplay Ability System (GAS), Enhanced Input."
---

# Unreal Engine 5 (C++) Game Engineering

Apply these standards whenever working in an Unreal Engine 5 project (`*.uproject`, `Source/`).

## 1. C++ / Blueprint Boundary & Memory Safety

- **C++ Foundation, Blueprint Configuration**: Implement core gameplay logic, movement math, state machines, and performance-critical loops in C++. Expose tuning properties and asset references to Blueprints via `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Config")`.
- **Strict UObject Garbage Collection Safety**: Never store raw `UObject*` or `AActor*` member pointers without `UPROPERTY()`. Use `TObjectPtr<T>` for member references and `TWeakObjectPtr<T>` for non-owning cached pointers (such as target locks or UI references), checking `.IsValid()` before dereferencing.
- **Soft References for Assets**: Use `TSoftObjectPtr<T>` and `TSoftClassPtr<T>` with async loading (`FStreamableManager`) in data tables and configs so referencing an asset does not load the entire dependency chain into memory at startup.

## 2. Tick Discipline, Input & GAS

- **Tick Suppression by Default**: Set `PrimaryActorTick.bCanEverTick = false` in every `AActor` and `UActorComponent` constructor unless continuous per-frame math is strictly required. Prefer timers (`GetWorldTimerManager()`), delegates, and timeline curves over ticking actors.
- **Enhanced Input**: Bind controls exclusively through **Enhanced Input** (`UInputAction`, `UInputMappingContext`) in `SetupPlayerInputComponent`, never legacy hardcoded axis/action strings.
- **Gameplay Ability System (GAS)**: For action/RPG combat, model abilities with `UGameplayAbility`, stats with `UAttributeSet`, and buffs/cooldowns/damage with `UGameplayEffect` and `FGameplayTag` hierarchies rather than ad-hoc boolean flags.
- **Network Replication**: Perform authoritative gameplay mutations on the server (`HasAuthority()`), use `UPROPERTY(ReplicatedUsing = OnRep_...)` for state sync, and use unreliable RPCs only for cosmetic events.

## 3. Build & Verification

- **Compile & Automation Tests**: Verify C++ builds via UnrealBuildTool (`Build.bat` / `Build.sh <Project>Editor <Platform> Development`) and run headless automation specs via `UnrealEditor-Cmd <Project>.uproject -ExecCmds="Automation RunTests <Project>;Quit" -NullRHI -Unattended`.
