---
name: market-research
agent: game-designer
description: "[Studio] Market Research & Competitive Analysis — analyze Steam genres, competitor comps, player sentiment, tags, and audience viability."
model: inherit
inheritProjectContext: true
tools: read, glob, grep, write, edit, web_search, ask_user_question
---

# Market Research & Competitive Analysis

> **Misión**: Validar la viabilidad comercial y la diferenciación de un concepto de juego indie en el mercado actual (Steam, itch.io, consolas), analizando títulos comparables (*comps*), etiquetas clave, expectativas de los jugadores y rangos de precio recomendados.

---

## Fase 1: Extracción del Concepto y Nicho

1. **Lectura de contexto existente:**
   - Lee `design/gdd/game-concept.md` si existe.
   - Si no existe, solicita brevemente al usuario:
     - Género central y perspectiva (e.g. ARPG Isométrico, Metroidvania 2D, Roguelike Deckbuilder).
     - Referencias estéticas y mecánicas (e.g. "Diablo 2 + Hades", "Hollow Knight + Celeste").
     - Plataforma target principal (Steam PC, Switch, Mobile).

2. **Confirmación de términos de búsqueda:**
   - Define de 3 a 5 juegos comparables directos (*comps*) tanto de éxito masivo como de éxitos indie medianos recientes (lanzados en los últimos 3 años).

---

## Fase 2: Análisis Competitivo y de Mercado (Web Search)

Usa la herramienta `web_search` para investigar datos frescos del mercado:

1. **Juegos Comparables (*Comps*):**
   - Buscar 3 a 5 títulos clave en el género:
     - Fecha de lanzamiento, desarrollador (solo dev vs estudio pequeño).
     - Rango de precio habitual en Steam ($9.99, $14.99, $19.99, etc.).
     - Nivel de éxito estimado (cantidad de reseñas en Steam como proxy: `reviews * 30-50` copias estimadas).
2. **Sentimiento de la Comunidad (Review Mining):**
   - ¿Qué adoran los jugadores de estos juegos? (e.g. variedad de builds, combate responsivo, rejugabilidad).
   - ¿De qué se quejan más frecuentemente en las reseñas negativas? (e.g. falta de contenido endgame, rendimiento pobre, curva de dificultad injusta, controles toscos).
3. **Steam Tagging Strategy:**
   - Identificar las 10-15 etiquetas más relevantes de Steam en orden de peso algorítmico (e.g., `Action RPG`, `Hack and Slash`, `Isometric`, `Difficult`, `Pixel Art` / `Dark Fantasy`).

---

## Fase 3: Matriz de Posicionamiento y Gancho Único (The Hook)

Evalúa la posición de nuestro juego frente a la competencia:

| Competidor (*Comp*) | Fortaleza Principal | Debilidad según Jugadores | Nuestra Oportunidad / Gancho Diferenciador |
|---|---|---|---|
| *Juego A* | Combate fluido | Falta de profundidad en builds | Profundidad de teoría de builds y personalización táctica |
| *Juego B* | Gran estética | Corta duración / poco endgame | Loop de rejugabilidad procedimental o crafteo |

---

## Fase 4: Generación del Reporte de Mercado

Escribe los hallazgos en `design/market-research.md`:

```markdown
# Reporte de Investigación de Mercado: [Título / Concepto]

> **Fecha**: [Fecha actual]
> **Género**: [Género]
> **Público Objetivo**: [Perfil del jugador / motivación principal]

## 1. Resumen Ejecutivo y Viabilidad
- Evaluación global de saturación de mercado: [Baja / Media / Alta / Muy Alta]
- Viabilidad comercial estimada para equipo [solo dev / indie pequeño]: [Viable / Con Desafíos / Nicho Fiel]

## 2. Benchmark de Competidores (Comps)
| Título | Año | Precio | Reseñas Steam | Estimación de Éxito |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

## 3. Lo que los Jugadores Exigen (Review Insights)
- **Factores de éxito indispensables**: [Lista de 3-4 expectativas no negociables en el género]
- **Errores comunes a evitar**: [Lista de quejas recurrentes en competidores]

## 4. Estrategia de Tags y Categorización en Steam
- Tags Primarios (Top 5): ...
- Tags de Soporte y Nicho: ...

## 5. El Gancho Comercial (Unique Value Proposition)
- ¿Por qué un jugador compraría este juego en lugar de jugar nuevamente a sus referentes?
```

---

## Fase 5: Recomendaciones y Próximos Pasos

Presenta las conclusiones clave al usuario:
1. Resumen del nivel de saturación y potencial de audiencia.
2. Recomendación de precio y alcance óptimo para el MVP.
3. Pregunta interactiva para refinar el concepto antes de avanzar al GDD detallado o prototipado.
