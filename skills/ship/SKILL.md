---
name: ship
description: "[ODD Fase 6] Release & Ship. Role Owner: producer (Tier 1 Director) + qa-lead. Empaquetado final de builds para distribución, parches de emergencia (hotfix), changelogs y checklists de certificación."
model: inherit
inheritProjectContext: true
tools:
  - read
  - find
  - grep
  - write
  - edit
  - bash
  - ask_user_question
---

## Fase 6 ODD: Release, Certification & Patching

- **Role Owner**: `producer` (Tier 1 Director) + `qa-lead`
- **Contrato ODD Compartido**: Consulta [`skills/_shared/odd-contract.md`](../_shared/odd-contract.md) para las reglas compartidas de tareas atómicas (~400 líneas), Live Specs en `design/gdd/`, límites de compilación (compiler bounds) y el formato del Return Contract en YAML.

Cuando se invoca `/ship` (o `/ship build`, `/ship patch`, `/ship release`):

### 1. Pre-Release Checklist & Asset Audit
- Verificar que no existan bugs bloqueantes (P0/P1) abiertos en `production/qa/bugs.md`.
- **Auditoría de Manifiesto de Assets**: Inspeccionar `assets/manifest.yaml` y certificar que ningún asset crítico de gameplay figure como `placeholder`.
- Confirmar que el juego cumple con los presupuestos de memoria y framerate medidos en `/test`.
- Asegurar que las cadenas de texto estén internacionalizadas si el juego soporta múltiples idiomas.

### 2. Generación, Optimización y Empaquetado Multiplataforma
- **Compilación Nativa**: Generar binarios limpios para las plataformas de escritorio (Windows, macOS, Linux).
- **Target Web / WASM**: Compilar el build web para distribución en navegador / itch.io (`wasm32-unknown-unknown` + `wasm-bindgen` en Bevy/Rust, export HTML5 en Godot/Raylib). Asegurar que todas las rutas de assets sean relativas y que la configuración CORS y canvas sea correcta.
- **Optimización de Bytecode WASM con `wasm-opt`**: Si existe `wasm-opt` en el sistema (`which wasm-opt`), ejecutar `wasm-opt -O3 dist/game.wasm -o dist/game.wasm` para reducir el tamaño de carga web hasta un 65%.
- **Compresión Final de Assets con `oxipng`**: Ejecutar `oxipng -o 2 dist/assets/**/*.png` para asegurar un empaquetado mínimo.
- Validar checksums y estructura de directorios de distribución (`dist/` o `releases/`).

### 3. Publicación y Distribución Automatizada
- **Itch.io con `butler`**: Si `butler` está disponible y configurado, publicar el build web o de escritorio mediante parches delta: `butler push dist/ <usuario>/<juego>:<canal>`.
- **GitHub Releases con `gh`**: Crear el release formal, taggear la versión y adjuntar los binarios o zips empaquetados: `gh release create <version> dist/* --title "<version>" --notes-file CHANGELOG.md`.

### 4. Registro de Versión y Changelog
- Actualizar `CHANGELOG.md` con los cambios notables bajo el estándar Keep a Changelog.
- Actualizar la versión semántica en el manifiesto del proyecto (`project.yaml`, `package.json` o `Cargo.toml`).

### 5. Soporte y Parches
- En caso de errores en producción, ejecutar el flujo de hotfix atómico para generar un parche de emergencia focalizado.
