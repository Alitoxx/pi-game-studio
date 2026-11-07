# Pi Game Studio — Guía de Skills para Gentle Shell

Este repositorio provee un conjunto puro de **Skills de Ingeniería de Videojuegos** para **Gentle Shell**.

## Principios de Diseño

1. **Gentle Shell como Único Arnés**: Toda la orquestación, el seguimiento de tareas ODD y la delegación a subagentes (`gentle-ai-explore`, `gentle-ai-worker`, `gentle-ai-verify`) los ejecuta Gentle Shell de forma nativa.
2. **Directo al Código (Cero GDDs)**: No se generan árboles de documentos de diseño (`design/gdd/`) ni roadmaps paralelos. Las mecánicas se implementan directamente en el código del motor con variables de ajuste expuestas.
3. **Skills Modulares por Motor**:
   - `skills/gamedev-core/SKILL.md`: Reglas universales de *game loop*, `delta` time, *input buffering*, *coyote time*, máquinas de estado y disciplina de cero *heap allocations* por frame.
   - `skills/gamedev-godot/SKILL.md`: Patrones idiomáticos para Godot 4.x.
   - `skills/gamedev-bevy/SKILL.md`: Patrones idiomáticos para Bevy (Rust ECS).
   - `skills/gamedev-phaser/SKILL.md`: Patrones idiomáticos para Phaser 3/4 (TypeScript).
   - `skills/gamedev-raylib/SKILL.md`: Patrones idiomáticos para Raylib (C++17/20 + EnTT).
   - `skills/gamedev-unity/SKILL.md`: Patrones idiomáticos para Unity (C#).
   - `skills/gamedev-unreal/SKILL.md`: Patrones idiomáticos para Unreal Engine 5 (C++).

## Convención de Idioma

- **Archivos `skills/*/SKILL.md`**: Escritos en **inglés técnico conciso** para maximizar la precisión de seguimiento de instrucciones y reducir el consumo de tokens cuando Gentle Shell los inyecta en contexto o los pasa a subagentes.
- **Documentación (`README.md`, `AGENTS.md`)**: En **español neutro profesional**.
