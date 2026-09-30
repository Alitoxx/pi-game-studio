import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { promptModelForRole } from "./provider-resolver.ts";
import { auditEnginePrerequisites, formatAuditReport } from "./studio-doctor.ts";
import { detectProjectEngine } from "./engine-detector.ts";

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "agents"))) return candidate1;
	} catch {}
	try {
		const candidate2 = resolve(__dirname, "..", "..");
		if (existsSync(join(candidate2, "agents"))) return candidate2;
	} catch {}
	return process.cwd();
}

export interface SetupStatus {
	agentsInstalled: number;
	totalPackageAgents: number;
	expectedAgents: number;
	hasModelsConfig: boolean;
	hasGameStudioDir: boolean;
	engramEnabled: boolean | null;
	hasProjectYaml: boolean;
	currentEngine: string;
	isConfigured: boolean;
}

export interface StudioInstallOptions {
	engine?: string;
	language?: string;
	modelsConfig?: Record<string, string>;
	installAllAgents?: boolean;
}

export const CORE_STUDIO_AGENTS: string[] = [
	// Tier 1 — Directores
	"creative-director",
	"technical-director",
	"producer",
	// Tier 2 — Leads
	"game-designer",
	"lead-programmer",
	"art-director",
	"audio-director",
	"narrative-director",
	"qa-lead",
	"release-manager",
	"localization-lead",
	// Tier 3 — Especialistas Fundamentales
	"gameplay-programmer",
	"engine-programmer",
	"ai-programmer",
	"network-programmer",
	"tools-programmer",
	"ui-programmer",
	"systems-designer",
	"level-designer",
	"economy-designer",
	"ux-designer",
	"prototyper",
	"technical-artist",
	"sound-designer",
	"writer",
	"world-builder",
	"qa-tester",
	"performance-analyst",
	"devops-engineer",
	"accessibility-specialist",
	"live-ops-designer",
	"community-manager",
	"security-engineer",
	"analytics-engineer",
];

export const ENGINE_AGENTS_MAP: Record<string, string[]> = {
	Godot: [
		"godot-specialist",
		"godot-gdscript-specialist",
		"godot-shader-specialist",
		"godot-gdextension-specialist",
		"godot-csharp-specialist",
	],
	Unity: [
		"unity-specialist",
		"unity-dots-specialist",
		"unity-shader-specialist",
		"unity-addressables-specialist",
		"unity-ui-specialist",
	],
	Unreal: [
		"unreal-specialist",
		"ue-gas-specialist",
		"ue-blueprint-specialist",
		"ue-replication-specialist",
		"ue-umg-specialist",
	],
	Bevy: [
		"bevy-specialist",
	],
	Raylib: [
		"raylib-specialist",
		"raylib-entt-specialist",
		"raylib-shader-specialist",
		"raylib-ui-specialist",
		"raylib-build-specialist",
	],
};

export function getEngineAgents(engineName: string): string[] {
	const norm = engineName.toLowerCase();
	if (norm.includes("godot")) return ENGINE_AGENTS_MAP.Godot;
	if (norm.includes("unity")) return ENGINE_AGENTS_MAP.Unity;
	if (norm.includes("unreal")) return ENGINE_AGENTS_MAP.Unreal;
	if (norm.includes("bevy")) return ENGINE_AGENTS_MAP.Bevy;
	if (norm.includes("raylib")) return ENGINE_AGENTS_MAP.Raylib;
	return ENGINE_AGENTS_MAP.Godot;
}

export function filterAgentsForEngine(engineName: string, all = false): string[] {
	if (all) return [];
	const engineAgents = getEngineAgents(engineName);
	return [...CORE_STUDIO_AGENTS, ...engineAgents];
}

export function inspectSetup(cwd: string): SetupStatus {
	const pkgRoot = resolvePackageRoot();
	let totalPackageAgents = 55;
	try {
		if (existsSync(join(pkgRoot, "agents"))) {
			totalPackageAgents = readdirSync(join(pkgRoot, "agents")).filter((f) =>
				f.endsWith(".md"),
			).length;
		}
	} catch {}

	let agentsInstalled = 0;
	const agentsDir = join(cwd, ".pi", "agents");
	try {
		if (existsSync(agentsDir)) {
			agentsInstalled = readdirSync(agentsDir).filter((f) =>
				f.endsWith(".md"),
			).length;
		}
	} catch {}

	const hasModelsConfig = existsSync(
		join(cwd, ".pi", "gentle-ai", "models.json"),
	);
	const hasGameStudioDir = existsSync(join(cwd, ".pi", "game-studio"));

	let engramEnabled: boolean | null = null;
	const engramFlag = join(cwd, ".pi", "game-studio", "engram-enabled");
	if (existsSync(engramFlag)) {
		try {
			engramEnabled = readFileSync(engramFlag, "utf8").trim() === "true";
		} catch {}
	}

	let currentEngine = "Sin configurar";
	const projectYaml = join(cwd, "project.yaml");
	const hasProjectYaml = existsSync(projectYaml);
	if (hasProjectYaml) {
		try {
			const m = readFileSync(projectYaml, "utf8").match(/^engine:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1]) currentEngine = m[1];
		} catch {}
	} else {
		const autoEngine = detectProjectEngine(cwd);
		if (autoEngine.detected) {
			currentEngine = autoEngine.engine;
		}
	}

	const expectedEngineAgents = filterAgentsForEngine(currentEngine);
	const expectedAgents = expectedEngineAgents.length > 0 ? expectedEngineAgents.length : 35;

	// Configured if the engine's required agents are installed (or all 55) and project.yaml/studio dir exists
	const isConfigured = agentsInstalled >= (expectedAgents - 2) && (hasProjectYaml || hasGameStudioDir);

	return {
		agentsInstalled,
		totalPackageAgents,
		expectedAgents,
		hasModelsConfig,
		hasGameStudioDir,
		engramEnabled,
		hasProjectYaml,
		currentEngine,
		isConfigured,
	};
}

export async function handleStudioSetup(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";
	const status = inspectSetup(ctx.cwd);

	// Direct execution flags
	if (query === "run" || query === "auto" || query === "install") {
		installStudioFiles(ctx);
		return;
	}

	if (query === "manual" || query === "guided") {
		await runGuidedSetup(ctx, status);
		return;
	}

	if (query === "status" || query === "info") {
		const diag = formatSetupDiagnostic(status);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(diag, "info");
		} else {
			console.log(diag);
		}
		return;
	}

	// Interactive UI mode
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = [
			`1. Instalación Automática (${status.expectedAgents} agentes recomendados para ${status.currentEngine} en modo 'inherit')`,
			"2. Instalación Manual / Guiada (Elegir motor, idioma y modelos por nivel)",
			"3. Configurar Modelos de IA (/studio:models)",
			"4. Ver diagnóstico del estudio (/studio:status)",
			"5. Ver guía rápida de inicio",
		];

		const choice = await promptSelectSafe(
			ctx,
			"PI GAME STUDIO — Asistente de Configuración",
			options,
		);

		if (!choice) return;

		switch (choice.index) {
			case 0:
				installStudioFiles(ctx);
				break;
			case 1:
				await runGuidedSetup(ctx, status);
				break;
			case 2:
				installModelsConfig(ctx);
				break;
			case 3: {
				const diag = formatSetupDiagnostic(status);
				if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(diag, "info");
				} else {
					console.log(diag);
				}
				break;
			}
			case 4: {
				const guide = formatGettingStartedGuide();
				if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(guide, "info");
				} else {
					console.log(guide);
				}
				break;
			}
		}
		return;
	}

	// Terminal fallback
	const diag = formatSetupDiagnostic(status);
	console.log(diag);
	console.log("\x1b[38;2;167;139;250m\x1b[1mOpciones de instalación disponibles:\x1b[0m");
	console.log("  \x1b[38;2;56;189;248m/studio:setup auto\x1b[0m    Instalación automática en 1 clic (recomendada)");
	console.log("  \x1b[38;2;56;189;248m/studio:setup manual\x1b[0m  Instalación guiada paso a paso");
	console.log("  \x1b[38;2;56;189;248m/start\x1b[0m                Inicio asistido por IA");
}

/**
 * Guided manual setup: allows choosing engine, language, and model configuration
 */
export async function runGuidedSetup(
	ctx: ExtensionContext,
	status: SetupStatus,
): Promise<void> {
	// ── Paso 1: Motor de Juego ──
	const engineOptions = [
		"Godot 4 (Recomendado — ligero, open source)",
		"Unity (C#, 2D/3D, multiplataforma)",
		"Unreal Engine 5 (C++, Blueprints, high-end)",
		"Bevy (Rust ECS, moderno y ultra rápido)",
		"Raylib (C++ / EnTT — puro código, cero editores pesados)",
	];

	const engineChoice = await promptSelectSafe(
		ctx,
		"Paso 1/3 — Selecciona el Motor de Juego principal:",
		engineOptions,
	);
	const selectedEngine = ["Godot", "Unity", "Unreal", "Bevy", "Raylib"][engineChoice.index];

	// Auditoría de Prerrequisitos del Motor
	const audit = auditEnginePrerequisites(selectedEngine);
	const reportLines = formatAuditReport(audit);
	for (const line of reportLines) {
		console.log(line);
	}

	if (!audit.ready) {
		const proceedChoice = await promptSelectSafe(
			ctx,
			`⚠️ Faltan herramientas para ${selectedEngine}. ¿Deseas continuar configurando o cambiar de motor?`,
			[
				"Continuar de todos modos (instalaré los requisitos más tarde)",
				"Volver a elegir motor",
			],
		);
		if (proceedChoice && proceedChoice.index === 1) {
			return runGuidedSetup(ctx, status);
		}
	}

	// ── Paso 2: Idioma del Estudio ──
	const langOptions = [
		"Español (es) — Documentación y respuestas en español",
		"English (en) — Documentation and prompts in English",
	];

	const langChoice = await promptSelectSafe(
		ctx,
		"Paso 2/3 — Selecciona el idioma preferido de trabajo:",
		langOptions,
	);
	if (!langChoice) return;

	const selectedLang = langChoice.index === 0 ? "es" : "en";

	// ── Paso 3: Configuración de Modelos ──
	const modelStrategyOptions = [
		"1. Perfil Recomendado (Directores: gpt-5.4-mini, Especialistas: 120b, Ligeros: 20b)",
		"2. Modo 'inherit' (Todos los agentes usan el modelo activo en tu sesión Pi)",
		"3. Personalizar modelos por Nivel / Tier (Directores, Workhorses, Ligeros)",
		"4. Personalizar agentes individuales (asignar modelo a roles específicos)",
	];

	const modelStrategyChoice = await promptSelectSafe(
		ctx,
		"Paso 3/3 — ¿Cómo deseas configurar los modelos de los agentes?",
		modelStrategyOptions,
	);
	if (!modelStrategyChoice) return;

	let customModels: Record<string, string> = {};
	const pkgRoot = resolvePackageRoot();
	try {
		const defaultsPath = join(pkgRoot, "models.default.json");
		if (existsSync(defaultsPath)) {
			customModels = JSON.parse(readFileSync(defaultsPath, "utf8"));
		}
	} catch {}

	if (modelStrategyChoice.index === 1) {
		// Inherit all
		customModels = {
			director: "inherit",
			workhorse: "inherit",
			lightweight: "inherit",
		};
	} else if (modelStrategyChoice.index === 2) {
		// Customize by Tiers
		customModels = await configureModelsByTier(ctx, customModels);
	} else if (modelStrategyChoice.index === 3) {
		// Customize specific agents
		customModels = await configureSpecificAgents(ctx, customModels);
	}

	const engineAgents = filterAgentsForEngine(selectedEngine);
	const targetCount = engineAgents.length;

	// ── Confirmación Final ──
	const confirmSummary = [
		"RESUMEN DE INSTALACION PERSONALIZADA:",
		`• Motor de juego:   ${selectedEngine}`,
		`• Agentes a desplegar: ${targetCount} agentes (34 Core + ${targetCount - 34} especialistas de ${selectedEngine})`,
		`• Idioma preferido:  ${selectedLang === "es" ? "Español (es)" : "English (en)"}`,
		`• Modelos Directores: ${customModels.director || "gpt-5.4-mini"}`,
		`• Modelos Workhorse:  ${customModels.workhorse || "gpt-oss-120b:free"}`,
		`• Modelos Ligeros:    ${customModels.lightweight || "gpt-oss-20b:free"}`,
	];

	const confirmOptions = [
		`✔ Confirmar e Instalar Pi Game Studio (${targetCount} agentes para ${selectedEngine})`,
		"❌ Cancelar sin modificar archivos",
	];

	const confirmation = await promptSelectSafe(
		ctx,
		confirmSummary.join("\n"),
		confirmOptions,
	);

	if (!confirmation || confirmation.index !== 0) {
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify("Instalación cancelada por el usuario.", "info");
		} else {
			console.log("Instalación cancelada. No se modificó ningún archivo.");
		}
		return;
	}

	// Ejecutar instalación con las opciones personalizadas
	installStudioFiles(ctx, {
		engine: selectedEngine,
		language: selectedLang,
		modelsConfig: customModels,
	});
}

async function configureModelsByTier(
	ctx: ExtensionContext,
	base: Record<string, string>,
): Promise<Record<string, string>> {
	const config = { ...base };

	// Tier 1: Directores
	const dirModel = await promptModelForRole(
		ctx,
		"Tier 1 — Directores (Visión, GDD y Arquitectura)",
		"director",
		config.director || "openai-codex/gpt-5.4-mini",
	);
	if (dirModel) {
		config.director = dirModel;
	}

	// Tier 2: Workhorses
	const workModel = await promptModelForRole(
		ctx,
		"Tier 2 — Workhorses / Especialistas (Código, Diseño, QA)",
		"workhorse",
		config.workhorse || "openrouter/openai/gpt-oss-120b:free",
	);
	if (workModel) {
		config.workhorse = workModel;
	}

	// Tier 3: Ligeros
	const lightModel = await promptModelForRole(
		ctx,
		"Tier 3 — Tareas Ligeras (Comunidad, DevOps, Sonido)",
		"lightweight",
		config.lightweight || "openrouter/openai/gpt-oss-20b:free",
	);
	if (lightModel) {
		config.lightweight = lightModel;
	}

	return config;
}

async function configureSpecificAgents(
	ctx: ExtensionContext,
	base: Record<string, string>,
): Promise<Record<string, string>> {
	const config = { ...base };

	const featuredAgents = [
		{ id: "creative-director", label: "creative-director (Visión del juego y pilares)" },
		{ id: "technical-director", label: "technical-director (Arquitectura de software)" },
		{ id: "game-designer", label: "game-designer (Mecánicas, core loop y balance)" },
		{ id: "lead-programmer", label: "lead-programmer (Desarrollo y gameplay)" },
		{ id: "godot-specialist", label: "godot-specialist (Motor Godot 4 & GDScript)" },
		{ id: "unity-specialist", label: "unity-specialist (Motor Unity & C#)" },
		{ id: "unreal-specialist", label: "unreal-specialist (Motor Unreal & C++)" },
		{ id: "bevy-specialist", label: "bevy-specialist (Motor Bevy & Rust)" },
		{ id: "raylib-specialist", label: "raylib-specialist (Motor Raylib & C++ / EnTT)" },
		{ id: "custom", label: "Asignar a otro agente específico por nombre..." },
	];

	const agentPick = await promptSelectSafe(
		ctx,
		"Selecciona el agente al que deseas asignar un modelo específico:",
		featuredAgents.map((a) => a.label),
	);

	if (!agentPick) return config;

	let targetAgent = featuredAgents[agentPick.index].id;
	if (targetAgent === "custom") {
		targetAgent = await promptInputSafe(ctx, "Nombre del agente (ej. level-designer, qa-lead):", "gameplay-programmer");
	}

	const chosenModel = await promptModelForRole(
		ctx,
		`Agente '${targetAgent}'`,
		"workhorse",
		config[targetAgent] || config.workhorse || "inherit",
	);

	if (chosenModel) {
		config[targetAgent] = chosenModel;
		if (typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(`Modelo para '${targetAgent}' asignado a: ${chosenModel}`, "info");
		}
	}

	return config;
}

export function installStudioFiles(
	ctx: ExtensionContext,
	options: StudioInstallOptions = {},
): void {
	const pkgRoot = resolvePackageRoot();
	const agentsSrc = join(pkgRoot, "agents");
	const destDir = join(ctx.cwd, ".pi", "agents");
	const studioDir = join(ctx.cwd, ".pi", "game-studio");
	const modelsDest = join(ctx.cwd, ".pi", "gentle-ai", "models.json");
	const modelsSrc = join(pkgRoot, "models.default.json");
	const projectYamlPath = join(ctx.cwd, "project.yaml");

	mkdirSync(destDir, { recursive: true });
	mkdirSync(studioDir, { recursive: true });
	mkdirSync(join(ctx.cwd, ".pi", "gentle-ai"), { recursive: true });

	// 1. Determine engine and allowed agents
	const engine = options.engine || "Godot";
	const allowedAgentNames = filterAgentsForEngine(engine, options.installAllAgents);
	const allowedSet = allowedAgentNames.length > 0 ? new Set(allowedAgentNames) : null;

	// 2. Copy selected agents (Core + Selected Engine Specialists)
	let copiedCount = 0;
	if (existsSync(agentsSrc)) {
		const files = readdirSync(agentsSrc).filter((f) => f.endsWith(".md"));
		for (const file of files) {
			const agentId = file.replace(/\.md$/, "");
			if (allowedSet && !allowedSet.has(agentId)) {
				continue;
			}
			const srcPath = join(agentsSrc, file);
			const destPath = join(destDir, file);
			writeFileSync(destPath, readFileSync(srcPath));
			copiedCount++;
		}
	}

	// 3. Deploy models configuration
	if (options.modelsConfig) {
		writeFileSync(modelsDest, JSON.stringify(options.modelsConfig, null, 2), "utf8");
	} else if (!existsSync(modelsDest) && existsSync(modelsSrc)) {
		writeFileSync(modelsDest, readFileSync(modelsSrc));
	}

	// 4. Configure engine in project.yaml
	let yamlContent = existsSync(projectYamlPath) ? readFileSync(projectYamlPath, "utf8") : "";
	if (/^engine:\s*.*/m.test(yamlContent)) {
		yamlContent = yamlContent.replace(/^engine:\s*.*/m, `engine: "${engine}"`);
	} else {
		yamlContent = `# Pi Game Studio project configuration\nschema_version: 1\nengine: "${engine}"\n` + yamlContent;
	}
	writeFileSync(projectYamlPath, yamlContent, "utf8");

	// 5. Establish standard project structure: design/ (GDDs & Art) and production/ (Tracking & Sprints)
	mkdirSync(join(ctx.cwd, "design", "gdd"), { recursive: true });
	mkdirSync(join(ctx.cwd, "design", "art"), { recursive: true });
	mkdirSync(join(ctx.cwd, "production"), { recursive: true });

	// 5b. Configure local project theme and tuiMode (fullscreen) by default
	const settingsJsonPath = join(ctx.cwd, ".pi", "settings.json");
	try {
		let currentSettings: any = {};
		if (existsSync(settingsJsonPath)) {
			try {
				currentSettings = JSON.parse(readFileSync(settingsJsonPath, "utf8"));
			} catch {}
		}
		let changed = false;
		if (!currentSettings.theme) {
			currentSettings.theme = "GameStudio-Gentle";
			changed = true;
		}
		if (!currentSettings.tuiMode) {
			currentSettings.tuiMode = "fullscreen";
			changed = true;
		}
		if (changed) {
			writeFileSync(settingsJsonPath, JSON.stringify(currentSettings, null, 2), "utf8");
		}
	} catch {}

	// 6. Configure language preference
	if (options.language) {
		writeFileSync(join(studioDir, "language"), options.language, "utf8");
	}

	// 7. Install log
	const logPath = join(studioDir, "install-log.md");
	const logEntry = `\n## Setup: ${new Date().toISOString()}\n- Agents installed: ${copiedCount}\n- Engine: ${engine}\n- Language: ${options.language || "es"}\n- Source: ${pkgRoot}\n`;
	const currentLog = existsSync(logPath) ? readFileSync(logPath, "utf8") : "# Pi Game Studio Install Log\n";
	writeFileSync(logPath, currentLog + logEntry, "utf8");

	const summaryMsg = [
		`✔ ¡Pi Game Studio instalado con éxito!`,
		`• Agentes: ${copiedCount} agentes en .pi/agents/`,
		`• Motor: ${engine} (en project.yaml)`,
		`• Modelos: .pi/gentle-ai/models.json`,
		`• Registro: .pi/game-studio/install-log.md`,
		``,
		`💡 Siguiente paso: usa /studio:start para iniciar tu juego o /studio para ver comandos.`,
	].join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(summaryMsg, "info");
	} else {
		console.log("");
		console.log("\x1b[1m\x1b[38;2;52;211;153m✔ ¡Pi Game Studio instalado con éxito!\x1b[0m");
		console.log(`  \x1b[38;2;167;139;250m• Agentes:\x1b[0m    ${copiedCount} agentes en \x1b[38;2;243;244;246m.pi/agents/\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Motor:\x1b[0m      ${engine} en \x1b[38;2;243;244;246mproject.yaml\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Modelos:\x1b[0m    \x1b[38;2;243;244;246m.pi/gentle-ai/models.json\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Registro:\x1b[0m   \x1b[38;2;243;244;246m.pi/game-studio/install-log.md\x1b[0m`);
		console.log("");
		console.log("\x1b[38;2;251;191;36m💡 Siguiente paso sugerido:\x1b[0m");
		console.log("  Escribe \x1b[1m\x1b[38;2;56;189;248m/studio:start\x1b[0m (o \x1b[38;2;56;189;248m/start\x1b[0m) para dar inicio al onboarding de tu juego.");
		console.log("  O escribe \x1b[1m\x1b[38;2;56;189;248m/studio\x1b[0m para explorar los comandos disponibles.");
		console.log("");
	}
}

export function installModelsConfig(ctx: ExtensionContext): void {
	const pkgRoot = resolvePackageRoot();
	const modelsDest = join(ctx.cwd, ".pi", "gentle-ai", "models.json");
	const modelsSrc = join(pkgRoot, "models.default.json");

	mkdirSync(join(ctx.cwd, ".pi", "gentle-ai"), { recursive: true });

	if (existsSync(modelsSrc)) {
		writeFileSync(modelsDest, readFileSync(modelsSrc));
		const msg = "✔ Modelos recomendados aplicados en .pi/gentle-ai/models.json";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(msg, "info");
		} else {
			console.log(`\x1b[38;2;52;211;153m${msg}\x1b[0m`);
		}
	}
}

export function formatSetupDiagnostic(s: SetupStatus): string {
	return [
		"PI GAME STUDIO — ESTADO DE INSTALACION",
		`• Agentes instalados:  ${s.agentsInstalled}/${s.expectedAgents} para ${s.currentEngine} (.pi/agents/)`,
		`• Motor actual:        ${s.currentEngine}`,
		`• Config de modelos:   ${s.hasModelsConfig ? "Presente (.pi/gentle-ai/models.json)" : "No encontrada"}`,
		`• Directorio estudio:  ${s.hasGameStudioDir ? "Activo (.pi/game-studio/)" : "No creado aún"}`,
		`• Memoria Engram:      ${s.engramEnabled === true ? "Conectado" : "Almacenamiento local Markdown"}`,
		`• project.yaml:        ${s.hasProjectYaml ? "Presente" : "No creado (se creará con /start o setup)"}`,
	].join("\n");
}

export function formatGettingStartedGuide(): string {
	return [
		"GUIA RAPIDA DE PI GAME STUDIO",
		"1. /studio:setup   Instalación automática o manual de agentes y modelos",
		"2. /studio:models  Revisa o personaliza los modelos asignados",
		"3. /start          Comienza el loop de onboarding de tu juego",
		"4. /studio         Accede al catálogo de comandos del estudio",
	].join("\n");
}

async function promptSelectSafe(
	ctx: ExtensionContext,
	prompt: string,
	options: string[],
): Promise<{ index: number; label: string } | undefined> {
	if (!ctx.hasUI || typeof (ctx.ui as any)?.select !== "function") return undefined;
	const selected = await (ctx.ui as any).select(prompt, options);
	if (selected === undefined || selected === null) return undefined;
	const idx = typeof selected === "number" ? selected : options.indexOf(selected);
	if (idx === -1) return undefined;
	return { index: idx, label: options[idx] };
}

async function promptInputSafe(
	ctx: ExtensionContext,
	prompt: string,
	defaultValue: string,
): Promise<string> {
	if (ctx.hasUI && typeof (ctx.ui as any)?.input === "function") {
		try {
			const res = await (ctx.ui as any).input(prompt, defaultValue);
			if (typeof res === "string" && res.trim()) return res.trim();
		} catch {}
	}
	return defaultValue;
}
