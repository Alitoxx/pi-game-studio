import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { studioAgentsRunner, type TaskRecord } from "./studio-agents-runner.ts";
import { isStudioSidebarActive, invalidateStudioSidebar } from "./studio-sidebar.ts";

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
	RED,
} from "./studio-palette.ts";

export const AGENTS_WIDGET_KEY = "studio-subagents";

export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	if (total < 60) return `${total}s`;
	const minutes = Math.floor(total / 60);
	if (minutes < 60) return `${minutes}m${String(total % 60).padStart(2, "0")}s`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

export function renderSubagentsWidgetCard(tasks: TaskRecord[], width: number = 74): string[] {
	if (!tasks || tasks.length === 0) return [];

	const activeTasks = tasks.filter(
		(t) => t.status === "running" || t.status === "queued" || (t.endedAt && Date.now() - t.endedAt < 60000)
	).slice(0, 4);

	if (activeTasks.length === 0) return [];

	const cardWidth = Math.min(Math.max(width - 4, 46), 56);
	const innerWidth = cardWidth - 4;

	const pad = (str: string, len: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
	};

	const truncate = (str: string, maxLen: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		if (visibleLen <= maxLen) return str;
		return str.slice(0, maxLen - 1) + "…";
	};

	const runningCount = activeTasks.filter((t) => t.status === "running").length;
	const lines: string[] = [];
	const titleText = `❀ Subagents · ${runningCount > 0 ? `${runningCount} activo(s)` : "reciente"}`;
	const titleStyled = `${BLUE}${titleText}${RESET}`;
	const ruleLen = Math.max(0, cardWidth - titleText.length - 7);
	lines.push(`  ${BORDER}╭─${RESET} ${titleStyled} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);

	const now = Date.now();
	for (const task of activeTasks) {
		let icon = `${GRAY}○${RESET}`;
		let stateColor = WHITE;

		if (task.status === "completed") {
			icon = `${GREEN}✓${RESET}`;
			stateColor = `${DIM}${GRAY}`;
		} else if (task.status === "running") {
			icon = `${YELLOW}◐${RESET}`;
			stateColor = `${BOLD}${WHITE}`;
		} else if (task.status === "failed") {
			icon = `${RED}✗${RESET}`;
			stateColor = `${RED}`;
		}

		const elapsedMs = task.startedAt
			? (task.endedAt ? task.endedAt - task.startedAt : now - task.startedAt)
			: 0;
		const elapsedStr = formatElapsed(elapsedMs);

		// Fila 1: Glifo, Nombre del Agente, Modelo, Tiempo transcurrido
		const modelTag = task.model ? ` ${DIM}${task.model.split("/").pop()}${RESET}` : "";
		const headerRow = `${icon} ${stateColor}${task.agent}${RESET}${modelTag} ${DIM}${elapsedStr}${RESET}`;
		lines.push(`  ${BORDER}│${RESET} ${pad(truncate(headerRow, innerWidth), innerWidth)} ${BORDER}│${RESET}`);

		// Fila 2: Actividad en curso o tarea
		const activity = task.latestActivity || task.task.slice(0, 35);
		const detailRow = `  ${DIM}└─ ${activity}${RESET}`;
		lines.push(`  ${BORDER}│${RESET} ${pad(truncate(detailRow, innerWidth), innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`  ${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
	return lines;
}

export function installSubagentsWidget(ctx: ExtensionContext): void {
	if (!(ctx as any).hasUI || typeof (ctx.ui as any)?.setWidget !== "function") {
		return;
	}

	// Suscribirse a cambios en los subagentes para re-renderizar en vivo
	studioAgentsRunner.subscribe(() => {
		try {
			updateSubagentsWidget(ctx);
		} catch {}
	});
}

export function updateSubagentsWidget(ctx: ExtensionContext): void {
	if (!(ctx as any).hasUI || typeof (ctx.ui as any)?.setWidget !== "function") {
		return;
	}

	const tasks = studioAgentsRunner.listTasks();
	const activeTasks = tasks.filter(
		(t) => t.status === "running" || t.status === "queued" || (t.endedAt && Date.now() - t.endedAt < 45000)
	);

	if (activeTasks.length === 0) {
		(ctx.ui as any).setWidget(AGENTS_WIDGET_KEY, undefined);
		return;
	}

	(ctx.ui as any).setWidget(AGENTS_WIDGET_KEY, (tui: any, _theme: any) => ({
		render(width: number) {
			if (tui && isStudioSidebarActive(tui)) {
				return [];
			}
			return renderSubagentsWidgetCard(activeTasks, width || 74);
		},
		invalidate() {
			invalidateStudioSidebar(tui);
		},
	}));
}
