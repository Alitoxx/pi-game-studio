import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runGit } from "./studio-exec.ts";
import { findStudioRoot } from "./studio-root.ts";
import { panelBottom, panelRow, panelTop, panelRule, RESET, BORDER, HEADING, resolveStudioTheme, getActiveThemeRole, type StudioThemeRoles } from "./studio-palette.ts";

export type ChangeCategory = "DESIGN" | "CODE" | "DATA_ASSETS" | "PRODUCTION" | "CONFIG" | "OTHER";

export interface FileChange {
	path: string;
	status: string; // "M", "A", "D", "??"
	category: ChangeCategory;
	additions?: number;
	deletions?: number;
}

export interface ChangesSummary {
	design: FileChange[];
	code: FileChange[];
	dataAssets: FileChange[];
	production: FileChange[];
	config: FileChange[];
	other: FileChange[];
	driftWarnings: string[];
}

export function classifyFile(filePath: string): ChangeCategory {
	const lower = filePath.toLowerCase();

	if (
		lower.startsWith("design/gdd/") ||
		lower.startsWith("design/art/") ||
		lower.startsWith("design/audio/") ||
		lower.startsWith("design/")
	) {
		return "DESIGN";
	}

	if (
		lower.startsWith("src/") ||
		lower.endsWith(".rs") ||
		lower.endsWith(".cpp") ||
		lower.endsWith(".hpp") ||
		lower.endsWith(".h") ||
		lower.endsWith(".c") ||
		lower.endsWith(".cs") ||
		lower.endsWith(".gd") ||
		lower.endsWith(".glsl") ||
		lower.endsWith(".hlsl") ||
		lower.endsWith(".wgsl") ||
		lower.endsWith(".shader")
	) {
		return "CODE";
	}

	if (
		lower.startsWith("assets/") ||
		lower.startsWith("data/") ||
		lower.endsWith(".png") ||
		lower.endsWith(".jpg") ||
		lower.endsWith(".ogg") ||
		lower.endsWith(".wav") ||
		lower.endsWith(".mp3") ||
		lower.endsWith(".csv") ||
		lower.endsWith(".tsv") ||
		lower.endsWith(".json") ||
		lower.endsWith(".ron") ||
		lower.endsWith(".tres") ||
		lower.endsWith(".tscn") ||
		lower.endsWith(".prefab")
	) {
		return "DATA_ASSETS";
	}

	if (
		lower.startsWith("production/") ||
		lower.includes("roadmap.md") ||
		lower.includes("session-logs")
	) {
		return "PRODUCTION";
	}

	if (
		lower.startsWith(".pi/") ||
		lower === "project.yaml" ||
		lower === "cmakelists.txt" ||
		lower === "cargo.toml" ||
		lower === "package.json" ||
		lower.startsWith("config/")
	) {
		return "CONFIG";
	}

	return "OTHER";
}

/**
 * Retrieves per-file addition and deletion stats (+X -Y) via git diff numstat.
 */
export function getGitDiffStats(cwd: string): Map<string, { additions: number; deletions: number }> {
	const stats = new Map<string, { additions: number; deletions: number }>();

	const runNumstat = (args: string[]) => {
		const stdout = runGit(args, { cwd });
		if (stdout === null) return;
		for (const line of stdout.split("\n").filter(Boolean)) {
			const parts = line.split(/\s+/);
			if (parts.length >= 3) {
				const adds = parseInt(parts[0], 10) || 0;
				const dels = parseInt(parts[1], 10) || 0;
				const file = parts.slice(2).join(" ");
				const prev = stats.get(file);
				if (prev) {
					stats.set(file, { additions: prev.additions + adds, deletions: prev.deletions + dels });
				} else {
					stats.set(file, { additions: adds, deletions: dels });
				}
			}
		}
	};

	// Unstaged changes
	runNumstat(["diff", "--numstat"]);
	// Staged changes
	runNumstat(["diff", "--cached", "--numstat"]);

	return stats;
}

/**
 * Retrieves unified diff for a single file.
 */
export function getFileDiff(cwd: string, filePath: string): string {
	return (
		runGit(["diff", "HEAD", "--", filePath], { cwd }) ??
		runGit(["diff", "--", filePath], { cwd }) ??
		""
	);
}

export function getGitStatus(cwd: string): FileChange[] {
	// Porcelain output is whitespace-significant: a worktree-only change begins with
	// a space, so it must not be trimmed by the shared exec door.
	const stdout = runGit(["status", "--porcelain"], { cwd, trim: false });
	if (stdout === null) return [];

	try {
		const diffStats = getGitDiffStats(cwd);
		// Never trim the whole output: porcelain v1 prefixes each line with two status
		// columns plus a space, and a worktree-only change starts with a space. Trim
		// only the trailing newline, or the first entry loses its first character.
		const lines = stdout.replace(/\n+$/, "").split("\n").filter(Boolean);

		return lines.map((line) => {
			const status = line.slice(0, 2).trim();
			const rawPath = line.slice(3);
			// Renames and copies carry `old -> new`; the tracked path is the destination.
			const filePath = (rawPath.includes(" -> ") ? rawPath.split(" -> ").pop()! : rawPath).trim();
			const diff = diffStats.get(filePath);

			let additions = diff?.additions;
			let deletions = diff?.deletions;

			// Untracked new files
			if (status === "??" && additions === undefined) {
				try {
					const full = join(cwd, filePath);
					if (existsSync(full)) {
						const content = readFileSync(full, "utf8");
						additions = content.split("\n").length;
						deletions = 0;
					}
				} catch {}
			}

			return {
				path: filePath,
				status,
				category: classifyFile(filePath),
				additions,
				deletions,
			};
		});
	} catch {
		return [];
	}
}

export function inspectChanges(cwd: string): ChangesSummary {
	const changes = getGitStatus(cwd);

	const summary: ChangesSummary = {
		design: changes.filter((c) => c.category === "DESIGN"),
		code: changes.filter((c) => c.category === "CODE"),
		dataAssets: changes.filter((c) => c.category === "DATA_ASSETS"),
		production: changes.filter((c) => c.category === "PRODUCTION"),
		config: changes.filter((c) => c.category === "CONFIG"),
		other: changes.filter((c) => c.category === "OTHER"),
		driftWarnings: [],
	};

	// Detección de Drift de ODD: Código de gameplay modificado sin spec viva actualizada
	if (summary.code.length > 0 && summary.design.length === 0) {
		const gddDir = join(cwd, "design", "gdd");
		let hasGddFiles = false;
		if (existsSync(gddDir)) {
			try {
				const entries = readdirSync(gddDir);
				hasGddFiles = entries.some((f) => f.endsWith(".md"));
			} catch {}
		}

		if (hasGddFiles) {
			summary.driftWarnings.push(
				"ALERTA DRIFT: Se detectaron cambios en código de gameplay (CODE) sin modificaciones en las specs vivas (design/gdd/*.md).",
			);
		}
	}

	return summary;
}

function formatFileChangeRow(c: FileChange): string {
	const statStr =
		c.additions !== undefined || c.deletions !== undefined
			? ` (+${c.additions ?? 0} -${c.deletions ?? 0})`
			: "";
	return `  ${c.status.padEnd(2)} ${c.path}${statStr}`;
}

export function formatChangesOutput(
	summary: ChangesSummary,
	role: StudioThemeRoles = resolveStudioTheme(),
): string[] {
	// One card idiom: /changes draws the same rounded, coloured card as every
	// other studio surface, and the grouped detail hangs below it.
	const lines: string[] = renderChangesCard(summary, role);

	const totalChanges =
		summary.design.length +
		summary.code.length +
		summary.dataAssets.length +
		summary.production.length +
		summary.config.length +
		summary.other.length;

	if (totalChanges === 0) {
		return lines;
	}

	lines.push("");

	if (summary.design.length > 0) {
		lines.push(`[DESIGN] Especificaciones Vivas & Arte (${summary.design.length}):`);
		for (const c of summary.design) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.code.length > 0) {
		lines.push(`[CODE] Motor, Gameplay & Shaders (${summary.code.length}):`);
		for (const c of summary.code) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.dataAssets.length > 0) {
		lines.push(`[DATA/ASSETS] Tablas de Datos, Sprites & Audio (${summary.dataAssets.length}):`);
		for (const c of summary.dataAssets) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.production.length > 0) {
		lines.push(`[PRODUCTION] Roadmap, Tareas & Logs (${summary.production.length}):`);
		for (const c of summary.production) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.config.length > 0) {
		lines.push(`[CONFIG] Configuración de Motor & Proyecto (${summary.config.length}):`);
		for (const c of summary.config) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.other.length > 0) {
		lines.push(`[OTHER] Otros Archivos (${summary.other.length}):`);
		for (const c of summary.other) {
			lines.push(formatFileChangeRow(c));
		}
		lines.push("");
	}

	if (summary.driftWarnings.length > 0) {
		lines.push("────────────────────────────────────────────────────────────────────");
		for (const w of summary.driftWarnings) {
			lines.push(`⚠ ${w}`);
		}
		lines.push("────────────────────────────────────────────────────────────────────");
	}

	return lines;
}

/**
 * Renders the studio card for `/changes`: the rounded, coloured frame every
 * other studio surface uses, carrying the counts. The per-category detail is
 * appended by `formatChangesOutput`, so this card stays the single header
 * idiom rather than a second renderer nobody reaches.
 *
 * Semantic states (added/removed figures, drift warnings, muted labels) resolve
 * through `role`, so the card follows the host theme when one is configured.
 * The title stays on the studio accent: the brand never routes through a theme
 * token, which is the contract `palette.test.js` asserts.
 */
export function renderChangesCard(
	summary: ChangesSummary,
	role: StudioThemeRoles = resolveStudioTheme(),
): string[] {
	const groups: Array<[string, FileChange[]]> = [
		["DESIGN", summary.design],
		["CODE", summary.code],
		["DATA/ASSETS", summary.dataAssets],
		["PRODUCTION", summary.production],
		["CONFIG", summary.config],
		["OTHER", summary.other],
	];
	const all = groups.flatMap(([, files]) => files);

	let totalAdds = 0;
	let totalDels = 0;
	for (const f of all) {
		totalAdds += f.additions ?? 0;
		totalDels += f.deletions ?? 0;
	}

	const cardWidth = 66;
	const lines: string[] = [];
	// Emphasis stays on the accent role — the studio's title idiom — and the
	// palette's ornament budget is left exactly as the other cards found it.
	lines.push(
		panelTop(cardWidth, role.accent("CAMBIOS DEL ESTUDIO (STUDIO CHANGES)"), "rounded", BORDER),
	);
	lines.push(
		panelRow(role.muted("Clasificación rigurosa de modificaciones por naturaleza de juego"), cardWidth, BORDER),
	);
	lines.push(panelRule(cardWidth, "rounded", BORDER));

	if (all.length === 0) {
		lines.push(
			panelRow(role.success("✓ Árbol de trabajo limpio. No hay cambios pendientes en git."), cardWidth, BORDER),
		);
		lines.push(panelBottom(cardWidth, "rounded", BORDER));
		return lines;
	}

	lines.push(
		panelRow(
			` ${HEADING}${all.length} archivo(s) pendientes${RESET} ${role.muted("·")} ${role.success(`+${totalAdds}`)} ${role.error(`-${totalDels}`)}`,
			cardWidth,
			BORDER,
		),
	);
	const counts = groups
		.filter(([, files]) => files.length > 0)
		.map(([label, files]) => `${role.muted(label)} ${files.length}`)
		.join(` ${role.muted("·")} `);
	lines.push(panelRow(` ${counts}`, cardWidth, BORDER));

	if (summary.driftWarnings.length > 0) {
		lines.push(
			panelRow(
				` ${role.warn(`⚠ ${summary.driftWarnings.length} alerta(s) de drift ODD`)}`,
				cardWidth,
				BORDER,
			),
		);
	}

	lines.push(panelBottom(cardWidth, "rounded", BORDER));
	return lines;
}

export async function handleStudioChanges(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;

	// Diff inspection for a specific target file
	const trimmed = (args || "").trim();
	if (trimmed && !trimmed.startsWith("-")) {
		const target = trimmed.replace(/^--diff\s*/, "");
		const diff = getFileDiff(rootDir, target);
		if (diff) {
			console.log(`\n▎ DIFF INSPECTION: ${target}\n`);
			console.log(diff);
			return;
		} else {
			console.log(`▎ No se encontraron diferencias para: ${target}`);
		}
	}

	const summary = inspectChanges(rootDir);
	// The host gives a theme to the footer factory, not to a command handler, so
	// the role the studio is actually rendering with is read from the palette.
	const lines = formatChangesOutput(summary, getActiveThemeRole());

	for (const line of lines) {
		console.log(line);
	}

	const allChanges = [
		...summary.design,
		...summary.code,
		...summary.dataAssets,
		...summary.production,
		...summary.config,
		...summary.other,
	];

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(
			`Cambios pendientes: ${allChanges.length} archivo(s) detectados.`,
			summary.driftWarnings.length > 0 ? "warning" : "info",
		);
	}

	// Interactive modal: offer diff inspection if changed files exist and UI is active
	if (
		allChanges.length > 0 &&
		ctx.hasUI &&
		typeof (ctx.ui as any)?.select === "function" &&
		!trimmed
	) {
		const options = [
			"Cerrar (continuar sin inspeccionar)",
			...allChanges.map((c) => {
				const stat =
					c.additions !== undefined || c.deletions !== undefined
						? ` (+${c.additions ?? 0} -${c.deletions ?? 0})`
						: "";
				return `[${c.status}] ${c.path}${stat}`;
			}),
		];

		const picked = await (ctx.ui as any).select(
			"▎ Inspeccionar diff de archivo:",
			options,
		);

		if (picked && picked !== options[0]) {
			const pickedStr = typeof picked === "number" ? options[picked] : picked;
			const match = pickedStr.match(/^\[[^\]]+\]\s+([^\s(+]+)/);
			if (match && match[1]) {
				const diff = getFileDiff(rootDir, match[1]);
				if (diff) {
					console.log(`\n▎ DIFF: ${match[1]}\n`);
					console.log(diff);
				}
			}
		}
	}
}
