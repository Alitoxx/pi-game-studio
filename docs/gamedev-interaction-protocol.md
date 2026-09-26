# Protocolo de Interacción y Respuestas del Estudio (Gamedev Decision Protocol)

> **Inspirado en la disciplina visual y precisión de Gentle Shell, adaptado 100% a la realidad y producción de un estudio de videojuegos.**

Este protocolo establece el estándar de comunicación, diseño de respuestas y toma de decisiones para los **55 agentes** de **Pi Game Studio**. Garantiza que cada respuesta técnica o de diseño tenga alta densidad informativa, mantenga presente la visión del juego, justifique los costos de desarrollo y entregue opciones de acción inmediatas sin ambigüedades.

---

## Los 5 Bloques del Protocolo

Toda decisión arquitectural, técnica o de diseño de mecánicas debe estructurarse utilizando los siguientes 5 bloques:

```text
1. 🎮 Pillars & Constraints Header (Contexto del juego)
2. ⚔️ Gameplay & Technical Trade-offs Matrix (Matriz de decisión)
3. 👑 Director Gate / Technical Verdict (Recomendación con autoridad)
4. 🗳️ Choice Envelope (Opciones cerradas y numeradas)
5. 📡 Next Steps Radar (Radar de próximos pasos y comandos)
```

---

## 1. Pillars & Constraints Header (Contexto del Juego)

Antes de profundizar en cualquier dilema técnico o de diseño, el agente debe recordar los pilares que delimitan el proyecto. Esto evita que decisiones aisladas rompan la fantasía del jugador o el rendimiento objetivo.

```text
┌── 🎮 ESTUDIO CONTEXT: [Nombre del Juego / Género] ──────────────────┐
│ Pilares: [Pilar 1] · [Pilar 2] · [Pilar 3]                          │
│ Target:  [Plataforma: PC/Mobile/Console] · [Motor & Stack] · [FPS]  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gameplay & Technical Trade-offs Matrix

Las comparaciones no se presentan en prosa desordenada. Se evalúan en una tabla con las 4 dimensiones reales de un videojuego:

| Dimensión | Pregunta Crítica |
| :--- | :--- |
| **Alternativa** | ¿Qué camino o tecnología estamos considerando? |
| **Game Feel / Jugabilidad** | ¿Cómo se siente para el jugador? (Fluidez, latencia, diversión) |
| **Rendimiento / FPS** | ¿Qué impacto tiene en GPU, CPU, memoria contigua y tasa de cuadros? |
| **Costo de Producción / Scope** | ¿Cuántas horas/días de desarrollo cuesta y qué riesgo de bugs acarrea? |

### Ejemplo en Acción:

```markdown
### ⚔️ Decisión: Gestión de Proyectiles y Hordas de Enemigos

| Alternativa | Game Feel (Jugabilidad) | Rendimiento (FPS) | Costo de Producción (Scope) |
| :--- | :--- | :--- | :--- |
| **A. Clases OOP Polimórficas (`std::vector<Enemy*>`)** | Fácil de programar y extender. | Cache-misses masivos con > 300 enemigos. Tirones de FPS. | Bajo (1-2 días). |
| **B. Data-Oriented ECS (`EnTT`)** *(Recomendada)* | Combate ultra responsivo con miles de entidades simultáneas. | Memoria contigua en caché. Mantiene 144 FPS estables. | Medio (Patrón ECS limpio). |
| **C. Sistema de Partículas por GPU** | Visualmente impresionante para balas/magias. | Sin lógica de colisión compleja ni drop de loot individual. | Alto (Shaders compute). |
```

---

## 3. Director Gate / Technical Verdict (Recomendación con Autoridad)

El agente responsable de la disciplina debe emitir un veredicto claro y argumentado, respaldado por el Director correspondiente (Tier 1):

```markdown
> 👑 **Veredicto del `technical-director` & `raylib-entt-specialist`:**
> "(Recomendado) Opción B. En un ARPG el núcleo de la diversión es aniquilar hordas sin pérdida de fluidez. El desacoplamiento entre componentes puros en EnTT y el render por lotes de Raylib garantiza el pilar de combate a 144 FPS sin fricción."
```

---

## 4. Choice Envelope (Menú de Elección Cerrado)

Las preguntas nunca quedan flotando en el aire. Se presentan en un marco delimitado (*Choice Envelope*) con opciones auto-contenidas y numeradas para que el usuario responda con un solo número o frase corta:

```text
┌── 🗳️ ELECCIÓN REQUERIDA: Selección de Arquitectura ────────────────┐
│ [1] Implementar ECS con EnTT (Recomendado)                         │
│     ➔ Arquitectura escalable y preparada para miles de enemigos.   │
│ [2] Prototipo Rápido en POO tradicional                            │
│     ➔ Entrega funcional inmediata con límite de 200 entidades.     │
│ [3] Explorar variante híbrida o solicitar más detalles             │
└────────────────────────────────────────────────────────────────────┘
Responde con [1], [2] o [3]:
```

---

## 5. Next Steps Radar & Asset Receipts

Al concluir una entrega o hito, el especialista entrega un **Recibo de Entrega** y proyecta las siguientes acciones en el radar:

### Recibo de Entrega:
```text
✔ RECIBO DE ENTREGA: Sistema de Cámara Isométrica y Proyección
──────────────────────────────────────────────────────────
• Archivo modificado:   src/camera/iso_camera.cpp
• Especialista a cargo: raylib-specialist
• Memoria & Allocations: 0 allocations por frame (Zero Alloc Loop)
• Funciones expuestas:  WorldToIso(), IsoToWorld(), UpdateIsoCamera()
──────────────────────────────────────────────────────────
```

### Radar de Próximos Pasos:
```text
Siguientes acciones recomendadas:
[1] Conectar entidades y ordenamiento Y ➔ raylib-entt-specialist
[2] Redactar pruebas o revisar código    ➔ /code-review
[3] Configurar shaders de iluminación    ➔ raylib-shader-specialist
```
