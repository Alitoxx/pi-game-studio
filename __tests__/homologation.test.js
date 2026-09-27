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

	test("setup-engine skill covers all 5 engines in Guided Mode, Stack templates, and Routing", () => {
		const content = fs.readFileSync(
			path.join(__dirname, "..", "skills", "setup-engine", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(content).toContain(engine);
		}
		expect(content).toContain("Appendix A — Godot");
		expect(content).toContain("Appendix B — Bevy");
		expect(content).toContain("Appendix C — Raylib");
	});

	test("dev-story skill routing table includes all 5 engines", () => {
		const content = fs.readFileSync(
			path.join(__dirname, "..", "skills", "dev-story", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(content).toContain(engine);
		}
	});

	test("test-setup and smoke-check skills include test execution for all 5 engines", () => {
		const testSetup = fs.readFileSync(
			path.join(__dirname, "..", "skills", "test-setup", "SKILL.md"),
			"utf8",
		);
		const smokeCheck = fs.readFileSync(
			path.join(__dirname, "..", "skills", "smoke-check", "SKILL.md"),
			"utf8",
		);

		for (const engine of engines) {
			expect(testSetup).toContain(engine);
			expect(smokeCheck).toContain(engine);
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

