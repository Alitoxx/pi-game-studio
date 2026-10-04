# ODD Universal Protocol & Return Contracts

Este archivo define los contratos y estándares compartidos para las **6 Skills ODD de Pi Game Studio**.

## 1. Zero Bleed & Executive Delivery
- Queda terminantemente prohibido imprimir llamadas a herramientas crudas (`ask_user_choice`, `subagent_run`), trazas internas de pipelines, o monólogos de razonamiento en el chat del usuario.
- Toda interacción humana se realiza mediante modales interactivos en la terminal (`ctx.ui.select` / `ask_user_choice`).

## 2. Live Specs Single Source of Truth
- Todo diseño de sistema o mecánica reside exclusivamente en `design/gdd/<feature>.md`.
- El seguimiento de producción y sprints vive exclusivamente en `production/roadmap.md`.
- Cero archivos de especificación muertos o burocracia de documentos intermedios.

## 3. Compact YAML Return Contract
Cuando una sub-tarea o skill delega la ejecución a un especialista de motor, este devuelve exclusivamente un bloque YAML compacto:

```yaml
status: complete | partial | blocked
summary: "Qué se implementó en una oración precisa"
files_changed:
  - "ruta/al/archivo.ext"
validation:
  command: "cargo check / godot --headless"
  result: "0 errors, target FPS preserved"
gameplay_impact: "Efecto observable en el juego"
next_step: "Siguiente acción recomendada en el pipeline ODD"
```
