const fs = require("fs");
const path = require("path");

describe("Cross-References Validation", () => {
	const skillsDir = path.join(__dirname, "..", "skills");
	const agentsDir = path.join(__dirname, "..", "agents");

	test("SKILL.md files should not have broken file references", () => {
		const skillDirs = fs
			.readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());
		const brokenRefs = [];

		for (const d of skillDirs) {
			const skillPath = path.join(skillsDir, d.name, "SKILL.md");
			if (!fs.existsSync(skillPath)) continue;

			const content = fs.readFileSync(skillPath, "utf8");
			
			// Match patterns like prompts/*.md, docs/*.md, agents/*.md, chains/*.md, production/*.md
			const matches = content.match(
				/(?:prompts|docs|agents|chains|production)\/[a-zA-Z0-9_./-]+\.md/g,
			) || [];

			for (const ref of matches) {
				// production/roadmap.md is created at runtime, ignore it
				if (ref === "production/roadmap.md") continue;

				// A `structural:` line declares an artifact the phase must PRODUCE and
				// then verify; it is not a link to something that already ships.
				const declaringLine =
					content
						.split("\n")
						.find((candidate) => candidate.includes(ref)) || "";
				if (/structural:/.test(declaringLine.slice(0, declaringLine.indexOf(ref)))) {
					continue;
				}

				const fullPath = path.join(__dirname, "..", ref);
				if (!fs.existsSync(fullPath)) {
					brokenRefs.push({ skill: d.name, ref });
				}
			}
		}

		// A skill that points at a file the repository does not ship is a broken
		// promise to the agent reading it, so this fails instead of warning.
		expect(brokenRefs).toEqual([]);
	});

	test("No references to .claude/ paths remain in any skill", () => {
		const skillDirs = fs
			.readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());

		for (const d of skillDirs) {
			const skillPath = path.join(skillsDir, d.name, "SKILL.md");
			if (!fs.existsSync(skillPath)) continue;

			const content = fs.readFileSync(skillPath, "utf8");
			expect(content).not.toMatch(/\.claude\//);
		}
	});

	test("No references to todo_write tool remain in any skill frontmatter", () => {
		const skillDirs = fs
			.readdirSync(skillsDir, { withFileTypes: true })
			.filter((d) => d.isDirectory());

		for (const d of skillDirs) {
			const skillPath = path.join(skillsDir, d.name, "SKILL.md");
			if (!fs.existsSync(skillPath)) continue;

			const content = fs.readFileSync(skillPath, "utf8");
			// Frontmatter is usually at the start between ---
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (frontmatterMatch) {
				const frontmatter = frontmatterMatch[1];
				expect(frontmatter).not.toMatch(/todo_write/);
			}
		}
	});

	test("No references to AskUserQuestion remain in any agent file", () => {
		const agentFiles = fs
			.readdirSync(agentsDir)
			.filter((f) => f.endsWith(".md"));

		for (const f of agentFiles) {
			const agentPath = path.join(agentsDir, f);
			const content = fs.readFileSync(agentPath, "utf8");
			expect(content).not.toMatch(/AskUserQuestion/);
		}
	});

	test("No references to CLAUDE.md remain in any agent file", () => {
		const agentFiles = fs
			.readdirSync(agentsDir)
			.filter((f) => f.endsWith(".md"));

		for (const f of agentFiles) {
			const agentPath = path.join(agentsDir, f);
			const content = fs.readFileSync(agentPath, "utf8");
			expect(content).not.toMatch(/CLAUDE\.md/);
		}
	});
});

describe("ODD task classification", () => {
	const read = (p) => fs.readFileSync(path.join(__dirname, "..", p), "utf8");

	test("size is decided by resumability, never by counting steps", () => {
		const workflow = read("docs/odd-gamedev-workflow.md");
		const protocol = read("docs/gamedev-interaction-protocol.md");

		// The proxy Organic Driven Development rejects: a step count decided
		// whether a Live Spec was required, so a one-line savegame format change
		// skipped it while two trivial renames demanded one.
		expect(workflow).not.toMatch(/<\s*2\s*pasos/i);
		expect(workflow).not.toMatch(/≥\s*2\s*pasos/i);
		expect(protocol).not.toMatch(/≥\s*2\s*pasos/i);

		const start = workflow.indexOf("### Paso 4");
		const end = workflow.indexOf("### Paso 5");
		expect(start).toBeGreaterThan(-1);
		expect(end).toBeGreaterThan(start);
		const classify = workflow.slice(start, end);

		// The three conditions that decide size, all present in the rule itself.
		expect(classify).toMatch(/entendid/i);
		expect(classify).toMatch(/riesgo contenido|riesgo acotado/i);
		expect(classify).toMatch(/reanudable/i);
		expect(classify).toMatch(/diff/);
		// Step count survives only as a hint, named as such.
		expect(classify).toMatch(/pista/i);
	});
});
