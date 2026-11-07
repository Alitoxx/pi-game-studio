---
name: gamedev-unreal
description: "Trigger: Unreal Engine, UE5, .uproject, .Build.cs, UCLASS, UPROPERTY, TObjectPtr, Actor, Pawn, Gameplay Ability System, GAS, Enhanced Input. Idiomatic Unreal Engine 5 C++ engineering."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in an Unreal Engine 5 project (`*.uproject`, `Source/*/*.Build.cs`, UE5 C++ headers and source files).

## Hard Rules

- **Banned UE5 C++ Traps**:
  - In every header with `UCLASS()`, `USTRUCT()`, or `UENUM()`, `#include "FileName.generated.h"` **MUST be the very last `#include`** in the file (placing any `#include` after `.generated.h` breaks UnrealHeaderTool immediately).
  - Never call `NewObject<T>()` or `GetWorld()` inside a class constructor -> Use `CreateDefaultSubobject<T>(TEXT("Name"))` in constructors, and `NewObject<T>()` / `GetWorld()->SpawnActor<T>()` only at runtime (`BeginPlay` onward).
  - Never store raw `UObject*` or `AActor*` member pointers without `UPROPERTY()` (causes dangling pointer crashes on Garbage Collection).
- **Strict Smart Pointer & Asset Discipline**:
  - Use `UPROPERTY() TObjectPtr<T>` for hard member references, and `TWeakObjectPtr<T>` (checked via `.IsValid()`) for non-owning cached pointers (targets, UI widgets).
  - Use `TSoftObjectPtr<T>` and `TSoftClassPtr<T>` with async streaming (`FStreamableManager`) in DataAssets/DataTables so referencing heavy meshes/sounds never blocks startup.
  - Forward-declare classes (`class UInputAction;`) in `.h` files instead of including heavy headers.
- **Tick Suppression, Enhanced Input & GAS**:
  - Set `PrimaryActorTick.bCanEverTick = false` by default; use `FTimerManager`, delegates, or timelines unless continuous per-frame math is mandatory.
  - Bind input exclusively through **Enhanced Input** (`UEnhancedInputLocalPlayerSubsystem`, `UEnhancedInputComponent::BindAction`).
  - Use **Gameplay Ability System (GAS)** (`UGameplayAbility`, `UAttributeSet`, `UGameplayEffect`, `FGameplayTag`) for action/RPG combat and attributes.

## Decision Gates

| Situation | Action |
| --- | --- |
| Adding a new `#include` to a UE5 `.h` file | Prefer forward declaration (`class UMyClass;`); if an include is required, place it **above** `#include "*.generated.h"` |
| Constructing child components in `AActor` constructor | Use `CreateDefaultSubobject<T>(TEXT("..."))` and attach with `SetupAttachment(RootComponent)` |
| Storing a reference to a dynamically spawned Actor or UI widget | Use `TWeakObjectPtr<T>` and validate with `.IsValid()` |
| Networked multiplayer state change | Mutate state on server (`HasAuthority()`) and replicate via `UPROPERTY(ReplicatedUsing = OnRep_...)` |

## Execution Steps

1. Inspect `*.uproject` and `*.Build.cs` modules (ensuring `EnhancedInput`, `GameplayAbilities`, `GameplayTags`, or `Niagara` are listed in `PublicDependencyModuleNames` when used).
2. Implement headers (`.h`) with forward declarations and `.generated.h` last, and source (`.cpp`) with `TObjectPtr` properties and suppressed ticks.
3. Verify compilation via UnrealBuildTool and headless automation tests when the engine CLI is available.

## Output Contract

Return:
- Modified `.h`, `.cpp`, and `.Build.cs` files.
- Build/automation verification command and output.
- Confirmation of `.generated.h` ordering, `UPROPERTY`/`TObjectPtr` GC safety, and tick discipline.
