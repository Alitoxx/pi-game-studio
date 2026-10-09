# Pi Game Studio — Arquitectura y Diagramas de Flujo (v1.4.0)

Este documento detalla los flujos de ejecución y las interacciones entre los componentes y herramientas de **Pi Game Studio**.

---

## 1. Pipeline ODD Gamedev (6 Fases Oficiales)

Flujo cíclico de desarrollo ágil que conecta diseño vivo, arquitectura técnica y validación continua en motor.

```mermaid
flowchart TD
    subgraph ODD_Pipeline ["Pipeline Oficial ODD (Organic Driven Development)"]
        A["1. /concept<br/>Visión, 3-5 Pilares, Anti-pilares"] --> B["2. /spec<br/>Live Specs en design/gdd/*.md"]
        B --> C["3. /arch<br/>ADRs, Budgets de FPS y Memoria"]
        C --> D["4. /code<br/>Implementación en motor (~400 líneas)"]
        D --> E["5. /test<br/>Smoke Checks, Soak Runner & QA Triage"]
        E --> F["6. /ship<br/>Builds, Web/WASM, Changelog & Releases"]
        F -.->|"Siguiente Feature / Iteración"| B
    end
```

---

## 2. Gobernanza y Jerarquía de Agentes (Arquitectura 8+1)

Estructura compacta de directores, jefes de departamento y especialista dedicado del motor activo.

```mermaid
flowchart TD
    subgraph Directors ["Tier 1: Directores (Visión y Estrategia)"]
        Producer["producer<br/>(Coordinador & Sprints)"]
        CD["creative-director<br/>(Game Vision & Tone)"]
        TD["technical-director<br/>(Arquitectura & Budgets)"]
    end

    subgraph Leads ["Tier 2: Leads & Core Devs"]
        GD["game-designer"]
        GP["gameplay-programmer"]
        AD["art-director"]
        AudioD["audio-director"]
        QALead["qa-lead"]
    end

    subgraph EngineSpecialist ["Tier 3: Especialista de Motor (+1 Activo)"]
        Spec["bevy-specialist / godot-specialist<br/>raylib-specialist / unity-specialist / unreal-specialist"]
    end

    Producer --> CD & TD
    TD --> GP
    CD --> GD & AD & AudioD
    GP --> Spec
    QALead --> Producer
```

---

## 3. Subagentes Nativos Aislados y Streaming en Vivo

Ciclo de vida de una tarea delegada a un especialista en un proceso hijo no contaminante.

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Usuario / Productor
    participant Main as Sesión Principal Pi (Orquestador)
    participant Runner as studio-agents-runner
    participant Child as Proceso Hijo (`pi --print`)
    participant Viewer as Visor en Vivo (/studio:subagents)

    Dev->>Main: Solicita feature o refactor
    Main->>Runner: subagent_run(agent, prompt)
    Runner->>Child: Spawn proceso aislado
    activate Child
    Runner->>Viewer: Stream de salida (Herramientas, edits, bash)
    Dev->>Viewer: Inspecciona en tiempo real (/studio:logs)
    Child-->>Runner: Retorno en bloque YAML estructurado
    deactivate Child
    Runner-->>Main: subagent_result (archivos, tests, status)
    Main->>Dev: Síntesis ejecutiva y handoff
```

---

## 4. WebAssembly / Web One-Click Build & Runner (`/studio:web`)

Compilación cruzada a WASM y servidor con cabeceras de aislamiento multithreading (`COOP/COEP`).

```mermaid
flowchart TD
    Start["Comando /studio:web o npm run build:web"] --> Detect["Detectar Motor en project.yaml"]
    
    Detect -->|Bevy| BevyBuild["cargo build (wasm32) + wasm-bindgen"]
    Detect -->|Raylib| RaylibBuild["emcc C++ con GLFW3 y ASYNCIFY"]
    Detect -->|Godot 4| GodotBuild["godot --headless --export-release Web"]

    BevyBuild & RaylibBuild & GodotBuild --> Dist["Generar artefacto en dist/web/index.html"]
    
    Dist --> Server["Lanzar scripts/serve-web.js (Puerto 8080)"]
    Server --> Headers["Inyectar Headers:<br/>COOP: same-origin<br/>COEP: require-corp"]
    Headers --> Browser["Abrir Navegador (SharedArrayBuffer activo)"]
```

---

## 5. Live Performance Profiler & Budget Tracker HUD (`/studio:profile`)

Monitoreo continuo de presupuestos de FPS, tiempos de cuadro y memoria RSS.

```mermaid
flowchart LR
    subgraph Monitor ["Monitoreo en Vivo"]
        Process["Proceso del Juego<br/>(Godot / Bevy / Raylib)"] -->|"Métricas RSS / Frame Time"| Profiler["studio-profile.ts"]
        Config["project.yaml<br/>(Target: 60 FPS, Max: 256MB)"] -->|"Presupuesto Límite"| Profiler
    end

    subgraph Output ["Visualización & Alertas"]
        Profiler --> Check{"¿Dentro de Límites?"}
        Check -->|"Sí"| Normal["HUD Verde:<br/>⚡ 60fps (48MB) OK"]
        Check -->|"No"| Alert["HUD Amarillo/Rojo:<br/>⚠ Frame drops / Memoria excedida"]
        Normal & Alert --> TUI["Pie de Estado TUI de Pi (Statusline)"]
    end
```

---

## 6. Sintetizador de Audio & Paletas de Shaders (`/studio:sfx` & `/studio:palettes`)

Generación procedural sin dependencias externas para prototipado rápido.

```mermaid
flowchart TD
    subgraph SFX_Pipeline ["Sintetizador Procedural de Audio (/studio:sfx)"]
        AudioInput["Parámetros: forma de onda (sine/square/saw/noise), freq, ADSR"]
        AudioInput --> AudioSynth["scripts/synth-studio.js (sfx)"]
        AudioSynth --> WavGen["Generar 16-bit PCM Mono WAV (44.1kHz)"]
        WavGen --> WavSave["Guardar en assets/sfx/<nombre>.wav"]
    end

    subgraph Palette_Pipeline ["Generador de Shaders de Paleta (/studio:palettes)"]
        PalInput["Paleta elegida (Pico-8, Cyberpunk, GameBoy, Solarized)"]
        PalInput --> PalGen["scripts/synth-studio.js (palette)"]
        PalGen --> TargetCheck{"Motor Destino"}
        TargetCheck -->|Godot 4| GodotShader["Generar shader canvas_item (.gdshader)"]
        TargetCheck -->|Raylib C++| RaylibShader["Generar fragment shader GLSL 330 (.fs)"]
        GodotShader & RaylibShader --> ShaderSave["Guardar en shaders/palette_<nombre>.*"]
    end
```

---

## 7. Pipeline de CI/CD Automatizado (GitHub Actions)

Validación continua en cada Pull Request y despliegue del juego a GitHub Pages.

```mermaid
flowchart TD
    Push["Push o PR a rama main"] --> CI["GitHub Actions (gamedev-ci.yml)"]
    
    subgraph Job1 ["1. Codebase Health & Soak Test"]
        CI --> NpmTest["npm test (134 pruebas)"]
        NpmTest --> Placeholders["npm run assets:placeholders"]
        Placeholders --> SoakTest["scripts/soak-test.sh (Prueba de 60s)"]
    end

    subgraph Job2 ["2. Build WebAssembly"]
        SoakTest --> BuildWeb["npm run build:web"]
        BuildWeb --> Artifact["Subir dist/web/ como artefacto"]
    end

    subgraph Job3 ["3. Deploy GitHub Pages"]
        Artifact --> DeployPages["Publicar juego jugable en GitHub Pages"]
    end
```
