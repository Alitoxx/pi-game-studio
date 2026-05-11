#!/usr/bin/env node

/**
 * assign-models.js — Bulk model assignment for Pi Game Studio.
 *
 * Two modes:
 *   --tier <json|file>   Assign models by tier (director, workhorse, lightweight)
 *   --map  <json|file>   Assign models per-agent
 *
 * Options:
 *   --dry-run            Preview changes without writing
 *   --apply              Write changes to models.default.json
 *   --config <file>      Read mapping from a JSON file
 *
 * Examples:
 *   node scripts/assign-models.js --dry-run --tier '{
 *     "director": "anthropic/claude-sonnet-4",
 *     "workhorse": "openai/gpt-4o",
 *     "lightweight": "ollama/llama3.2"
 *   }'
 *
 *   node scripts/assign-models.js --apply --tier mapping.json
 *
 *   node scripts/assign-models.js --apply --map '{
 *     "creative-director": "anthropic/claude-sonnet-4"
 *   }'
 */

const fs = require("fs");
const path = require("path");

const PACKAGE_ROOT = path.resolve(__dirname, "..");
const MODELS_FILE = path.join(PACKAGE_ROOT, "models.default.json");

// ── Agent roster by tier ──────────────────────────────────────────
// workhorse excludes agents in lightweight to avoid overlaps.
const LIGHTWEIGHT_AGENTS = [
	"community-manager",
	"devops-engineer",
	"sound-designer",
];

const TIERS = {
	director: ["creative-director", "technical-director", "producer"],
	workhorse: [
		"game-designer",
		"lead-programmer",
		"art-director",
		"audio-director",
		"narrative-director",
		"qa-lead",
		"release-manager",
		"localization-lead",
		"gameplay-programmer",
		"engine-programmer",
		"ai-programmer",
		"network-programmer",
		"tools-programmer",
		"ui-programmer",
		"systems-designer",
		"level-designer",
		"economy-designer",
		"technical-artist",
		"writer",
		"world-builder",
		"ux-designer",
		"prototyper",
		"performance-analyst",
		"analytics-engineer",
		"security-engineer",
		"qa-tester",
		"accessibility-specialist",
		"live-ops-designer",
		"godot-specialist",
		"godot-gdscript-specialist",
		"godot-shader-specialist",
		"godot-gdextension-specialist",
		"godot-csharp-specialist",
		"unity-specialist",
		"unity-dots-specialist",
		"unity-shader-specialist",
		"unity-addressables-specialist",
		"unity-ui-specialist",
		"unreal-specialist",
		"ue-gas-specialist",
		"ue-blueprint-specialist",
		"ue-replication-specialist",
		"ue-umg-specialist",
	],
	lightweight: [...LIGHTWEIGHT_AGENTS],
};

// ── CLI arg parsing ───────────────────────────────────────────────
function parseArgs() {
	const args = process.argv.slice(2);
	const opts = { dryRun: false, apply: false, tier: null, map: null };

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--dry-run":
				opts.dryRun = true;
				break;
			case "--apply":
				opts.apply = true;
				break;
			case "--tier":
				opts.tier = parseArgValue(args[++i]);
				break;
			case "--map":
				opts.map = parseArgValue(args[++i]);
				break;
			case "--config":
				opts.config = args[++i];
				break;
			default:
				console.error(`Unknown option: ${args[i]}`);
				process.exit(1);
		}
	}

	if (!opts.apply && !opts.dryRun) {
		console.error("Specify --dry-run for preview or --apply to write.");
		process.exit(1);
	}

	if (opts.config) {
		const config = JSON.parse(fs.readFileSync(opts.config, "utf-8"));
		if (config.tier) opts.tier = config.tier;
		if (config.map) opts.map = config.map;
	}

	if (!opts.tier && !opts.map) {
		console.error("Specify --tier or --map with a JSON mapping.");
		process.exit(1);
	}

	return opts;
}

function parseArgValue(raw) {
	// If it's a file path, read the file
	if (raw && fs.existsSync(raw)) {
		return JSON.parse(fs.readFileSync(raw, "utf-8"));
	}
	// Otherwise parse as inline JSON
	return JSON.parse(raw);
}

// ── Core logic ────────────────────────────────────────────────────
function expandTierMapping(tierMap) {
	const expanded = {};
	for (const [tier, model] of Object.entries(tierMap)) {
		const agents = TIERS[tier];
		if (!agents) {
			console.warn(`  ⚠ Unknown tier "${tier}" — skipping`);
			continue;
		}
		for (const agent of agents) {
			expanded[agent] = model;
		}
	}
	return expanded;
}

function readCurrentModels() {
	if (!fs.existsSync(MODELS_FILE)) return {};
	return JSON.parse(fs.readFileSync(MODELS_FILE, "utf-8"));
}

function applyMapping(current, mapping) {
	const changes = [];
	for (const [agent, model] of Object.entries(mapping)) {
		if (current[agent] !== model) {
			changes.push({ agent, old: current[agent] || null, new: model });
			current[agent] = model;
		}
	}
	return changes;
}

function groupByTier(flat) {
	const grouped = {};
	for (const [tier, agents] of Object.entries(TIERS)) {
		const tierChanges = agents
			.filter((a) => flat[a])
			.map((a) => ({ agent: a, model: flat[a] }));
		if (tierChanges.length) grouped[tier] = tierChanges;
	}
	return grouped;
}

// ── Report ────────────────────────────────────────────────────────
function showReport(changes, tierMap) {
	if (tierMap) {
		console.log("\nTier mapping:");
		for (const [tier, model] of Object.entries(tierMap)) {
			const count = (TIERS[tier] || []).length;
			console.log(`  ${tier.padEnd(14)} ${model}  (${count} agents)`);
		}
	}

	if (changes.length === 0) {
		console.log("\nNo changes — all agents already match.");
		return;
	}

	console.log(`\nChanges: ${changes.length} agent(s)`);

	// Group by tier for display
	const current = readCurrentModels();
	const after = { ...current };
	for (const c of changes) after[c.agent] = c.new;
	const byTier = groupByTier(after);

	for (const [tier, agents] of Object.entries(byTier)) {
		console.log(`\n  ${tier}:`);
		for (const { agent, model } of agents) {
			const change = changes.find((c) => c.agent === agent);
			if (change) {
				console.log(
					`    ${agent.padEnd(30)} ${(change.old || "(unset)").padEnd(40)} →  ${change.new}`,
				);
			} else {
				console.log(`    ${agent.padEnd(30)} ${model}`);
			}
		}
	}

	// Count by model
	const modelCounts = {};
	for (const c of changes) {
		modelCounts[c.new] = (modelCounts[c.new] || 0) + 1;
	}
	console.log("\nSummary:");
	for (const [model, count] of Object.entries(modelCounts)) {
		console.log(`  ${model.padEnd(45)} ${count} agent(s)`);
	}
}

// ── Write ─────────────────────────────────────────────────────────
function writeModelsFile(models) {
	fs.writeFileSync(
		MODELS_FILE,
		JSON.stringify(models, null, 2) + "\n",
		"utf-8",
	);
	console.log(`\nWrote ${MODELS_FILE}`);
}

// ── Main ──────────────────────────────────────────────────────────
function main() {
	const opts = parseArgs();

	// Read current models
	const current = readCurrentModels();
	console.log(`Current models: ${Object.keys(current).length} agent(s) mapped`);
	console.log(`Agent roster:    ${Object.values(TIERS).flat().length} total`);

	// Resolve mapping
	let mapping = opts.map || {};
	if (opts.tier) {
		mapping = { ...mapping, ...expandTierMapping(opts.tier) };
	}

	// Apply
	const changes = applyMapping(current, mapping);
	showReport(changes, opts.tier, mapping);

	// Write
	if (opts.apply && changes.length > 0) {
		writeModelsFile(current);
		console.log(`Done. ${changes.length} agent(s) updated.`);
	} else if (opts.apply && changes.length === 0) {
		console.log("\nNothing to write.");
	}

	// Exit with error if dry-run showed changes and user should run --apply
	if (opts.dryRun && changes.length > 0) {
		console.log("\nRun with --apply to write these changes.");
	}
}

main();
