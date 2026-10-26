#!/usr/bin/env node
// Exercises extensions/hooks/studio-exec.ts from a child process.
// Read-only: it runs the requested command and prints the JSON result.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mod = await import(join(repoRoot, "extensions", "hooks", "studio-exec.ts"));

const [mode, ...rest] = process.argv.slice(2);

const out = (value) => {
	process.stdout.write(JSON.stringify(value) + "\n");
};

if (mode === "printf") {
	const [format, ...args] = rest;
	out({ stdout: mod.runCommand("printf", [format, ...args]) });
} else if (mode === "timeout") {
	const options = JSON.parse(rest[0]);
	const [command, ...args] = rest.slice(1);
	const started = Date.now();
	const stdout = mod.runCommand(command, args, options);
	out({ stdout, elapsedMs: Date.now() - started });
} else if (mode === "missing") {
	out({ stdout: mod.runCommand(rest[0]) });
} else if (mode === "git-diff") {
	const [repo, file] = rest;
	out({ stdout: mod.runGit(["diff", "--", file], { cwd: repo }) });
} else {
	process.stderr.write(`unknown mode: ${mode}\n`);
	process.exit(2);
}
