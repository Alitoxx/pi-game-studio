# Game Design Frameworks & Formal Methodologies

> Guía de referencia y marco teórico formal para `game-designer`, `systems-designer` y `creative-director` en Pi Game Studio.

---

## 1. MDA Framework (Hunicke, LeBlanc, Zubek)

El marco MDA formaliza el diseño y análisis de juegos dividiéndolo en tres capas:

```
[Desarrollador] -> Mecánicas -> Dinámicas -> Estéticas <- [Jugador]
```

* **Mecánicas (Mechanics)**: Las reglas formales, fórmulas, datos y algoritmos en código (e.g., gravedad = 9.8, daño = base * 1.5, munición limitada a 6).
* **Dinámicas (Dynamics)**: El comportamiento emergente en tiempo de ejecución cuando el jugador interactúa con las mecánicas (e.g., retroceso táctico, gestión de escasez de recursos, farmeo, presión de tiempo).
* **Estéticas (Aesthetics)**: Las respuestas emocionales y vivenciales deseadas en el jugador cuando experimenta la dinámica.
  - *Sensation* (Placer sensorial visual/auditivo)
  - *Fantasy* (Inmersión en un mundo ficticio creíble)
  - *Narrative* (Drama y arco narrativo)
  - *Challenge* (Superación de obstáculos mediante habilidad)
  - *Fellowship* (Cooperación social y juego compartido)
  - *Discovery* (Exploración de territorio y secretos)
  - *Expression* (Personalización y creatividad del jugador)
  - *Submission* (Pasatiempo y relajación)

---

## 2. Flow Theory (Csikszentmihalyi)

El estado de flujo (*Flow*) es el equilibrio mental donde el jugador está completamente absorto en la experiencia.

* **Canal de Flujo (Flow Channel)**:
  - Si el **Reto > Habilidad**: El jugador entra en **Ansiedad y Frustración** -> Abandono.
  - Si la **Habilidad > Reto**: El jugador entra en **Aburrimiento y Apatía** -> Abandono.
  - **Equilibrio dinámico**: A medida que la habilidad del jugador mejora con la práctica, el juego debe elevar gradualmente la complejidad y exigencia.
* **Micro-flujo en Combate / Plataformas**:
  - Ciclos de tensión y alivio (*Pacing*): Oleada intensa -> Momento de respiro/recompensa -> Escalada.

---

## 3. Self-Determination Theory (SDT en Videojuegos)

La motivación intrínseca sostenida del jugador se basa en satisfacer tres necesidades psicológicas básicas:

1. **Autonomía (Autonomy)**: La sensación de control y voluntad. El jugador toma decisiones significativas (elección de build, caminos alternativos, personalización) en lugar de ser forzado linealmente.
2. **Competencia (Competence)**: La sensación de eficacia y dominio. El juego proporciona feedback inmediato, claridad en las metas y una curva donde el jugador siente que progresa y se vuelve más hábil.
3. **Pertenencia / Relación (Relatedness)**: La conexión con otros personajes o jugadores (vínculos con NPCs, gremios, narrativa empática).

---

## 4. Tipos de Jugador de Bartle

Taxonomía para equilibrar mecánicas y motivaciones de diferentes perfiles:

| Perfil | Motivación Principal | Mecánicas que los Deleitan |
|---|---|---|
| **Achievers (Triunfadores)** | Actuar sobre el mundo (progreso, logros) | Desbloqueos, rankings, árboles de habilidades, 100% completion. |
| **Explorers (Exploradores)** | Interactuar con el mundo (descubrimiento) | Zonas ocultas, lore ambiental, Easter eggs, mecánicas complejas no evidentes. |
| **Socializers (Socializadores)** | Interactuar con otros jugadores/NPCs | Diálogos interactivos, gremios, sistemas de reputación, co-op. |
| **Killers (Competidores)** | Actuar sobre otros jugadores/entidades | PvP, maestría técnica de combate, dominancia mecánica, records de velocidad (speedrun). |
