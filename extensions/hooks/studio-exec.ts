import { execFileSync } from "node:child_process";

// Single execution door for every shell-out in the extension: commands run with
// an argument array (never a shell string), a bounded timeout, and stdout
// captured as UTF-8 text. Any failure — non-zero exit, missing binary (ENOENT),
// or timeout — resolves to `null`; this function never throws.

export const DEFAULT_TIMEOUT_MS = 5000;

export interface RunOptions {
	cwd?: string;
	timeoutMs?: number;
	stdio?: "pipe" | "inherit";
	/**
	 * Trim leading and trailing whitespace from stdout. Defaults to true, which is
	 * what callers reading a single value want. Set it to false for output whose
	 * whitespace is part of the format: `git status --porcelain` prefixes a
	 * worktree-only change with a space, so trimming shifts the first path by one
	 * character and every parser built on the trimmed text is off by one.
	 */
	trim?: boolean;
}

export function runCommand(
	command: string,
	args?: string[],
	options?: RunOptions,
): string | null {
	try {
		const stdout = execFileSync(command, args ?? [], {
			cwd: options?.cwd,
			encoding: "utf8",
			timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			stdio:
				options?.stdio === "inherit"
					? ["ignore", "inherit", "pipe"]
					: ["ignore", "pipe", "pipe"],
		});
		return options?.trim === false ? stdout : stdout.trim();
	} catch {
		return null;
	}
}

export function runGit(args: string[], options?: RunOptions): string | null {
	return runCommand("git", args, options);
}
