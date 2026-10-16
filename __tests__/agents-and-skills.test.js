const fs = require("fs");
const path = require("path");

describe("Exhaustive Agent Validation (Compact 8+1 Studio Architecture: 14 Agents)", () => {
	const agentsDir = path.join(__dirname, "..", "agents");
	const agentFiles = fs
		.readdirSync(agentsDir)
		.filter((f) => f.endsWith(".md"));

	test("exactly 14 agent files exist in agents/ directory", () => {
		expect(agentFiles.length).toBe(14);
	});

	const validPiTools = [
		"read",
		"write",
		"edit",
		"find",
		"grep",
		"bash",
		"web_search",
		"subagent_run",
		"ask_user_question",
	];

	test.each(agentFiles)(
		"agent file '%s' has valid frontmatter, thinking level, and Pi tools",
		(filename) => {
			const filePath = path.join(agentsDir, filename);
			const content = fs.readFileSync(filePath, "utf8");
			const bodyParts = content.split("---");

			// 1. Must have valid frontmatter
			expect(content.startsWith("---")).toBe(true);
			expect(bodyParts.length).toBeGreaterThanOrEqual(3);

			// 2. Name must match filename without .md
			const expectedName = filename.replace(/\.md$/, "");
			const nameMatch = content.match(/^name:\s*([a-z0-9-]+)/m);
			expect(nameMatch).not.toBeNull();
			expect(nameMatch[1]).toBe(expectedName);

			// 3. Must have a descriptive description
			const descMatch = content.match(/^description:\s*["']?([^\n"']+)["']?/m);
			expect(descMatch).not.toBeNull();
			expect(descMatch[1].trim().length).toBeGreaterThan(15);

			// 4. Thinking level must be high, medium, or low
			const thinkingMatch = content.match(/^thinking:\s*(high|medium|low)/m);
			expect(thinkingMatch).not.toBeNull();

			// 5. Tools declaration must be valid in frontmatter
			const frontmatter = bodyParts[1];
			expect(frontmatter).toMatch(/^tools:\n(\s+-\s+[a-z_]+\n)+/m);
			const toolsSection = frontmatter.match(/^tools:\n((?:\s+-\s+[a-z_]+\n?)+)/m);
			expect(toolsSection).not.toBeNull();
			const toolLines = [
				...toolsSection[1].matchAll(/^\s+-\s+([a-z_]+)/gm),
			].map((m) => m[1]);
			expect(toolLines.length).toBeGreaterThan(0);
			for (const t of toolLines) {
				expect(validPiTools).toContain(t);
			}

			// 6. Must have instructions / body text
			const body = bodyParts.slice(2).join("---").trim();
			expect(body.length).toBeGreaterThan(100);

			// 7. Must not contain legacy Claude Code directive inheritProjectContext
			expect(frontmatter).not.toMatch(/inheritProjectContext/);
		},
	);

	const implementerAgents = [
		"gameplay-programmer.md",
		"bevy-specialist.md",
		"godot-specialist.md",
		"phaser-specialist.md",
		"raylib-specialist.md",
		"unity-specialist.md",
		"unreal-specialist.md",
	];

	test.each(implementerAgents)(
		"implementer agent '%s' explicitly enforces bounded edit surfaces rule",
		(filename) => {
			const filePath = path.join(agentsDir, filename);
			const content = fs.readFileSync(filePath, "utf8");
			expect(content).toContain("## Allowed edit surfaces");
			expect(content).toContain("Bounded Edit Surfaces");
		},
	);

	test("producer.md specifies subagent dispatch contract, PRODUCER_STATE grammar, and clean roadmap paths", () => {
		const producerContent = fs.readFileSync(path.join(agentsDir, "producer.md"), "utf8");
		expect(producerContent).toContain("## Allowed edit surfaces");
		expect(producerContent).toContain("<!-- PRODUCER_STATE -->");
		expect(producerContent).toContain("<!-- /PRODUCER_STATE -->");
		expect(producerContent).toContain("production/roadmap.md");
		expect(producerContent).toContain("PR-SCOPE");
		expect(producerContent).not.toContain("production/sprints/sprint-current.md");
		expect(producerContent).not.toContain("design/pillars.md");
	});

	test("producer.md and creative-director.md formalize scope arbitration handshake", () => {
		const producerContent = fs.readFileSync(path.join(agentsDir, "producer.md"), "utf8");
		const cdContent = fs.readFileSync(path.join(agentsDir, "creative-director.md"), "utf8");
		expect(producerContent).toContain("Scope Arbitration");
		expect(producerContent).toContain("creative-director");
		expect(cdContent).toContain("Scope Arbitration");
		expect(cdContent).toContain("producer");
		expect(cdContent).toContain("PR-SCOPE");
	});

	test("AGENTS.md does not contain legacy tool names (glob, subagent) and uses find, subagent_run", () => {
		const agentsReadme = fs.readFileSync(path.join(__dirname, "..", "AGENTS.md"), "utf8");
		expect(agentsReadme).not.toMatch(/\bglob\b/);
		expect(agentsReadme).not.toMatch(/\bsubagent\b(?!_)/);
		expect(agentsReadme).toContain("find");
		expect(agentsReadme).toContain("subagent_run");
	});
});

describe("Exhaustive Skill Validation (Official 6 ODD Skills)", () => {
	const skillsDir = path.join(__dirname, "..", "skills");
	const skillFolders = fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter(
			(d) =>
				d.isDirectory() &&
				!["test-results", "test-rubrics", "_shared"].includes(d.name),
		)
		.map((d) => d.name);

	test("exactly 6 ODD skill directories exist in skills/", () => {
		expect(skillFolders.length).toBe(6);
		expect(skillFolders.sort()).toEqual(["arch", "code", "concept", "ship", "spec", "test"].sort());
	});

	test.each(skillFolders)(
		"skill '%s' contains a valid SKILL.md with frontmatter and documentation",
		(folderName) => {
			const skillFilePath = path.join(skillsDir, folderName, "SKILL.md");
			expect(fs.existsSync(skillFilePath)).toBe(true);

			const content = fs.readFileSync(skillFilePath, "utf8");

			// 1. Must start with YAML frontmatter
			expect(content.startsWith("---")).toBe(true);

			// 2. Name must match or be declared
			const nameMatch = content.match(/^name:\s*([a-z0-9-]+)/m);
			expect(nameMatch).not.toBeNull();

			// 3. Must have a description
			const descMatch = content.match(/^description:\s*["']?([^\n"']+)["']?/m);
			expect(descMatch).not.toBeNull();
			expect(descMatch[1].trim().length).toBeGreaterThan(10);

			// 4. Must have content body
			const bodyParts = content.split("---");
			expect(bodyParts.length).toBeGreaterThanOrEqual(3);
			const body = bodyParts.slice(2).join("---").trim();
			expect(body.length).toBeGreaterThan(50);
		},
	);
});

describe("Shared ODD Contract Validation", () => {
	const oddContractPath = path.join(
		__dirname,
		"..",
		"skills",
		"_shared",
		"odd-contract.md",
	);

	test("odd-contract.md aligns FOSS media toolchain with studio-media-tools", () => {
		const content = fs.readFileSync(oddContractPath, "utf8");
		expect(content).not.toMatch(/`sox`/);
		expect(content).toContain("`oxipng`");
		expect(content).toContain("`free-tex-packer-cli`");
		expect(content).toContain("`gltfpack`");
	});
});
