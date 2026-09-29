import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";

export interface StudioTask {
	id: string;
	title: string;
	sourceFile: string;
	status: "completed" | "in_progress" | "pending";
	isStale: boolean;
	staleReason?: string;
	lastModifiedDaysAgo?: number;
}

export interface TasksSummary {
	tasks: StudioTask[];
	totalCount: number;
	completedCount: number;
	inProgressCount: number;
	pendingCount: number;
	staleCount: number;
}

export function inspectStudioTasks(cwd: string): TasksSummary {
	const tasks: StudioTask[] = [];
	const now = Date.now();
	const STALE_THRESHOLD_DAYS = 3;

	// 1. Parsear roadmap principal
	const { hasRoadmap, roadmapPath } = readProducerState(cwd);
	if (hasRoadmap && roadmapPath && existsSync(roadmapPath)) {
		try {
			const content = readFileSync(roadmapPath, "utf8");
			const stat = statSync(roadmapPath);
			const daysAgo = Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24));
			const lines = content.split("\n");

			lines.forEach((line, idx) => {
				const trimmed = line.trim();
				const checkMatch = trimmed.match(/^-\s*\[([ x/])\]\s*(.+)$/i);
				if (checkMatch) {
					const mark = checkMatch[1].toLowerCase();
					const title = checkMatch[2].trim();
					const status = mark === "x" ? "completed" : mark === "/" ? "in_progress" : "pending";
					const isStale = status !== "completed" && daysAgo >= STALE_THRESHOLD_DAYS;

					tasks.push({
						id: `roadmap-${idx + 1}`,
						title,
						sourceFile: "production/roadmap.md",
						status,
						isStale,
						staleReason: isStale ? `Sin actividad hace ${daysAgo} días` : undefined,
						lastModifiedDaysAgo: daysAgo,
					});
				}
			});
		} catch {}
	}

	// 2. Parsear Live Specs en design/gdd/*.md
	const gddDir = join(cwd, "design", "gdd");
	if (existsSync(gddDir)) {
		try {
			const files = readdirSync(gddDir).filter((f) => f.endsWith(".md"));
			for (const file of files) {
				const fullPath = join(gddDir, file);
				try {
					const content = readFileSync(fullPath, "utf8");
					const stat = statSync(fullPath);
					const daysAgo = Math.floor((now - stat.mtimeMs) / (1000 * 60 * 60 * 24));
					const lines = content.split("\n");

					lines.forEach((line, idx) => {
						const trimmed = line.trim();
						const checkMatch = trimmed.match(/^-\s*\[([ x/])\]\s*(.+)$/i);
						if (checkMatch) {
							const mark = checkMatch[1].toLowerCase();
							const title = checkMatch[2].trim();
							const status = mark === "x" ? "completed" : mark === "/" ? "in_progress" : "pending";
							const isStale = status !== "completed" && daysAgo >= STALE_THRESHOLD_DAYS;

							tasks.push({
								id: `${file.replace(".md", "")}-${idx + 1}`,
								title,
								sourceFile: `design/gdd/${file}`,
								status,
								isStale,
								staleReason: isStale ? `Spec inactiva hace ${daysAgo} días` : undefined,
								lastModifiedDaysAgo: daysAgo,
							});
						}
					});
				} catch {}
			}
		} catch {}
	}

	return {
		tasks,
		totalCount: tasks.length,
		completedCount: tasks.filter((t) => t.status === "completed").length,
		inProgressCount: tasks.filter((t) => t.status === "in_progress").length,
		pendingCount: tasks.filter((t) => t.status === "pending").length,
		staleCount: tasks.filter((t) => t.isStale).length,
	};
}

export function formatTasksOutput(summary: TasksSummary): string[] {
	const lines: string[] = [];

	lines.push("┌── STUDIO TASKS: GESTIÓN DE TAREAS & RADAR DE OBSOLESCENCIA ────┐");
	lines.push(`│ Total: ${summary.totalCount} · Completadas: ${summary.completedCount} · En Progreso: ${summary.inProgressCount} · Pendientes: ${summary.pendingCount} │`);
	if (summary.staleCount > 0) {
		lines.push(`│ ⚠ TAREAS OBSOLETAS / STALE DETECTADAS: ${summary.staleCount}                          │`);
	}
	lines.push("└─────────────────────────────────────────────────────────────────┘");
	lines.push("");

	if (summary.totalCount === 0) {
		lines.push("No se detectaron tareas activas en production/roadmap.md ni en design/gdd/*.md.");
		lines.push("Usa /game-design-document o /start para planificar el siguiente sprint.");
		return lines;
	}

	// Agrupar por fuente
	const sources = [...new Set(summary.tasks.map((t) => t.sourceFile))];
	for (const src of sources) {
		const groupTasks = summary.tasks.filter((t) => t.sourceFile === src);
		lines.push(`• Origen: ${src}`);
		for (const t of groupTasks) {
			const badge = t.status === "completed" ? "[x]" : t.status === "in_progress" ? "[/]" : "[ ]";
			const staleTag = t.isStale ? ` (⚠ STALE: ${t.staleReason})` : "";
			lines.push(`  ${badge} ${t.title}${staleTag}`);
		}
		lines.push("");
	}

	return lines;
}

export async function handleStudioTasks(
	_args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const summary = inspectStudioTasks(rootDir);
	const lines = formatTasksOutput(summary);

	for (const line of lines) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(
			`Tareas: ${summary.completedCount}/${summary.totalCount} listas. ${summary.staleCount > 0 ? `(${summary.staleCount} stale)` : ""}`,
			summary.staleCount > 0 ? "warning" : "info",
		);
	}
}
