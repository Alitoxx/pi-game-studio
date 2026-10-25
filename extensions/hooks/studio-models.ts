import { ACCENT, GREEN, SECONDARY } from "./studio-palette.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { promptModelForRole } from "./provider-resolver.ts";

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "models.default.json"))) return candidate1;
	} catch {}
	try {
		const candidate2 = resolve(__dirname, "..", "..");
		if (existsSync(join(candidate2, "models.default.json"))) return candidate2;
	} catch {}
	return process.cwd();
}

export async function handleStudioModels(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";
	const studioModelsPath = join(ctx.cwd, ".pi", "game-studio", "models.json");
	const legacyModelsPath = join(ctx.cwd, ".pi", "gentle-ai", "models.json");
	const modelsPath = existsSync(studioModelsPath)
		? studioModelsPath
		: existsSync(legacyModelsPath)
			? legacyModelsPath
			: studioModelsPath;
	const pkgRoot = resolvePackageRoot();
	const defaultsPath = join(pkgRoot, "models.default.json");

	let currentConfig: Record<string, string> = {};
	if (existsSync(modelsPath)) {
		try {
			currentConfig = JSON.parse(readFileSync(modelsPath, "utf8"));
		} catch {}
	} else if (existsSync(defaultsPath)) {
		try {
			currentConfig = JSON.parse(readFileSync(defaultsPath, "utf8"));
		} catch {}
	}

	if (query === "inherit") {
		applyInheritConfig(ctx, currentConfig);
		return;
	}

	if (query === "default" || query === "reset") {
		applyDefaultConfig(ctx);
		return;
	}

	if (query === "list" || query === "show") {
		const list = formatModelsList(currentConfig);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(list, "info");
		} else {
			console.log(list);
		}
		return;
	}

	// Interactive select
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = [
			"1. Aplicar perfil recomendado (Director: gpt-5.4-mini, Workhorse: 120b, Light: 20b)",
			"2. Modo 'inherit' (Heredar el modelo activo de la sesión de Pi en todos los agentes)",
			"3. Personalizar modelos por Nivel / Tier (Directores, Workhorses, Ligeros)",
			"4. Asignar modelo a un agente específico",
			"5. Ajustar presupuesto de razonamiento (Thinking Effort: High, Medium, Low)",
			"6. Ver asignación actual de modelos",
		];

		const choice = await promptSelectSafe(
			ctx,
			"PI GAME STUDIO — Configuración de Modelos de IA",
			options,
		);

		if (!choice) return;

		switch (choice.index) {
			case 0:
				applyDefaultConfig(ctx);
				break;
			case 1:
				applyInheritConfig(ctx, currentConfig);
				break;
			case 2: {
				const updated = await configureTierModels(ctx, currentConfig);
				saveModelsConfig(ctx, updated);
				break;
			}
			case 3: {
				const updated = await configureAgentModel(ctx, currentConfig);
				saveModelsConfig(ctx, updated);
				break;
			}
			case 4:
				await configureThinkingEffort(ctx);
				break;
			case 5: {
				const list = formatModelsList(currentConfig);
				if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
					ctx.ui.notify(list, "info");
				} else {
					console.log(list);
				}
				break;
			}
		}
		return;
	}

	// Fallback CLI
	const list = formatModelsList(currentConfig);
	console.log(list);
	console.log("" + ACCENT + "\x1b[1mOpciones de configuración de modelos:\x1b[0m");
	console.log("  " + SECONDARY + "/studio:models default\x1b[0m  Aplica los modelos recomendados del estudio");
	console.log("  " + SECONDARY + "/studio:models inherit\x1b[0m  Todos los agentes usan el modelo de la sesión Pi");
	console.log("  " + SECONDARY + "/assign-models\x1b[0m          Flujo guiado para personalizar agente por agente");
}

function applyDefaultConfig(ctx: ExtensionContext): void {
	const pkgRoot = resolvePackageRoot();
	const defaultsPath = join(pkgRoot, "models.default.json");
	const destDir = join(ctx.cwd, ".pi", "game-studio");
	const destFile = join(destDir, "models.json");

	mkdirSync(destDir, { recursive: true });

	if (existsSync(defaultsPath)) {
		writeFileSync(destFile, readFileSync(defaultsPath));
		const msg = "✔ Perfil recomendado guardado en .pi/game-studio/models.json";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(msg, "info");
		} else {
			console.log(`${GREEN}${msg}\x1b[0m`);
		}
	}
}

function applyInheritConfig(
	ctx: ExtensionContext,
	_current: Record<string, string>,
): void {
	const destDir = join(ctx.cwd, ".pi", "game-studio");
	const destFile = join(destDir, "models.json");
	mkdirSync(destDir, { recursive: true });

	const inheritConfig: Record<string, string> = {
		director: "inherit",
		workhorse: "inherit",
		lightweight: "inherit",
	};

	writeFileSync(destFile, JSON.stringify(inheritConfig, null, 2), "utf8");

	const msg = "✔ Modo inherit aplicado: todos los agentes usarán el modelo activo de tu sesión.";
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(msg, "info");
	} else {
		console.log(`${GREEN}${msg}\x1b[0m`);
	}
}

function saveModelsConfig(ctx: ExtensionContext, cfg: Record<string, string>): void {
	const destDir = join(ctx.cwd, ".pi", "game-studio");
	const destFile = join(destDir, "models.json");
	mkdirSync(destDir, { recursive: true });
	writeFileSync(destFile, JSON.stringify(cfg, null, 2), "utf8");
	const msg = "✔ Configuración de modelos guardada en .pi/game-studio/models.json";
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(msg, "info");
	} else {
		console.log(`${GREEN}${msg}\x1b[0m`);
	}
}

async function configureTierModels(
	ctx: ExtensionContext,
	base: Record<string, string>,
): Promise<Record<string, string>> {
	const config = { ...base };

	// Directores
	const dirPick = await promptModelForRole(
		ctx,
		"Tier 1 — Directores (Visión y Calidad)",
		"director",
		config.director || "openai-codex/gpt-5.4-mini",
	);
	if (dirPick) {
		config.director = dirPick;
	}

	// Workhorses
	const workPick = await promptModelForRole(
		ctx,
		"Tier 2 — Workhorses / Especialistas (Código y Diseño)",
		"workhorse",
		config.workhorse || "openrouter/openai/gpt-oss-120b:free",
	);
	if (workPick) {
		config.workhorse = workPick;
	}

	// Especialistas
	const lightPick = await promptModelForRole(
		ctx,
		"Tier 3 — Especialistas de Motor",
		"lightweight",
		config.lightweight || "openrouter/openai/gpt-oss-20b:free",
	);
	if (lightPick) {
		config.lightweight = lightPick;
	}

	return config;
}

async function configureAgentModel(
	ctx: ExtensionContext,
	base: Record<string, string>,
): Promise<Record<string, string>> {
	const config = { ...base };

	const agents = [
		"producer",
		"creative-director",
		"technical-director",
		"game-designer",
		"gameplay-programmer",
		"art-director",
		"audio-director",
		"qa-lead",
		"qa-verifier",
		"bevy-specialist",
		"godot-specialist",
		"phaser-specialist",
		"raylib-specialist",
		"unity-specialist",
		"unreal-specialist",
		"✏️ Escribir otro nombre de agente...",
	];

	const pick = await promptSelectSafe(ctx, "Selecciona el agente a personalizar:", agents);
	if (!pick) return config;

	let target = agents[pick.index];
	if (pick.index === agents.length - 1) {
		target = await promptInputSafe(ctx, "Nombre del agente (ej. gameplay-programmer):", "gameplay-programmer");
	}

	const chosenModel = await promptModelForRole(
		ctx,
		`Agente '${target}'`,
		"workhorse",
		config[target] || config.workhorse || "inherit",
	);

	if (chosenModel) {
		config[target] = chosenModel;
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(`Modelo para '${target}' asignado a: ${chosenModel}`, "info");
		}
	}

	return config;
}

function formatModelsList(cfg: Record<string, string>): string {
	const dirModel = cfg.director || "openai-codex/gpt-5.4-mini";
	const workModel = cfg.workhorse || "openrouter/openai/gpt-oss-120b:free";
	const lightModel = cfg.lightweight || "openrouter/openai/gpt-oss-20b:free";

	const allInherit = dirModel === "inherit" && workModel === "inherit" && lightModel === "inherit";

	const TIER_1 = ["producer", "creative-director", "technical-director"];
	const TIER_3 = ["bevy-specialist", "godot-specialist", "phaser-specialist", "raylib-specialist", "unity-specialist", "unreal-specialist"];

	// An override is an agent explicitly configured with a model different from its role/tier default
	const overrides = Object.entries(cfg)
		.filter(([k, v]) => {
			if (k === "director" || k === "workhorse" || k === "lightweight") return false;
			// If all tiers inherit, any agent set to "inherit" is not an override
			if (allInherit && v === "inherit") return false;
			// If tier 1 agent equals dirModel, it's not an override
			if (TIER_1.includes(k) && v === dirModel) return false;
			// If tier 3 specialist equals lightModel or workModel, it's not an override
			if (TIER_3.includes(k) && (v === lightModel || v === workModel)) return false;
			// If tier 2 agent equals workModel, it's not an override
			if (v === workModel) return false;
			return true;
		})
		.map(([k, v]) => `  • ${k}: ${v}`);

	const lines = [
		"┌── STUDIO MODELS: ASIGNACIÓN Y MONITOR DE CUOTAS POR TIER ──────┐",
		`│ • Tier 1 (Directores - Visión & Gating):   ${dirModel.padEnd(27)} │`,
		`│ • Tier 2 (Leads & Core Devs - Mecánicas):  ${workModel.padEnd(27)} │`,
		`│ • Tier 3 (Especialistas de Motor):         ${lightModel.padEnd(27)} │`,
		"├─────────────────────────────────────────────────────────────────┤",
		"│ PRESUPUESTO & REASONING BUDGET:                                 │",
		"│ • Tier 1: Thinking 'high'   (Estrategia, arquitectura, triaje)  │",
		"│ • Tier 2: Thinking 'medium' (Implementación, mecánicas, tests) │",
		"│ • Tier 3: Thinking 'medium' (Motor idiomático, shaders, build) │",
		"└─────────────────────────────────────────────────────────────────┘",
	];

	if (allInherit && overrides.length === 0) {
		lines.push("\n✔ Modo inherit: todos los agentes heredan el modelo activo de tu sesión.");
	} else if (overrides.length > 0) {
		lines.push("\nAsignaciones específicas por agente:\n" + overrides.slice(0, 15).join("\n"));
	}

	lines.push("\nConfiguración persistida en .pi/game-studio/models.json");
	return lines.join("\n");
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

async function configureThinkingEffort(ctx: ExtensionContext): Promise<void> {
	const targets = [
		"Tier 1 — Directores (producer, creative-director, technical-director)",
		"Tier 2 — Leads & Core Devs (game-designer, gameplay-programmer, etc.)",
		"Tier 3 — Especialistas de Motor (bevy, godot, raylib, unity, unreal)",
		"Personalizar un agente específico...",
	];

	const targetChoice = await promptSelectSafe(
		ctx,
		"Selecciona el grupo o agente para ajustar su Thinking Effort:",
		targets,
	);
	if (!targetChoice) return;

	const effortLevels = [
		"high (Pensamiento profundo, ideal para arquitectura y visión)",
		"medium (Balanceado, ideal para programación y diseño)",
		"low (Rápido y conciso, ideal para tareas operativas)",
		"off (Sin razonamiento explícito)",
	];

	const effortChoice = await promptSelectSafe(
		ctx,
		"Selecciona el nivel de razonamiento deseado:",
		effortLevels,
	);
	if (!effortChoice) return;

	const level = ["high", "medium", "low", "off"][effortChoice.index];
	const pkgRoot = resolvePackageRoot();
	const agentsDirs = [join(ctx.cwd, ".pi", "agents"), join(pkgRoot, "agents")].filter(existsSync);

	const TIER_1 = ["producer", "creative-director", "technical-director"];
	const TIER_2 = [
		"game-designer",
		"gameplay-programmer",
		"art-director",
		"audio-director",
		"qa-lead",
		"qa-verifier",
	];
	const TIER_3 = [
		"bevy-specialist",
		"godot-specialist",
		"raylib-specialist",
		"unity-specialist",
		"unreal-specialist",
	];

	let affectedCount = 0;

	if (targetChoice.index === 0) {
		affectedCount = updateAgentsThinking(agentsDirs, TIER_1, level);
	} else if (targetChoice.index === 1) {
		affectedCount = updateAgentsThinking(agentsDirs, TIER_2, level);
	} else if (targetChoice.index === 2) {
		affectedCount = updateAgentsThinking(agentsDirs, TIER_3, level);
	} else {
		const agentName = await promptInputSafe(
			ctx,
			"Nombre del agente (ej. gameplay-programmer):",
			"gameplay-programmer",
		);
		affectedCount = updateAgentsThinking(agentsDirs, [agentName], level);
	}

	const msg = `✔ Presupuesto de razonamiento (thinking) actualizado a '${level}' (${affectedCount} archivos).`;
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(msg, "info");
	} else {
		console.log(msg);
	}
}

function updateAgentsThinking(
	dirs: string[],
	filter: string[] | ((name: string) => boolean),
	level: string,
): number {
	let count = 0;
	const isMatch = Array.isArray(filter) ? (n: string) => filter.includes(n) : filter;

	for (const dir of dirs) {
		if (!existsSync(dir)) continue;
		try {
			const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
			for (const f of files) {
				const name = f.replace(".md", "");
				if (!isMatch(name)) continue;
				const fullPath = join(dir, f);
				const content = readFileSync(fullPath, "utf8");
				let updated = content;
				if (/^thinking:\s*[^\n]+/m.test(content)) {
					updated = content.replace(/^thinking:\s*[^\n]+/m, `thinking: ${level}`);
				} else {
					updated = content.replace(/^---\n/, `---\nthinking: ${level}\n`);
				}
				if (updated !== content) {
					writeFileSync(fullPath, updated, "utf8");
					count++;
				}
			}
		} catch {}
	}
	return count;
}
