import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "child_process";
import { existsSync, readdirSync } from "fs";
import { join } from "path";
import { findStudioRoot } from "./studio-root.ts";

export type ChangeCategory = "DESIGN" | "CODE" | "DATA_ASSETS" | "PRODUCTION" | "CONFIG" | "OTHER";

export interface FileChange {
	path: string;
	status: string; // "M", "A", "D", "??"
	category: ChangeCategory;
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

export function getGitStatus(cwd: string): FileChange[] {
	try {
		const stdout = execSync("git status --porcelain", {
			encoding: "utf-8",
			cwd,
		});

		const lines = stdout.trim().split("\n").filter(Boolean);
		return lines.map((line) => {
			const status = line.slice(0, 2).trim();
			const filePath = line.slice(3).trim();
			return {
				path: filePath,
				status,
				category: classifyFile(filePath),
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

export function formatChangesOutput(summary: ChangesSummary): string[] {
	const lines: string[] = [];

	lines.push("┌── CAMBIOS DEL ESTUDIO (GENTLE CHANGES) ──────────────────────────┐");
	lines.push("│ Clasificación rigurosa de modificaciones por naturaleza de juego │");
	lines.push("└──────────────────────────────────────────────────────────────────┘");
	lines.push("");

	const totalChanges =
		summary.design.length +
		summary.code.length +
		summary.dataAssets.length +
		summary.production.length +
		summary.config.length +
		summary.other.length;

	if (totalChanges === 0) {
		lines.push("✔ Árbol de trabajo limpio. No hay cambios pendientes en git.");
		return lines;
	}

	if (summary.design.length > 0) {
		lines.push(`[DESIGN] Especificaciones Vivas & Arte (${summary.design.length}):`);
		for (const c of summary.design) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
		}
		lines.push("");
	}

	if (summary.code.length > 0) {
		lines.push(`[CODE] Motor, Gameplay & Shaders (${summary.code.length}):`);
		for (const c of summary.code) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
		}
		lines.push("");
	}

	if (summary.dataAssets.length > 0) {
		lines.push(`[DATA/ASSETS] Tablas de Datos, Sprites & Audio (${summary.dataAssets.length}):`);
		for (const c of summary.dataAssets) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
		}
		lines.push("");
	}

	if (summary.production.length > 0) {
		lines.push(`[PRODUCTION] Roadmap, Tareas & Logs (${summary.production.length}):`);
		for (const c of summary.production) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
		}
		lines.push("");
	}

	if (summary.config.length > 0) {
		lines.push(`[CONFIG] Configuración de Motor & Proyecto (${summary.config.length}):`);
		for (const c of summary.config) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
		}
		lines.push("");
	}

	if (summary.other.length > 0) {
		lines.push(`[OTHER] Otros Archivos (${summary.other.length}):`);
		for (const c of summary.other) {
			lines.push(`  ${c.status.padEnd(2)} ${c.path}`);
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

export async function handleStudioChanges(
	_args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const summary = inspectChanges(rootDir);
	const lines = formatChangesOutput(summary);

	for (const line of lines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const count =
			summary.design.length +
			summary.code.length +
			summary.dataAssets.length +
			summary.production.length +
			summary.config.length +
			summary.other.length;

		ctx.ui.notify(
			`Cambios pendientes: ${count} archivo(s) detectados.`,
			summary.driftWarnings.length > 0 ? "warning" : "info",
		);
	}
}
