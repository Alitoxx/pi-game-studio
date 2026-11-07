---
name: gamedev-unity
description: "Unity (C#) game development for Gentle Shell. Trigger: Unity, MonoBehaviour, ScriptableObject, .asmdef, URP, HDRP, Unity Input System, Packages/manifest.json."
---

# Unity (C#) Game Engineering

Apply these standards whenever working in a Unity project (`Assets/`, `Packages/manifest.json`).

## 1. Architecture & Data-Driven Systems

- **ScriptableObject Architecture**: Store weapon stats, movement tuning, enemy definitions, and event channels in `ScriptableObject` assets rather than hardcoding magic numbers in `MonoBehaviour` classes.
- **Assembly Definitions (`.asmdef`)**: Partition code into modular assemblies (`Core`, `Gameplay`, `UI`, `Tests`) to enforce clean dependency direction and keep incremental C# compile times under 2 seconds.
- **Lifecycle Discipline**:
  - Cache all component references in `Awake()`.
  - Subscribe to events in `OnEnable()` and always unsubscribe in `OnDisable()`.
  - Read player input in `Update()` and apply `Rigidbody`/`Rigidbody2D` forces or velocity changes in `FixedUpdate()`.

## 2. Zero-Allocation Frame Loop Rules

Eliminate GC spikes in `Update`, `FixedUpdate`, and `LateUpdate`:
- **No `GetComponent` in Frame Loops**: Cache references in `Awake()`, or use `TryGetComponent(out T comp)` on collision events.
- **Non-Allocating Physics Queries**: Always use `Physics.RaycastNonAlloc`, `Physics.OverlapSphereNonAlloc`, or `Physics2D.OverlapCircleNonAlloc` with pre-allocated array buffers.
- **Object Pooling**: Use `UnityEngine.Pool.ObjectPool<T>` for projectiles, damage numbers, audio emitters, and VFX instead of `Instantiate` / `Destroy`.
- **Shader Property IDs**: Cache shader uniform IDs once with `static readonly int HitFlashId = Shader.PropertyToID("_HitFlash")` and use `MaterialPropertyBlock` to avoid duplicating material instances.
- **No LINQ or String Concatenation in Hot Paths**: Use index `for` loops over `List<T>` or arrays, and update UI text only when the underlying value actually changes.

## 3. Input & Verification

- **Input System**: Route controls through the Unity Input System (`.inputactions`) so keyboard, mouse, and gamepad bindings work interchangeably.
- **EditMode & PlayMode Tests**: Place pure C# logic tests in EditMode test assemblies so they verify state machines, inventory, and combat math rapidly without booting full scenes.
