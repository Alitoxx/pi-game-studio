import { existsSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

/**
 * Searches upward from startDir to locate the Pi Game Studio root directory.
 * A directory is recognized as a Game Studio root if it contains:
 * - .pi/game-studio/ directory, or
 * - project.yaml, or
 * - AGENTS.md, or
 * - .pi/settings.json configured with pi-game-studio package
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

		// Also recognize when Pi Game Studio is installed locally in .pi/settings.json
		const localSettings = join(current, ".pi", "settings.json");
		if (existsSync(localSettings)) {
			try {
				const raw = readFileSync(localSettings, "utf8");
				if (raw.includes("pi-game-studio")) {
					return current;
				}
			} catch {}
		}

		const parent = dirname(current);
		if (parent === current) break;
		current = parent;
	}
	return null;
}
