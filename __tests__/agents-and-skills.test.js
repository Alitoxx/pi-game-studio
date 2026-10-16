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

	test("Tier 1 Director agents (producer, creative-director, technical-director) are symmetric and free of legacy patterns", () => {
		const tier1Directors = [
			"producer.md",
			"creative-director.md",
			"technical-director.md",
		];

		for (const filename of tier1Directors) {
			const content = fs.readFileSync(path.join(agentsDir, filename), "utf8");

			// All 3 Tier 1 directors use subagent_run in Token Economy & Return Contract (no legacy via `subagent`)
			expect(content).toContain("### Token Economy & Return Contract");
			expect(content).toMatch(/when delegated via `subagent_run`/);
			expect(content).not.toMatch(/when delegated via `subagent`/);

			// All 3 Tier 1 directors enforce Structured Decision Capture (`ask_user_question`) and do not contain legacy Lossless Choice Envelope or spanglish subagent aislado
			expect(content).toContain("Structured Decision Capture (`ask_user_question`)");
			expect(content).not.toContain("Lossless Choice Envelope");
			expect(content).not.toContain("subagent aislado");
		}

		// technical-director.md includes all 6 engine specialists (including phaser-specialist) in its Delegation Map and references TD-FEASIBILITY and PR-SCOPE
		const tdContent = fs.readFileSync(path.join(agentsDir, "technical-director.md"), "utf8");
		const engineSpecialists = [
			"bevy-specialist",
			"godot-specialist",
			"phaser-specialist",
			"raylib-specialist",
			"unity-specialist",
			"unreal-specialist",
		];
		for (const specialist of engineSpecialists) {
			expect(tdContent).toContain(specialist);
		}
		expect(tdContent).toContain("TD-FEASIBILITY");
		expect(tdContent).toContain("PR-SCOPE");
	});

	test("Tier 2 Department Lead & Core Dev agents (game-designer, gameplay-programmer, art-director, audio-director, qa-lead) are symmetric, bounded, and free of legacy patterns", () => {
		const tier2Agents = [
			"game-designer.md",
			"gameplay-programmer.md",
			"art-director.md",
			"audio-director.md",
			"qa-lead.md",
		];
		const engineSpecialists = [
			"bevy-specialist",
			"godot-specialist",
			"phaser-specialist",
			"raylib-specialist",
			"unity-specialist",
			"unreal-specialist",
		];

		for (const filename of tier2Agents) {
			const content = fs.readFileSync(path.join(agentsDir, filename), "utf8");

			// All 5 Tier 2 agents use `when delegated via \`subagent_run\`` in `Token Economy & Return Contract` (no legacy `via \`subagent\``)
			expect(content).toContain("### Token Economy & Return Contract");
			expect(content).toMatch(/when delegated via `subagent_run`/);
			expect(content).not.toMatch(/when delegated via `subagent`(?!_)/);

			// All 5 Tier 2 agents enforce `Structured Decision Capture (\`ask_user_question\`)` and `in user dialogue.` in `Communication & Decision Protocol`, and do not contain legacy `Lossless Choice Envelope` or spanglish `subagent aislado`
			expect(content).toContain("Structured Decision Capture (`ask_user_question`)");
			expect(content).toContain("in user dialogue.");
			expect(content).not.toContain("Lossless Choice Envelope");
			expect(content).not.toContain("subagent aislado");

			// All 5 Tier 2 agents include `Bounded Edit Surfaces` (`## Allowed edit surfaces`) in their `Organic Driven Development (ODD) Workflow` section
			expect(content).toContain("Bounded Edit Surfaces");
			expect(content).toContain("## Allowed edit surfaces");

			// All 5 Tier 2 agents include `#### Example Interaction Pattern (Compact)` and do not contain legacy paths (`design/pillars.md`, `audio/audio-design.md`, `Wait for "yes" before using Write/Edit tools`)
			expect(content).toContain("#### Example Interaction Pattern (Compact)");
			expect(content).not.toContain("design/pillars.md");
			expect(content).not.toContain("audio/audio-design.md");
			expect(content).not.toContain('Wait for "yes" before using Write/Edit tools');

			// All 5 Tier 2 agents enumerate all 6 engine specialists in their `Delegation Map`
			const delegationSection = content.split("### Delegation Map")[1]?.split("###")[0] || "";
			for (const specialist of engineSpecialists) {
				expect(delegationSection).toContain(specialist);
			}
		}

		// `gameplay-programmer.md` has clean English engineering standards without untranslated Spanish
		const gpContent = fs.readFileSync(path.join(agentsDir, "gameplay-programmer.md"), "utf8");
		expect(gpContent).toContain("Mandatory Debug Overlay (`F3`)");
		expect(gpContent).toContain("Decoupled Action Mapping");
		expect(gpContent).toContain("Game Feel & Micro-feedback");
		expect(gpContent).not.toContain("Debug Overlay Obligatorio");
		expect(gpContent).not.toContain("Action Mapping Desacoplado");
	});

	test("AGENTS.md does not contain legacy tool names (glob, subagent) and uses find, subagent_run", () => {
		const agentsReadme = fs.readFileSync(path.join(__dirname, "..", "AGENTS.md"), "utf8");
		expect(agentsReadme).not.toMatch(/\bglob\b/);
		expect(agentsReadme).not.toMatch(/\bsubagent\b(?!_)/);
		expect(agentsReadme).toContain("find");
		expect(agentsReadme).toContain("subagent_run");
	});

	test("Tier 3 Engine Specialist agents (bevy-specialist, godot-specialist, phaser-specialist, raylib-specialist, unity-specialist, unreal-specialist) are symmetric, bounded leaf implementers, and free of legacy patterns", () => {
		const tier3Agents = [
			"bevy-specialist.md",
			"godot-specialist.md",
			"phaser-specialist.md",
			"raylib-specialist.md",
			"unity-specialist.md",
			"unreal-specialist.md",
		];
		const removedLegacyRoles = [
			"lead-programmer",
			"technical-artist",
			"performance-analyst",
			"devops-engineer",
			"engine-programmer",
			"systems-designer",
		];

		for (const filename of tier3Agents) {
			const filePath = path.join(agentsDir, filename);
			const content = fs.readFileSync(filePath, "utf8");
			const bodyParts = content.split("---");
			const frontmatter = bodyParts[1];

			// 1. None of the 6 engine specialists include subagent_run in frontmatter tools (leaf implementers)
			const toolsSection = frontmatter.match(/^tools:\n((?:\s+-\s+[a-z_]+\n?)+)/m);
			expect(toolsSection).not.toBeNull();
			const toolLines = [
				...toolsSection[1].matchAll(/^\s+-\s+([a-z_]+)/gm),
			].map((m) => m[1]);
			expect(toolLines).not.toContain("subagent_run");
			expect(toolLines).toEqual([
				"read",
				"find",
				"grep",
				"write",
				"edit",
				"bash",
				"ask_user_question",
			]);

			// 2. All 6 engine specialists use `when delegated via \`subagent_run\`` in `Token Economy & Return Contract` (no legacy `via \`subagent\``)
			expect(content).toContain("### Token Economy & Return Contract");
			expect(content).toMatch(/when delegated via `subagent_run`/);
			expect(content).not.toMatch(/when delegated via `subagent`(?!_)/);

			// 3. All 6 engine specialists enforce `Structured Decision Capture (\`ask_user_question\`)` (item 7) and `in user dialogue.` (item 1) in `Communication & Decision Protocol (Gentle Shell for Games)`
			expect(content).toContain("### Communication & Decision Protocol (Gentle Shell for Games)");
			expect(content).toContain("Structured Decision Capture (`ask_user_question`)");
			expect(content).toContain("in user dialogue.");
			expect(content).not.toContain("Lossless Choice Envelope");
			expect(content).not.toContain("subagent aislado");

			// 4. All 6 engine specialists include `#### Example Interaction Pattern (Compact)`
			expect(content).toContain("#### Example Interaction Pattern (Compact)");
			expect(content).not.toContain('Wait for "yes" before using Write/Edit tools');
			expect(content).not.toMatch(/May I write (?:this to|this system into|`scripts\/core\/state_machine\.gd`|the Addressables loading manager|the `UAbilitySystemComponent`)/i);

			// 5. All 6 engine specialists include `### Delegation Map` and `### What This Agent Must NOT Do`, referencing only valid 8+1 studio roles and zero removed legacy roles
			expect(content).toContain("### Delegation Map");
			expect(content).toContain("### What This Agent Must NOT Do");

			for (const legacyRole of removedLegacyRoles) {
				expect(content).not.toContain(legacyRole);
			}

			const delegationSection = content.split("### Delegation Map")[1]?.split("###")[0] || "";
			expect(delegationSection).toContain("technical-director");
			expect(delegationSection).toContain("gameplay-programmer");
			expect(delegationSection).toContain("art-director");
			expect(delegationSection).toContain("audio-director");
			expect(delegationSection).toContain("qa-lead");
			expect(delegationSection).toContain("game-designer");
			expect(delegationSection).toContain("producer");
			expect(delegationSection).toContain("TD-FEASIBILITY");
			expect(delegationSection).toContain("PR-SCOPE");

			// 6. All 6 engine specialists include `Bounded Edit Surfaces` (`## Allowed edit surfaces`) in `Organic Driven Development (ODD) Workflow`
			expect(content).toContain("Bounded Edit Surfaces");
			expect(content).toContain("## Allowed edit surfaces");
		}
	});

	test("AGENTS.md Tier 3 specialists declare exact leaf implementer tools without subagent_run", () => {
		const agentsReadme = fs.readFileSync(path.join(__dirname, "..", "AGENTS.md"), "utf8");
		const tier3Section = agentsReadme.split("### Tier 3: Especialistas de Motor")[1];
		expect(tier3Section).toBeDefined();
		expect(tier3Section).not.toContain("subagent_run");
		expect(tier3Section).toContain("read, find, grep, write, edit, bash, ask_user_question");
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
