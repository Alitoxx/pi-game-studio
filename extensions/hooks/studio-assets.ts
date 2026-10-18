import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	RED,
	ACCENT as BLUE,
	SECONDARY,
	WHITE,
} from "./studio-palette.ts";

export interface ImageAuditItem {
	path: string;
	relPath: string;
	sizeBytes: number;
	sizeFormatted: string;
	isOptimized: boolean;
	recommendation?: string;
}

export interface ModelAuditItem {
	path: string;
	relPath: string;
	sizeBytes: number;
	sizeFormatted: string;
	budgetBytes: number;
	withinBudget: boolean;
	recommendation?: string;
}

export interface ManifestEntry {
	key: string;
	declaredPath: string;
	exists: boolean;
	isPlaceholder: boolean;
	placeholderReason?: string;
}

export interface ManifestAuditReport {
	exists: boolean;
	path: string;
	entries: ManifestEntry[];
	missingCount: number;
	placeholderCount: number;
}

export interface AssetAuditReport {
	studioRoot: string;
	assetsDirExists: boolean;
	images: ImageAuditItem[];
	models: ModelAuditItem[];
	manifest: ManifestAuditReport;
	totalAssetsCount: number;
	warnings: string[];
	summary: string;
}

const DEFAULT_MODEL_BUDGET_BYTES = 10 * 1024 * 1024; // 10 MB per 3D model

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Checks PNG header and chunks for optimization status.
 * Unoptimized PNGs often contain auxiliary metadata chunks (tEXt, zTXt, iTXt, pHYs)
 * or exceed 256KB without lossless compression.
 */
function inspectPngOptimization(filePath: string, sizeBytes: number): { isOptimized: boolean; recommendation?: string } {
	try {
		const fd = readFileSync(filePath);
		if (fd.length < 8) return { isOptimized: true };

		// Check for unstripped metadata chunks in PNG
		const fdStr = fd.toString("latin1");
		const hasMetadataChunks =
			fdStr.includes("tEXt") ||
			fdStr.includes("zTXt") ||
			fdStr.includes("iTXt") ||
			fdStr.includes("eXIf");

		if (hasMetadataChunks || sizeBytes > 300 * 1024) {
			return {
				isOptimized: false,
				recommendation: `Optimizar con: oxipng -o 4 --strip all "${filePath}"`,
			};
		}
	} catch {}

	return { isOptimized: true };
}

/**
 * Finds all asset files recursively in directory.
 */
function scanAssetFiles(dir: string, result: string[] = []): string[] {
	if (!existsSync(dir)) return result;
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				if (
					entry.name === "node_modules" ||
					entry.name === ".git" ||
					entry.name === "target" ||
					entry.name === ".godot" ||
					entry.name === "build"
				) {
					continue;
				}
				scanAssetFiles(full, result);
			} else if (entry.isFile()) {
				result.push(full);
			}
		}
	} catch {}
	return result;
}

/**
 * Parses assets/manifest.yaml and cross-references declared files.
 */
function parseAndCrossReferenceManifest(manifestPath: string, studioRoot: string): ManifestAuditReport {
	if (!existsSync(manifestPath)) {
		return {
			exists: false,
			path: manifestPath,
			entries: [],
			missingCount: 0,
			placeholderCount: 0,
		};
	}

	const content = readFileSync(manifestPath, "utf8");
	const lines = content.split(/\r?\n/);
	const entries: ManifestEntry[] = [];

	let missingCount = 0;
	let placeholderCount = 0;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line || line.startsWith("#")) continue;

		// Match key-value or list item:
		// e.g. "player: 'assets/sprites/player.png'" or "- path: models/player.glb"
		const kvMatch = line.match(/^([a-zA-Z0-9_\-]+)\s*:\s*["']?([^"'\n#]+)["']?/);
		const listMatch = line.match(/^-\s*(?:path\s*:\s*)?["']?([^"'\n#]+)["']?/);

		let key = "";
		let val = "";

		if (kvMatch) {
			key = kvMatch[1];
			val = kvMatch[2].trim();
		} else if (listMatch) {
			key = `item_${i + 1}`;
			val = listMatch[1].trim();
		}

		if (val) {
			const lowerVal = val.toLowerCase();
			const isPlaceholder =
				lowerVal.includes("todo") ||
				lowerVal.includes("tbd") ||
				lowerVal.includes("placeholder") ||
				lowerVal.includes("unresolved") ||
				lowerVal.includes("temporal") ||
				lowerVal === "none" ||
				lowerVal === "null" ||
				lowerVal === "";

			let exists = false;
			if (!isPlaceholder) {
				// Try direct, relative to assets, and relative to root
				const candidate1 = join(studioRoot, val);
				const candidate2 = join(studioRoot, "assets", val);
				exists = existsSync(candidate1) || existsSync(candidate2);
			}

			if (isPlaceholder) {
				placeholderCount++;
			} else if (!exists) {
				missingCount++;
			}

			entries.push({
				key,
				declaredPath: val,
				exists,
				isPlaceholder,
				placeholderReason: isPlaceholder ? `Placeholder detectado: "${val}"` : undefined,
			});
		}
	}

	return {
		exists: true,
		path: manifestPath,
		entries,
		missingCount,
		placeholderCount,
	};
}

/**
 * Audits all game assets:
 * - Images (.png) for oxipng optimization
 * - 3D models (.glb, .gltf) for budget limits
 * - Cross-references assets/manifest.yaml for missing files or unresolved placeholders
 */
export function auditAssets(studioRoot: string, modelBudgetBytes: number = DEFAULT_MODEL_BUDGET_BYTES): AssetAuditReport {
	const assetsDir = join(studioRoot, "assets");
	const assetsDirExists = existsSync(assetsDir);
	const scanRoot = assetsDirExists ? assetsDir : studioRoot;

	const allFiles = scanAssetFiles(scanRoot);
	const images: ImageAuditItem[] = [];
	const models: ModelAuditItem[] = [];
	const warnings: string[] = [];

	for (const file of allFiles) {
		const ext = extname(file).toLowerCase();
		let stat;
		try {
			stat = statSync(file);
		} catch {
			continue;
		}

		const rel = relative(studioRoot, file);

		if (ext === ".png") {
			const opt = inspectPngOptimization(file, stat.size);
			images.push({
				path: file,
				relPath: rel,
				sizeBytes: stat.size,
				sizeFormatted: formatBytes(stat.size),
				isOptimized: opt.isOptimized,
				recommendation: opt.recommendation,
			});
			if (!opt.isOptimized) {
				warnings.push(`Imagen no optimizada: ${rel} (${formatBytes(stat.size)})`);
			}
		} else if (ext === ".glb" || ext === ".gltf") {
			const withinBudget = stat.size <= modelBudgetBytes;
			const item: ModelAuditItem = {
				path: file,
				relPath: rel,
				sizeBytes: stat.size,
				sizeFormatted: formatBytes(stat.size),
				budgetBytes: modelBudgetBytes,
				withinBudget,
				recommendation: withinBudget
					? undefined
					: `Excede presupuesto (${formatBytes(modelBudgetBytes)}). Optimizar con meshopt / draco / assimp.`,
			};
			models.push(item);
			if (!withinBudget) {
				warnings.push(`Modelo 3D sobre presupuesto: ${rel} (${formatBytes(stat.size)} > ${formatBytes(modelBudgetBytes)})`);
			}
		}
	}

	// Manifest inspection
	const manifestPath = join(studioRoot, "assets", "manifest.yaml");
	const manifest = parseAndCrossReferenceManifest(manifestPath, studioRoot);

	if (manifest.exists) {
		if (manifest.missingCount > 0) {
			warnings.push(`Manifest: ${manifest.missingCount} archivo(s) declarados no existen en disco`);
		}
		if (manifest.placeholderCount > 0) {
			warnings.push(`Manifest: ${manifest.placeholderCount} placeholder(s) sin resolver`);
		}
	}

	const unoptimizedImagesCount = images.filter((img) => !img.isOptimized).length;
	const overBudgetModelsCount = models.filter((m) => !m.withinBudget).length;

	let summary = "";
	if (warnings.length === 0) {
		summary = `▲ ASSETS OK: ${images.length} imágenes optimizadas, ${models.length} modelos dentro de presupuesto, manifest sincronizado.`;
	} else {
		summary = `◈ ASSETS AUDIT: ${unoptimizedImagesCount} imágenes sin optimizar, ${overBudgetModelsCount} modelos sobre presupuesto, ${manifest.missingCount} missing, ${manifest.placeholderCount} placeholders.`;
	}

	return {
		studioRoot,
		assetsDirExists,
		images,
		models,
		manifest,
		totalAssetsCount: allFiles.length,
		warnings,
		summary,
	};
}

export interface OptimizedItemDetail {
	file: string;
	beforeBytes: number;
	afterBytes: number;
	savedBytes: number;
}

export interface AssetOptimizationReport {
	studioRoot: string;
	optimizedCount: number;
	totalInitialBytes: number;
	totalFinalBytes: number;
	totalSavedBytes: number;
	savingsPercent: number;
	toolUsed: string;
	details: OptimizedItemDetail[];
	errors: string[];
}

/**
 * Optimizes project textures and assets using available FOSS tools (oxipng).
 */
export function optimizeProjectAssets(studioRoot: string): AssetOptimizationReport {
	const report = auditAssets(studioRoot);
	const details: OptimizedItemDetail[] = [];
	const errors: string[] = [];

	let oxipngPath: string | null = null;
	try {
		oxipngPath = execFileSync("which", ["oxipng"], { encoding: "utf8" }).trim();
	} catch {}

	if (!oxipngPath) {
		return {
			studioRoot,
			optimizedCount: 0,
			totalInitialBytes: 0,
			totalFinalBytes: 0,
			totalSavedBytes: 0,
			savingsPercent: 0,
			toolUsed: "none (oxipng not found in PATH)",
			details: [],
			errors: ["oxipng no está instalado o no se encuentra en PATH. Instálalo para optimización de sprites."],
		};
	}

	let totalInitial = 0;
	let totalFinal = 0;

	for (const img of report.images) {
		const beforeSize = statSync(img.path).size;
		try {
			execFileSync(oxipngPath, ["-o", "2", "--strip", "safe", img.path], {
				stdio: "pipe",
			});
			const afterSize = statSync(img.path).size;
			const saved = Math.max(0, beforeSize - afterSize);

			totalInitial += beforeSize;
			totalFinal += afterSize;

			details.push({
				file: img.relPath,
				beforeBytes: beforeSize,
				afterBytes: afterSize,
				savedBytes: saved,
			});
		} catch (err: any) {
			errors.push(`Error al optimizar ${img.relPath}: ${err.message || String(err)}`);
		}
	}

	const totalSaved = Math.max(0, totalInitial - totalFinal);
	const savingsPercent = totalInitial > 0 ? Number(((totalSaved / totalInitial) * 100).toFixed(1)) : 0;

	return {
		studioRoot,
		optimizedCount: details.length,
		totalInitialBytes: totalInitial,
		totalFinalBytes: totalFinal,
		totalSavedBytes: totalSaved,
		savingsPercent,
		toolUsed: "oxipng -o 2 --strip safe",
		details,
		errors,
	};
}

/**
 * CLI command handler for /studio:assets (or /assets)
 */
export async function handleStudioAssets(
	args: string,
	ctx: ExtensionContext,
): Promise<AssetAuditReport | AssetOptimizationReport> {
	const cwd = ctx.cwd || process.cwd();
	const studioRoot = findStudioRoot(cwd) || cwd;
	const isOptimize = (args || "").trim().toLowerCase().includes("optimize");

	if (isOptimize) {
		console.log(`\n${BLUE}▌ ◈ ASSET OPTIMIZER (/studio:assets optimize)${RESET}`);
		console.log(`${DIM}Optimizando imágenes PNG mediante herramientas FOSS auditadas...${RESET}\n`);

		const optReport = optimizeProjectAssets(studioRoot);
		if (optReport.errors.length > 0 && optReport.optimizedCount === 0) {
			console.log(`  ${YELLOW}⚠ ${optReport.errors[0]}${RESET}`);
			console.log(`  ${DIM}Puedes instalarlo en macOS con: brew install oxipng${RESET}\n`);
			return optReport;
		}

		console.log(`${BOLD}${WHITE}Imágenes optimizadas:${RESET} ${optReport.optimizedCount}`);
		console.log(`  • Tamaño inicial:  ${formatBytes(optReport.totalInitialBytes)}`);
		console.log(`  • Tamaño final:    ${formatBytes(optReport.totalFinalBytes)}`);
		console.log(`  • Espacio ahorrado: ${GREEN}${formatBytes(optReport.totalSavedBytes)} (${optReport.savingsPercent}% reducción)${RESET}\n`);

		for (const d of optReport.details.slice(0, 5)) {
			console.log(`    - ${d.file}: ${formatBytes(d.beforeBytes)} → ${formatBytes(d.afterBytes)} (${DIM}-${formatBytes(d.savedBytes)}${RESET})`);
		}
		if (optReport.details.length > 5) {
			console.log(`    ${DIM}...y ${optReport.details.length - 5} más.${RESET}`);
		}
		console.log("");
		return optReport;
	}

	console.log(`\n${BLUE}▌ ◈ ASSET PIPELINE & MANIFEST INSPECTOR${RESET}`);
	console.log(`${DIM}Inspeccionando imágenes .png, modelos 3D y assets/manifest.yaml...${RESET}\n`);

	const report = auditAssets(studioRoot);

	// Images report
	const unoptImages = report.images.filter((i) => !i.isOptimized);
	console.log(`${BOLD}${WHITE}Imágenes PNG:${RESET} ${report.images.length} detectadas`);
	if (unoptImages.length === 0) {
		console.log(`  ${GREEN}▲ Todas las imágenes PNG están optimizadas.${RESET}`);
	} else {
		console.log(`  ${YELLOW}◈ ${unoptImages.length} imágenes requieren oxipng:${RESET}`);
		for (const img of unoptImages.slice(0, 5)) {
			console.log(`    - ${img.relPath} (${img.sizeFormatted}) -> ${DIM}${img.recommendation}${RESET}`);
		}
		if (unoptImages.length > 5) {
			console.log(`    ${DIM}...y ${unoptImages.length - 5} más.${RESET}`);
		}
	}

	// 3D Models report
	const overBudgetModels = report.models.filter((m) => !m.withinBudget);
	console.log(`\n${BOLD}${WHITE}Modelos 3D (.glb / .gltf):${RESET} ${report.models.length} detectados`);
	if (overBudgetModels.length === 0) {
		console.log(`  ${GREEN}▲ Todos los modelos están dentro del presupuesto (<= 10MB).${RESET}`);
	} else {
		console.log(`  ${RED}■ ${overBudgetModels.length} modelos sobre presupuesto:${RESET}`);
		for (const m of overBudgetModels) {
			console.log(`    - ${m.relPath} (${m.sizeFormatted}) -> ${m.recommendation}`);
		}
	}

	// Manifest report
	console.log(`\n${BOLD}${WHITE}Manifest de Assets (assets/manifest.yaml):${RESET}`);
	if (!report.manifest.exists) {
		console.log(`  ${DIM}○ assets/manifest.yaml no presente (opcional).${RESET}`);
	} else {
		console.log(`  Entradas analizadas: ${report.manifest.entries.length}`);
		if (report.manifest.missingCount === 0 && report.manifest.placeholderCount === 0) {
			console.log(`  ${GREEN}▲ 100% sincronizado: cero archivos faltantes ni placeholders.${RESET}`);
		} else {
			if (report.manifest.missingCount > 0) {
				console.log(`  ${RED}■ Archivos declarados no encontrados en disco: ${report.manifest.missingCount}${RESET}`);
				for (const missing of report.manifest.entries.filter((e) => !e.exists && !e.isPlaceholder).slice(0, 5)) {
					console.log(`    - Falta: ${missing.declaredPath}`);
				}
			}
			if (report.manifest.placeholderCount > 0) {
				console.log(`  ${YELLOW}◈ Placeholders pendientes: ${report.manifest.placeholderCount}${RESET}`);
				for (const ph of report.manifest.entries.filter((e) => e.isPlaceholder).slice(0, 5)) {
					console.log(`    - ${ph.key}: "${ph.declaredPath}"`);
				}
			}
		}
	}

	console.log(`\n${report.warnings.length === 0 ? GREEN : YELLOW}${report.summary}${RESET}\n`);

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const notifyType = report.warnings.length === 0 ? "info" : "warning";
		(ctx.ui as any).notify(report.summary, notifyType);
	}

	return report;
}
