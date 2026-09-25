import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface DiscoveredModel {
	id: string;
	name: string;
	provider: string;
}

export interface DiscoveredProvider {
	id: string;
	name: string;
	isConfigured: boolean;
	models: DiscoveredModel[];
}

const KNOWN_PROVIDER_RECOMMENDATIONS: Record<
	string,
	{ director: string[]; workhorse: string[]; lightweight: string[] }
> = {
	"opencode-go": {
		director: ["gpt-6-luna", "gpt-5.6-luna", "qwen3.7-max", "deepseek-v4-pro", "kimi-k3"],
		workhorse: ["kimi-k2.7-code", "deepseek-v4-pro", "qwen3.6-plus", "space-bunny-free", "glm-5.3"],
		lightweight: ["space-bunny-free", "deepseek-v4-flash", "glm-5.3-flash", "mimo-v2.6-flash"],
	},
	anthropic: {
		director: ["claude-sonnet-4", "claude-3-7-sonnet", "claude-3-5-sonnet"],
		workhorse: ["claude-sonnet-4", "claude-3-5-sonnet"],
		lightweight: ["claude-3-5-haiku"],
	},
	openai: {
		director: ["gpt-4o", "o3-mini", "gpt-4.5-preview"],
		workhorse: ["gpt-4o", "gpt-4o-mini"],
		lightweight: ["gpt-4o-mini"],
	},
	google: {
		director: ["gemini-2.5-pro", "gemini-2.0-pro-exp"],
		workhorse: ["gemini-2.5-flash", "gemini-2.0-flash"],
		lightweight: ["gemini-2.5-flash-lite"],
	},
	openrouter: {
		director: ["anthropic/claude-sonnet-4", "deepseek/deepseek-r1", "openai/gpt-4o"],
		workhorse: ["openai/gpt-oss-120b:free", "deepseek/deepseek-chat", "meta-llama/llama-3.3-70b-instruct"],
		lightweight: ["openai/gpt-oss-20b:free", "meta-llama/llama-3.2-3b-instruct:free"],
	},
	ollama: {
		director: ["llama3.3:70b", "qwen2.5:32b", "deepseek-r1:32b"],
		workhorse: ["qwen2.5-coder:14b", "deepseek-coder-v2:16b", "llama3.1:8b"],
		lightweight: ["llama3.2:3b", "qwen2.5:3b"],
	},
};

/**
 * Discovers configured and available providers from Pi runtime and local config
 */
export async function getAvailableProviders(
	ctx: ExtensionContext,
): Promise<DiscoveredProvider[]> {
	const providerMap = new Map<string, DiscoveredProvider>();

	// 1. Try Pi runtime modelRegistry if available
	try {
		const raw = await (ctx as any).modelRegistry?.getAvailable?.();
		if (Array.isArray(raw)) {
			for (const item of raw) {
				if (item && item.provider && item.id) {
					if (!providerMap.has(item.provider)) {
						providerMap.set(item.provider, {
							id: item.provider,
							name: item.provider,
							isConfigured: true,
							models: [],
						});
					}
					providerMap.get(item.provider)!.models.push({
						id: item.id,
						name: item.name || item.id,
						provider: item.provider,
					});
				}
			}
		}
	} catch {}

	// 2. Inspect ~/.pi/agent/models-store.json (Pi model cache)
	try {
		const storePath = join(homedir(), ".pi", "agent", "models-store.json");
		if (existsSync(storePath)) {
			const data = JSON.parse(readFileSync(storePath, "utf8"));
			for (const [providerId, val] of Object.entries(data)) {
				if (val && typeof val === "object" && Array.isArray((val as any).models)) {
					const models = (val as any).models.map((m: any) => ({
						id: m.id || m.name,
						name: m.name || m.id,
						provider: providerId,
					}));

					if (!providerMap.has(providerId)) {
						providerMap.set(providerId, {
							id: providerId,
							name: providerId,
							isConfigured: true,
							models,
						});
					} else if (providerMap.get(providerId)!.models.length === 0) {
						providerMap.get(providerId)!.models = models;
					}
				}
			}
		}
	} catch {}

	// 3. Inspect ~/.pi/agent/auth.json (Configured provider credentials)
	try {
		const authPath = join(homedir(), ".pi", "agent", "auth.json");
		if (existsSync(authPath)) {
			const authData = JSON.parse(readFileSync(authPath, "utf8"));
			for (const providerId of Object.keys(authData)) {
				if (!providerMap.has(providerId)) {
					providerMap.set(providerId, {
						id: providerId,
						name: providerId,
						isConfigured: true,
						models: [],
					});
				} else {
					providerMap.get(providerId)!.isConfigured = true;
				}
			}
		}
	} catch {}

	// 4. Add known standard providers if not present (marked as standard option)
	const standardProviders = ["anthropic", "openai", "openrouter", "google", "ollama"];
	for (const std of standardProviders) {
		if (!providerMap.has(std)) {
			providerMap.set(std, {
				id: std,
				name: std,
				isConfigured: false,
				models: [],
			});
		}
	}

	// Sort: configured providers first, then alphabetical
	return Array.from(providerMap.values()).sort((a, b) => {
		if (a.isConfigured !== b.isConfigured) return a.isConfigured ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
}

/**
 * Interactive model picker:
 * 1. Shows configured providers list.
 * 2. On provider selection, shows recommended models for that tier/role.
 * 3. Returns the normalized model string e.g. "opencode-go/gpt-6-luna" or "anthropic/claude-sonnet-4".
 */
export async function promptModelForRole(
	ctx: ExtensionContext,
	roleLabel: string,
	tier: "director" | "workhorse" | "lightweight",
	currentValue?: string,
): Promise<string | undefined> {
	if (!ctx.hasUI || typeof (ctx.ui as any)?.select !== "function") {
		return currentValue;
	}

	const providers = await getAvailableProviders(ctx);

	// ── Paso 1: Seleccionar Proveedor ──
	const providerOptions: string[] = [];
	for (const p of providers) {
		const badge = p.isConfigured ? "✨ [Configurado]" : "🌐";
		const countStr = p.models.length > 0 ? ` (${p.models.length} modelos)` : "";
		providerOptions.push(`${badge} ${p.name}${countStr}`);
	}
	providerOptions.push("🔄 Modo 'inherit' (Usar modelo de la sesión activa de Pi)");
	providerOptions.push("✏️ Escribir modelo personalizado manualmente...");

	const promptTitle = currentValue
		? `${roleLabel} (Actual: ${currentValue}) — Paso 1: Selecciona Proveedor`
		: `${roleLabel} — Paso 1: Selecciona Proveedor`;

	const pickedProvider = await promptSelectSafe(ctx, promptTitle, providerOptions);
	if (!pickedProvider) return undefined;

	// Check inherit
	if (pickedProvider.label.includes("Modo 'inherit'")) {
		return "inherit";
	}

	// Check manual input
	if (pickedProvider.label.includes("Escribir modelo personalizado")) {
		return await promptInputSafe(ctx, `Introduce el modelo para ${roleLabel}:`, currentValue || "openai/gpt-4o");
	}

	const selectedProviderObj = providers[pickedProvider.index];
	const providerId = selectedProviderObj.id;

	// ── Paso 2: Seleccionar Modelo del Proveedor ──
	const recommended = getRecommendedList(selectedProviderObj, tier);
	const modelOptions: string[] = [
		...recommended.map((m) => `⭐ ${m}`),
		`📋 Ver todos los modelos de ${providerId}`,
		`✏️ Escribir otro modelo de ${providerId}...`,
	];

	const pickedModel = await promptSelectSafe(
		ctx,
		`${roleLabel} — Paso 2: Modelos recomendados para [${providerId}]`,
		modelOptions,
	);
	if (!pickedModel) return undefined;

	// Submenu: Ver todos los modelos
	if (pickedModel.label.startsWith("📋 Ver todos")) {
		if (selectedProviderObj.models.length > 0) {
			const allModelOptions = selectedProviderObj.models.map((m) => m.id);
			allModelOptions.push("✏️ Escribir otro modelo...");
			const allPick = await promptSelectSafe(
				ctx,
				`Todos los modelos de ${providerId} (${selectedProviderObj.models.length}):`,
				allModelOptions,
			);
			if (!allPick) return undefined;
			if (allPick.label.startsWith("✏️ Escribir")) {
				const custom = await promptInputSafe(ctx, `Modelo de ${providerId}:`, "");
				return formatModelId(providerId, custom);
			}
			return formatModelId(providerId, allPick.label);
		} else {
			const custom = await promptInputSafe(ctx, `Nombre del modelo de ${providerId}:`, "");
			return formatModelId(providerId, custom);
		}
	}

	// Submenu: Escribir otro modelo de este proveedor
	if (pickedModel.label.startsWith("✏️ Escribir")) {
		const custom = await promptInputSafe(ctx, `Introduce el ID del modelo para ${providerId}:`, "");
		return formatModelId(providerId, custom);
	}

	// Selected from recommended
	const selectedRecModel = recommended[pickedModel.index];
	return formatModelId(providerId, selectedRecModel);
}

function getRecommendedList(
	provider: DiscoveredProvider,
	tier: "director" | "workhorse" | "lightweight",
): string[] {
	// 1. Check known specific recommendations
	const known = KNOWN_PROVIDER_RECOMMENDATIONS[provider.id]?.[tier];
	if (known && known.length > 0) {
		// Filter against provider's actual models if available
		if (provider.models.length > 0) {
			const availableIds = new Set(provider.models.map((m) => m.id.toLowerCase()));
			const exactMatches = known.filter((k) => availableIds.has(k.toLowerCase()));
			if (exactMatches.length > 0) return exactMatches;
		} else {
			return known;
		}
	}

	// 2. If provider has models in store, categorize dynamically
	if (provider.models.length > 0) {
		const dynamic = filterModelsByRole(provider.models.map((m) => m.id), tier);
		if (dynamic.length > 0) return dynamic.slice(0, 6);
		return provider.models.slice(0, 5).map((m) => m.id);
	}

	// 3. Fallback generic
	if (tier === "director") return ["gpt-4o", "claude-sonnet-4", "gemini-2.5-pro"];
	if (tier === "workhorse") return ["gpt-oss-120b:free", "gpt-4o-mini", "claude-3-5-sonnet"];
	return ["gpt-oss-20b:free", "gpt-4o-mini", "llama3.2"];
}

function filterModelsByRole(
	modelIds: string[],
	tier: "director" | "workhorse" | "lightweight",
): string[] {
	if (tier === "director") {
		return modelIds.filter((id) =>
			/max|pro|opus|sonnet|o3|gpt-6|gpt-5|k3|r1/i.test(id) && !/flash|mini/i.test(id),
		);
	}
	if (tier === "workhorse") {
		return modelIds.filter((id) =>
			/code|coder|pro|plus|120b|70b|sonnet|gpt-4/i.test(id) && !/flash-lite/i.test(id),
		);
	}
	// lightweight
	return modelIds.filter((id) =>
		/flash|mini|haiku|free|20b|8b|3b|spark|lite/i.test(id),
	);
}

function formatModelId(provider: string, modelId: string): string {
	const trimmed = modelId.trim();
	if (!trimmed) return provider;
	if (trimmed.startsWith(`${provider}/`)) return trimmed;
	if (trimmed.includes("/")) return trimmed; // already has provider
	return `${provider}/${trimmed}`;
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
