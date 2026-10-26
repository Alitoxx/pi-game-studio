#!/usr/bin/env node
// Reports what inspectSetup concludes for a given project directory.
// Usage: node setup-probe.mjs <projectDir>
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectDir = process.argv[2];
if (!projectDir) {
	process.stderr.write("missing project dir\n");
	process.exit(2);
}

const { inspectSetup } = await import(join(repoRoot, "extensions", "hooks", "studio-setup.ts"));
const setup = await inspectSetup(projectDir);

process.stdout.write(
	JSON.stringify(
		{
			engine: setup.currentEngine,
			expectedAgents: setup.expectedAgents,
			agentsInstalled: setup.agentsInstalled,
			isConfigured: setup.isConfigured,
			missingAgents: setup.missingAgents ?? null,
			engineSupported: setup.engineSupported,
			supportedEngines: setup.supportedEngines ?? null,
		},
		null,
		2,
	) + "\n",
);
