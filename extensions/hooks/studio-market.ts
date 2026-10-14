import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { promptInputSafe } from "./studio-setup.ts";
import {
	RESET,
	BOLD,
	DIM,
	BORDER,
	ACCENT,
	SECONDARY,
	HEADING,
	GREEN,
	YELLOW,
	RED,
	WHITE,
	GRAY,
	padAnsi,
	truncateAnsi,
} from "./studio-palette.ts";

export type SaturationLevel =
	| "Baja"
	| "Moderada"
	| "Alta"
	| "Saturación Extrema";

export type MarketVerdict =
	| "RECHAZADO: CEMENTERIO DE STEAM"
	| "PIVOTE OBLIGATORIO"
	| "LUZ VERDE";

export interface SteamSearchItem {
	id: number;
	name: string;
	price?: {
		currency: string;
		initial: number;
		final: number;
	};
	type: string;
}

export interface SteamSearchResult {
	total: number;
	items: SteamSearchItem[];
}

export interface SteamCompetitor {
	id: number;
	name: string;
	steamUrl: string;
	ratingDesc: string;
	ratingPercent: number | null;
	totalReviews: number;
	priceFormatted: string;
	isReleased: boolean;
	genres: string[];
}

export interface MarketMetrics {
	competitorCount: number;
	competitorCountFormatted: string;
	saturationLevel: SaturationLevel;
	verdict: MarketVerdict;
	priceRange: string;
	releasedCount: number;
	upcomingCount: number;
	avgReviewsTop: number;
	maxReviewsTop: number;
}

export interface MarketAnalysis {
	query: string;
	metrics: MarketMetrics;
	competitors: SteamCompetitor[];
	ceroFiltro: {
		tropesCritique: string;
		mandatoryHook: string;
	};
	isOfflineFallback?: boolean;
}

/**
 * Executes a native fetch with a strict 5-second AbortController timeout.
 */
async function fetchWithTimeout<T>(url: string, timeoutMs = 5000): Promise<T | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(url, { signal: controller.signal });
		if (!res.ok) return null;
		return (await res.json()) as T;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Searches the live Steam Store catalog for games matching the given term.
 * First queries the primary Steam store search engine (returns accurate total catalog counts and top games),
 * then falls back to storesearch API if needed.
 */
export async function searchSteamCompetitors(query: string, timeoutMs = 5000): Promise<SteamSearchResult | null> {
	try {
		const searchUrl = `https://store.steampowered.com/search/results/?query&start=0&count=10&term=${encodeURIComponent(query)}&infinite=1`;
		const searchData = await fetchWithTimeout<{ success?: number; total_count?: number; results_html?: string }>(searchUrl, timeoutMs);
		if (searchData && typeof searchData.total_count === "number" && searchData.results_html) {
			const items: SteamSearchItem[] = [];
			const regex = /data-ds-appid="(\d+)"[\s\S]*?<span class="title">([^<]+)<\/span>/g;
			let m: RegExpExecArray | null;
			while ((m = regex.exec(searchData.results_html)) !== null && items.length < 10) {
				items.push({
					id: parseInt(m[1], 10),
					name: m[2].trim(),
					type: "app",
				});
			}
			if (items.length > 0 || searchData.total_count > 0) {
				return {
					total: searchData.total_count,
					items,
				};
			}
		}
	} catch {}

	const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(query)}&l=english&cc=US`;
	return fetchWithTimeout<SteamSearchResult>(url, timeoutMs);
}

/**
 * Inspects local project files to discover an existing pitch, genre, or title.
 */
export function inspectProjectForPitch(rootDir: string): string | null {
	// 1. Inspect design/gdd/concept.md
	const conceptPath = join(rootDir, "design", "gdd", "concept.md");
	if (existsSync(conceptPath)) {
		try {
			const content = readFileSync(conceptPath, "utf8");
			const pitchMatch = content.match(/(?:pitch|fantas[ií]a|concepto|genre|g[eé]nero)[:\s]+([^\n\r]+)/i);
			if (pitchMatch && pitchMatch[1].trim()) {
				return pitchMatch[1].trim().replace(/^["'`*#]+|["'`*#]+$/g, "").trim();
			}
			const titleMatch = content.match(/^#\s+(.+)$/m);
			if (titleMatch && titleMatch[1].trim()) {
				return titleMatch[1].trim().replace(/^["'`*#]+|["'`*#]+$/g, "").trim();
			}
		} catch {}
	}

	// 2. Inspect design/gdd/*.md
	const gddDir = join(rootDir, "design", "gdd");
	if (existsSync(gddDir)) {
		try {
			const files = readdirSync(gddDir).filter((f) => f.endsWith(".md"));
			for (const file of files) {
				const filePath = join(gddDir, file);
				const content = readFileSync(filePath, "utf8");
				const pitchMatch = content.match(/(?:pitch|fantas[ií]a|concepto|genre|g[eé]nero)[:\s]+([^\n\r]+)/i);
				if (pitchMatch && pitchMatch[1].trim()) {
					return pitchMatch[1].trim().replace(/^["'`*#]+|["'`*#]+$/g, "").trim();
				}
			}
		} catch {}
	}

	// 3. Inspect production/roadmap.md
	const roadmapPath = join(rootDir, "production", "roadmap.md");
	if (existsSync(roadmapPath)) {
		try {
			const content = readFileSync(roadmapPath, "utf8");
			const nicheMatch = content.match(/nicho\s*\(([^,)]+)/i);
			if (nicheMatch && nicheMatch[1].trim()) {
				return nicheMatch[1].trim();
			}
			const gameMatch = content.match(/Juego:\s*([^\n\r(]+)/i);
			if (gameMatch && gameMatch[1].trim()) {
				return gameMatch[1].trim();
			}
		} catch {}
	}

	return null;
}

/**
 * Calculates saturation level and estimated catalog count.
 */
export function calculateSaturationAndCount(
	query: string,
	rawTotal: number,
	itemsCount: number,
	maxReviews: number,
): { saturation: SaturationLevel; effectiveCount: number; displayCount: string } {
	const lower = query.toLowerCase();

	const isExtremelySaturated =
		lower.includes("roguelike") ||
		lower.includes("deckbuilder") ||
		lower.includes("metroidvania") ||
		lower.includes("soulslike") ||
		lower.includes("survival crafting") ||
		lower.includes("bullet heaven") ||
		lower.includes("battle royale");

	const isModeratelySaturated =
		lower.includes("colony") ||
		lower.includes("citybuilder") ||
		lower.includes("puzzle") ||
		lower.includes("tower defense") ||
		lower.includes("turn-based") ||
		lower.includes("card");

	// Steam storesearch returns batches capped at 10 items
	if (itemsCount >= 10) {
		if (isExtremelySaturated || maxReviews > 10000) {
			return {
				saturation: "Saturación Extrema",
				effectiveCount: 1250,
				displayCount: "> 1.000+",
			};
		}
		if (isModeratelySaturated || maxReviews > 1000) {
			return {
				saturation: "Alta",
				effectiveCount: 480,
				displayCount: "> 450+",
			};
		}
		return {
			saturation: "Moderada",
			effectiveCount: 150,
			displayCount: "> 100+",
		};
	}

	if (itemsCount >= 5) {
		return {
			saturation: "Moderada",
			effectiveCount: rawTotal,
			displayCount: `${rawTotal}`,
		};
	}

	return {
		saturation: "Baja",
		effectiveCount: rawTotal,
		displayCount: `${rawTotal}`,
	};
}

/**
 * Determines the market verdict based on competitor volume, reviews, and genre saturation.
 */
export function determineVerdict(
	saturation: SaturationLevel,
	effectiveCount: number,
	maxReviews: number,
	query: string,
): MarketVerdict {
	const lower = query.toLowerCase();
	const isGenericTrope =
		(lower.includes("deckbuilder") && !lower.includes("pinball") && !lower.includes("pachinko") && !lower.includes("golf")) ||
		(lower.includes("metroidvania") && !lower.includes("puzzle") && !lower.includes("comedy")) ||
		(lower.includes("soulslike") && !lower.includes("cozy")) ||
		(lower.includes("survival") && lower.includes("crafting"));

	if (saturation === "Saturación Extrema" || (saturation === "Alta" && isGenericTrope) || effectiveCount >= 1000) {
		return "RECHAZADO: CEMENTERIO DE STEAM";
	}

	if (saturation === "Alta" || saturation === "Moderada") {
		return "PIVOTE OBLIGATORIO";
	}

	return "LUZ VERDE";
}

/**
 * Generates direct gamedev executive critique ("Cero Filtro") and mandatory USP.
 */
export function generateCeroFiltro(query: string, saturation: SaturationLevel) {
	const lower = query.toLowerCase();

	let tropesCritique = "";
	let mandatoryHook = "";

	if (lower.includes("deckbuilder") || lower.includes("cartas") || lower.includes("card")) {
		tropesCritique =
			"Si lanzas otro deckbuilder de fantasía oscura con maná por turno y 3 cartas iniciales de ataque/defensa, tu juego morirá con 12 reviews (10 de amigos y 2 de streamers bots). Slay the Spire, Balatro y Monster Train ya coparon el espacio de cartas estándar. Competir contra ellos sin una mecánica física o giro adictivo es suicidio comercial.";
		mandatoryHook =
			"Tu gancho mecánico (USP) debe ser un sistema analógico intuitivo que cualquier persona entienda en un GIF de 2 segundos (como Balatro con las manos de póker o Peglin con el pachinko). Introduce física real, control espacial o una economía de riesgo exponencial donde el jugador rompa las reglas matemáticas.";
	} else if (lower.includes("metroidvania") || lower.includes("soulslike") || lower.includes("souls")) {
		tropesCritique =
			"Lanzar otro metroidvania 2D de píxeles sombríos con esquiva rodando, parry y santuarios de descanso es regalar los $100 de Steam Direct a Valve. Compites de frente contra Hollow Knight, Blasphemous y miles de proyectos idénticos invisibles que no superan 50 copias vendidas.";
		mandatoryHook =
			"Reemplaza el combate genérico de espada por una interacción ambiental no violenta o una física de movimiento radical (ej. Animal Well y su uso de juguetes, o Celeste y su micro-precisión). La diferenciación debe radicar en la fantasía sensorial y en puzles de escala macro.";
	} else if (lower.includes("survival") || lower.includes("crafting") || lower.includes("supervivencia")) {
		tropesCritique =
			"El cementerio de Steam está pavimentado con juegos de supervivencia abandonados en Early Access donde el bucle es golpear árboles con una piedra para construir una choza. El algoritmo de Steam no te dará ni 100 impresiones orgánicas si ese es tu core loop.";
		mandatoryHook =
			"Diseña una amenaza existencial asimétrica o un entorno reactivo dinámico. El crafting debe automatizarse o tener propósito narrativo urgente, no ser relleno de inventario para estirar horas de juego artificialmente.";
	} else if (lower.includes("colony") || lower.includes("city") || lower.includes("sim") || lower.includes("gestión")) {
		tropesCritique =
			"Los jugadores de simulación y gestión son los más analíticos y exigentes de PC: penalizan de inmediato con reviews negativas la falta de profundidad sistémica, las UIs engorrosas y las caídas de FPS a partir de 200 agentes activos en pantalla.";
		mandatoryHook =
			"Enfócate en la generación emergente de historias y dilemas morales irrepetibles (al estilo RimWorld o Frostpunk). El gancho debe responder de inmediato: ¿cuál es la crisis existencial única que ninguna otra ciudad o colonia del mercado enfrenta?";
	} else if (lower.includes("bullet heaven") || lower.includes("vampire") || lower.includes("survivors") || lower.includes("horde")) {
		tropesCritique =
			"El nicho de 'auto-shooters / bullet heaven' quedó saturado en tiempo récord con cientos de títulos a $2.99 USD. Lanzar otro juego con experiencia de gemas y cofres de 3 mejoras es estrellarse contra un muro de indiferencia.";
		mandatoryHook =
			"Requiere hibridación agresiva: añade elementos tácticos por turnos, físicas de deformación de terreno o un control vehicular directo donde la inercia sea parte integral del desafío.";
	} else if (lower.includes("platformer") || lower.includes("plataformas") || lower.includes("pixel")) {
		tropesCritique =
			"Los plataformeros de acción 2D pixel art representan la categoría más difícil de monetizar en todo el ecosistema indie. Sin un gancho instantáneo, la prensa y los streamers no abrirán tu correo y los compradores no mirarán el trailer.";
		mandatoryHook =
			"Necesitas un '3-Second Hook' visualmente evidente: manipulación del tiempo, rebobinado dimensional, o gravedad reversible. Si necesitas 30 segundos de trailer para que alguien entienda qué lo hace único, el juego comercialmente no existe.";
	} else {
		tropesCritique =
			`Steam recibe más de 40 lanzamientos diarios. Si tu proyecto se resume como "una carta de amor a los clásicos" o un juego genérico de ${query}, el algoritmo de Valve te enterrará en la página 40 el día del lanzamiento. La nostalgia sola ya no es un modelo de negocio viable.`;
		mandatoryHook =
			"Define un gancho central claro: 1 mecánica central insólita que nadie más tenga, legibilidad gráfica instantánea a 231x87 píxeles (cápsula de Steam) y una propuesta de valor streamer-friendly que despierte curiosidad en los primeros 5 minutos de gameplay.";
	}

	return { tropesCritique, mandatoryHook };
}

/**
 * Analyzes search results and fetches details & reviews for top competitors.
 */
export async function analyzeSteamMarket(
	query: string,
	searchResult: SteamSearchResult | null,
): Promise<MarketAnalysis> {
	if (!searchResult || searchResult.items.length === 0) {
		const isOffline = !searchResult;
		const total = searchResult?.total || 0;
		const { saturation, displayCount } = isOffline
			? {
					saturation: (query.toLowerCase().includes("deckbuilder") ||
					query.toLowerCase().includes("metroidvania") ||
					query.toLowerCase().includes("soulslike") ||
					query.toLowerCase().includes("roguelike")
						? "Alta"
						: "Moderada") as SaturationLevel,
					displayCount: "Sin conexión (estimado)",
			  }
			: calculateSaturationAndCount(query, total, 0, 0);

		const verdict = isOffline
			? (saturation === "Alta" ? "RECHAZADO: CEMENTERIO DE STEAM" : "PIVOTE OBLIGATORIO")
			: determineVerdict(saturation, total, 0, query);

		const ceroFiltro = generateCeroFiltro(query, saturation);

		return {
			query,
			metrics: {
				competitorCount: total,
				competitorCountFormatted: displayCount,
				saturationLevel: saturation,
				verdict,
				priceRange: isOffline ? "Modo offline (sin conexión a Steam)" : "Sin competidores comerciales indexados",
				releasedCount: 0,
				upcomingCount: 0,
				avgReviewsTop: 0,
				maxReviewsTop: 0,
			},
			competitors: [],
			ceroFiltro,
			isOfflineFallback: isOffline,
		};
	}

	const topItems = searchResult.items.slice(0, 5);

	// Concurrent fetch for details and reviews of top competitors (bounded with 5s timeout & cc=US)
	const competitorPromises = topItems.map(async (item) => {
		const [detailsRes, reviewsRes] = await Promise.all([
			fetchWithTimeout<any>(
				`https://store.steampowered.com/api/appdetails?appids=${item.id}&cc=US`,
				5000,
			),
			fetchWithTimeout<any>(
				`https://store.steampowered.com/appreviews/${item.id}?json=1&num_per_page=0`,
				5000,
			),
		]);

		const appData = detailsRes?.[item.id]?.data;
		const querySummary = reviewsRes?.query_summary;

		// Format price in USD
		let priceFormatted = "Precio no listado";
		let priceCents: number | null = null;
		if (appData?.is_free) {
			priceFormatted = "Free to Play";
			priceCents = 0;
		} else if (appData?.price_overview?.final_formatted) {
			priceFormatted = appData.price_overview.final_formatted;
			priceCents = appData.price_overview.final || null;
		} else if (item.price?.final !== undefined) {
			priceFormatted = `$${(item.price.final / 100).toFixed(2)} USD`;
			priceCents = item.price.final;
		}

		// Format reviews & score
		const totalReviews = querySummary?.total_reviews || 0;
		const totalPositive = querySummary?.total_positive || 0;
		let ratingPercent: number | null = null;
		let ratingDesc = "Sin reviews suficientes";

		if (totalReviews > 0) {
			ratingPercent = Math.round((totalPositive / totalReviews) * 100);
			const desc = querySummary.review_score_desc || "Positivo";
			ratingDesc = `${desc} (${ratingPercent}%)`;
		} else if (querySummary?.review_score_desc) {
			ratingDesc = querySummary.review_score_desc;
		}

		const isReleased = appData?.release_date ? !appData.release_date.coming_soon : true;
		const genres: string[] = (appData?.genres || []).map((g: any) => g.description || "");

		const competitor: SteamCompetitor = {
			id: item.id,
			name: item.name || `App ${item.id}`,
			steamUrl: `https://store.steampowered.com/app/${item.id}`,
			ratingDesc,
			ratingPercent,
			totalReviews,
			priceFormatted,
			isReleased,
			genres,
		};

		return { competitor, priceCents };
	});

	const competitorResults = await Promise.all(competitorPromises);
	const competitors = competitorResults.map((r) => r.competitor);

	// Metric aggregations
	const rawTotal = searchResult.total;
	const reviewCounts = competitors.map((c) => c.totalReviews);
	const maxReviews = reviewCounts.length > 0 ? Math.max(...reviewCounts) : 0;
	const avgReviews = reviewCounts.length > 0 ? Math.round(reviewCounts.reduce((a, b) => a + b, 0) / reviewCounts.length) : 0;

	const { saturation, effectiveCount, displayCount } = calculateSaturationAndCount(
		query,
		rawTotal,
		searchResult.items.length,
		maxReviews,
	);

	const releasedCount = competitors.filter((c) => c.isReleased).length;
	const upcomingCount = competitors.filter((c) => !c.isReleased).length;

	// Price range calculation
	const validPrices = competitorResults
		.map((r) => r.priceCents)
		.filter((p): p is number => p !== null && p > 0);

	let priceRange = "Variable ($9.99 - $19.99 USD estimado)";
	if (validPrices.length > 0) {
		const minP = Math.min(...validPrices);
		const maxP = Math.max(...validPrices);
		const minFormatted = `$${(minP / 100).toFixed(2)}`;
		const maxFormatted = `$${(maxP / 100).toFixed(2)} USD`;
		if (minP === maxP) {
			priceRange = `${minFormatted} USD`;
		} else {
			priceRange = `${minFormatted} - ${maxFormatted}`;
		}
		if (competitorResults.some((r) => r.priceCents === 0)) {
			priceRange = `Free to Play / ${priceRange}`;
		}
	}

	const verdict = determineVerdict(saturation, effectiveCount, maxReviews, query);
	const ceroFiltro = generateCeroFiltro(query, saturation);

	return {
		query,
		metrics: {
			competitorCount: effectiveCount,
			competitorCountFormatted: displayCount,
			saturationLevel: saturation,
			verdict,
			priceRange,
			releasedCount,
			upcomingCount,
			avgReviewsTop: avgReviews,
			maxReviewsTop: maxReviews,
		},
		competitors,
		ceroFiltro,
	};
}

/**
 * Wraps text into lines not exceeding maxWidth characters.
 */
export function wrapText(text: string, maxWidth: number): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if (!word) continue;
		if (!currentLine) {
			currentLine = word;
		} else if (currentLine.length + 1 + word.length <= maxWidth) {
			currentLine += " " + word;
		} else {
			lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

/**
 * Formats numbers with comma separators.
 */
function formatNumber(num: number): string {
	return num.toLocaleString("en-US");
}

/**
 * Renders the Steam Reality Check report card using studio-palette colors and box drawings.
 */
export function renderMarketReport(analysis: MarketAnalysis, cardWidth = 76): string[] {
	const lines: string[] = [];
	const width = Math.max(68, cardWidth);
	const innerWidth = width - 4;
	const { metrics, competitors, ceroFiltro, query } = analysis;

	// Verdict badge and colors
	let verdictColored = "";
	if (metrics.verdict === "RECHAZADO: CEMENTERIO DE STEAM") {
		verdictColored = `${RED}${BOLD}[RECHAZADO: CEMENTERIO DE STEAM]${RESET}`;
	} else if (metrics.verdict === "PIVOTE OBLIGATORIO") {
		verdictColored = `${YELLOW}${BOLD}[PIVOTE OBLIGATORIO]${RESET}`;
	} else {
		verdictColored = `${GREEN}${BOLD}[LUZ VERDE]${RESET}`;
	}

	// Saturation badge and colors
	let satColored = "";
	if (metrics.saturationLevel === "Saturación Extrema") {
		satColored = `${RED}${BOLD}Saturación Extrema${RESET}`;
	} else if (metrics.saturationLevel === "Alta") {
		satColored = `${RED}Alta${RESET}`;
	} else if (metrics.saturationLevel === "Moderada") {
		satColored = `${YELLOW}Moderada${RESET}`;
	} else {
		satColored = `${GREEN}Baja${RESET}`;
	}

	lines.push("");

	// ── 1. Steam Reality Check Header Box ──
	const titlePrefix = "STEAM REALITY CHECK: ";
	const maxTitleLen = width - titlePrefix.length - 8;
	const cleanTitle = truncateAnsi(query, maxTitleLen);
	const headerTitle = `${ACCENT}${BOLD}${titlePrefix}${RESET}${WHITE}${BOLD}${cleanTitle}${RESET}`;
	const headerBorderLen = Math.max(0, width - 4 - cleanTitle.length - titlePrefix.length);

	lines.push(`${BORDER}┌──${RESET} ${headerTitle} ${BORDER}${"─".repeat(headerBorderLen)}┐${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`Veredicto: ${verdictColored}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(
		`${BORDER}│${RESET} ${padAnsi(
			`Competencia: ${WHITE}${metrics.competitorCountFormatted}${RESET} juegos indexados en la tienda de Steam (${satColored})`,
			innerWidth,
		)} ${BORDER}│${RESET}`,
	);
	lines.push(
		`${BORDER}│${RESET} ${padAnsi(
			`Rango de Precios: ${GREEN}${metrics.priceRange}${RESET} ${GRAY}•${RESET} ${WHITE}${metrics.releasedCount}${RESET} ${GRAY}lanzados${RESET}, ${WHITE}${metrics.upcomingCount}${RESET} ${GRAY}próximos en el top${RESET}`,
			innerWidth,
		)} ${BORDER}│${RESET}`,
	);
	lines.push(`${BORDER}└${"─".repeat(width - 2)}┘${RESET}`);

	// ── 2. Top Competitor Matrix ──
	lines.push("");
	const matrixHeader = `${SECONDARY}${BOLD}MATRIZ DE COMPETIDORES DIRECTOS EN STEAM (TOP RELEVANTES)${RESET}`;
	const matrixBorderLen = Math.max(0, width - 60);
	lines.push(`${BORDER}┌─${RESET} ${matrixHeader} ${BORDER}${"─".repeat(matrixBorderLen)}┐${RESET}`);

	if (competitors.length === 0) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}No se encontraron competidores indexados directamente.${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	} else {
		for (let i = 0; i < competitors.length; i++) {
			const c = competitors[i];
			const numBadge = `${SECONDARY}${BOLD}[${i + 1}]${RESET}`;
			const nameTrunc = truncateAnsi(c.name, 36);
			const rowHeader = `  ${numBadge} ${WHITE}${BOLD}${nameTrunc}${RESET} ${GRAY}(AppID: ${c.id})${RESET}  ${GREEN}${c.priceFormatted}${RESET}`;
			lines.push(`${BORDER}│${RESET} ${padAnsi(rowHeader, innerWidth)} ${BORDER}│${RESET}`);

			const statusBadge = c.isReleased ? `${GREEN}Lanzado${RESET}` : `${YELLOW}Próximo${RESET}`;
			const reviewRow = `      ${GRAY}Rating:${RESET} ${WHITE}${c.ratingDesc}${RESET}  ${GRAY}•${RESET}  ${WHITE}${formatNumber(c.totalReviews)}${RESET} ${GRAY}reviews${RESET}  ${GRAY}•${RESET}  ${statusBadge}`;
			lines.push(`${BORDER}│${RESET} ${padAnsi(reviewRow, innerWidth)} ${BORDER}│${RESET}`);

			const linkRow = `      ${GRAY}Enlace:${RESET} ${GRAY}${c.steamUrl}${RESET}`;
			lines.push(`${BORDER}│${RESET} ${padAnsi(linkRow, innerWidth)} ${BORDER}│${RESET}`);

			if (i < competitors.length - 1) {
				lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${BORDER}${"┄".repeat(innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
			}
		}
	}
	lines.push(`${BORDER}└${"─".repeat(width - 2)}┘${RESET}`);

	// ── 3. Cero Filtro (Análisis Implacable de Dirección) ──
	lines.push("");
	const filtroHeader = `${RED}${BOLD}CERO FILTRO (ANÁLISIS IMPLACABLE DE DIRECCIÓN)${RESET}`;
	const filtroBorderLen = Math.max(0, width - 50);
	lines.push(`${BORDER}┌─${RESET} ${filtroHeader} ${BORDER}${"─".repeat(filtroBorderLen)}┐${RESET}`);

	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${RED}${BOLD}CRÍTICA DE TROPOS GENÉRICOS:${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const critiqueLines = wrapText(ceroFiltro.tropesCritique, innerWidth - 6);
	for (const cl of critiqueLines) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`    ${GRAY}${cl}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${YELLOW}${BOLD}GANCHO MECÁNICO DIFERENCIADOR (USP OBLIGATORIO):${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const hookLines = wrapText(ceroFiltro.mandatoryHook, innerWidth - 6);
	for (const hl of hookLines) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`    ${WHITE}${hl}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}└${"─".repeat(width - 2)}┘${RESET}`);

	// ── 4. Próximos Pasos ──
	lines.push("");
	const nextHeader = `${HEADING}${BOLD}PRÓXIMOS PASOS RECOMENDADOS${RESET}`;
	const nextBorderLen = Math.max(0, width - 33);
	lines.push(`${BORDER}┌─${RESET} ${nextHeader} ${BORDER}${"─".repeat(nextBorderLen)}┐${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}[1]${RESET} Definir pilares de diseño y ancla visual única    ${ACCENT}→ /concept${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}[2]${RESET} Diseñar la mecánica de gancho en Live Spec viva   ${ACCENT}→ /spec${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}[3]${RESET} Fijar límites técnicos y presupuestos de FPS      ${ACCENT}→ /arch${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}[4]${RESET} Abrir el Hub y catálogo general de Pi Game Studio ${ACCENT}→ /studio${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}└${"─".repeat(width - 2)}┘${RESET}`);
	lines.push("");

	return lines;
}

/**
 * Main command handler for /market and /studio:market.
 */
export async function handleStudioMarket(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	let query = (args || "").trim();

	// If argument is missing, inspect local project or prompt user
	if (!query) {
		const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
		const candidate = inspectProjectForPitch(rootDir);
		const defaultPromptValue = candidate || "roguelike deckbuilder";

		query = await promptInputSafe(
			ctx,
			"Ingresa el pitch o idea del juego para auditar en Steam:",
			defaultPromptValue,
		);
	}

	if (!query) {
		query = "roguelike deckbuilder";
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(`Auditoría de mercado en Steam para: "${query}"...`, "info");
	}

	// Fetch live Steam Store catalog
	const searchResult = await searchSteamCompetitors(query);
	const analysis = await analyzeSteamMarket(query, searchResult);

	const termWidth = process.stdout.columns || 80;
	const reportLines = renderMarketReport(analysis, Math.min(termWidth, 80));

	for (const line of reportLines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const notifyType =
			analysis.metrics.verdict === "RECHAZADO: CEMENTERIO DE STEAM"
				? "error"
				: analysis.metrics.verdict === "PIVOTE OBLIGATORIO"
				? "warning"
				: "info";

		(ctx.ui as any).notify(
			`[Steam Reality Check] ${analysis.metrics.verdict}: ${analysis.metrics.saturationLevel} (${analysis.metrics.competitorCountFormatted} juegos)`,
			notifyType,
		);
	}
}
