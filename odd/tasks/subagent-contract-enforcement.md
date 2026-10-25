# Subagent Contract Enforcement

Close the three audit gaps between Pi Game Studio's written Gentle Shell discipline and its runtime behavior: the return contract is validated, bounded edit surfaces reach the specialist process, and the model/documentation sources of truth stop contradicting each other.

## Specs

- S1: El contrato de retorno de especialistas se valida en el runner. `validateSpecialistReturn` (`extensions/hooks/return-contract.ts`) es importado y usado por `StudioAgentsRunner` en el cierre del proceso hijo: un task cuyo texto final incumple el contrato termina en `status: "failed"` con un mensaje que nombra las violaciones, nunca en `completed`.
- S2: Un `status: completed` exige evidencia observable: al menos un `validation` o un `files_changed` no vacío. Sin evidencia, la validación agrega un error explícito que pide el campo faltante. `hasConversationalBleed` sigue siendo advertencia no fatal.
- S3: El test de `return-contract` deja de ser string-grep y pasa a ejercitar comportamiento real (`execFileSync` + `--experimental-strip-types`, idioma ya usado por la suite). Cubre: contrato válido, falta de `status`, `status` inválido, `completed` sin evidencia.
- S4: Las superficies de edición autorizadas llegan al proceso hijo. El runner deriva `## Allowed edit surfaces` del task despachado y las exporta en el entorno del hijo (`PI_STUDIO_ALLOWED_SURFACES`); el hijo las carga en `BoundedSurfacesGuard` al iniciar sesión. Sin superficies declaradas el comportamiento se mantiene sin límite (compatibilidad hacia atrás).
- S5: `models.default.json` contiene únicamente claves de tier (`director`, `workhorse`, `lightweight`) y los 6 especialistas de motor reales. Ninguna clave del roster legacy de 50+ agentes. Un test invariante garantiza que toda clave del archivo es un tier conocido o uno de los 14 agentes reales de `agents/`.
- S6: `AGENTS.md` y `README.md` describen el comportamiento real: los agentes usan `model: inherit`, `models.default.json` aporta defaults por tier, `/assign-models` escribe overrides en `.pi/game-studio/models.json`. Se elimina la tabla de modelos que contradice el código y la referencia a `.pi/gentle-ai/models.json`.

## Tasks

- T1 (S1-S3): Gate de contrato de retorno en el runner + tests de comportamiento — commit fix(subagents)
- T2 (S4): Superficies de edición al proceso hijo + tests — commit fix(surfaces)
- T3 (S5): Purga de `models.default.json` + test invariante — commit chore(models)
- T4 (S6): Reconciliación de docs (`AGENTS.md`, `README.md`) — commit docs(agents)
- T5: Suite completa verde (verificación; los fixes viajan en su unidad)

## Log

- L1 (user request, verbatim): "si hzlo"
- L2: Contexto: autorización de las reparaciones 1-3 propuestas en la auditoría del turno anterior (hallazgos en Engram obs #4609). La reparación 4 (clasificación de riesgo + verificador independiente) quedó explícitamente fuera: es decisión de producto, no reparación.
- L4: Corrección de alcance durante T3: la purga intentó dejar solo los tres tiers y rompió el test de simetría de motores (`__tests__/homologation.test.js`, requisito del feature Phaser: los 6 especialistas deben estar mapeados explícitamente). La decisión previa se respeta: los 6 especialistas se mantienen, mapeados al valor del tier `workhorse`, que es exactamente el default que ya declara `AGENTS.md`. Solo se elimina el roster legacy.
- L3: Hallazgos que originan cada spec — S1/S2/S3: `validateSpecialistReturn` sin importadores y test que solo verifica la existencia del string (`__tests__/studio-commands.test.js:417`). S4: `boundedSurfacesGuard.setFromTask()` corre solo en el proceso padre (`extensions/hooks/index.ts:86`) y `studio-surfaces-guard.ts:109` permite todo con lista vacía. S5/S6: `models.default.json` conserva el roster legacy de 50+ agentes y contradice tanto `AGENTS.md` como el `model: inherit` real de los 14 templates.
