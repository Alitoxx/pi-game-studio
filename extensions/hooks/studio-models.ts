import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
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
	const modelsPath = join(ctx.cwd, ".pi", "gentle-ai", "models.json");
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
			"⚡ Aplicar perfil recomendado (Director: gpt-5.4-mini, Workhorse: 120b, Light: 20b)",
			"🔄 Modo 'inherit' (Heredar el modelo activo de la sesión de Pi en todos los agentes)",
			"🎯 Personalizar modelos por Nivel / Tier (Directores, Workhorses, Ligeros)",
			"👤 Asignar modelo a un agente específico",
			"📋 Ver asignación actual de modelos",
		];

		const choice = await promptSelectSafe(
			ctx,
			"🎮 Pi Game Studio — Configuración de Modelos de IA",
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
			case 4: {
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
	console.log("\x1b[38;2;167;139;250m\x1b[1mOpciones de configuración de modelos:\x1b[0m");
	console.log("  \x1b[38;2;56;189;248m/studio:models default\x1b[0m  Aplica los modelos recomendados del estudio");
	console.log("  \x1b[38;2;56;189;248m/studio:models inherit\x1b[0m  Todos los agentes usan el modelo de la sesión Pi");
	console.log("  \x1b[38;2;56;189;248m/assign-models\x1b[0m          Flujo guiado para personalizar agente por agente");
}

function applyDefaultConfig(ctx: ExtensionContext): void {
	const pkgRoot = resolvePackageRoot();
	const defaultsPath = join(pkgRoot, "models.default.json");
	const destDir = join(ctx.cwd, ".pi", "gentle-ai");
	const destFile = join(destDir, "models.json");

	mkdirSync(destDir, { recursive: true });

	if (existsSync(defaultsPath)) {
		writeFileSync(destFile, readFileSync(defaultsPath));
		const msg = "✔ Perfil recomendado guardado en .pi/gentle-ai/models.json";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(msg, "info");
		} else {
			console.log(`\x1b[38;2;52;211;153m${msg}\x1b[0m`);
		}
	}
}

function applyInheritConfig(
	ctx: ExtensionContext,
	_current: Record<string, string>,
): void {
	const destDir = join(ctx.cwd, ".pi", "gentle-ai");
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
		console.log(`\x1b[38;2;52;211;153m${msg}\x1b[0m`);
	}
}

function saveModelsConfig(ctx: ExtensionContext, cfg: Record<string, string>): void {
	const destDir = join(ctx.cwd, ".pi", "gentle-ai");
	const destFile = join(destDir, "models.json");
	mkdirSync(destDir, { recursive: true });
	writeFileSync(destFile, JSON.stringify(cfg, null, 2), "utf8");
	const msg = "✔ Configuración de modelos guardada en .pi/gentle-ai/models.json";
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(msg, "info");
	} else {
		console.log(`\x1b[38;2;52;211;153m${msg}\x1b[0m`);
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
		"👑 Tier 1 — Directores (Visión y Calidad)",
		"director",
		config.director || "openai-codex/gpt-5.4-mini",
	);
	if (dirPick) {
		config.director = dirPick;
	}

	// Workhorses
	const workPick = await promptModelForRole(
		ctx,
		"💻 Tier 2 — Workhorses / Especialistas (Código y Diseño)",
		"workhorse",
		config.workhorse || "openrouter/openai/gpt-oss-120b:free",
	);
	if (workPick) {
		config.workhorse = workPick;
	}

	// Ligeros
	const lightPick = await promptModelForRole(
		ctx,
		"🚀 Tier 3 — Ligeros (Comunidad, DevOps, Sonido)",
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
		"creative-director",
		"technical-director",
		"game-designer",
		"lead-programmer",
		"godot-specialist",
		"unity-specialist",
		"unreal-specialist",
		"bevy-specialist",
		"art-director",
		"qa-lead",
		"✏️ Escribir otro nombre de agente...",
	];

	const pick = await promptSelectSafe(ctx, "Selecciona el agente a personalizar:", agents);
	if (!pick) return config;

	let target = agents[pick.index];
	if (pick.index === 10) {
		target = await promptInputSafe(ctx, "Nombre del agente (ej. level-designer):", "gameplay-programmer");
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

	// An override is an agent explicitly configured with a model different from its role/tier default
	const overrides = Object.entries(cfg)
		.filter(([k, v]) => {
			if (k === "director" || k === "workhorse" || k === "lightweight") return false;
			// If all tiers inherit, any agent set to "inherit" is not an override
			if (allInherit && v === "inherit") return false;
			// If tier 1 agent equals dirModel, it's not an override
			if (["creative-director", "technical-director", "producer"].includes(k) && v === dirModel) return false;
			// If tier 3 agent equals lightModel, it's not an override
			if (["community-manager", "devops-engineer", "sound-designer"].includes(k) && v === lightModel) return false;
			// If tier 2 agent equals workModel, it's not an override
			if (v === workModel) return false;
			return true;
		})
		.map(([k, v]) => `  • ${k}: ${v}`);

	const lines = [
		"🤖 PI GAME STUDIO — ASIGNACIÓN DE MODELOS",
		`• Tier 1 (Directores):  ${dirModel}`,
		`• Tier 2 (Workhorses):  ${workModel}`,
		`• Tier 3 (Ligeros):     ${lightModel}`,
	];

	if (allInherit && overrides.length === 0) {
		lines.push("\n✔ Todos los agentes heredan el modelo activo de tu sesión.");
	} else if (overrides.length > 0) {
		lines.push("\nAsignaciones específicas por agente:\n" + overrides.slice(0, 15).join("\n"));
	}

	lines.push("\nGuardado en .pi/gentle-ai/models.json");
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
