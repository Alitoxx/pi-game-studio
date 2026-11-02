#!/usr/bin/env node
// Reports which engine the studio treats as authoritative for a project directory
// and which compile command it would run for it.
// Usage: node engine-authority-probe.mjs <projectDir>
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectDir = process.argv[2];
if (!projectDir) {
	process.stderr.write("missing project dir\n");
	process.exit(2);
}

const { detectProjectEngine } = await import(join(repoRoot, "extensions", "hooks", "engine-detector.ts"));
const { getEngineCompileCommand } = await import(join(repoRoot, "extensions", "hooks", "studio-watch.ts"));

const detected = detectProjectEngine(projectDir);
const compile = getEngineCompileCommand(detected.detected ? detected.engine : "Desconocido", projectDir);

process.stdout.write(
	JSON.stringify(
		{
			engine: detected.engine,
			language: detected.language,
			sourceFile: detected.sourceFile,
			isConfigured: detected.isConfigured,
			compileEngine: compile.engine,
			compileCommand: compile.command ?? null,
		},
		null,
		2,
	) + "\n",
);
