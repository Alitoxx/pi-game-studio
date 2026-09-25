const fs = require("fs");
const path = require("path");

describe("Pi Game Studio Extension Commands (studio:*)", () => {
	const hooksSource = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
		"utf8",
	);

	const registered = [
		...hooksSource.matchAll(
			/registerCommand\?\.\(\s*["\x27]([^"\x27]+)["\x27]\s*,\s*\{([^}]+)\}/gs,
		),
	].map((m) => {
		const name = m[1];
		const block = m[2];
		const descMatch = block.match(/description:\s*["\x27]([^"\x27]+)["\x27]/);
		return {
			name,
			description: descMatch ? descMatch[1] : "",
		};
	});

	test("registers all required studio suite commands", () => {
		const expectedCommands = [
			"studio",
			"studio:setup",
			"studio:models",
			"studio:status",
			"studio:agents",
			"studio:settings",
			"studio:help",
		];

		const names = registered.map((r) => r.name);
		for (const expected of expectedCommands) {
			expect(names).toContain(expected);
		}
	});

	test("every studio command has a descriptive label with the studio badge", () => {
		for (const cmd of registered) {
			expect(cmd.description).toContain("🎮 [Studio]");
		}
	});

	test("agent groups cover all 50 agents without duplicates", () => {
		const agentsSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-agents.ts"),
			"utf8",
		);

		const agentMatches = [
			...agentsSource.matchAll(/["']([a-z0-9-]+-director|[a-z0-9-]+-programmer|[a-z0-9-]+-designer|[a-z0-9-]+-specialist|[a-z0-9-]+-lead|[a-z0-9-]+-engineer|[a-z0-9-]+-tester|[a-z0-9-]+-analyst|[a-z0-9-]+-manager|[a-z0-9-]+-artist|writer|world-builder|prototyper|producer)["']/g),
		].map((m) => m[1]);

		const uniqueAgents = Array.from(new Set(agentMatches));
		expect(uniqueAgents.length).toBe(50);
	});

	test("all interactive select handlers support Pi string return values", () => {
		const files = [
			"studio-setup.ts",
			"studio-models.ts",
			"studio-command.ts",
			"studio-agents.ts",
			"studio-settings.ts",
		];

		for (const file of files) {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", file),
				"utf8",
			);
			if (source.includes(".select(")) {
				expect(source).toContain("indexOf(");
			}
		}
	});

	test("provider resolver exposes getAvailableProviders and promptModelForRole", () => {
		const resolverSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "provider-resolver.ts"),
			"utf8",
		);

		expect(resolverSource).toContain("export async function getAvailableProviders");
		expect(resolverSource).toContain("export async function promptModelForRole");
		expect(resolverSource).toContain("KNOWN_PROVIDER_RECOMMENDATIONS");
	});
});
