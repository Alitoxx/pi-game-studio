---
name: connect-engine-mcp
agent: technical-director
description: "[Studio] Engine MCP Connection Hub — configure and verify live Model Context Protocol connections for Godot, Unity, Unreal, and Bevy."
model: inherit
inheritProjectContext: true
tools: read, glob, grep, write, edit, ask_user_question, bash
---

# Engine MCP Connection Hub ("Files First, MCP Accelerated")

> **Filosofía del Estudio**: Los agentes de Pi Game Studio son **100% operativos sin MCP**, leyendo y editando archivos directamente en disco (`.tscn`, `.cs`, `.cpp`, `.rs`). Sin embargo, cuando se conecta un **servidor MCP de motor en vivo**, los especialistas adquieren capacidades avanzadas de inspección y validación en tiempo real dentro del editor en ejecución.

---

## Fase 1: Detección del Motor Activo

1. Lee `.pi/game-studio/technical-preferences.md` o `project.yaml` para identificar el motor configurado (`Godot`, `Unity`, `Unreal`, `Bevy`, `Raylib`).
2. Verifica si el entorno ya tiene configurado algún MCP en `.pi/settings.json`, `.pi/mcp.json` o la configuración global de Pi.

---

## Fase 2: Diagnóstico por Motor

### 1. Godot Engine (`godot-mcp` / `Swallowtail`)
* **Requisito en Godot**: Editor abierto con el plugin `godot-mcp` habilitado (o puerto WebSocket activo en `127.0.0.1:6006`).
* **Verificación de conexión**:
  ```bash
  curl -s http://127.0.0.1:6006/status 2>/dev/null || nc -z 127.0.0.1 6006 2>/dev/null
  ```
* **Herramientas que habilita al `godot-specialist`**:
  - `godot_get_scene_tree`: Inspección de la jerarquía de nodos en vivo.
  - `godot_inspect_node`: Lectura de propiedades y scripts adjuntos.
  - `godot_run_project`: Ejecución y prueba inmediata desde el editor.

### 2. Unity (`unity-mcp`)
* **Requisito en Unity**: Unity Editor abierto con el paquete `Unity-MCP-Bridge` importado (puerto HTTP local `127.0.0.1:8080`).
* **Verificación de conexión**:
  ```bash
  curl -s http://127.0.0.1:8080/health 2>/dev/null
  ```
* **Herramientas que habilita al `unity-specialist`**:
  - `unity_list_gameobjects`: Búsqueda de objetos en la escena activa.
  - `unity_get_profiler`: Métricas de memoria y frame time en tiempo real.
  - `unity_recompile_scripts`: Forzado de recarga de dominio de C#.

### 3. Unreal Engine (`unreal-mcp`)
* **Requisito en Unreal**: Unreal Editor 5 abierto con el plugin `UnrealMCP` habilitado en `Plugins/` (puerto TCP `30010`).
* **Verificación de conexión**:
  ```bash
  nc -z 127.0.0.1 30010 2>/dev/null
  ```
* **Herramientas que habilita al `unreal-specialist`**:
  - `unreal_execute_console`: Comandos en vivo (`stat memory`, `Automation RunTests`).
  - `unreal_inspect_actor`: Inspección de actores y componentes en el nivel cargado.

### 4. Bevy Engine (*Bevy Remote Protocol - BRP*)
* **Requisito en Bevy**: Juego corriendo con el plugin oficial `RemotePlugin` habilitado en `App::new()`:
  ```rust
  app.add_plugins(bevy::remote::RemotePlugin::default()); // Abre 127.0.0.1:15702
  ```
* **Verificación de conexión**:
  ```bash
  curl -s -X POST -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","method":"bevy/get","params":{"entity":0},"id":1}' \
    http://127.0.0.1:15702 2>/dev/null
  ```
* **Herramientas que habilita al `bevy-specialist`**:
  - `bevy_query_entities`: Consulta de entidades vivas por componentes.
  - `bevy_inspect_resource`: Estado de recursos en memoria.

---

## Fase 3: Registro de Servidores MCP en el Proyecto

Si el usuario desea activar el servidor MCP correspondiente a su motor, guía el registro en la configuración de Pi (`.pi/settings.json` o `.pi/mcp.json`):

Ejemplo de configuración en `.pi/mcp.json`:
```json
{
  "mcpServers": {
    "engine": {
      "command": "npx",
      "args": ["-y", "@pi-game-studio/engine-mcp-bridge", "--engine", "godot"]
    }
  }
}
```

---

## Fase 4: Reporte de Conectividad

Presenta el diagnóstico al usuario:
* **Motor Activo**: [Motor]
* **Estado MCP en Vivo**: [🟢 CONECTADO / ⚪ NO CONECTADO (Modo Archivos Activo)]
* **Capacidades Disponibles**:
  - [x] Lectura y escritura de código/escenas en disco (Files First)
  - [x / o] Inspección de SceneTree / Entidades en editor en vivo
  - [x / o] Profiling y telemetría en tiempo real
