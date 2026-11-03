#!/usr/bin/env node
// Runs /studio:profile against a throwaway project with no UI and reports what it
// wrote to stdout. The handler used to deliver its report only through
// ctx.ui.notify, so a non-UI session got nothing at all.
//
// The repo root is derived from this file's location, never hardcoded: a CI
// runner checks the repository out somewhere else, and a literal host path there
// fails with ERR_MODULE_NOT_FOUND instead of running the probe.
// Usage: node profile-probe.mjs
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { handleStudioProfile } = await import(join(repoRoot, "extensions", "hooks", "studio-profile.ts"));

const dir = mkdtempSync(join(tmpdir(), "profile-probe-"));
writeFileSync(join(dir, "project.yaml"), 'schema_version: 1\nengine: "Godot"\ndimension: "2d"\nlanguage: "es"\n');

const printed = [];
const notifies = [];
const origLog = console.log;
console.log = (...args) => printed.push(args.join(" "));

const ctx = {
	cwd: dir,
	hasUI: false,
	ui: { notify: (...args) => notifies.push(args.join(" ")) },
};

try {
	await handleStudioProfile("", ctx);
} finally {
	console.log = origLog;
}

process.stdout.write(
	JSON.stringify({
		printedCount: printed.length,
		printed: printed.join("\n").slice(0, 600),
		notified: notifies.length,
	}) + "\n",
);
