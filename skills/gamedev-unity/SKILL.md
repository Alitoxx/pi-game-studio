---
name: gamedev-unity
description: "Trigger: Unity, Unity 6, C# game, MonoBehaviour, ScriptableObject, .asmdef, URP, HDRP, Unity Input System, Packages/manifest.json. Zero-allocation Unity C# architecture."
license: MIT
metadata:
  author: Alitoxx
  version: "2.0"
---

## Activation Contract

Activate when working in a Unity project (`Assets/`, `Packages/manifest.json`, `.cs`, `.asmdef`).

## Hard Rules

- **Data-Driven ScriptableObjects & `.asmdef`**: Store stats, movement tuning, and event channels in `ScriptableObject` assets. Partition scripts with Assembly Definitions (`.asmdef`) into `Core`, `Gameplay`, `UI`, and `Tests` to enforce modular boundaries and fast incremental compiles.
- **Unity 6 & Modern API Standards**:
  - Use `Rigidbody.linearVelocity` / `Rigidbody2D.linearVelocity` (instead of deprecated `.velocity`).
  - Use `Object.FindFirstObjectByType<T>()` or `Object.FindObjectsByType<T>(FindObjectsSortMode.None)` in setup code (never in frame loops, and never deprecated `FindObjectOfType`).
  - Prefer `Awaitable` over `Coroutine` allocations for async lifecycle tasks in Unity 6+.
- **Zero-GC Frame Loop (`Update` / `FixedUpdate` / `LateUpdate`)**:
  - Cache component references in `Awake()` and use `TryGetComponent(out T comp)` on collisions—never call `GetComponent<T>()` per frame.
  - Use pre-allocated array buffers with `Physics.RaycastNonAlloc`, `Physics.OverlapSphereNonAlloc`, or `Physics2D.OverlapCircleNonAlloc`.
  - Pool frequently spawned prefabs via `UnityEngine.Pool.ObjectPool<T>`.
  - Cache shader properties once via `static readonly int PropId = Shader.PropertyToID("_Prop")` and apply per-renderer overrides with `MaterialPropertyBlock`.
  - Never use LINQ, foreach over non-struct enumerators, or string concatenation in hot loops.

## Decision Gates

| Situation | Action |
| --- | --- |
| Raycasting or overlap checks in `FixedUpdate` | Pre-allocate `RaycastHit[]` / `Collider[]` on the class and call `*NonAlloc` methods |
| Frequent projectile, VFX, or damage-number spawning | Use `UnityEngine.Pool.ObjectPool<T>` with `actionOnGet` / `actionOnRelease` |
| Per-instance shader flash or color tint | Use `MaterialPropertyBlock` with cached `Shader.PropertyToID` to preserve GPU batching |
| Input handling | Bind through Unity Input System (`.inputactions`), subscribing in `OnEnable` and unsubscribing in `OnDisable` |

## Execution Steps

1. Inspect `ProjectSettings/ProjectVersion.txt` and `Packages/manifest.json` to confirm Unity version, render pipeline (URP/HDRP/Built-in), and Input System package.
2. Implement C# systems with `ScriptableObject` data configs, cached references, and zero-allocation frame loops.
3. Verify compilation and EditMode unit tests (or Roslyn/dotnet build checks when available).

## Output Contract

Return:
- Modified `.cs`, `.asmdef`, and asset files.
- Verification results (test runner or compiler check).
- Confirmation of zero GC allocations in `Update`/`FixedUpdate` and proper `OnDisable` event cleanup.
