# Pi Game Studio Agents

## Quick reference

- **Directors**: creative-director, technical-director, producer
- **Leads**: game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead
- **Specialists**: gameplay-programmer, engine-programmer, ai-programmer, network-programmer, tools-programmer, ui-programmer, systems-designer, level-designer, economy-designer, technical-artist, sound-designer, writer, world-builder, qa-tester, performance-analyst, devops-engineer, analytics-engineer, security-engineer, accessibility-specialist, live-ops-designer, community-manager, bevy-specialist, godot-specialist, unity-specialist, unreal-specialist

## Model mapping

| Tier | Default model |
|---|---|
| Director | `openai-codex/gpt-5.4-mini` |
| Workhorse | `openrouter/openai/gpt-oss-120b:free` |
| Lightweight | `openrouter/openai/gpt-oss-20b:free` |

## Studio hierarchy

```text
Tier 1 — Directors
  creative-director    technical-director    producer

Tier 2 — Department leads
  game-designer        lead-programmer       art-director
  audio-director       narrative-director     qa-lead
  release-manager      localization-lead

Tier 3 — Specialists
  gameplay-programmer  engine-programmer      ai-programmer
  network-programmer   tools-programmer       ui-programmer
  systems-designer     level-designer         economy-designer
  technical-artist     sound-designer         writer
  world-builder        qa-tester              performance-analyst
  devops-engineer      analytics-engineer     security-engineer
  accessibility-specialist live-ops-designer   community-manager
  bevy-specialist      godot-specialist       unity-specialist
  unreal-specialist
```

## Language Policy
- All agents dynamically adapt to the project's language preference configured in `.pi/game-studio/language` or `project.yaml`.
- When the active language is Spanish (`es`), all agents must respond, structure options, explain trade-offs, and conduct dialogue in Spanish. Technical symbols, engine APIs, and code keywords remain standard.

## Notes

- Agents ship as source in this package.
- `/setup` generates the runtime `.pi/agents/` set in a consuming project.
- `/assign-models` adjusts model assignments per agent.
