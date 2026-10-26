#!/usr/bin/env node
// Exercises extensions/hooks/studio-fs.ts from a child process so the atomic
// write path can be observed on a real filesystem, not a mocked one.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chmodSync, readdirSync, readFileSync, statSync } from "node:fs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const mod = await import(join(repoRoot, "extensions", "hooks", "studio-fs.ts"));

const [mode, ...rest] = process.argv.slice(2);
const out = (value) => {
	process.stdout.write(JSON.stringify(value) + "\n");
};

if (mode === "write") {
	const [file, content] = rest;
	mod.writeFileAtomicSync(file, content, "utf8");
	out({ content: readFileSync(file, "utf8"), entries: readdirSync(dirname(file)).sort() });
} else if (mode === "json") {
	const [file, raw] = rest;
	mod.writeJsonAtomicSync(file, JSON.parse(raw));
	out({ content: readFileSync(file, "utf8"), entries: readdirSync(dirname(file)).sort() });
} else if (mode === "mode") {
	// An existing 0600 config must not become world-readable just because it was
	// replaced by a freshly created temp file.
	const [file] = rest;
	mod.writeFileAtomicSync(file, "replaced", "utf8");
	out({ mode: (statSync(file).mode & 0o777).toString(8), content: readFileSync(file, "utf8") });
} else if (mode === "fail") {
	// A write that cannot complete must leave the previous bytes intact and no
	// temp residue behind: a read-only directory is the cheapest real failure.
	const [dir, file] = rest;
	let error = null;
	try {
		mod.writeFileAtomicSync(file, "clobbered", "utf8");
	} catch (e) {
		error = e?.code || e?.message || String(e);
	}
	chmodSync(dir, 0o755);
	out({ error, content: readFileSync(file, "utf8"), entries: readdirSync(dir).sort() });
} else if (mode === "binary") {
	const [file] = rest;
	const bytes = Buffer.from([0x00, 0xff, 0x10, 0x7f]);
	mod.writeFileAtomicSync(file, bytes);
	out({ bytes: Array.from(readFileSync(file)), entries: readdirSync(dirname(file)).sort() });
} else {
	out({ error: `unknown mode: ${mode}` });
	process.exit(2);
}
