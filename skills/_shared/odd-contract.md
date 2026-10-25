# ODD Universal Protocol & Return Contracts

Este archivo define los contratos y estándares compartidos para las **6 Skills ODD de Pi Game Studio**.

## 1. Zero Bleed & Executive Delivery (Gentle Shell Neutral Protocol)
- Queda terminantemente prohibido imprimir llamadas a herramientas crudas (`ask_user_question`, `subagent_run`), trazas internas de pipelines, o monólogos de razonamiento en el chat del usuario.
- Toda interacción humana se realiza mediante modales interactivos en la terminal (`ctx.ui.select` / `ask_user_question`).
- **Modo Neutro Profesional:** Toda salida conversacional, explicación o síntesis de las skills opera bajo el protocolo neutro de Gentle Shell: tuteo estándar (`tú tienes`, `haz`, `revisa`), sin voseo ni regionalismos, cero adulación inicial (*"Buena pregunta"*), cero paternalismo (*"en lenguaje llano"*) y cero emojis decorativos.

## 2. Live Specs Single Source of Truth
- Todo diseño de sistema o mecánica reside exclusivamente en `design/gdd/<feature>.md`.
- El seguimiento de producción y sprints vive exclusivamente en `production/roadmap.md`.
- **Higiene de Tareas y Cero Checkbox Bloat:** En `production/roadmap.md` cada sprint lleva **1 solo checkbox principal** para la tarea macro. Las notas de verificación (`cargo check limpio`, `tests verdes`, constraints) van como viñetas simples (`-`), nunca con `[ ]` o `[x]`. Prohibido duplicar colas de tareas futuras que ya existen en el GDD.
- Cero archivos de especificación muertos o burocracia de documentos intermedios.

## 3. Atomic Scoping & Execution Budgets (~400 Líneas)
- Toda implementación delegada a un subagente se realiza en paquetes atómicos de **~400 líneas** (código + tests/datos).
- Prohibido delegar monolitos de 800+ líneas en una sola pasada. Si una mecánica es más grande, se implementa el núcleo funcional primero, se reporta `status: partial` y se continúa en el siguiente ciclo.
- **Cero Diálogos Intermedios en Ejecución**: Las tareas delegadas ya están autorizadas por el usuario/productor. El especialista no debe formular preguntas conversacionales ni pedir confirmaciones intermedias; ejecuta directamente sobre disco.

## 4. Scoped Engine Validation (Protección contra Monolitos de Build)
- En motores compilados o web (Rust/Bevy, C++/Raylib, C++/Unreal, TypeScript/Phaser, Godot):
  - Tareas de lógica pura o crates desacoplados (e.g. `crates/radio-core`) **deben** validarse exclusivamente con comandos acotados (`cargo test -p radio-core`, `cargo check -p radio-core`).
  - **Prohibido** ejecutar builds globales del workspace o suites completas que fuercen recompilaciones del motor (como Bevy en modo test) dentro de un subagente con timeout acotado.
  - La compilación del juego completo o smoke test visual se reserva para el paso de integración del orquestador o la skill `/test`.

## 5. Compact YAML Return Contract
Cuando una sub-tarea o skill delega la ejecución a un especialista de motor, este devuelve exclusivamente un bloque YAML compacto. La forma es única y es la que valida el runtime (`extensions/hooks/return-contract.ts`); el ejemplo de abajo es el contrato, y un test lo corre por el validador para que documento y parser no puedan separarse.

```yaml
status: completed
summary: "Qué se implementó en una oración precisa"
files_changed:
  - "src/player.rs"
validation:
  - "cargo check -p game: 0 errores"
gameplay_impact:
  - "salto responsivo, 60 FPS estables"
risks:
  - "ninguno"
next_recommended_specialist: qa-lead
```

`status` acepta `completed`, `partial`, `blocked` o `interaction_required`. Un `completed` exige evidencia observable: al menos un `files_changed` o un `validation` con el comando ejecutado y su resultado observado. Prosa sin evidencia no es una entrega verificable.

Un especialista despachado **no tiene UI**: no puede preguntar. Si la decisión está por encima de su rol, se detiene y la entrega como payload, que el padre releva como elección bloqueante:

```yaml
status: interaction_required
summary: "Dos arquitecturas válidas; la decisión no es del especialista"
question: "¿ECS con sistemas o jerarquía de escenas?"
options:
  - "ECS con sistemas"
  - "Jerarquía de escenas"
blocking: true
```

`question` es obligatorio en una escalada; `options` y `blocking` son recomendados. Un `interaction_required` sin pregunta se considera entrega inválida: no es accionable y el hijo se colgaría igual.

## 6. FOSS CLI Media & Distribution Toolchain
Los agentes y especialistas con herramienta `bash` ejecutan tareas de transformación de assets y distribución usando los binarios auditados del estudio (`/studio:tools`):
- **Sprites & Texturas 2D**:
  - `magick`: Generación de atlas/spritesheets (`magick montage *.png -tile 4x4 -geometry +0+0 atlas.png`) y recortes de transparencia.
  - `free-tex-packer-cli`: Empaquetado algorítmico de spritesheets (MaxRects), recorte de transparencias y exportación de descriptores JSON/Godot/Raylib.
  - `oxipng`: Optimización lossless inmediata tras guardar o regenerar sprites (`oxipng -o 2 -strip safe assets/**/*.png`).
- **Audio & SFX**:
  - `ffmpeg`: Normalización y conversión de masters WAV a formatos comprimidos de runtime (`ffmpeg -i input.wav -c:a libvorbis -q:a 4 output.ogg`).
- **Modelos 3D**:
  - `assimp`: Conversión ultra rápida a formato estándar GLTF/GLB sin sobrecarga (`assimp export model.obj model.glb`).
  - `gltfpack`: Optimización de mallas glTF/GLB para GPU, simplificación con LODs y compresión meshopt (`gltfpack -i model.glb -o model_opt.glb -cc`).
- **WebAssembly & Distribución**:
  - `wasm-opt`: Optimización de bytecode WASM en builds web (`wasm-opt -O3 input.wasm -o output.wasm`).
  - `butler`: Despliegue delta a itch.io (`butler push dist/ user/game:web`).
  - `gh`: Releases y versionado de binarios (`gh release create <tag> ./dist/*`).
- **Live-Reload & Watcher**:
  - `watchexec`: Monitoreo y pruebas continuas ante cambios (`watchexec -e rs,gd,cpp,ts,fs -- <test-command>`).


