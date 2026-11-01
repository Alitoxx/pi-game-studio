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
 * A value is either "inherit" (the agent uses the session model) or a
 * `provider/model` pair. Anything else is rejected before anything is written: a
 * model id the environment cannot resolve is worse than no assignment at all.
 *
 * Examples:
 *   node scripts/assign-models.js --dry-run --tier '{
 *     "director": "anthropic/claude-sonnet-4",
 *     "workhorse": "openai/gpt-4o",
 *     "lightweight": "ollama/llama3.2"
 *   }'
 *
 *   node scripts/assign-models.js --apply --tier '{
 *     "director": "inherit",
 *     "workhorse": "inherit",
 *     "lightweight": "inherit"
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

const INHERIT = "inherit";
// The three tiers are the only keys models.default.json may ship.
const KNOWN_TIERS = ["director", "workhorse", "lightweight"];
// "inherit" or a provider/model pair. A bare model name has no provider, so it can
// never resolve and must not reach the manifest.
const MODEL_VALUE = /^[^/\s]+\/\S+$/;

function isValidModelValue(value) {
	return (
		typeof value === "string" &&
		(value.trim() === INHERIT || MODEL_VALUE.test(value.trim()))
	);
}

// ── Agent roster by tier (Compact 8+1 Studio Architecture: 15 agents total) ────
// 8 core roles + 6 engine specialists + 1 always-installed read-only verifier.
// Reporting only: the manifest holds tier keys, never agent keys, so this roster is
// used to say which agents a tier mapping affects, not to expand the write.
// No agent defaults to the lightweight tier: the runtime (studio-models.ts) resolves
// every non-director, non-engine agent to the workhorse tier, and art/audio directors
// are Tier 2 leads with thinking: medium. The tier stays available as a model value.
const LIGHTWEIGHT_AGENTS = [];

const TIERS = {
	director: ["creative-director", "technical-director", "producer"],
	workhorse: [
		"game-designer",
		"gameplay-programmer",
		"art-director",
		"audio-director",
		"qa-lead",
		"qa-verifier",
		"bevy-specialist",
		"godot-specialist",
		"phaser-specialist",
		"raylib-specialist",
		"unity-specialist",
		"unreal-specialist",
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
function readCurrentModels() {
	if (!fs.existsSync(MODELS_FILE)) return {};
	try {
		return JSON.parse(fs.readFileSync(MODELS_FILE, "utf-8"));
	} catch {
		return {};
	}
}

/** The tiers the manifest itself declares; all three when it declares none. */
function declaredTierKeys(current) {
	const declared = Object.keys(current).filter((key) => KNOWN_TIERS.includes(key));
	return declared.length > 0 ? declared : [...KNOWN_TIERS];
}

/**
 * Tier mappings are written as tier keys. Expanding them into per-agent keys would
 * leave the tier's own value untouched (a stale, unresolvable id) and fill the
 * defaults with agent-only keys.
 */
function planTierMapping(tierMap, current) {
	const plan = [];
	for (const [tier, raw] of Object.entries(tierMap)) {
		if (!KNOWN_TIERS.includes(tier)) {
			console.warn(`  ⚠ Unknown tier "${tier}" — skipping`);
			continue;
		}
		if (!isValidModelValue(raw)) {
			throw new Error(
				`Invalid model for tier "${tier}": ${JSON.stringify(raw)} — expected "inherit" or "provider/model".`,
			);
		}
		plan.push({
			tier,
			model: raw.trim(),
			old: current[tier] || null,
			agents: TIERS[tier] || [],
		});
	}
	return plan;
}

function planAgentMapping(agentMap, current) {
	const plan = [];
	for (const [agent, raw] of Object.entries(agentMap)) {
		if (!isValidModelValue(raw)) {
			throw new Error(
				`Invalid model for agent "${agent}": ${JSON.stringify(raw)} — expected "inherit" or "provider/model".`,
			);
		}
		plan.push({ agent, model: raw.trim(), old: current[agent] || null });
	}
	return plan;
}

function changed(plan) {
	return plan.filter((entry) => entry.old !== entry.model);
}

function applyPlan(current, plan) {
	const next = { ...current };
	for (const entry of plan) {
		const key = entry.tier || entry.agent;
		next[key] = entry.model;
	}
	return next;
}

// ── Report ────────────────────────────────────────────────────────
function showReport({ tierPlan, agentPlan, tierKeys }) {
	console.log(`\nTier keys in models.default.json: ${tierKeys.join(", ")}`);

	if (tierPlan.length > 0) {
		console.log("\nTier mapping:");
		for (const entry of tierPlan) {
			const count = entry.agents.length;
			console.log(`  ${entry.tier.padEnd(14)} ${entry.model}  (${count} agents)`);
		}
	}

	if (agentPlan.length > 0) {
		console.log("\nAgent mapping:");
		for (const entry of agentPlan) {
			console.log(`  ${entry.agent.padEnd(24)} ${entry.model}`);
		}
	}

	const tierChanges = changed(tierPlan);
	const agentChanges = changed(agentPlan);

	if (tierChanges.length === 0 && agentChanges.length === 0) {
		console.log("\nNo changes — the manifest already matches.");
		return 0;
	}

	console.log(`\nChanges: ${tierChanges.length + agentChanges.length}`);
	for (const entry of tierChanges) {
		console.log(`  ${entry.tier}: ${entry.old || "(unset)"} → ${entry.model}`);
		if (entry.agents.length > 0) {
			console.log(`    agents affected: ${entry.agents.join(", ")}`);
		}
	}
	for (const entry of agentChanges) {
		console.log(`  ${entry.agent}: ${entry.old || "(unset)"} → ${entry.model}`);
	}

	// One line for humans and for the CI guard that reads this report.
	console.log(
		`\nSummary: ${tierChanges.length + agentChanges.length} pending change(s) — run with --apply to write them`,
	);

	return tierChanges.length + agentChanges.length;
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

	const current = readCurrentModels();
	const tierKeys = declaredTierKeys(current);
	console.log(`Current manifest: ${Object.keys(current).length} key(s) mapped`);
	console.log(`Agent roster:     ${Object.values(TIERS).flat().length} agents`);

	let tierPlan = [];
	let agentPlan = [];
	try {
		tierPlan = opts.tier ? planTierMapping(opts.tier, current) : [];
		agentPlan = opts.map ? planAgentMapping(opts.map, current) : [];
	} catch (error) {
		// Nothing is written when the mapping is not a value the runtime can resolve.
		console.error(`\n✗ ${error.message}`);
		process.exit(1);
	}

	const changeCount = showReport({ tierPlan, agentPlan, tierKeys });

	if (opts.apply && changeCount > 0) {
		writeModelsFile(applyPlan(current, [...tierPlan, ...agentPlan]));
		console.log(`Done. ${changeCount} key(s) updated.`);
	} else if (opts.apply) {
		console.log("\nNothing to write.");
	}

	if (opts.dryRun && changeCount > 0) {
		console.log("\nRun with --apply to write these changes.");
	}

	if (agentPlan.length > 0) {
		console.log(
			"\nPer-agent overrides belong in <project>/.pi/game-studio/models.json, which /studio:models writes.",
		);
	}
}

main();
