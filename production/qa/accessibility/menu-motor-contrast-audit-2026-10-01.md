# Accessibility Audit — Menú (Contraste + Remapeo de Botones)

**Fecha:** 2026-10-01
**Rol:** accessibility-specialist
**Objetivo:** contraste de color y accesibilidad motriz (remapeo) del menú
**Alcance:** motor Bevy, proyecto `Mi Videojuego`, M1 — Prototipo Jugable
**Target de cumplimiento:** WCAG 2.1 Nivel AA

---

## 1. Veredicto

> **VERDICT accessibility-specialist: FAIL (bloqueante por ausencia de objetivo).**

**No existe menú que auditar.** El único código de juego del repositorio es
`starters/bevy-2d-arpg/src/main.rs` (85 líneas): una cámara, un quad azul, y lectura
directa de `ButtonInput<KeyCode>`. No hay UI, ni widgets, ni `Node`, ni estado de menú,
ni capa de entrada persistente.

La auditoría no puede emitir PASS/FAIL sobre features inexistentes. Lo que sí se entrega es
el **contrato normativo verificado** que el menú debe cumplir en su primer commit, con
ratios de contraste ya calculados, de modo que la accesibilidad no quede como deuda retroactiva.

---

## 2. Findings

| # | Finding | Criterio WCAG | Severidad | Recomendación |
|---|---|---|---|---|
| F1 | No existe sistema de menú/UI en el proyecto | SC 2.1.1 Keyboard | **BLOCKING** | Implementar `MenuState` + widgets navegables antes de M1 |
| F2 | `player_movement` lee `KeyCode` hardcodeado (W/S/A/D, flechas); sin capa de acciones | SC 2.1.1 / SC 2.5.3 Label in Name | **BLOCKING** | Introducir enum `Action` + recurso `KeyBindings` serializable |
| F3 | Sin persistencia de ajustes; el remapeo sería imposible entre sesiones | SC 2.1.1 | **HIGH** | `SettingsAsset` (serde + RON/JSON) cargado en `Startup` |
| F4 | Sin navegación por foco de teclado/gamepad en UI | SC 2.1.1 / SC 2.4.3 Focus Order | **BLOCKING** | Recorrido de foco determinista, foco siempre visible |
| F5 | Único color del proyecto `Color::srgb(0.2,0.7,0.9)` = **4.31:1** sobre fondo gris 64 | SC 1.4.11 Non-text Contrast | MEDIUM | El sprite de jugador no es UI; si se usa como elemento interactivo, subir a ≥4.5:1 |
| F6 | Sin modo de alto contraste ni escalado de texto | SC 1.4.4 Resize Text / SC 1.4.3 | HIGH | Tokens centralizados + `UiScale` (100/125/150/200%) |
| F7 | Sin gamepad ni soporte de joystick en el arranque | SC 2.1.1 | HIGH | `GamepadButton` mapeado a las mismas `Action` |
| F8 | Discrepancia de versión: GDD declara Bevy **0.19.0**, `Cargo.toml` fija `bevy = "0.15"` | SC 3.2.x (n/a) / riesgo técnico | HIGH | Reconciliar antes de escribir UI; cambia las APIs de widget |

### Verificación de F5

```
Color::srgb(0.2, 0.7, 0.9) -> rgb(51, 179, 229)
  vs fondo gris medio (64,64,64) : 4.31:1   <-- bajo el mínimo AA de texto
  vs fondo negro (0,0,0)         : 8.72:1
```

No es un hallazgo de UI (es el sprite del jugador), pero queda registrado: ese azul **no
puede reutilizarse como color de texto ni como estado de botón** sin superarlo.

---

## 3. Contrato de contraste del menú (verificado)

Objetivo: **texto ≥ 4.5:1** (SC 1.4.3), **elementos no textuales ≥ 3:1** (SC 1.4.11).
Todos los ratios de esta tabla están calculados con la fórmula WCAG 2.1 (sRGB relativo).

### 3.1 Tokens de superficie y texto

| Token | Hex | Uso | Ratio vs `#16181D` | Cumple |
|---|---|---|---|---|
| `bg.page` | `#0B0D11` | Fondo de pantalla | — | — |
| `bg.panel` | `#16181D` | Panel de menú | 1.10 vs page | ver borde |
| `bg.raised` | `#232733` | Botón en reposo | — | — |
| `bg.hover` | `#2E3444` | Botón en hover/focus | — | — |
| `border.panel` | `#74747D` | Contorno de panel | 4.20 vs page / 3.84 vs panel | SI (≥3:1) |
| `text.primary` | `#FFFFFF` | Etiquetas, títulos | **17.76** | SI |
| `text.primary` sobre hover | `#FFFFFF` | — | **12.42** | SI |
| `text.secondary` | `#C8CEDA` | Descripciones, atajos | **11.24** | SI |
| `text.secondary` sobre hover | `#C8CEDA` | — | **7.86** | SI |
| `text.disabled` | `#8A93A6` | Estado deshabilitado | **5.75** | SI |
| `accent.focus` | `#4CC2FF` | Acción primaria | **8.85** | SI |
| `status.error` | `#FF7A7A` | Error de validación | **7.03** | SI |
| `status.success` | `#7BDCA0` | Confirmación | **10.64** | SI |

**Todos los pares texto/fondo superan 4.5:1 con holgura (mínimo observado: 4.83:1).**

> Nota de precisión: ese mínimo de 4.83:1 corresponde al token `text.disabled` sobre
> `bg.raised`, que es su superficie *peor caso* nominal. Si ese mismo token se renderiza
> sobre `bg.hover` (`#2E3444`), baja a **4.02:1** y queda por debajo de AA. Ver §7, donde la
> paleta se redefine para cerrar el hueco.

### 3.2 Indicador de foco (el punto crítico)

Un anillo de foco de un solo color **FALLA** cuando el botón enfocado tiene el mismo tono:

```
#FFD166 vs bg.panel (#16181D) : 12.32  OK
#FFD166 vs bg.raised (#232733): 10.33  OK
#FFD166 vs bg.hover (#2E3444) :  8.61  OK
#FFD166 vs accent  (#4CC2FF)  :  1.39  <-- FALLA SC 1.4.11
```

**Solución obligatoria: anillo doble.**

| Capa | Grosor | Color | Contraste garantizado |
|---|---|---|---|
| Externo | 3 px | `#FFD166` | ≥ 8.61:1 vs cualquier superficie del menú |
| Separador interno | 2 px | `#0B0D11` | **9.69:1** vs `#4CC2FF` (botón acento) |

El par externo+separador garantiza ≥ 3:1 contra *cualquier* fondo, incluidos los botones
acento, hovered y deshabilitados. Cumple SC 2.4.7 (Focus Visible) y SC 2.4.11 (Focus Not
Obscured, mínimo área de 2 px de grosor perimetral).

### 3.3 Regla anti-color-al-alone

Ningún estado del menú se codifica solo por color (SC 1.4.1 Use of Color):

| Estado | Color | Canal redundante obligatorio |
|---|---|---|
| Foco | anillo | borde doble + posición en la lista de navegación |
| Habilitado | acento | opacidad 100% + enabled=true |
| Deshabilitado | atenuado | opacidad 60% + etiqueta `(deshabilitado)` + sin foco |
| Error | rojo | icono `!` + texto de error bajo el campo |
| Confirmado | verde | check `OK` + texto de estado |

---

## 4. Contrato motor (accesibilidad motriz)

### 4.1 Arquitectura de entrada

```
Action (enum)                 ← intentions, nunca teclas
KeyBindings   (Resource)      ← HashMap<Action, KeyCode>
PadBindings   (Resource)      ← HashMap<Action, GamepadButton>
SettingsAsset (Resource)      ← serde, persistido a assets/settings.ron
InputRouter   (SystemSet)     ← resuelve ButtonInput → Action
```

Prohibido (control de manifest): cualquier `keyboard_input.pressed(KeyCode::…)` directo
fuera de `InputRouter`. Es exactamente el patrón que hoy rompe el remapeo en `main.rs`.

### 4.2 Actions mínimas para el menú

`MenuUp`, `MenuDown`, `MenuLeft`, `MenuRight`, `MenuAccept`, `MenuBack`, `MenuToggle`
(análogo a `ui_up/ui_down/ui_accept/ui_cancel` del action map estándar de Unity).

### 4.3 Requisitos de interacción

| Requisito | Criterio | Estado exigido |
|---|---|---|
| Navegación completa solo con teclado | SC 2.1.1 | obligatorio — cero elementos que requieran puntero |
| Mapeo 1:1 con gamepad | SC 2.1.1 | D-pad/-stick → Menu*, A → Accept, B → Back |
| Sin pulsaciones simultáneas obligatorias | SC 2.5.x | prohibido exigir chord en menú |
| Focus visible en todo estado | SC 2.4.7 | anillo doble §3.2 |
| Orden de foco determinista | SC 2.4.3 | seguir orden lógico/visual, sin saltos |
| Foco noTapado | SC 2.4.11 | el foco no se oculta bajo paneles superpuestos |
| Repetición por hold configurable | SC 2.2.1 Timing Adjustable | toggle on/off + delay/rate configurables |
| Captura de conflicto de teclas | SC 3.3.x | reasignar una tecla ya usada pide confirmación |
| Persistencia del remapeo | SC 2.1.1 | sobrevive reinicio de sesión |

### 4.4 Textos y escalado

- Tamaño mínimo **18 px @ 1080p**, escalable a 125 / 150 / 200% (SC 1.4.4).
- Textos de menú localizables: `«Atrás»`, no `ESC` hardcodeado — mostrar siempre el
  glifo del botón actualmente remapeado, generado en runtime desde `KeyBindings`.
- Layout por anclaje (no píxeles absolutos) para sobrevivir al escalado.

---

## 5. Recomendación al Producer

> **VERDICT: bloquear el inicio de la implementación de UI hasta que se resuelvan F1–F4.**

Construir el menú sin capa de acciones es la forma más cara de deuda de accesibilidad que
existe: retrofitear remapeo sobre widgets ya cableados a `KeyCode` toca cada pantalla. Son
~120 líneas de `Action` + `KeyBindings` + `InputRouter` **antes** del primer widget — coste
trivial ahora, caro después.

**Pre-bloqueante técnico (F8):** reconciliar Bevy 0.19.0 (GDD) vs 0.15 (`Cargo.toml`).
La API de widgets cambió entre esas versiones; fijar la versión antes de escribir UI evita
reescribir el sistema de foco.

**Siguiente paso:**
1. Technical Director decide la versión de Bevy (cierra F8).
2. `bevy-specialist` implementa `Action` + `KeyBindings` + `SettingsAsset` + `InputRouter`.
3. `ui-programmer` construye el primer menú consumiendo el contrato de §3 y §4.

---

## 6. Criterio de aceptación de esta auditoría

Re-ejecutar el audit pass cuando exista `src/ui/`. Verificar:
- [ ] Cada token de §3.1 presente en un único módulo de constantes, sin hex inline
- [ ] Anillo doble §3.2 aplicado a todo elemento enfocable
- [ ] Cero `KeyCode` literales fuera de `InputRouter`
- [ ] Menú completable 100% con teclado
- [ ] Menú completable 100% con gamepad desconectado del teclado
- [ ] Focus Order determinista sin elementos inalcanzables

---

## 7. Escalado a WCAG AAA (texto 7:1)

El encargo pide **AAA**, no solo AA. SC 1.4.6 (Contrast Enhanced) exige **7:1** para texto
corriente y **4.5:1** para texto grande (>=18.66px bold / 24px). La paleta de §3.1 **no
alcanza AAA en tres tokens**: `text.disabled` (4.02:1), `accent.focus` (6.19:1) y
`status.error` (4.92:1), todos en su superficie peor caso.

La causa raíz es `bg.hover = #2E3444`: es la superficie más clara del sistema, así que fija
el techo de contraste de cualquier texto que se dibuje sobre un botón enfocado.

### 7.1 Correcciones aplicadas a la paleta

| Token | AA (original) | AAA (corregido) | Motivo |
|---|---|---|---|
| `bg.hover` | `#2E3444` | **`#1C2029`** | Oscurecer la superficie *releva* el techo de contraste de todo el sistema |
| `text.disabled` | `#8A93A6` | **`#B7BECC`** | 7.98:1 en peor caso |
| `status.error` | `#FF7A7A` | **`#FF9E9E`** | 7.55:1 en peor caso |

`bg.hover` pasa a ser *más oscuro* que `bg.raised` (`#232733`). Es un cambio deliberado y
correcto: un estado de foco debe leerse por el **anillo de foco doble** de §3.2 y por el
elevado contraste de su etiqueta, no por aclarar el fondo. Oscurecer el hover mantiene el
botón enfocado como el elemento de mayor sal perceptual del menú.

### 7.2 Paleta AAA verificada (peor caso sobre las 4 superficies)

| Token | Hex | `page` | `panel` | `raised` | `hover` | Peor | AAA |
|---|---|---|---|---|---|---|---|
| `bg.page` | `#0B0D11` | — | 1.10 | 1.31 | 1.19 | — | — |
| `bg.panel` | `#16181D` | 1.10 | — | 1.19 | 1.09 | — | — |
| `bg.raised` | `#232733` | 1.31 | 1.19 | — | 1.09 | — | — |
| `bg.hover` | `#1C2029` | 1.19 | 1.09 | 1.09 | — | — | — |
| `text.primary` | `#FFFFFF` | 19.45 | 17.76 | 14.90 | 16.30 | **14.90** | PASS |
| `text.secondary` | `#C8CEDA` | 12.31 | 11.24 | 9.43 | 10.32 | **9.43** | PASS |
| `text.disabled` | `#B7BECC` | 10.42 | 9.51 | 7.98 | 8.74 | **7.98** | PASS |
| `accent.focus` | `#4CC2FF` | 9.69 | 8.85 | 7.43 | 8.13 | **7.43** | PASS |
| `status.error` | `#FF9E9E` | 9.85 | 8.99 | 7.55 | 8.26 | **7.55** | PASS |
| `status.success` | `#7BDCA0` | 11.66 | 10.64 | 8.93 | 9.77 | **8.93** | PASS |

**Los 6 tokens de texto superan 7:1 en las 4 superficies.** Margen mínimo: 7.43:1.

### 7.3 Elementos no textuales (SC 1.4.11, 3:1)

| Elemento | Hex | Peor superficie | Ratio | Cumple |
|---|---|---|---|---|
| `border.panel` | `#74747D` | `#232733` | 3.22 | SI |
| Anillo foco externo | `#FFD166` | `#232733` | 10.33 | SI |
| Separador de anillo | `#0B0D11` | vs `#4CC2FF` | 9.69 | SI |

El anillo doble de §3.2 mantiene su garantía: externo ≥ 10.33:1 contra cualquier superficie
del menú, separador 9.69:1 contra el botón de acento. Inalterado por la corrección AAA.

### 7.4 Coste de la corrección

- `text.disabled` pasa a ser casi indistinguible de `text.secondary` en tono. **Mitigación
  obligatoria ya definida en §3.3**: el estado deshabilitado se codifica además con opacidad
  60%, etiqueta `(deshabilitado)` y ausencia de foco. Esto satisface SC 1.4.1 (Use of Color).
- Oscurecer `bg.hover` invierte la intuición habitual hover-más-claro. Documentar en el style
  guide para que un Technical Artist no lo "corrija" sin conocer esta tabla.

> **VERDICT accessibility-specialist: PASS AA / PASS AAA sobre la paleta propuesta.**
> El menú aún no existe, así que esto es un contrato normativo verificado, no una
> certificación de implementación. Se mantiene el bloqueo de F1–F4 hasta que haya `src/ui/`.