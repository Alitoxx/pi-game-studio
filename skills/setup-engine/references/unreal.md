# Appendix E — Unreal Engine 5 Configuration Reference

### E1. Setup Guide (Unreal Engine 5.4+)
- Install via Epic Games Launcher.
- **Required tools**: Epic Games Launcher, Visual Studio 2022 (Windows) / Xcode (macOS), .NET SDK (for Unreal Build Tool).

### E2. Project Structure Conventions
- `Source/`: C++ header and source files.
- `Content/`: Blueprints, materials, levels, models.
- `Config/`: Default engine and game configuration files.

### E3. Enhanced Input Setup
- Core for UE 5.1+.
- Create Input Actions (IA) and Input Mapping Contexts (IMC) in Editor.
- Bind in C++ using `UEnhancedInputComponent`.

### E4. Module System Basics
- Code is organized into Modules.
- Primary game module is set up in `[ProjectName].Build.cs` (adding dependencies like `"EnhancedInput"`).
- Target files: `[ProjectName].Target.cs`, `[ProjectName]Editor.Target.cs`.

### E5. Build Pipeline
- Configurations: **Development** (includes debug symbols and checks, default for editor), **Shipping** (stripped down, high performance).
- Built via Unreal Build Tool (UBT).

### E6. Common Gotchas for C++ vs Blueprints
- **Blueprints**: Fast iteration, great for UI (UMG), data setup, visual effects. Can become spaghetti and slower if overused for heavy logic.
- **C++**: High performance, strong typing, better source control. Harder to iterate on visuals.
- **Best Practice**: Expose C++ functions/variables to BP via `UFUNCTION` / `UPROPERTY`. Write heavy logic in C++, configure properties and references in Blueprints.
