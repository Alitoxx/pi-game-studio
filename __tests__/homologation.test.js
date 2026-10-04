const fs = require("fs");
const path = require("path");

function countFiles(dir, predicate) {
	return fs.readdirSync(dir, { withFileTypes: true }).filter(predicate).length;
}

function countMarkdownFilesRecursive(dir) {
	let total = 0;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			total += countMarkdownFilesRecursive(fullPath);
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			total += 1;
		}
	}
	return total;
}

describe("Homologation metadata", () => {
	test("README inventory counts match repository contents", () => {
		const readme = fs.readFileSync(
			path.join(__dirname, "..", "README.md"),
			"utf8",
		);

		const agents = countFiles(
			path.join(__dirname, "..", "agents"),
			(d) => d.isFile() && d.name.endsWith(".md"),
		);
		const skills = fs
			.readdirSync(path.join(__dirname, "..", "skills"), {
				withFileTypes: true,
			})
			.filter(
				(d) =>
					d.isDirectory() &&
					fs.existsSync(
						path.join(__dirname, "..", "skills", d.name, "SKILL.md"),
					),
			).length;
		const prompts = countMarkdownFilesRecursive(
			path.join(__dirname, "..", "prompts"),
		);
		const hooksSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
			"utf8",
		);
		const hooks = (hooksSource.match(/pi\.on\(/g) || []).length;

		expect(readme).toContain(`${agents} agents`);
		expect(readme).toContain(`${skills} skills`);
		expect(readme).toContain(`${prompts} templates`);
		expect(readme).toContain(`${hooks} hooks`);
	});

	test("README hooks inventory table reflects the actual handler count", () => {
		const readme = fs.readFileSync(
			path.join(__dirname, "..", "README.md"),
			"utf8",
		);
		const hooksSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
			"utf8",
		);
		const hooks = (hooksSource.match(/pi\.on\(/g) || []).length;
		const hooksRow = readme
			.split("\n")
			.find((line) => line.includes("**Hooks**"));

		expect(hooksRow).toBeDefined();
		expect(hooksRow).toMatch(
			new RegExp(`\\| \\*\\*Hooks\\*\\*\\s*\\|\\s*${hooks}\\s*\\|`),
		);
	});
});

describe("Engine Support Symmetry (Godot, Unity, Unreal, Bevy, Raylib)", () => {
	const engines = ["Godot", "Unity", "Unreal", "Bevy", "Raylib"];

	test("arch skill covers all 5 engines in Guided Mode, Stack templates, and Routing", () => {
		const content = fs.readFileSync(
			path.join(__dirname, "..", "skills", "arch", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(content).toContain(engine);
		}
		expect(content).toContain("Appendix A — Godot");
		expect(content).toContain("Appendix B — Bevy");
		expect(content).toContain("Appendix C — Raylib");
	});

	test("code skill routing table includes all 5 engines", () => {
		const content = fs.readFileSync(
			path.join(__dirname, "..", "skills", "code", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(content).toContain(engine);
		}
	});

	test("test skill includes test execution for all 5 engines", () => {
		const testSkill = fs.readFileSync(
			path.join(__dirname, "..", "skills", "test", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(testSkill).toContain(engine);
		}
	});

	test("models.default.json maps all 5 engine primary specialists", () => {
		const defaultModels = JSON.parse(
			fs.readFileSync(
				path.join(__dirname, "..", "models.default.json"),
				"utf8",
			),
		);

		expect(defaultModels["godot-specialist"]).toBeDefined();
		expect(defaultModels["unity-specialist"]).toBeDefined();
		expect(defaultModels["unreal-specialist"]).toBeDefined();
		expect(defaultModels["bevy-specialist"]).toBeDefined();
		expect(defaultModels["raylib-specialist"]).toBeDefined();
	});
});

describe("8+1 Core Agents Reference Purity", () => {
	const coreAgents = [
		"producer.md",
		"creative-director.md",
		"technical-director.md",
		"game-designer.md",
		"gameplay-programmer.md",
		"art-director.md",
		"audio-director.md",
		"qa-lead.md",
	];

	const retiredRoles = [
		"lead-programmer",
		"systems-designer",
		"narrative-director",
		"technical-artist",
		"engine-programmer",
		"network-programmer",
		"ai-programmer",
		"ui-programmer",
	];

	const legacyCommands = [
		"/smoke-check",
		"/qa-plan",
		"/team-qa",
		"/story-readiness",
		"/code-review",
		"/architecture-decision",
	];

	test("core 8 agents do not reference retired roles", () => {
		for (const agentFile of coreAgents) {
			const content = fs.readFileSync(
				path.join(__dirname, "..", "agents", agentFile),
				"utf8",
			);
			for (const role of retiredRoles) {
				expect(content).not.toContain(role);
			}
		}
	});

	test("core 8 agents do not reference legacy slash commands", () => {
		for (const agentFile of coreAgents) {
			const content = fs.readFileSync(
				path.join(__dirname, "..", "agents", agentFile),
				"utf8",
			);
			for (const cmd of legacyCommands) {
				expect(content).not.toContain(cmd);
			}
		}
	});

	test("core 8 agents do not reference orphaned session-state/active.md", () => {
		for (const agentFile of coreAgents) {
			const content = fs.readFileSync(
				path.join(__dirname, "..", "agents", agentFile),
				"utf8",
			);
			expect(content).not.toContain("session-state/active.md");
		}
	});
});

