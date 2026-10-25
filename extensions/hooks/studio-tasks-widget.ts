import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { inspectStudioTasks, type StudioTask } from "./studio-tasks.ts";
import { renderStudioStatusCard, inferOddPhase } from "./studio-hud.ts";
import { readProducerState } from "./studio-start.ts";

import {
	RESET,
	DIM,
	GREEN,
	YELLOW,
	GRAY,
	ACCENT as BLUE,
	HEADING as LAVENDER,
	WHITE,
	BORDER,
	truncateAnsi,
	padAnsi,
	panelBottom,
	panelRow,
	panelTop,
	resolveStudioTheme,
	type StudioThemeRoles,
} from "./studio-palette.ts";

export const TASKS_WIDGET_KEY = "studio-tasks";

export function isTasksCardCollapsed(studioRoot: string): boolean {
	const flag = join(studioRoot, ".pi", "game-studio", "tasks-collapsed");
	return existsSync(flag);
}

export function setTasksCardCollapsed(studioRoot: string, collapsed: boolean): void {
	const flag = join(studioRoot, ".pi", "game-studio", "tasks-collapsed");
	if (collapsed) {
		try {
			mkdirSync(dirname(flag), { recursive: true });
			writeFileSync(flag, "true", "utf8");
		} catch {}
	} else {
		if (existsSync(flag)) {
			try {
				unlinkSync(flag);
			} catch {}
		}
	}
}

export function isTasksWidgetEnabled(studioRoot: string): boolean {
	const disabledFlag = join(studioRoot, ".pi", "game-studio", "widget-tasks-disabled");
	return !existsSync(disabledFlag);
}

export function setTasksWidgetEnabled(studioRoot: string, enabled: boolean): void {
	const flag = join(studioRoot, ".pi", "game-studio", "widget-tasks-disabled");
	if (enabled) {
		if (existsSync(flag)) {
			try {
				unlinkSync(flag);
			} catch {}
		}
	} else {
		try {
			writeFileSync(flag, "true", "utf8");
		} catch {}
	}
}

export function renderTasksWidgetCard(
	tasks: StudioTask[] = [],
	width: number = 74,
	collapsed?: boolean,
	studioRoot?: string,
	role?: StudioThemeRoles,
): string[] {
	// Total by construction: without a theme handle the studio palette is used as-is.
	const r = role ?? resolveStudioTheme();
	const isCollapsed = collapsed !== undefined
		? collapsed
		: (studioRoot ? isTasksCardCollapsed(studioRoot) : false);

	const cardWidth = Math.min(Math.max(width - 4, 46), 56);
	const innerWidth = cardWidth - 4;

	// Si hay tareas de un Live Spec en design/gdd/, ese es el foco activo de implementación ODD.
	// Priorizamos el Live Spec activo para evitar sobrecarga cognitiva con sprints históricos del roadmap.
	const gddTasks = tasks.filter((t) => t.sourceFile.startsWith("design/gdd/"));
	const targetTasks = gddTasks.length > 0 ? gddTasks : tasks;

	const completedCount = targetTasks.filter((t) => t.status === "completed").length;
	const activeFeature = gddTasks.length > 0
		? (gddTasks[0].sourceFile.split("/").pop()?.replace(".md", "") || "")
		: "";

	const countSummary = targetTasks.length > 0
		? (activeFeature ? `${activeFeature}: ${completedCount} of ${targetTasks.length}` : `${completedCount} of ${targetTasks.length}`)
		: "0 tareas";

	let phaseChip = "";
	let nextStep = "";
	if (studioRoot) {
		try {
			const { state: prodState } = readProducerState(studioRoot);
			if (prodState) {
				phaseChip = inferOddPhase(prodState);
				nextStep = prodState.nextStep || "";
			}
		} catch {}
	}

	const titleBase = phaseChip ? `▶ Tasks ${phaseChip} · ${countSummary}` : `▶ Tasks · ${countSummary}`;

	const lines: string[] = [];
	if (isCollapsed) {
		const rawTitle = `${titleBase} [collapsed]`;
		const maxTitleLen = Math.max(10, cardWidth - 7);
		const displayTitle = rawTitle.length > maxTitleLen ? truncateAnsi(rawTitle, maxTitleLen) : rawTitle;
		const titleStyled = `${r.accent(displayTitle)}${RESET}`;
		lines.push(`  ${panelTop(cardWidth - 2, titleStyled, "rounded", BORDER)}`);
		lines.push(`  ${panelBottom(cardWidth - 2, "rounded", BORDER)}`);
		return lines;
	}

	const titleText = titleBase;
	const titleStyled = `${r.accent(titleText)}${RESET}`;
	lines.push(`  ${panelTop(cardWidth - 2, titleStyled, "rounded", BORDER)}`);

	if (tasks.length === 0) {
		lines.push(`  ${panelRow(`  ${r.muted("○")}${RESET} ${DIM}Sin tareas activas (/concept o /tasks)${RESET}`, innerWidth + 2, BORDER)}`);
		if (nextStep) {
			lines.push(`  ${panelRow("", innerWidth + 2, BORDER)}`);
			const nextLine = truncateAnsi(`  ${r.success("→")}${RESET} ${r.muted(nextStep)}${RESET}`, innerWidth);
			lines.push(`  ${panelRow(nextLine, innerWidth + 2, BORDER)}`);
		}
		lines.push(`  ${panelBottom(cardWidth - 2, "rounded", BORDER)}`);
		return lines;
	}

	// Prioritize: in_progress first, then pending (up to 4 items), then completed (up to 3 items)
	const inProg = targetTasks.filter((t) => t.status === "in_progress");
	const pending = targetTasks.filter((t) => t.status === "pending");
	const completed = targetTasks.filter((t) => t.status === "completed");

	const displayTasks: StudioTask[] = [
		...inProg,
		...pending.slice(0, 4),
		...completed.slice(-3),
	].slice(0, 7);

	for (const task of displayTasks) {
		let icon = `${r.muted("○")}`;
		let titleColor = (t: string) => r.text(t);

		if (task.status === "completed") {
			icon = `${r.success("✓")}`;
			titleColor = (t: string) => `${DIM}${r.muted(t)}`;
		} else if (task.status === "in_progress") {
			icon = `${r.warn("◐")}`;
			titleColor = (t: string) => r.text(t);
		}

		let rowText = `${icon} ${titleColor(task.title)}${RESET}`;
		if (task.isStale) {
			rowText += ` ${r.warn(`${DIM}(stale)`)}${RESET}`;
		}

		const truncatedRow = truncateAnsi(rowText, innerWidth);
		lines.push(`  ${panelRow(truncatedRow, innerWidth + 2, BORDER)}`);
	}

	const remaining = targetTasks.length - displayTasks.length;
	if (remaining > 0) {
		const more = `${DIM}... y ${remaining} tarea(s) más (/studio:tasks)${RESET}`;
		lines.push(`  ${panelRow(more, innerWidth + 2, BORDER)}`);
	}

	if (nextStep) {
		lines.push(`  ${panelRow("", innerWidth + 2, BORDER)}`);
		const nextLine = truncateAnsi(`  ${r.success("→")}${RESET} ${r.muted(nextStep)}${RESET}`, innerWidth);
		lines.push(`  ${panelRow(nextLine, innerWidth + 2, BORDER)}`);
	}

	lines.push(`  ${panelBottom(cardWidth - 2, "rounded", BORDER)}`);
	return lines;
}

import {
	isStudioSidebarActive,
	invalidateStudioSidebar,
} from "./studio-sidebar.ts";

export function updateTasksWidget(ctx: ExtensionContext): void {
	if (!(ctx as any).hasUI || typeof (ctx.ui as any)?.setWidget !== "function") {
		return;
	}

	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	if (!isTasksWidgetEnabled(studioRoot)) {
		(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, undefined);
		return;
	}

	const summary = inspectStudioTasks(studioRoot);
	// If no real tasks in project, keep screen clean and quiet (Zero noise)
	if (summary.totalCount === 0 || summary.tasks.length === 0) {
		(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, undefined);
		return;
	}

	(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, (tui: any, theme: any) => {
		const role = resolveStudioTheme(theme);
		return {
			render(width: number) {
				// If fullscreen right rail sidebar is active, suppress bottom dock
				if (tui && isStudioSidebarActive(tui)) {
					return [];
				}
				const statusLines = renderStudioStatusCard(ctx, studioRoot, width || 74, undefined, role);
				const taskLines = renderTasksWidgetCard(summary.tasks, width || 74, undefined, studioRoot, role);
				return [...statusLines, "", ...taskLines];
			},
			invalidate() {
				invalidateStudioSidebar(tui);
			},
		};
	});
}

