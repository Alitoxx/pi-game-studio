import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { TimelineItem, TimelineCategory } from "./studio-timeline.ts";
import { parseProductionTimeline } from "./studio-timeline.ts";
import { findStudioRoot } from "./studio-root.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	RED,
	ACCENT as PURPLE,
	SECONDARY as CYAN,
	HEADING as LAVENDER,
	WHITE,
	GRAY,
	BORDER,
	padAnsi,
	truncateAnsi,
} from "./studio-palette.ts";

export type FilterCategory = "All" | "Milestones" | "ADRs" | "Specs";

const FILTER_TABS: FilterCategory[] = ["All", "Milestones", "ADRs", "Specs"];

/**
 * Checks for terminal input keys safely.
 */
function isKeyMatch(data: string, name: string): boolean {
	if (name === "escape") return data === "\x1b" || data === "\x1b\x1b";
	if (name === "up") return data === "\x1b[A" || data === "k" || data === "K";
	if (name === "down") return data === "\x1b[B" || data === "j" || data === "J";
	if (name === "tab") return data === "\t";
	if (name === "ctrl+c") return data === "\x03";
	if (name === "q") return data === "q" || data === "Q";
	return false;
}

/**
 * Renders the timeline split view (tree on left, card on right).
 */
export function renderTimelineSplitView(
	items: TimelineItem[],
	selectedIndex: number,
	activeFilter: FilterCategory = "All",
	width: number = 84,
): string[] {
	const totalWidth = Math.max(76, width);
	const leftWidth = Math.min(36, Math.max(28, Math.floor(totalWidth * 0.38)));
	const rightWidth = totalWidth - leftWidth - 1;

	const targetItem: TimelineItem = items[selectedIndex] || items[0] || {
		id: "empty",
		type: "milestone",
		category: "Milestones",
		title: "Sin eventos registrados",
		status: "Empty",
		icon: "○",
		sourceFile: "",
		details: {},
	};

	const lines: string[] = [];

	// 1. Tab Bar Header
	const tabLabels = FILTER_TABS.map((tab) => {
		const isAct = tab === activeFilter;
		const name = tab === "All" ? "Todos" : tab === "Milestones" ? "Hitos" : tab === "ADRs" ? "ADRs" : "Live Specs";
		return isAct ? `${CYAN}${BOLD}[● ${name}]${RESET}` : `${GRAY}[○ ${name}]${RESET}`;
	}).join("  ");

	lines.push(`${BORDER}╭─${RESET} ${PURPLE}${BOLD}✿ TIMELINE DE PRODUCCIÓN Y DECISIONES (ODD)${RESET} ${BORDER}${"─".repeat(Math.max(0, totalWidth - 48))}╮${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Filtro:${RESET} ${tabLabels}  ${DIM}(Tab para cambiar)${RESET}`, totalWidth - 4)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}├${"─".repeat(leftWidth)}┬${"─".repeat(rightWidth)}┤${RESET}`);

	// 2. Left column (tree with ASCII spine)
	const leftLines: string[] = [];
	leftLines.push(` ${LAVENDER}${BOLD}Árbol de Hitos y ADRs (${items.length})${RESET}`);
	leftLines.push(`${BORDER}${"─".repeat(leftWidth - 1)}${RESET}`);

	for (let i = 0; i < items.length; i++) {
		const it = items[i];
		const isSelected = i === selectedIndex;
		const marker = isSelected ? `${CYAN}▸${RESET} ` : "  ";
		const spine = it.treeSpine || "";

		let iconColor = GRAY;
		if (it.type === "milestone") {
			iconColor = it.progress === 100 ? GREEN : it.progress && it.progress > 0 ? YELLOW : GRAY;
		} else if (it.type === "task") {
			iconColor = it.status === "Completed" ? GREEN : it.status === "In Progress" ? YELLOW : GRAY;
		} else if (it.type === "adr") {
			iconColor = PURPLE;
		} else if (it.type === "spec") {
			iconColor = CYAN;
		}

		const textColor = isSelected ? `${BOLD}${WHITE}` : it.type === "milestone" ? `${WHITE}` : `${GRAY}`;
		const maxTitleLen = Math.max(10, leftWidth - spine.length - 8);
		const titleDisplay = truncateAnsi(it.title, maxTitleLen);

		leftLines.push(`${marker}${GRAY}${spine}${RESET}${iconColor}${it.icon}${RESET} ${textColor}${titleDisplay}${RESET}`);
	}

	// 3. Right column (Detail card for selected event)
	const rightLines: string[] = [];

	let typeBadge = `${PURPLE}[HITO]${RESET}`;
	if (targetItem.type === "task") typeBadge = `${GRAY}[TAREA]${RESET}`;
	if (targetItem.type === "adr") typeBadge = `${PURPLE}${BOLD}[ADR]${RESET}`;
	if (targetItem.type === "spec") typeBadge = `${CYAN}${BOLD}[LIVE SPEC]${RESET}`;

	let statusBadge = `${GRAY}○ ${targetItem.status}${RESET}`;
	if (targetItem.status === "Completed" || targetItem.status === "Accepted" || targetItem.status === "Approved") {
		statusBadge = `${GREEN}✓ ${targetItem.status}${RESET}`;
	} else if (targetItem.status === "In Progress") {
		statusBadge = `${YELLOW}◐ ${targetItem.status}${RESET}`;
	}

	rightLines.push(`${typeBadge} ${WHITE}${BOLD}${truncateAnsi(targetItem.title, rightWidth - 16)}${RESET}`);
	rightLines.push(`  ${GRAY}Estado:${RESET} ${statusBadge}  ${GRAY}·${RESET}  ${GRAY}Archivo:${RESET} ${CYAN}${targetItem.sourceFile || "N/A"}${RESET}`);
	if (targetItem.date) {
		rightLines.push(`  ${GRAY}Fecha / Registro:${RESET} ${WHITE}${targetItem.date}${RESET}`);
	}
	rightLines.push("");

	// Panel Content by Type
	if (targetItem.type === "adr") {
		// ADR Details: Context, Decision, Consequences, Trade-offs
		rightLines.push(`${LAVENDER}${BOLD}Contexto del Problema${RESET}`);
		const contextLines = (targetItem.details.context || "Sin contexto documentado.").split("\n").slice(0, 3);
		for (const cl of contextLines) {
			rightLines.push(`  ${WHITE}${truncateAnsi(cl.trim(), rightWidth - 4)}${RESET}`);
		}
		rightLines.push("");

		rightLines.push(`${LAVENDER}${BOLD}Decisión de Arquitectura${RESET}`);
		const decisionLines = (targetItem.details.decision || "Decisión técnica.").split("\n").slice(0, 3);
		for (const dl of decisionLines) {
			rightLines.push(`  ${GREEN}${truncateAnsi(dl.trim(), rightWidth - 4)}${RESET}`);
		}
		rightLines.push("");

		if (targetItem.details.tradeoffs) {
			rightLines.push(`${LAVENDER}${BOLD}Trade-offs y Alternativas Evaluadas${RESET}`);
			const tradeLines = targetItem.details.tradeoffs.split("\n").slice(0, 3);
			for (const tl of tradeLines) {
				rightLines.push(`  ${YELLOW}${truncateAnsi(tl.trim(), rightWidth - 4)}${RESET}`);
			}
			rightLines.push("");
		}

		if (targetItem.details.consequences) {
			rightLines.push(`${LAVENDER}${BOLD}Consecuencias e Impacto Técnico${RESET}`);
			const consLines = targetItem.details.consequences.split("\n").slice(0, 3);
			for (const cl of consLines) {
				rightLines.push(`  ${GRAY}${truncateAnsi(cl.trim(), rightWidth - 4)}${RESET}`);
			}
		}
	} else if (targetItem.type === "spec") {
		// Live Spec Details: Overview, Acceptance Criteria, Tuning Knobs
		rightLines.push(`${LAVENDER}${BOLD}Resumen de Gameplay / Fantasía${RESET}`);
		const summaryLines = (targetItem.details.summary || "").split("\n").slice(0, 4);
		for (const sl of summaryLines) {
			rightLines.push(`  ${WHITE}${truncateAnsi(sl.trim(), rightWidth - 4)}${RESET}`);
		}
		rightLines.push("");

		if (targetItem.details.acceptanceCriteria && targetItem.details.acceptanceCriteria.length > 0) {
			rightLines.push(`${LAVENDER}${BOLD}Criterios de Aceptación (Verificación ODD)${RESET}`);
			for (const crit of targetItem.details.acceptanceCriteria.slice(0, 5)) {
				rightLines.push(`  ${CYAN}${truncateAnsi(crit, rightWidth - 4)}${RESET}`);
			}
			rightLines.push("");
		}

		if (targetItem.details.tuningKnobs && targetItem.details.tuningKnobs.length > 0) {
			rightLines.push(`${LAVENDER}${BOLD}Variables de Balance (Tuning Knobs)${RESET}`);
			for (const knob of targetItem.details.tuningKnobs.slice(0, 4)) {
				rightLines.push(`  ${YELLOW}${truncateAnsi(knob, rightWidth - 4)}${RESET}`);
			}
		}
	} else {
		// Milestone or Task Details
		rightLines.push(`${LAVENDER}${BOLD}Detalles de Producción${RESET}`);
		rightLines.push(`  ${WHITE}${targetItem.details.summary || targetItem.title}${RESET}`);
		rightLines.push("");

		if (targetItem.details.producerState) {
			const ps = targetItem.details.producerState;
			rightLines.push(`${LAVENDER}${BOLD}Estado del Productor (Roadmap Live)${RESET}`);
			if (ps.gameTitle) rightLines.push(`  ${GRAY}Juego:${RESET}     ${WHITE}${ps.gameTitle}${RESET}`);
			if (ps.engine) rightLines.push(`  ${GRAY}Motor:${RESET}     ${CYAN}${ps.engine}${RESET}`);
			if (ps.milestone) rightLines.push(`  ${GRAY}Hito:${RESET}      ${YELLOW}${ps.milestone}${RESET}`);
			if (ps.sprint) rightLines.push(`  ${GRAY}Sprint:${RESET}    ${WHITE}${ps.sprint}${RESET}`);
			if (ps.nextStep) rightLines.push(`  ${GRAY}Siguiente:${RESET} ${GREEN}${ps.nextStep}${RESET}`);
		}
	}

	// 4. Merge Left and Right Columns
	const maxRows = Math.max(leftLines.length, rightLines.length);
	for (let r = 0; r < maxRows; r++) {
		const l = padAnsi(leftLines[r] || "", leftWidth);
		const rContent = rightLines[r] || "";
		const rPadded = padAnsi(truncateAnsi(rContent, rightWidth - 2), rightWidth - 2);
		lines.push(`${BORDER}│${RESET}${l}${BORDER}│${RESET} ${rPadded} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}╰${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}╯${RESET}`);
	lines.push(`  ${GRAY}↑/↓ o j/k: Navegar • Tab: Filtrar (${activeFilter}) • Esc/q: Salir${RESET}`);

	return lines;
}

/**
 * Interactive full-screen / custom component for the timeline viewer.
 */
export class TimelineViewerComponent {
	private allItems: TimelineItem[];
	private filteredItems: TimelineItem[];
	private tui: any;
	private theme: any;
	private onClose: () => void;
	private selectedIndex: number = 0;
	private activeFilterIndex: number = 0;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		items: TimelineItem[],
		tui: any,
		theme: any,
		onClose: () => void,
		initialIndex: number = 0,
	) {
		this.allItems = items || [];
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.activeFilterIndex = 0; // "All"
		this.filteredItems = this.computeFilteredItems();
		this.selectedIndex = Math.max(0, Math.min(initialIndex, this.filteredItems.length - 1));
	}

	private computeFilteredItems(): TimelineItem[] {
		const currentFilter = FILTER_TABS[this.activeFilterIndex];
		if (currentFilter === "All") {
			return this.allItems;
		}
		return this.allItems.filter((it) => it.category === currentFilter);
	}

	getActiveFilter(): FilterCategory {
		return FILTER_TABS[this.activeFilterIndex];
	}

	getSelectedIndex(): number {
		return this.selectedIndex;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		if (
			isKeyMatch(data, "escape") ||
			isKeyMatch(data, "ctrl+c") ||
			isKeyMatch(data, "q")
		) {
			this.onClose();
			return;
		}

		if (isKeyMatch(data, "tab")) {
			this.activeFilterIndex = (this.activeFilterIndex + 1) % FILTER_TABS.length;
			this.filteredItems = this.computeFilteredItems();
			this.selectedIndex = Math.max(0, Math.min(this.selectedIndex, this.filteredItems.length - 1));
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "up")) {
			if (this.selectedIndex > 0) {
				this.selectedIndex--;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "down")) {
			if (this.selectedIndex < this.filteredItems.length - 1) {
				this.selectedIndex++;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines = renderTimelineSplitView(
			this.filteredItems,
			this.selectedIndex,
			this.getActiveFilter(),
			width,
		);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}

/**
 * Entry point for /studio:timeline and /timeline.
 */
export async function handleStudioTimelineViewer(
	_args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const root = findStudioRoot(ctx.cwd) || ctx.cwd;
	const timeline = parseProductionTimeline(root);

	if (timeline.items.length === 0) {
		const emptyMsg = "No se encontraron hitos en production/roadmap.md, ADRs ni Live Specs.";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(emptyMsg, "info");
		} else {
			console.log(emptyMsg);
		}
		return;
	}

	// Interactive TUI full-screen / custom component support
	if (ctx.hasUI && typeof (ctx.ui as any)?.custom === "function") {
		await (ctx.ui as any).custom((tui: any, theme: any, _kb: any, done: () => void) => {
			return new TimelineViewerComponent(timeline.items, tui, theme, done, 0);
		});
		return;
	}

	// Fallback for non-interactive environments
	const lines = renderTimelineSplitView(timeline.items, 0, "All", 80);
	const output = lines.join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(output, "info");
	} else {
		console.log("\n" + output + "\n");
	}
}
