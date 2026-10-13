/**
 * Destructive Command Guard for Pi Game Studio.
 * Intercepts dangerous terminal commands (such as git reset --hard, git clean -fd,
 * rm -rf on game directories, dd, format/mkfs) that risk catastrophic data loss.
 */

export interface CommandSafetyResult {
	safe: boolean;
	allowed: boolean;
	reason?: string;
}

const PROTECTED_GAME_DIRECTORIES = ["src", "assets", "design"];

/**
 * Checks if a bash command contains destructive actions against the project or system.
 */
export function isDestructiveCommand(command: string): boolean {
	if (!command || typeof command !== "string") return false;

	// Split compound commands (&&, ;, ||, |) to evaluate each segment
	const segments = command.split(/&&|;|\|\||\|/).map((s) => s.trim()).filter(Boolean);

	for (const segment of segments) {
		// 1. git reset --hard
		if (/\bgit\s+reset\s+--hard\b/i.test(segment)) {
			return true;
		}

		// 2. git clean with force flags (-f, -fd, -fx, -df, --force)
		if (/\bgit\s+clean\s+[^|\n;&]*(-[a-zA-Z]*f[a-zA-Z]*|--force)\b/i.test(segment)) {
			return true;
		}

		// 3. Low-level drive formatters / disk destroyers (dd, mkfs, format, fdisk)
		if (/\bdd\s+(?:if=|of=|[a-z0-9\/=])/i.test(segment)) {
			return true;
		}
		if (/\b(?:mkfs|mkfs\.[a-z0-9]+)\b/i.test(segment)) {
			return true;
		}
		if (/\bformat\s+[A-Za-z]:/i.test(segment) || /^format\b/i.test(segment)) {
			return true;
		}
		if (/\b(?:fdisk|parted)\b/i.test(segment)) {
			return true;
		}

		// 4. rm -rf or recursive rm on game directories (src, assets, design) or root / wildcard
		if (/\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*/i.test(segment) || /\brm\s+--recursive/i.test(segment)) {
			// Check for root, wildcard, current directory
			if (/\brm\s+-[a-zA-Z]*\s+(\*|\.|\/)\b/.test(segment) || /\s+(\*|\.|\/)(?:\s|$)/.test(segment)) {
				return true;
			}

			// Check for protected game directories: src, assets, design
			for (const dir of PROTECTED_GAME_DIRECTORIES) {
				const dirPattern = new RegExp(`(?:^|[\\/\\s"'])(${dir})(?:$|[\\/\\s"'*])`, "i");
				if (dirPattern.test(segment)) {
					return true;
				}
			}
		}
	}

	return false;
}

/**
 * Validates whether a command is safe to execute.
 * Returns safety result with actionable reason if blocked.
 */
export function validateCommandSafety(command: string): CommandSafetyResult {
	if (isDestructiveCommand(command)) {
		return {
			safe: false,
			allowed: false,
			reason: `Destructive command blocked by Studio Safety Guard: "${command}". Destructive git resets, cleans, disk formatters, and recursive deletions on game directories (src/, assets/, design/) are prohibited.`,
		};
	}

	return {
		safe: true,
		allowed: true,
	};
}
