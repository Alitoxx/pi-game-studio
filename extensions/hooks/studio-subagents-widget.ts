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
	SECONDARY,
	WHITE,
	RED,
	resolveStudioTheme,
	type StudioThemeRoles,
} from "./studio-palette.ts";

export const AGENTS_WIDGET_KEY = "studio-subagents";

export const SPECIALIST_ENGINE_TAGS: Record<string, string> = {
	"bevy-specialist": "[Bevy]",
	"godot-specialist": "[Godot]",
	"phaser-specialist": "[Phaser]",
	"raylib-specialist": "[Raylib]",
	"unity-specialist": "[Unity]",
	"unreal-specialist": "[Unreal]",
};

export function getAgentEngineTag(agent: string): string {
	if (SPECIALIST_ENGINE_TAGS[agent]) {
		return SPECIALIST_ENGINE_TAGS[agent];
	}
	const lower = agent.toLowerCase();
	if (lower.includes("bevy")) return "[Bevy]";
	if (lower.includes("godot")) return "[Godot]";
	if (lower.includes("phaser")) return "[Phaser]";
	if (lower.includes("raylib")) return "[Raylib]";
	if (lower.includes("unity")) return "[Unity]";
	if (lower.includes("unreal")) return "[Unreal]";
	return "";
}

function stripAnsi(text: string): string {
	return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function formatElapsed(ms: number): string {
	const total = Math.max(0, Math.floor(ms / 1000));
	if (total < 60) return `${total}s`;
	const minutes = Math.floor(total / 60);
	if (minutes < 60) return `${minutes}m${String(total % 60).padStart(2, "0")}s`;
	return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * Sovereign Gamedev Console Engine Dispatch telemetry widget.
 * Uses authentic gamedev pipeline badges:
 * ◐ COMPILANDO (amber), ✓ OK (green), ✗ BLOQUEADO (red), ○ EN COLA (gray),
 * and engine tags ([Bevy], [Godot], [Raylib], [Unity], [Unreal]) for specialists.
 */
export function renderSubagentsWidgetCard(tasks: TaskRecord[], width: number = 74, role?: StudioThemeRoles): string[] {
	if (!tasks || tasks.length === 0) return [];

	// Total by construction: without a theme handle the studio palette is used as-is.
	const r = role ?? resolveStudioTheme();

	const activeTasks = tasks.filter(
		(t) => t.status === "running" || t.status === "queued" || (t.endedAt && Date.now() - t.endedAt < 60000)
	).slice(0, 4);

	if (activeTasks.length === 0) return [];

	const targetWidth = Math.max(40, width);
	const contentWidth = targetWidth;

	const runningCount = activeTasks.filter((t) => t.status === "running").length;
	const countText = runningCount > 0 ? `${runningCount} active` : "reciente";

	const lines: string[] = [];

	// Top padding
	lines.push("");

	// Header: ENGINE DISPATCH  <N> active (or reciente)
	const headerTitle = `${r.accent(BOLD + "ENGINE DISPATCH")}${RESET}  ${DIM}${countText}${RESET}`;
	lines.push(headerTitle);

	// Spacing between header and items
	lines.push("");

	const now = Date.now();
	for (const task of activeTasks) {
		let statusBadge = `${r.muted("○ EN COLA")}`;
		if (task.status === "completed") {
			statusBadge = `${r.success("✓ OK")}`;
		} else if (task.status === "running") {
			statusBadge = `${r.warn("◐ COMPILANDO")}`;
		} else if (task.status === "failed") {
			statusBadge = `${r.error("✗ BLOQUEADO")}`;
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

		// Format specialist engine tag and agent name
		const engineTag = getAgentEngineTag(task.agent);
		const enginePrefix = engineTag ? `${SECONDARY}${engineTag}${RESET} ` : "";
		const leftPrefix = `${statusBadge}  ${enginePrefix}${r.text(task.agent)}${RESET}  `;

		const rawActivity = (task.latestActivity || task.task).replace(/\s+/g, " ").trim();
		const leftVisible = stripAnsi(leftPrefix).length;
		const teleVisible = stripAnsi(telemetryStr).length;

		const maxActivityLen = contentWidth - leftVisible - teleVisible - 2;
		if (maxActivityLen > 6) {
			const activityDisplay = rawActivity.length > maxActivityLen
				? (maxActivityLen > 1 ? rawActivity.slice(0, maxActivityLen - 1) + "…" : "")
				: rawActivity;
			const spacesCount = Math.max(2, contentWidth - leftVisible - activityDisplay.length - teleVisible);
			const row = `${leftPrefix}${r.text(activityDisplay)}${RESET}${" ".repeat(spacesCount)}${DIM}${telemetryStr}${RESET}`;
			lines.push(row);
		} else {
			// Compact row for narrow viewports
			const row = `${leftPrefix}${DIM}${telemetryStr}${RESET}`;
			lines.push(row);
		}
	}

	// Bottom padding
	lines.push("");

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

	(ctx.ui as any).setWidget(AGENTS_WIDGET_KEY, (tui: any, theme: any) => {
		const role = resolveStudioTheme(theme);
		return {
			render(width: number) {
				if (tui && isStudioSidebarActive(tui)) {
					return [];
				}
				return renderSubagentsWidgetCard(activeTasks, width || 74, role);
			},
			invalidate() {
				invalidateStudioSidebar(tui);
			},
		};
	});
}
