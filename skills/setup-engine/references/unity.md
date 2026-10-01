# Appendix D — Unity Configuration Reference

### D1. Setup Guide (Unity 2022.3 LTS / 6000.x)
- Install Unity via Unity Hub. Recommend LTS versions (2022.3 or 6000.x).
- **Required tools**: Unity Hub, .NET SDK, Visual Studio / Rider / VS Code.

### D2. Project Structure Conventions
- `Assets/Scripts/`: C# source code.
- `Assets/Prefabs/`: Reusable game objects.
- `Assets/Scenes/`: Unity scenes.
- `Assets/Art/`: Models, textures, and sprites.
- `Assets/Settings/`: Input actions, render pipelines.

### D3. Input System Setup
- Use the modern Input System package (com.unity.inputsystem).
- Configure input action assets and generate C# classes.

### D4. Package Manager Basics
- Use Window > Package Manager for installing essential packages.
- Common packages: Input System, Cinemachine, TextMeshPro.

### D5. Build Pipeline
- Backend options: **IL2CPP** for better performance and security (mostly for consoles/mobile), **Mono** for faster iteration (desktop).
- Managed through Build Settings and Player Settings.

### D6. Common Gotchas
- Always use Addressables or AssetBundles for large projects instead of the `Resources/` folder.
- Beware of garbage collection spikes with LINQ and frequent object instantiation (use Object Pools).
