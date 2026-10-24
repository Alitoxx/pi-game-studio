import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	readFileSync,
	writeFileSync,
	mkdirSync,
	readdirSync,
	symlinkSync,
	copyFileSync,
	chmodSync,
	unlinkSync,
	lstatSync,
	rmSync,
} from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { promptModelForRole } from "./provider-resolver.ts";
import { auditEnginePrerequisites, formatAuditReport } from "./studio-doctor.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import { handleStudioMcp } from "./studio-mcp.ts";
import { promptMediaToolsInstall } from "./studio-media-tools.ts";

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
	dimension?: "2d" | "3d";
	modelsConfig?: Record<string, string>;
	installAllAgents?: boolean;
}

export function detectDimensionFromText(text: string): "2d" | "3d" | null {
	if (!text) return null;
	const norm = text.toLowerCase();

	const matches3d = (norm.match(/\b(3d|fps|tps|mesh|meshes|gltf|glb|low-poly|lowpoly|first-person|third-person|pbr|csg|modular\s+kit|modular\s+kits)\b/gi) || []).length;
	const matches2d = (norm.match(/\b(2d|pixel\s*art|pixelart|sprite|sprites|spritesheet|spritesheets|tilemap|tilemaps|tileset|tilesets|top-down\s*2d|platformer|plataformero|metroidvania)\b/gi) || []).length;

	if (matches3d > 0 && matches2d === 0) return "3d";
	if (matches2d > 0 && matches3d === 0) return "2d";
	if (matches3d > 0 && matches2d > 0) {
		return matches3d >= matches2d ? "3d" : "2d";
	}
	return null;
}

export function readProjectYaml(cwd: string): { engine?: string; dimension?: "2d" | "3d"; [key: string]: any } {
	const projectYamlPath = join(cwd, "project.yaml");
	if (!existsSync(projectYamlPath)) return {};
	try {
		const content = readFileSync(projectYamlPath, "utf8");
		const res: { engine?: string; dimension?: "2d" | "3d"; [key: string]: any } = {};
		const engineMatch = content.match(/^engine:\s*["']?([^\n"']+)["']?/m);
		if (engineMatch) res.engine = engineMatch[1].trim();
		const dimMatch = content.match(/^dimension:\s*["']?([^\n"']+)["']?/m);
		if (dimMatch && (dimMatch[1].trim() === "2d" || dimMatch[1].trim() === "3d")) {
			res.dimension = dimMatch[1].trim() as "2d" | "3d";
		}
		return res;
	} catch {
		return {};
	}
}

export const CORE_STUDIO_AGENTS: string[] = [
	// Los 8 Agentes Esenciales del Estudio Compacto
	"producer",              // 1. Orquestador de producción y gobernanza
	"creative-director",     // 2. Visión, tono y pilares
	"technical-director",    // 3. Arquitectura técnica y viabilidad
	"game-designer",         // 4. Mecánicas, core loop y sistemas
	"gameplay-programmer",   // 5. Implementación de código y gameplay
	"art-director",          // 6. Dirección visual, estilo y shaders
	"audio-director",        // 7. Sonido, música y mezcla acústica
	"qa-lead",               // 8. Testing continuo, quality gates y bugs
];

export const ENGINE_AGENTS_MAP: Record<string, string[]> = {
	Godot: ["godot-specialist"],
	Unity: ["unity-specialist"],
	Unreal: ["unreal-specialist"],
	Bevy: ["bevy-specialist"],
	Raylib: ["raylib-specialist"],
	Phaser: ["phaser-specialist"],
};

export function getEngineAgents(engineName: string): string[] {
	const norm = engineName.toLowerCase();
	if (norm.includes("godot")) return ENGINE_AGENTS_MAP.Godot;
	if (norm.includes("unity")) return ENGINE_AGENTS_MAP.Unity;
	if (norm.includes("unreal")) return ENGINE_AGENTS_MAP.Unreal;
	if (norm.includes("bevy")) return ENGINE_AGENTS_MAP.Bevy;
	if (norm.includes("raylib")) return ENGINE_AGENTS_MAP.Raylib;
	if (norm.includes("phaser")) return ENGINE_AGENTS_MAP.Phaser;
	return ENGINE_AGENTS_MAP.Godot;
}

export function filterAgentsForEngine(engineName: string, all = false): string[] {
	if (all) return [];
	const engineAgents = getEngineAgents(engineName);
	return [...CORE_STUDIO_AGENTS, ...engineAgents];
}

export function inspectSetup(cwd: string): SetupStatus {
	const pkgRoot = resolvePackageRoot();
	let totalPackageAgents = 14;
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

	const studioModelsPath = join(cwd, ".pi", "game-studio", "models.json");
	const legacyModelsPath = join(cwd, ".pi", "gentle-ai", "models.json");
	const hasModelsConfig = existsSync(studioModelsPath) || existsSync(legacyModelsPath);
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
	const expectedAgents = expectedEngineAgents.length > 0 ? expectedEngineAgents.length : 9;

	// Configured if project.yaml exists (package-level agents available) OR local agents are installed
	const isConfigured = hasProjectYaml || (agentsInstalled >= (expectedAgents - 1) && hasGameStudioDir);

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
			"4. Diagnóstico de Viabilidad Multimedia (FFmpeg, ImageMagick, Assimp, Git-LFS, gltfpack)",
			"5. Hub de Servidores MCP (/studio:mcp — REA, Playwright, Context7, etc.)",
			"6. Ver diagnóstico del estudio (/studio:status)",
			"7. Ver guía rápida de inicio",
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
			case 3:
				await promptMediaToolsInstall(ctx);
				break;
			case 4:
				await handleStudioMcp("", ctx);
				break;
			case 5: {
				const diag = formatSetupDiagnostic(status);
				if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(diag, "info");
				} else {
					console.log(diag);
				}
				break;
			}
			case 6: {
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
		"Phaser 3/4 (TypeScript / WebGL — web y mobile ligero)",
	];

	const engineChoice = await promptSelectSafe(
		ctx,
		"Paso 1/4 — Selecciona el Motor de Juego principal:",
		engineOptions,
	);
	if (!engineChoice) return;
	const selectedEngine = ["Godot", "Unity", "Unreal", "Bevy", "Raylib", "Phaser"][engineChoice.index] || "Godot";

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

	// ── Paso 2: Dimensión del Proyecto (2D vs 3D) ──
	const dimensionOptions = [
		"2D (Sprites, Spritesheets, Atlas, TileMaps, Pixel Art)",
		"3D (Mallas glTF/GLB, Kits Modulares, Iluminación PBR, Colisiones)",
	];

	const dimensionChoice = await promptSelectSafe(
		ctx,
		"Paso 2/4 — Selecciona la dimensión y pipeline principal del juego:",
		dimensionOptions,
	);
	if (!dimensionChoice) return;
	const selectedDimension: "2d" | "3d" = dimensionChoice.index === 1 ? "3d" : "2d";

	// ── Paso 3: Idioma del Estudio ──
	const langOptions = [
		"Español (es) — Documentación y respuestas en español",
		"English (en) — Documentation and prompts in English",
	];

	const langChoice = await promptSelectSafe(
		ctx,
		"Paso 3/4 — Selecciona el idioma preferido de trabajo:",
		langOptions,
	);
	if (!langChoice) return;

	const selectedLang = langChoice.index === 0 ? "es" : "en";

	// ── Paso 4: Configuración de Modelos ──
	const modelStrategyOptions = [
		"1. Perfil Recomendado (Directores: gpt-5.4-mini, Especialistas: 120b, Ligeros: 20b)",
		"2. Modo 'inherit' (Todos los agentes usan el modelo activo en tu sesión Pi)",
		"3. Personalizar modelos por Nivel / Tier (Directores, Workhorses, Ligeros)",
		"4. Personalizar agentes individuales (asignar modelo a roles específicos)",
	];

	const modelStrategyChoice = await promptSelectSafe(
		ctx,
		"Paso 4/4 — ¿Cómo deseas configurar los modelos de los agentes?",
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
		`• Motor de juego:      ${selectedEngine}`,
		`• Dimensión del juego: ${selectedDimension.toUpperCase()} (${selectedDimension === "2d" ? "Sprites & TileMaps" : "glTF/GLB & PBR"})`,
		`• Agentes a desplegar: ${targetCount} agentes (8 Core + ${targetCount - 8} especialista de ${selectedEngine})`,
		`• Idioma preferido:    ${selectedLang === "es" ? "Español (es)" : "English (en)"}`,
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
		dimension: selectedDimension,
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
	const modelsDest = join(ctx.cwd, ".pi", "game-studio", "models.json");
	const modelsSrc = join(pkgRoot, "models.default.json");
	const projectYamlPath = join(ctx.cwd, "project.yaml");

	mkdirSync(destDir, { recursive: true });
	mkdirSync(studioDir, { recursive: true });

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

	// 2b. Clean up legacy redundant skills if present in .pi/skills.
	// Pi Game Studio serves its 6 ODD skills directly through the package manifest.
	// Having duplicate skills in .pi/skills/ causes Pi to warn about skill collisions.
	const localSkillsDir = join(ctx.cwd, ".pi", "skills");
	if (existsSync(localSkillsDir)) {
		const standardStudioSkills = ["arch", "code", "concept", "ship", "spec", "test", "_shared"];
		for (const skillName of standardStudioSkills) {
			const skillPath = join(localSkillsDir, skillName);
			if (existsSync(skillPath)) {
				try {
					rmSync(skillPath, { recursive: true, force: true });
				} catch {}
			}
		}
		try {
			if (readdirSync(localSkillsDir).length === 0) {
				rmSync(localSkillsDir, { recursive: true, force: true });
			}
		} catch {}
	}

	// 3. Deploy models configuration
	if (options.modelsConfig) {
		writeFileSync(modelsDest, JSON.stringify(options.modelsConfig, null, 2), "utf8");
	} else if (!existsSync(modelsDest) && existsSync(modelsSrc)) {
		writeFileSync(modelsDest, readFileSync(modelsSrc));
	}

	// 4. Configure engine and dimension in project.yaml
	const dimension = options.dimension || "2d";
	let yamlContent = existsSync(projectYamlPath) ? readFileSync(projectYamlPath, "utf8") : "";
	if (/^engine:\s*.*/m.test(yamlContent)) {
		yamlContent = yamlContent.replace(/^engine:\s*.*/m, `engine: "${engine}"`);
	} else {
		yamlContent = `# Pi Game Studio project configuration\nschema_version: 1\nengine: "${engine}"\n` + yamlContent;
	}
	if (/^dimension:\s*.*/m.test(yamlContent)) {
		yamlContent = yamlContent.replace(/^dimension:\s*.*/m, `dimension: "${dimension}"`);
	} else {
		yamlContent = yamlContent.replace(/(engine:\s*["'][^"']+["'])/, `$1\ndimension: "${dimension}"`);
		if (!/^dimension:\s*.*/m.test(yamlContent)) {
			yamlContent += `\ndimension: "${dimension}"\n`;
		}
	}
	writeFileSync(projectYamlPath, yamlContent, "utf8");

	// 5. Establish standard project structure: design/ (GDDs & Art) and production/ (Tracking, Sprints, QA)
	mkdirSync(join(ctx.cwd, "design", "gdd"), { recursive: true });
	mkdirSync(join(ctx.cwd, "design", "art"), { recursive: true });
	mkdirSync(join(ctx.cwd, "production", "qa"), { recursive: true });

	// 5a. Initialize production/qa/bugs.md if missing
	const bugsFilePath = join(ctx.cwd, "production", "qa", "bugs.md");
	if (!existsSync(bugsFilePath)) {
		const bugsTemplatePath = join(pkgRoot, "templates", "production", "qa", "bugs.md");
		if (existsSync(bugsTemplatePath)) {
			writeFileSync(bugsFilePath, readFileSync(bugsTemplatePath));
		} else {
			const fallbackContent = [
				"# Bug Triage Log",
				"",
				"> Standard bug report and triage schema for QA and playtesting.",
				"> Severity scale: P0 (Blocker / Crash) | P1 (Critical Gameplay Defect) | P2 (Major Functional / Asset Issue) | P3 (Minor / Polish)",
				"",
				"## Active Bugs",
				"",
				"| ID | Severity | System | Summary | Steps to Reproduce | Expected vs Actual | Status | Assigned |",
				"|----|----------|--------|---------|---------------------|--------------------|--------|----------|",
				"",
				"## Closed / Resolved Bugs",
				"",
				"| ID | Severity | System | Summary | Resolution | Verified In | Date |",
				"|----|----------|--------|---------|------------|-------------|------|",
				"",
			].join("\n");
			writeFileSync(bugsFilePath, fallbackContent, "utf8");
		}
	}

	// 5b. Configure local project tuiMode (fullscreen) by default
	const settingsJsonPath = join(ctx.cwd, ".pi", "settings.json");
	try {
		let currentSettings: any = {};
		if (existsSync(settingsJsonPath)) {
			try {
				currentSettings = JSON.parse(readFileSync(settingsJsonPath, "utf8"));
			} catch {}
		}
		let changed = false;
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

	// 7. Ensure isolated pi-studio CLI launcher is installed
	const launcherInstalled = ensureStudioLauncherInstalled(pkgRoot);

	// 8. Install log
	const logPath = join(studioDir, "install-log.md");
	const logEntry = `\n## Setup: ${new Date().toISOString()}\n- Agents installed: ${copiedCount}\n- Engine: ${engine}\n- Dimension: ${dimension}\n- Language: ${options.language || "es"}\n- Source: ${pkgRoot}\n- Launcher installed: ${launcherInstalled}\n`;
	const currentLog = existsSync(logPath) ? readFileSync(logPath, "utf8") : "# Pi Game Studio Install Log\n";
	writeFileSync(logPath, currentLog + logEntry, "utf8");

	const summaryMsg = [
		`✔ ¡Pi Game Studio instalado con éxito!`,
		`• Agentes: ${copiedCount} agentes en .pi/agents/`,
		`• Motor: ${engine} (en project.yaml)`,
		`• Dimensión: ${dimension.toUpperCase()} (en project.yaml)`,
		`• Modelos: .pi/game-studio/models.json`,
		`• Launcher: ${launcherInstalled ? "pi-studio (en ~/.local/bin/pi-studio)" : "bin/pi-studio.mjs"}`,
		`• Registro: .pi/game-studio/install-log.md`,
		``,
		`💡 Siguiente paso: ejecuta pi-studio en tu juego y usa /studio:start.`,
	].join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(summaryMsg, "info");
	} else {
		console.log("");
		console.log("\x1b[1m\x1b[38;2;52;211;153m✔ ¡Pi Game Studio instalado con éxito!\x1b[0m");
		console.log(`  \x1b[38;2;167;139;250m• Agentes:\x1b[0m    ${copiedCount} agentes en \x1b[38;2;243;244;246m.pi/agents/\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Motor:\x1b[0m      ${engine} en \x1b[38;2;243;244;246mproject.yaml\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Dimensión:\x1b[0m  ${dimension.toUpperCase()} en \x1b[38;2;243;244;246mproject.yaml\x1b[0m`);
		console.log(`  \x1b[38;2;167;139;250m• Modelos:\x1b[0m    \x1b[38;2;243;244;246m.pi/game-studio/models.json\x1b[0m`);
		if (launcherInstalled) {
			console.log(`  \x1b[38;2;167;139;250m• Launcher:\x1b[0m   \x1b[1m\x1b[38;2;56;189;248mpi-studio\x1b[0m (disponible globalmente en ~/.local/bin/pi-studio)`);
		}
		console.log(`  \x1b[38;2;167;139;250m• Registro:\x1b[0m   \x1b[38;2;243;244;246m.pi/game-studio/install-log.md\x1b[0m`);
		console.log("");
		console.log("\x1b[38;2;251;191;36m💡 Siguiente paso sugerido:\x1b[0m");
		console.log("  Abre tu juego con \x1b[1m\x1b[38;2;56;189;248mpi-studio\x1b[0m para un entorno 100% aislado sin agentes externos.");
		console.log("  Luego escribe \x1b[1m\x1b[38;2;56;189;248m/studio:start\x1b[0m para dar inicio al onboarding de tu juego.");
		console.log("");
	}
}

export function ensureStudioLauncherInstalled(pkgRoot: string): boolean {
	try {
		const home = homedir();
		const localBin = join(home, ".local", "bin");
		mkdirSync(localBin, { recursive: true });
		const target = join(localBin, "pi-studio");
		const source = join(pkgRoot, "bin", "pi-studio.mjs");
		if (existsSync(source)) {
			try {
				if (existsSync(target)) {
					const stat = lstatSync(target);
					if (stat.isSymbolicLink() || stat.isFile()) {
						unlinkSync(target);
					}
				}
				symlinkSync(source, target);
			} catch {
				copyFileSync(source, target);
			}
			chmodSync(target, 0o755);
			return true;
		}
	} catch {}
	return false;
}

export function installModelsConfig(ctx: ExtensionContext): void {
	const pkgRoot = resolvePackageRoot();
	const modelsDest = join(ctx.cwd, ".pi", "game-studio", "models.json");
	const modelsSrc = join(pkgRoot, "models.default.json");

	mkdirSync(join(ctx.cwd, ".pi", "game-studio"), { recursive: true });

	if (existsSync(modelsSrc)) {
		writeFileSync(modelsDest, readFileSync(modelsSrc));
		const msg = "✔ Modelos recomendados aplicados en .pi/game-studio/models.json";
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
		`• Config de modelos:   ${s.hasModelsConfig ? "Presente (.pi/game-studio/models.json)" : "No encontrada"}`,
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

export async function promptSelectSafe(
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

export async function promptInputSafe(
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
