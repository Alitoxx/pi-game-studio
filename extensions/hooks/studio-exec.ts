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
}

export function runCommand(
	command: string,
	args?: string[],
	options?: RunOptions,
): string | null {
	try {
		return execFileSync(command, args ?? [], {
			cwd: options?.cwd,
			encoding: "utf8",
			timeout: options?.timeoutMs ?? DEFAULT_TIMEOUT_MS,
			stdio:
				options?.stdio === "inherit"
					? ["ignore", "inherit", "pipe"]
					: ["ignore", "pipe", "pipe"],
		}).trim();
	} catch {
		return null;
	}
}

export function runGit(args: string[], options?: RunOptions): string | null {
	return runCommand("git", args, options);
}
