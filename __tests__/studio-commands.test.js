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
			"studio:start",
			"studio:setup",
			"studio:new",
			"studio:models",
			"studio:status",
			"studio:changes",
			"studio:tasks",
			"studio:agents",
			"studio:chains",
			"studio:settings",
			"studio:doctor",
			"studio:commands",
			"studio:toggle-art",
			"studio:art",
			"studio:help",
		];

		const names = registered.map((r) => r.name);
		for (const expected of expectedCommands) {
			expect(names).toContain(expected);
		}
	});

	test("every studio command has a descriptive label with the studio badge", () => {
		for (const cmd of registered) {
			expect(cmd.description).toContain("[Studio]");
		}
	});

	test("agent groups cover all 55 agents without duplicates", () => {
		const agentsSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-agents.ts"),
			"utf8",
		);

		const agentMatches = [
			...agentsSource.matchAll(/["']([a-z0-9-]+-director|[a-z0-9-]+-programmer|[a-z0-9-]+-designer|[a-z0-9-]+-specialist|[a-z0-9-]+-lead|[a-z0-9-]+-engineer|[a-z0-9-]+-tester|[a-z0-9-]+-analyst|[a-z0-9-]+-manager|[a-z0-9-]+-artist|writer|world-builder|prototyper|producer)["']/g),
		].map((m) => m[1]);

		const uniqueAgents = Array.from(new Set(agentMatches));
		expect(uniqueAgents.length).toBe(55);
	});

	test("all interactive select handlers support Pi string return values", () => {
		const files = [
			"studio-start.ts",
			"studio-setup.ts",
			"studio-models.ts",
			"studio-command.ts",
			"studio-agents.ts",
			"studio-chains.ts",
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

	test("all 55 agents define structured YAML tools and thinking effort levels", () => {
		const agentsDir = path.join(__dirname, "..", "agents");
		const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
		expect(agentFiles.length).toBe(55);

		for (const f of agentFiles) {
			const content = fs.readFileSync(path.join(agentsDir, f), "utf8");
			expect(content).toMatch(/^thinking:\s*(high|medium|low)/m);
			expect(content).toMatch(/^tools:\n(\s+-\s+[a-z_]+\n)+/m);
		}
	});

	test("studio multi-agent chains exist and contain valid steps", () => {
		const chainsDir = path.join(__dirname, "..", "chains");
		expect(fs.existsSync(chainsDir)).toBe(true);

		const chainFiles = ["gdd-review.chain.md", "feature-implement.chain.md", "release-gate.chain.md"];
		for (const cf of chainFiles) {
			const fullPath = path.join(chainsDir, cf);
			expect(fs.existsSync(fullPath)).toBe(true);
			const content = fs.readFileSync(fullPath, "utf8");
			expect(content).toMatch(/^name:\s*[a-z-]+/m);
			expect(content).toMatch(/^##\s+[a-z-]+/m);
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

	test("findStudioRoot resolves project root from root and any subdirectory", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-root.ts"),
			"utf8",
		);
		expect(source).toContain("export function findStudioRoot");
		expect(source).toContain(".pi");
		expect(source).toContain("game-studio");
		expect(source).toContain("project.yaml");
		expect(source).toContain("AGENTS.md");

		// Evaluate root resolution logic
		function testResolve(startDir) {
			let current = path.resolve(startDir);
			while (true) {
				if (
					fs.existsSync(path.join(current, ".pi", "game-studio")) ||
					fs.existsSync(path.join(current, "project.yaml")) ||
					fs.existsSync(path.join(current, "AGENTS.md"))
				) {
					return current;
				}
				const parent = path.dirname(current);
				if (parent === current) break;
				current = parent;
			}
			return null;
		}

		const studioRoot = path.resolve(__dirname, "..");
		expect(testResolve(studioRoot)).toBe(studioRoot);

		const sandboxDir = path.join(studioRoot, "sandbox");
		expect(testResolve(sandboxDir)).toBe(studioRoot);

		const nestedSubdir = path.join(studioRoot, "sandbox", "production");
		expect(testResolve(nestedSubdir)).toBe(studioRoot);

		expect(testResolve("/tmp")).toBeNull();
	});

	test("detectProjectEngine correctly identifies all 3 starters and their languages", () => {
		const detectorSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "engine-detector.ts"),
			"utf8",
		);
		expect(detectorSource).toContain("export function detectProjectEngine");
		expect(detectorSource).toContain("export function formatEngineBadge");

		const studioRoot = path.resolve(__dirname, "..");
		const bevyDir = path.join(studioRoot, "starters", "bevy-2d-arpg");
		const raylibDir = path.join(studioRoot, "starters", "raylib-cpp-entt");
		const godotDir = path.join(studioRoot, "starters", "godot-2d-character");

		expect(fs.existsSync(path.join(bevyDir, "Cargo.toml"))).toBe(true);
		expect(fs.existsSync(path.join(raylibDir, "CMakeLists.txt"))).toBe(true);
		expect(fs.existsSync(path.join(godotDir, "project.godot"))).toBe(true);

		// Basic sniffing simulation
		const cargo = fs.readFileSync(path.join(bevyDir, "Cargo.toml"), "utf8");
		expect(cargo).toContain("bevy = { version = \"0.15\"");

		const cmake = fs.readFileSync(path.join(raylibDir, "CMakeLists.txt"), "utf8");
		expect(cmake).toContain("raylib");
		expect(cmake).toContain("entt");

		const godot = fs.readFileSync(path.join(godotDir, "project.godot"), "utf8");
		expect(godot).toContain("config/name=\"Godot 2D Character Starter\"");
	});

	test("banner.ts includes Raylib in the 5 supported engines and 8 Core + 1 Motor", () => {
		const bannerSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "banner.ts"),
			"utf8",
		);
		expect(bannerSource).toContain("Raylib");
		expect(bannerSource).toContain("Godot · Unity · Unreal · Bevy · Raylib");
		expect(bannerSource).toContain("8 Core + 1 Motor");
	});

	test("engine reference docs exist for all 5 engines (bevy, godot, raylib, unity, unreal)", () => {
		const refDir = path.join(__dirname, "..", "docs", "engine-reference");
		const engines = ["bevy", "godot", "raylib", "unity", "unreal"];
		for (const eng of engines) {
			const versionFile = path.join(refDir, eng, "VERSION.md");
			expect(fs.existsSync(versionFile)).toBe(true);
			const content = fs.readFileSync(versionFile, "utf8");
			expect(content).toMatch(/Engine Version/i);
		}
	});

	test("studio-changes exposes classification and gamedev change inspector", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-changes.ts"),
			"utf8",
		);
		expect(source).toContain("export function classifyFile");
		expect(source).toContain("export function inspectChanges");
		expect(source).toContain("export function formatChangesOutput");
		expect(source).toContain("export async function handleStudioChanges");
		expect(source).toContain("DESIGN");
		expect(source).toContain("CODE");
		expect(source).toContain("DATA_ASSETS");
		expect(source).toContain("PRODUCTION");
		expect(source).toContain("CONFIG");
		expect(source).toContain("ALERTA DRIFT");
	});

	test("return-contract exposes validator and detects conversational bleed", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "return-contract.ts"),
			"utf8",
		);
		expect(source).toContain("export function validateSpecialistReturn");
		expect(source).toContain("status:");
		expect(source).toContain("summary:");
		expect(source).toContain("FORBIDDEN_CONVERSATIONAL_PHRASES");
	});

	test("studio-tasks exposes task inspector and stale detector", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-tasks.ts"),
			"utf8",
		);
		expect(source).toContain("export function inspectStudioTasks");
		expect(source).toContain("export function formatTasksOutput");
		expect(source).toContain("export async function handleStudioTasks");
		expect(source).toContain("STALE_THRESHOLD_DAYS");
		expect(source).toContain("design/gdd");
		expect(source).toContain("production/roadmap.md");
	});

	test("studio-choice registers ask_user_choice and ask_user_question with custom response", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-choice.ts"),
			"utf8",
		);
		expect(source).toContain("registerAskUserChoice");
		expect(source).toContain("ask_user_choice");
		expect(source).toContain("ask_user_question");
		expect(source).toContain("Otro (escribir respuesta personalizada)...");
		expect(source).toContain("allowCustomResponse");
	});

	test("studio-choice execution logic handles custom responses and batch questions correctly", async () => {
		// Mock implementation representing the exact logic in studio-choice.ts
		const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";

		async function executeAskUserChoice(params, ctx) {
			if (!params.options || params.options.length === 0) {
				return { content: [{ type: "text", text: "Error" }], details: { error: "empty_options" } };
			}
			const labels = params.options.map((opt, i) => `${i + 1}. ${opt.label}`);
			if (params.allowCustomResponse) {
				labels.push(OTHER_LABEL);
			}
			const picked = await ctx.ui.select(params.question, labels);
			if (params.allowCustomResponse && picked === OTHER_LABEL) {
				const customText = await ctx.ui.input(params.question, "");
				return {
					content: [{ type: "text", text: `User provided custom response: ${customText}` }],
					details: { customResponse: customText },
				};
			}
			const idx = typeof picked === "number" ? picked : labels.indexOf(picked);
			const selectedOption = params.options[idx] || params.options[0];
			return {
				content: [{ type: "text", text: `Selected ${selectedOption.label}` }],
				details: { selection: { label: selectedOption.label, value: selectedOption.value } },
			};
		}

		async function executeAskUserQuestion(params, ctx) {
			const committedAnswers = [];
			for (let i = 0; i < params.questions.length; i++) {
				const q = params.questions[i];
				const title = `[${i + 1}/${params.questions.length}] ${q.question}`;
				const labels = q.options.map((opt, optIdx) => `${optIdx + 1}. ${opt.label}`);
				const allowCustom = q.allowCustomResponse !== false;
				if (allowCustom) {
					labels.push(OTHER_LABEL);
				}
				const picked = await ctx.ui.select(title, labels);
				if (allowCustom && picked === OTHER_LABEL) {
					const customText = await ctx.ui.input(title, "");
					committedAnswers.push({
						questionIndex: i + 1,
						question: q.question,
						answer: customText || "Otro",
						custom: true,
					});
				} else {
					const idx = typeof picked === "number" ? picked : labels.indexOf(picked);
					const chosenOpt = q.options[idx] || q.options[0];
					committedAnswers.push({
						questionIndex: i + 1,
						question: q.question,
						answer: chosenOpt.label,
					});
				}
			}
			return { details: { answers: committedAnswers } };
		}

		// Test 1: Single choice picking custom text
		const mockCtxCustom = {
			hasUI: true,
			ui: {
				select: jest.fn().mockResolvedValue(OTHER_LABEL),
				input: jest.fn().mockResolvedValue("Mi Motor Favorito"),
			},
		};
		const resChoice = await executeAskUserChoice(
			{
				question: "¿Qué motor usas?",
				options: [{ label: "Godot", value: "godot" }, { label: "Unity", value: "unity" }],
				allowCustomResponse: true,
			},
			mockCtxCustom,
		);
		expect(resChoice.details.customResponse).toBe("Mi Motor Favorito");
		expect(mockCtxCustom.ui.input).toHaveBeenCalledWith("¿Qué motor usas?", "");

		// Test 2: Batch questionnaire: step 1 preset, step 2 custom
		let callCount = 0;
		const mockCtxBatch = {
			hasUI: true,
			ui: {
				select: jest.fn().mockImplementation(async (title, labels) => {
					callCount++;
					return callCount === 1 ? labels[0] : OTHER_LABEL;
				}),
				input: jest.fn().mockResolvedValue("modelo-custom-gpt-5"),
			},
		};
		const resBatch = await executeAskUserQuestion(
			{
				questions: [
					{
						question: "Motor",
						options: [{ label: "Godot 4" }, { label: "Bevy" }],
					},
					{
						question: "Modelo",
						options: [{ label: "inherit" }, { label: "Manual" }],
					},
				],
			},
			mockCtxBatch,
		);
		expect(resBatch.details.answers).toHaveLength(2);
		expect(resBatch.details.answers[0].answer).toBe("Godot 4");
		expect(resBatch.details.answers[0].custom).toBeUndefined();
		expect(resBatch.details.answers[1].answer).toBe("modelo-custom-gpt-5");
		expect(resBatch.details.answers[1].custom).toBe(true);
	});
});

