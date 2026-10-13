import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/**
 * Searches upward from startDir to locate the Pi Game Studio root directory.
 * A directory is recognized as a Game Studio root if it contains:
 * - .pi/game-studio/ directory, or
 * - .pi/agents/ directory, or
 * - .pi/settings.json file, or
 * - .pi/extensions/ directory, or
 * - project.yaml, or
 * - AGENTS.md
 *
 * If a directory has .pi/agents, .pi/settings.json, or .pi/extensions, it is a
 * studio project boundary and will not ascend to parent directories looking for
 * AGENTS.md or project.yaml. Never traverses upwards past any .pi/ directory.
 */
export function findStudioRoot(startDir = process.cwd()): string | null {
	let current = resolve(startDir);
	while (true) {
		if (
			existsSync(join(current, ".pi", "game-studio")) ||
			existsSync(join(current, ".pi", "agents")) ||
			existsSync(join(current, ".pi", "settings.json")) ||
			existsSync(join(current, ".pi", "extensions")) ||
			existsSync(join(current, "project.yaml")) ||
			existsSync(join(current, "AGENTS.md"))
		) {
			return current;
		}

		// Never traverse upwards past a .pi/ directory. Stop search immediately if .pi exists locally.
		if (existsSync(join(current, ".pi"))) {
			return null;
		}

		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}
