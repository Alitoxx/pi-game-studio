import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";

/**
 * Per-agent model overrides, read at dispatch time from the project config.
 * AGENTS.md documents `.pi/game-studio/models.json` as the per-agent override
 * file; this module is what makes that promise real.
 */
export type ModelTier = "director" | "workhorse";

const DIRECTOR_AGENTS = new Set(["producer", "creative-director", "technical-director"]);

/** The three Tier 1 directors run on the director tier; everyone else is workhorse. */
export function modelTierForAgent(agentName: string): ModelTier {
	return DIRECTOR_AGENTS.has(agentName) ? "director" : "workhorse";
}

/** The config paths tried in order: the documented one, then the legacy fallback. */
function modelConfigCandidates(projectRoot: string): string[] {
	return [
		join(projectRoot, ".pi", "game-studio", "models.json"),
		join(projectRoot, ".pi", "gentle-ai", "models.json"),
	];
}

/**
 * Reads `<root>/.pi/game-studio/models.json` (falling back to
 * `<root>/.pi/gentle-ai/models.json`) as `Record<agentName | tier, model>`.
 * Only a plain object with non-empty string values is accepted; any missing,
 * unreadable, invalid or non-object configuration yields `{}` — never throws.
 */
export function readModelOverrides(projectRoot: string): Record<string, string> {
	for (const candidate of modelConfigCandidates(projectRoot)) {
		if (!existsSync(candidate)) continue;
		try {
			const parsed: unknown = JSON.parse(readFileSync(candidate, "utf8"));
			if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
				continue;
			}
			const overrides: Record<string, string> = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value === "string" && value.trim().length > 0) {
					overrides[key] = value.trim();
				}
			}
			return overrides;
		} catch {
			// Corrupt config: an override file must never break dispatch.
		}
	}
	return {};
}

/**
 * The model configured for an agent: its own key first, then its tier key.
 * `"inherit"` values are skipped (they mean "no explicit model"). Returns
 * `undefined` when nothing applies.
 */
export function resolveAgentModel(projectRoot: string, agentName: string): string | undefined {
	const overrides = readModelOverrides(projectRoot);
	const byAgent = overrides[agentName];
	if (byAgent && byAgent !== "inherit") return byAgent;
	const byTier = overrides[modelTierForAgent(agentName)];
	if (byTier && byTier !== "inherit") return byTier;
	return undefined;
}

/**
 * Full resolution order for a dispatched specialist:
 * 1. `manifest.model` when present and not `"inherit"` — the role contract wins,
 * 2. the per-agent/per-tier override from the project config,
 * 3. the parent session's active model when non-empty,
 * 4. the literal `"inherit"`.
 */
export function chooseModelForAgent(opts: {
	manifestModel?: string;
	projectRoot: string;
	agentName: string;
	activeModel?: string;
}): string {
	if (opts.manifestModel && opts.manifestModel !== "inherit") {
		return opts.manifestModel;
	}
	const resolvedRoot = findStudioRoot(opts.projectRoot) ?? opts.projectRoot;
	const configured = resolveAgentModel(resolvedRoot, opts.agentName);
	if (configured) return configured;
	if (opts.activeModel) return opts.activeModel;
	return "inherit";
}
