import type { ExtensionContext, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";
import { inspectSetup } from "./studio-setup.ts";

export type OddPhaseId = "concept" | "spec" | "arch" | "code" | "test" | "ship";

export interface OddPhaseInfo {
	id: OddPhaseId;
	step: number;
	chip: string;
	label: string;
}

export const ODD_PHASES: Record<OddPhaseId, OddPhaseInfo> = {
	concept: { id: "concept", step: 1, chip: "[concept 1/6]", label: "Visión & Concepto" },
	spec: { id: "spec", step: 2, chip: "[spec 2/6]", label: "Live Spec" },
	arch: { id: "arch", step: 3, chip: "[arch 3/6]", label: "Arquitectura" },
	code: { id: "code", step: 4, chip: "[code 4/6]", label: "Código & Motor" },
	test: { id: "test", step: 5, chip: "[test 5/6]", label: "QA & Feel" },
	ship: { id: "ship", step: 6, chip: "[ship 6/6]", label: "Release & Store" },
};

/**
 * Infers the active ODD phase from ProducerState (inProgress, milestone, nextStep).
 */
export function getOddPhaseInfo(prodState?: any): OddPhaseInfo {
	if (!prodState) return ODD_PHASES.concept;

	const inProg = (prodState.inProgress || "").toLowerCase();
	const milestone = (prodState.milestone || "").toLowerCase();
	const nextStep = (prodState.nextStep || "").toLowerCase();

	// 1. Try matching inProgress first (active work)
	if (/(?:ship|release|lanzamiento|publicaci|dist|store|gold|v1\.0|deploy)/.test(inProg)) {
		return ODD_PHASES.ship;
	}
	if (/(?:test|qa|prueba|smoke|soak|regresi|bug|feel|verif|calidad)/.test(inProg)) {
		return ODD_PHASES.test;
	}
	if (/(?:concept|visión|vision|fantas|brainstorm|pitch|jam|premisa|pilar|pillar|arquetipo|incept)/.test(inProg)) {
		return ODD_PHASES.concept;
	}
	if (/(?:spec|gdd|diseño|design|live spec|tuning|knob|balance|regla)/.test(inProg)) {
		return ODD_PHASES.spec;
	}
	if (/(?:arch|arquitect|adr|budget|presupuesto|sistema|system|pipeline|mcp)/.test(inProg)) {
		return ODD_PHASES.arch;
	}
	if (/(?:code|código|codigo|implement|motor|engine|gameplay|physic|físic|shader|scene|escena|script|salto|movimiento|player|mechanic|mecánic|arpg)/.test(inProg)) {
		return ODD_PHASES.code;
	}

	// 2. Try matching milestone
	if (/(?:ship|release|lanzamiento|publicaci|dist|store|gold|v1\.0)/.test(milestone)) {
		return ODD_PHASES.ship;
	}
	if (/(?:test|qa|beta|regression|smoke)/.test(milestone)) {
		return ODD_PHASES.test;
	}
	if (/(?:code|prototipo|prototype|vertical slice|alpha|m1|m2|gameplay|engine)/.test(milestone)) {
		return ODD_PHASES.code;
	}
	if (/(?:arch|arquitect|adr|sistema)/.test(milestone)) {
		return ODD_PHASES.arch;
	}
	if (/(?:spec|live spec|gdd|diseño)/.test(milestone)) {
		return ODD_PHASES.spec;
	}
	if (/(?:concept|visión|jam|pitch)/.test(milestone)) {
		return ODD_PHASES.concept;
	}

	// 3. Try nextStep inferences
	if (/(?:concept|visión|brainstorm)/.test(nextStep)) {
		return ODD_PHASES.concept;
	}
	if (/(?:spec|gdd|diseño)/.test(nextStep)) {
		return ODD_PHASES.concept;
	}
	if (/(?:arch|arquitect|adr)/.test(nextStep)) {
		return ODD_PHASES.spec;
	}
	if (/(?:code|código|implement)/.test(nextStep)) {
		return ODD_PHASES.arch;
	}
	if (/(?:test|qa|prueba)/.test(nextStep)) {
		return ODD_PHASES.code;
	}
	if (/(?:ship|release)/.test(nextStep)) {
		return ODD_PHASES.test;
	}

	// Default
	if (prodState.engine) {
		return ODD_PHASES.code;
	}
	return ODD_PHASES.concept;
}

export function inferOddPhase(prodState?: any): string {
	return getOddPhaseInfo(prodState).chip;
}

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

export function isStatusCardCollapsed(studioRoot: string): boolean {
	const flag = join(studioRoot, ".pi", "game-studio", "status-collapsed");
	return existsSync(flag);
}

export function setStatusCardCollapsed(studioRoot: string, collapsed: boolean): void {
	const flag = join(studioRoot, ".pi", "game-studio", "status-collapsed");
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
	collapsed?: boolean,
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
	const isEngineUnconfigured = rawEngine === "Sin configurar" || !rawEngine || rawEngine.toLowerCase() === "sin motor";
	const engine = isEngineUnconfigured ? "Sin motor (/studio:setup)" : rawEngine;
	const milestone = prodState?.milestone || "Pendiente (/concept)";
	const sprint = prodState?.sprint || "Sprint Activo";
	const modelStr = formatModelDisplayName(model, thinking);
	const phaseChip = inferOddPhase(prodState);

	const cardWidth = Math.min(Math.max(width - 4, 46), 56);
	const innerWidth = cardWidth - 4;

	const isCollapsed = collapsed !== undefined ? collapsed : isStatusCardCollapsed(studioRoot);
	if (isCollapsed) {
		const rawTitle = `✿ Status · ${gameTitle} (${engine}) [collapsed]`;
		const maxTitleLen = Math.max(10, cardWidth - 7);
		const displayTitle = rawTitle.length > maxTitleLen ? truncateAnsi(rawTitle, maxTitleLen) : rawTitle;
		const titleStyled = `${BLUE}${displayTitle}${RESET}`;
		const titleVisibleLen = displayTitle.replace(/\x1b\[[0-9;]*m/g, "").length;
		const ruleLen = Math.max(0, cardWidth - titleVisibleLen - 5);
		const lines: string[] = [];
		lines.push(`  ${BORDER}╭─${RESET} ${titleStyled} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);
		lines.push(`  ${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
		return lines;
	}

	const gaugeStr = usage
		? `${renderContextGauge(usage.percent, 8)} ${getGaugeColor(usage.percent)}${usage.percent}%${RESET} (${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)})`
		: `${DIM}No telemetría${RESET}`;

	const engramStr = setup.engramEnabled === true
		? `${GREEN}✓ conectado${RESET}`
		: `${GRAY}local Git${RESET}`;

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
		lines.push(`  ${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Progress (ODD)${RESET} ${BLUE}${phaseChip}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
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
	const studioRoot = (ctx && ctx.cwd) ? (findStudioRoot(ctx.cwd) || ctx.cwd) : process.cwd();
	const setup = inspectSetup(studioRoot);
	const { state: prodState } = readProducerState(studioRoot);
	const usage = extractContextUsage(ctx);
	const model = (ctx as any)?.model;
	const thinking = (ctx as any)?.pi?.getThinkingLevel?.() || (pi as any)?.getThinkingLevel?.();
	const modelStr = formatModelDisplayName(model, thinking);

	const rawEngine = prodState?.engine || setup.currentEngine || "Sin configurar";
	const isEngineUnconfigured = rawEngine === "Sin configurar" || !rawEngine || rawEngine.toLowerCase() === "sin motor";
	const engineDisplay = isEngineUnconfigured ? "Sin configurar" : rawEngine;
	const milestone = prodState?.milestone || "Pendiente (/concept)";
	const sprint = prodState?.sprint || "Sprint Activo";
	const phaseChip = inferOddPhase(prodState);

	const contextDisplay = usage
		? `${renderContextGauge(usage.percent, 6)} ${getGaugeColor(usage.percent)}${usage.percent}%${RESET} (${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)})`
		: `${GREEN}100%${RESET}`;

	const parts: string[] = [];

	// Feature 3: Gamedev Status Bar Telemetry
	// Format: ▎ Motor: <Engine> · Hito: <Milestone> · Sprint: <Sprint> · Context: <ActiveContext>
	parts.push(`▎ Motor: ${BLUE}${engineDisplay}${RESET}`);
	parts.push(`Hito: ${WHITE}${milestone}${RESET}`);
	parts.push(`Sprint: ${WHITE}${sprint}${RESET}`);
	parts.push(`${BLUE}${phaseChip}${RESET}`);
	parts.push(`Modelo: ${BLUE}${modelStr}${RESET}`);
	parts.push(`Context: ${contextDisplay}`);

	// Live Performance & Budget Tracker
	try {
		const { getActivePerfMetrics } = require("./studio-profile.ts");
		const perf = getActivePerfMetrics?.();
		if (perf) {
			const perfCol = perf.status === "OK" ? GREEN : YELLOW;
			parts.push(`${perfCol}⚡ ${perf.fps}fps (${perf.memoryMb}MB)${RESET}`);
		}
	} catch {}

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
		const thinking = typeof (ctx as any).pi?.getThinkingLevel === "function"
			? (ctx as any).pi.getThinkingLevel()
			: undefined;
		const modelStr = formatModelDisplayName(model, thinking);

		const rawEngine = prodState?.engine || setup.currentEngine || "Sin configurar";
		const isEngineUnconfigured = rawEngine === "Sin configurar" || !rawEngine || rawEngine.toLowerCase() === "sin motor";
		const engineDisplay = isEngineUnconfigured ? "Sin configurar" : rawEngine;
		const milestone = prodState?.milestone || "Pendiente (/concept)";
		const sprint = prodState?.sprint || "Sprint Activo";
		const phaseChip = inferOddPhase(prodState);
		const contextDisplay = usage ? `${usage.percent}%` : "100%";

		(ctx.ui as any).setStatus(
			"studio",
			`▎ Motor: ${engineDisplay} · Hito: ${milestone} · Sprint: ${sprint} · ${phaseChip} · Modelo: ${modelStr} · Context: ${contextDisplay}`,
		);
	}
}
