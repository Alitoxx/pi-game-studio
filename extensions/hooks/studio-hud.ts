import type { ExtensionContext, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";
import { inspectSetup } from "./studio-setup.ts";

import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	RED,
	ACCENT as BLUE,
	HEADING as LAVENDER,
	WHITE,
	GRAY,
	BORDER,
	truncateAnsi,
	padAnsi,
} from "./studio-palette.ts";

export interface ContextUsageInfo {
	tokens: number;
	contextWindow: number;
	percent: number;
}

export function formatTokens(count: number): string {
	if (!count || count <= 0) return "0";
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
	if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
	return String(count);
}

export function getGaugeColor(percent: number): string {
	if (percent >= 80) return RED;
	if (percent >= 50) return YELLOW;
	return GREEN;
}

const GAUGE_FILLED = "▰";
const GAUGE_EMPTY = "▱";

export function renderContextGauge(percent: number, width: number = 8): string {
	const clamped = Math.max(0, Math.min(100, percent || 0));
	const filled = Math.min(width, Math.max(0, Math.round((clamped / 100) * width)));
	const empty = width - filled;
	const color = getGaugeColor(clamped);
	return `${color}${GAUGE_FILLED.repeat(filled)}${GRAY}${GAUGE_EMPTY.repeat(empty)}${RESET}`;
}

export function extractContextUsage(ctx: ExtensionContext): ContextUsageInfo | undefined {
	try {
		if (typeof (ctx as any).getContextUsage === "function") {
			const usage = (ctx as any).getContextUsage();
			if (usage && typeof usage === "object") {
				const tokens = Number(usage.tokens ?? usage.inputTokens ?? 0);
				const contextWindow = Number(usage.contextWindow ?? (ctx as any).model?.contextWindow ?? 0);
				const rawPercent = Number(
					usage.percent ??
					(contextWindow > 0 ? (tokens / contextWindow) * 100 : 0),
				);
				const percent = Math.round(rawPercent);
				return { tokens, contextWindow, percent };
			}
		}
	} catch {}
	return undefined;
}

export function formatModelDisplayName(model?: any, thinkingLevel?: string): string {
	if (!model || !model.id) return "no-model";
	const id = String(model.id).replace(/^openai\//, "").replace(/^anthropic\//, "").replace(/^google\//, "");
	if (thinkingLevel && thinkingLevel !== "off") {
		return `${id} (${thinkingLevel})`;
	}
	return id;
}

export function renderStudioStatusCard(
	ctx: ExtensionContext,
	studioRoot: string,
	width: number = 74,
): string[] {
	const setup = inspectSetup(studioRoot);
	const { state: prodState } = readProducerState(studioRoot);
	const usage = extractContextUsage(ctx);
	const model = (ctx as any).model;
	const thinking = typeof (ctx as any).pi?.getThinkingLevel === "function"
		? (ctx as any).pi.getThinkingLevel()
		: undefined;

	const gameTitle = prodState?.gameTitle || "Sin título";
	const rawEngine = prodState?.engine || setup.currentEngine || "Sin configurar";
	const engine = rawEngine === "Sin configurar" ? "Sin motor (/start)" : rawEngine;
	const milestone = prodState?.milestone || "M1 — Prototipo";
	const sprint = prodState?.sprint || "Sprint Activo";
	const modelStr = formatModelDisplayName(model, thinking);

	const gaugeStr = usage
		? `${renderContextGauge(usage.percent, 8)} ${getGaugeColor(usage.percent)}${usage.percent}%${RESET} (${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)})`
		: `${DIM}No telemetría${RESET}`;

	const engramStr = setup.engramEnabled === true
		? `${GREEN}✓ conectado${RESET}`
		: `${GRAY}local Git${RESET}`;

	const cardWidth = Math.min(Math.max(width - 4, 46), 56);
	const innerWidth = cardWidth - 4;

	const lines: string[] = [];
	const titleText = `✿ Status`;
	const titleStyled = `${BLUE}${titleText}${RESET}`;
	const ruleLen = Math.max(0, cardWidth - 12);
	lines.push(`  ${BORDER}╭─${RESET} ${titleStyled} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);

	// Section: Project
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Project${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const shortRoot = studioRoot.replace(process.env.HOME || "", "~");
	const projectLine = truncateAnsi(`  ${WHITE}${gameTitle}${RESET} ${GRAY}(${shortRoot})${RESET}`, innerWidth);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(projectLine, innerWidth)} ${BORDER}│${RESET}`);
	const engineLine = truncateAnsi(`  ${GRAY}Engine${RESET} ${BLUE}${engine}${RESET} ${GRAY}·${RESET} ${GRAY}Hito${RESET} ${WHITE}${milestone}${RESET}`, innerWidth);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(engineLine, innerWidth)} ${BORDER}│${RESET}`);

	// Section: Integrations
	lines.push(`  ${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Integrations${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Memory${RESET}  · ${engramStr}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Model${RESET}   · ${BLUE}${modelStr}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`  ${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Context${RESET} · ${gaugeStr}`, innerWidth)} ${BORDER}│${RESET}`);

	if (prodState?.inProgress || prodState?.nextStep) {
		lines.push(`  ${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`  ${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Progress (ODD)${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		if (prodState.inProgress) {
			const progLine = truncateAnsi(`  ${YELLOW}◐${RESET} ${WHITE}${prodState.inProgress}${RESET}`, innerWidth);
			lines.push(`  ${BORDER}│${RESET} ${padAnsi(progLine, innerWidth)} ${BORDER}│${RESET}`);
		}
		if (prodState.nextStep) {
			const nextLine = truncateAnsi(`  ${GREEN}→${RESET} ${GRAY}${prodState.nextStep}${RESET}`, innerWidth);
			lines.push(`  ${BORDER}│${RESET} ${padAnsi(nextLine, innerWidth)} ${BORDER}│${RESET}`);
		}
	}

	lines.push(`  ${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
	return lines;
}

export function renderStudioFooterBar(
	pi: any,
	ctx: ExtensionContext,
	_width: number,
	footerData?: any,
): string {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const setup = inspectSetup(studioRoot);
	const { state: prodState } = readProducerState(studioRoot);
	const usage = extractContextUsage(ctx);
	const model = (ctx as any).model;
	const thinking = pi && typeof (pi as any).getThinkingLevel === "function"
		? (pi as any).getThinkingLevel()
		: undefined;

	const rawEngine = prodState?.engine || setup.currentEngine || "Sin configurar";
	const engineDisplay = rawEngine === "Sin configurar" ? "Sin motor (/start)" : rawEngine;
	const modelId = formatModelDisplayName(model, thinking);
	const branch = typeof footerData?.getGitBranch === "function" ? footerData.getGitBranch() : undefined;

	const parts: string[] = [];

	// Location
	const shortCwd = ctx.cwd.replace(process.env.HOME || "", "~");
	parts.push(`${DIM}${shortCwd}${RESET}`);
	if (branch) {
		parts.push(`${DIM}${branch}${RESET}`);
	}

	// Engine & Sprint
	parts.push(`${BLUE}${engineDisplay}${RESET}`);
	if (prodState?.sprint) {
		parts.push(`${WHITE}${prodState.sprint}${RESET}`);
	}

	// Model
	parts.push(`${WHITE}${modelId}${RESET}`);

	// Context Gauge
	if (usage) {
		const gauge = renderContextGauge(usage.percent, 6);
		const col = getGaugeColor(usage.percent);
		parts.push(`${DIM}ctx${RESET} ${gauge} ${col}${usage.percent}%${RESET} ${DIM}(${formatTokens(usage.tokens)})${RESET}`);
	}

	return parts.join(` ${DIM}·${RESET} `);
}

import { installStudioSidebar, isStudioSidebarActive } from "./studio-sidebar.ts";
import { studioAgentsRunner } from "./studio-agents-runner.ts";
import { renderSubagentsWidgetCard } from "./studio-subagents-widget.ts";

export function installStudioFooter(pi: ExtensionAPI, ctx: ExtensionContext): void {
	if (!(ctx as any).hasUI || typeof (ctx.ui as any)?.setFooter !== "function") {
		return;
	}

	try {
		(ctx.ui as any).setFooter((tui: any, _theme: any, footerData: any) => {
			let uninstallSidebar: (() => void) | undefined;
			if (tui && tui.terminal) {
				try {
					uninstallSidebar = installStudioSidebar(tui, ctx);
				} catch {}
			}

			return {
				render(width: number) {
					const lines: string[] = [];
					// Si la barra lateral derecha no está activa (por ancho de terminal o split-view)
					// renderizamos la tarjeta viva de subagentes en el footer dock
					if (!isStudioSidebarActive(tui)) {
						try {
							const tasks = studioAgentsRunner.listTasks();
							const widgetLines = renderSubagentsWidgetCard(tasks, width);
							if (widgetLines.length > 0) {
								lines.push(...widgetLines);
								lines.push(""); // Separador visual sobrio
							}
						} catch {}
					}

					const barLine = renderStudioFooterBar(pi, ctx, width, footerData);
					lines.push(barLine);
					return lines;
				},
				invalidate() {},
				dispose() {
					if (uninstallSidebar) {
						try {
							uninstallSidebar();
						} catch {}
					}
				},
			};
		});
	} catch {}
}


export function updateStudioHUD(ctx: ExtensionContext, pi?: ExtensionAPI): void {
	if (!(ctx as any).hasUI) return;

	// Update bottom statusline
	if (pi) {
		installStudioFooter(pi, ctx);
	}

	// Also update setStatus for secondary hosts
	if (typeof (ctx.ui as any)?.setStatus === "function") {
		const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
		const setup = inspectSetup(studioRoot);
		const { state: prodState } = readProducerState(studioRoot);
		const usage = extractContextUsage(ctx);
		const model = (ctx as any).model;
		const thinking = pi && typeof (pi as any).getThinkingLevel === "function"
			? (pi as any).getThinkingLevel()
			: undefined;

		const rawEngine = prodState?.engine || setup.currentEngine || "Sin configurar";
		const engineDisplay = rawEngine === "Sin configurar" ? "Sin motor (/start)" : rawEngine;
		const modelId = formatModelDisplayName(model, thinking);

		const parts: string[] = [];
		parts.push(engineDisplay);
		if (prodState?.sprint) parts.push(prodState.sprint);
		parts.push(modelId);
		if (usage) {
			const gauge = renderContextGauge(usage.percent, 6);
			parts.push(`${gauge} ${usage.percent}%`);
		}
		(ctx.ui as any).setStatus("studio", parts.join(" · "));
	}
}
