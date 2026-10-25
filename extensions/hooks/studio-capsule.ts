import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join, resolve, basename, extname, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import {
	RESET,
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

/**
 * Official Steamworks Store Asset Specifications.
 * Reference: Steamworks Documentation — Store Assets & Capsules
 */
export interface SteamCapsuleSpec {
	id: string;
	name: string;
	width: number;
	height: number;
	aspectRatioStr: string;
	aspectRatio: number;
	critical: boolean;
	importance: string;
	description: string;
	steamworksRole: string;
}

export const STEAM_CAPSULE_SPECS: Record<string, SteamCapsuleSpec> = {
	header: {
		id: "header",
		name: "Header Capsule",
		width: 460,
		height: 215,
		aspectRatioStr: "460 x 215 (~2.14:1)",
		aspectRatio: 460 / 215,
		critical: false,
		importance: "Alta",
		description: "Imagen primaria en búsquedas de Steam, paquetes de productos y ofertas destacadas diarias.",
		steamworksRole: "Store Search & Daily Deals",
	},
	small: {
		id: "small",
		name: "Small Capsule",
		width: 231,
		height: 87,
		aspectRatioStr: "231 x 87 (~2.65:1)",
		aspectRatio: 231 / 87,
		critical: true,
		importance: "CRÍTICA (CTR Core)",
		description: "Determina el CTR en listas de búsqueda, recomendaciones del algoritmo y cuadrículas de rebajas de Steam.",
		steamworksRole: "Search Lists, Sales Grids & Algorithm Recommendations",
	},
	main: {
		id: "main",
		name: "Main Capsule",
		width: 616,
		height: 353,
		aspectRatioStr: "616 x 353 (~1.75:1)",
		aspectRatio: 616 / 353,
		critical: false,
		importance: "Alta",
		description: "Aparece en carruseles principales de la tienda (sección 'Destacados y recomendados').",
		steamworksRole: "Featured & Recommended Carousel",
	},
	vertical: {
		id: "vertical",
		name: "Vertical Capsule",
		width: 374,
		height: 448,
		aspectRatioStr: "374 x 448 (~1:1.20)",
		aspectRatio: 374 / 448,
		critical: false,
		importance: "Media-Alta",
		description: "Portada vertical para la biblioteca del jugador, listas de categorías y páginas de franquicia.",
		steamworksRole: "Steam Library & Portrait Store Grids",
	},
	hero: {
		id: "hero",
		name: "Page Background / Hero",
		width: 1920,
		height: 620,
		aspectRatioStr: "1920 x 620 (~3.10:1)",
		aspectRatio: 1920 / 620,
		critical: false,
		importance: "Media",
		description: "Banner panorámico superior decorativo en la página oficial de compra del juego.",
		steamworksRole: "Store Page Header Hero Banner",
	},
};

export type MatchStatus = "exact" | "proportional" | "mismatch";

export interface CapsuleAuditItem {
	filePath: string;
	relPath: string;
	fileName: string;
	fileSizeBytes: number;
	fileSizeFormatted: string;
	width: number;
	height: number;
	aspectRatio: number;
	matchedSpec: SteamCapsuleSpec;
	matchStatus: MatchStatus;
	diffWidth: number;
	diffHeight: number;
	legibility?: {
		contrastPercent: number;
		luminancePercent: number;
		rating: "excelente" | "adecuado" | "bajo" | "extremo";
		comment: string;
	};
}

export interface CapsuleAuditSummary {
	targetFiles: CapsuleAuditItem[];
	missingSpecs: SteamCapsuleSpec[];
	hasMagick: boolean;
	magickBinary: string | null;
}

/**
 * Checks if ImageMagick is installed and available in PATH.
 */
export function detectMagickBinary(): string | null {
	try {
		execSync("magick -version", { stdio: "ignore", timeout: 2000 });
		return "magick";
	} catch {}
	try {
		execSync("identify -version", { stdio: "ignore", timeout: 2000 });
		return "identify";
	} catch {}
	return null;
}

/**
 * Extracts width and height directly from image binary headers (PNG, JPEG, GIF, WEBP)
 * as a robust zero-dependency fallback when ImageMagick is not available.
 */
export function extractBinaryDimensions(filePath: string): { width: number; height: number } | null {
	try {
		const fd = readFileSync(filePath);
		if (fd.length < 16) return null;

		// 1. PNG Header: \x89PNG\r\n\x1a\n
		if (fd[0] === 0x89 && fd[1] === 0x50 && fd[2] === 0x4e && fd[3] === 0x47) {
			if (fd.length >= 24) {
				const width = fd.readUInt32BE(16);
				const height = fd.readUInt32BE(20);
				return { width, height };
			}
		}

		// 2. GIF Header: GIF87a or GIF89a
		if (fd[0] === 0x47 && fd[1] === 0x49 && fd[2] === 0x46) {
			if (fd.length >= 10) {
				const width = fd.readUInt16LE(6);
				const height = fd.readUInt16LE(8);
				return { width, height };
			}
		}

		// 3. JPEG Header: \xFF\xD8
		if (fd[0] === 0xff && fd[1] === 0xd8) {
			let offset = 2;
			while (offset < fd.length - 8) {
				if (fd[offset] !== 0xff) {
					offset++;
					continue;
				}
				while (offset < fd.length && fd[offset] === 0xff) offset++;
				if (offset >= fd.length) break;
				const marker = fd[offset++];
				if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
				if (offset + 2 > fd.length) break;
				const len = fd.readUInt16BE(offset);
				// SOF0 .. SOF3, SOF5 .. SOF7, SOF9 .. SOF11, SOF13 .. SOF15
				const isSof =
					(marker >= 0xc0 && marker <= 0xc3) ||
					(marker >= 0xc5 && marker <= 0xc7) ||
					(marker >= 0xc9 && marker <= 0xcb) ||
					(marker >= 0xcd && marker <= 0xcf);
				if (isSof && offset + 7 <= fd.length) {
					const height = fd.readUInt16BE(offset + 3);
					const width = fd.readUInt16BE(offset + 5);
					return { width, height };
				}
				offset += len;
			}
		}

		// 4. WEBP Header: RIFF....WEBP
		if (
			fd[0] === 0x52 &&
			fd[1] === 0x49 &&
			fd[2] === 0x46 &&
			fd[3] === 0x46 &&
			fd.length >= 30 &&
			fd[8] === 0x57 &&
			fd[9] === 0x45 &&
			fd[10] === 0x42 &&
			fd[11] === 0x50
		) {
			const type = fd.toString("ascii", 12, 16);
			if (type === "VP8 " && fd.length >= 30) {
				const width = fd.readUInt16LE(26) & 0x3fff;
				const height = fd.readUInt16LE(28) & 0x3fff;
				return { width, height };
			}
			if (type === "VP8L" && fd.length >= 25 && fd[20] === 0x2f) {
				const b0 = fd[21];
				const b1 = fd[22];
				const b2 = fd[23];
				const b3 = fd[24];
				const width = 1 + (((b1 & 0x3f) << 8) | b0);
				const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
				return { width, height };
			}
			if (type === "VP8X" && fd.length >= 30) {
				const width = 1 + (fd[24] | (fd[25] << 8) | (fd[26] << 16));
				const height = 1 + (fd[27] | (fd[28] << 8) | (fd[29] << 16));
				return { width, height };
			}
		}
	} catch {}
	return null;
}

/**
 * Obtains image dimensions using ImageMagick identify or fallback binary reader.
 */
export function getImageDimensions(
	filePath: string,
	magickBin: string | null,
): { width: number; height: number } | null {
	if (magickBin) {
		try {
			const output = execSync(`${magickBin} identify -format "%w %h" "${filePath}"`, {
				encoding: "utf8",
				stdio: ["ignore", "pipe", "ignore"],
				timeout: 4000,
			}).trim();
			const [wStr, hStr] = output.split(/\s+/);
			const w = parseInt(wStr, 10);
			const h = parseInt(hStr, 10);
			if (!isNaN(w) && !isNaN(h) && w > 0 && h > 0) {
				return { width: w, height: h };
			}
		} catch {}
	}
	return extractBinaryDimensions(filePath);
}

/**
 * Runs a 231x87 downscale simulation and computes luminance and contrast
 * standard deviation to evaluate legibility on dark Steam store UI.
 */
export function evaluateSmallCapsuleLegibility(
	filePath: string,
	magickBin: string,
): {
	contrastPercent: number;
	luminancePercent: number;
	rating: "excelente" | "adecuado" | "bajo" | "extremo";
	comment: string;
} | null {
	try {
		const cmd = `${magickBin} "${filePath}" -resize 231x87! -colorspace Gray -format "%[fx:standard_deviation*100] %[fx:mean*100]" info:`;
		const raw = execSync(cmd, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 5000,
		}).trim();

		const [stdDevStr, meanStr] = raw.split(/\s+/);
		const contrast = parseFloat(stdDevStr);
		const luminance = parseFloat(meanStr);

		if (isNaN(contrast) || isNaN(luminance)) return null;

		let rating: "excelente" | "adecuado" | "bajo" | "extremo" = "adecuado";
		let comment = "";

		if (contrast < 12.0) {
			rating = "bajo";
			comment = "Poco contraste. En 231x87 px sobre fondo oscuro (#171a21), el logotipo o silueta puede volverse irreconocible.";
		} else if (luminance < 15.0 || luminance > 88.0) {
			rating = "extremo";
			comment = luminance < 15.0
				? "Cápsula excesivamente oscura; se camufla con la interfaz de Steam."
				: "Cápsula excesivamente saturada de blanco/brillo; puede lavar detalles del título.";
		} else if (contrast >= 20.0) {
			rating = "excelente";
			comment = "Excelente separación de figura y fondo. Alta legibilidad para búsquedas y rebajas.";
		} else {
			rating = "adecuado";
			comment = "Contraste dinámico equilibrado para catálogos y colas de descubrimiento.";
		}

		return {
			contrastPercent: Math.round(contrast * 10) / 10,
			luminancePercent: Math.round(luminance * 10) / 10,
			rating,
			comment,
		};
	} catch {
		return null;
	}
}

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Finds which Steam specification is the closest match for the given image.
 */
export function matchCapsuleSpec(width: number, height: number): {
	spec: SteamCapsuleSpec;
	status: MatchStatus;
	diffWidth: number;
	diffHeight: number;
} {
	const specs = Object.values(STEAM_CAPSULE_SPECS);
	const imgRatio = width / height;

	// 1. Exact resolution match
	for (const spec of specs) {
		if (spec.width === width && spec.height === height) {
			return { spec, status: "exact", diffWidth: 0, diffHeight: 0 };
		}
	}

	// 2. Aspect ratio proximity check (< 6% deviation)
	let bestRatioSpec: SteamCapsuleSpec = specs[0];
	let minRatioDiff = Number.MAX_VALUE;

	for (const spec of specs) {
		const ratioDiff = Math.abs(imgRatio - spec.aspectRatio);
		if (ratioDiff < minRatioDiff) {
			minRatioDiff = ratioDiff;
			bestRatioSpec = spec;
		}
	}

	if (minRatioDiff <= 0.08) {
		return {
			spec: bestRatioSpec,
			status: "proportional",
			diffWidth: width - bestRatioSpec.width,
			diffHeight: height - bestRatioSpec.height,
		};
	}

	// 3. Fallback to closest Euclidean dimension distance
	let bestDistSpec: SteamCapsuleSpec = specs[0];
	let minDistance = Number.MAX_VALUE;

	for (const spec of specs) {
		const dist = Math.hypot(width - spec.width, height - spec.height);
		if (dist < minDistance) {
			minDistance = dist;
			bestDistSpec = spec;
		}
	}

	return {
		spec: bestDistSpec,
		status: "mismatch",
		diffWidth: width - bestDistSpec.width,
		diffHeight: height - bestDistSpec.height,
	};
}

/**
 * Recursively scans directory for image files up to maxDepth.
 */
function scanDirectoryForImages(dirPath: string, maxDepth = 3, currentDepth = 0): string[] {
	const results: string[] = [];
	if (!existsSync(dirPath) || currentDepth > maxDepth) return results;

	const validExts = new Set([".png", ".jpg", ".jpeg", ".webp"]);
	try {
		const entries = readdirSync(dirPath, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dirPath, entry.name);
			if (entry.isDirectory()) {
				if (!entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "target") {
					results.push(...scanDirectoryForImages(full, maxDepth, currentDepth + 1));
				}
			} else if (entry.isFile()) {
				const ext = extname(entry.name).toLowerCase();
				if (validExts.has(ext)) {
					results.push(full);
				}
			}
		}
	} catch {}

	return results;
}

/**
 * Discovers candidate capsule images from candidate directories or single file path.
 */
export function discoverCapsuleFiles(searchTarget?: string, rootDir = process.cwd()): string[] {
	if (searchTarget && searchTarget.trim()) {
		const rawPath = searchTarget.trim();
		const candidate = resolve(rootDir, rawPath);
		if (existsSync(candidate)) {
			const st = statSync(candidate);
			if (st.isFile()) {
				return [candidate];
			}
			if (st.isDirectory()) {
				return scanDirectoryForImages(candidate, 3);
			}
		}
	}

	// Automatic candidate search in standard studio folders
	const candidateDirs = [
		join(rootDir, "assets", "capsules"),
		join(rootDir, "assets", "branding"),
		join(rootDir, "assets", "steam"),
		join(rootDir, "assets"),
		join(rootDir, "branding", "steam"),
		join(rootDir, "branding"),
		join(rootDir, "art", "capsules"),
		join(rootDir, "art", "steam"),
		join(rootDir, "art"),
		join(rootDir, "docs", "art"),
	];

	const foundImages = new Set<string>();
	for (const cDir of candidateDirs) {
		if (existsSync(cDir)) {
			const images = scanDirectoryForImages(cDir, 2);
			for (const img of images) {
				const lower = basename(img).toLowerCase();
				// Prioritize files whose names suggest store capsules or steam branding
				if (
					lower.includes("capsule") ||
					lower.includes("steam") ||
					lower.includes("header") ||
					lower.includes("small") ||
					lower.includes("main") ||
					lower.includes("vertical") ||
					lower.includes("hero") ||
					lower.includes("cover") ||
					cDir.includes("capsules") ||
					cDir.includes("branding")
				) {
					foundImages.add(img);
				}
			}
			// If we found targeted capsule names, don't overwhelm with all raw game sprites
			if (foundImages.size >= 5) break;
		}
	}

	// If no named capsule images found, grab images in assets/capsules or branding
	if (foundImages.size === 0) {
		for (const cDir of candidateDirs) {
			if (existsSync(cDir)) {
				const images = scanDirectoryForImages(cDir, 1);
				for (const img of images) foundImages.add(img);
				if (foundImages.size > 0) break;
			}
		}
	}

	return Array.from(foundImages);
}

/**
 * Runs full audit on discovered images against official Steamworks specifications.
 */
export function auditStoreCapsules(files: string[], rootDir = process.cwd()): CapsuleAuditSummary {
	const magickBin = detectMagickBinary();
	const hasMagick = magickBin !== null;
	const items: CapsuleAuditItem[] = [];
	const matchedSpecIds = new Set<string>();

	for (const f of files) {
		const dims = getImageDimensions(f, magickBin);
		if (!dims) continue;

		let stSize = 0;
		try {
			stSize = statSync(f).size;
		} catch {}

		const match = matchCapsuleSpec(dims.width, dims.height);
		const rel = relative(rootDir, f);

		let legibility: CapsuleAuditItem["legibility"] = undefined;
		if (hasMagick && (match.spec.id === "small" || match.spec.id === "header" || match.spec.id === "main")) {
			legibility = evaluateSmallCapsuleLegibility(f, magickBin) || undefined;
		}

		if (match.status === "exact") {
			matchedSpecIds.add(match.spec.id);
		}

		items.push({
			filePath: f,
			relPath: rel,
			fileName: basename(f),
			fileSizeBytes: stSize,
			fileSizeFormatted: formatBytes(stSize),
			width: dims.width,
			height: dims.height,
			aspectRatio: Math.round((dims.width / dims.height) * 100) / 100,
			matchedSpec: match.spec,
			matchStatus: match.status,
			diffWidth: match.diffWidth,
			diffHeight: match.diffHeight,
			legibility,
		});
	}

	const missingSpecs = Object.values(STEAM_CAPSULE_SPECS).filter((s) => !matchedSpecIds.has(s.id));

	return {
		targetFiles: items,
		missingSpecs,
		hasMagick,
		magickBinary: magickBin,
	};
}

/**
 * Formats and prints an ANSI report using Pi Game Studio's sober visual theme.
 */
export function renderCapsuleReport(summary: CapsuleAuditSummary, termWidth = 80): string[] {
	const width = Math.max(76, Math.min(termWidth, 96));
	const innerWidth = width - 4;
	const lines: string[] = [];

	lines.push("");
	lines.push(panelTop(width - 2, undefined, "square", BORDER));
	lines.push(
		`${panelRow(`${ACCENT}STEAM STORE CAPSULE ART & COVER AUDIT${RESET} ${GRAY}(Steamworks Specs)${RESET}`, innerWidth + 2, BORDER)}`,
	);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Section 1: Tooling status
	const toolStatus = summary.hasMagick
		? `${GREEN}[ACTIVO]${RESET} ImageMagick (${summary.magickBinary}) — Simulación 231x87 y contraste activados`
		: `${YELLOW}[MODO BÁSICO]${RESET} Lectura binaria nativa. Falta 'magick' para simulación de contraste`;
	lines.push(`${panelRow(toolStatus, innerWidth + 2, BORDER)}`);
	lines.push(panelRule(width - 2, "square", BORDER));

	// Section 2: Reference specifications header
	lines.push(
		`${panelRow(`${HEADING}RESOLUCIONES OFICIALES STEAMWORKS:${RESET}`, innerWidth + 2, BORDER)}`,
	);

	for (const spec of Object.values(STEAM_CAPSULE_SPECS)) {
		const isCrit = spec.critical ? ` ${RED}[CRÍTICA: CTR Core]${RESET}` : "";
		const specLine = `  ${WHITE}${spec.width}x${spec.height}${RESET} ${DIM}│${RESET} ${SECONDARY}${spec.name}${RESET}${isCrit} ${GRAY}— ${spec.steamworksRole}${RESET}`;
		lines.push(`${panelRow(specLine, innerWidth + 2, BORDER)}`);
	}
	lines.push(panelRule(width - 2, "square", BORDER));

	// Section 3: Audited images
	if (summary.targetFiles.length === 0) {
		lines.push(
			`${panelRow(`${YELLOW}No se encontraron imágenes de cápsula en assets/, branding/ o art/.${RESET}`, innerWidth + 2, BORDER)}`,
		);
		lines.push(
			`${panelRow(`${DIM}Pasa una ruta explícita: ${WHITE}/capsule-check assets/branding/mi_capsula.png${RESET}`, innerWidth + 2, BORDER)}`,
		);
	} else {
		lines.push(
			`${panelRow(`${HEADING}IMÁGENES ANALIZADAS (${summary.targetFiles.length}):${RESET}`, innerWidth + 2, BORDER)}`,
		);

		for (const item of summary.targetFiles) {
			let statusBadge = `${GREEN}[✓ EXACTO]${RESET}`;
			if (item.matchStatus === "proportional") {
				statusBadge = `${YELLOW}[~ PROPORCIONAL]${RESET}`;
			} else if (item.matchStatus === "mismatch") {
				statusBadge = `${RED}[✗ DESVIACIÓN]${RESET}`;
			}

			const headerLine = `  ${statusBadge} ${WHITE}${item.fileName}${RESET} ${GRAY}(${item.width}x${item.height} px, ${item.fileSizeFormatted})${RESET}`;
			lines.push(`${panelRow(headerLine, innerWidth + 2, BORDER)}`);

			const matchLine = `     ${DIM}Destino sugerido:${RESET} ${SECONDARY}${item.matchedSpec.name}${RESET} ${GRAY}(Oficial: ${item.matchedSpec.width}x${item.matchedSpec.height})${RESET}`;
			lines.push(`${panelRow(matchLine, innerWidth + 2, BORDER)}`);

			if (item.matchStatus !== "exact") {
				const diffStr =
					item.matchStatus === "proportional"
						? `Requiere reescalado exacto sin distorsión (Aspect ratio correcto)`
						: `Diferencia: ${item.diffWidth > 0 ? "+" : ""}${item.diffWidth}w, ${item.diffHeight > 0 ? "+" : ""}${item.diffHeight}h px`;
				lines.push(
					`${panelRow(`     ${YELLOW}→ ${diffStr}${RESET}`, innerWidth + 2, BORDER)}`,
				);
			}

			if (item.legibility) {
				const leg = item.legibility;
				const legColor = leg.rating === "excelente" ? GREEN : leg.rating === "adecuado" ? SECONDARY : leg.rating === "extremo" ? RED : YELLOW;
				const legLine = `     ${DIM}Simulación 231x87:${RESET} ${legColor}${leg.rating.toUpperCase()}${RESET} ${GRAY}(Contraste: ${leg.contrastPercent}%, Brillo: ${leg.luminancePercent}%)${RESET}`;
				lines.push(`${panelRow(legLine, innerWidth + 2, BORDER)}`);
				lines.push(`${panelRow(`     ${DIM}Nota:${RESET} ${GRAY}${leg.comment}${RESET}`, innerWidth + 2, BORDER)}`);
			}

			lines.push(`${panelRow("", innerWidth + 2, BORDER)}`);
		}
	}

	// Section 4: Missing specs checklist
	lines.push(panelRule(width - 2, "square", BORDER));
	lines.push(
		`${panelRow(`${HEADING}ESTADO DEL SET DE CÁPSULAS PARA STEAM:${RESET}`, innerWidth + 2, BORDER)}`,
	);

	for (const spec of Object.values(STEAM_CAPSULE_SPECS)) {
		const isMissing = summary.missingSpecs.some((m) => m.id === spec.id);
		const icon = isMissing ? `${RED}[FALTA]${RESET}` : `${GREEN}[LISTO]${RESET}`;
		const critTag = spec.critical ? ` ${RED}(¡URGENTE PARA VISIBILIDAD!)${RESET}` : "";
		const line = `  ${icon} ${WHITE}${spec.name}${RESET} ${GRAY}(${spec.width}x${spec.height})${RESET}${critTag}`;
		lines.push(`${panelRow(line, innerWidth + 2, BORDER)}`);
	}

	// Section 5: Advice & Magick commands
	lines.push(panelRule(width - 2, "square", BORDER));
	if (!summary.hasMagick) {
		lines.push(
			`${panelRow(`${YELLOW}RECOMENDACIÓN TÉCNICA (Art Director):${RESET}`, innerWidth + 2, BORDER)}`,
		);
		lines.push(
			`${panelRow(`  Instala ImageMagick para simulación y recorte automático de cápsulas:`, innerWidth + 2, BORDER)}`,
		);
		lines.push(
			`${panelRow(`  ${ACCENT}macOS:${RESET} brew install imagemagick ${DIM}│${RESET} ${ACCENT}Linux:${RESET} sudo apt install imagemagick`, innerWidth + 2, BORDER)}`,
		);
	} else if (summary.missingSpecs.length > 0) {
		lines.push(
			`${panelRow(`${HEADING}COMANDOS RÁPIDOS DE GENERACIÓN (ImageMagick):${RESET}`, innerWidth + 2, BORDER)}`,
		);
		const smallMissing = summary.missingSpecs.find((s) => s.id === "small");
		if (smallMissing) {
			lines.push(
				`${panelRow(`  ${DIM}# Generar cápsula pequeña (231x87) con ajuste y recorte centrado:${RESET}`, innerWidth + 2, BORDER)}`,
			);
			lines.push(
				`${panelRow(`  ${SECONDARY}magick <master_art.png> -resize 231x87^ -gravity center -extent 231x87 assets/branding/capsule_small.png${RESET}`, innerWidth + 2, BORDER)}`,
			);
		}
		const headerMissing = summary.missingSpecs.find((s) => s.id === "header");
		if (headerMissing) {
			lines.push(
				`${panelRow(`  ${SECONDARY}magick <master_art.png> -resize 460x215^ -gravity center -extent 460x215 assets/branding/capsule_header.png${RESET}`, innerWidth + 2, BORDER)}`,
			);
		}
	} else {
		lines.push(
			`${panelRow(`${GREEN}¡SET COMPLETO! Todas las cápsulas requeridas por Steamworks están validadas.${RESET}`, innerWidth + 2, BORDER)}`,
		);
	}

	lines.push(panelBottom(width - 2, "square", BORDER));
	lines.push("");

	return lines;
}

/**
 * Main command handler for /capsule-check and /studio:capsule.
 */
export async function handleStudioCapsule(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const candidateTarget = (args || "").trim();

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify("Validando especificaciones de cápsulas Steamworks...", "info");
	}

	const files = discoverCapsuleFiles(candidateTarget, rootDir);
	const summary = auditStoreCapsules(files, rootDir);

	const termWidth = process.stdout.columns || 80;
	const reportLines = renderCapsuleReport(summary, termWidth);

	for (const line of reportLines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const smallMissing = summary.missingSpecs.some((s) => s.id === "small");
		if (smallMissing) {
			(ctx.ui as any).notify(
				"[Alerta Arte] Falta la Cápsula Pequeña (231x87) — Crítica para el CTR de Steam",
				"warning",
			);
		} else {
			(ctx.ui as any).notify(
				`Auditoría de cápsulas completada: ${summary.targetFiles.length} imágenes analizadas`,
				"info",
			);
		}
	}
}
