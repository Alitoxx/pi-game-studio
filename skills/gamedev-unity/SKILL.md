---
name: gamedev-unity
description: "Trigger: Unity, Unity 6, C# game, MonoBehaviour, ScriptableObject, .asmdef, URP, HDRP, Unity Input System, Packages/manifest.json. Zero-allocation Unity C# architecture."
license: MIT
metadata:
  author: Alitoxx
  version: "2.1"
---

## Activation Contract

Activate when working in a Unity project (`Assets/`, `Packages/manifest.json`, `.cs`, `.asmdef`).

## Hard Rules

- **Banned Unity LLM Hallucinations**:
  - Never invent `GameObject.FindByTag` (does not exist) -> Use `GameObject.CompareTag("Tag")` or `GameObject.FindWithTag("Tag")`.
  - Never strip existing `using` directives when editing a file (causes `CS0246` missing type errors).
  - Check `ProjectVersion.txt`: in **Unity 6 (`6000.x`)**, use `rb.linearVelocity` (not deprecated `rb.velocity`), `Object.FindFirstObjectByType<T>()` (not deprecated `FindObjectOfType<T>()`), and `Awaitable`.
  - Never move a dynamic `Rigidbody` / `Rigidbody2D` by setting `transform.position` in `Update()` -> Read input in `Update()` and apply `rb.MovePosition()` or `rb.linearVelocity` in `FixedUpdate()`.
- **Data-Driven ScriptableObjects & `.asmdef`**: Store stats, movement tuning, and event channels in `ScriptableObject` assets. Partition scripts with Assembly Definitions (`.asmdef`) into `Core`, `Gameplay`, `UI`, and `Tests`.
- **Zero-GC Frame Loop (`Update` / `FixedUpdate` / `LateUpdate`)**:
  - Cache component references in `Awake()` and use `TryGetComponent(out T comp)` on collisions—never call `GetComponent<T>()` per frame.
  - Use pre-allocated array buffers with `Physics.RaycastNonAlloc`, `Physics.OverlapSphereNonAlloc`, or `Physics2D.OverlapCircleNonAlloc`.
  - Pool prefabs via `UnityEngine.Pool.ObjectPool<T>`.
  - Cache shader properties once via `static readonly int PropId = Shader.PropertyToID("_Prop")` and apply per-instance overrides with `MaterialPropertyBlock`.
  - Never use LINQ, boxing, or string concatenation in hot loops.

## Decision Gates

| Situation | Action |
| --- | --- |
| Raycasting or overlap checks in `FixedUpdate` | Pre-allocate `RaycastHit[]` / `Collider[]` on the class and call `*NonAlloc` methods |
| Frequent projectile, VFX, or damage-number spawning | Use `UnityEngine.Pool.ObjectPool<T>` with `actionOnGet` / `actionOnRelease` |
| Subscribing to C# events or `InputAction` callbacks | Subscribe in `OnEnable()` and always unsubscribe in `OnDisable()` to prevent destroyed-object leaks |
| Per-instance shader flash or color tint | Use `MaterialPropertyBlock` with cached `Shader.PropertyToID` to preserve SRP Batcher / GPU instancing |

## Execution Steps

1. Inspect `ProjectSettings/ProjectVersion.txt` and `Packages/manifest.json` to confirm exact Unity version (2022 LTS vs Unity 6), render pipeline (URP/HDRP), and Input System.
2. Implement C# systems preserving all required `using` statements, `ScriptableObject` configs, cached references, and zero-allocation frame loops.
3. Verify compilation and EditMode unit tests (or Roslyn/dotnet build checks when available).

## Output Contract

Return:
- Modified `.cs`, `.asmdef`, and asset files.
- Verification results (test runner or compiler check).
- Confirmation of version-accurate Unity APIs, zero GC allocations in `Update`/`FixedUpdate`, and `OnDisable` event cleanup.
