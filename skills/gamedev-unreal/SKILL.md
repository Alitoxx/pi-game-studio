---
name: gamedev-unreal
description: "Trigger: Unreal Engine, UE5, .uproject, .Build.cs, UCLASS, UPROPERTY, TObjectPtr, Actor, Pawn, Gameplay Ability System, GAS, Enhanced Input. Idiomatic Unreal Engine 5 C++ engineering."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in an Unreal Engine 5 project (`*.uproject`, `Source/*/*.Build.cs`, UE5 C++ headers and source files).

## Hard Rules

- **Strict UObject Garbage Collection Safety**:
  - Never store raw `UObject*` or `AActor*` member pointers without `UPROPERTY()`.
  - Use `TObjectPtr<T>` for owning/hard member references (`UPROPERTY(EditAnywhere, BlueprintReadOnly) TObjectPtr<UInputAction> MoveAction;`) and `TWeakObjectPtr<T>` for non-owning cached pointers, checking `.IsValid()` before dereferencing.
  - Use `TSoftObjectPtr<T>` and `TSoftClassPtr<T>` with async streaming (`FStreamableManager`) in data tables/configs to avoid synchronous hitching.
- **Tick Suppression by Default**: Set `PrimaryActorTick.bCanEverTick = false` in `AActor` and `UActorComponent` constructors unless continuous per-frame integration is strictly required; prefer `FTimerManager`, delegates, and timelines.
- **Enhanced Input Contract**: Register `TObjectPtr<UInputMappingContext>` via `UEnhancedInputLocalPlayerSubsystem` and bind `TObjectPtr<UInputAction>` inside `SetupPlayerInputComponent` by casting `PlayerInputComponent` to `UEnhancedInputComponent` (`BindAction(Action, ETriggerEvent::Triggered, this, &ThisClass::Handler)`).
- **C++ Foundation & GAS**: Implement core math, movement, and hot loops in C++, exposing tuning fields via `UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Config")`. For complex combat/RPG rules, use **Gameplay Ability System (GAS)** (`UGameplayAbility`, `UAttributeSet`, `UGameplayEffect`, `FGameplayTag`).

## Decision Gates

| Situation | Action |
| --- | --- |
| Storing a reference to a dynamically spawned Actor or UI widget | Use `TWeakObjectPtr<T>` and validate with `.IsValid()` |
| Referencing heavy meshes, sounds, or particle systems in DataAssets | Use `TSoftObjectPtr<T>` and load asynchronously |
| Periodic logic (cooldowns, AI perception checks, regeneration) | Use `GetWorldTimerManager().SetTimer(...)` with `bCanEverTick = false` |
| Networked multiplayer state change | Mutate state on server (`HasAuthority()`) and replicate via `UPROPERTY(ReplicatedUsing = OnRep_...)` |

## Execution Steps

1. Inspect `*.uproject` and `*.Build.cs` modules (ensuring `EnhancedInput`, `GameplayAbilities`, `GameplayTags`, or `Niagara` are listed when used).
2. Implement headers (`.h`) and source (`.cpp`) with forward declarations in headers, `TObjectPtr` properties, and suppressed actor ticks.
3. Verify compilation via UnrealBuildTool and headless automation tests when the engine CLI is available.

## Output Contract

Return:
- Modified `.h`, `.cpp`, and `.Build.cs` files.
- Build/automation verification command and output.
- Confirmation of `UPROPERTY`/`TObjectPtr` GC safety and tick discipline.
