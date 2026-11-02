#!/usr/bin/env node
// Reports the studio status line injected into the agent guidance for three
// roster states. Usage: node studio-status-probe.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { buildStudioStatusLine } = await import(join(repoRoot, "extensions", "hooks", "studio-setup.ts"));

const cases = {
	none: { agentsInstalled: 0, expectedAgents: 10, currentEngine: "Godot", missingAgents: [] },
	partial: {
		agentsInstalled: 9,
		expectedAgents: 10,
		currentEngine: "Godot",
		missingAgents: ["qa-verifier"],
	},
	complete: { agentsInstalled: 10, expectedAgents: 10, currentEngine: "Godot", missingAgents: [] },
};

const out = {};
for (const [name, input] of Object.entries(cases)) out[name] = buildStudioStatusLine(input);

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
