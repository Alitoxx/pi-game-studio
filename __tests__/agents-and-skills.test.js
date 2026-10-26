const fs = require("fs");
const path = require("path");

describe("Exhaustive Agent Validation (Compact 8+1 Studio Architecture: 15 Agents)", () => {
	const agentsDir = path.join(__dirname, "..", "agents");
	const agentFiles = fs
		.readdirSync(agentsDir)
		.filter((f) => f.endsWith(".md"));

	test("exactly 15 agent files exist in agents/ directory", () => {
		expect(agentFiles.length).toBe(15);
	});

	test("qa-verifier is the read-only auditor: declares evidence tools and never write/edit", () => {
		const content = fs.readFileSync(path.join(agentsDir, "qa-verifier.md"), "utf8");
		const frontmatter = content.split("---")[1];
		const toolsSection = frontmatter.match(/^tools:\n((?:\s+-\s+[a-z_]+\n?)+)/m);
		expect(toolsSection).not.toBeNull();
		const toolLines = [
			...toolsSection[1].matchAll(/^\s+-\s+([a-z_]+)/gm),
		].map((m) => m[1]);
		// The read-only property lives in the frontmatter, not in prompt prose:
		// it can run evidence commands (bash) but cannot modify what it audits.
		expect(toolLines).toEqual(["read", "find", "grep", "bash"]);
	});

	test("only the producer delegates: no dispatched role carries a delegation tool", () => {
		const delegating = agentFiles.filter((f) => {
			const frontmatter = fs
				.readFileSync(path.join(agentsDir, f), "utf8")
				.split("---")[1];
			const toolsSection =
				frontmatter.match(/^tools:\n((?:\s+-\s+[a-z_]+\n?)+)/m)?.[1] ?? "";
			return /^\s+-\s+subagent_/m.test(toolsSection);
		});
		// Depth is one: a director or specialist runs as a child, so granting it
		// subagent_run would let it launch work it has no tool to observe, cancel
		// or collect. Escalation goes through the return contract instead.
		expect(delegating).toEqual(["producer.md"]);
	});

	test("every knowledge-producing role can persist a discovery; the auditor cannot", () => {
		const withoutSave = agentFiles.filter((f) => {
			const frontmatter = fs
				.readFileSync(path.join(agentsDir, f), "utf8")
				.split("---")[1];
			const toolsSection =
				frontmatter.match(/^tools:\n((?:\s+-\s+[a-z_]+\n?)+)/m)?.[1] ?? "";
			return !/^\s+-\s+mem_save$/m.test(toolsSection);
		});
		// A specialist runs as an isolated process: anything it learns that outlives
		// the task has no other channel. The auditor is the one exception — its
		// independence is provable only while it stays read-only.
		expect(withoutSave).toEqual(["qa-verifier.md"]);
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
		"mem_save",
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
				"mem_save",
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

describe("Least-privilege deny baseline", () => {
	const agentsDir = path.join(__dirname, "..", "agents");
	const agentFiles = fs
		.readdirSync(agentsDir)
		.filter((f) => f.endsWith(".md"));

	const frontmatterOf = (file) =>
		fs.readFileSync(path.join(agentsDir, file), "utf8").split("---")[1];

	const denyEntriesOf = (frontmatter) => {
		const block = frontmatter.match(/^deny:\n((?:\s+-\s+.+\n?)+)/m);
		if (!block) return null;
		return block[1]
			.split("\n")
			.map((l) => l.replace(/^\s*-\s*/, "").trim())
			// Quoted entries arrive stripped by the loader, so mirror that contract.
			.map((t) => (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t)
			.filter(Boolean);
	};

	test("a deny baseline backs every role that must not widen", () => {
		// The auditor's whole independence is the default deny: everything not in
		// its allow list is excluded, whatever the runtime grows later.
		expect(denyEntriesOf(frontmatterOf("qa-verifier.md"))).toEqual(["*"]);

		// Depth is one for every dispatched role, declared twice: absent from tools
		// and denied in frontmatter, so a runtime addition cannot reopen the hole.
		// qa-verifier's single "*" default-deny subsumes subagent_*; the producer is
		// the orchestrator and declares no deny at all.
		const missingSubagentDeny = agentFiles.filter((file) => {
			if (file === "producer.md") return false;
			const deny = denyEntriesOf(frontmatterOf(file)) ?? [];
			return !(deny.includes("subagent_*") || deny.includes("*"));
		});
		expect(missingSubagentDeny).toEqual([]);

		// The four document roles have no bash: they must not execute anything,
		// not even by inheriting a tool the runtime adds.
		for (const doc of [
			"creative-director.md",
			"art-director.md",
			"audio-director.md",
			"game-designer.md",
		]) {
			expect(denyEntriesOf(frontmatterOf(doc))).toContain("bash");
		}

		// The producer is the orchestrator: it dispatches, so nothing is denied.
		expect(frontmatterOf("producer.md")).not.toMatch(/^deny:/m);
	});

	test("every role states the boundary it will not cross", () => {
		for (const file of agentFiles) {
			const body = fs
				.readFileSync(path.join(agentsDir, file), "utf8")
				.split("---")
				.slice(2)
				.join("---");
			const matches = body.match(/^\*\*Boundary:\*\* .*\.$/gm) ?? [];
			expect({ file, count: matches.length }).toEqual({ file, count: 1 });
		}
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
	test("models.default.json only names tiers and real agents of the 8+1 roster", () => {
		const modelsPath = path.join(__dirname, "..", "models.default.json");
		const defaults = JSON.parse(fs.readFileSync(modelsPath, "utf8"));
		const tiers = new Set(["director", "workhorse", "lightweight"]);
		const rosterDir = path.join(__dirname, "..", "agents");
		const rosterFiles = fs.readdirSync(rosterDir).filter((file) => file.endsWith(".md"));
		const agentNames = new Set(
			rosterFiles.map((file) => {
				const frontmatter = fs.readFileSync(path.join(rosterDir, file), "utf8");
				const match = frontmatter.match(/^name:\s*(.+)$/m);
				return match ? match[1].trim() : file.replace(/\.md$/, "");
			}),
		);

		const unknownKeys = Object.keys(defaults).filter((key) => !tiers.has(key) && !agentNames.has(key));
		expect(unknownKeys).toEqual([]);

		for (const tier of tiers) {
			expect(typeof defaults[tier]).toBe("string");
			expect(defaults[tier].length).toBeGreaterThan(0);
		}
	});
});

describe("Skills declare only what the runtime provides", () => {
	const skillsDir = path.join(__dirname, "..", "skills");
	const skillDirs = fs
		.readdirSync(skillsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	const piTools = new Set([
		"read",
		"write",
		"edit",
		"find",
		"grep",
		"bash",
		"web_search",
		"subagent_run",
		"subagent_list",
		"subagent_status",
		"subagent_result",
		"subagent_steer",
		"ask_user_question",
	]);

	const declaredTools = (content) => {
		const block = /^tools:\s*\n((?:\s*-\s*\S+\n?)+)/m.exec(content);
		if (!block) return [];
		return block[1]
			.split("\n")
			.map((l) => l.replace(/^\s*-\s*/, "").trim())
			// The frontmatter terminator also starts with a dash.
			.filter((t) => Boolean(t) && !/^-+$/.test(t));
	};

	test.each(skillDirs)("skill '%s' declares only real Pi tools", (dir) => {
		const file = path.join(skillsDir, dir, "SKILL.md");
		if (!fs.existsSync(file)) return;
		const tools = declaredTools(fs.readFileSync(file, "utf8"));
		const unknown = tools.filter((t) => !piTools.has(t));
		expect({ skill: dir, unknown }).toEqual({ skill: dir, unknown: [] });
	});

	test.each(skillDirs)("skill '%s' declares no agent-only frontmatter", (dir) => {
		// A skill is instructions the model reads, not an agent Pi dispatches: `model`,
		// `inheritProjectContext`, `thinking` and `deny` mean nothing here, and the six
		// skills carried the first two while agents-and-skills only forbade them in
		// agents. The portable Agent Skills set is name, description, license,
		// compatibility, metadata, allowed-tools and disable-model-invocation.
		const file = path.join(skillsDir, dir, "SKILL.md");
		if (!fs.existsSync(file)) return;
		const content = fs.readFileSync(file, "utf8");
		const agentOnly = ["model", "inheritProjectContext", "thinking", "deny"].filter((field) =>
			new RegExp(`^${field}:`, "m").test(content),
		);
		expect({ skill: dir, agentOnly }).toEqual({ skill: dir, agentOnly: [] });
	});

	test.each(skillDirs)("skill '%s' does not reference a retired media binary", (dir) => {
		const file = path.join(skillsDir, dir, "SKILL.md");
		if (!fs.existsSync(file)) return;
		const body = fs.readFileSync(file, "utf8");
		expect({ skill: dir, sox: /\bsox\b/.test(body) }).toEqual({ skill: dir, sox: false });
	});
});

describe("Documentation names only what exists", () => {
	const root = path.join(__dirname, "..");
	const readmeFull = fs.readFileSync(path.join(root, "README.md"), "utf8");
	// Live documentation only: the Changelog is history and may name retired
	// commands as such.
	const readme = readmeFull.split("## Changelog")[0];
	const agents = fs.readFileSync(path.join(root, "AGENTS.md"), "utf8");

	test("README does not document a command that is not registered", () => {
		expect(readme.includes("/setup-engine")).toBe(false);
	});

	test("README does not reference a skill directory that is not shipped", () => {
		expect(readme.includes("skills/setup-engine")).toBe(false);
	});

	test("AGENTS.md does not mandate a numbered menu the runtime forbids", () => {
		expect(/Menú cerrado, numerado/i.test(agents)).toBe(false);
	});
});

describe("Every paper ODD phase closes on observed evidence", () => {
	const skillsDir = path.join(__dirname, "..", "skills");
	// code, test and ship already declare observable gates; these three closed on
	// prose, so saving the file was the only done-when.
	const paperPhases = ["concept", "spec", "arch"];

	// The property is "this phase has a closing gate", not "the heading says Cierre":
	// the skill layer is an instruction for the model and is written in English, so
	// the finder accepts either name and still fails when the section is absent.
	const closingGateOf = (content) => {
		const lines = content.split("\n");
		const start = lines.findIndex((line) =>
			/^#{2,3} (?:\d+\.\s*)?(?:Cierre Verificable \(Done When\)|Verifiable Closure \(Done When\)|Closing Gate)$/i.test(line),
		);
		if (start === -1) return null;
		// Everything under the closing heading, up to the next heading of any level.
		const body = [];
		for (let i = start + 1; i < lines.length; i++) {
			if (/^#{2,3} /.test(lines[i])) break;
			body.push(lines[i]);
		}
		return body.join("\n");
	};

	test.each(paperPhases)(
		"skill '%s' states what closing means, with structural evidence",
		(phase) => {
			const content = fs.readFileSync(
				path.join(skillsDir, phase, "SKILL.md"),
				"utf8",
			);
			const gate = closingGateOf(content);
			expect(gate).not.toBeNull();

			// Closing is an observable claim about the artifact, not the act of
			// saving it: the evidence form must be named.
			expect(gate).toMatch(/structural:/);
			// A phase that cannot meet its conditions says so instead of claiming done.
			expect(gate).toMatch(/partial/);
			// Binary conditions, at least three, or the gate is decorative.
			const conditions = gate.match(/^- \*\*/gm) ?? [];
			expect(conditions.length).toBeGreaterThanOrEqual(3);
		},
	);
});
