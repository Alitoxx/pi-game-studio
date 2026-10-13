import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { studioAgentsRunner, type TaskRecord } from "./studio-agents-runner.ts";
import { formatElapsed } from "./studio-subagents-widget.ts";
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
	truncateAnsi,
	padAnsi,
} from "./studio-palette.ts";

/**
 * Checks for terminal input keys safely with fallback for headless/test environments.
 */
function isKeyMatch(data: string, name: string): boolean {
	if (name === "escape") return data === "\x1b" || data === "\x1b\x1b";
	if (name === "up") return data === "\x1b[A" || data === "k" || data === "K";
	if (name === "down") return data === "\x1b[B" || data === "j" || data === "J";
	if (name === "ctrl+c") return data === "\x03";
	if (name === "c") return data === "c" || data === "C";
	if (name === "q") return data === "q" || data === "Q";
	return false;
}

/**
 * Renders the clean modal view for a single subagent task.
 */
export function renderSubagentModalView(
	targetTask: TaskRecord,
	width: number = 80,
	options?: { selectedIndex?: number; totalTasks?: number },
): string[] {
	const cardWidth = Math.max(48, width);
	const innerWidth = cardWidth - 4;
	const lines: string[] = [];

	const now = Date.now();
	const elapsedMs = targetTask.startedAt
		? (targetTask.endedAt ? targetTask.endedAt - targetTask.startedAt : now - targetTask.startedAt)
		: 0;
	const elapsedStr = formatElapsed(elapsedMs);

	let statusBadge = `${YELLOW}◐ EN EJECUCIÓN${RESET}`;
	if (targetTask.status === "completed") statusBadge = `${GREEN}✓ COMPLETADO${RESET}`;
	if (targetTask.status === "failed") statusBadge = `${RED}✗ FALLIDO${RESET}`;
	if (targetTask.status === "cancelled") statusBadge = `${GRAY}○ CANCELADO${RESET}`;
	if (targetTask.status === "queued") statusBadge = `${GRAY}○ EN COLA${RESET}`;

	const headerTitle = `✿ INSPECTOR DE ESPECIALISTA · ${(targetTask.title || targetTask.agent).toUpperCase()}`;
	const ruleLen = Math.max(0, cardWidth - headerTitle.length - 5);

	lines.push(`${BORDER}╭─${RESET} ${BLUE}${headerTitle}${RESET} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Detalles de Ejecución${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Agente:${RESET}  ${WHITE}${targetTask.agent}${RESET} (${targetTask.title})`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Modelo:${RESET}  ${BLUE}${targetTask.model || "inherit"}${RESET}  ${GRAY}·  Estado:${RESET} ${statusBadge}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Tiempo:${RESET}  ${WHITE}${elapsedStr}${RESET}  ${GRAY}·  Task ID:${RESET} ${DIM}${targetTask.id}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);

	if (options?.totalTasks && options.totalTasks > 1) {
		const currentIdx = (options.selectedIndex ?? 0) + 1;
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GRAY}Navegación:${RESET} [${currentIdx}/${options.totalTasks}] ${GRAY}(usa ↑/↓ para cambiar de agente)${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);

	// Panel 1: Instruction / Prompt
	lines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Instrucción Asignada${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const taskLines = targetTask.task.split("\n").slice(0, 4);
	for (const tl of taskLines) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}${truncateAnsi(tl.trim(), innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);

	// Panel 2: Live Tool Call Events & Logs
	lines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Eventos y Llamadas de Herramientas (En Vivo)${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const eventLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs.slice(-12)
		: [`  ${DIM}(esperando primeros eventos de ejecución...)${RESET}`];

	for (const log of eventLogs) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}${truncateAnsi(log, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	// Panel 3: Final Result / Delivery or Error
	if (targetTask.result) {
		lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Resultado / Entrega Final${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		const resultPreview = targetTask.result.split("\n").slice(0, 8);
		for (const rl of resultPreview) {
			lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GREEN}${truncateAnsi(rl, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		}
	} else if (targetTask.error) {
		lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`${BORDER}│${RESET} ${padAnsi(`${RED}${BOLD}Error Registrado:${RESET} ${truncateAnsi(targetTask.error, innerWidth - 20)}`, innerWidth)} ${BORDER}│${RESET}`);
	} else if (targetTask.status === "running") {
		lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${YELLOW}◐ Especialista ejecutando en segundo plano...${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
	lines.push(`  ${GRAY}↑/↓: Seleccionar agente • Esc: Salir • c: Cancelar${RESET}`);

	return lines;
}

/**
 * Renders an interactive split-screen style presentation:
 * Left panel: List of subagents with selection indicator.
 * Right panel: Detailed live events, transcript, and output.
 */
export function renderSubagentSplitView(
	tasks: TaskRecord[],
	selectedIndex: number,
	width: number = 84,
): string[] {
	const totalWidth = Math.max(76, width);
	const leftWidth = Math.min(26, Math.max(22, Math.floor(totalWidth * 0.28)));
	const rightWidth = totalWidth - leftWidth - 1;

	const targetTask = tasks[selectedIndex] || tasks[0];

	// Generate left column lines (subagents list)
	const leftLines: string[] = [];
	leftLines.push(` ${BLUE}${BOLD}Agentes (${tasks.length})${RESET}`);
	leftLines.push(`${BORDER}${"─".repeat(leftWidth - 1)}${RESET}`);

	for (let i = 0; i < tasks.length; i++) {
		const t = tasks[i];
		let icon = `${GRAY}○${RESET}`;
		if (t.status === "completed") icon = `${GREEN}✓${RESET}`;
		else if (t.status === "running") icon = `${YELLOW}◐${RESET}`;
		else if (t.status === "failed") icon = `${RED}✗${RESET}`;

		const isSelected = i === selectedIndex;
		const marker = isSelected ? `${BLUE}▸${RESET} ` : "  ";
		const agentColor = isSelected ? `${BOLD}${WHITE}` : `${GRAY}`;
		const maxNameLen = leftWidth - 7;
		const nameDisplay = truncateAnsi(t.agent, maxNameLen);

		leftLines.push(`${marker}${icon} ${agentColor}${nameDisplay}${RESET}`);
	}

	// Generate right column lines (detailed task inspector)
	const now = Date.now();
	const elapsedMs = targetTask.startedAt
		? (targetTask.endedAt ? targetTask.endedAt - targetTask.startedAt : now - targetTask.startedAt)
		: 0;
	const elapsedStr = formatElapsed(elapsedMs);

	let statusBadge = `${YELLOW}◐ EN EJECUCIÓN${RESET}`;
	if (targetTask.status === "completed") statusBadge = `${GREEN}✓ COMPLETADO${RESET}`;
	if (targetTask.status === "failed") statusBadge = `${RED}✗ FALLIDO${RESET}`;
	if (targetTask.status === "cancelled") statusBadge = `${GRAY}○ CANCELADO${RESET}`;
	if (targetTask.status === "queued") statusBadge = `${GRAY}○ EN COLA${RESET}`;

	const rightLines: string[] = [];
	const headerTitle = `✿ INSPECTOR DE ESPECIALISTA · ${(targetTask.title || targetTask.agent).toUpperCase()}`;
	rightLines.push(`${BLUE}${BOLD}${truncateAnsi(headerTitle, rightWidth - 2)}${RESET}`);
	rightLines.push(`  ${GRAY}Modelo:${RESET} ${BLUE}${targetTask.model || "inherit"}${RESET}  ${GRAY}·${RESET}  ${statusBadge}  ${GRAY}·${RESET}  ${WHITE}${elapsedStr}${RESET}`);
	rightLines.push(`  ${GRAY}Task ID:${RESET} ${DIM}${targetTask.id}${RESET}`);
	rightLines.push("");

	// Panel: Instruction
	rightLines.push(`${LAVENDER}${BOLD}Instrucción Asignada${RESET}`);
	const taskLines = targetTask.task.split("\n").slice(0, 3);
	for (const tl of taskLines) {
		rightLines.push(`  ${WHITE}${truncateAnsi(tl.trim(), rightWidth - 4)}${RESET}`);
	}
	rightLines.push("");

	// Panel: Live Events & Logs
	rightLines.push(`${LAVENDER}${BOLD}Eventos y Llamadas de Herramientas (En Vivo)${RESET}`);
	const eventLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs.slice(-10)
		: [`  ${DIM}(esperando primeros eventos de ejecución...)${RESET}`];

	for (const log of eventLogs) {
		rightLines.push(`  ${WHITE}${truncateAnsi(log, rightWidth - 4)}${RESET}`);
	}

	// Panel: Result / Error
	if (targetTask.result) {
		rightLines.push("");
		rightLines.push(`${LAVENDER}${BOLD}Resultado / Entrega Final${RESET}`);
		const resultPreview = targetTask.result.split("\n").slice(0, 5);
		for (const rl of resultPreview) {
			rightLines.push(`  ${GREEN}${truncateAnsi(rl, rightWidth - 4)}${RESET}`);
		}
	} else if (targetTask.error) {
		rightLines.push("");
		rightLines.push(`${RED}${BOLD}Error Registrado:${RESET} ${truncateAnsi(targetTask.error, rightWidth - 20)}`);
	} else if (targetTask.status === "running") {
		rightLines.push("");
		rightLines.push(`  ${YELLOW}◐ Ejecución activa en segundo plano...${RESET}`);
	}

	// Combine left and right columns
	const maxRows = Math.max(leftLines.length, rightLines.length);
	const lines: string[] = [];

	lines.push(`${BORDER}╭${"─".repeat(leftWidth)}┬${"─".repeat(rightWidth)}╮${RESET}`);
	for (let r = 0; r < maxRows; r++) {
		const l = padAnsi(leftLines[r] || "", leftWidth);
		const rContent = rightLines[r] || "";
		const rPadded = padAnsi(truncateAnsi(rContent, rightWidth - 2), rightWidth - 2);
		lines.push(`${BORDER}│${RESET}${l}${BORDER}│${RESET} ${rPadded} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}╰${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}╯${RESET}`);
	lines.push(`  ${GRAY}↑/↓: Seleccionar agente • Esc: Salir • c: Cancelar${RESET}`);

	return lines;
}

/**
 * Interactive full-screen / custom component for the subagents viewer.
 */
export class SubagentsViewerComponent {
	private tasks: TaskRecord[];
	private tui: any;
	private theme: any;
	private onClose: () => void;
	private selectedIndex: number;
	private unsub?: () => void;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		tasks: TaskRecord[],
		tui: any,
		theme: any,
		onClose: () => void,
		initialIndex: number = 0,
	) {
		this.tasks = tasks;
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.selectedIndex = Math.max(0, Math.min(initialIndex, tasks.length - 1));

		// Real-time live listener for tool calls and streaming logs
		this.unsub = studioAgentsRunner.subscribe(() => {
			this.tasks = studioAgentsRunner.listTasks();
			this.invalidate();
			if (this.tui?.requestRender) {
				try {
					this.tui.requestRender();
				} catch {}
			}
		});
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
			if (this.unsub) this.unsub();
			this.onClose();
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
			if (this.selectedIndex < this.tasks.length - 1) {
				this.selectedIndex++;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "c")) {
			const current = this.tasks[this.selectedIndex];
			if (current && (current.status === "running" || current.status === "queued")) {
				studioAgentsRunner.cancelTask(current.id);
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

		const lines = (width >= 76 && this.tasks.length > 1)
			? renderSubagentSplitView(this.tasks, this.selectedIndex, width)
			: renderSubagentModalView(this.tasks[this.selectedIndex] || this.tasks[0], width, {
				selectedIndex: this.selectedIndex,
				totalTasks: this.tasks.length,
			});

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}

/**
 * Entry point for /studio:subagents, /studio:agents, /agents, and /studio:logs.
 * When the user executes the command, opens an interactive split-screen viewer or modal view.
 */
export async function handleStudioSubagentsViewer(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const tasks = studioAgentsRunner.listTasks();

	if (tasks.length === 0) {
		const emptyMsg = "No hay subagentes registrados en la sesión actual.";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(emptyMsg, "info");
		} else {
			console.log(emptyMsg);
		}
		return;
	}

	const trimmedArg = args.trim();
	let initialIndex = 0;

	if (trimmedArg) {
		const foundIdx = tasks.findIndex(
			(t) => t.id === trimmedArg || t.agent.toLowerCase() === trimmedArg.toLowerCase(),
		);
		if (foundIdx !== -1) initialIndex = foundIdx;
	}

	// Interactive TUI full-screen / custom view support
	if (ctx.hasUI && typeof (ctx.ui as any)?.custom === "function") {
		await (ctx.ui as any).custom((tui: any, theme: any, _kb: any, done: () => void) => {
			return new SubagentsViewerComponent(tasks, tui, theme, done, initialIndex);
		});
		return;
	}

	// Fallback for environments without custom components
	let targetTask = tasks[initialIndex];
	if (!trimmedArg && tasks.length > 1 && ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = tasks.map((t, idx) => {
			const badge = t.status === "running" ? "◐ ACTIVO" : t.status === "completed" ? "✓ LISTO" : "✗ FALLO";
			return `${idx + 1}. [${badge}] ${t.agent} — ${t.latestActivity || t.task.slice(0, 35)}`;
		});

		const picked = await (ctx.ui as any).select(
			"Selecciona el especialista para inspeccionar sus logs en vivo:",
			options,
		);

		if (picked === undefined || picked === null) return;
		const idx = typeof picked === "number" ? picked : options.indexOf(picked);
		initialIndex = idx >= 0 ? idx : 0;
		targetTask = tasks[initialIndex] || tasks[0];
	}

	const modalLines = (tasks.length > 1)
		? renderSubagentSplitView(tasks, initialIndex, 80)
		: renderSubagentModalView(targetTask, 80, {
			selectedIndex: initialIndex,
			totalTasks: tasks.length,
		});

	const screenText = modalLines.join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(screenText, "info");
	} else {
		console.log("\n" + screenText + "\n");
	}
}
