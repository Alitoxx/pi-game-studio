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

### 1. Pre-Release Checklist
- Verificar que no existan bugs bloqueantes (P0/P1) abiertos en `production/qa/bugs.md`.
- Confirmar que los assets temporales o placeholders hayan sido sustituidos.
- Asegurar que las cadenas de texto estén internacionalizadas si el juego soporta múltiples idiomas.

### 2. Generación y Empaquetado de Builds
- Ejecutar el pipeline de empaquetado para las plataformas de destino (Windows, macOS, Linux, Web/WASM).
- Validar checksums y estructura de directorios de distribución.

### 3. Registro de Versión y Changelog
- Actualizar `CHANGELOG.md` con los cambios notables bajo el estándar Keep a Changelog.
- Actualizar la versión semántica en el manifiesto del proyecto.

### 4. Soporte y Parches
- En caso de errores en producción, ejecutar el flujo de hotfix atómico para generar un parche de emergencia focalizado.
