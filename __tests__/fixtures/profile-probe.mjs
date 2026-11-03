#!/usr/bin/env node
// Runs /studio:profile against a throwaway project with no UI and reports what it
// wrote to stdout. The handler used to deliver its report only through
// ctx.ui.notify, so a non-UI session got nothing at all.
// Usage: node profile-probe.mjs
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repo = "/Users/alexis/Developer/pi-game-studio";
const { handleStudioProfile } = await import(join(repo, "extensions", "hooks", "studio-profile.ts"));

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
