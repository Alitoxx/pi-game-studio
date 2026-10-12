# Ecosistema de Servidores MCP — Pi Game Studio

> **Filosofía**: *"Files First, MCP Accelerated"* — Todos los agentes de Pi Game Studio operan de manera autónoma y completa sobre archivos en disco (`design/gdd/`, `src/`). Los servidores MCP ofrecen aceleración e inspección en caliente bajo demanda.

---

## Servidores MCP Oficiales del Estudio (10 Roles)

| ID | Nombre | Categoría | Agentes Beneficiados | Función Clave |
|---|---|---|---|---|
| `rea` | **REA MCP** | Ingeniería Inversa | `engine-programmer`, `gameplay-programmer`, `prototyper` | Decompilación e ingeniería inversa asistida por IA de WebAssembly, Electron, JS y binarios nativos (morluto/rea). |
| `playwright` | **Playwright MCP** | Testing & QA | `qa-tester`, `qa-lead`, `devops-engineer` | Validación de builds WebGL/WASM sin GUI, capturas de pantalla de UI y lectura de logs de Canvas. |
| `context7` | **Context7 MCP** | Documentación & APIs | Especialistas de motor (`bevy`, `godot`, `raylib`, `unity`, `unreal`) | Documentación oficial en vivo y actualizada para Bevy ECS 0.14+, Godot 4.x GDExtension y EnTT C++. |
| `codegraph` | **Codegraph MCP** | Indexación de Código | `lead-programmer`, `gameplay-programmer`, `technical-director` | Análisis estático y grafo de dependencias de llamadas y sistemas del motor. |
| `sqlite` | **SQLite MCP** | Economía & Datos | `economy-designer`, `game-designer`, `systems-designer` | Consultas y balance directo sobre bases de datos relacionales embebidas (`assets/data/game.db`). |
| `knowledge-vector` | **Knowledge Vector DB MCP** | Narrativa & Lore | `narrative-director`, `writer`, `creative-director` | Búsqueda semántica sobre la biblia del juego, reglas del mundo y coherencia de personajes (`assets/lore/`). |
| `blender` | **Blender MCP** | 3D & Assets | `technical-artist`, `art-director`, `level-designer` | Automatización de scripts Python para Blender: mallas de colisión, LODs y exportación a `.glb`. |
| `image-gen` | **Image / Sprite Gen MCP** | Arte 2D & Sprites | `art-director`, `prototyper` | Generación de texturas tileables, iconos de inventario, skyboxes y sprites de referencia. |
| `audio-sfx` | **Audio & SFX MCP** | Audio & Música | `sound-designer`, `audio-director` | Generación de efectos de sonido procedurales (.wav) y pistas musicales de ambientación. |
| `live-engine` | **Live Engine MCP** | Inspección en Caliente | Especialistas de motor | Conexión WebSocket al motor activo: Bevy BRP (15702), Godot (6006), Unreal (30010). |

---

## Gestión y Activación
- **Comando interactivo**: `/studio:mcp` (abre el menú TUI con navegación de flechas y selección).
- **Desde terminal**: `pi mcp add <id> -l -- <comando>` o `/studio:setup` (opción 4).
- **Archivo de configuración local**: `.pi/mcp.json`.

---

## Toolchain FOSS CLI & Diagnóstico de Viabilidad (`/studio:tools`)

Además de los servidores MCP, Pi Game Studio integra un motor proactivo de auditoría e instalación de binarios de línea de comandos para producción autónoma:

| Herramienta | Paquete Homebrew | Categoría | Agentes Beneficiados | Utilidad en Producción |
|---|---|---|---|---|
| `ffmpeg` | `ffmpeg` | Procesamiento de Audio & Video | `audio-director`, `qa-lead` | Normalización, recortes de silencios y conversión de formatos de audio/video. |
| `imagemagick` | `imagemagick` | Manipulación de Sprites & Atlas | `art-director`, `gameplay-programmer` | Empaquetado de texturas, redimensionado y generación de atlas en CLI. |
| `assimp` | `assimp` | Conversión 3D Rápida | `art-director`, `gameplay-programmer` | Conversión ultra rápida de modelos 3D (`.obj`, `.fbx`, `.dae`) a `.glb`/`.gltf`. |
| `git-lfs` | `git-lfs` | Control de Versiones | `producer`, `technical-director` | Versionado de assets pesados (texturas, audio, 3D) sin inflar Git. |
| `sox` | `sox` | Efectos y Filtros de Audio | `audio-director`, `gameplay-programmer` | DSP por línea de comandos: reverb, pitch shift y ecos para efectos generados. |
| `blender` | `--cask blender` | Suite 3D & Exportador | `art-director`, `technical-director` | Generación procedural de colisiones, mallas y exportación Python headless. |
| `oxipng` | `oxipng` | Optimización de Sprites PNG | `art-director`, `gameplay-programmer` | Optimizador multihilo sin pérdida (lossless) para texturas y sprites 2D. |
| `wasm-opt` | `binaryen` | Optimización WebAssembly | `bevy-specialist`, `godot-specialist`, `raylib-specialist` | Reducción del peso de builds WASM hasta un 65% para itch.io y navegadores. |
| `butler` | `--cask butler` | Distribución & Lanzamiento | `producer`, `technical-director` | Publicación de builds y demos a itch.io mediante parches delta en CLI. |
| `gh` | `gh` | Releases & Workflows | `producer`, `technical-director`, `qa-lead` | Gestión de Pull Requests, creación de releases con binarios y CI/CD. |
| `watchexec` | `watchexec` | Live-Reload & Hot Compilation | `gameplay-programmer`, especialistas | Recompilación y relanzamiento de pruebas en caliente ante cambios de código. |

- **Comando interactivo**: `/studio:tools` (o automáticamente durante `/start`, `/studio:setup` y `/studio:doctor`).

