// Studio Palette — Unified Nordic & Sober GameDev Theme
// Inspired by Gentle Shell's sober aesthetic, tuned with Midnight Amethyst & Glacial Cyan for Pi Game Studio

export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

// Primary Accents
export const ACCENT = "\x1b[38;2;167;139;250m";     // #A78BFA — Soft Amethyst / Violet (Brand core)
export const SECONDARY = "\x1b[38;2;103;232;249m";  // #67E8F9 — Glacial Cyan / Tech Blue
export const HEADING = "\x1b[38;2;196;181;253m";    // #C4B5FD — Light Lavender heading

// Status & Semantic Colors (Soft, desaturated pastel tones)
export const GREEN = "\x1b[38;2;167;243;208m";      // #A7F3D0 — Soft Sage / Mint Green (Success)
export const YELLOW = "\x1b[38;2;253;230;138m";     // #FDE68A — Warm Soft Gold / Amber (Warning)
export const RED = "\x1b[38;2;244;114;182m";        // #F472B6 — Soft Rose / Crimson (Error)

// Neutrals & Surface
export const WHITE = "\x1b[38;2;243;244;246m";      // #F3F4F6 — Pearl White / Clean text
export const GRAY = "\x1b[38;2;107;114;128m";       // #6B7280 — Muted Slate Gray
export const BORDER = "\x1b[38;2;49;51;66m";        // #313342 — Subtle dark card border

/**
 * Truncates a string containing ANSI escape codes while preserving color formatting
 * and calculating length strictly based on visible character count.
 */
export function truncateAnsi(str: string, maxLen: number): string {
	const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
	if (visibleLen <= maxLen) return str;

	let visibleCount = 0;
	let result = "";
	let i = 0;
	while (i < str.length) {
		if (str[i] === "\x1b") {
			const m = str.slice(i).match(/^\x1b\[[0-9;]*m/);
			if (m) {
				result += m[0];
				i += m[0].length;
				continue;
			}
		}
		if (visibleCount < maxLen - 1) {
			result += str[i];
			visibleCount++;
			i++;
		} else {
			result += `…${RESET}`;
			break;
		}
	}
	return result;
}

/**
 * Right-pads an ANSI-formatted string up to the specified visible length.
 */
export function padAnsi(str: string, len: number): string {
	const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
	return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
}

// ──────────────────────────────────────────────
// Command Palette Categories & Registry
// ──────────────────────────────────────────────

export type CommandCategory =
	| "ODD Pipeline"
	| "Engine & Dev Tools"
	| "Studio & Models"
	| "Media & MCP";

export const PALETTE_CATEGORIES = [
	"All",
	"ODD Pipeline",
	"Engine & Dev Tools",
	"Studio & Models",
	"Media & MCP",
] as const;

export interface StudioCommandItem {
	name: string;
	description: string;
	category: CommandCategory;
	shortcut?: string;
}

export const STUDIO_COMMAND_REGISTRY: StudioCommandItem[] = [
	// ODD Pipeline (6 Skills + Market)
	{
		name: "/market",
		description: "[Mercado] Steam Reality Check, saturación del género y viabilidad comercial",
		category: "ODD Pipeline",
	},
	{
		name: "/concept",
		description: "[Fase 1] Visión, pilares de diseño, anti-pilares y ancla visual",
		category: "ODD Pipeline",
	},
	{
		name: "/spec",
		description: "[Fase 2] Live Specs vivas y diseño mecánico en design/gdd/<feature>.md",
		category: "ODD Pipeline",
	},
	{
		name: "/arch",
		description: "[Fase 3] ADRs de arquitectura, límites técnicos y presupuestos de FPS/Memoria",
		category: "ODD Pipeline",
	},
	{
		name: "/code",
		description: "[Fase 4] Implementación pura en motor idiomático (~400 líneas atómicas)",
		category: "ODD Pipeline",
	},
	{
		name: "/test",
		description: "[Fase 5] Quality gates, smoke tests, detección de fugas y triaje QA",
		category: "ODD Pipeline",
	},
	{
		name: "/ship",
		description: "[Fase 6] Empaquetado final, changelog de release y publicación de builds",
		category: "ODD Pipeline",
	},
	{
		name: "/steam-page",
		description: "Generador de ficha de Steamworks en BBCode oficial desde el GDD",
		category: "ODD Pipeline",
	},

	// Engine & Dev Tools
	{
		name: "/doctor",
		description: "Diagnóstico profundo de toolchains, compiladores y motores instalados",
		category: "Engine & Dev Tools",
	},
	{
		name: "/watch",
		description: "Compilación reactiva en vivo y comprobación de sintaxis en segundo plano",
		category: "Engine & Dev Tools",
	},
	{
		name: "/profile",
		description: "Perfilador de rendimiento de bucle de juego y presupuestos de tiempo de frame",
		category: "Engine & Dev Tools",
	},
	{
		name: "/perf-guard",
		description: "Auditoría estática de alocaciones y llamadas bloqueantes en bucles de frame",
		category: "Engine & Dev Tools",
	},
	{
		name: "/web",
		description: "Compilar a WebAssembly y servir localmente con headers COOP/COEP",
		category: "Engine & Dev Tools",
	},
	{
		name: "/tasks",
		description: "Explorador y gestor interactivo de tareas del roadmap activo",
		category: "Engine & Dev Tools",
	},
	{
		name: "/changes",
		description: "Resumen de cambios no commiteados y detección de drift de diseño",
		category: "Engine & Dev Tools",
	},
	{
		name: "/scaffold",
		description: "Sandbox jugable inmediato según motor activo (Godot/Bevy/Raylib en 2D/3D)",
		category: "Engine & Dev Tools",
	},
	{
		name: "/game-feel",
		description: "Auditor estático de Game Feel y respuesta de control (5 pilares)",
		category: "Engine & Dev Tools",
	},
	{
		name: "/audio-bus",
		description: "Jerarquía de buses de audio profesionales con ducking (Master, Music, SFX)",
		category: "Engine & Dev Tools",
	},

	// Studio & Models
	{
		name: "/studio",
		description: "Hub principal y catálogo interactivo de Pi Game Studio",
		category: "Studio & Models",
	},
	{
		name: "/studio:start",
		description: "Asistente interactivo de bienvenida y orientación del proyecto",
		category: "Studio & Models",
	},
	{
		name: "/studio:setup",
		description: "Instalación y actualización de los 9 agentes oficiales (8 Core + 1 Motor)",
		category: "Studio & Models",
	},
	{
		name: "/studio:new",
		description: "Crear nuevo juego desde plantilla o starter oficial (Bevy, Godot, Raylib)",
		category: "Studio & Models",
	},
	{
		name: "/studio:models",
		description: "Configuración interactiva de modelos LLM por nivel o agente",
		category: "Studio & Models",
	},
	{
		name: "/studio:status",
		description: "Panel de estado del estudio, motor activo y salud del proyecto",
		category: "Studio & Models",
	},
	{
		name: "/studio:agents",
		description: "Explorador y directorio de agentes activos de Pi Game Studio",
		category: "Studio & Models",
	},
	{
		name: "/studio:chains",
		description: "Ejecutor de flujos multi-agente guiados (GDD Review, Feature, Release)",
		category: "Studio & Models",
	},
	{
		name: "/studio:subagents",
		description: "Visor interactivo y monitor de telemetría de subagentes en ejecución",
		category: "Studio & Models",
	},
	{
		name: "/studio:settings",
		description: "Gestión interactiva de motor activo, idioma y preferencias globales",
		category: "Studio & Models",
	},
	{
		name: "/studio:sound",
		description: "Ajuste de alertas sonoras y chiptunes retro sintetizados de 8 bits",
		category: "Studio & Models",
	},
	{
		name: "/studio:art",
		description: "Alternar ilustración Braille nórdica en banner de bienvenida",
		category: "Studio & Models",
	},
	{
		name: "/studio:help",
		description: "Manual de referencia rápida y documentación de comandos",
		category: "Studio & Models",
	},

	// Media & MCP
	{
		name: "/studio:mcp",
		description: "Hub de servidores MCP (Context7, Engram, Blender, Godot, REA)",
		category: "Media & MCP",
	},
	{
		name: "/studio:tools",
		description: "Diagnóstico e instalador de herramientas CLI multimedia (FFmpeg, Assimp, SoX)",
		category: "Media & MCP",
	},
	{
		name: "/studio:assets",
		description: "Auditoría de assets, texturas, optimización oxipng y límites de modelos 3D",
		category: "Media & MCP",
	},
	{
		name: "/studio:sfx",
		description: "Sintetizador procedural de efectos de sonido WAV (chiptune, retro, UI)",
		category: "Media & MCP",
	},
	{
		name: "/studio:palettes",
		description: "Generador de paletas de color retro y cuantizadores para Godot y Raylib",
		category: "Media & MCP",
	},
	{
		name: "/capsule-check",
		description: "Auditor de portadas y cápsulas de Steamworks (231x87, 460x215) con ImageMagick",
		category: "Media & MCP",
	},
];

// ──────────────────────────────────────────────
// Fuzzy Matching Algorithm with Subsequence Bonuses
// ──────────────────────────────────────────────

export interface FuzzyMatchResult {
	matches: boolean;
	score: number;
	indices: number[];
}

/**
 * Calculates a fuzzy subsequence match score between pattern and text with rich bonuses:
 * - Prefix match bonus (+40)
 * - Word boundary bonus (+30) on delimiters: space, '/', ':', '-', '_', '.'
 * - CamelCase transition bonus (+25)
 * - Exact case match bonus (+10)
 * - Consecutive match streak bonus (+15 * streak)
 * - Full match bonus (+100)
 */
export function fuzzyMatch(pattern: string, text: string): FuzzyMatchResult {
	if (!pattern) {
		return { matches: true, score: 0, indices: [] };
	}

	const pLen = pattern.length;
	const tLen = text.length;

	if (pLen > tLen) {
		return { matches: false, score: 0, indices: [] };
	}

	const pLower = pattern.toLowerCase();
	const tLower = text.toLowerCase();

	let pIdx = 0;
	let tIdx = 0;
	const indices: number[] = [];
	let score = 0;
	let consecutive = 0;

	while (pIdx < pLen && tIdx < tLen) {
		if (pLower[pIdx] === tLower[tIdx]) {
			indices.push(tIdx);
			let charScore = 10;

			// Prefix bonus
			if (tIdx === 0) {
				charScore += 40;
			}

			// Word boundary bonus: preceded by delimiter (/ : - _ . or whitespace)
			if (tIdx > 0 && /[\s\/:_\.\-]/.test(text[tIdx - 1])) {
				charScore += 30;
			}

			// CamelCase transition bonus
			if (tIdx > 0 && /[a-z]/.test(text[tIdx - 1]) && /[A-Z]/.test(text[tIdx])) {
				charScore += 25;
			}

			// Exact case match bonus
			if (pattern[pIdx] === text[tIdx]) {
				charScore += 10;
			}

			// Consecutive match bonus
			if (consecutive > 0) {
				charScore += 15 * consecutive;
			}
			consecutive++;

			score += charScore;
			pIdx++;
			tIdx++;
		} else {
			consecutive = 0;
			tIdx++;
		}
	}

	// Did not match all characters of pattern in order
	if (pIdx < pLen) {
		return { matches: false, score: 0, indices: [] };
	}

	// Full exact match bonus
	if (pLower === tLower) {
		score += 100;
	}

	return { matches: true, score, indices };
}

/**
 * Highlights matched indices in text using ANSI colors.
 */
export function highlightMatch(
	text: string,
	indices: number[],
	highlightColor: string = SECONDARY,
	resetColor: string = RESET,
): string {
	if (!indices || indices.length === 0) return text;
	const indexSet = new Set(indices);
	let result = "";
	for (let i = 0; i < text.length; i++) {
		if (indexSet.has(i)) {
			result += `${highlightColor}${BOLD}${text[i]}${resetColor}`;
		} else {
			result += text[i];
		}
	}
	return result;
}

/**
 * Filters the command registry given a search query and category.
 * Returns matching commands sorted by descending match score.
 */
export function filterCommands(
	query: string,
	category: string = "All",
	registry: StudioCommandItem[] = STUDIO_COMMAND_REGISTRY,
): Array<StudioCommandItem & { score: number; indices: number[] }> {
	const trimmed = query.trim();
	const baseList =
		category === "All"
			? registry
			: registry.filter((c) => c.category === category);

	if (!trimmed) {
		return baseList.map((c) => ({ ...c, score: 0, indices: [] }));
	}

	const results: Array<StudioCommandItem & { score: number; indices: number[] }> = [];

	for (const cmd of baseList) {
		const nameMatch = fuzzyMatch(trimmed, cmd.name);
		const descMatch = fuzzyMatch(trimmed, cmd.description);

		if (nameMatch.matches) {
			results.push({
				...cmd,
				score: nameMatch.score + 50, // Higher weight for command name matches
				indices: nameMatch.indices,
			});
		} else if (descMatch.matches) {
			results.push({
				...cmd,
				score: descMatch.score,
				indices: descMatch.indices,
			});
		}
	}

	results.sort((a, b) => b.score - a.score);
	return results;
}
