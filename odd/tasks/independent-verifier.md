# Independent Verifier

Closes audit issue #13: the studio has no independent verification path — `qa-lead` audits inside the same pipeline, with the same write tools, so "found and repaired" is indistinguishable from "verified clean". Adds a read-only auditor role and one blocking verification channel, which also answers #7 ("no read-only agent exists").

## Specs

- S1: `agents/qa-verifier.md` existe y declara `read, find, grep, bash`. No declara `write` ni `edit`: es el primer rol del roster que no puede modificar lo que audita. La restricción vive en el frontmatter, no en una convención del prompt.
- S2: El instalador lo despliega siempre, junto al especialista de motor, sin tocar la lista de los 8 roles core: `VERIFIER_AGENTS` se suma en `getStudioAgents()`. Los 8 core siguen siendo 8.
- S3: El roster del runtime reconoce `qa-verifier` en todas las listas que hoy enumeran agentes: `getAgentTier`, los grupos de `/studio:agents`, la lista de personalización de `/studio:models` y su `TIER_2`, el presupuesto de `studio-budget.ts` y `scripts/assign-models.js`.
- S4: El CI y los tests reflejan el catálogo real: 15 plantillas en `agents/`.
- S5: `chains/release-gate.chain.md` cierra con un paso de verificación que emite veredicto bloqueante. Una cadena con veredicto `blocked` no puede darse por buena.
- S6: El verificador deriva sus probes del spec y del pedido, no del reporte del implementador, y devuelve la evidencia en forma `cmd` (la que le corresponde por declarar `bash`). Su contrato de retorno es el del estudio: `status`, `summary`, `validation`, `risks`.
- S7: `AGENTS.md`, `README.md` y `context.md` describen la arquitectura real: 8 roles core + 1 especialista de motor + 1 auditor read-only instalado siempre (10 agentes activos), 15 plantillas en `agents/`.

## Tasks

- [x] T1 (S1, S6): Plantilla `agents/qa-verifier.md` — frontmatter read-only, probes derivados del spec, veredicto por criterio y canal bloqueante
- [x] T2 (S2, S3): Instalador y listas de roster del runtime
- [x] T3 (S4): CI y tests al catálogo de 15 plantillas
- [x] T4 (S5): Paso bloqueante en `chains/release-gate.chain.md`, con soporte `readOnly` en el validador de chains
- [x] T5 (S7): Docs (`AGENTS.md`, `README.md`, `context.md`)
- [x] T6: Verificación final (suite completa + typecheck + conteos del CI)

## Log

- L1 (user request, verbatim): "si hazlo" → "Los dos, en ese orden" → "que recomiendas  tu ?". Decisión adoptada: opción 2 del modal de alcance, rol nuevo con independencia real.
- L2: Alcance ya fijado por el roadmap #23, que no se reabre: *"A game studio needs one auditor and one blocking channel, not a court martial"*. Portar el rig completo de Gentle Shell (cuatro lentes 4R, revisión dual ciega, ledger) sigue explícitamente fuera de alcance.
- L3: Restricción que decide la arquitectura: los chains no pueden sobrescribir herramientas por paso (`extensions/hooks/studio-chains.ts:29-35` no tiene `tools:`), y el runner resuelve manifiestos por nombre desde `.pi/agents/` y el paquete. Por eso el verificador tiene que ser un agente instalable, no un paso con herramientas acotadas.
- L4: Inventario de listas de roster hardcodeadas que un rol nuevo debe tocar: `studio-setup.ts:93` (`CORE_STUDIO_AGENTS`) y `:128` (`getStudioAgents`), `studio-agent-loader.ts:59` (`getAgentTier`), `studio-agents.ts:47` (TIER 2), `studio-models.ts:242` (picker) y `:392` (`TIER_2`), `studio-budget.ts:98` (clasificación por nombre), `scripts/assign-models.js:48` (`TIERS.workhorse`).
- L5: Churn de documentación medido antes de empezar: 12 referencias a "8+1"/"9 agentes"/"14 agentes" en `AGENTS.md` y 13 en `README.md`, más 2 en `context.md`.
- L6: Decisión de alcance para no inflar el diff: se toca el roster hardcodeado **solo donde un verificador tiene que aparecer**, y la consolidación del roster en una fuente única de verdad queda como follow-up nombrado, no dentro de este feature. Meterla ahora convertiría el cambio en un refactor de runtime con un rol escondido adentro.
- L8: Corrección de L7 — era una premisa falsa. `categorizeDiscipline` (`extensions/hooks/studio-budget.ts:65`) solo alimenta `TokenUsageRecord.discipline` (`:220`), que es el bucket del reporte de costos: **no recorta ningún presupuesto de tokens**. La entrada explícita `lower === "qa-verifier"` en la rama `Specialists` es la corrección correcta y suficiente; hace la clasificación deliberada en vez de dejarla caer por el `includes("qa")`. No se toca más el archivo.
- L9: El subagente `gentle-ai-worker` se colgó por timeout generando argumentos de tool, después de escribir T1–T4 y `AGENTS.md`. Su salida se revisó línea por línea en vez de confiarse, y aparecieron dos defectos que el timeout no justifica:
  - La plantilla y el paso del chain declaraban `status: pass | blocked`. `pass` no existe en el enum del validador (`completed | partial | blocked | interaction_required`): el verificador habría fallado su propia entrega como violación de contrato, justo el defecto que el feature anterior cerró. Corregido a `completed` con el veredicto PASS/BLOCKED en `summary`, y con una prohibición explícita de inventar valores de `status`.
  - El paso `qa-verifier` del chain no declara superficies de edición, así que el validador lo marcaba como "corre con escritura libre en todo el worktree" — un warning falso sobre el único agente que no puede escribir. Se agregó `readOnly` al esquema de pasos (parseo, supresión del warning, y error si un paso declara `readOnly` y superficies a la vez, porque una de las dos declaraciones es falsa).
- L10: Tres asserts de conteo más, fuera de las superficies del worker (`__tests__/scripts.test.js:24,25,76` y `__tests__/studio-commands.test.js:126,154`), quedaron en 14. El de cobertura de grupos usaba un regex de sufijos que no contemplaba `-verifier`: pasaba con 14 ignorando al rol nuevo, así que se agregó `-verifier` al patrón además de subir el número. Un test que pasa ignorando al rol que debería cubrir no es cobertura.
- L11: Cierre: 233/233 tests verdes, `tsc -p extensions/hooks/tsconfig.json --noEmit` limpio, `agents/` = 15, y `assign-models.js` clasifica 15 agentes (3 director + 12 workhorse). Cuatro commits: `698df82` feat(studio) rol + canal, `bb2f005` feat(roster) listas y conteos, `7f6d21e` docs, y este slice documental.
