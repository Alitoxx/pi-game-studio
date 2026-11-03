#!/usr/bin/env node
// Builds a throwaway git repository and reports what getGitStatus returns for it.
// The first porcelain line of a worktree-only change starts with a space, so any
// leading-trim of the whole output shifts that path by one character.
// Usage: node changes-status-probe.mjs
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { getGitStatus } = await import(join(repoRoot, "extensions", "hooks", "studio-changes.ts"));

const dir = mkdtempSync(join(tmpdir(), "changes-probe-"));
const git = (...args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });

git("init", "-q");
git("config", "user.email", "probe@example.test");
git("config", "user.name", "probe");

// a.txt sorts first, so its worktree-only change is the first porcelain line.
writeFileSync(join(dir, "a.txt"), "uno\n");
writeFileSync(join(dir, "b.txt"), "uno\n");
writeFileSync(join(dir, "mover.txt"), "uno\n");
git("add", "-A");
git("commit", "-qm", "init");

writeFileSync(join(dir, "a.txt"), "dos\n");
git("mv", "mover.txt", "movido.txt");
writeFileSync(join(dir, "nuevo.txt"), "tres\n");

const status = getGitStatus(dir);
process.stdout.write(
	JSON.stringify(
		{
			porcelain: git("status", "--porcelain").split("\n").filter(Boolean),
			parsed: status.map((entry) => ({ path: entry.path, status: entry.status })),
		},
		null,
		2,
	) + "\n",
);
