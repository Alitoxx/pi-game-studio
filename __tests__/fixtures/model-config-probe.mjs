#!/usr/bin/env node
// Prints the model-resolution decisions for a given project root.
// Usage: node model-config-probe.mjs <projectRoot>
// Read-only: reads .pi/*/models.json, writes nothing.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const projectRoot = process.argv[2];
if (!projectRoot) {
	process.stderr.write("missing project root\n");
	process.exit(2);
}

const mod = await import(join(repoRoot, "extensions", "hooks", "studio-model-config.ts"));

const agents = [
	"producer",
	"creative-director",
	"gameplay-programmer",
	"bevy-specialist",
	"qa-verifier",
];

const resolved = {};
for (const agent of agents) {
	resolved[agent] = mod.resolveAgentModel(projectRoot, agent) ?? null;
}

const choose = {
	// Template declares an explicit model: the role contract wins over project config.
	manifestExplicit: mod.chooseModelForAgent({
		manifestModel: "vendor/role-model",
		projectRoot,
		agentName: "bevy-specialist",
		activeModel: "vendor/session-model",
	}),
	// Configured agent key wins over the session model.
	configBeatsSession: mod.chooseModelForAgent({
		manifestModel: "inherit",
		projectRoot,
		agentName: "bevy-specialist",
		activeModel: "vendor/session-model",
	}),
	// Configured tier key applies when the agent has no key of its own.
	configTier: mod.chooseModelForAgent({
		manifestModel: "inherit",
		projectRoot,
		agentName: "creative-director",
		activeModel: "vendor/session-model",
	}),
	// Nothing configured: the session model is inherited.
	fallbackSession: mod.chooseModelForAgent({
		manifestModel: "inherit",
		projectRoot,
		agentName: "qa-verifier",
		activeModel: "vendor/session-model",
	}),
	// Nothing configured and no session model: literal inherit.
	fallbackInherit: mod.chooseModelForAgent({
		manifestModel: undefined,
		projectRoot,
		agentName: "qa-verifier",
		activeModel: undefined,
	}),
};

process.stdout.write(
	JSON.stringify(
		{
			tiers: {
				producer: mod.modelTierForAgent("producer"),
				"creative-director": mod.modelTierForAgent("creative-director"),
				"technical-director": mod.modelTierForAgent("technical-director"),
				"game-designer": mod.modelTierForAgent("game-designer"),
				"bevy-specialist": mod.modelTierForAgent("bevy-specialist"),
				"qa-verifier": mod.modelTierForAgent("qa-verifier"),
			},
			resolved,
			choose,
		},
		null,
		2,
	) + "\n",
);
