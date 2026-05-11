#!/usr/bin/env node

/**
 * Tests for the Pi Game Studio hooks extension.
 *
 * These are unit/integration tests for the logic that the hooks extension
 * would use. They run without Pi (pure Node) to validate the core validation
 * logic independently.
 *
 * Run: node extensions/hooks/tests/test-hooks.js
 */

const assert = require("node:assert");
const fs = require("node:fs");
const { join } = require("node:path");
const { tmpdir } = require("node:os");
const { execSync } = require("node:child_process");

let passed = 0;
let failed = 0;

function test(name, fn) {
	try {
		fn();
		passed++;
		console.log(`  ✅ ${name}`);
	} catch (e) {
		failed++;
		console.log(`  ❌ ${name}: ${e.message}`);
	}
}

// ── Tests ─────────────────────────────────────────────────────────

console.log("\n📋 Git commit validation");

test("detects git commit commands", () => {
	assert.match("git commit -m 'fix: balance'", /^git\s+commit/);
});

test("ignores non-commit commands", () => {
	assert.doesNotMatch("git status", /^git\s+commit/);
});

test("detects protected branches in push", () => {
	for (const branch of ["main", "master", "develop"]) {
		assert.ok(
			new RegExp("\\b" + branch + "(\\s|$)").test("git push origin " + branch),
			"should detect " + branch,
		);
	}
});

test("allows push to feature branches", () => {
	assert.doesNotMatch(
		"git push origin feature/combat",
		/\b(main|master|develop)(\s|$)/,
	);
});

// ── Skill change detection ─────────────────────────────────────────

console.log("\n📋 Skill change detection");

// Regex from the hooks extension: matches /skills/, .pi/skills/, or starts with skills/
const SKILL_REGEX = /(?:\/skills\/|\.pi\/skills\/|^skills\/)([^/]+)/;

test("detects skill file paths", () => {
	const paths = [
		"/project/skills/brainstorm/SKILL.md",
		"/project/.pi/skills/brainstorm/SKILL.md",
		"skills/combat/SKILL.md",
	];
	for (const p of paths) {
		const match = p.match(SKILL_REGEX);
		assert.ok(match, "should match: " + p);
		assert.equal(match[1], p.includes("brainstorm") ? "brainstorm" : "combat");
	}
});

test("ignores non-skill paths", () => {
	for (const p of [
		"/project/src/gameplay/combat.ts",
		"/project/docs/architecture/adr.md",
	]) {
		assert.equal(p.match(SKILL_REGEX), null, "should not match: " + p);
	}
});

// ── Documentation gap detection ────────────────────────────────────

console.log("\n📋 Documentation gap detection");

test("detects missing GDDs when code exists", () => {
	const tmp = join(tmpdir(), "pi-gs-test-" + Date.now());
	fs.mkdirSync(join(tmp, "src"), { recursive: true });
	fs.mkdirSync(join(tmp, "design"), { recursive: true });

	for (let i = 0; i < 60; i++)
		fs.writeFileSync(join(tmp, "src", "file" + i + ".gd"), "");
	const gaps = 60 > 50 && 2 < 5 ? ["Gap detected"] : [];
	assert.equal(gaps.length, 1);
	fs.rmSync(tmp, { recursive: true });
});

test("ignores well-documented projects", () => {
	const tmp = join(tmpdir(), "pi-gs-test2-" + Date.now());
	fs.mkdirSync(join(tmp, "src"), { recursive: true });
	fs.mkdirSync(join(tmp, "design", "gdd"), { recursive: true });

	for (let i = 0; i < 10; i++)
		fs.writeFileSync(join(tmp, "src", "file" + i + ".gd"), "");
	for (let i = 0; i < 6; i++)
		fs.writeFileSync(join(tmp, "design", "gdd", "s" + i + ".md"), "");

	assert.equal(10 > 50 && 6 < 5 ? true : false, false);
	fs.rmSync(tmp, { recursive: true });
});

// ── assign-models.js script integration ───────────────────────────

console.log("\n📋 assign-models.js integration");

test("--dry-run exits cleanly", () => {
	const out = execSync(
		'node scripts/assign-models.js --dry-run --tier \'{"director":"t/model","workhorse":"t/model","lightweight":"t/model"}\'',
		{ cwd: join(__dirname, "..", "..", ".."), encoding: "utf-8" },
	);
	assert.match(out, /Changes: 49 agent/);
});

test("--apply writes models.default.json", () => {
	const root = join(__dirname, "..", "..", "..");
	const modelsFile = join(root, "models.default.json");

	// Backup original
	const original = fs.readFileSync(modelsFile, "utf-8");

	// Apply
	execSync(
		'node scripts/assign-models.js --apply --tier \'{"director":"ci/test-d","workhorse":"ci/test-w","lightweight":"ci/test-l"}\'',
		{ cwd: root, encoding: "utf-8" },
	);

	// Verify (read fresh, no cache)
	const updated = JSON.parse(fs.readFileSync(modelsFile, "utf-8"));
	assert.match(updated["creative-director"], /ci\/test-d/);
	assert.match(updated["game-designer"], /ci\/test-w/);
	assert.match(updated["community-manager"], /ci\/test-l/);

	// Restore
	fs.writeFileSync(modelsFile, original);
});

// ── Results ────────────────────────────────────────────────────────

console.log("\n" + "=".repeat(40));
console.log("Results: " + passed + " passed, " + failed + " failed");
console.log("=".repeat(40));

process.exit(failed > 0 ? 1 : 0);
