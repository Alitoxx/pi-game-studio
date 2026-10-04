import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { inspectStudioTasks, type StudioTask } from "./studio-tasks.ts";
import { renderStudioStatusCard } from "./studio-hud.ts";

import {
	RESET,
	BOLD,
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
} from "./studio-palette.ts";

export const TASKS_WIDGET_KEY = "studio-tasks";

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

export function renderTasksWidgetCard(tasks: StudioTask[], width: number = 74): string[] {
	if (!tasks || tasks.length === 0) return [];

	const cardWidth = Math.min(Math.max(width - 4, 46), 56);
	const innerWidth = cardWidth - 4;

	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const countSummary = `${completedCount} of ${tasks.length}`;

	const lines: string[] = [];
	const titleText = `❀ Tasks · ${countSummary}`;
	const titleStyled = `${BLUE}${titleText}${RESET}`;
	const ruleLen = Math.max(0, cardWidth - titleText.length - 7);
	lines.push(`  ${BORDER}╭─${RESET} ${titleStyled} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);

	// Prioritize: in_progress first, then pending (up to 4 items), then completed (up to 3 items)
	const inProg = tasks.filter((t) => t.status === "in_progress");
	const pending = tasks.filter((t) => t.status === "pending");
	const completed = tasks.filter((t) => t.status === "completed");

	const displayTasks: StudioTask[] = [
		...inProg,
		...pending.slice(0, 4),
		...completed.slice(-3),
	].slice(0, 7);

	for (const task of displayTasks) {
		let icon = `${GRAY}○${RESET}`;
		let titleColor = WHITE;

		if (task.status === "completed") {
			icon = `${GREEN}✓${RESET}`;
			titleColor = `${DIM}${GRAY}`;
		} else if (task.status === "in_progress") {
			icon = `${YELLOW}◐${RESET}`;
			titleColor = `${BOLD}${WHITE}`;
		}

		let rowText = `${icon} ${titleColor}${task.title}${RESET}`;
		if (task.isStale) {
			rowText += ` ${YELLOW}${DIM}(stale)${RESET}`;
		}

		const truncatedRow = truncateAnsi(rowText, innerWidth);
		lines.push(`  ${BORDER}│${RESET} ${padAnsi(truncatedRow, innerWidth)} ${BORDER}│${RESET}`);
	}

	const remaining = tasks.length - displayTasks.length;
	if (remaining > 0) {
		const more = `${DIM}... y ${remaining} tarea(s) más (/studio:tasks)${RESET}`;
		lines.push(`  ${BORDER}│${RESET} ${padAnsi(more, innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`  ${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
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

	(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, (tui: any, _theme: any) => ({
		render(width: number) {
			// If fullscreen right rail sidebar is active, suppress bottom dock
			if (tui && isStudioSidebarActive(tui)) {
				return [];
			}
			const statusLines = renderStudioStatusCard(ctx, studioRoot, width || 74);
			const taskLines = renderTasksWidgetCard(summary.tasks, width || 74);
			return [...statusLines, "", ...taskLines];
		},
		invalidate() {
			invalidateStudioSidebar(tui);
		},
	}));
}

