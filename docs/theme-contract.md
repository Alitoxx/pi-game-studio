# Contrato de Tema — el estudio es dueño de su paleta

Decisión registrada para cerrar #115 (follow-up de #52). El soporte de tema estaba
a medias: los estados semánticos ya resolvían por el tema del host, pero el acento,
los marcos y tres overlays seguían pintando constantes crudas. Media decisión es la
peor opción; esta es la decisión entera.

## La decisión

1. **Los archivos de `themes/` visten solo el chrome del host.** `themes/GameStudio.json`
   y `themes/GameStudio-Arcade.json` son temas de Pi: los carga el host y colorean su
   interfaz (mensajes, diffs, markdown, syntax highlighting, tool panels). Ningún módulo
   bajo `extensions/` los importa, y no hace falta que lo haga.
2. **El estudio es dueño de su paleta.** Los colores de marca viven en
   `extensions/hooks/studio-palette.ts`: acento, texto, `faint`, `heading`, `secondary`
   y los marcos de panel. Un tema del host no los reescribe.
3. **Los estados semánticos siguen al tema del host.** `success`, `error`, `warning`
   y `muted` se resuelven con `resolveStudioTheme(theme)`, de modo que un proyecto que
   elige un tema ve sus estados con los colores de ese tema. Sin tema —o con un tema
   que no expone `fg`— se usa la paleta del estudio, byte por byte.
4. **La video inversa es un escape más.** El cursor de texto de los overlays se dibuja
   con `reverse()`, el único constructor de `\x1b[7m`, y desaparece bajo `NO_COLOR` como
   cualquier otro escape.

## Los cuatro invariantes

Están asertados en `__tests__/palette.test.js`, en el bloque
`describe("theme integration (resolveStudioTheme)")`, y aplicados por
`__tests__/studio-theme-contract.test.js`:

| Invariante | Qué significa |
|---|---|
| Los roles semánticos siguen al tema | `success` → token `success`, `error` → `error`, `warn` → `warning`, `muted` → `dim`. |
| La marca nunca sigue al tema | `accent`, `text` y `faint` no llaman a `theme.fg` jamás. El acento en un terminal claro baja a `BRAND_LIGHT` para mantener 4.5:1, y eso sigue siendo una decisión de la paleta, no del tema. |
| `faint` nunca se redirige | Es decoración, no texto: ni siquiera un tema que funciona lo cambia. |
| Sin tema, la paleta de siempre | Ningún tema, un tema sin `fg` o un `fg` que lanza excepción: los siete roles devuelven exactamente los escapes de `studio-palette.ts`. |

## Dónde se aplica

- `/changes` (`studio-changes.ts`): `renderChangesCard` y `formatChangesOutput` aceptan
  un `role` opcional; las cifras `+/-`, las advertencias de drift y las etiquetas muted
  pasan por él. El título de la tarjeta sigue en `accent` del estudio. El handler de
  comando no recibe el tema, así que lee el rol vivo que el footer publica con
  `setActiveThemeRole` en cada render: sin tema registrado, la salida es idéntica a la
  paleta de siempre, y con tema sigue sus estados sin que el handler toque un handle
  que nunca tuvo.
- Overlays (`studio-choice.ts`, `studio-timeline-viewer.ts`, `studio-subagents-viewer.ts`):
  cada renderer acepta un `role` opcional como parámetro final, o resuelve
  `resolveStudioTheme(theme)` cuando ya tiene el handle del tema. Los estados
  (completado, en ejecución, fallido, neutro) se pintan por rol; acento, secundario,
  `heading` y marcos quedan en la paleta.
- Overlay de comandos (`studio-palette-overlay.ts`): ya resolvía roles; ahora también
  usa `reverse()` para el cursor.

## Qué NO afirma esta decisión

- No dice que los archivos de `themes/` sean correctos. `themes/GameStudio.json` fija
  `bg`, `bgPanel` y `bgElement` al mismo `#090A10`, así que su chrome no separa
  superficies; eso es un defecto del tema del host, no del contrato del estudio, y no
  está cubierto por ningún test de este repositorio.
- No promete que todo el TUI del estudio siga al tema: el estudio mantiene su
  identidad visual a propósito. Solo los estados semánticos y el cursor obedecen al
  host.
