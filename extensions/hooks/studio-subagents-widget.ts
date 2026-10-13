import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { studioAgentsRunner, type TaskRecord } from "./studio-agents-runner.ts";
import { isStudioSidebarActive, invalidateStudioSidebar } from "./studio-sidebar.ts";
import { loadAgentManifest } from "./studio-agent-loader.ts";

import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	GRAY,
	ACCENT as BLUE,
	WHITE,
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

/**
 * Signature Gentle Shell style subagents widget card.
 * Uses a left vertical accent bar (▎) instead of closed box borders,
 * right-aligned telemetry strings, and clean spacing.
 */
export function renderSubagentsWidgetCard(tasks: TaskRecord[], width: number = 74): string[] {
	if (!tasks || tasks.length === 0) return [];

	const activeTasks = tasks.filter(
		(t) => t.status === "running" || t.status === "queued" || (t.endedAt && Date.now() - t.endedAt < 60000)
	).slice(0, 4);

	if (activeTasks.length === 0) return [];

	const targetWidth = Math.max(40, width);
	const contentWidth = targetWidth - 2; // Reserve 2 columns for "▎ "

	const runningCount = activeTasks.filter((t) => t.status === "running").length;
	const countText = runningCount > 0 ? `${runningCount} active` : "reciente";

	const bar = `${BLUE}▎${RESET}`;
	const lines: string[] = [];

	// Top padding bar
	lines.push(bar);

	// Header: ▎ ❀ Agents  <N> active (or reciente)
	const headerTitle = `${BLUE}❀ Agents${RESET}  ${DIM}${countText}${RESET}`;
	lines.push(`${bar} ${headerTitle}`);

	// Spacing bar between header and items
	lines.push(bar);

	const now = Date.now();
	for (const task of activeTasks) {
		let icon = `${GRAY}○${RESET}`;
		if (task.status === "completed") {
			icon = `${GREEN}✓${RESET}`;
		} else if (task.status === "running") {
			icon = `${YELLOW}◐${RESET}`;
		} else if (task.status === "failed") {
			icon = `${RED}✗${RESET}`;
		}

		// Calculate elapsed runtime
		const elapsedMs = task.startedAt
			? (task.endedAt ? task.endedAt - task.startedAt : now - task.startedAt)
			: 0;
		const elapsedStr = formatElapsed(elapsedMs);

		// Build telemetry string: model · thinking · elapsed
		const teleParts: string[] = [];
		if (task.model && task.model !== "inherit") {
			const shortModel = task.model.split("/").pop() || task.model;
			teleParts.push(shortModel);
		}
		try {
			const manifest = loadAgentManifest(task.agent, task.cwd);
			if (manifest?.thinking) {
				teleParts.push(manifest.thinking);
			}
		} catch {}
		teleParts.push(elapsedStr);
		const telemetryStr = teleParts.join(" · ");

		// Format row: glyph, agent name in bold/white, activity, right-aligned telemetry
		const rawActivity = (task.latestActivity || task.task).replace(/\s+/g, " ").trim();
		const leftPrefix = `${icon}  ${BOLD}${WHITE}${task.agent}${RESET}  `;
		const leftVisible = 1 + 2 + task.agent.length + 2; // glyph (1) + "  " (2) + agent (len) + "  " (2)
		const teleVisible = telemetryStr.length;

		const maxActivityLen = contentWidth - leftVisible - teleVisible - 2;
		if (maxActivityLen > 6) {
			const activityDisplay = rawActivity.length > maxActivityLen
				? (maxActivityLen > 1 ? rawActivity.slice(0, maxActivityLen - 1) + "…" : "")
				: rawActivity;
			const spacesCount = Math.max(2, contentWidth - leftVisible - activityDisplay.length - teleVisible);
			const row = `${leftPrefix}${WHITE}${activityDisplay}${RESET}${" ".repeat(spacesCount)}${DIM}${telemetryStr}${RESET}`;
			lines.push(`${bar} ${row}`);
		} else {
			// Compact row for narrow viewports
			const row = `${icon}  ${BOLD}${WHITE}${task.agent}${RESET}  ${DIM}${telemetryStr}${RESET}`;
			lines.push(`${bar} ${row}`);
		}
	}

	// Bottom padding bar
	lines.push(bar);

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
