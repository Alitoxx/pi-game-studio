---
name: ship
description: "[ODD Fase 6] Release & Ship. Empaquetado final de builds para distribución, parches de emergencia (hotfix), changelogs y checklists de certificación."
model: inherit
inheritProjectContext: true
tools:
  - read
  - glob
  - grep
  - write
  - edit
  - bash
  - ask_user_choice
---

## Fase 6 ODD: Release, Certification & Patching

Cuando se invoca `/ship` (o `/ship build`, `/ship patch`, `/ship release`):

### 1. Pre-Release Checklist & Asset Audit
- Verificar que no existan bugs bloqueantes (P0/P1) abiertos en `production/qa/bugs.md`.
- **Auditoría de Manifiesto de Assets**: Inspeccionar `assets/manifest.yaml` y certificar que ningún asset crítico de gameplay figure como `placeholder`.
- Confirmar que el juego cumple con los presupuestos de memoria y framerate medidos en `/test`.
- Asegurar que las cadenas de texto estén internacionalizadas si el juego soporta múltiples idiomas.

### 2. Generación y Empaquetado de Builds Multiplataforma & Web (WASM)
- **Compilación Nativa**: Generar binarios limpios para las plataformas de escritorio (Windows, macOS, Linux).
- **Target Web / WASM**: Compilar el build web para distribución en navegador / itch.io (`wasm32-unknown-unknown` + `wasm-bindgen` en Bevy/Rust, export HTML5 en Godot/Raylib). Asegurar que todas las rutas de assets sean relativas y que la configuración CORS y canvas sea correcta.
- Validar checksums y estructura de directorios de distribución (`dist/` o `releases/`).

### 3. Registro de Versión y Changelog
- Actualizar `CHANGELOG.md` con los cambios notables bajo el estándar Keep a Changelog.
- Actualizar la versión semántica en el manifiesto del proyecto (`project.yaml`, `package.json` o `Cargo.toml`).

### 4. Soporte y Parches
- En caso de errores en producción, ejecutar el flujo de hotfix atómico para generar un parche de emergencia focalizado.
