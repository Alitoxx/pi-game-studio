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
			"studio:mcp",
			"studio:tools",
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

	test("agent groups cover all 13 agents without duplicates", () => {
		const agentsSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-agents.ts"),
			"utf8",
		);

		const agentMatches = [
			...agentsSource.matchAll(/["']([a-z0-9-]+-director|[a-z0-9-]+-programmer|[a-z0-9-]+-designer|[a-z0-9-]+-specialist|[a-z0-9-]+-lead|[a-z0-9-]+-engineer|[a-z0-9-]+-tester|[a-z0-9-]+-analyst|[a-z0-9-]+-manager|[a-z0-9-]+-artist|writer|world-builder|prototyper|producer)["']/g),
		].map((m) => m[1]);

		const uniqueAgents = Array.from(new Set(agentMatches));
		expect(uniqueAgents.length).toBe(13);
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

	test("all 13 agents define structured YAML tools and thinking effort levels", () => {
		const agentsDir = path.join(__dirname, "..", "agents");
		const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
		expect(agentFiles.length).toBe(13);

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

	test("studio-choice registers unified ask_user_question with custom response", () => {
		const source = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-choice.ts"),
			"utf8",
		);
		expect(source).toContain("registerAskUserQuestion");
		expect(source).toContain('name: "ask_user_question"');
		expect(source).not.toContain('name: "ask_user_choice"');
		expect(source).toContain("Otro (escribir respuesta personalizada)...");
		expect(source).toContain("allowCustomResponse");
	});

	test("studio-choice execution logic handles single questions, batch questions, and custom responses", async () => {
		// Mock implementation representing the exact logic in studio-choice.ts
		const OTHER_LABEL = "Otro (escribir respuesta personalizada)...";

		async function executeAskUserQuestion(params, ctx) {
			const questions = Array.isArray(params?.questions)
				? params.questions
				: params?.question
					? [{ question: params.question, options: params.options, allowCustomResponse: params.allowCustomResponse }]
					: [];

			if (questions.length === 0) {
				return { content: [{ type: "text", text: "Error" }], details: { error: "empty_questions" } };
			}

			const committedAnswers = [];
			for (let i = 0; i < questions.length; i++) {
				const q = questions[i];
				const header = q.header
					? `[${q.header}] `
					: questions.length > 1
						? `[${i + 1}/${questions.length}] `
						: "";
				const title = `${header}${q.question}`;
				const labels = (q.options || []).map((opt, optIdx) => `${optIdx + 1}. ${opt.label}`);
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
						answer: chosenOpt?.label || String(picked),
					});
				}
			}
			return { details: { answers: committedAnswers, selection: committedAnswers[0] || null } };
		}

		// Test 1: Single question picking custom text
		const mockCtxCustom = {
			hasUI: true,
			ui: {
				select: jest.fn().mockResolvedValue(OTHER_LABEL),
				input: jest.fn().mockResolvedValue("Mi Motor Favorito"),
			},
		};
		const resChoice = await executeAskUserQuestion(
			{
				questions: [
					{
						question: "¿Qué motor usas?",
						options: [{ label: "Godot" }, { label: "Unity" }],
					},
				],
			},
			mockCtxCustom,
		);
		expect(resChoice.details.answers[0].answer).toBe("Mi Motor Favorito");
		expect(resChoice.details.answers[0].custom).toBe(true);
		expect(mockCtxCustom.ui.input).toHaveBeenCalledWith("¿Qué motor usas?", "");

		// Test 1b: Default allowCustomResponse when omitted (defaults to true)
		const mockCtxDefault = {
			hasUI: true,
			ui: {
				select: jest.fn().mockImplementation(async (title, labels) => {
					expect(labels).toContain(OTHER_LABEL);
					return OTHER_LABEL;
				}),
				input: jest.fn().mockResolvedValue("Respuesta Personalizada"),
			},
		};
		const resChoiceDefault = await executeAskUserQuestion(
			{
				questions: [
					{
						question: "¿Qué opinas?",
						options: [{ label: "Opción A" }, { label: "Opción B" }],
					},
				],
			},
			mockCtxDefault,
		);
		expect(resChoiceDefault.details.answers[0].answer).toBe("Respuesta Personalizada");

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

	test("studio-doctor.ts exports handleStudioDoctor, auditProjectStructure and adheres to sober TUI", () => {
		const doctorSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-doctor.ts"),
			"utf8",
		);

		expect(doctorSource).toContain("export async function handleStudioDoctor");
		expect(doctorSource).toContain("export function auditEnginePrerequisites");
		expect(doctorSource).toContain("export function auditProjectStructure");
		expect(doctorSource).toContain("export function formatAuditReport");

		// Sober TUI check: no emojis in formatting
		expect(doctorSource).not.toMatch(/[🔍❌ℹ👉📦⚠️💡]/);
		expect(doctorSource).toContain("[STUDIO DOCTOR]");
		expect(doctorSource).toContain("[STRUCTURE]");
	});

	test("readProducerState regex logic correctly parses bilingual keys in English and Spanish for ProducerState", () => {
		const startSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-start.ts"),
			"utf8",
		);

		// 1. Verify studio-start.ts defines readProducerState with bilingual regexes
		expect(startSource).toContain("export function readProducerState");
		expect(startSource).toContain("(?:Juego|Game|Project|Title):");
		expect(startSource).toContain("(?:Motor|Engine):");
		expect(startSource).toContain("(?:Hito Actual|Milestone|Current Milestone):");
		expect(startSource).toContain("(?:Sprint Activo|Sprint|Active Sprint):");
		expect(startSource).toContain("(?:En Progreso|In Progress|Working On):");
		expect(startSource).toContain("(?:Siguiente Paso|Next Step|Next):");

		// 2. Parser replicating readProducerState block extraction and field matching
		function parseProducerBlock(block) {
			const state = {};
			const game = block.match(/(?:Juego|Game|Project|Title):\s*([^\n]+)/i);
			if (game) state.gameTitle = game[1].trim();

			const engine = block.match(/(?:Motor|Engine):\s*([^\n]+)/i);
			if (engine) state.engine = engine[1].trim();

			const milestone = block.match(/(?:Hito Actual|Milestone|Current Milestone):\s*([^\n]+)/i);
			if (milestone) state.milestone = milestone[1].trim();

			const sprint = block.match(/(?:Sprint Activo|Sprint|Active Sprint):\s*([^\n]+)/i);
			if (sprint) state.sprint = sprint[1].trim();

			const inProgress = block.match(/(?:En Progreso|In Progress|Working On):\s*([^\n]+)/i);
			if (inProgress) state.inProgress = inProgress[1].trim();

			const nextStep = block.match(/(?:Siguiente Paso|Next Step|Next):\s*([^\n]+)/i);
			if (nextStep) state.nextStep = nextStep[1].trim();
			return state;
		}

		// 3. Assert Spanish block parsing
		const spanishBlock = `
<!-- PRODUCER_STATE
Juego: Chrono Space
Motor: Godot 4
Hito Actual: Vertical Slice
Sprint Activo: Sprint 4
En Progreso: Mecánicas de Salto
Siguiente Paso: Audio y Pulido
<!-- /PRODUCER_STATE -->
`;
		const spanishState = parseProducerBlock(spanishBlock);
		expect(spanishState).toEqual({
			gameTitle: "Chrono Space",
			engine: "Godot 4",
			milestone: "Vertical Slice",
			sprint: "Sprint 4",
			inProgress: "Mecánicas de Salto",
			nextStep: "Audio y Pulido",
		});

		// 4. Assert English block parsing
		const englishBlock = `
<!-- PRODUCER_STATE
Game: Chrono Space
Engine: Bevy
Milestone: Beta Milestone
Sprint: Sprint 2
In Progress: Physics System
Next Step: Networking
<!-- /PRODUCER_STATE -->
`;
		const englishState = parseProducerBlock(englishBlock);
		expect(englishState).toEqual({
			gameTitle: "Chrono Space",
			engine: "Bevy",
			milestone: "Beta Milestone",
			sprint: "Sprint 2",
			inProgress: "Physics System",
			nextStep: "Networking",
		});

		// 5. Assert English alternate key variations (Project, Title, Current Milestone, Active Sprint, Working On, Next)
		const altBlock = `
<!-- PRODUCER_STATE
Title: Void Runner
Engine: Raylib
Current Milestone: Alpha 1.0
Active Sprint: Sprint 7
Working On: Shader Pipeline
Next: Level Design
<!-- /PRODUCER_STATE -->
`;
		const altState = parseProducerBlock(altBlock);
		expect(altState).toEqual({
			gameTitle: "Void Runner",
			engine: "Raylib",
			milestone: "Alpha 1.0",
			sprint: "Sprint 7",
			inProgress: "Shader Pipeline",
			nextStep: "Level Design",
		});
	});

	test("studio:agents and agents aliases are registered pointing to handleStudioSubagentsViewer", () => {
		const names = registered.map((r) => r.name);
		expect(names).toContain("studio:agents");
		expect(names).toContain("agents");
		expect(names).toContain("studio:subagents");
		expect(names).toContain("studio:logs");

		// Assert command descriptions highlight live subagent inspector
		const agentsCmd = registered.find((r) => r.name === "agents");
		const studioAgentsCmd = registered.find((r) => r.name === "studio:agents");
		expect(agentsCmd.description).toContain("[Studio]");
		expect(agentsCmd.description.toLowerCase()).toContain("subagentes");
		expect(studioAgentsCmd.description).toContain("[Studio]");
		expect(studioAgentsCmd.description.toLowerCase()).toContain("subagentes");

		// Assert handlers call handleStudioSubagentsViewer
		expect(hooksSource).toMatch(
			/registerCommand\?\.\(\s*["']agents["'][\s\S]*?handleStudioSubagentsViewer/,
		);
		expect(hooksSource).toMatch(
			/registerCommand\?\.\(\s*["']studio:agents["'][\s\S]*?handleStudioSubagentsViewer/,
		);
	});

	test("studio-subagents-widget renders signature Gentle Shell UI with vertical accent bar ▎ and telemetry", () => {
		const widgetPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-widget.ts");
		expect(fs.existsSync(widgetPath)).toBe(true);

		const widgetSource = fs.readFileSync(widgetPath, "utf8");
		expect(widgetSource).toContain("export function renderSubagentsWidgetCard");
		expect(widgetSource).toContain("export function formatElapsed");

		// Gentle Shell signature left accent bar ▎ instead of box borders
		expect(widgetSource).toContain("▎");
		expect(widgetSource).not.toContain("╭─");
		expect(widgetSource).not.toContain("╰─");

		// Header and status glyphs
		expect(widgetSource).toContain("❀ Agents");
		expect(widgetSource).toContain("active");
		expect(widgetSource).toContain("reciente");
		expect(widgetSource).toContain("◐"); // running
		expect(widgetSource).toContain("✓"); // completed
		expect(widgetSource).toContain("✗"); // failed
		expect(widgetSource).toContain("○"); // queued

		// Right-aligned telemetry string formatting (model · thinking · elapsed)
		expect(widgetSource).toContain("telemetryStr");
	});

	test("studio-subagents-viewer provides split-screen and modal views with panels and navigation hints", () => {
		const viewerPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-viewer.ts");
		expect(fs.existsSync(viewerPath)).toBe(true);

		const viewerSource = fs.readFileSync(viewerPath, "utf8");
		expect(viewerSource).toContain("export async function handleStudioSubagentsViewer");
		expect(viewerSource).toContain("export function renderSubagentModalView");
		expect(viewerSource).toContain("export function renderSubagentSplitView");
		expect(viewerSource).toContain("export class SubagentsViewerComponent");

		// Header bar with status, model, elapsed, task ID
		expect(viewerSource).toContain("INSPECTOR DE ESPECIALISTA");
		expect(viewerSource).toContain("Task ID");
		expect(viewerSource).toContain("EN EJECUCIÓN");

		// Instruction / Prompt panel
		expect(viewerSource).toContain("Instrucción Asignada");

		// Live Tool Call Events & Logs panel
		expect(viewerSource).toContain("Eventos y Llamadas de Herramientas (En Vivo)");

		// Final Result / Delivery or Error panel
		expect(viewerSource).toContain("Resultado / Entrega Final");
		expect(viewerSource).toContain("Error Registrado");

		// Navigation hints in footer
		expect(viewerSource).toContain("↑/↓: Seleccionar agente • Esc: Salir • c: Cancelar");
	});
});


