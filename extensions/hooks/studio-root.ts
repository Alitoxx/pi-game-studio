import { existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/**
 * Searches upward from startDir to locate the Pi Game Studio root directory.
 * A directory is recognized as a Game Studio root if it contains:
 * - .pi/game-studio/ directory, or
 * - project.yaml, or
 * - AGENTS.md
 */
export function findStudioRoot(startDir = process.cwd()): string | null {
	let current = resolve(startDir);
	while (true) {
		if (
			existsSync(join(current, ".pi", "game-studio")) ||
			existsSync(join(current, "project.yaml")) ||
			existsSync(join(current, "AGENTS.md"))
		) {
			return current;
		}
		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}
