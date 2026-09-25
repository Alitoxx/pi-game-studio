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
	hasModelsConfig: boolean;
	hasGameStudioDir: boolean;
	engramEnabled: boolean | null;
	hasProjectYaml: boolean;
	currentEngine: string;
}

export interface StudioInstallOptions {
	engine?: string;
	language?: string;
	modelsConfig?: Record<string, string>;
}

export function inspectSetup(cwd: string): SetupStatus {
	const pkgRoot = resolvePackageRoot();
	let totalPackageAgents = 50;
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

	let currentEngine = "Godot";
	const projectYaml = join(cwd, "project.yaml");
	const hasProjectYaml = existsSync(projectYaml);
	if (hasProjectYaml) {
		try {
			const m = readFileSync(projectYaml, "utf8").match(/^engine:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1]) currentEngine = m[1];
		} catch {}
	}

	return {
		agentsInstalled,
		totalPackageAgents,
		hasModelsConfig,
		hasGameStudioDir,
		engramEnabled,
		hasProjectYaml,
		currentEngine,
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
		}
		console.log(diag);
		return;
	}

	// Interactive UI mode
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = [
			`⚡ 1. Instalación Automática (50 agentes + modelos recomendados + ${status.currentEngine})`,
			"🛠️ 2. Instalación Manual / Guiada (Elegir modelos por agente/tier, motor e idioma)",
			"🤖 3. Configurar Modelos de IA (/studio:models)",
			"📊 4. Ver diagnóstico del estudio (/studio:status)",
			"📖 5. Ver guía rápida de inicio",
		];

		const choice = await promptSelectSafe(
			ctx,
			"🎮 Pi Game Studio — Asistente de Configuración",
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
				if (typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(diag, "info");
				}
				console.log(diag);
				break;
			}
			case 4: {
				const guide = formatGettingStartedGuide();
				if (typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(guide, "info");
				}
				console.log(guide);
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
	];

	const engineChoice = await promptSelectSafe(
		ctx,
		"Paso 1/3 — Selecciona el Motor de Juego principal:",
		engineOptions,
	);
	if (!engineChoice) return;

	const selectedEngine = ["Godot", "Unity", "Unreal", "Bevy"][engineChoice.index];

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
		"⚡ Perfil Recomendado (Directores: gpt-5.4-mini, Especialistas: 120b, Ligeros: 20b)",
		"🔄 Modo 'inherit' (Todos los 50 agentes usan el modelo activo en tu sesión Pi)",
		"🎯 Personalizar modelos por Nivel / Tier (Directores, Workhorses, Ligeros)",
		"👤 Personalizar agentes individuales (asignar modelo a roles específicos)",
	];

	const modelStrategyChoice = await promptSelectSafe(
		ctx,
		"Paso 3/3 — ¿Cómo deseas configurar los modelos de los 50 agentes?",
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
		for (const k of Object.keys(customModels)) customModels[k] = "inherit";
		customModels.director = "inherit";
		customModels.workhorse = "inherit";
		customModels.lightweight = "inherit";
	} else if (modelStrategyChoice.index === 2) {
		// Customize by Tiers
		customModels = await configureModelsByTier(ctx, customModels);
	} else if (modelStrategyChoice.index === 3) {
		// Customize specific agents
		customModels = await configureSpecificAgents(ctx, customModels);
	}

	// ── Confirmación Final ──
	const confirmSummary = [
		"🎮 RESUMEN DE INSTALACIÓN PERSONALIZADA:",
		`• Motor de juego:   ${selectedEngine}`,
		`• Idioma preferido:  ${selectedLang === "es" ? "Español (es)" : "English (en)"}`,
		`• Modelos Directores: ${customModels.director || "gpt-5.4-mini"}`,
		`• Modelos Workhorse:  ${customModels.workhorse || "gpt-oss-120b:free"}`,
		`• Modelos Ligeros:    ${customModels.lightweight || "gpt-oss-20b:free"}`,
	];

	const confirmOptions = [
		"✔ Confirmar e Instalar Pi Game Studio (50 agentes)",
		"❌ Cancelar sin modificar archivos",
	];

	const confirmation = await promptSelectSafe(
		ctx,
		confirmSummary.join("\n"),
		confirmOptions,
	);

	if (!confirmation || confirmation.index !== 0) {
		if (typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify("Instalación cancelada por el usuario.", "info");
		}
		console.log("Instalación cancelada. No se modificó ningún archivo.");
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
		"👑 Tier 1 — Directores (Visión, GDD y Arquitectura)",
		"director",
		config.director || "openai-codex/gpt-5.4-mini",
	);
	if (dirModel) {
		config.director = dirModel;
		config["creative-director"] = dirModel;
		config["technical-director"] = dirModel;
		config["producer"] = dirModel;
	}

	// Tier 2: Workhorses
	const workModel = await promptModelForRole(
		ctx,
		"💻 Tier 2 — Workhorses / Especialistas (Código, Diseño, QA)",
		"workhorse",
		config.workhorse || "openrouter/openai/gpt-oss-120b:free",
	);
	if (workModel) {
		config.workhorse = workModel;
	}

	// Tier 3: Ligeros
	const lightModel = await promptModelForRole(
		ctx,
		"🚀 Tier 3 — Tareas Ligeras (Comunidad, DevOps, Sonido)",
		"lightweight",
		config.lightweight || "openrouter/openai/gpt-oss-20b:free",
	);
	if (lightModel) {
		config.lightweight = lightModel;
		config["community-manager"] = lightModel;
		config["devops-engineer"] = lightModel;
		config["sound-designer"] = lightModel;
	}

	return config;
}

async function configureSpecificAgents(
	ctx: ExtensionContext,
	base: Record<string, string>,
): Promise<Record<string, string>> {
	const config = { ...base };

	const featuredAgents = [
		{ id: "creative-director", label: "👑 creative-director (Visión del juego y pilares)" },
		{ id: "technical-director", label: "💻 technical-director (Arquitectura de software)" },
		{ id: "game-designer", label: "📋 game-designer (Mecánicas, core loop y balance)" },
		{ id: "lead-programmer", label: "⚙️ lead-programmer (Desarrollo y gameplay)" },
		{ id: "godot-specialist", label: "⚡ godot-specialist (Motor Godot 4 & GDScript)" },
		{ id: "unity-specialist", label: "⚡ unity-specialist (Motor Unity & C#)" },
		{ id: "unreal-specialist", label: "⚡ unreal-specialist (Motor Unreal & C++)" },
		{ id: "bevy-specialist", label: "⚡ bevy-specialist (Motor Bevy & Rust)" },
		{ id: "custom", label: "✏️ Asignar a otro agente específico por nombre..." },
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

	// 1. Copy 50 agents
	let copiedCount = 0;
	if (existsSync(agentsSrc)) {
		const files = readdirSync(agentsSrc).filter((f) => f.endsWith(".md"));
		for (const file of files) {
			const srcPath = join(agentsSrc, file);
			const destPath = join(destDir, file);
			writeFileSync(destPath, readFileSync(srcPath));
			copiedCount++;
		}
	}

	// 2. Deploy models configuration
	if (options.modelsConfig) {
		writeFileSync(modelsDest, JSON.stringify(options.modelsConfig, null, 2), "utf8");
	} else if (!existsSync(modelsDest) && existsSync(modelsSrc)) {
		writeFileSync(modelsDest, readFileSync(modelsSrc));
	}

	// 3. Configure engine in project.yaml
	const engine = options.engine || "Godot";
	let yamlContent = existsSync(projectYamlPath) ? readFileSync(projectYamlPath, "utf8") : "";
	if (/^engine:\s*.*/m.test(yamlContent)) {
		yamlContent = yamlContent.replace(/^engine:\s*.*/m, `engine: "${engine}"`);
	} else {
		yamlContent = `# Pi Game Studio project configuration\nschema_version: 1\nengine: "${engine}"\n` + yamlContent;
	}
	writeFileSync(projectYamlPath, yamlContent, "utf8");

	// 4. Configure language preference
	if (options.language) {
		writeFileSync(join(studioDir, "language"), options.language, "utf8");
	}

	// 5. Install log
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
		`💡 Siguiente paso: usa /start para iniciar tu juego o /studio para ver comandos.`,
	].join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(summaryMsg, "info");
	}

	console.log("");
	console.log("\x1b[1m\x1b[38;2;52;211;153m✔ ¡Pi Game Studio instalado con éxito!\x1b[0m");
	console.log(`  \x1b[38;2;167;139;250m• Agentes:\x1b[0m    ${copiedCount} agentes en \x1b[38;2;243;244;246m.pi/agents/\x1b[0m`);
	console.log(`  \x1b[38;2;167;139;250m• Motor:\x1b[0m      ${engine} en \x1b[38;2;243;244;246mproject.yaml\x1b[0m`);
	console.log(`  \x1b[38;2;167;139;250m• Modelos:\x1b[0m    \x1b[38;2;243;244;246m.pi/gentle-ai/models.json\x1b[0m`);
	console.log(`  \x1b[38;2;167;139;250m• Registro:\x1b[0m   \x1b[38;2;243;244;246m.pi/game-studio/install-log.md\x1b[0m`);
	console.log("");
	console.log("\x1b[38;2;251;191;36m💡 Siguiente paso sugerido:\x1b[0m");
	console.log("  Escribe \x1b[1m\x1b[38;2;56;189;248m/start\x1b[0m para dar inicio al onboarding de tu juego.");
	console.log("  O escribe \x1b[1m\x1b[38;2;56;189;248m/studio\x1b[0m para explorar los comandos disponibles.");
	console.log("");
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
		}
		console.log(`\x1b[38;2;52;211;153m${msg}\x1b[0m`);
	}
}

export function formatSetupDiagnostic(s: SetupStatus): string {
	return [
		"📊 PI GAME STUDIO — ESTADO DE INSTALACIÓN",
		`• Agentes instalados:  ${s.agentsInstalled}/${s.totalPackageAgents} (.pi/agents/)`,
		`• Motor actual:        ${s.currentEngine}`,
		`• Config de modelos:   ${s.hasModelsConfig ? "✔ Presente (.pi/gentle-ai/models.json)" : "⚠ No encontrada"}`,
		`• Directorio estudio:  ${s.hasGameStudioDir ? "✔ Activo (.pi/game-studio/)" : "- No creado aún"}`,
		`• Memoria Engram:      ${s.engramEnabled === true ? "✔ Conectado" : "- Almacenamiento local Markdown"}`,
		`• project.yaml:        ${s.hasProjectYaml ? "✔ Presente" : "- No creado (se creará con /start o setup)"}`,
	].join("\n");
}

export function formatGettingStartedGuide(): string {
	return [
		"🎮 GUÍA RÁPIDA DE PI GAME STUDIO",
		"1. /studio:setup   Instalación automática o manual de agentes y modelos",
		"2. /studio:models  Revisa o personaliza los modelos asignados",
		"3. /start          Comienza el loop de onboarding de tu juego",
		"4. /studio         Accede al catálogo de 77 comandos del estudio",
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
