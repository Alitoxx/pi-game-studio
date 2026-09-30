import type { ExtensionContext, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";
import { inspectSetup } from "./studio-setup.ts";

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const GREEN = "\x1b[38;2;52;211;153m";
const YELLOW = "\x1b[38;2;251;191;36m";
const RED = "\x1b[38;2;239;68;68m";
const CYAN = "\x1b[38;2;56;189;248m";
const VIOLET = "\x1b[38;2;167;139;250m";
const WHITE = "\x1b[38;2;243;244;246m";
const GRAY = "\x1b[38;2;156;163;175m";

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

export function renderContextGauge(percent: number, width: number = 8): string {
	const clamped = Math.max(0, Math.min(100, percent || 0));
	const filled = Math.min(width, Math.max(0, Math.round((clamped / 100) * width)));
	const empty = width - filled;
	const color = getGaugeColor(clamped);
	return `${color}[${"█".repeat(filled)}${"░".repeat(empty)}]${RESET}`;
}

export function extractContextUsage(ctx: ExtensionContext): ContextUsageInfo | undefined {
	try {
		if (typeof (ctx as any).getContextUsage === "function") {
			const usage = (ctx as any).getContextUsage();
			if (usage && typeof usage === "object") {
				const tokens = Number(usage.tokens ?? usage.inputTokens ?? 0);
				const contextWindow = Number(usage.contextWindow ?? (ctx as any).model?.contextWindow ?? 0);
				const percent = Number(
					usage.percent ??
					(contextWindow > 0 ? Math.round((tokens / contextWindow) * 100) : 0),
				);
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
	const engine = prodState?.engine || setup.currentEngine || "Auto";
	const milestone = prodState?.milestone || "M1 — Prototipo";
	const sprint = prodState?.sprint || "Sprint Activo";
	const modelStr = formatModelDisplayName(model, thinking);

	const gaugeStr = usage
		? `${renderContextGauge(usage.percent, 8)} ${getGaugeColor(usage.percent)}${usage.percent}%${RESET} (${formatTokens(usage.tokens)}/${formatTokens(usage.contextWindow)})`
		: `${DIM}No telemetría${RESET}`;

	const engramStr = setup.engramEnabled === true
		? `${GREEN}Engram conectado${RESET}`
		: `${GRAY}Almacenamiento Git local${RESET}`;

	const innerWidth = width - 4;
	const pad = (str: string, len: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
	};

	const lines: string[] = [];
	lines.push(`${DIM}┌──${RESET} ${VIOLET}${BOLD}PI GAME STUDIO — STATUS DEL PROYECTO${RESET} ${DIM}${"─".repeat(Math.max(0, width - 42))}┐${RESET}`);

	const colW = Math.floor((innerWidth - 3) / 2);
	const row1Left = `${VIOLET}Juego  :${RESET} ${WHITE}${gameTitle}${RESET}`;
	const row1Right = `${VIOLET}Motor  :${RESET} ${CYAN}${engine}${RESET}`;
	lines.push(`${DIM}│${RESET} ${pad(row1Left, colW)} ${DIM}│${RESET} ${pad(row1Right, colW)} ${DIM}│${RESET}`);

	const row2Left = `${VIOLET}Hito   :${RESET} ${WHITE}${milestone}${RESET}`;
	const row2Right = `${VIOLET}Sprint :${RESET} ${WHITE}${sprint}${RESET}`;
	lines.push(`${DIM}│${RESET} ${pad(row2Left, colW)} ${DIM}│${RESET} ${pad(row2Right, colW)} ${DIM}│${RESET}`);

	const row3Left = `${VIOLET}Modelo :${RESET} ${CYAN}${modelStr}${RESET}`;
	const row3Right = `${VIOLET}Memoria:${RESET} ${engramStr}`;
	lines.push(`${DIM}│${RESET} ${pad(row3Left, colW)} ${DIM}│${RESET} ${pad(row3Right, colW)} ${DIM}│${RESET}`);

	const row4 = `${VIOLET}Contexto:${RESET} ${gaugeStr}`;
	lines.push(`${DIM}│${RESET} ${pad(row4, innerWidth)} ${DIM}│${RESET}`);

	if (prodState?.inProgress || prodState?.nextStep) {
		lines.push(`${DIM}├${"─".repeat(innerWidth + 2)}┤${RESET}`);
		if (prodState.inProgress) {
			const prog = `${YELLOW}En Progreso:${RESET} ${WHITE}${prodState.inProgress}${RESET}`;
			lines.push(`${DIM}│${RESET} ${pad(prog, innerWidth)} ${DIM}│${RESET}`);
		}
		if (prodState.nextStep) {
			const next = `${GREEN}Siguiente  :${RESET} ${WHITE}${prodState.nextStep}${RESET}`;
			lines.push(`${DIM}│${RESET} ${pad(next, innerWidth)} ${DIM}│${RESET}`);
		}
	}

	lines.push(`${DIM}└${"─".repeat(innerWidth + 2)}┘${RESET}`);
	return lines;
}

export function updateStudioHUD(ctx: ExtensionContext, pi?: ExtensionAPI): void {
	if (!(ctx as any).hasUI || typeof (ctx.ui as any)?.setStatus !== "function") {
		return;
	}

	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const setup = inspectSetup(studioRoot);
	const { state: prodState } = readProducerState(studioRoot);
	const usage = extractContextUsage(ctx);
	const model = (ctx as any).model;
	const thinking = pi && typeof (pi as any).getThinkingLevel === "function"
		? (pi as any).getThinkingLevel()
		: undefined;

	const engine = prodState?.engine || setup.currentEngine || "Studio";
	const modelId = formatModelDisplayName(model, thinking);

	const parts: string[] = [];
	parts.push(`🎮 ${engine}`);

	if (prodState?.sprint) {
		parts.push(prodState.sprint);
	}

	parts.push(modelId);

	if (usage) {
		const gauge = renderContextGauge(usage.percent, 6);
		parts.push(`${gauge} ${usage.percent}% (${formatTokens(usage.tokens)})`);
	}

	const statusText = parts.join(" · ");
	(ctx.ui as any).setStatus("studio", statusText);
}
