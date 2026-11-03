#!/usr/bin/env node
// Reports the studio status line injected into the agent guidance for the roster
// shapes the studio can actually be in. Usage: node studio-status-probe.mjs
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { buildStudioStatusLine } = await import(join(repoRoot, "extensions", "hooks", "studio-setup.ts"));

const PACKAGE_ROSTER = [
	"producer",
	"creative-director",
	"technical-director",
	"game-designer",
	"gameplay-programmer",
	"art-director",
	"audio-director",
	"qa-lead",
	"godot-specialist",
	"qa-verifier",
];

const cases = {
	packageOnly: {
		agentsInstalled: 0,
		expectedAgents: 10,
		currentEngine: "Godot",
		missingAgents: PACKAGE_ROSTER,
		availableAgents: PACKAGE_ROSTER,
	},
	noRoster: {
		agentsInstalled: 0,
		expectedAgents: 10,
		currentEngine: "Godot",
		missingAgents: PACKAGE_ROSTER,
		availableAgents: [],
	},
	partialOverrides: {
		agentsInstalled: 9,
		expectedAgents: 10,
		currentEngine: "Godot",
		missingAgents: ["qa-verifier"],
		availableAgents: PACKAGE_ROSTER,
	},
	complete: {
		agentsInstalled: 10,
		expectedAgents: 10,
		currentEngine: "Godot",
		missingAgents: [],
		availableAgents: PACKAGE_ROSTER,
	},
};

const out = {};
for (const [name, input] of Object.entries(cases)) out[name] = buildStudioStatusLine(input);

process.stdout.write(JSON.stringify(out, null, 2) + "\n");
