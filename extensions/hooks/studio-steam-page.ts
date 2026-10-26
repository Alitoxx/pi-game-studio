import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, basename, dirname, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { writeFileAtomicSync } from "./studio-fs.ts";
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
	panelBottom,
	panelRule,
	panelRow,
	panelTop,
} from "./studio-palette.ts";

export interface ConceptData {
	title: string;
	genre: string;
	platform: string;
	elevatorPitch: string;
	coreFantasy: string;
	uniqueHook: string;
	pillars: string[];
	antiPillars: string[];
	targetAudience: string;
	comparables: string[];
	contentFlags: string[];
	sourceFile?: string;
}

export interface SteamPageCopy {
	shortDescription: string;
	shortDescLength: number;
	shortDescPass: boolean;
	detailedBbCode: string;
	keyFeatures: Array<{ verb: string; description: string }>;
	matureContentOutline: string;
	fullMarkdownDoc: string;
}

/**
 * Extracts structured concept data from GDD markdown files or project.yaml.
 */
export function extractConceptData(rootDir: string, customFilePath?: string): ConceptData {
	let targetFile: string | null = null;

	if (customFilePath && customFilePath.trim()) {
		const candidate = resolve(rootDir, customFilePath.trim());
		if (existsSync(candidate)) targetFile = candidate;
	}

	if (!targetFile) {
		const candidateFiles = [
			join(rootDir, "design", "gdd", "concept.md"),
			join(rootDir, "design", "concept.md"),
			join(rootDir, "design", "gdd", "index.md"),
			join(rootDir, "design", "gdd", "gameplay.md"),
		];
		for (const cand of candidateFiles) {
			if (existsSync(cand)) {
				targetFile = cand;
				break;
			}
		}
	}

	// Try scanning any .md in design/gdd/
	if (!targetFile) {
		const gddDir = join(rootDir, "design", "gdd");
		if (existsSync(gddDir)) {
			try {
				const files = readdirSync(gddDir).filter((f) => f.endsWith(".md"));
				if (files.length > 0) {
					targetFile = join(gddDir, files[0]);
				}
			} catch {}
		}
	}

	let title = "My Steam Title";
	let genre = "Acción / Roguelike";
	let platform = "PC (Steam / Windows / Linux)";
	let elevatorPitch = "";
	let coreFantasy = "";
	let uniqueHook = "";
	const pillars: string[] = [];
	const antiPillars: string[] = [];
	let targetAudience = "Jugadores entusiastas de PC y Steam";
	const comparables: string[] = [];
	const contentFlags: string[] = [];

	// Inspect project.yaml if present for base defaults
	const projectYaml = join(rootDir, "project.yaml");
	if (existsSync(projectYaml)) {
		try {
			const yaml = readFileSync(projectYaml, "utf8");
			const nameMatch = yaml.match(/^name:\s*["']?([^\n"']+)["']?/m);
			if (nameMatch && nameMatch[1]) title = nameMatch[1].trim();
			const genreMatch = yaml.match(/^genre:\s*["']?([^\n"']+)["']?/m);
			if (genreMatch && genreMatch[1]) genre = genreMatch[1].trim();
		} catch {}
	}

	if (targetFile && existsSync(targetFile)) {
		try {
			const content = readFileSync(targetFile, "utf8");

			// Extract title
			const titleMatch = content.match(/^#\s+(?:Game Concept:\s*)?([^\n#]+)/m);
			if (titleMatch && titleMatch[1]) {
				const raw = titleMatch[1].trim();
				if (!raw.includes("[Working Title]")) title = raw;
			}

			// Extract Elevator Pitch
			const pitchMatch = content.match(/##\s+Elevator Pitch\s*([\s\S]*?)(?=\n##|\n---|$)/i);
			if (pitchMatch && pitchMatch[1]) {
				const clean = pitchMatch[1]
					.replace(/^>\s*/gm, "")
					.replace(/\[.*?\]/g, "")
					.trim();
				if (clean.length > 10) elevatorPitch = clean;
			}

			// Extract Core Fantasy
			const fantasyMatch = content.match(/##\s+Core Fantasy\s*([\s\S]*?)(?=\n##|\n---|$)/i);
			if (fantasyMatch && fantasyMatch[1]) {
				const clean = fantasyMatch[1].replace(/\[.*?\]/g, "").trim();
				if (clean.length > 10) coreFantasy = clean;
			}

			// Extract Unique Hook
			const hookMatch = content.match(/##\s+Unique Hook\s*([\s\S]*?)(?=\n##|\n---|$)/i);
			if (hookMatch && hookMatch[1]) {
				const clean = hookMatch[1].replace(/\[.*?\]/g, "").trim();
				if (clean.length > 10) uniqueHook = clean;
			}

			// Extract Genre & Core Identity table
			const genreTableMatch = content.match(/\*\*Genre\*\*\s*\|\s*([^|\n]+)/i);
			if (genreTableMatch && genreTableMatch[1]) {
				const clean = genreTableMatch[1].replace(/\[.*?\]/g, "").trim();
				if (clean.length > 2) genre = clean;
			}

			// Extract Pillars
			const pillarSectionMatch = content.match(/##\s+(?:Core Pillars|Pilares)[^\n]*\s*([\s\S]*?)(?=\n##|\n---|$)/i);
			if (pillarSectionMatch && pillarSectionMatch[1]) {
				const pMatches = pillarSectionMatch[1].matchAll(/###?\s+(?:Pillar\s*\d+:?\s*)?([^\n]+)/gi);
				for (const m of pMatches) {
					const pName = m[1].replace(/\[.*?\]/g, "").trim();
					if (pName && !pName.toLowerCase().includes("anti-pilar")) {
						pillars.push(pName);
					}
				}
				const bulletMatches = pillarSectionMatch[1].matchAll(/^[-*]\s+\*\*([^*]+)\*\*/gm);
				for (const b of bulletMatches) {
					const bName = b[1].trim();
					if (bName && !pillars.includes(bName)) pillars.push(bName);
				}
			}

			// Extract Anti-Pillars
			const antiMatch = content.match(/(?:Anti-Pillars|Anti-Pilares)[\s\S]*?(?=\n##|\n---|$)/i);
			if (antiMatch) {
				const bMatches = antiMatch[0].matchAll(/^[-*]\s+([^\n]+)/gm);
				for (const b of bMatches) {
					antiPillars.push(b[1].replace(/\[.*?\]/g, "").trim());
				}
			}
		} catch {}
	}

	// Fallbacks if concept doc was sparse or missing
	if (!elevatorPitch) {
		elevatorPitch = `Un vertiginoso título de ${genre} donde cada decisión forja tu destino y la precisión táctica separa la supervivencia del colapso total.`;
	}
	if (!coreFantasy) {
		coreFantasy = `Sentir la adrenalina de superar desafíos implacables dominando mecánicas reactivas, sinergias dinámicas y un control milimétrico.`;
	}
	if (!uniqueHook) {
		uniqueHook = `Sistemas de juego entrelazados con ritmo implacable donde cada partida ofrece recompensas genuinas a la habilidad del jugador.`;
	}
	if (pillars.length === 0) {
		pillars.push("Control Milimétrico & Game Feel Reactivo");
		pillars.push("Decisiones Tácticas con Repercusión Inmediata");
		pillars.push("Rejugabilidad Orgánica Sin Relleno Artificial");
	}

	return {
		title,
		genre,
		platform,
		elevatorPitch,
		coreFantasy,
		uniqueHook,
		pillars,
		antiPillars,
		targetAudience,
		comparables,
		contentFlags,
		sourceFile: targetFile || undefined,
	};
}

/**
 * Truncates short description cleanly at sentence or word boundary under maxChars (default 295, hard cap 300).
 */
export function formatShortDescription(text: string, maxChars = 295): string {
	const cleaned = text.replace(/\s+/g, " ").trim();
	if (cleaned.length <= maxChars) return cleaned;

	// Try breaking at last sentence under maxChars
	const sub = cleaned.slice(0, maxChars);
	const lastSentenceEnd = Math.max(sub.lastIndexOf(". "), sub.lastIndexOf("! "), sub.lastIndexOf("? "));
	if (lastSentenceEnd > 180) {
		return sub.slice(0, lastSentenceEnd + 1).trim();
	}

	// Otherwise break at last word boundary
	const lastSpace = sub.lastIndexOf(" ");
	if (lastSpace > 160) {
		return sub.slice(0, lastSpace).trim() + "...";
	}

	return sub.trim();
}

/**
 * Generates official Steam Store copy and BBCode formatted text.
 */
export function generateSteamStorePage(concept: ConceptData): SteamPageCopy {
	// 1. Short Description (CRITICAL: Steam limit is strictly 300 characters, ideal 240-285 chars)
	// Hook formula: [Setting/Identity] + [Core Gameplay Verb] + [Unique Stakes/Twist]
	const rawShort = `${concept.title} es un intenso juego de ${concept.genre}. Domina un combate táctico implacable, forja sinergias letales y desentraña misterios ocultos en cada partida antes de que sea demasiado tarde.`;
	const shortDescription = formatShortDescription(rawShort, 290);
	const shortDescLength = shortDescription.length;
	const shortDescPass = shortDescLength <= 300;

	// 2. Active Verbs for Key Features
	const activeVerbs = ["DOMINA", "FORJA", "SOBREVIVE", "EXPLORA", "DESAFÍA", "CONQUISTA"];
	const keyFeatures: Array<{ verb: string; description: string }> = [];

	if (concept.pillars.length > 0) {
		concept.pillars.slice(0, 5).forEach((pillar, idx) => {
			const verb = activeVerbs[idx % activeVerbs.length];
			keyFeatures.push({
				verb,
				description: `${pillar}: mecánicas diseñadas para recompensar el ingenio táctico y la ejecución impecable.`,
			});
		});
	}

	if (keyFeatures.length < 4) {
		keyFeatures.push({
			verb: "ADAPTA",
			description: "Evoluciona tu equipamiento y estilo de juego con cada derrota para desatar combinaciones imparables.",
		});
		keyFeatures.push({
			verb: "DESCUBRE",
			description: "Desvela secretos profundos, rutas alternativas y encuentros ocultos que desafiarán a los más veteranos.",
		});
	}

	// 3. Official Steam BBCode: About This Game
	const bbCodeLines: string[] = [];

	bbCodeLines.push(`[b][i]"${concept.elevatorPitch}"[/i][/b]`);
	bbCodeLines.push("");
	bbCodeLines.push(`[img]{STEAM_APP_IMAGE}/extras/banner_about.png[/img]`);
	bbCodeLines.push("");
	bbCodeLines.push(`[h2]EL MUNDO Y LA AMENAZA[/h2]`);
	bbCodeLines.push(
		`En [b]${concept.title}[/b], te adentras en una experiencia implacable donde el margen de error es cero. ${concept.coreFantasy}. Cada rincón esconde peligros mortales y decisiones que alterarán el curso de tu expedición.`,
	);
	bbCodeLines.push("");
	bbCodeLines.push(`[h2]GAMEPLAY & MECÁNICAS CENTRALES[/h2]`);
	bbCodeLines.push(
		`Diseñado con un enfoque obsesivo en el [b]Game Feel[/b], la reactividad de controles y la profundidad estratégica. ${concept.uniqueHook}.`,
	);
	bbCodeLines.push("");
	bbCodeLines.push(`[img]{STEAM_APP_IMAGE}/extras/banner_features.png[/img]`);
	bbCodeLines.push("");
	bbCodeLines.push(`[h2]CARACTERÍSTICAS PRINCIPALES[/h2]`);
	bbCodeLines.push(`[list]`);
	for (const kf of keyFeatures) {
		bbCodeLines.push(`[*] [b]${kf.verb}[/b]: ${kf.description}`);
	}
	bbCodeLines.push(`[/list]`);
	bbCodeLines.push("");
	bbCodeLines.push(`[h2]REJUGABILIDAD Y PROGRESIÓN[/h2]`);
	bbCodeLines.push(
		`Ninguna partida es idéntica a la anterior. Desbloquea modificadores de dificultad, desafíos secundarios y sinergias secretas creadas para poner a prueba tu dominio absoluto del sistema.`,
	);

	const detailedBbCode = bbCodeLines.join("\n");

	// 4. Maturity & Content Disclosure Outline
	const matureLines: string[] = [];
	matureLines.push(`### Declaración de Contenido para Adultos (Steamworks Content Survey)`);
	matureLines.push(`Los desarrolladores describen el contenido de la siguiente manera:`);
	matureLines.push(`- **Violencia Fantástica / Combate**: Contiene escenas de acción intensa, impactos mecánicos y efectos de daño estilizados.`);
	matureLines.push(`- **Temática Oscura**: Atmósfera de tensión psicológica y peligro constante.`);
	matureLines.push(`- **Advertencia de Fotosensibilidad**: Incluye efectos visuales rápidos, destellos de partículas y contrastes lumínicos intensos.`);
	const matureContentOutline = matureLines.join("\n");

	// 5. Build Full Output Markdown Document
	const fullDocLines: string[] = [];
	fullDocLines.push(`# Steam Store Page Copy: ${concept.title}`);
	fullDocLines.push(``);
	fullDocLines.push(`> Generado automáticamente por Pi Game Studio (/steam-page).`);
	fullDocLines.push(`> Fuente de diseño: \`${concept.sourceFile || "Valores base del proyecto"}\``);
	fullDocLines.push(``);
	fullDocLines.push(`---`);
	fullDocLines.push(``);
	fullDocLines.push(`## 1. Short Description (Descripción Corta)`);
	fullDocLines.push(`**Límite oficial de Steamworks:** 300 caracteres | **Longitud actual:** ${shortDescLength} caracteres ${shortDescPass ? "(VALIDADO)" : "(EXCEDIDO)"}`);
	fullDocLines.push(``);
	fullDocLines.push(`\`\`\`text`);
	fullDocLines.push(shortDescription);
	fullDocLines.push(`\`\`\``);
	fullDocLines.push(``);
	fullDocLines.push(`---`);
	fullDocLines.push(``);
	fullDocLines.push(`## 2. About This Game (Acerca de este juego — Código BBCode Oficial)`);
	fullDocLines.push(`*Copia y pega directamente este bloque en la pestaña "Store Page > Description" en el portal de Steamworks:*`);
	fullDocLines.push(``);
	fullDocLines.push(`\`\`\`bbcode`);
	fullDocLines.push(detailedBbCode);
	fullDocLines.push(`\`\`\``);
	fullDocLines.push(``);
	fullDocLines.push(`---`);
	fullDocLines.push(``);
	fullDocLines.push(`## 3. Key Features con Verbos Activos`);
	for (const kf of keyFeatures) {
		fullDocLines.push(`- **${kf.verb}**: ${kf.description}`);
	}
	fullDocLines.push(``);
	fullDocLines.push(`---`);
	fullDocLines.push(``);
	fullDocLines.push(`## 4. Maturity & Content Disclosure`);
	fullDocLines.push(matureContentOutline);
	fullDocLines.push(``);
	fullDocLines.push(`---`);
	fullDocLines.push(``);
	fullDocLines.push(`## 5. Checklist de Optimización Steam Store (Art Director & Producer)`);
	fullDocLines.push(`- [ ] **Short Description** optimizada con gancho claro y sin relleno.`);
	fullDocLines.push(`- [ ] **Cápsula pequeña (231x87)** testeada y legible con \`/capsule-check\`.`);
	fullDocLines.push(`- [ ] **Imágenes de sección ([img])** subidas al backend de Steamworks en \`extras/\`.`);
	fullDocLines.push(`- [ ] **Trailer 1 (Gameplay puro)** muestra el loop jugable en los primeros 5 segundos.`);
	fullDocLines.push(`- [ ] **Tags de género** seleccionados en Steamworks (Top 5 definen el algoritmo de similares).`);

	const fullMarkdownDoc = fullDocLines.join("\n");

	return {
		shortDescription,
		shortDescLength,
		shortDescPass,
		detailedBbCode,
		keyFeatures,
		matureContentOutline,
		fullMarkdownDoc,
	};
}

/**
 * Renders an ANSI formatted preview of the generated Steam page in terminal.
 */
export function renderSteamPagePreview(
	concept: ConceptData,
	page: SteamPageCopy,
	outPath: string,
	termWidth = 80,
): string[] {
	const width = Math.max(76, Math.min(termWidth, 96));
	const innerWidth = width - 4;
	const lines: string[] = [];

	lines.push("");
	lines.push(panelTop(width - 2, undefined, "square", BORDER));
	lines.push(
		`${panelRow(`${ACCENT}${BOLD}STEAM STORE PAGE GENERATOR & COPY PREVIEW${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Metadata
	const srcLabel = concept.sourceFile ? basename(concept.sourceFile) : "Auto-sintetizado";
	lines.push(
		`${panelRow(`  ${DIM}Título:${RESET} ${WHITE}${concept.title}${RESET} ${DIM}│ Género:${RESET} ${SECONDARY}${concept.genre}${RESET} ${DIM}│ Fuente:${RESET} ${GRAY}${srcLabel}${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Short Description Preview
	const charStatus = page.shortDescPass
		? `${GREEN}[PASS: ${page.shortDescLength}/300 chars]${RESET}`
		: `${RED}[EXCEDIDO: ${page.shortDescLength}/300 chars]${RESET}`;

	lines.push(
		`${panelRow(`${HEADING}SHORT DESCRIPTION (Gancho de conversión en tienda):${RESET} ${charStatus}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(
		`${panelRow(`  ${WHITE}"${page.shortDescription}"${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Key Features Preview
	lines.push(
		`${panelRow(`${HEADING}KEY FEATURES (Verbos Activos de Jugabilidad):${RESET}`, innerWidth + 2, BORDER)}`,
	);
	for (const kf of page.keyFeatures) {
		const line = `  ${SECONDARY}${kf.verb}${RESET} ${DIM}│${RESET} ${GRAY}${truncateAnsi(kf.description, innerWidth - 16)}${RESET}`;
		lines.push(`${panelRow(line, innerWidth + 2, BORDER)}`);
	}
	lines.push(panelRule(width - 2, "square", BORDER));

	// BBCode Snapshot
	lines.push(
		`${panelRow(`${HEADING}BBCODE GENERADO PARA STEAMWORKS ("About This Game"):${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(
		`${panelRow(`  ${GRAY}[h2]EL MUNDO Y LA AMENAZA[/h2] ... [list][*] [b]DOMINA[/b]...[/list]${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(
		`${panelRow(`  ${DIM}Etiquetas aplicadas: [h2], [b], [list], [*], [i], [img]${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Save confirmation
	lines.push(
		`${panelRow(`${GREEN}[GUARDADO EXITOSO]${RESET} Documento completo exportado a:`, innerWidth + 2, BORDER)}`,
	);
	lines.push(
		`${panelRow(`  ${WHITE}${outPath}${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelBottom(width - 2, "square", BORDER));
	lines.push("");

	return lines;
}

/**
 * Main command handler for /steam-page and /studio:steam-page.
 */
export async function handleStudioSteamPage(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const customFilePath = (args || "").trim();

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify("Generando copy oficial y BBCode para Steam Store...", "info");
	}

	const concept = extractConceptData(rootDir, customFilePath);
	const pageCopy = generateSteamStorePage(concept);

	// Ensure production/ folder exists
	const prodDir = join(rootDir, "production");
	try {
		mkdirSync(prodDir, { recursive: true });
	} catch {}

	const targetPath = join(prodDir, "steam_store_page.md");
	writeFileAtomicSync(targetPath, pageCopy.fullMarkdownDoc, "utf8");

	const relTarget = relative(rootDir, targetPath);
	const termWidth = process.stdout.columns || 80;
	const previewLines = renderSteamPagePreview(concept, pageCopy, relTarget, termWidth);

	for (const line of previewLines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(
			`Steam Store Page guardada en ${relTarget} (${pageCopy.shortDescLength}/300 chars)`,
			"info",
		);
	}
}
