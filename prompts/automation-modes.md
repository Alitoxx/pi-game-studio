# Automation Modes

Pi Game Studio uses `modes.automation` (configured in `project.yaml` or `project.local.yaml`) to determine how often agents should block on user approval. 

## Modes
- **collaborative**: The agent pauses and asks the user for confirmation at every decision point.
- **guided**: The agent only asks for confirmation on major structural changes or big decisions. Minor decisions are logged and proceeded automatically.
- **autonomous**: The agent proceeds automatically without asking, only logging its decisions, unless it hits an `automation_always_ask` category.

## Always Ask Categories
Categories specified in `automation_always_ask` (e.g., `schema_changes`) will always require a user prompt, regardless of the automation mode.

Whenever using `AskUserQuestion`, check the automation mode. (collaborative asks always · guided major-only · autonomous logs and proceeds; `automation_always_ask` categories always prompt).
