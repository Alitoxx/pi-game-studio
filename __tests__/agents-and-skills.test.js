const fs = require("fs");
const path = require("path");

describe("Exhaustive Agent Validation (All 55 Agents)", () => {
	const agentsDir = path.join(__dirname, "..", "agents");
	const agentFiles = fs
		.readdirSync(agentsDir)
		.filter((f) => f.endsWith(".md"));

	test("exactly 55 agent files exist in agents/ directory", () => {
		expect(agentFiles.length).toBe(55);
	});

	const validPiTools = [
		"read",
		"write",
		"edit",
		"glob",
		"grep",
		"bash",
		"web_search",
		"subagent",
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
		},
	);
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
