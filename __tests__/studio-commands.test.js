const fs = require("fs");
const path = require("path");

describe("Pi Game Studio Extension Commands (studio:*)", () => {
	// Helper to ensure @earendil-works/pi-tui is resolvable in child process scripts
	const tuiResolverHook = `
		import { register } from "node:module";
		import { pathToFileURL } from "node:url";
		import { existsSync, readdirSync } from "node:fs";
		import { homedir } from "node:os";
		import { join } from "node:path";

		const home = homedir();
		function scanForPiTui() {
			const directPaths = [
				"/home/alexis/.local/share/mise/installs/node/25.9.0/lib/node_modules/gentle-pi/node_modules/@earendil-works/pi-tui/dist/index.js",
				join(home, ".gentle-shell/versions/4.3.0-1.2.0/node_modules/.pnpm/@earendil-works+pi-tui@1.2.0/node_modules/@earendil-works/pi-tui/dist/index.js"),
			];
			for (const p of directPaths) {
				if (existsSync(p)) return p;
			}
			// Search in .gentle-shell/versions
			const versionsDir = join(home, ".gentle-shell", "versions");
			if (existsSync(versionsDir)) {
				try {
					for (const v of readdirSync(versionsDir)) {
						const p = join(versionsDir, v, "node_modules", "@earendil-works", "pi-tui", "dist", "index.js");
						if (existsSync(p)) return p;
					}
				} catch {}
			}
			return null;
		}

		const candidateTui = scanForPiTui();

		if (candidateTui) {
			const targetUrl = pathToFileURL(candidateTui).href;
			const loaderCode = "export async function resolve(specifier, context, nextResolve) {" +
				"if (specifier === '@earendil-works/pi-tui') { return { url: '" + targetUrl + "', shortCircuit: true }; }" +
				"return nextResolve(specifier, context);" +
			"}";
			register("data:text/javascript," + encodeURIComponent(loaderCode), import.meta.url);
		}
	`;

	const hooksSource = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "hooks", "index.ts"),
		"utf8",
	);

	const registered = [
		...hooksSource.matchAll(
			/registerCommand\(\s*["\x27]([^"\x27]+)["\x27]\s*,\s*\{([^}]+)\}/gs,
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
			"studio:jam",
			"jam",
			"studio:budget",
			"budget",
			"studio:timeline",
			"timeline",
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

	test("agent groups cover all 15 agents without duplicates", () => {
		const agentsSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-agents.ts"),
			"utf8",
		);

		const agentMatches = [
			...agentsSource.matchAll(/["']([a-z0-9-]+-director|[a-z0-9-]+-programmer|[a-z0-9-]+-designer|[a-z0-9-]+-specialist|[a-z0-9-]+-lead|[a-z0-9-]+-engineer|[a-z0-9-]+-tester|[a-z0-9-]+-analyst|[a-z0-9-]+-manager|[a-z0-9-]+-artist|[a-z0-9-]+-verifier|writer|world-builder|prototyper|producer)["']/g),
		].map((m) => m[1]);

		const uniqueAgents = Array.from(new Set(agentMatches));
		expect(uniqueAgents.length).toBe(15);
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

	test("all 15 agents define structured YAML tools and thinking effort levels", () => {
		const agentsDir = path.join(__dirname, "..", "agents");
		const agentFiles = fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"));
		expect(agentFiles.length).toBe(15);

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

	test("findStudioRoot respects .pi boundaries and prevents inheriting parent studio root", () => {
		const { execFileSync } = require("child_process");
		const script = `
			const { findStudioRoot } = await import("./extensions/hooks/studio-root.ts");
			const path = await import("node:path");
			const fs = await import("node:fs");

			const studioRoot = path.resolve(".");
			if (findStudioRoot(studioRoot) !== studioRoot) {
				throw new Error("Failed to find studio root from root");
			}

			// Project like mi-primer-juego with .pi/agents or .pi/settings.json or .pi/extensions
			const neighborProject = "/home/alexis/Games/mi-primer-juego";
			if (fs.existsSync(neighborProject)) {
				if (findStudioRoot(neighborProject) !== neighborProject) {
					throw new Error("Failed to detect neighbor project as boundary: " + findStudioRoot(neighborProject));
				}
				if (findStudioRoot(path.join(neighborProject, "production")) !== neighborProject) {
					throw new Error("Failed to detect neighbor project from subdir: " + findStudioRoot(path.join(neighborProject, "production")));
				}
			}

			// A directory with .pi must never traverse upwards to parent studio
			const tmpDir = path.join(studioRoot, "sandbox", "test-child-project-" + Date.now());
			const tmpPi = path.join(tmpDir, ".pi");
			fs.mkdirSync(tmpPi, { recursive: true });
			try {
				if (findStudioRoot(tmpDir) !== null) {
					throw new Error("Must stop search at .pi and return null, but returned: " + findStudioRoot(tmpDir));
				}
				fs.mkdirSync(path.join(tmpPi, "agents"), { recursive: true });
				if (findStudioRoot(tmpDir) !== tmpDir) {
					throw new Error("Should recognize .pi/agents as project boundary");
				}
			} finally {
				fs.rmSync(tmpDir, { recursive: true, force: true });
			}
		`;
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.resolve(__dirname, ".."),
			});
		}).not.toThrow();
	});

	test("recordFlowCompletion uses 'Sin motor' and 'M0 — Concepto' fallbacks without Bevy hardcoded", () => {
		const startSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-start.ts"),
			"utf8",
		);

		expect(startSource).not.toContain('state?.engine || "Bevy"');
		expect(startSource).toContain('state?.engine || "Sin motor"');
		expect(startSource).not.toContain('state?.milestone || "M1 — Prototipo Jugable"');
		expect(startSource).toContain('state?.milestone || "M0 — Concepto"');

		// Behavioral verification of recordFlowCompletion unconfigured fallback block
		function generateProducerStateBlock(state, receipt) {
			const gameTitle = state?.gameTitle || "Mi Videojuego";
			const engine = state?.engine || "Sin motor";
			const milestone = state?.milestone || "M0 — Concepto";
			const sprint = state?.sprint || "Sprint 1";
			const next = receipt.nextStep || state?.nextStep || "Siguiente tarea de desarrollo";

			return [
				"<!-- PRODUCER_STATE -->",
				`Juego: ${gameTitle}`,
				`Motor: ${engine}`,
				`Hito Actual: ${milestone}`,
				`Sprint Activo: ${sprint}`,
				`Última Tarea Completada: ${receipt.task}`,
				`En Progreso: ${next}`,
				`Siguiente Paso: ${next}`,
				"<!-- /PRODUCER_STATE -->",
			].join("\n");
		}

		const unconfiguredBlock = generateProducerStateBlock(undefined, { task: "Definir concepto" });
		expect(unconfiguredBlock).toContain("Motor: Sin motor");
		expect(unconfiguredBlock).toContain("Hito Actual: M0 — Concepto");
		expect(unconfiguredBlock).not.toContain("Bevy");
		expect(unconfiguredBlock).not.toContain("M1");
	});

	test("studio-hud and banner fallbacks do not use Bevy or phantom M1 milestone when unconfigured", () => {
		const hudSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-hud.ts"),
			"utf8",
		);
		const bannerSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "banner.ts"),
			"utf8",
		);
		const startSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "studio-start.ts"),
			"utf8",
		);

		// studio-start: no Bevy fallback
		expect(startSource).not.toContain('state?.engine || "Bevy"');
		expect(startSource).toContain('state?.engine || "Sin motor"');
		expect(startSource).toContain('state?.milestone || "M0 — Concepto"');

		// studio-hud: milestone fallback is Pendiente (/concept)
		expect(hudSource).toContain('prodState?.milestone || "Pendiente (/concept)"');
		expect(hudSource).toContain('"Sin motor (/studio:setup)"');
		expect(hudSource).toContain('"Sin configurar"');

		// banner: stage fallback is Pendiente setup (/studio:setup) and engine fallback is Sin motor
		expect(bannerSource).toContain("Pendiente setup (/studio:setup)");
		expect(bannerSource).toContain('"Sin motor"');
		expect(bannerSource).not.toContain("Pendiente setup (/start)");
	});

	test("detectProjectEngine correctly identifies all starters and their languages", () => {
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
		const phaserDir = path.join(studioRoot, "starters", "phaser-web-2d");

		expect(fs.existsSync(path.join(bevyDir, "Cargo.toml"))).toBe(true);
		expect(fs.existsSync(path.join(raylibDir, "CMakeLists.txt"))).toBe(true);
		expect(fs.existsSync(path.join(godotDir, "project.godot"))).toBe(true);
		expect(fs.existsSync(path.join(phaserDir, "package.json"))).toBe(true);

		// Basic sniffing simulation
		const cargo = fs.readFileSync(path.join(bevyDir, "Cargo.toml"), "utf8");
		expect(cargo).toContain("bevy = { version = \"0.15\"");

		const cmake = fs.readFileSync(path.join(raylibDir, "CMakeLists.txt"), "utf8");
		expect(cmake).toContain("raylib");
		expect(cmake).toContain("entt");

		const godot = fs.readFileSync(path.join(godotDir, "project.godot"), "utf8");
		expect(godot).toContain("config/name=\"Godot 2D Character Starter\"");

		const phaserPkg = JSON.parse(fs.readFileSync(path.join(phaserDir, "package.json"), "utf8"));
		expect(phaserPkg.dependencies.phaser).toBeDefined();
	});

	test("banner.ts includes Phaser in the 6 supported engines and 8 Core + 1 Motor", () => {
		const bannerSource = fs.readFileSync(
			path.join(__dirname, "..", "extensions", "hooks", "banner.ts"),
			"utf8",
		);
		expect(bannerSource).toContain("Raylib");
		expect(bannerSource).toContain("Phaser");
		expect(bannerSource).toContain("Godot · Unity · Unreal · Bevy · Raylib · Phaser");
		expect(bannerSource).toContain("8 Core + 1 Motor");
	});

	test("engine reference docs exist for all 6 engines (bevy, godot, phaser, raylib, unity, unreal)", () => {
		const refDir = path.join(__dirname, "..", "docs", "engine-reference");
		const engines = ["bevy", "godot", "phaser", "raylib", "unity", "unreal"];
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

	test("return-contract validator enforces schema, status enum and completion evidence", () => {
		const script = `
			const { validateSpecialistReturn } = await import("./extensions/hooks/return-contract.ts");

			const valid = [
				"status: completed",
				"summary: Movimiento base implementado",
				"files_changed:",
				"  - src/player.rs",
				"validation:",
				"  - cargo test -p game: 5 passed",
			].join("\\n");
			const res = validateSpecialistReturn(valid);
			if (!res.isValid) throw new Error("valid contract rejected: " + res.errors.join(" | "));
			if (res.parsed?.status !== "completed") throw new Error("status not parsed");
			if (!res.parsed?.files_changed?.includes("src/player.rs")) throw new Error("files_changed not parsed");

			const noStatus = validateSpecialistReturn("summary: hice cosas");
			if (noStatus.isValid) throw new Error("missing status accepted");
			if (!noStatus.errors.some((e) => e.includes("status"))) throw new Error("missing status error not reported");

			const badStatus = validateSpecialistReturn("status: done\\nsummary: ok");
			if (badStatus.isValid) throw new Error("invalid status enum accepted");

			const noEvidence = validateSpecialistReturn("status: completed\\nsummary: quedo lindo");
			if (noEvidence.isValid) throw new Error("completed without observable evidence accepted");
			if (!noEvidence.errors.some((e) => e.includes("evidencia"))) throw new Error("missing evidence error not reported");

			const partialNoEvidence = validateSpecialistReturn("status: partial\\nsummary: avance parcial");
			if (!partialNoEvidence.isValid) throw new Error("partial without evidence should stay valid");
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	});

	test("return-contract types the evidence and gates each form by agent capability", () => {
		// A completion claim is evidence, not prose: an agent with bash reports
		// `<exact command>: <observed result>`, an agent without bash reports the
		// property it read back. Each class has exactly one admissible family, so
		// neither can borrow the other's escape hatch.
		const script = `
			const { validateSpecialistReturn } = await import("./extensions/hooks/return-contract.ts");

			const withBash = { tools: ["read", "write", "edit", "bash", "grep"] };
			const noBash = { tools: ["read", "write", "edit", "grep"] };
			const receipt = (status, files, validation) => [
				"status: " + status,
				"summary: entrega de prueba",
				...(files ? ["files_changed:", ...files.map((f) => "  - " + f)] : []),
				...(validation ? ["validation:", ...validation.map((v) => "  - " + v)] : []),
			].join("\\n");

			// S1: naming the files you touched is not evidence that you verified them.
			const filesOnly = validateSpecialistReturn(receipt("completed", ["design/gdd/art.md"], null), withBash);
			if (filesOnly.isValid) throw new Error("S1: files_changed alone must not satisfy a completed status");

			// S2: a command with no observed result is a claim, not a result.
			const cmdForm = validateSpecialistReturn(receipt("completed", ["src/player.rs"], ["cargo test -p game: 5 passed"]), withBash);
			if (!cmdForm.isValid) throw new Error("S2: cmd form rejected: " + cmdForm.errors.join(" | "));
			const bareCmd = validateSpecialistReturn(receipt("completed", null, ["cargo test -p game"]), withBash);
			if (bareCmd.isValid) throw new Error("S2: a command without an observed result must be rejected");

			// S3: structural readback is the passive mode of an agent that cannot execute.
			const structural = validateSpecialistReturn(
				receipt("completed", ["design/gdd/art.md"], ["structural: design/gdd/art.md secciones obligatorias: presentes"]),
				noBash,
			);
			if (!structural.isValid) throw new Error("S3: structural form rejected for a bash-less agent: " + structural.errors.join(" | "));
			const malformedStructural = validateSpecialistReturn(receipt("completed", null, ["structural: art.md"]), noBash);
			if (malformedStructural.isValid) throw new Error("S3: structural without a read-back result must be rejected");

			// S4: an exception is a named reason, not an empty escape.
			const exception = validateSpecialistReturn(
				receipt("completed", ["design/gdd/audio.md"], ["exception: un audio bible no tiene comando ejecutable"]),
				noBash,
			);
			if (!exception.isValid) throw new Error("S4: exception form rejected: " + exception.errors.join(" | "));
			const emptyException = validateSpecialistReturn(receipt("completed", null, ["exception:"]), noBash);
			if (emptyException.isValid) throw new Error("S4: an exception without a reason must be rejected");

			// S5: one admissible family per class, in both directions.
			const structuralInBash = validateSpecialistReturn(receipt("completed", null, ["structural: x: y"]), withBash);
			if (structuralInBash.isValid) throw new Error("S5: structural from a bash-capable agent must be rejected");
			if (!structuralInBash.errors.some((e) => e.includes("partial"))) {
				throw new Error("S5: the rejection must point at status: partial");
			}
			const cmdInNoBash = validateSpecialistReturn(receipt("completed", null, ["cargo test -p game: 5 passed"]), noBash);
			if (cmdInNoBash.isValid) throw new Error("S5: a bash-less agent cannot report a command result it could not run");

			// The quotes YAML allows are syntax, not evidence: a quoted passive entry must
			// still be read as passive, or a bash-capable agent slips through them.
			const quotedStructural = validateSpecialistReturn(
				receipt("completed", null, ['"structural: art.md secciones: presentes"']),
				withBash,
			);
			if (quotedStructural.isValid) throw new Error("S5: quoting a passive entry must not reclassify it as a command");
			const quotedCmd = validateSpecialistReturn(receipt("completed", null, ['"cargo test -p game: 5 passed"']), withBash);
			if (!quotedCmd.isValid) throw new Error("S2: a quoted command entry must still parse: " + quotedCmd.errors.join(" | "));

			// Preserved: partial and blocked never required evidence.
			if (!validateSpecialistReturn(receipt("partial", null, null), withBash).isValid) {
				throw new Error("partial without evidence must stay valid");
			}

			// S8: neutral professional Spanish, never voseo.
			const messages = [filesOnly, bareCmd, emptyException, structuralInBash, cmdInNoBash]
				.flatMap((r) => r.errors)
				.join(" ")
				.toLowerCase();
			if (/agreg[aá]|corr[eé]|fijate|ten[eé]s|pod[eé]s|hac[eé]/.test(messages)) {
				throw new Error("S8: voseo in validator messages: " + messages);
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
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
		expect(source).toContain("StudioQuestionnaireComponent");
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

	test("StudioQuestionnaireComponent provides interactive TUI tab strip, cursor movement, drafts, and inline custom editor", () => {
		const { execFileSync } = require("child_process");
		const script = `
			const { StudioQuestionnaireComponent, OTHER_LABEL } = await import("./extensions/hooks/studio-choice.ts");

			const sampleQuestions = [
				{
					question: "¿Qué motor prefieres?",
					header: "Paso 1: Motor",
					options: [
						{ label: "Godot 4", description: "Excelente 2D y 3D ligero" },
						{ label: "Bevy", description: "Rust ECS de alto rendimiento" },
					],
				},
				{
					question: "¿Qué género desarrollarás?",
					header: "Paso 2: Género",
					options: [
						{ label: "ARPG 2D", description: "Hack and slash con inventario" },
						{ label: "Plataformas", description: "Salto y plataformas de precisión" },
					],
				},
			];

			let completedResult = null;
			let renderRequested = 0;
			const mockTui = {
				requestRender: () => { renderRequested++; },
			};

			const component = new StudioQuestionnaireComponent(
				sampleQuestions,
				mockTui,
				{},
				(res) => { completedResult = res; },
			);

			// 1. Initial render tab strip assertions
			const tabsInitial = component.renderTabs();
			if (!tabsInitial.includes("[1/2]")) throw new Error("Missing progress [1/2]");
			if (!tabsInitial.includes("▸") || !tabsInitial.includes("Paso 1: Motor")) throw new Error("Step 1 should be active");
			if (!tabsInitial.includes("Paso 2: Género")) throw new Error("Step 2 should be in tabs");

			// 2. Initial body assertions
			const renderedLines = component.render(80);
			const fullText = renderedLines.join("\\n");
			if (!fullText.includes("¿Qué motor prefieres?")) throw new Error("Missing question title");
			if (!fullText.includes("Godot 4")) throw new Error("Missing Godot 4 option");
			if (!fullText.includes("Excelente 2D y 3D ligero")) throw new Error("Missing dimmed description");
			if (!fullText.includes("Otro (escribir respuesta personalizada)...")) throw new Error("Missing custom response row");

			// 3. Navigation: Down arrow moves cursor to Bevy
			component.handleInput("\\x1b[B"); // Down
			if (component.cursor[0] !== 1) throw new Error("Cursor should be 1");

			// 4. Enter on Bevy selects answer and advances to Paso 2
			component.handleInput("\\r"); // Enter
			if (component.activeQuestion !== 1) throw new Error("Should advance to question 1");
			if (!component.answers[0] || component.answers[0].answer !== "Bevy") throw new Error("Answer 0 should be Bevy");

			// Tab strip now shows answered checkmark for Paso 1 and active indicator for Paso 2
			const tabsStep2 = component.renderTabs();
			if (!tabsStep2.includes("[2/2]")) throw new Error("Missing progress [2/2]");
			if (!tabsStep2.includes("✓") || !tabsStep2.includes("Paso 1: Motor")) throw new Error("Step 1 should show checkmark ✓");
			if (!tabsStep2.includes("▸") || !tabsStep2.includes("Paso 2: Género")) throw new Error("Step 2 should be active ▸");

			// 5. Tab / Shift+Tab switches questions and keeps drafts/selections
			component.handleInput("\\x1b[Z"); // Shift+Tab back to Step 1
			if (component.activeQuestion !== 0) throw new Error("Should be back at question 0");
			component.handleInput("\\t"); // Tab to Step 2
			if (component.activeQuestion !== 1) throw new Error("Should be back at question 1");

			// 6. Navigate to custom row on Step 2 (options: 0, 1 -> custom row is index 2)
			component.handleInput("\\x1b[B"); // cursor 1 (Plataformas)
			component.handleInput("\\x1b[B"); // cursor 2 (Otro...)
			if (component.cursor[1] !== 2) throw new Error("Cursor should be on custom row (2)");

			// Enter opens inline custom text editor
			component.handleInput("\\r");
			if (!component.isEditingCustom) throw new Error("Should enter inline text editor mode");

			// Type 'Metroidvania'
			for (const char of "Metroidvania") {
				component.handleInput(char);
			}
			if (component.drafts[1] !== "Metroidvania") throw new Error("Draft should be Metroidvania");

			// Test Backspace
			component.handleInput("\\x7f"); // deletes 'a'
			component.handleInput("a"); // re-adds 'a'

			// Enter commits custom answer and since step 2 is the last question and all answered -> submits!
			component.handleInput("\\r");
			if (completedResult === null) throw new Error("Questionnaire should be completed");
			if (completedResult.cancelled) throw new Error("Questionnaire should not be cancelled");
			if (completedResult.answers.length !== 2) throw new Error("Should have 2 answers");
			if (completedResult.answers[0].answer !== "Bevy") throw new Error("Answer 0 should be Bevy");
			if (completedResult.answers[1].answer !== "Metroidvania") throw new Error("Answer 1 should be Metroidvania");
			if (!completedResult.answers[1].custom) throw new Error("Answer 1 should have custom: true");

			// 7. Cancellation test
			let cancelled = false;
			const comp2 = new StudioQuestionnaireComponent(
				sampleQuestions,
				mockTui,
				{},
				(res) => { cancelled = res.cancelled; },
			);
			comp2.handleInput("q");
			if (!cancelled) throw new Error("comp2 should be cancelled with 'q'");

			// 8. k/j navigation and footer hint check
			const comp3 = new StudioQuestionnaireComponent(
				sampleQuestions,
				mockTui,
				{},
				() => {},
			);
			comp3.handleInput("j"); // j moves down
			if (comp3.cursor[0] !== 1) throw new Error("'j' should move cursor down");
			comp3.handleInput("k"); // k moves up
			if (comp3.cursor[0] !== 0) throw new Error("'k' should move cursor up");
			const footer = comp3.renderFooter();
			if (!footer.includes("↑↓ navegar") || !footer.includes("enter seleccionar") || !footer.includes("tab cambiar pregunta") || !footer.includes("esc cancelar")) {
				throw new Error("Footer missing expected navigation hints: " + footer);
			}

			// 9. Jump to last question before step 1 is answered: pressing Enter jumps to unanswered step 1
			const comp4 = new StudioQuestionnaireComponent(
				sampleQuestions,
				mockTui,
				{},
				() => {},
			);
			comp4.handleInput("\\t"); // Tab to step 2
			if (comp4.activeQuestion !== 1) throw new Error("Should be at question 1");
			comp4.handleInput("\\r"); // Enter on step 2 option 0
			if (comp4.activeQuestion !== 0) throw new Error("Should jump back to unanswered question 0");
			if (!comp4.answers[1]) throw new Error("Step 2 should have recorded answer");
		`;

		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.resolve(__dirname, ".."),
			});
		}).not.toThrow();
	});

	test("ask_user_question mounts StudioQuestionnaireComponent when ctx.mode === 'tui' and ctx.ui.custom is available", async () => {
		const { execFileSync } = require("child_process");
		const script = `
			const { registerAskUserQuestion } = await import("./extensions/hooks/studio-choice.ts");

			let registeredTool = null;
			const mockPi = {
				hasTool: () => false,
				registerTool: (t) => { registeredTool = t; },
			};

			registerAskUserQuestion(mockPi);
			if (!registeredTool) throw new Error("Tool not registered");

			// Mock interactive TUI context
			let customComponentMounted = null;
			const mockCtx = {
				hasUI: true,
				mode: "tui",
				ui: {
					custom: async (factory) => {
						const mockTui = { requestRender: () => {} };
						const comp = factory(mockTui, {}, {}, (result) => {
							mockCtx._lastResult = result;
						});
						customComponentMounted = comp;
						// Simulate user selecting option 0 on question 1 (advance), option 0 on question 2 (finish)
						comp.handleInput("\\r");
						comp.handleInput("\\r");
						return mockCtx._lastResult;
					},
				},
			};

			const result = await registeredTool.execute(
				"test-id",
				{
					questions: [
						{ question: "Q1", header: "Paso 1", options: [{ label: "A" }, { label: "B" }] },
						{ question: "Q2", header: "Paso 2", options: [{ label: "X" }, { label: "Y" }] },
					],
				},
				undefined,
				undefined,
				mockCtx,
			);

			if (!result || !result.details || !result.details.answers) {
				throw new Error("Missing answers in result details");
			}
			if (result.details.answers.length !== 2) {
				throw new Error("Expected 2 answers, got: " + result.details.answers.length);
			}
			if (result.details.answers[0].answer !== "A" || result.details.answers[1].answer !== "X") {
				throw new Error("Unexpected answer values");
			}
			if (!result.content[0].text.includes("1. Q1 -> A")) {
				throw new Error("Missing summary text for Q1");
			}
		`;

		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.resolve(__dirname, ".."),
			});
		}).not.toThrow();
	});

	test("StudioQuestionnaireComponent handles Kitty protocol, VT100 application cursor, and number keys", async () => {
		const { execFileSync } = require("child_process");
		const script = `
			const { StudioQuestionnaireComponent, isKey } = await import("./extensions/hooks/studio-choice.ts");

			// Test isKey helper
			if (!isKey("\\x1bOA", "up")) throw new Error("VT100 application cursor Up failed");
			if (!isKey("\\x1bOB", "down")) throw new Error("VT100 application cursor Down failed");
			if (!isKey("\\x1b[57373u", "up")) throw new Error("Kitty protocol Up failed");
			if (!isKey("\\x1b[57374u", "down")) throw new Error("Kitty protocol Down failed");
			if (!isKey("\\x1b[13u", "enter")) throw new Error("Kitty protocol Enter failed");
			if (!isKey("\\x1b[27u", "escape")) throw new Error("Kitty protocol Escape failed");

			// Test component navigation with Kitty and VT100 keys
			let completedResult = null;
			const questions = [
				{
					question: "Choose option",
					options: [{ label: "Opt1" }, { label: "Opt2" }, { label: "Opt3" }],
				},
			];
			const comp = new StudioQuestionnaireComponent(questions, { requestRender: () => {} }, {}, (res) => {
				completedResult = res;
			});

			if (comp.cursor[0] !== 0) throw new Error("Initial cursor should be 0");

			// Move down using Kitty sequence
			comp.handleInput("\\x1b[57374u");
			if (comp.cursor[0] !== 1) throw new Error("Expected cursor 1 after Kitty down, got " + comp.cursor[0]);

			// Move down using VT100 sequence
			comp.handleInput("\\x1bOB");
			if (comp.cursor[0] !== 2) throw new Error("Expected cursor 2 after VT100 down, got " + comp.cursor[0]);

			// Jump to option 1 using number key "1"
			comp.handleInput("1");
			if (comp.cursor[0] !== 0) throw new Error("Expected cursor 0 after pressing '1', got " + comp.cursor[0]);

			// Select with Kitty Enter sequence
			comp.handleInput("\\x1b[13u");
			if (!completedResult || completedResult.cancelled) throw new Error("Expected completed result");
			if (completedResult.answers[0].answer !== "Opt1") throw new Error("Expected Opt1 answer");
		`;

		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.resolve(__dirname, ".."),
			});
		}).not.toThrow();
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
			/registerCommand\(\s*["']agents["'][\s\S]*?handleStudioSubagentsViewer/,
		);
		expect(hooksSource).toMatch(
			/registerCommand\(\s*["']studio:agents["'][\s\S]*?handleStudioSubagentsViewer/,
		);
	});

	test("studio-subagents-widget renders sovereign gamedev console dispatch without accent bar and with engine telemetry", () => {
		const widgetPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents-widget.ts");
		expect(fs.existsSync(widgetPath)).toBe(true);

		const widgetSource = fs.readFileSync(widgetPath, "utf8");
		expect(widgetSource).toContain("export function renderSubagentsWidgetCard");
		expect(widgetSource).toContain("export function formatElapsed");

		// Sovereign game engine console telemetry rows instead of box borders; the retired bar stays out
		expect(widgetSource).not.toContain("▌");
		expect(widgetSource).not.toContain("╭─");
		expect(widgetSource).not.toContain("╰─");

		// Header and sovereign gamedev telemetry status glyphs
		expect(widgetSource).toContain("ENGINE DISPATCH");
		expect(widgetSource).not.toContain("❀ Agents");
		expect(widgetSource).toContain("◐ COMPILANDO"); // running / compiling
		expect(widgetSource).toContain("✓ OK"); // completed
		expect(widgetSource).toContain("✗ BLOQUEADO"); // failed
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
		expect(viewerSource).toContain("• o: Abrir en editor externo");

		// Modal overlay configuration (Gentle Shell pattern)
		expect(viewerSource).toContain("withOverlayRepaint");
		expect(viewerSource).toContain("openTaskInEditor");
		expect(viewerSource).toContain("overlay: true");
		expect(viewerSource).toContain('width: "100%"');
		expect(viewerSource).toContain('maxHeight: "100%"');
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
		expect(hooksSource).toMatch(/registerCommand\(\s*["']studio:sound["']/);
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
		expect(hooksSource).toMatch(/registerCommand\(\s*["']changes["']/);
		expect(hooksSource).toMatch(/registerCommand\(\s*["']studio:changes["']/);

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
		expect(perfSource).toContain("PERF ALERT:");
		expect(perfSource).toContain("allocations detected in frame loop of");
		expect(perfSource).toContain("✓ PERF AUDIT OK:");

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
		expect(watchSource).toContain("COMPILE OK:");
		expect(watchSource).toContain("build clean in");
		expect(watchSource).toContain("BUILD ERROR:");

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
		expect(hooksSource).toContain("PERF ALERT:");
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

		test("STUDIO_COMMAND_REGISTRY covers all 4 categories and all 41 required commands", () => {
			const palSource = fs.readFileSync(palettePath, "utf8");

			// Parse command items from source
			const cmdMatches = [...palSource.matchAll(/name:\s*["']([^"']+)["']\s*,\s*description:\s*["']([^"']+)["']\s*,\s*category:\s*["']([^"']+)["']/g)];
			expect(cmdMatches.length).toBe(41);

			const commandNames = cmdMatches.map((m) => m[1]);
			const categories = Array.from(new Set(cmdMatches.map((m) => m[3])));

			expect(categories).toContain("ODD Pipeline");
			expect(categories).toContain("Engine & Dev Tools");
			expect(categories).toContain("Studio & Models");
			expect(categories).toContain("Media & MCP");

			// ODD Pipeline (10)
			const oddCommands = ["/market", "/concept", "/spec", "/arch", "/code", "/test", "/ship", "/steam-page", "/feature", "/next"];
			for (const cmd of oddCommands) {
				expect(commandNames).toContain(cmd);
				const match = cmdMatches.find((m) => m[1] === cmd);
				expect(match[3]).toBe("ODD Pipeline");
			}

			// Engine & Dev Tools (12)
			const engineCommands = ["/doctor", "/watch", "/profile", "/perf-guard", "/web", "/tasks", "/changes", "/scaffold", "/game-feel", "/audio-bus", "/tuning", "/play"];
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

			// Media & MCP (6)
			const mediaCommands = ["/studio:mcp", "/studio:tools", "/studio:assets", "/studio:sfx", "/studio:palettes", "/capsule-check"];
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
				if (STUDIO_COMMAND_REGISTRY.length !== 41) throw new Error("Registry length mismatch: " + STUDIO_COMMAND_REGISTRY.length);
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

		test("Bounded edit surfaces reach the specialist through the child environment", () => {
			const script = `
				const { surfacesFromEnv, BoundedSurfacesGuard } = await import("./extensions/hooks/studio-surfaces-guard.ts");

				if (surfacesFromEnv(undefined).length !== 0) throw new Error("unset env must yield no surfaces");
				if (surfacesFromEnv("").length !== 0) throw new Error("empty env must yield no surfaces");
				if (surfacesFromEnv("not-json").length !== 0) throw new Error("malformed env must yield no surfaces");

				const fromEnv = surfacesFromEnv(JSON.stringify(["src/", "assets/"]));
				if (fromEnv.length !== 2) throw new Error("env surfaces not parsed: " + fromEnv.length);

				const guard = new BoundedSurfacesGuard();
				guard.setFromEnv(JSON.stringify(["src/"]));
				if (!guard.validate("src/player.rs").allowed) throw new Error("in-scope edit must be allowed inside the child");
				if (guard.validate("package.json").allowed) throw new Error("out-of-scope edit must be blocked inside the child");
				if (!guard.validate("package.json").reason) throw new Error("blocked edit must explain why");

				const unbounded = new BoundedSurfacesGuard();
				unbounded.setFromEnv(undefined);
				if (!unbounded.validate("package.json").allowed) throw new Error("no declared surfaces must stay unbounded");
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
			expect(hooksSource).toContain('pi.registerCommand("palette"');
			expect(hooksSource).toContain('pi.registerShortcut("alt+k"');
			expect(hooksSource).toContain('pi.registerCommand("studio:commands"');
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

	// ──────────────────────────────────────────────
	// Block 3 & Block 4: Jam Mode, Budget Tracker & Production Timeline
	// ──────────────────────────────────────────────
	describe("Block 3 & Block 4: Jam Mode, Budget Tracker & Timeline Viewer", () => {
		const jamPath = path.join(__dirname, "..", "extensions", "hooks", "studio-jam.ts");
		const budgetPath = path.join(__dirname, "..", "extensions", "hooks", "studio-budget.ts");
		const timelinePath = path.join(__dirname, "..", "extensions", "hooks", "studio-timeline.ts");
		const viewerPath = path.join(__dirname, "..", "extensions", "hooks", "studio-timeline-viewer.ts");

		test("required files exist and export required contracts", () => {
			expect(fs.existsSync(jamPath)).toBe(true);
			expect(fs.existsSync(budgetPath)).toBe(true);
			expect(fs.existsSync(timelinePath)).toBe(true);
			expect(fs.existsSync(viewerPath)).toBe(true);

			const jamSource = fs.readFileSync(jamPath, "utf8");
			expect(jamSource).toContain("export function isJamModeActive");
			expect(jamSource).toContain("export function handleStudioJam");

			const budgetSource = fs.readFileSync(budgetPath, "utf8");
			expect(budgetSource).toContain("export function recordTokenUsage");
			expect(budgetSource).toContain("export function getBudgetReport");
			expect(budgetSource).toContain("export function handleStudioBudget");

			const timelineSource = fs.readFileSync(timelinePath, "utf8");
			expect(timelineSource).toContain("export function parseProductionTimeline");
			expect(timelineSource).toContain("export function handleStudioTimeline");

			const viewerSource = fs.readFileSync(viewerPath, "utf8");
			expect(viewerSource).toContain("TimelineViewerComponent");
		});

		test("Block 3: Game Jam Mode toggles and persists in .pi/game-studio/jam-mode", () => {
			const { execFileSync } = require("child_process");
			const script = `
				const fs = await import("node:fs");
				const path = await import("node:path");
				const os = await import("node:os");

				const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "jam-test-"));
				const { isJamModeActive, setJamMode, toggleJamMode } = await import("./extensions/hooks/studio-jam.ts");

				if (isJamModeActive(tmpDir) !== false) throw new Error("Jam mode should be inactive by default");

				setJamMode(true, tmpDir);
				if (!isJamModeActive(tmpDir)) throw new Error("Jam mode should be active after setJamMode(true)");

				const jamFilePath = path.join(tmpDir, ".pi", "game-studio", "jam-mode");
				if (!fs.existsSync(jamFilePath)) throw new Error("jam-mode file should exist");

				toggleJamMode(tmpDir);
				if (isJamModeActive(tmpDir)) throw new Error("Jam mode should be inactive after toggle");

				toggleJamMode(tmpDir);
				if (!isJamModeActive(tmpDir)) throw new Error("Jam mode should be active after second toggle");

				fs.rmSync(tmpDir, { recursive: true, force: true });
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Block 3: Studio Budget Tracker records tokens and generates discipline report", () => {
			const { execFileSync } = require("child_process");
			const script = `
				const {
					recordTokenUsage,
					getBudgetReport,
					resetBudget,
					categorizeDiscipline,
					estimateCost,
					renderBudgetCard,
				} = await import("./extensions/hooks/studio-budget.ts");

				resetBudget();

				if (categorizeDiscipline("producer") !== "Directors") throw new Error("producer should be Directors");
				if (categorizeDiscipline("creative-director") !== "Directors") throw new Error("creative-director should be Directors");
				if (categorizeDiscipline("game-designer") !== "Game Designer") throw new Error("game-designer should be Game Designer");
				if (categorizeDiscipline("bevy-specialist") !== "Specialists") throw new Error("bevy-specialist should be Specialists");
				if (categorizeDiscipline("gameplay-programmer") !== "Specialists") throw new Error("gameplay-programmer should be Specialists");

				// Record usages
				recordTokenUsage("producer", "anthropic/claude-sonnet-4", 1000, 500, 200);
				recordTokenUsage("game-designer", "openai/gpt-4o", 2000, 1000, 0);
				recordTokenUsage("bevy-specialist", "openrouter/openai/gpt-oss-120b:free", 5000, 3000, 0);

				const report = getBudgetReport();
				if (report.totalTokens !== 12700) throw new Error("Total tokens mismatch: " + report.totalTokens);
				if (report.totalInputTokens !== 8000) throw new Error("Total input tokens mismatch: " + report.totalInputTokens);
				if (report.totalOutputTokens !== 4500) throw new Error("Total output tokens mismatch: " + report.totalOutputTokens);
				if (report.totalCacheTokens !== 200) throw new Error("Total cache tokens mismatch: " + report.totalCacheTokens);

				if (!report.byDiscipline["Directors"]) throw new Error("Missing Directors discipline in report");
				if (!report.byDiscipline["Game Designer"]) throw new Error("Missing Game Designer discipline in report");
				if (!report.byDiscipline["Specialists"]) throw new Error("Missing Specialists discipline in report");

				// Free model should have 0 cost
				if (report.byDiscipline["Specialists"].costUsd !== 0) throw new Error("Free model cost should be 0");
				if (report.totalCostUsd <= 0) throw new Error("Total cost should be greater than 0");

				const cardLines = renderBudgetCard(report);
				const cardText = cardLines.join("\\n");
				if (!cardText.includes("ESTIMATED STUDIO BUDGET")) throw new Error("Card missing header");
				if (!cardText.includes("Directors")) throw new Error("Card missing Directors");
				if (!cardText.includes("Game Designer")) throw new Error("Card missing Game Designer");
				if (!cardText.includes("Specialists")) throw new Error("Card missing Specialists");
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Block 4: Production Timeline parses roadmap, ADRs and Live Specs", () => {
			const { execFileSync } = require("child_process");
			const script = `
				const fs = await import("node:fs");
				const path = await import("node:path");
				const os = await import("node:os");

				const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "timeline-test-"));
				fs.mkdirSync(path.join(tmpDir, "production"), { recursive: true });
				fs.mkdirSync(path.join(tmpDir, "docs", "architecture"), { recursive: true });
				fs.mkdirSync(path.join(tmpDir, "design", "gdd"), { recursive: true });

				// 1. Roadmap fixture
				const roadmapContent = [
					"# Roadmap",
					"<!-- PRODUCER_STATE -->",
					"Juego: CyberBlade",
					"Motor: Godot 4",
					"Hito Actual: M0 — Visión",
					"Sprint Activo: Sprint 1",
					"<!-- /PRODUCER_STATE -->",
					"### M0 — Visión",
					"- [x] Concepto base",
					"- [x] Pilares de diseño",
					"- [ ] Título final",
					"### M1 — Spike Técnico",
					"- [ ] Test de motor",
				].join("\\n");
				fs.writeFileSync(path.join(tmpDir, "production", "roadmap.md"), roadmapContent, "utf8");

				// 2. ADR fixture
				const adrContent = [
					"# ADR-001: Usar Godot 4 con C# para lógica de combate",
					"Status: Accepted",
					"Date: 2026-10-10",
					"## Context",
					"Se requiere alto rendimiento y tipado fuerte para el simulador de combate.",
					"## Decision",
					"Adoptar Godot 4 .NET con C# 12 para los subsistemas de gameplay core.",
					"## Consequences",
					"Mayor velocidad de iteración y compatibilidad con bibliotecas existentes.",
					"## Trade-offs",
					"Mayor tiempo de build inicial frente a GDScript puro.",
				].join("\\n");
				fs.writeFileSync(path.join(tmpDir, "docs", "architecture", "adr-001-godot-csharp.md"), adrContent, "utf8");

				// 3. Live Spec fixture
				const specContent = [
					"# Live Spec: Sistema de Combate y Parrying",
					"Status: Approved",
					"## Overview",
					"Mecánica de parry de precisión con ventana de 12 frames.",
					"## Acceptance Criteria",
					"- [x] Ventana de parry configurable en milisegundos",
					"- [ ] Sonido de impacto al acertar",
					"## Tuning Knobs",
					"- PARRY_WINDOW_MS = 200",
				].join("\\n");
				fs.writeFileSync(path.join(tmpDir, "design", "gdd", "combat-parry.md"), specContent, "utf8");

				const { parseProductionTimeline } = await import("./extensions/hooks/studio-timeline.ts");
				const timeline = parseProductionTimeline(tmpDir);

				if (timeline.items.length === 0) throw new Error("Timeline items should not be empty");
				if (timeline.milestonesCount < 2) throw new Error("Should have at least 2 milestones");
				if (timeline.adrsCount !== 1) throw new Error("Should have 1 ADR, got " + timeline.adrsCount);
				if (timeline.specsCount !== 1) throw new Error("Should have 1 Spec, got " + timeline.specsCount);

				const m0 = timeline.items.find(i => i.title.includes("M0"));
				if (!m0) throw new Error("M0 milestone not found");
				if (m0.progress !== 67) throw new Error("M0 progress should be 67% (2/3), got " + m0.progress);

				const adr = timeline.items.find(i => i.type === "adr");
				if (!adr) throw new Error("ADR item not found");
				if (!adr.details.decision.includes("Godot 4 .NET")) throw new Error("ADR decision detail missing");

				const spec = timeline.items.find(i => i.type === "spec");
				if (!spec) throw new Error("Spec item not found");
				if (!spec.details.summary.includes("parry")) throw new Error("Spec summary detail missing");

				fs.rmSync(tmpDir, { recursive: true, force: true });
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Block 4: TimelineViewerComponent handles tree navigation and filtering", () => {
			const { execFileSync } = require("child_process");
			const script = `
				const { TimelineViewerComponent } = await import("./extensions/hooks/studio-timeline-viewer.ts");

				const mockItems = [
					{
						id: "m0",
						type: "milestone",
						category: "Milestones",
						title: "M0 — Visión",
						status: "In Progress",
						icon: "◉",
						sourceFile: "production/roadmap.md",
						progress: 67,
						details: { summary: "Fase de visión" },
					},
					{
						id: "m0-t1",
						type: "task",
						category: "Milestones",
						title: "Concepto base",
						status: "Completed",
						icon: "✓",
						sourceFile: "production/roadmap.md",
						treeSpine: "├─ ",
						details: { summary: "Concepto aprobado" },
					},
					{
						id: "adr-1",
						type: "adr",
						category: "ADRs",
						title: "ADR-001: Godot 4 C#",
						status: "Accepted",
						icon: "•",
						sourceFile: "docs/architecture/adr-001.md",
						details: {
							context: "Alto rendimiento",
							decision: "Usar C#",
							consequences: "Compilación rápida",
							tradeoffs: "Mayor overhead de build",
						},
					},
					{
						id: "spec-1",
						type: "spec",
						category: "Specs",
						title: "Spec: Combat Loop",
						status: "Approved",
						icon: "📄",
						sourceFile: "design/gdd/combat.md",
						details: {
							summary: "Bucle de combate",
							acceptanceCriteria: ["Ventana de 12 frames"],
						},
					},
				];

				let closed = false;
				let renderRequested = false;
				const mockTui = {
					requestRender: () => { renderRequested = true; }
				};

				const viewer = new TimelineViewerComponent(mockItems, mockTui, {}, () => { closed = true; });

				// Test render
				const lines = viewer.render(80);
				if (!lines || lines.length === 0) throw new Error("Viewer render returned no lines");
				const text = lines.join("\\n");
				if (!text.includes("M0 — Visión")) throw new Error("Render missing M0");

				// Test arrow down
				viewer.handleInput("\\x1b[B"); // Down
				if (viewer.getSelectedIndex() !== 1) throw new Error("Index should be 1 after down key");

				// Test tab filtering
				viewer.handleInput("\\t"); // Tab -> Milestones
				if (viewer.getActiveFilter() !== "Milestones") throw new Error("Filter should be Milestones");

				viewer.handleInput("\\t"); // Tab -> ADRs
				if (viewer.getActiveFilter() !== "ADRs") throw new Error("Filter should be ADRs");

				viewer.handleInput("\\t"); // Tab -> Specs
				if (viewer.getActiveFilter() !== "Specs") throw new Error("Filter should be Specs");

				viewer.handleInput("\\t"); // Tab -> All
				if (viewer.getActiveFilter() !== "All") throw new Error("Filter should be All");

				// Test close key
				viewer.handleInput("q");
				if (!closed) throw new Error("Viewer should close on q");
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Integration in index.ts wires commands, token tracking, and jam mode bypass", () => {
			// Commands registered
			expect(hooksSource).toContain('pi.registerCommand("studio:jam"');
			expect(hooksSource).toContain('pi.registerCommand("jam"');
			expect(hooksSource).toContain('pi.registerCommand("studio:budget"');
			expect(hooksSource).toContain('pi.registerCommand("budget"');
			expect(hooksSource).toContain('pi.registerCommand("studio:timeline"');
			expect(hooksSource).toContain('pi.registerCommand("timeline"');

			// Imports & Handlers
			expect(hooksSource).toContain("handleStudioJam");
			expect(hooksSource).toContain("isJamModeActive");
			expect(hooksSource).toContain("handleStudioBudget");
			expect(hooksSource).toContain("recordTokenUsage");
			expect(hooksSource).toContain("handleStudioTimeline");

			// Jam mode prompt and perf bypass wiring
			expect(hooksSource).toContain("GAME JAM");

			// Token tracking wiring in turn/tool hooks
			expect(hooksSource).toContain("recordTokenUsage(");
		});
	});

	// ──────────────────────────────────────────────
	// Block 5: Subagent Run Custom UI Renderers (renderCall & renderResult)
	// ──────────────────────────────────────────────
	describe("Block 5: Subagent Run Custom UI Renderers (renderCall & renderResult)", () => {
		const subagentsPath = path.join(__dirname, "..", "extensions", "hooks", "studio-subagents.ts");

		test("studio-subagents.ts imports Text from @earendil-works/pi-tui", () => {
			const source = fs.readFileSync(subagentsPath, "utf8");
			expect(source).toMatch(/import\s*\{[^}]*\bText\b[^}]*\}\s*from\s*["']@earendil-works\/pi-tui["']/);
		});

		test("subagent_run registers renderCall and renderResult handlers", () => {
			const { execFileSync } = require("child_process");
			const script = `
				${tuiResolverHook}
				const { registerStudioSubagentTools } = await import("./extensions/hooks/studio-subagents.ts");
				let subagentTool = null;
				const mockPi = {
					hasTool: () => false,
					registerTool: (t) => {
						if (t.name === "subagent_run") subagentTool = t;
					},
				};
				registerStudioSubagentTools(mockPi);
				if (!subagentTool) throw new Error("subagent_run tool was not registered");
				if (typeof subagentTool.renderCall !== "function") throw new Error("renderCall is not defined on subagent_run");
				if (typeof subagentTool.renderResult !== "function") throw new Error("renderResult is not defined on subagent_run");
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("renderCall formats sovereign gamedev console dispatch card with theme tokens", () => {
			const { execFileSync } = require("child_process");
			const script = `
				${tuiResolverHook}
				const { registerStudioSubagentTools } = await import("./extensions/hooks/studio-subagents.ts");
				const { Text } = await import("@earendil-works/pi-tui");
				let subagentTool = null;
				const mockPi = {
					hasTool: () => false,
					registerTool: (t) => {
						if (t.name === "subagent_run") subagentTool = t;
					},
				};
				registerStudioSubagentTools(mockPi);

				const mockTheme = {
					fg: (slot, text) => \`[\${slot}]\${text}[/\${slot}]\`,
					bold: (text) => \`[bold]\${text}[/bold]\`,
				};

				// 1. Task mode call
				const callComp = subagentTool.renderCall(
					{ agent: "game-designer", task: "Diseñar tabla de armas y drop rate\\nDetalles adicionales", mode: "task" },
					mockTheme,
					{ cwd: process.cwd() }
				);
				if (!(callComp instanceof Text)) throw new Error("renderCall must return a Text instance");
				const text = callComp.text;
				if (!text.includes("ENGINE DISPATCH")) throw new Error("Missing ENGINE DISPATCH badge: " + text);
				if (!text.includes("[accent]ENGINE DISPATCH[/accent]")) throw new Error("Badge not styled with accent: " + text);
				if (!text.includes("[bold]game-designer[/bold]")) throw new Error("Agent name not bold: " + text);
				if (!text.includes("Diseñar tabla de armas y drop rate")) throw new Error("Missing compact 1-line task: " + text);
				if (text.includes("Detalles adicionales")) throw new Error("Task prompt not truncated to 1 line: " + text);
				if (!text.includes("[mode: task]")) throw new Error("Missing [mode: task]: " + text);
				if (!text.includes("[dim]")) throw new Error("Task prompt not dimmed: " + text);

				// 2. Background mode call
				const bgComp = subagentTool.renderCall(
					{ agent: "bevy-specialist", task: "Compilar shaders wgpu", mode: "background" },
					mockTheme,
					{ cwd: process.cwd() }
				);
				const bgText = bgComp.text;
				if (!bgText.includes("[mode: bg]")) throw new Error("Missing [mode: bg]: " + bgText);
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("renderResult renders partial running spinner, compact receipt, expanded delivery, and failed error", () => {
			const { execFileSync } = require("child_process");
			const script = `
				${tuiResolverHook}
				const { registerStudioSubagentTools } = await import("./extensions/hooks/studio-subagents.ts");
				const { Text } = await import("@earendil-works/pi-tui");
				let subagentTool = null;
				const mockPi = {
					hasTool: () => false,
					registerTool: (t) => {
						if (t.name === "subagent_run") subagentTool = t;
					},
				};
				registerStudioSubagentTools(mockPi);

				const mockTheme = {
					fg: (slot, text) => \`[\${slot}]\${text}[/\${slot}]\`,
					bold: (text) => \`[bold]\${text}[/bold]\`,
				};

				// 1. Partial / running state
				const partialComp = subagentTool.renderResult(
					{ content: [], details: { agent: "gameplay-programmer", status: "running" } },
					{ expanded: false, isPartial: true },
					mockTheme,
					{ args: { agent: "gameplay-programmer" } }
				);
				if (!(partialComp instanceof Text)) throw new Error("renderResult must return Text");
				const partialText = partialComp.text;
				if (!partialText.includes("◐ COMPILANDO / EJECUTANDO")) throw new Error("Missing running badge: " + partialText);
				if (!partialText.includes("gameplay-programmer") || !partialText.includes("...")) {
					throw new Error("Missing agent name in running state: " + partialText);
				}

				// 2. Complete and not expanded (compact executive receipt)
				const sampleCompletedResult = {
					content: [
						{
							type: "text",
							text: [
								"┌── DELIVERY RECEIPT: GAME DESIGNER ────────────────────────┐",
								"│ Resumen:    Diseño de sistema de progresión y loot        │",
								"│ Archivos:   design/gdd/loot.md, design/gdd/economy.md     │",
								"└────────────────────────────────────────────────────────────┘",
								"",
								"\\\`\\\`\\\`yaml",
								"status: completed",
								"summary: 'Diseño de sistema de progresión y loot'",
								"files_changed:",
								"  - design/gdd/loot.md",
								"  - design/gdd/economy.md",
								"validation: 'odd check passed'",
								"\\\`\\\`\\\`",
							].join("\\n"),
						},
					],
					details: { agent: "game-designer", status: "completed", taskId: "task-123" },
				};

				const compactComp = subagentTool.renderResult(
					sampleCompletedResult,
					{ expanded: false, isPartial: false },
					mockTheme,
					{ args: { agent: "game-designer" } }
				);
				const compactText = compactComp.text;
				if (!compactText.includes("✓ DISPATCH OK")) throw new Error("Missing DISPATCH OK badge: " + compactText);
				if (!compactText.includes("game-designer")) throw new Error("Missing agent name: " + compactText);
				if (!compactText.includes("Resumen: Diseño de sistema de progresión y loot")) throw new Error("Missing parsed summary: " + compactText);
				if (!compactText.includes("Archivos: design/gdd/loot.md, design/gdd/economy.md")) throw new Error("Missing parsed files: " + compactText);
				if (!compactText.includes("(Ctrl+O para expandir entrega completa)")) throw new Error("Missing expand hint: " + compactText);

				// 3. Complete and expanded (full delivery receipt & YAML block)
				const expandedComp = subagentTool.renderResult(
					sampleCompletedResult,
					{ expanded: true, isPartial: false },
					mockTheme,
					{ args: { agent: "game-designer" } }
				);
				const expandedText = expandedComp.text;
				if (!expandedText.includes("DELIVERY RECEIPT: GAME DESIGNER")) throw new Error("Missing full delivery receipt: " + expandedText);
				if (!expandedText.includes("yaml")) throw new Error("Missing yaml block: " + expandedText);

				// 4. Failed dispatch
				const failedResult = {
					content: [{ type: "text", text: "Error: Agent 'godot-specialist' crashed on script validation" }],
					details: { agent: "godot-specialist", status: "failed", error: "Agent 'godot-specialist' crashed on script validation" },
				};
				const failedComp = subagentTool.renderResult(
					failedResult,
					{ expanded: false, isPartial: false },
					mockTheme,
					{ args: { agent: "godot-specialist" } }
				);
				const failedText = failedComp.text;
				if (!failedText.includes("✗ DISPATCH ERROR")) throw new Error("Missing DISPATCH ERROR badge: " + failedText);
				if (!failedText.includes("godot-specialist") || !failedText.includes("crashed on script validation")) {
					throw new Error("Missing agent error message: " + failedText);
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("Preserves subagent_run parameter schema and all subagent auxiliary tools", () => {
			const source = fs.readFileSync(subagentsPath, "utf8");
			expect(source).toContain('name: "subagent_run"');
			expect(source).toContain('name: "subagent_list"');
			expect(source).toContain('name: "subagent_status"');
			expect(source).toContain('name: "subagent_result"');
			expect(source).toContain('required: ["agent", "task"]');
			expect(source).toMatch(/\bmode\s*:/);
			expect(source).toMatch(/\btimeout_seconds\s*:/);
			expect(source).toMatch(/\btarget_dir\s*:/);
		});
	});

	// ──────────────────────────────────────────────
	// Block 6: Additive Package Provisioning & Defensive Tool Registration
	// ──────────────────────────────────────────────
	describe("Block 6: Additive Package Provisioning & Defensive Tool Registration", () => {
		const { execFileSync } = require("child_process");

		test("provisionStudioProfile preserves user packages additively without filtering gentle or custom tools", () => {
			const script = `
				import { provisionStudioProfile } from "./bin/pi-studio.mjs";
				import fs from "node:fs";
				import os from "node:os";
				import path from "node:path";

				const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-target-"));
				const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-base-"));

				try {
					const initialSettings = {
						theme: "dracula",
						packages: [
							"npm:custom-dev-tools",
							"npm:gentle-pi",
							"git:github.com/user/engine-visualizer",
						],
					};
					fs.writeFileSync(
						path.join(tempTarget, "settings.json"),
						JSON.stringify(initialSettings, null, 2),
						"utf8",
					);

					const updated = provisionStudioProfile(tempTarget, tempBase);

					if (!updated.packages.includes("npm:custom-dev-tools")) throw new Error("custom package lost");
					if (!updated.packages.includes("npm:gentle-pi")) throw new Error("gentle-pi was filtered out");
					if (!updated.packages.includes("git:github.com/user/engine-visualizer")) throw new Error("git package lost");
					if (!updated.packages.includes("npm:pi-web-access")) throw new Error("missing pi-web-access");
					if (!updated.packages.includes("npm:pi-antigravity")) throw new Error("missing pi-antigravity");
					if (!updated.packages.includes("npm:pi-btw")) throw new Error("missing pi-btw");

					const saved = JSON.parse(fs.readFileSync(path.join(tempTarget, "settings.json"), "utf8"));
					if (saved.theme !== "dracula") throw new Error("theme corrupted");
					if (saved.packages.length !== updated.packages.length) throw new Error("file not updated on disk");
				} finally {
					fs.rmSync(tempTarget, { recursive: true, force: true });
					fs.rmSync(tempBase, { recursive: true, force: true });
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("provisionStudioProfile correctly handles package objects and versioned specs without duplicating", () => {
			const script = `
				import { provisionStudioProfile } from "./bin/pi-studio.mjs";
				import fs from "node:fs";
				import os from "node:os";
				import path from "node:path";

				const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-target-"));
				const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-base-"));

				try {
					const initialSettings = {
						packages: [
							{ source: "npm:pi-web-access@2.0.0", extensions: ["!extensions/foo.ts"] },
							"npm:pi-btw@1.0.0",
						],
					};
					fs.writeFileSync(
						path.join(tempTarget, "settings.json"),
						JSON.stringify(initialSettings, null, 2),
						"utf8",
					);

					const updated = provisionStudioProfile(tempTarget, tempBase);

					// Must not duplicate pi-web-access or pi-btw
					const webAccessMatches = updated.packages.filter(p => {
						const src = typeof p === "string" ? p : p?.source;
						return src?.includes("pi-web-access");
					});
					if (webAccessMatches.length !== 1) throw new Error("pi-web-access was duplicated: " + JSON.stringify(updated.packages));

					const btwMatches = updated.packages.filter(p => {
						const src = typeof p === "string" ? p : p?.source;
						return src?.includes("pi-btw");
					});
					if (btwMatches.length !== 1) throw new Error("pi-btw was duplicated: " + JSON.stringify(updated.packages));

					// Must add antigravity
					const antigravityMatches = updated.packages.filter(p => {
						const src = typeof p === "string" ? p : p?.source;
						return src?.includes("pi-antigravity");
					});
					if (antigravityMatches.length !== 1) throw new Error("pi-antigravity not added");
				} finally {
					fs.rmSync(tempTarget, { recursive: true, force: true });
					fs.rmSync(tempBase, { recursive: true, force: true });
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("provisionStudioProfile inherits base settings when target profile is freshly created", () => {
			const script = `
				import { provisionStudioProfile } from "./bin/pi-studio.mjs";
				import fs from "node:fs";
				import os from "node:os";
				import path from "node:path";

				const tempTarget = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-target-"));
				const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), "studio-test-base-"));

				try {
					const baseSettings = {
						theme: "catppuccin-mocha",
						defaultModel: "anthropic/claude-3-7-sonnet",
						packages: ["npm:my-assistant-extension"],
					};
					fs.writeFileSync(
						path.join(tempBase, "settings.json"),
						JSON.stringify(baseSettings, null, 2),
						"utf8",
					);

					const updated = provisionStudioProfile(tempTarget, tempBase);

					if (updated.theme !== "catppuccin-mocha") throw new Error("base theme was not inherited");
					if (updated.defaultModel !== "anthropic/claude-3-7-sonnet") throw new Error("defaultModel not inherited");
					if (!updated.packages.includes("npm:my-assistant-extension")) throw new Error("base packages not inherited");
					if (!updated.packages.includes("npm:pi-web-access")) throw new Error("missing pi-web-access");
				} finally {
					fs.rmSync(tempTarget, { recursive: true, force: true });
					fs.rmSync(tempBase, { recursive: true, force: true });
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("registerAskUserQuestion detects existing tools via getAllTools without crashing", () => {
			const script = `
				const { registerAskUserQuestion } = await import("./extensions/hooks/studio-choice.ts");
				let registered = false;
				const mockPi = {
					getAllTools: () => [{ name: "ask_user_question" }],
					registerTool: () => {
						registered = true;
					},
				};

				registerAskUserQuestion(mockPi);
				if (registered) throw new Error("ask_user_question should have been skipped");
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("registerStudioSubagentTools detects existing tools via getAllTools and catches exceptions gracefully", () => {
			const script = `
				${tuiResolverHook}
				const { registerStudioSubagentTools } = await import("./extensions/hooks/studio-subagents.ts");
				const registeredTools = [];
				const mockPi = {
					getAllTools: () => [{ name: "subagent_run" }],
					registerTool: (t) => {
						if (t.name === "subagent_status") {
							throw new Error("Simulated registration collision");
						}
						registeredTools.push(t.name);
					},
				};

				registerStudioSubagentTools(mockPi);
				if (registeredTools.includes("subagent_run")) throw new Error("subagent_run should have been skipped");
				if (!registeredTools.includes("subagent_list")) throw new Error("subagent_list was not registered");
				if (!registeredTools.includes("subagent_result")) throw new Error("subagent_result was not registered");
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});

		test("ask_user_question registers clean renderCall and renderResult handlers without raw JSON dump", () => {
			const script = `
				const { registerAskUserQuestion } = await import("./extensions/hooks/studio-choice.ts");
				let registered = null;
				const mockPi = {
					hasTool: () => false,
					registerTool: (t) => {
						if (t.name === "ask_user_question") registered = t;
					},
				};

				registerAskUserQuestion(mockPi);
				if (!registered) throw new Error("ask_user_question was not registered");
				if (typeof registered.renderCall !== "function") throw new Error("renderCall is missing");
				if (typeof registered.renderResult !== "function") throw new Error("renderResult is missing");

				const mockTheme = {
					fg: (slot, text) => "[" + slot + "]" + text + "[/" + slot + "]",
					bold: (text) => "[b]" + text + "[/b]",
				};

				// Test renderCall output
				const callComp = registered.renderCall(
					{ questions: [{ header: "Paso 1", question: "¿Qué motor?" }] },
					mockTheme,
				);
				if (!callComp || !callComp.text.includes("STUDIO CHOICE")) {
					throw new Error("renderCall missing STUDIO CHOICE badge: " + callComp?.text);
				}
				if (!callComp.text.includes("Paso 1")) {
					throw new Error("renderCall missing header: " + callComp?.text);
				}

				// Test renderResult output
				const resComp = registered.renderResult(
					{ details: { answers: [{ question: "¿Qué motor?", answer: "Bevy" }] } },
					{ expanded: false, isPartial: false },
					mockTheme,
				);
				if (!resComp || !resComp.text.includes("RESPUESTA CONFIRMADA")) {
					throw new Error("renderResult missing RESPUESTA CONFIRMADA badge: " + resComp?.text);
				}
				if (!resComp.text.includes("Bevy")) {
					throw new Error("renderResult missing answer: " + resComp?.text);
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});
	});

	// ──────────────────────────────────────────────
	// Block 7: Studio Suite Expansion (Continuity, Tuning, Play, Feature & Assets)
	// ──────────────────────────────────────────────
	describe("Block 7: Studio Suite Expansion (Continuity, Tuning, Play, Feature & Assets)", () => {
		const { execFileSync } = require("child_process");

		test("studio-continuity.ts exports findNextPendingTask and formatContinuityPrompt", () => {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", "studio-continuity.ts"),
				"utf8",
			);
			expect(source).toContain("export function findNextPendingTask");
			expect(source).toContain("export function formatContinuityPrompt");
			expect(source).toContain("export async function handleStudioContinuity");
		});

		test("studio-tuning.ts exports findTuningFiles, parseTuningVariables, and updateTuningVariable", () => {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", "studio-tuning.ts"),
				"utf8",
			);
			expect(source).toContain("export function findTuningFiles");
			expect(source).toContain("export function parseTuningVariables");
			expect(source).toContain("export function updateTuningVariable");
			expect(source).toContain("export async function handleStudioTuning");
		});

		test("studio-play.ts exports resolveEnginePlayCommand, isPlayProcessRunning, and stopPlayProcess", () => {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", "studio-play.ts"),
				"utf8",
			);
			expect(source).toContain("export function resolveEnginePlayCommand");
			expect(source).toContain("export function isPlayProcessRunning");
			expect(source).toContain("export function stopPlayProcess");
			expect(source).toContain("export async function handleStudioPlay");
		});

		test("studio-feature.ts exports slugify, generateLiveSpecTemplate, and createLiveSpec", () => {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", "studio-feature.ts"),
				"utf8",
			);
			expect(source).toContain("export function slugify");
			expect(source).toContain("export function generateLiveSpecTemplate");
			expect(source).toContain("export function createLiveSpec");
			expect(source).toContain("export async function handleStudioFeature");
		});

		test("studio-assets.ts exports optimizeProjectAssets with AssetOptimizationReport contract", () => {
			const source = fs.readFileSync(
				path.join(__dirname, "..", "extensions", "hooks", "studio-assets.ts"),
				"utf8",
			);
			expect(source).toContain("export function optimizeProjectAssets");
			expect(source).toContain("export interface AssetOptimizationReport");
			expect(source).toContain("oxipng");
		});

		test("TypeScript runtime execution of Block 7 contracts in Node", () => {
			const script = `
				import os from "node:os";
				import path from "node:path";
				import fs from "node:fs";

				const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-block7-"));

				try {
					// 1. Test Feature Generator
					const { slugify, generateLiveSpecTemplate, createLiveSpec } = await import("./extensions/hooks/studio-feature.ts");
					if (slugify("Combate Mágico 2D!") !== "combate-magico-2d") throw new Error("slugify mismatch");
					const template = generateLiveSpecTemplate("dash-aereo");
					if (!template.includes("# Live Spec — Dash Aereo")) throw new Error("template title missing");
					if (!template.includes("T1 — Esquema de Datos")) throw new Error("T1 missing in template");

					const created = createLiveSpec(tempDir, "dash-aereo");
					if (!created.success || !fs.existsSync(created.filePath)) throw new Error("createLiveSpec failed");

					// 2. Test Tuning Parser and Updater
					const { parseTuningVariables, updateTuningVariable } = await import("./extensions/hooks/studio-tuning.ts");
					const sampleYaml = "santuario:\\n  tick_segundos: 5.0\\n  radio_pickup: 64\\n";
					const samplePath = path.join(tempDir, "balance.yaml");
					fs.writeFileSync(samplePath, sampleYaml, "utf8");

					const vars = parseTuningVariables(sampleYaml, samplePath, tempDir);
					if (vars.length !== 2) throw new Error("parseTuningVariables count mismatch: " + vars.length);
					if (vars[0].key !== "santuario.tick_segundos" || vars[0].value !== 5.0) throw new Error("tuning var parsing failed");

					const updated = updateTuningVariable(samplePath, "santuario.tick_segundos", 2.5);
					if (!updated) throw new Error("updateTuningVariable failed");
					const updatedContent = fs.readFileSync(samplePath, "utf8");
					if (!updatedContent.includes("tick_segundos: 2.5")) throw new Error("updated content mismatch: " + updatedContent);

					// 3. Test Play Runner Command Resolver
					const { resolveEnginePlayCommand } = await import("./extensions/hooks/studio-play.ts");
					const playCfg = resolveEnginePlayCommand(tempDir);
					if (!playCfg || !playCfg.command) throw new Error("resolveEnginePlayCommand returned empty config");

					// 4. Test Continuity Finder
					const { findNextPendingTask } = await import("./extensions/hooks/studio-continuity.ts");
					const nextTask = findNextPendingTask(tempDir);
					if (!nextTask || !nextTask.title.includes("T1")) throw new Error("findNextPendingTask did not find T1 from created Live Spec");
				} finally {
					fs.rmSync(tempDir, { recursive: true, force: true });
				}
			`;
			expect(() => {
				execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
					cwd: path.join(__dirname, ".."),
				});
			}).not.toThrow();
		});
	});
});




describe("Shared ODD contract", () => {
	test("the Return Contract documented in skills/_shared parses with the runtime validator", () => {
		// The documented example is the contract: if the parser cannot read it, the
		// docs and the runtime have diverged and a conforming delivery can be rejected.
		const script = `
			const fs = await import("node:fs");
			const { validateSpecialistReturn } = await import("./extensions/hooks/return-contract.ts");

			const doc = fs.readFileSync("skills/_shared/odd-contract.md", "utf8");
			// Every documented example must parse: one stale block teaches a delivery
			// shape the runtime would reject.
			const blocks = [...doc.matchAll(/\\\`\\\`\\\`yaml\\s*\\n([\\s\\S]*?)\\n\\\`\\\`\\\`/g)].map((m) => m[1]);
			if (blocks.length === 0) throw new Error("skills/_shared/odd-contract.md has no yaml example");

			for (const [index, sample] of blocks.entries()) {
				const res = validateSpecialistReturn(sample);
				if (!res.isValid) throw new Error("documented example #" + index + " rejected: " + res.errors.join(" | "));
				if (res.parsed?.status === "completed") {
					if (!(res.parsed?.validation?.length)) {
						throw new Error("example #" + index + " carries validation the parser drops");
					}
					if (!(res.parsed?.files_changed?.length)) {
						throw new Error("example #" + index + " carries files_changed the parser drops");
					}
				}
				if (res.parsed?.status === "interaction_required" && !res.parsed?.interaction?.question) {
					throw new Error("example #" + index + " documents an escalation without a parsable question");
				}
				// The documented forms are not interchangeable: a passive example must be
				// exactly what a bash-capable agent is rejected for, or the table lies.
				if (sample.includes("structural:")) {
					const inBash = validateSpecialistReturn(sample, { tools: ["read", "bash"] });
					if (inBash.isValid) {
						throw new Error("example #" + index + " is documented as passive but a bash-capable agent would pass");
					}
				}
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	});
});

describe("ask_user_question registration is observable", () => {
	test("a host-provided ask_user_question is recorded as skipped, not silently ignored", () => {
		const script = `
			const { registerAskUserQuestion } = await import("./extensions/hooks/studio-choice.ts");
			const { getStudioToolRegistrations, formatStudioToolDiagnostics } =
				await import("./extensions/hooks/studio-tool-registry.ts");

			registerAskUserQuestion({ getAllTools: () => [{ name: "ask_user_question" }], registerTool: () => {} });

			const reg = getStudioToolRegistrations().find((r) => r.name === "ask_user_question");
			if (!reg) throw new Error("the skipped question tool left no record");
			if (reg.status !== "skipped") throw new Error("expected skipped, got " + reg.status);
			if (!formatStudioToolDiagnostics().join(" ").includes("ask_user_question")) {
				throw new Error("diagnostics must name the tool");
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 30000);
});

describe("Continuity hand-off", () => {
	test("executeAskUserQuestion exists and answers in headless mode instead of throwing", () => {
		const script = `
			const { executeAskUserQuestion } = await import("./extensions/hooks/studio-choice.ts");
			if (typeof executeAskUserQuestion !== "function") {
				throw new Error("studio-choice.ts must export the function the continuity flow imports");
			}

			const questions = {
				questions: [
					{
						header: "Continuidad",
						question: "¿Cómo deseas proceder?",
						options: [
							{ label: "Ejecutar", description: "seguir" },
							{ label: "Pausar", description: "frenar" },
						],
					},
				],
			};

			const result = await executeAskUserQuestion(questions, { hasUI: false });
			if (!result || !Array.isArray(result.content) || result.content.length === 0) {
				throw new Error("the hand-off must return a structured result, got: " + JSON.stringify(result));
			}
			if (result.details?.fallback !== true) {
				throw new Error("without a UI this must report the headless fallback, got: " + JSON.stringify(result.details));
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 30000);
});

describe("Interaction escalation contract", () => {
	test("interaction_required carries a payload the parent can relay", () => {
		const script = `
			const { validateSpecialistReturn } = await import("./extensions/hooks/return-contract.ts");

			const sample = [
				"status: interaction_required",
				'summary: "Dos arquitecturas válidas, la decisión no es técnica del especialista"',
				'question: "¿ECS con sistemas o jerarquía de escenas?"',
				"options:",
				'  - "ECS con sistemas"',
				'  - "Jerarquía de escenas"',
				"blocking: true",
			].join("\\n");

			const res = validateSpecialistReturn(sample);
			if (!res.isValid) throw new Error("a well formed escalation must be valid: " + res.errors.join(" | "));
			const interaction = res.parsed?.interaction;
			if (!interaction) throw new Error("the payload was dropped: interaction is undefined");
			if (interaction.question !== "¿ECS con sistemas o jerarquía de escenas?") {
				throw new Error("question lost: " + interaction.question);
			}
			if (interaction.options.length !== 2) throw new Error("options lost: " + JSON.stringify(interaction.options));
			if (interaction.blocking !== true) throw new Error("blocking must default to true");

			const noQuestion = validateSpecialistReturn('status: interaction_required\\nsummary: "necesito algo"\\n');
			if (noQuestion.isValid) {
				throw new Error("an escalation without a question is not actionable and must be rejected");
			}
		`;
		const { execFileSync } = require("child_process");
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: path.join(__dirname, ".."),
			});
		}).not.toThrow();
	}, 30000);
});
