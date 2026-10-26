import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ACCENT as PURPLE, BOLD, BORDER, DIM, GRAY, GREEN, HEADING as LAVENDER, RED, RESET, SECONDARY as CYAN, WHITE, YELLOW, padAnsi, truncateAnsi, panelBottom, panelRow, panelTop } from "./studio-palette.ts";

export type DisciplineCategory = "Directors" | "Game Designer" | "Specialists" | "Other";

export interface ModelPricingTier {
	name: string;
	inputPerMillion: number;
	outputPerMillion: number;
	cachePerMillion: number;
}

export interface TokenUsageRecord {
	agent: string;
	discipline: DisciplineCategory;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheTokens: number;
	totalTokens: number;
	costUsd: number;
	timestamp: number;
}

export interface DisciplineSummary {
	discipline: DisciplineCategory;
	inputTokens: number;
	outputTokens: number;
	cacheTokens: number;
	totalTokens: number;
	costUsd: number;
	percentage: number;
}

export interface AgentSummary {
	agent: string;
	discipline: DisciplineCategory;
	model: string;
	inputTokens: number;
	outputTokens: number;
	cacheTokens: number;
	totalTokens: number;
	costUsd: number;
}

export interface BudgetReport {
	totalInputTokens: number;
	totalOutputTokens: number;
	cacheTokens: number;
	totalCacheTokens: number;
	totalTokens: number;
	totalCostUsd: number;
	byDiscipline: Record<DisciplineCategory, DisciplineSummary>;
	byAgent: Record<string, AgentSummary>;
	byModel: Record<string, { input: number; output: number; cache: number; total: number; costUsd: number }>;
	recordCount: number;
	/** Raw records still held in memory; the rest were folded into the totals above. */
	retainedRecords: number;
}

/**
 * Token telemetry is fed on every tool call and every message end, so the raw
 * record array is the hottest unbounded structure in the extension. Only the
 * newest records are kept for inspection; the older ones are folded into running
 * totals, which keeps the report exact while memory stays flat.
 */
export const MAX_SESSION_RECORDS = 512;

interface BudgetRollup {
	totalInputTokens: number;
	totalOutputTokens: number;
	cacheTokens: number;
	totalTokens: number;
	totalCostUsd: number;
	byDiscipline: Record<DisciplineCategory, DisciplineSummary>;
	byAgent: Record<string, AgentSummary>;
	byModel: Record<string, { input: number; output: number; cache: number; total: number; costUsd: number }>;
}

function emptyRollup(): BudgetRollup {
	return {
		totalInputTokens: 0,
		totalOutputTokens: 0,
		cacheTokens: 0,
		totalTokens: 0,
		totalCostUsd: 0,
		byDiscipline: {
			Directors: { discipline: "Directors", inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, percentage: 0 },
			"Game Designer": { discipline: "Game Designer", inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, percentage: 0 },
			Specialists: { discipline: "Specialists", inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, percentage: 0 },
			Other: { discipline: "Other", inputTokens: 0, outputTokens: 0, cacheTokens: 0, totalTokens: 0, costUsd: 0, percentage: 0 },
		},
		byAgent: {},
		byModel: {},
	};
}

function cloneRollup(source: BudgetRollup): BudgetRollup {
	return {
		...source,
		byDiscipline: {
			Directors: { ...source.byDiscipline.Directors },
			"Game Designer": { ...source.byDiscipline["Game Designer"] },
			Specialists: { ...source.byDiscipline.Specialists },
			Other: { ...source.byDiscipline.Other },
		},
		byAgent: Object.fromEntries(Object.entries(source.byAgent).map(([key, value]) => [key, { ...value }])),
		byModel: Object.fromEntries(Object.entries(source.byModel).map(([key, value]) => [key, { ...value }])),
	};
}

/** Folds records into a rollup. The only place the aggregation rule lives. */
function foldRecords(rollup: BudgetRollup, records: TokenUsageRecord[]): void {
	for (const rec of records) {
		rollup.totalInputTokens += rec.inputTokens;
		rollup.totalOutputTokens += rec.outputTokens;
		rollup.cacheTokens += rec.cacheTokens;
		rollup.totalTokens += rec.totalTokens;
		rollup.totalCostUsd += rec.costUsd;

		const disc = rollup.byDiscipline[rec.discipline] || rollup.byDiscipline.Other;
		disc.inputTokens += rec.inputTokens;
		disc.outputTokens += rec.outputTokens;
		disc.cacheTokens += rec.cacheTokens;
		disc.totalTokens += rec.totalTokens;
		disc.costUsd = Math.round((disc.costUsd + rec.costUsd) * 100000) / 100000;

		if (!rollup.byAgent[rec.agent]) {
			rollup.byAgent[rec.agent] = {
				agent: rec.agent,
				discipline: rec.discipline,
				model: rec.model,
				inputTokens: 0,
				outputTokens: 0,
				cacheTokens: 0,
				totalTokens: 0,
				costUsd: 0,
			};
		}
		const a = rollup.byAgent[rec.agent];
		a.inputTokens += rec.inputTokens;
		a.outputTokens += rec.outputTokens;
		a.cacheTokens += rec.cacheTokens;
		a.totalTokens += rec.totalTokens;
		a.costUsd = Math.round((a.costUsd + rec.costUsd) * 100000) / 100000;

		if (!rollup.byModel[rec.model]) {
			rollup.byModel[rec.model] = { input: 0, output: 0, cache: 0, total: 0, costUsd: 0 };
		}
		const m = rollup.byModel[rec.model];
		m.input += rec.inputTokens;
		m.output += rec.outputTokens;
		m.cache += rec.cacheTokens;
		m.total += rec.totalTokens;
		m.costUsd = Math.round((m.costUsd + rec.costUsd) * 100000) / 100000;
	}
}

// Recent records (bounded) plus the totals of the ones already folded away.
const sessionRecords: TokenUsageRecord[] = [];
let archivedTotals = emptyRollup();
let totalRecordCount = 0;


/**
 * Categorizes an agent identifier into its studio discipline.
 */
export function categorizeDiscipline(agent: string): DisciplineCategory {
	const lower = (agent || "").toLowerCase().trim();

	if (
		lower === "producer" ||
		lower.endsWith("-director") ||
		lower === "creative-director" ||
		lower === "technical-director" ||
		lower === "art-director" ||
		lower === "audio-director" ||
		lower === "narrative-director" ||
		lower === "lead-producer"
	) {
		return "Directors";
	}

	if (
		lower === "game-designer" ||
		lower.endsWith("-designer") ||
		lower === "writer" ||
		lower === "world-builder" ||
		lower === "prototyper"
	) {
		return "Game Designer";
	}

	if (
		lower === "qa-verifier" ||
		lower.endsWith("-specialist") ||
		lower.endsWith("-programmer") ||
		lower.endsWith("-engineer") ||
		lower.endsWith("-lead") ||
		lower.endsWith("-tester") ||
		lower.includes("qa") ||
		lower === "qa-lead" ||
		lower === "lead-programmer" ||
		lower === "release-manager" ||
		lower === "devops-engineer" ||
		lower === "performance-analyst" ||
		lower === "godot-specialist" ||
		lower === "bevy-specialist" ||
		lower === "raylib-specialist" ||
		lower === "unity-specialist" ||
		lower === "unreal-specialist"
	) {
		return "Specialists";
	}

	return "Other";
}

/**
 * Returns pricing tier rates based on model identifier.
 */
export function getModelPricing(modelName: string): ModelPricingTier {
	const lower = (modelName || "").toLowerCase();

	// Free / local models
	if (
		lower.includes(":free") ||
		lower.includes("ollama") ||
		lower.includes("local") ||
		lower.includes("offline")
	) {
		return { name: "Free / Local", inputPerMillion: 0, outputPerMillion: 0, cachePerMillion: 0 };
	}

	// Lightweight / Mini models
	if (
		lower.includes("mini") ||
		lower.includes("haiku") ||
		lower.includes("gpt-3.5") ||
		lower.includes("gpt-5.4-mini") ||
		lower.includes("gpt-4o-mini")
	) {
		return {
			name: "Mini / Fast Tier",
			inputPerMillion: 0.15,
			outputPerMillion: 0.60,
			cachePerMillion: 0.075,
		};
	}

	// Flagship models (Directors & high-level reasoning)
	if (
		lower.includes("gpt-4o") ||
		lower.includes("gpt-4") ||
		lower.includes("sonnet") ||
		lower.includes("opus") ||
		lower.includes("claude-sonnet-4") ||
		lower.includes("claude-3-5-sonnet")
	) {
		return {
			name: "Flagship Reasoning Tier",
			inputPerMillion: 3.00,
			outputPerMillion: 15.00,
			cachePerMillion: 0.30,
		};
	}

	// Open / Mid-weight models
	if (
		lower.includes("oss") ||
		lower.includes("llama") ||
		lower.includes("qwen") ||
		lower.includes("deepseek") ||
		lower.includes("mistral")
	) {
		return {
			name: "Open Weights / Mid Tier",
			inputPerMillion: 0.60,
			outputPerMillion: 1.80,
			cachePerMillion: 0.10,
		};
	}

	// Standard default fallback
	return {
		name: "Standard Tier",
		inputPerMillion: 1.00,
		outputPerMillion: 3.00,
		cachePerMillion: 0.15,
	};
}

/**
 * Calculates estimated cost in USD for a given token usage and model.
 */
export function estimateCost(
	model: string,
	inputTokens: number,
	outputTokens: number,
	cacheTokens: number = 0,
): number {
	const pricing = getModelPricing(model);
	const inCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
	const outCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
	const cacheCost = (cacheTokens / 1_000_000) * pricing.cachePerMillion;
	return Math.round((inCost + outCost + cacheCost) * 100000) / 100000;
}

/**
 * Records token consumption for an agent and model in the current session.
 */
export function recordTokenUsage(
	agent: string,
	model: string,
	inputTokens: number,
	outputTokens: number,
	cacheTokens: number = 0,
): TokenUsageRecord {
	const safeInput = Math.max(0, inputTokens || 0);
	const safeOutput = Math.max(0, outputTokens || 0);
	const safeCache = Math.max(0, cacheTokens || 0);
	const total = safeInput + safeOutput + safeCache;
	const discipline = categorizeDiscipline(agent);
	const cost = estimateCost(model, safeInput, safeOutput, safeCache);

	const record: TokenUsageRecord = {
		agent: agent || "unknown",
		discipline,
		model: model || "default",
		inputTokens: safeInput,
		outputTokens: safeOutput,
		cacheTokens: safeCache,
		totalTokens: total,
		costUsd: cost,
		timestamp: Date.now(),
	};

	sessionRecords.push(record);
	totalRecordCount++;
	if (sessionRecords.length > MAX_SESSION_RECORDS) {
		const overflow = sessionRecords.length - MAX_SESSION_RECORDS;
		foldRecords(archivedTotals, sessionRecords.splice(0, overflow));
	}
	return record;
}

/**
 * Resets session token records.
 */
export function resetBudget(): void {
	sessionRecords.length = 0;
	archivedTotals = emptyRollup();
	totalRecordCount = 0;
}

/**
 * Generates aggregated budget report grouped by disciplines, agents, and models.
 */
export function getBudgetReport(): BudgetReport {
	const rollup = cloneRollup(archivedTotals);
	foldRecords(rollup, sessionRecords);

	const disciplineMap = rollup.byDiscipline;
	const agentMap = rollup.byAgent;
	const modelMap = rollup.byModel;
	const totalTokens = rollup.totalTokens;
	const totalCache = rollup.cacheTokens;

	// Calculate percentages
	if (totalTokens > 0) {
		for (const key of Object.keys(disciplineMap) as DisciplineCategory[]) {
			disciplineMap[key].percentage = Math.round((disciplineMap[key].totalTokens / totalTokens) * 1000) / 10;
		}
	}

	return {
		totalInputTokens: rollup.totalInputTokens,
		totalOutputTokens: rollup.totalOutputTokens,
		cacheTokens: totalCache,
		totalCacheTokens: totalCache,
		totalTokens,
		totalCostUsd: Math.round(rollup.totalCostUsd * 100000) / 100000,
		byDiscipline: disciplineMap,
		byAgent: agentMap,
		byModel: modelMap,
		recordCount: totalRecordCount,
		retainedRecords: sessionRecords.length,
	};
}

/**
 * Renders an ASCII horizontal progress bar.
 */
export function renderAsciiBar(percent: number, length: number = 16): string {
	const clamped = Math.max(0, Math.min(100, percent));
	const filled = Math.round((clamped / 100) * length);
	const empty = length - filled;
	return "█".repeat(filled) + "░".repeat(empty);
}

/**
 * Formats a number with comma separators.
 */
function formatNumber(num: number): string {
	return num.toLocaleString("en-US");
}

/**
 * Renders the clean gamedev budget card in TUI format with ASCII bars and cost breakdown.
 */
export function renderBudgetCard(report: BudgetReport, width: number = 74): string[] {
	const cardWidth = Math.max(64, width);
	const innerWidth = cardWidth - 4;
	const lines: string[] = [];

	lines.push(panelTop(cardWidth - 3, `${PURPLE}${BOLD}ESTIMATED STUDIO BUDGET & TOKENS${RESET}`, "rounded", BORDER));
	lines.push(panelRow(`${LAVENDER}Resumen de Sesión Activa${RESET}`, innerWidth + 2, BORDER));

	// Total tokens row
	const totalTokensStr = `${WHITE}${formatNumber(report.totalTokens)}${RESET} ${GRAY}tokens${RESET} (${GRAY}In:${RESET} ${CYAN}${formatNumber(report.totalInputTokens)}${RESET} ${GRAY}· Out:${RESET} ${GREEN}${formatNumber(report.totalOutputTokens)}${RESET} ${GRAY}· Cache:${RESET} ${YELLOW}${formatNumber(report.totalCacheTokens)}${RESET})`;
	lines.push(panelRow(`  ${GRAY}Consumo Total:${RESET} ${totalTokensStr}`, innerWidth + 2, BORDER));

	// Cost row
	const costStr = `${GREEN}$${report.totalCostUsd.toFixed(4)} USD${RESET}`;
	lines.push(panelRow(`  ${GRAY}Costo Estimado:${RESET} ${costStr} ${GRAY}(basado en tiers de modelos)${RESET}`, innerWidth + 2, BORDER));
	lines.push(panelRow(`  ${GRAY}Eventos registrados:${RESET} ${WHITE}${report.recordCount}${RESET} ${GRAY}(${report.retainedRecords} en memoria)${RESET}`, innerWidth + 2, BORDER));
	lines.push(panelRow("", innerWidth + 2, BORDER));

	// Discipline Breakdown
	lines.push(panelRow(`${LAVENDER}Desglose por Disciplina de Estudio${RESET}`, innerWidth + 2, BORDER));

	const disciplines: { name: DisciplineCategory; color: string }[] = [
		{ name: "Directors", color: PURPLE },
		{ name: "Game Designer", color: CYAN },
		{ name: "Specialists", color: GREEN },
	];

	for (const d of disciplines) {
		const stat = report.byDiscipline[d.name];
		const pct = stat.percentage;
		const bar = renderAsciiBar(pct, 14);
		const namePad = d.name.padEnd(14, " ");
		const pctPad = `${pct.toFixed(1)}%`.padStart(6, " ");
		const costPad = `$${stat.costUsd.toFixed(4)}`.padStart(8, " ");
		const tokensPad = `${formatNumber(stat.totalTokens)} tkn`.padStart(12, " ");

		const lineContent = `  ${d.color}${namePad}${RESET} [${d.color}${bar}${RESET}] ${pctPad}  ${GRAY}•${RESET} ${WHITE}${tokensPad}${RESET}  ${GRAY}•${RESET} ${GREEN}${costPad}${RESET}`;
		lines.push(panelRow(lineContent, innerWidth + 2, BORDER));
	}

	// Agents summary table if agents exist
	const agentKeys = Object.keys(report.byAgent);
	if (agentKeys.length > 0) {
		lines.push(panelRow("", innerWidth + 2, BORDER));
		lines.push(panelRow(`${LAVENDER}Detalle por Agente (${agentKeys.length})${RESET}`, innerWidth + 2, BORDER));

		for (const key of agentKeys.slice(0, 8)) {
			const a = report.byAgent[key];
			const agentName = truncateAnsi(a.agent, 20).padEnd(20, " ");
			const modelName = truncateAnsi(a.model.split("/").pop() || a.model, 16).padEnd(16, " ");
			const tokens = `${formatNumber(a.totalTokens)} tkn`.padStart(12, " ");
			const cost = `$${a.costUsd.toFixed(4)}`.padStart(8, " ");
			const row = `  ${WHITE}${agentName}${RESET} ${GRAY}${modelName}${RESET} ${tokens}  ${GREEN}${cost}${RESET}`;
			lines.push(panelRow(row, innerWidth + 2, BORDER));
		}
	}

	lines.push(panelBottom(cardWidth - 2, "rounded", BORDER));
	lines.push(`  ${GRAY}Tip: Usa /studio:budget reset para reiniciar el contador de sesión.${RESET}`);

	return lines;
}

/**
 * Command handler for /studio:budget and /budget.
 */
export function handleStudioBudget(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	return handleStudioBudgetImpl(args, ctx);
}

async function handleStudioBudgetImpl(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = (args || "").trim().toLowerCase();

	if (query === "reset" || query === "clear") {
		resetBudget();
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify("Contador de presupuesto y tokens reiniciado.", "info");
		}
		console.log(`${GREEN}✓ Presupuesto de sesión reiniciado.\x1b[0m`);
		return;
	}

	const report = getBudgetReport();
	const card = renderBudgetCard(report);

	for (const line of card) {
		console.log(line);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(
			`Studio Budget: ${formatNumber(report.totalTokens)} tokens (~$${report.totalCostUsd.toFixed(4)} USD)`,
			"info",
		);
	}
}
