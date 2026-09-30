import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { inspectStudioTasks, type StudioTask } from "./studio-tasks.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[38;2;52;211;153m";
const YELLOW = "\x1b[38;2;251;191;36m";
const GRAY = "\x1b[38;2;156;163;175m";
const VIOLET = "\x1b[38;2;167;139;250m";
const WHITE = "\x1b[38;2;243;244;246m";

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

	const innerWidth = width - 4;
	const pad = (str: string, len: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
	};

	const truncate = (str: string, maxLen: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		if (visibleLen <= maxLen) return str;
		return str.slice(0, maxLen - 1) + "…";
	};

	const lines: string[] = [];
	lines.push(`${DIM}┌──${RESET} ${VIOLET}${BOLD}TAREAS ACTIVAS (ODD / Roadmap)${RESET} ${DIM}${"─".repeat(Math.max(0, width - 36))}┐${RESET}`);

	// Prioritize: in_progress first, then pending (up to 4 items), then completed (up to 2 items)
	const inProg = tasks.filter((t) => t.status === "in_progress");
	const pending = tasks.filter((t) => t.status === "pending");
	const completed = tasks.filter((t) => t.status === "completed");

	const displayTasks: StudioTask[] = [
		...inProg,
		...pending.slice(0, 3),
		...completed.slice(-2),
	].slice(0, 6);

	for (const task of displayTasks) {
		let icon = `${GRAY}[ ]${RESET}`;
		let titleColor = WHITE;

		if (task.status === "completed") {
			icon = `${GREEN}[x]${RESET}`;
			titleColor = DIM;
		} else if (task.status === "in_progress") {
			icon = `${YELLOW}[/]${RESET}`;
			titleColor = `${BOLD}${WHITE}`;
		}

		let rowText = `${icon} ${titleColor}${task.title}${RESET}`;
		if (task.isStale) {
			rowText += ` ${YELLOW}${DIM}(stale)${RESET}`;
		}

		const truncatedRow = truncate(rowText, innerWidth);
		lines.push(`${DIM}│${RESET} ${pad(truncatedRow, innerWidth)} ${DIM}│${RESET}`);
	}

	const remaining = tasks.length - displayTasks.length;
	if (remaining > 0) {
		const more = `${DIM}... y ${remaining} tarea(s) más (/studio:tasks)${RESET}`;
		lines.push(`${DIM}│${RESET} ${pad(more, innerWidth)} ${DIM}│${RESET}`);
	}

	lines.push(`${DIM}└${"─".repeat(innerWidth + 2)}┘${RESET}`);
	return lines;
}

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
	if (summary.totalCount === 0 || summary.tasks.length === 0) {
		(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, undefined);
		return;
	}

	(ctx.ui as any).setWidget(TASKS_WIDGET_KEY, (_tui: any, _theme: any) => ({
		render(width: number) {
			return renderTasksWidgetCard(summary.tasks, width || 74);
		},
		invalidate() {},
	}));
}
