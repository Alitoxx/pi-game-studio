# Pi Game Studio Agents

## Quick reference

- **Directors**: creative-director, technical-director, producer
- **Leads**: game-designer, lead-programmer, art-director, audio-director, narrative-director, qa-lead, release-manager, localization-lead
- **Specialists**: gameplay-programmer, engine-programmer, ai-programmer, network-programmer, tools-programmer, ui-programmer, systems-designer, level-designer, economy-designer, technical-artist, sound-designer, writer, world-builder, qa-tester, performance-analyst, devops-engineer, analytics-engineer, security-engineer, accessibility-specialist, live-ops-designer, community-manager

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
```

## Notes

- Agents ship as source in this package.
- `/setup` generates the runtime `.pi/agents/` set in a consuming project.
- `/assign-models` adjusts model assignments per agent.
