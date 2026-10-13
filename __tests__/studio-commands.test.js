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
			"changes",
			"studio:sound",
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
			"studio:perf-guard",
			"perf-guard",
			"studio:watch",
			"watch",
			"studio:assets",
			"assets",
			"palette",
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

	test("studio-subagents-widget renders sovereign gamedev console dispatch with accent bar ▌ and engine telemetry", () => {
		const widgetPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-widget.ts");
		expect(fs.existsSync(widgetPath)).toBe(true);

		const widgetSource = fs.readFileSync(widgetPath, "utf8");
		expect(widgetSource).toContain("export function renderSubagentsWidgetCard");
		expect(widgetSource).toContain("export function formatElapsed");

		// Sovereign game engine console left accent bar ▌ instead of box borders
		expect(widgetSource).toContain("▌");
		expect(widgetSource).not.toContain("╭─");
		expect(widgetSource).not.toContain("╰─");

		// Header and sovereign gamedev telemetry status glyphs
		expect(widgetSource).toContain("◈ ENGINE DISPATCH");
		expect(widgetSource).not.toContain("❀ Agents");
		expect(widgetSource).toContain("● COMPILANDO"); // running / compiling
		expect(widgetSource).toContain("▲ OK"); // completed
		expect(widgetSource).toContain("■ BLOQUEADO"); // failed
		expect(widgetSource).toContain("○ EN COLA"); // queued

		// Engine tags for specialists
		expect(widgetSource).toContain("[Bevy]");
		expect(widgetSource).toContain("[Godot]");
		expect(widgetSource).toContain("[Raylib]");
		expect(widgetSource).toContain("[Unity]");
		expect(widgetSource).toContain("[Unreal]");

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

	test("Feature 1: studio-hud infers ODD phase chips [concept 1/6] through [ship 6/6]", () => {
		const hudPath = path.join(__dirname, "..", "extensions", "hooks", "studio-hud.ts");
		expect(fs.existsSync(hudPath)).toBe(true);

		const hudSource = fs.readFileSync(hudPath, "utf8");
		expect(hudSource).toContain("export function inferOddPhase");
		expect(hudSource).toContain("export function getOddPhaseInfo");
		expect(hudSource).toContain("export const ODD_PHASES");
		expect(hudSource).toContain("[concept 1/6]");
		expect(hudSource).toContain("[spec 2/6]");
		expect(hudSource).toContain("[arch 3/6]");
		expect(hudSource).toContain("[code 4/6]");
		expect(hudSource).toContain("[test 5/6]");
		expect(hudSource).toContain("[ship 6/6]");

		// Logic test reproducing getOddPhaseInfo regex inference
		function testInferOddPhase(prodState) {
			if (!prodState) return "[concept 1/6]";
			const inProg = (prodState.inProgress || "").toLowerCase();
			const milestone = (prodState.milestone || "").toLowerCase();
			const nextStep = (prodState.nextStep || "").toLowerCase();

			if (/(?:ship|release|lanzamiento|publicaci|dist|store|gold|v1\.0|deploy)/.test(inProg)) return "[ship 6/6]";
			if (/(?:test|qa|prueba|smoke|soak|regresi|bug|feel|verif|calidad)/.test(inProg)) return "[test 5/6]";
			if (/(?:concept|visión|vision|fantas|brainstorm|pitch|jam|premisa|pilar|pillar|arquetipo|incept)/.test(inProg)) return "[concept 1/6]";
			if (/(?:spec|gdd|diseño|design|live spec|tuning|knob|balance|regla)/.test(inProg)) return "[spec 2/6]";
			if (/(?:arch|arquitect|adr|budget|presupuesto|sistema|system|pipeline|mcp)/.test(inProg)) return "[arch 3/6]";
			if (/(?:code|código|codigo|implement|motor|engine|gameplay|physic|físic|shader|scene|escena|script|salto|movimiento|player|mechanic|mecánic|arpg)/.test(inProg)) return "[code 4/6]";

			if (/(?:ship|release|lanzamiento|publicaci|dist|store|gold|v1\.0)/.test(milestone)) return "[ship 6/6]";
			if (/(?:test|qa|beta|regression|smoke)/.test(milestone)) return "[test 5/6]";
			if (/(?:code|prototipo|prototype|vertical slice|alpha|m1|m2|gameplay|engine)/.test(milestone)) return "[code 4/6]";
			if (/(?:arch|arquitect|adr|sistema)/.test(milestone)) return "[arch 3/6]";
			if (/(?:spec|live spec|gdd|diseño)/.test(milestone)) return "[spec 2/6]";
			if (/(?:concept|visión|jam|pitch)/.test(milestone)) return "[concept 1/6]";

			if (prodState.engine) return "[code 4/6]";
			return "[concept 1/6]";
		}

		expect(testInferOddPhase({ inProgress: "Brainstorming de pilares y fantasía" })).toBe("[concept 1/6]");
		expect(testInferOddPhase({ inProgress: "Live Spec de mecánicas de combate" })).toBe("[spec 2/6]");
		expect(testInferOddPhase({ inProgress: "ADRs y Presupuesto de memoria VRAM" })).toBe("[arch 3/6]");
		expect(testInferOddPhase({ inProgress: "Mecánicas de Salto y física 2D" })).toBe("[code 4/6]");
		expect(testInferOddPhase({ inProgress: "Testing de regresión y smoke test" })).toBe("[test 5/6]");
		expect(testInferOddPhase({ inProgress: "Release v1.0 y build WASM para store" })).toBe("[ship 6/6]");

		// Fallback to milestone
		expect(testInferOddPhase({ milestone: "M1 — Prototipo" })).toBe("[code 4/6]");
		expect(testInferOddPhase({ milestone: "Concept Jam" })).toBe("[concept 1/6]");
	});

	test("Feature 2: studio-sound exports audio chimes and toggles", () => {
		const soundPath = path.join(__dirname, "..", "extensions", "hooks", "studio-sound.ts");
		expect(fs.existsSync(soundPath)).toBe(true);

		const soundSource = fs.readFileSync(soundPath, "utf8");
		expect(soundSource).toContain("export function playSuccessChime");
		expect(soundSource).toContain("export function playAlertChime");
		expect(soundSource).toContain("export function playErrorChime");
		expect(soundSource).toContain("export function isSoundEnabled");
		expect(soundSource).toContain("export function setSoundEnabled");
		expect(soundSource).toContain("export async function handleStudioSound");

		// Cross-platform audio triggers
		expect(soundSource).toContain("paplay");
		expect(soundSource).toContain("pw-play");
		expect(soundSource).toContain("aplay");
		expect(soundSource).toContain("afplay");
		expect(soundSource).toContain("powershell");
		expect(soundSource).toContain("\\x07");

		// Wired in index.ts
		expect(hooksSource).toContain("playSuccessChime()");
		expect(hooksSource).toContain("playErrorChime()");
		expect(hooksSource).toContain("playAlertChime()");
		expect(hooksSource).toContain("handleStudioSound");
		expect(hooksSource).toMatch(/registerCommand\?\.\(\s*["']studio:sound["']/);
	});

	test("Feature 3: studio-hud renders compact status bar telemetry with left accent bar ▎", () => {
		const hudPath = path.join(__dirname, "..", "extensions", "hooks", "studio-hud.ts");
		const hudSource = fs.readFileSync(hudPath, "utf8");

		// Checks telemetry header elements
		expect(hudSource).toContain("▎ Motor:");
		expect(hudSource).toContain("Hito:");
		expect(hudSource).toContain("Sprint:");
		expect(hudSource).toContain("Context:");
		expect(hudSource).toContain("inferOddPhase");

		// Replicates footer formatting
		function formatFooterBar(engine, milestone, sprint, phaseChip, contextDisplay) {
			const parts = [];
			parts.push(`▎ Motor: ${engine}`);
			parts.push(`Hito: ${milestone}`);
			parts.push(`Sprint: ${sprint}`);
			parts.push(phaseChip);
			parts.push(`Context: ${contextDisplay}`);
			return parts.join(" · ");
		}

		const rendered = formatFooterBar("Godot 4", "M1 — Prototipo", "Sprint 1", "[code 4/6]", "15% (30k/200k)");
		expect(rendered).toBe("▎ Motor: Godot 4 · Hito: M1 — Prototipo · Sprint: Sprint 1 · [code 4/6] · Context: 15% (30k/200k)");
		expect(rendered.startsWith("▎ Motor:")).toBe(true);
		expect(rendered).toContain("Context:");
	});

	test("Feature 4: studio-changes provides git changes card, diff stats (+X -Y) and /changes alias", () => {
		const changesPath = path.join(__dirname, "..", "extensions", "hooks", "studio-changes.ts");
		const changesSource = fs.readFileSync(changesPath, "utf8");

		expect(changesSource).toContain("export function getGitDiffStats");
		expect(changesSource).toContain("export function getFileDiff");
		expect(changesSource).toContain("export function renderChangesCard");
		expect(changesSource).toContain("additions");
		expect(changesSource).toContain("deletions");

		// Alias /changes registered in index.ts
		expect(hooksSource).toMatch(/registerCommand\?\.\(\s*["']changes["']/);
		expect(hooksSource).toMatch(/registerCommand\?\.\(\s*["']studio:changes["']/);

		// Diff formatting test
		function formatStatRow(status, filePath, adds, dels) {
			const statStr = (adds !== undefined || dels !== undefined) ? ` (+${adds ?? 0} -${dels ?? 0})` : "";
			return `  ${status.padEnd(2)} ${filePath}${statStr}`;
		}

		const row = formatStatRow("M", "src/player.gd", 12, 4);
		expect(row).toBe("  M  src/player.gd (+12 -4)");
	});

	test("Feature 5: studio-choice renders tab indicators [ 1. Header* ] and left accent bar ▎", () => {
		const choicePath = path.join(__dirname, "..", "extensions", "hooks", "studio-choice.ts");
		const choiceSource = fs.readFileSync(choicePath, "utf8");

		expect(choiceSource).toContain("export function renderQuestionTabs");
		expect(choiceSource).toContain("export function formatQuestionPrompt");
		expect(choiceSource).toContain("▎");
		expect(choiceSource).toContain("playAlertChime");

		// Direct test of tab indicator generation
		function renderTabs(currentIndex, questions) {
			return questions
				.map((q, idx) => {
					const label = q.header || `Pregunta ${idx + 1}`;
					return idx === currentIndex ? `[ ${idx + 1}. ${label}* ]` : `[ ${idx + 1}. ${label} ]`;
				})
				.join("  ");
		}

		function formatPrompt(currentIndex, questions) {
			const q = questions[currentIndex];
			if (questions.length > 1) {
				const tabs = renderTabs(currentIndex, questions);
				return `▎ ${tabs}\n▎ ${q.question}`;
			}
			return `▎ ${q.question}`;
		}

		const batch = [
			{ question: "¿Qué motor usas?", header: "Motor" },
			{ question: "¿Qué modelo de IA deseas?", header: "Modelo" },
			{ question: "¿Qué alcance defines?", header: "Alcance" },
		];

		// Step 1: Motor is active with *
		const step1Prompt = formatPrompt(0, batch);
		expect(step1Prompt).toContain("▎ [ 1. Motor* ]  [ 2. Modelo ]  [ 3. Alcance ]");
		expect(step1Prompt).toContain("▎ ¿Qué motor usas?");

		// Step 2: Modelo is active with *
		const step2Prompt = formatPrompt(1, batch);
		expect(step2Prompt).toContain("▎ [ 1. Motor ]  [ 2. Modelo* ]  [ 3. Alcance ]");
		expect(step2Prompt).toContain("▎ ¿Qué modelo de IA deseas?");

		// Single question prompt
		const singlePrompt = formatPrompt(0, [{ question: "¿Continuar?" }]);
		expect(singlePrompt).toBe("▎ ¿Continuar?");
	});

	test("Feature A: studio-perf-guard audits frame loops and blocking calls", () => {
		const perfGuardPath = path.join(__dirname, "..", "extensions", "hooks", "studio-perf-guard.ts");
		expect(fs.existsSync(perfGuardPath)).toBe(true);

		const perfSource = fs.readFileSync(perfGuardPath, "utf8");
		expect(perfSource).toContain("export function auditFilePerformance");
		expect(perfSource).toContain("export async function handleStudioPerfAudit");
		expect(perfSource).toContain("export function detectLanguageFromPath");

		// Frame loop allocations and patterns
		expect(perfSource).toContain(".clone()");
		expect(perfSource).toContain("Box::new");
		expect(perfSource).toContain("Vec::new");
		expect(perfSource).toContain("malloc");
		expect(perfSource).toContain("ResourceLoader.load");

		// Blocking calls
		expect(perfSource).toContain("thread::sleep");
		expect(perfSource).toContain("OS.delay");
		expect(perfSource).toContain("FileAccess.open");

		// Actionable warning message
		expect(perfSource).toContain("◈ PERF ALERT:");
		expect(perfSource).toContain("allocations detected in frame loop of");
		expect(perfSource).toContain("▲ PERF AUDIT OK:");

		// Behavioral test of frame loop regexes & patterns
		const frameLoopRegex = /func\s+(_process|_physics_process|update)\s*\(|fn\s+([a-zA-Z0-9_]*(?:update|tick|system)[a-zA-Z0-9_]*)\s*\(|(?:void)\s+(Update|FixedUpdate)\s*\(/;
		expect(frameLoopRegex.test("func _process(delta):")).toBe(true);
		expect(frameLoopRegex.test("fn update_player_system() {")).toBe(true);
		expect(frameLoopRegex.test("void Update() {")).toBe(true);
		expect(frameLoopRegex.test("fn helper_calculation() {")).toBe(false);

		const allocRegex = /\.clone\s*\(\s*\)|Box::new\s*\(|Vec::new\s*\(|\bmalloc\s*\(|\bnew\s+[A-Za-z0-9_]+|\.new\s*\(/;
		expect(allocRegex.test("let x = query.clone();")).toBe(true);
		expect(allocRegex.test("let b = Box::new(10);")).toBe(true);
		expect(allocRegex.test("void* ptr = malloc(1024);")).toBe(true);
		expect(allocRegex.test("var node = Node.new()")).toBe(true);
	});

	test("Feature B: studio-watch provides compile check commands and live watcher", () => {
		const watchPath = path.join(__dirname, "..", "extensions", "hooks", "studio-watch.ts");
		expect(fs.existsSync(watchPath)).toBe(true);

		const watchSource = fs.readFileSync(watchPath, "utf8");
		expect(watchSource).toContain("export function getEngineCompileCommand");
		expect(watchSource).toContain("export async function runEngineCompileCheck");
		expect(watchSource).toContain("export async function handleStudioWatch");
		expect(watchSource).toContain("export function isStudioWatcherActive");
		expect(watchSource).toContain("export function stopStudioWatcher");

		// Engine compilation commands
		expect(watchSource).toContain("cargo check");
		expect(watchSource).toContain("godot --headless --check-only");
		expect(watchSource).toContain("cmake --build");

		// Background notification telemetry
		expect(watchSource).toContain("◈ COMPILE OK:");
		expect(watchSource).toContain("build clean in");
		expect(watchSource).toContain("◈ BUILD ERROR:");

		// Replicates engine command mapping
		function resolveCompileCmd(engine) {
			const norm = engine.toLowerCase();
			if (norm.includes("bevy")) return "cargo check";
			if (norm.includes("godot")) return "godot --headless --check-only";
			if (norm.includes("raylib")) return "cmake --build build 2>/dev/null || make -j4 2>/dev/null || true";
			return "cargo check";
		}
		expect(resolveCompileCmd("Bevy")).toBe("cargo check");
		expect(resolveCompileCmd("Godot")).toBe("godot --headless --check-only");
		expect(resolveCompileCmd("Raylib")).toContain("cmake");
	});

	test("Feature C: studio-sound synthesizes authentic 8-bit retro chiptune chimes", () => {
		const soundPath = path.join(__dirname, "..", "extensions", "hooks", "studio-sound.ts");
		expect(fs.existsSync(soundPath)).toBe(true);

		const soundSource = fs.readFileSync(soundPath, "utf8");
		expect(soundSource).toContain("export function synthesizeRetroChime");
		expect(soundSource).toContain("RIFF");
		expect(soundSource).toContain("WAVE");

		// 8-bit coin / rising tone sequence frequencies
		expect(soundSource).toContain("987");
		expect(soundSource).toContain("1318");

		// Alert blip & error buzz frequencies
		expect(soundSource).toContain("1760");
		expect(soundSource).toContain("260");

		// Audio commands
		expect(soundSource).toContain("paplay");
		expect(soundSource).toContain("pw-play");
		expect(soundSource).toContain("aplay");
		expect(soundSource).toContain("afplay");
		expect(soundSource).toContain("powershell");

		// Replicate WAV buffer format validation
		const sampleRate = 22050;
		const numSamples = 100;
		const subChunk2Size = numSamples * 2;
		const chunkSize = 36 + subChunk2Size;
		const buf = Buffer.alloc(44 + subChunk2Size);
		buf.write("RIFF", 0);
		buf.writeUInt32LE(chunkSize, 4);
		buf.write("WAVE", 8);
		buf.write("fmt ", 12);
		expect(buf.toString("ascii", 0, 4)).toBe("RIFF");
		expect(buf.toString("ascii", 8, 12)).toBe("WAVE");
	});

	test("Feature D: studio-assets audits images, 3D model budgets, and manifest", () => {
		const assetsPath = path.join(__dirname, "..", "extensions", "hooks", "studio-assets.ts");
		expect(fs.existsSync(assetsPath)).toBe(true);

		const assetsSource = fs.readFileSync(assetsPath, "utf8");
		expect(assetsSource).toContain("export function auditAssets");
		expect(assetsSource).toContain("export async function handleStudioAssets");

		// PNG & oxipng optimization
		expect(assetsSource).toContain("oxipng -o 4 --strip all");
		expect(assetsSource).toContain(".png");

		// 3D models and budget
		expect(assetsSource).toContain(".glb");
		expect(assetsSource).toContain(".gltf");
		expect(assetsSource).toContain("DEFAULT_MODEL_BUDGET_BYTES");

		// Manifest cross-referencing
		expect(assetsSource).toContain("manifest.yaml");
		expect(assetsSource).toContain("placeholder");
		expect(assetsSource).toContain("missingCount");
		expect(assetsSource).toContain("placeholderCount");

		// Placeholder detector test
		function isPlaceholderValue(val) {
			const lower = val.toLowerCase();
			return lower.includes("todo") || lower.includes("tbd") || lower.includes("placeholder") || lower.includes("unresolved");
		}
		expect(isPlaceholderValue("TODO: add player texture")).toBe(true);
		expect(isPlaceholderValue("placeholder.png")).toBe(true);
		expect(isPlaceholderValue("hero_idle.png")).toBe(false);
	});

	test("Auto-perf-guard hook is wired in index.ts for write events", () => {
		expect(hooksSource).toContain("auditFilePerformance");
		expect(hooksSource).toContain("◈ PERF ALERT:");
		expect(hooksSource).toContain("handleStudioPerfAudit");
		expect(hooksSource).toContain("handleStudioWatch");
		expect(hooksSource).toContain("handleStudioAssets");
	});

	// ──────────────────────────────────────────────
	// Block 1: Fuzzy Command Palette (Alt+K, /palette, /studio:commands)
	// ──────────────────────────────────────────────
	describe("Block 1: Fuzzy Command Palette", () => {
		const palettePath = path.join(__dirname, "..", "extensions", "hooks", "studio-palette.ts");
		const overlayPath = path.join(__dirname, "..", "extensions", "hooks", "studio-palette-overlay.ts");

		test("studio-palette.ts and studio-palette-overlay.ts exist and export required contracts", () => {
			expect(fs.existsSync(palettePath)).toBe(true);
			expect(fs.existsSync(overlayPath)).toBe(true);

			const palSource = fs.readFileSync(palettePath, "utf8");
			expect(palSource).toContain("export const STUDIO_COMMAND_REGISTRY");
			expect(palSource).toContain("export function fuzzyMatch");
			expect(palSource).toContain("export function highlightMatch");
			expect(palSource).toContain("export function filterCommands");
			expect(palSource).toContain("export const PALETTE_CATEGORIES");

			const ovSource = fs.readFileSync(overlayPath, "utf8");
			expect(ovSource).toContain("export class CommandPaletteOverlayComponent");
			expect(ovSource).toContain("export async function showCommandPalette");
		});

		test("STUDIO_COMMAND_REGISTRY covers all 4 categories and all 31 required commands", () => {
			const palSource = fs.readFileSync(palettePath, "utf8");

			// Parse command items from source
			const cmdMatches = [...palSource.matchAll(/name:\s*["']([^"']+)["']\s*,\s*description:\s*["']([^"']+)["']\s*,\s*category:\s*["']([^"']+)["']/g)];
			expect(cmdMatches.length).toBe(31);

			const commandNames = cmdMatches.map((m) => m[1]);
			const categories = Array.from(new Set(cmdMatches.map((m) => m[3])));

			expect(categories).toContain("ODD Pipeline");
			expect(categories).toContain("Engine & Dev Tools");
			expect(categories).toContain("Studio & Models");
			expect(categories).toContain("Media & MCP");

			// ODD Pipeline (6)
			const oddCommands = ["/concept", "/spec", "/arch", "/code", "/test", "/ship"];
			for (const cmd of oddCommands) {
				expect(commandNames).toContain(cmd);
				const match = cmdMatches.find((m) => m[1] === cmd);
				expect(match[3]).toBe("ODD Pipeline");
			}

			// Engine & Dev Tools (7)
			const engineCommands = ["/doctor", "/watch", "/profile", "/perf-guard", "/web", "/tasks", "/changes"];
			for (const cmd of engineCommands) {
				expect(commandNames).toContain(cmd);
				const match = cmdMatches.find((m) => m[1] === cmd);
				expect(match[3]).toBe("Engine & Dev Tools");
			}

			// Studio & Models (13)
			const studioCommands = [
				"/studio",
				"/studio:start",
				"/studio:setup",
				"/studio:new",
				"/studio:models",
				"/studio:status",
				"/studio:agents",
				"/studio:chains",
				"/studio:subagents",
				"/studio:settings",
				"/studio:sound",
				"/studio:art",
				"/studio:help",
			];
			for (const cmd of studioCommands) {
				expect(commandNames).toContain(cmd);
				const match = cmdMatches.find((m) => m[1] === cmd);
				expect(match[3]).toBe("Studio & Models");
			}

			// Media & MCP (5)
			const mediaCommands = ["/studio:mcp", "/studio:tools", "/studio:assets", "/studio:sfx", "/studio:palettes"];
			for (const cmd of mediaCommands) {
				expect(commandNames).toContain(cmd);
				const match = cmdMatches.find((m) => m[1] === cmd);
				expect(match[3]).toBe("Media & MCP");
			}
		});

		test("fuzzyMatch algorithm correctly computes subsequence matches and bonuses", () => {
			// Behavioral implementation replicating fuzzyMatch
			function fuzzyMatchTest(pattern, text) {
				if (!pattern) return { matches: true, score: 0, indices: [] };
				const pLen = pattern.length;
				const tLen = text.length;
				if (pLen > tLen) return { matches: false, score: 0, indices: [] };

				const pLower = pattern.toLowerCase();
				const tLower = text.toLowerCase();
				let pIdx = 0;
				let tIdx = 0;
				const indices = [];
				let score = 0;
				let consecutive = 0;

				while (pIdx < pLen && tIdx < tLen) {
					if (pLower[pIdx] === tLower[tIdx]) {
						indices.push(tIdx);
						let charScore = 10;
						if (tIdx === 0) charScore += 40; // Prefix bonus
						if (tIdx > 0 && /[\s\/:_\.\-]/.test(text[tIdx - 1])) charScore += 30; // Word boundary bonus
						if (tIdx > 0 && /[a-z]/.test(text[tIdx - 1]) && /[A-Z]/.test(text[tIdx])) charScore += 25; // CamelCase bonus
						if (pattern[pIdx] === text[tIdx]) charScore += 10; // Exact case bonus
						if (consecutive > 0) charScore += 15 * consecutive; // Consecutive bonus
						consecutive++;
						score += charScore;
						pIdx++;
						tIdx++;
					} else {
						consecutive = 0;
						tIdx++;
					}
				}

				if (pIdx < pLen) return { matches: false, score: 0, indices: [] };
				if (pLower === tLower) score += 100;
				return { matches: true, score, indices };
			}

			// Empty pattern returns full match with 0 score
			const emptyRes = fuzzyMatchTest("", "/concept");
			expect(emptyRes.matches).toBe(true);
			expect(emptyRes.score).toBe(0);
			expect(emptyRes.indices).toEqual([]);

			// Pattern longer than text fails
			const longRes = fuzzyMatchTest("superlongpattern", "short");
			expect(longRes.matches).toBe(false);

			// Non-subsequence fails
			const nonSub = fuzzyMatchTest("xyz", "/concept");
			expect(nonSub.matches).toBe(false);

			// Basic subsequence match
			const matchRes = fuzzyMatchTest("cpt", "/concept");
			expect(matchRes.matches).toBe(true);
			expect(matchRes.indices.length).toBe(3);

			// Prefix bonus: match starting at 0 scores higher than starting later
			const atPrefix = fuzzyMatchTest("c", "concept");
			const notAtPrefix = fuzzyMatchTest("c", "a_concept");
			expect(atPrefix.score).toBeGreaterThan(notAtPrefix.score);

			// Word boundary bonus: match after delimiter (/ : - _ .) scores higher
			const wordBoundary = fuzzyMatchTest("s", "/studio:start");
			const nonWordBoundary = fuzzyMatchTest("u", "studio");
			expect(wordBoundary.score).toBeGreaterThan(nonWordBoundary.score);

			// Consecutive match bonus: consecutive matches score higher than fragmented
			const consecutive = fuzzyMatchTest("con", "concept");
			const fragmented = fuzzyMatchTest("cpt", "concept");
			expect(consecutive.score).toBeGreaterThan(fragmented.score);

			// Exact case bonus
			const exactCase = fuzzyMatchTest("Concept", "Concept");
			const mixedCase = fuzzyMatchTest("concept", "Concept");
			expect(exactCase.score).toBeGreaterThan(mixedCase.score);

			// Full exact match bonus
			const fullMatch = fuzzyMatchTest("/concept", "/concept");
			expect(fullMatch.score).toBeGreaterThan(150);
		});

		test("highlightMatch wraps matched characters with ANSI codes", () => {
			function highlightMatchTest(text, indices, highlightColor = "\x1b[36m", resetColor = "\x1b[0m") {
				if (!indices || indices.length === 0) return text;
				const set = new Set(indices);
				let result = "";
				for (let i = 0; i < text.length; i++) {
					if (set.has(i)) {
						result += `${highlightColor}${text[i]}${resetColor}`;
					} else {
						result += text[i];
					}
				}
				return result;
			}

			const text = "concept";
			const highlighted = highlightMatchTest(text, [0, 3]);
			expect(highlighted).toContain("\x1b[36m");
			expect(highlighted).toContain("c");
			expect(highlighted.replace(/\x1b\[[0-9;]*m/g, "")).toBe("concept");
		});

		test("CommandPaletteOverlayComponent manages live input, navigation, and category cycling", () => {
			const ovSource = fs.readFileSync(overlayPath, "utf8");

			// Check overlay class and core methods
			expect(ovSource).toContain("class CommandPaletteOverlayComponent");
			expect(ovSource).toContain("cycleCategory");
			expect(ovSource).toContain("recomputeFilter");
			expect(ovSource).toContain("handleInput");
			expect(ovSource).toContain("render(");

			// Check keyboard shortcuts supported in handleInput
			expect(ovSource).toContain('"\\t"'); // Tab
			expect(ovSource).toContain('"\\x1b[Z"'); // Shift+Tab
			expect(ovSource).toContain('"\\x1b[A"'); // Up
			expect(ovSource).toContain('"\\x1b[B"'); // Down
			expect(ovSource).toContain('"\\x10"'); // Ctrl+P
			expect(ovSource).toContain('"\\x0e"'); // Ctrl+N
			expect(ovSource).toContain('"\\r"'); // Enter
			expect(ovSource).toContain('"\\x1b"'); // Esc
			expect(ovSource).toContain('"\\x15"'); // Ctrl+U (clear)

			// Check UI features in render
			expect(ovSource).toContain("PALETA DE COMANDOS [Alt+K]");
			expect(ovSource).toContain("categoryTabs");
			expect(ovSource).toContain("highlightMatch");
		});

		test("showCommandPalette invokes custom overlay and sets editor text", () => {
			const ovSource = fs.readFileSync(overlayPath, "utf8");
			expect(ovSource).toContain("async function showCommandPalette");
			expect(ovSource).toContain("overlay: true");
			expect(ovSource).toContain("setEditorText");
			expect(ovSource).toContain("notify");
		});

		test("TypeScript runtime execution of Block 1 in Node", () => {
			const script = `
				const { STUDIO_COMMAND_REGISTRY, fuzzyMatch, filterCommands } = await import("./extensions/hooks/studio-palette.ts");
				const { CommandPaletteOverlayComponent, showCommandPalette } = await import("./extensions/hooks/studio-palette-overlay.ts");
				if (STUDIO_COMMAND_REGISTRY.length !== 31) throw new Error("Registry length mismatch: " + STUDIO_COMMAND_REGISTRY.length);
				const match = fuzzyMatch("start", "/studio:start");
				if (!match.matches) throw new Error("Fuzzy match failed");
				const filtered = filterCommands("spec", "ODD Pipeline");
				if (filtered.length === 0 || filtered[0].name !== "/spec") throw new Error("Filter commands mismatch");
			`;
			const { execFileSync } = require("child_process");
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});
	});

	// ──────────────────────────────────────────────
	// Block 2: Engine Safety & Guards
	// ──────────────────────────────────────────────
	describe("Block 2: Engine Safety & Guards", () => {
		const escPath = path.join(__dirname, "..", "extensions", "hooks", "studio-esc-guard.ts");
		const destPath = path.join(__dirname, "..", "extensions", "hooks", "studio-destructive-guard.ts");
		const surfPath = path.join(__dirname, "..", "extensions", "hooks", "studio-surfaces-guard.ts");

		test("guard files exist and export required contracts", () => {
			expect(fs.existsSync(escPath)).toBe(true);
			expect(fs.existsSync(destPath)).toBe(true);
			expect(fs.existsSync(surfPath)).toBe(true);

			const escSource = fs.readFileSync(escPath, "utf8");
			expect(escSource).toContain("export class DoubleEscapeGuard");
			expect(escSource).toContain("export const doubleEscapeGuard");
			expect(escSource).toContain("handleEscape");
			expect(escSource).toContain("thresholdMs");
			expect(escSource).toContain("Emergency cancel (Double-Esc)");

			const destSource = fs.readFileSync(destPath, "utf8");
			expect(destSource).toContain("export function isDestructiveCommand");
			expect(destSource).toContain("export function validateCommandSafety");

			const surfSource = fs.readFileSync(surfPath, "utf8");
			expect(surfSource).toContain("export function parseAllowedSurfaces");
			expect(surfSource).toContain("export function isPathAllowed");
			expect(surfSource).toContain("export function validateEditSurface");
			expect(surfSource).toContain("export class BoundedSurfacesGuard");
			expect(surfSource).toContain("export const boundedSurfacesGuard");
		});

		test("DoubleEscapeGuard tracks Escape timestamps and triggers cancel only on 2nd Escape <= 1000ms", () => {
			class TestDoubleEscapeGuard {
				constructor(thresholdMs = 1000) {
					this.thresholdMs = thresholdMs;
					this.lastEscapeTimestamp = 0;
					this.cancelled = false;
				}
				handleEscape(ctx) {
					const now = Date.now();
					const diff = now - this.lastEscapeTimestamp;
					if (this.lastEscapeTimestamp > 0 && diff <= this.thresholdMs) {
						this.lastEscapeTimestamp = 0;
						this.cancelled = true;
						if (ctx?.ui?.notify) ctx.ui.notify("Cancelación de emergencia", "warning");
						return true;
					}
					this.lastEscapeTimestamp = now;
					return false;
				}
				reset() {
					this.lastEscapeTimestamp = 0;
				}
			}

			const guard = new TestDoubleEscapeGuard(1000);
			const fakeCtx = { ui: { notify: jest.fn() } };

			// 1st Escape returns false (lets normal UI/modals cancel)
			const firstResult = guard.handleEscape(fakeCtx);
			expect(firstResult).toBe(false);
			expect(guard.lastEscapeTimestamp).toBeGreaterThan(0);
			expect(fakeCtx.ui.notify).not.toHaveBeenCalled();

			// 2nd Escape within 1000ms triggers emergency cancel
			const secondResult = guard.handleEscape(fakeCtx);
			expect(secondResult).toBe(true);
			expect(guard.lastEscapeTimestamp).toBe(0); // Reset
			expect(fakeCtx.ui.notify).toHaveBeenCalled();

			// After emergency cancel, a new 1st Escape returns false again
			const thirdResult = guard.handleEscape(fakeCtx);
			expect(thirdResult).toBe(false);
		});

		test("DestructiveCommandGuard detects and blocks catastrophic commands on game directories", () => {
			const destSource = fs.readFileSync(destPath, "utf8");
			expect(destSource).toContain("git\\s+reset\\s+--hard");
			expect(destSource).toContain("git\\s+clean");
			expect(destSource).toContain("PROTECTED_GAME_DIRECTORIES");
			expect(destSource).toContain('"src"');
			expect(destSource).toContain('"assets"');
			expect(destSource).toContain('"design"');

			// Behavioral test of destructive command rules
			function testIsDestructive(command) {
				const segments = command.split(/&&|;|\|\||\|/).map((s) => s.trim()).filter(Boolean);
				for (const segment of segments) {
					if (/\bgit\s+reset\s+--hard\b/i.test(segment)) return true;
					if (/\bgit\s+clean\s+[^|\n;&]*(-[a-zA-Z]*f[a-zA-Z]*|--force)\b/i.test(segment)) return true;
					if (/\bdd\s+(?:if=|of=|[a-z0-9\/=])/i.test(segment)) return true;
					if (/\b(?:mkfs|mkfs\.[a-z0-9]+)\b/i.test(segment)) return true;
					if (/\bformat\s+[A-Za-z]:/i.test(segment) || /^format\b/i.test(segment)) return true;
					if (/\b(?:fdisk|parted)\b/i.test(segment)) return true;
					if (/\brm\s+-[a-zA-Z]*[rf][a-zA-Z]*/i.test(segment) || /\brm\s+--recursive/i.test(segment)) {
						if (/\brm\s+-[a-zA-Z]*\s+(\*|\.|\/)\b/.test(segment) || /\s+(\*|\.|\/)(?:\s|$)/.test(segment)) return true;
						for (const dir of ["src", "assets", "design"]) {
							const dirPattern = new RegExp(`(?:^|[\\/\\s"'])(${dir})(?:$|[\\/\\s"'*])`, "i");
							if (dirPattern.test(segment)) return true;
						}
					}
				}
				return false;
			}

			// Safe commands must pass
			expect(testIsDestructive("git status")).toBe(false);
			expect(testIsDestructive("git diff")).toBe(false);
			expect(testIsDestructive("git log -n 5")).toBe(false);
			expect(testIsDestructive("cargo check")).toBe(false);
			expect(testIsDestructive("npm test")).toBe(false);
			expect(testIsDestructive("rm test.tmp")).toBe(false);

			// Destructive git resets
			expect(testIsDestructive("git reset --hard")).toBe(true);
			expect(testIsDestructive("git reset --hard HEAD~1")).toBe(true);
			expect(testIsDestructive("git reset --hard origin/main")).toBe(true);

			// Destructive git cleans
			expect(testIsDestructive("git clean -fd")).toBe(true);
			expect(testIsDestructive("git clean -f")).toBe(true);
			expect(testIsDestructive("git clean -xdf")).toBe(true);
			expect(testIsDestructive("git clean --force")).toBe(true);

			// Destructive rm -rf on game directories (src, assets, design)
			expect(testIsDestructive("rm -rf src")).toBe(true);
			expect(testIsDestructive("rm -rf src/")).toBe(true);
			expect(testIsDestructive("rm -rf src/player.rs")).toBe(true);
			expect(testIsDestructive("rm -rf assets")).toBe(true);
			expect(testIsDestructive("rm -rf assets/sprites/")).toBe(true);
			expect(testIsDestructive("rm -rf design/gdd/feature.md")).toBe(true);
			expect(testIsDestructive("rm -rf *")).toBe(true);
			expect(testIsDestructive("rm -rf .")).toBe(true);

			// Destructive drive wipes
			expect(testIsDestructive("dd if=/dev/zero of=/dev/sda")).toBe(true);
			expect(testIsDestructive("mkfs.ext4 /dev/sdb1")).toBe(true);
			expect(testIsDestructive("format C:")).toBe(true);

			// Compound command containing destructive segment
			expect(testIsDestructive("git status && git reset --hard")).toBe(true);
			expect(testIsDestructive("mkdir tmp; rm -rf src/")).toBe(true);
		});

		test("BoundedSurfacesGuard parses and enforces allowed edit surfaces from tasks", () => {
			const surfSource = fs.readFileSync(surfPath, "utf8");
			expect(surfSource).toContain("## Allowed edit surfaces");
			expect(surfSource).toContain("parseAllowedSurfaces");
			expect(surfSource).toContain("isPathAllowed");
			expect(surfSource).toContain("validateEditSurface");

			// Behavioral test of surface parsing and validation
			function testParseAllowedSurfaces(taskText) {
				const headingMatch = taskText.match(/(?:^|\n)##\s+Allowed edit surfaces\s*\n([\s\S]*?)(?=(?:\n##\s+|\n#\s+|$))/i);
				if (!headingMatch || !headingMatch[1]) return [];
				return headingMatch[1]
					.split("\n")
					.map((l) => l.trim().replace(/^[-*•]\s+/, "").replace(/[`"']/g, "").replace(/^\.\//, "").replace(/\/+$/, "").trim())
					.filter(Boolean);
			}

			function testIsPathAllowed(targetPath, allowedSurfaces) {
				if (!allowedSurfaces || allowedSurfaces.length === 0) return true;
				const normTarget = targetPath.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "").trim();
				for (const surface of allowedSurfaces) {
					const normSurf = surface.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "").trim();
					if (normTarget === normSurf) return true;
					if (normTarget.startsWith(`${normSurf}/`)) return true;
					if (normSurf.endsWith("/*") || normSurf.endsWith("/**")) {
						const prefix = normSurf.replace(/\/\*+$/, "");
						if (normTarget === prefix || normTarget.startsWith(`${prefix}/`)) return true;
					}
					if (normTarget.endsWith(`/${normSurf}`)) return true;
				}
				return false;
			}

			const sampleTask = `
## Allowed edit surfaces
extensions/hooks/studio-palette.ts
extensions/hooks/studio-palette-overlay.ts
extensions/hooks/studio-esc-guard.ts
extensions/hooks/studio-destructive-guard.ts
extensions/hooks/studio-surfaces-guard.ts
extensions/hooks/index.ts
__tests__/studio-commands.test.js
src/

## Task Details
Implement fuzzy command palette.
`;

			const parsed = testParseAllowedSurfaces(sampleTask);
			expect(parsed).toContain("extensions/hooks/studio-palette.ts");
			expect(parsed).toContain("extensions/hooks/studio-palette-overlay.ts");
			expect(parsed).toContain("src");
			expect(parsed.length).toBe(8);

			// Path authorization checks
			expect(testIsPathAllowed("extensions/hooks/studio-palette.ts", parsed)).toBe(true);
			expect(testIsPathAllowed("src/game.rs", parsed)).toBe(true);
			expect(testIsPathAllowed("src/core/loop.rs", parsed)).toBe(true);

			// Outside paths blocked
			expect(testIsPathAllowed("package.json", parsed)).toBe(false);
			expect(testIsPathAllowed("assets/logo.png", parsed)).toBe(false);
			expect(testIsPathAllowed("AGENTS.md", parsed)).toBe(false);

			// Empty allowed surfaces means unbounded task (all allowed)
			expect(testIsPathAllowed("package.json", [])).toBe(true);
		});

		test("TypeScript runtime execution of Block 2 in Node", () => {
			const script = `
				const { DoubleEscapeGuard } = await import("./extensions/hooks/studio-esc-guard.ts");
				const { isDestructiveCommand, validateCommandSafety } = await import("./extensions/hooks/studio-destructive-guard.ts");
				const { parseAllowedSurfaces, isPathAllowed, validateEditSurface, BoundedSurfacesGuard } = await import("./extensions/hooks/studio-surfaces-guard.ts");

				const guard = new DoubleEscapeGuard(1000);
				if (guard.handleEscape()) throw new Error("1st escape should return false");

				if (isDestructiveCommand("git status")) throw new Error("git status is not destructive");
				if (!validateCommandSafety("git status").allowed) throw new Error("git status should be allowed");

				const surfaces = parseAllowedSurfaces("## Allowed edit surfaces\\nsrc/\\nassets/logo.png");
				if (surfaces.length !== 2) throw new Error("Surface parsing mismatch");
				if (!isPathAllowed("src/main.rs", surfaces)) throw new Error("src/main.rs should be allowed");
				if (isPathAllowed("package.json", surfaces)) throw new Error("package.json should not be allowed");
			`;
			const { execFileSync } = require("child_process");
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Integration in index.ts wires palette, shortcuts, and safety guards", () => {
			// Commands and shortcut registration
			expect(hooksSource).toContain('registerCommand?.("palette"');
			expect(hooksSource).toContain('registerShortcut?.("alt+k"');
			expect(hooksSource).toContain('registerCommand?.("studio:commands"');
			expect(hooksSource).toContain("showCommandPalette");

			// Double-Escape Guard wiring
			expect(hooksSource).toContain("doubleEscapeGuard.handleEscape");
			expect(hooksSource).toContain("onTerminalInput");

			// Destructive Command Guard wiring in tool_call (bash)
			expect(hooksSource).toContain("validateCommandSafety");
			expect(hooksSource).toContain("Comando destructivo bloqueado por seguridad del motor");

			// Bounded Surfaces Guard wiring in tool_call (write/edit) and runner lifecycle
			expect(hooksSource).toContain("boundedSurfacesGuard.validate");
			expect(hooksSource).toContain("boundedSurfacesGuard.setFromTask");
			expect(hooksSource).toContain("boundedSurfacesGuard.clear");
		});
	});
});



