// Studio Palette — Unified Nordic & Sober GameDev Theme
// Inspired by Gentle Shell's sober aesthetic, tuned with Midnight Amethyst & Glacial Cyan for Pi Game Studio

/** NO_COLOR disables every escape: the studio must not impose its palette. */
const colorEnabled = !process.env.NO_COLOR;

export const RESET = colorEnabled ? "\x1b[0m" : "";
export const BOLD = colorEnabled ? "\x1b[1m" : "";
export const DIM = colorEnabled ? "\x1b[2m" : "";

/** True when the terminal should receive colour at all. */
export const COLORS_ENABLED = colorEnabled;

/**
 * Builds a colour escape from a computed RGB triple. The only sanctioned way to
 * interpolate colours (gradients): the invariant forbids the escape sequence
 * anywhere else, so a dynamic colour cannot drift from this module either.
 */
export function rgbEscape(r: number, g: number, b: number): string {
	return colorEnabled ? `\x1b[38;2;${r};${g};${b}m` : "";
}

/** Interpolates between two roles, returning the escape for the position requested. */
export function gradientEscape(from: number[], to: number[], t: number): string {
	const clamp = Math.max(0, Math.min(1, t));
	const r = Math.round(from[0] + (to[0] - from[0]) * clamp);
	const g = Math.round(from[1] + (to[1] - from[1]) * clamp);
	const b = Math.round(from[2] + (to[2] - from[2]) * clamp);
	return rgbEscape(r, g, b);
}

// ─── Roles ────────────────────────────────────────────────────────────────────
// Hierarchy comes from BRIGHTNESS, not from hue: body text is the brightest
// thing on screen, states sit below it, borders recede. One accent only.
//
//   text 83%  ·  states 69-76%  ·  muted 56%  ·  faint 36%  ·  borders 25%

// Surfaces & text
export const TEXT = colorEnabled ? "\x1b[38;2;200;204;212m" : ""; // #C8CCD4 body
export const WHITE = TEXT; // legacy name
export const HEADING = colorEnabled ? "\x1b[38;2;216;220;227m" : ""; // #D8DCE3 titles, one step above body
export const MUTED = colorEnabled ? "\x1b[38;2;122;130;144m" : ""; // #7A8290 labels, units
export const GRAY = MUTED; // legacy name
export const FAINT = colorEnabled ? "\x1b[38;2;74;80;92m" : ""; // #4A505C separators, placeholders
export const BORDER = colorEnabled ? "\x1b[38;2;51;54;63m" : ""; // #33363F frames

// Brand: a single slate-blue accent. SECONDARY is the same family, quieter, so
// structure can be distinguished from focus without introducing a second hue.
export const ACCENT = colorEnabled ? "\x1b[38;2;122;147;201m" : ""; // #7A93C9
export const SECONDARY = colorEnabled ? "\x1b[38;2;147;163;190m" : ""; // #93A3BE
export const CYAN = SECONDARY; // legacy name

// States
export const SUCCESS = colorEnabled ? "\x1b[38;2;127;176;138m" : ""; // #7FB08A sage
export const GREEN = SUCCESS; // legacy name
export const WARNING = colorEnabled ? "\x1b[38;2;194;161;94m" : ""; // #C2A15E muted gold
export const YELLOW = WARNING; // legacy name
export const ERROR = colorEnabled ? "\x1b[38;2;192;115;110m" : ""; // #C0736E clay
export const RED = ERROR; // legacy name

// ─── Theme integration (issue #52, slice 3, option A+B) ───────────────────────
// A: semantic roles resolve through Pi's theme when a theme handle exists.
// B: the studio keeps its brand accent, but as a HUE with two luminances, not
// one fixed hex — the dark-terminal luminance stays #7A93C9; on a light
// terminal the same hue is darkened so body text and accent clear 4.5:1.

/** Same hue as #7A93C9, darkened until it clears WCAG 4.5:1 on white (the base measures 3.07:1, which fails). */
export const BRAND_LIGHT = "#5C6E97";
/** A dark neutral body colour for light terminals: #C8CCD4 measures 1.6:1 on white, which fails. */
export const TEXT_LIGHT = "#2F333A";

/** Converts a #RRGGBB literal into the module's sanctioned RGB escape (empty under NO_COLOR). */
function hexEscape(hex: string): string {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return "";
	return rgbEscape(parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16));
}

/** Semantic colour roles a render callback can use instead of the fixed palette exports. */
export interface StudioThemeRoles {
	success: (text: string) => string;
	error: (text: string) => string;
	warn: (text: string) => string;
	muted: (text: string) => string;
	accent: (text: string) => string;
	text: (text: string) => string;
	faint: (text: string) => string;
}

/**
 * Resolves the studio's semantic colour roles against Pi's theme handle.
 * Every returned function is total: no theme, a theme without `fg`, or a
 * throwing `fg` falls back to the studio palette instead of throwing.
 */
export function resolveStudioTheme(piTheme?: any): StudioThemeRoles {
	const hasFg = typeof piTheme?.fg === "function";
	// A throwing `fg` falls back to the studio palette wrap, not to bare text.
	const token = (name: string, fallback: string, text: string): string => {
		if (!hasFg) return fallback;
		try {
			return piTheme.fg(name, text);
		} catch {
			return fallback;
		}
	};
	const isLight = piTheme?.appearance === "light";
	const plain = (colour: string, text: string): string => `${colour}${text}${RESET}`;
	return {
		success: (text) => token("success", plain(SUCCESS, text), text),
		error: (text) => token("error", plain(ERROR, text), text),
		warn: (text) => token("warning", plain(WARNING, text), text),
		muted: (text) => token("dim", plain(MUTED, text), text),
		// The brand NEVER routes through the theme token — this keeps the studio's identity.
		accent: (text) => plain(isLight ? hexEscape(BRAND_LIGHT) : ACCENT, text),
		text: (text) => plain(isLight ? hexEscape(TEXT_LIGHT) : TEXT, text),
		// Decoration, not text: stays on the studio palette even with a live theme.
		faint: (text) => plain(FAINT, text),
	};
}

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
	{
		name: "/feature",
		description: "Generador guiado de Live Specs ODD en design/gdd/ con desglose T1-TN",
		category: "ODD Pipeline",
	},
	{
		name: "/next",
		description: "Continuidad fluida y handoff de la siguiente tarea atómica en cola ODD",
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
	{
		name: "/tuning",
		description: "Calibrador interactivo de variables de balance y Game Feel en YAML",
		category: "Engine & Dev Tools",
	},
	{
		name: "/play",
		description: "Runner unificado de ejecución supervisada y previsualización del motor",
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
