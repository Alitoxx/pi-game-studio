import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { studioAgentsRunner, type TaskRecord } from "./studio-agents-runner.ts";
import { formatElapsed } from "./studio-subagents-widget.ts";
import { setStudioSidebarSuppressed } from "./studio-sidebar.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	GRAY,
	ACCENT as BLUE,
	HEADING as LAVENDER,
	SECONDARY,
	WHITE,
	BORDER,
	RED,
	truncateAnsi,
	padAnsi,
} from "./studio-palette.ts";

let piTuiMatchesKey: ((data: string, keyId: string) => boolean) | undefined;
try {
	// Dynamically resolve matchesKey if running under Pi runtime
	const tuiMod = require("@earendil-works/pi-tui");
	if (typeof tuiMod?.matchesKey === "function") {
		piTuiMatchesKey = tuiMod.matchesKey;
	}
} catch {}

function matchesKeySafe(data: string, keyId: string): boolean {
	if (piTuiMatchesKey) {
		try {
			return piTuiMatchesKey(data, keyId);
		} catch {}
	}
	return false;
}

/**
 * Checks for terminal input keys safely with fallback for headless/test environments.
 */
function isKeyMatch(data: string, name: string): boolean {
	if (name === "escape") {
		return (
			matchesKeySafe(data, "escape") ||
			matchesKeySafe(data, "esc") ||
			data === "\x1b" ||
			data === "\x1b\x1b" ||
			data === "\x1b[27;1;27~" ||
			data === "\x1b[27;5;27~"
		);
	}
	if (name === "tab") {
		return (
			data === "\t" ||
			matchesKeySafe(data, "tab") ||
			data === "v" ||
			data === "V"
		);
	}
	if (name === "up") {
		return (
			matchesKeySafe(data, "up") ||
			data === "\x1b[A" ||
			data === "\x1bOA" ||
			data === "k" ||
			data === "K"
		);
	}
	if (name === "down") {
		return (
			matchesKeySafe(data, "down") ||
			data === "\x1b[B" ||
			data === "\x1bOB" ||
			data === "j" ||
			data === "J"
		);
	}
	if (name === "left") {
		return (
			matchesKeySafe(data, "left") ||
			data === "\x1b[D" ||
			data === "\x1bOD" ||
			data === "h" ||
			data === "H"
		);
	}
	if (name === "right") {
		return (
			matchesKeySafe(data, "right") ||
			data === "\x1b[C" ||
			data === "\x1bOC" ||
			data === "l" ||
			data === "L"
		);
	}
	if (name === "pageup") {
		return (
			matchesKeySafe(data, "pageup") ||
			data === "\x1b[5~" ||
			matchesKeySafe(data, "ctrl+u") ||
			data === "\x15" ||
			matchesKeySafe(data, "ctrl+b") ||
			data === "\x02"
		);
	}
	if (name === "pagedown") {
		return (
			matchesKeySafe(data, "pagedown") ||
			data === "\x1b[6~" ||
			matchesKeySafe(data, "ctrl+d") ||
			data === "\x04" ||
			matchesKeySafe(data, "ctrl+f") ||
			data === "\x06"
		);
	}
	if (name === "shift+up") {
		return (
			matchesKeySafe(data, "shift+up") ||
			data === "\x1b[1;2A" ||
			data === "\x1b[a"
		);
	}
	if (name === "shift+down") {
		return (
			matchesKeySafe(data, "shift+down") ||
			data === "\x1b[1;2B" ||
			data === "\x1b[b"
		);
	}
	if (name === "home") {
		return matchesKeySafe(data, "home") || data === "\x1b[H" || data === "\x1b[1~";
	}
	if (name === "end") {
		return matchesKeySafe(data, "end") || data === "\x1b[F" || data === "\x1b[4~";
	}
	if (name === "ctrl+c") {
		return matchesKeySafe(data, "ctrl+c") || data === "\x03";
	}
	if (name === "c") {
		return data === "c" || data === "C";
	}
	if (name === "q") {
		return data === "q" || data === "Q";
	}
	if (name === "open") {
		return (
			data === "o" ||
			data === "O" ||
			matchesKeySafe(data, "enter") ||
			matchesKeySafe(data, "return") ||
			data === "\r" ||
			data === "\n"
		);
	}
	return false;
}

/**
 * Wraps done callback to ensure terminal cell buffer is completely repainted
 * with requestRender(true) when the fullscreen overlay closes (Gentle Shell pattern).
 */
export function withOverlayRepaint<T>(tui: any, done: (result?: T) => void): (result?: T) => void {
	return (result?: T): void => {
		try {
			done(result);
		} catch {}
		try {
			if (typeof tui?.requestRender === "function") {
				tui.requestRender(true);
			}
		} catch {}
	};
}

/**
 * Opens task details and live event transcript in external editor or pager ($VISUAL / $EDITOR),
 * suspending TUI cleanly like Gentle Shell.
 */
export function openTaskInEditor(tui: any, task: TaskRecord): boolean {
	const editorCmd = process.env.VISUAL || process.env.EDITOR || (process.platform === "win32" ? "notepad" : "nano");
	if (!editorCmd) return false;

	const dir = join(tmpdir(), "pi-studio-transcripts");
	try {
		mkdirSync(dir, { recursive: true });
	} catch {}

	const transcriptContent = [
		`# Inspector de Especialista: ${task.agent} (${task.title || task.agent})`,
		`- Estado: ${task.status.toUpperCase()}`,
		`- Modelo: ${task.model || "inherit"}`,
		`- Task ID: ${task.id}`,
		`- Directorio: ${task.cwd}`,
		`- Inicio: ${task.startedAt ? new Date(task.startedAt).toLocaleString() : "N/D"}`,
		`- Fin: ${task.endedAt ? new Date(task.endedAt).toLocaleString() : "N/D"}`,
		"",
		"---",
		"## Instrucción Asignada",
		"```",
		task.task,
		"```",
		"",
		"---",
		"## Eventos y Llamadas de Herramientas (En Vivo)",
		...(task.logs.length > 0 ? task.logs.map((l) => `- ${l}`) : ["*(sin eventos registrados)*"]),
		"",
		"---",
		"## Resultado / Entrega Final",
		task.result ? task.result : (task.error ? `**Error Registrado:** ${task.error}` : "*(ejecución en curso en segundo plano...)*"),
	].join("\n");

	const transcriptPath = join(dir, `${task.id}.md`);
	try {
		writeFileSync(transcriptPath, transcriptContent, "utf8");
	} catch {
		return false;
	}

	const [cmd, ...args] = editorCmd.split(" ");
	if (typeof tui?.stop === "function") tui.stop();
	try {
		spawnSync(cmd, [...args, transcriptPath], {
			cwd: task.cwd || process.cwd(),
			stdio: "inherit",
			shell: process.platform === "win32",
		});
	} catch {
		return false;
	} finally {
		if (typeof tui?.start === "function") tui.start();
		if (typeof tui?.requestRender === "function") tui.requestRender(true);
	}
	return true;
}

/**
 * Renders an expansive, full-screen Live Stream Console of agent execution.
 * Dedicated 100% to displaying real-time tool calls, bash outputs, thinking stream,
 * test results, code changes and errors with interactive scrolling.
 */
export function renderSubagentLiveConsoleView(
	targetTask: TaskRecord,
	width: number = 80,
	height?: number,
	scrollOffset: number = 0,
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

	const headerTitle = `◈ CONSOLA EN VIVO · ${(targetTask.title || targetTask.agent).toUpperCase()}`;
	const ruleLen = Math.max(0, cardWidth - headerTitle.length - 5);

	lines.push(`${BORDER}╭─${RESET} ${BLUE}${headerTitle}${RESET} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);

	// Compact 2-line header bar
	const statusLine = `  ${statusBadge} ${GRAY}·${RESET} ${GRAY}Modelo:${RESET} ${BLUE}${targetTask.model || "inherit"}${RESET} ${GRAY}·${RESET} ${GRAY}Tiempo:${RESET} ${WHITE}${elapsedStr}${RESET} ${GRAY}·${RESET} ${GRAY}Task:${RESET} ${DIM}${targetTask.id}${RESET}`;
	lines.push(`${BORDER}│${RESET} ${padAnsi(statusLine, innerWidth)} ${BORDER}│${RESET}`);

	const firstTaskLine = targetTask.task.split("\n")[0]?.trim() || "";
	const instructionLine = `  ${GRAY}Instrucción:${RESET} ${WHITE}${truncateAnsi(firstTaskLine, innerWidth - 17)}${RESET}`;
	lines.push(`${BORDER}│${RESET} ${padAnsi(instructionLine, innerWidth)} ${BORDER}│${RESET}`);

	lines.push(`${BORDER}├${"─".repeat(cardWidth - 2)}┤${RESET}`);

	// Chrome count: 4 top lines + 2 bottom lines = 6
	const requestedHeight = height ? Math.max(16, height) : 24;
	const availableRows = Math.max(4, requestedHeight - 6);

	const allLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs
		: [`${DIM}(esperando primeros eventos de ejecución en tiempo real...)${RESET}`];

	const totalLogs = allLogs.length;
	const maxOffset = Math.max(0, totalLogs - availableRows);
	const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

	const endIdx = totalLogs - clampedOffset;
	const startIdx = Math.max(0, endIdx - availableRows);
	const visibleLogs = allLogs.slice(startIdx, endIdx);

	for (const rawLog of visibleLogs) {
		let styledLog = rawLog;
		if (rawLog.includes("  bash ") || rawLog.includes("❯ bash:")) {
			styledLog = `${SECONDARY}${BOLD}${rawLog}${RESET}`;
		} else if (rawLog.includes("  read ") || rawLog.includes("📖 read:")) {
			styledLog = `${LAVENDER}${rawLog}${RESET}`;
		} else if (rawLog.includes("  write ") || rawLog.includes("  edit ") || rawLog.includes("✎ write:") || rawLog.includes("✎ edit:")) {
			styledLog = `${GREEN}${rawLog}${RESET}`;
		} else if (rawLog.includes("  find ") || rawLog.includes("  grep ") || rawLog.includes("🔍 find:") || rawLog.includes("🔍 grep:")) {
			styledLog = `${BLUE}${rawLog}${RESET}`;
		} else if (rawLog.includes("  think ") || rawLog.includes("💭")) {
			styledLog = `${LAVENDER}${DIM}${rawLog}${RESET}`;
		} else if (rawLog.includes("  text ") || rawLog.includes("💬")) {
			styledLog = `${WHITE}${rawLog}${RESET}`;
		} else if (rawLog.includes("  done ")) {
			styledLog = `${GREEN}${BOLD}${rawLog}${RESET}`;
		} else if (rawLog.includes("err (") || rawLog.includes("✗ [error") || rawLog.includes("stderr:")) {
			styledLog = `${RED}${rawLog}${RESET}`;
		} else if (rawLog.includes("ok (") || rawLog.includes("out (") || rawLog.includes("↳ [")) {
			styledLog = `${GRAY}${rawLog}${RESET}`;
		} else if (rawLog.startsWith("          ") || rawLog.startsWith("         ")) {
			styledLog = `${WHITE}${rawLog}${RESET}`;
		}

		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${truncateAnsi(styledLog, innerWidth - 4)}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	// Pad remaining vertical rows if log stream has fewer lines than terminal height
	const padCount = availableRows - visibleLogs.length;
	for (let p = 0; p < padCount; p++) {
		lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);

	const scrollIndicator = clampedOffset > 0 ? ` [Scroll: -${clampedOffset}]` : "";
	lines.push(`  ${GRAY}Tab/v: Alternar Resumen • ↑/↓/PgUp/PgDn: Scroll • o: Editor • c: Cancelar • Esc: Salir${scrollIndicator}${RESET}`);

	return lines;
}

/**
 * Renders the clean modal view for a single subagent task, adapting dynamically
 * to full terminal height when provided.
 */
export function renderSubagentModalView(
	targetTask: TaskRecord,
	width: number = 80,
	options?: { selectedIndex?: number; totalTasks?: number; height?: number; scrollOffset?: number },
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

	const headerTitle = `◈ INSPECTOR DE ESPECIALISTA · ${(targetTask.title || targetTask.agent).toUpperCase()}`;
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
	const taskLines = targetTask.task.split("\n").slice(0, 3);
	for (const tl of taskLines) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}${truncateAnsi(tl.trim(), innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);

	// Prepare results or error lines
	const resultLines: string[] = [];
	if (targetTask.result) {
		resultLines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		resultLines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Resultado / Entrega Final${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		const resultPreview = targetTask.result.split("\n").slice(0, 6);
		for (const rl of resultPreview) {
			resultLines.push(`${BORDER}│${RESET} ${padAnsi(`  ${GREEN}${truncateAnsi(rl, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		}
	} else if (targetTask.error) {
		resultLines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		resultLines.push(`${BORDER}│${RESET} ${padAnsi(`${RED}${BOLD}Error Registrado:${RESET} ${truncateAnsi(targetTask.error, innerWidth - 20)}`, innerWidth)} ${BORDER}│${RESET}`);
	} else if (targetTask.status === "running") {
		resultLines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		resultLines.push(`${BORDER}│${RESET} ${padAnsi(`  ${YELLOW}◐ Especialista ejecutando en segundo plano...${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	// Panel 2: Live Tool Call Events & Logs
	lines.push(`${BORDER}│${RESET} ${padAnsi(`${LAVENDER}${BOLD}Eventos y Llamadas de Herramientas (En Vivo)${RESET}`, innerWidth)} ${BORDER}│${RESET}`);

	const footerChrome = 2; // bottom border + shortcuts footer
	const fixedCount = lines.length + resultLines.length + footerChrome;
	const requestedHeight = options?.height ? Math.max(16, options.height) : undefined;
	const availableLogRows = requestedHeight ? Math.max(3, requestedHeight - fixedCount) : 12;

	const allLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs
		: [`  ${DIM}(esperando primeros eventos de ejecución...)${RESET}`];

	const scrollOffset = options?.scrollOffset ?? 0;
	const totalLogs = allLogs.length;
	const maxOffset = Math.max(0, totalLogs - availableLogRows);
	const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

	const endIdx = totalLogs - clampedOffset;
	const startIdx = Math.max(0, endIdx - availableLogRows);
	const eventLogs = allLogs.slice(startIdx, endIdx);
	for (const log of eventLogs) {
		lines.push(`${BORDER}│${RESET} ${padAnsi(`  ${WHITE}${truncateAnsi(log, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	// Fill remaining vertical space to achieve 100% full screen
	if (requestedHeight) {
		const currentTotal = lines.length + resultLines.length + footerChrome;
		const paddingNeeded = requestedHeight - currentTotal;
		for (let p = 0; p < paddingNeeded; p++) {
			lines.push(`${BORDER}│${RESET} ${padAnsi("", innerWidth)} ${BORDER}│${RESET}`);
		}
	}

	// Append results panel
	for (const rl of resultLines) {
		lines.push(rl);
	}

	lines.push(`${BORDER}╰${"─".repeat(cardWidth - 2)}╯${RESET}`);
	const scrollIndicator = clampedOffset > 0 ? ` ${YELLOW}[Scroll: -${clampedOffset} • End: fin]${RESET}` : "";
	lines.push(`  ${GRAY}Tab/v: Consola Stream • ↑/↓: Seleccionar agente • Esc: Salir • c: Cancelar • o: Abrir en editor externo • PgUp/PgDn/Rueda: Scroll${scrollIndicator}${RESET}`);

	return lines;
}

/**
 * Renders an interactive split-screen style presentation:
 * Left panel: List of subagents with selection indicator.
 * Right panel: Detailed live events, transcript, and output.
 * Adapts dynamically to 100% terminal height and width.
 */
export function renderSubagentSplitView(
	tasks: TaskRecord[],
	selectedIndex: number,
	width: number = 84,
	height?: number,
	scrollOffset: number = 0,
): string[] {
	const totalWidth = Math.max(76, width);
	const leftWidth = Math.min(28, Math.max(22, Math.floor(totalWidth * 0.28)));
	const rightWidth = totalWidth - leftWidth - 1;

	const targetTask = tasks[selectedIndex] || tasks[0];

	// Target body height to fill 100% terminal screen
	const requestedHeight = height ? Math.max(16, height) : undefined;
	const targetBodyRows = requestedHeight ? requestedHeight - 3 : undefined; // 1 top, 1 bottom, 1 footer

	// Generate left column lines (subagents list)
	const leftContent: string[] = [];
	leftContent.push(` ${BLUE}${BOLD}Agentes (${tasks.length})${RESET}`);
	leftContent.push(`${BORDER}${"─".repeat(leftWidth - 1)}${RESET}`);

	const maxVisibleLeftTasks = targetBodyRows ? Math.max(2, targetBodyRows - 2) : tasks.length;
	let leftScroll = 0;
	if (tasks.length > maxVisibleLeftTasks) {
		leftScroll = Math.max(0, Math.min(tasks.length - maxVisibleLeftTasks, selectedIndex - Math.floor(maxVisibleLeftTasks / 2)));
	}
	const visibleTasks = tasks.slice(leftScroll, leftScroll + maxVisibleLeftTasks);

	for (let i = 0; i < visibleTasks.length; i++) {
		const actualIdx = leftScroll + i;
		const t = visibleTasks[i];
		let icon = `${GRAY}○${RESET}`;
		if (t.status === "completed") icon = `${GREEN}✓${RESET}`;
		else if (t.status === "running") icon = `${YELLOW}◐${RESET}`;
		else if (t.status === "failed") icon = `${RED}✗${RESET}`;

		const isSelected = actualIdx === selectedIndex;
		const marker = isSelected ? `${BLUE}▸${RESET} ` : "  ";
		const agentColor = isSelected ? `${BOLD}${WHITE}` : `${GRAY}`;
		const maxNameLen = leftWidth - 7;
		const nameDisplay = truncateAnsi(t.agent, maxNameLen);

		leftContent.push(`${marker}${icon} ${agentColor}${nameDisplay}${RESET}`);
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

	const headerLines: string[] = [];
	const headerTitle = `◈ INSPECTOR DE ESPECIALISTA · ${(targetTask.title || targetTask.agent).toUpperCase()}`;
	headerLines.push(`${BLUE}${BOLD}${truncateAnsi(headerTitle, rightWidth - 2)}${RESET}`);
	headerLines.push(`  ${GRAY}Modelo:${RESET} ${BLUE}${targetTask.model || "inherit"}${RESET}  ${GRAY}·${RESET}  ${statusBadge}  ${GRAY}·${RESET}  ${WHITE}${elapsedStr}${RESET}`);
	headerLines.push(`  ${GRAY}Task ID:${RESET} ${DIM}${targetTask.id}${RESET}`);
	headerLines.push("");

	// Panel: Instruction
	headerLines.push(`${LAVENDER}${BOLD}Instrucción Asignada${RESET}`);
	const taskLines = targetTask.task.split("\n").slice(0, 3);
	for (const tl of taskLines) {
		headerLines.push(`  ${WHITE}${truncateAnsi(tl.trim(), rightWidth - 4)}${RESET}`);
	}
	headerLines.push("");

	// Panel: Result / Error
	const footerRightLines: string[] = [];
	if (targetTask.result) {
		footerRightLines.push("");
		footerRightLines.push(`${LAVENDER}${BOLD}Resultado / Entrega Final${RESET}`);
		const resultPreview = targetTask.result.split("\n").slice(0, 5);
		for (const rl of resultPreview) {
			footerRightLines.push(`  ${GREEN}${truncateAnsi(rl, rightWidth - 4)}${RESET}`);
		}
	} else if (targetTask.error) {
		footerRightLines.push("");
		footerRightLines.push(`${RED}${BOLD}Error Registrado:${RESET} ${truncateAnsi(targetTask.error, rightWidth - 20)}`);
	} else if (targetTask.status === "running") {
		footerRightLines.push("");
		footerRightLines.push(`  ${YELLOW}◐ Ejecución activa en segundo plano...${RESET}`);
	}

	const allLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs
		: [`  ${DIM}(esperando primeros eventos de ejecución...)${RESET}`];

	const totalLogs = allLogs.length;
	const maxOffset = Math.max(0, totalLogs - availableLogRows);
	const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

	const endIdx = totalLogs - clampedOffset;
	const startIdx = Math.max(0, endIdx - availableLogRows);
	const eventLogs = allLogs.slice(startIdx, endIdx);

	const scrollHeaderNote = clampedOffset > 0 ? ` ${YELLOW}[Scroll: -${clampedOffset}]${RESET}` : "";
	const logHeader = `${LAVENDER}${BOLD}Eventos y Llamadas de Herramientas (En Vivo)${RESET}${scrollHeaderNote}`;
	const fixedRightCount = headerLines.length + 1 /* logHeader */ + footerRightLines.length;

	const rightContent: string[] = [...headerLines, logHeader];
	for (const log of eventLogs) {
		rightContent.push(`  ${WHITE}${truncateAnsi(log, rightWidth - 4)}${RESET}`);
	}
	for (const fr of footerRightLines) {
		rightContent.push(fr);
	}

	// Combine left and right columns filling exactly targetBodyRows
	const maxRows = targetBodyRows || Math.max(leftContent.length, rightContent.length);
	const lines: string[] = [];

	lines.push(`${BORDER}╭${"─".repeat(leftWidth)}┬${"─".repeat(rightWidth)}╮${RESET}`);
	for (let r = 0; r < maxRows; r++) {
		const l = padAnsi(leftContent[r] || "", leftWidth);
		const rContent = rightContent[r] || "";
		const rPadded = padAnsi(truncateAnsi(rContent, rightWidth - 2), rightWidth - 2);
		lines.push(`${BORDER}│${RESET}${l}${BORDER}│${RESET} ${rPadded} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}╰${"─".repeat(leftWidth)}┴${"─".repeat(rightWidth)}╯${RESET}`);
	const bottomScrollIndicator = clampedOffset > 0 ? ` ${YELLOW}[Scroll: -${clampedOffset} • End: fin]${RESET}` : "";
	lines.push(`  ${GRAY}Tab/v: Consola Stream • ↑/↓: Seleccionar agente • Esc: Salir • c: Cancelar • o: Abrir en editor externo • PgUp/PgDn/Rueda: Scroll${bottomScrollIndicator}${RESET}`);

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
	private viewMode: "stream" | "card";
	private scrollOffset: number = 0;
	private cachedWidth?: number;
	private cachedHeight?: number;
	private cachedLines?: string[];

	constructor(
		tasks: TaskRecord[],
		tui: any,
		theme: any,
		onClose: () => void,
		initialIndex: number = 0,
		preferredMode?: "stream" | "card",
	) {
		this.tasks = tasks;
		this.tui = tui;
		this.theme = theme;
		this.onClose = onClose;
		this.selectedIndex = Math.max(0, Math.min(initialIndex, tasks.length - 1));
		const currentTask = this.tasks[this.selectedIndex] || this.tasks[0];
		this.viewMode = preferredMode || (currentTask?.status === "running" ? "stream" : "card");

		// Suppress right sidebar so the inspector occupies 100% full screen without side cards
		setStudioSidebarSuppressed(true, tui);

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
		this.cachedHeight = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		if (
			isKeyMatch(data, "escape") ||
			isKeyMatch(data, "ctrl+c") ||
			isKeyMatch(data, "q")
		) {
			setStudioSidebarSuppressed(false, this.tui);
			if (this.unsub) {
				try {
					this.unsub();
				} catch {}
				this.unsub = undefined;
			}
			this.onClose();
			return;
		}

		if (isKeyMatch(data, "tab")) {
			this.viewMode = this.viewMode === "stream" ? "card" : "stream";
			this.scrollOffset = 0;
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "shift+up")) {
			this.scrollOffset++;
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "shift+down")) {
			this.scrollOffset = Math.max(0, this.scrollOffset - 1);
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "up")) {
			if (this.viewMode === "stream" || this.tasks.length <= 1) {
				this.scrollOffset++;
				this.invalidate();
				this.tui?.requestRender?.();
			} else if (this.selectedIndex > 0) {
				this.selectedIndex--;
				this.scrollOffset = 0;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "down")) {
			if (this.viewMode === "stream" || this.tasks.length <= 1) {
				this.scrollOffset = Math.max(0, this.scrollOffset - 1);
				this.invalidate();
				this.tui?.requestRender?.();
			} else if (this.selectedIndex < this.tasks.length - 1) {
				this.selectedIndex++;
				this.scrollOffset = 0;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "left")) {
			if (this.selectedIndex > 0) {
				this.selectedIndex--;
				this.scrollOffset = 0;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "right")) {
			if (this.selectedIndex < this.tasks.length - 1) {
				this.selectedIndex++;
				this.scrollOffset = 0;
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}

		if (isKeyMatch(data, "pageup")) {
			this.scrollOffset += 10;
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "pagedown")) {
			this.scrollOffset = Math.max(0, this.scrollOffset - 10);
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "home")) {
			this.scrollOffset = 999999;
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "end")) {
			this.scrollOffset = 0;
			this.invalidate();
			this.tui?.requestRender?.();
			return;
		}

		if (isKeyMatch(data, "open")) {
			const current = this.tasks[this.selectedIndex] || this.tasks[0];
			if (current) {
				openTaskInEditor(this.tui, current);
				this.invalidate();
				this.tui?.requestRender?.(true);
			}
			return;
		}

		if (isKeyMatch(data, "c")) {
			const current = this.tasks[this.selectedIndex];
			if (current && (current.status === "running" || current.status === "queued")) {
				if (typeof (studioAgentsRunner as any).cancelTask === "function") {
					(studioAgentsRunner as any).cancelTask(current.id);
				} else if (typeof (studioAgentsRunner as any).cancel === "function") {
					(studioAgentsRunner as any).cancel(current.id);
				}
				this.invalidate();
				this.tui?.requestRender?.();
			}
			return;
		}
	}

	render(width: number): string[] {
		const height = Math.max(
			12,
			this.tui?.terminal?.rows ||
			(typeof process !== "undefined" && process.stdout?.rows) ||
			24,
		);

		if (this.cachedLines && this.cachedWidth === width && this.cachedHeight === height) {
			return this.cachedLines;
		}

		let lines: string[];
		const targetTask = this.tasks[this.selectedIndex] || this.tasks[0];

		if (this.viewMode === "stream") {
			lines = renderSubagentLiveConsoleView(targetTask, width, height, this.scrollOffset);
		} else {
			lines = (width >= 76 && this.tasks.length > 1)
				? renderSubagentSplitView(this.tasks, this.selectedIndex, width, height, this.scrollOffset)
				: renderSubagentModalView(targetTask, width, {
					selectedIndex: this.selectedIndex,
					totalTasks: this.tasks.length,
					height,
					scrollOffset: this.scrollOffset,
				});
		}

		this.cachedWidth = width;
		this.cachedHeight = height;
		this.cachedLines = lines;
		return lines;
	}

	handleMouse(event: any): any {
		if (event?.type === "wheel") {
			const delta = event.wheelDelta ?? (event.direction ?? 0);
			if (delta !== 0) {
				const lines = Math.max(1, Math.abs(delta)) * 2;
				if (delta < 0) {
					// Wheel up -> historial previo
					this.scrollOffset += lines;
				} else {
					// Wheel down -> hacia el presente
					this.scrollOffset = Math.max(0, this.scrollOffset - lines);
				}
				this.invalidate();
				this.tui?.requestRender?.();
				return { handled: true, render: true };
			}
		}

		if (event?.type === "click" || event?.type === "press") {
			// Click en la lista de agentes en Split View (panel izquierdo)
			const width = this.cachedWidth || 80;
			if (width >= 76 && this.tasks.length > 1 && this.viewMode !== "stream") {
				const leftWidth = Math.min(28, Math.max(22, Math.floor(width * 0.28)));
				if (event.x >= 0 && event.x <= leftWidth) {
					const row = event.y - 1; // row 0 es borde superior
					// row 0 es título "Agentes (N)", row 1 es divisor
					const targetIndex = row - 2;
					if (targetIndex >= 0 && targetIndex < this.tasks.length) {
						if (this.selectedIndex !== targetIndex) {
							this.selectedIndex = targetIndex;
							this.scrollOffset = 0;
							this.invalidate();
							this.tui?.requestRender?.();
							return { handled: true, render: true };
						}
					}
				}
			}
		}

		return undefined;
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
	let preferredMode: "stream" | "card" | undefined;

	if (trimmedArg === "logs" || trimmedArg === "stream" || trimmedArg === "console") {
		preferredMode = "stream";
	} else if (trimmedArg) {
		const foundIdx = tasks.findIndex(
			(t) => t.id === trimmedArg || t.agent.toLowerCase() === trimmedArg.toLowerCase(),
		);
		if (foundIdx !== -1) initialIndex = foundIdx;
	}

	// Interactive TUI full-screen / custom modal overlay (idéntico a Gentle Shell)
	if (ctx.hasUI && typeof (ctx.ui as any)?.custom === "function") {
		setStudioSidebarSuppressed(true);
		try {
			await (ctx.ui as any).custom(
				(tui: any, theme: any, _kb: any, done: () => void) => {
					const close = withOverlayRepaint(tui, (res?: any) => {
						setStudioSidebarSuppressed(false, tui);
						done(res);
					});
					return new SubagentsViewerComponent(tasks, tui, theme, close, initialIndex, preferredMode);
				},
				{
					overlay: true,
					overlayOptions: {
						width: "100%",
						maxHeight: "100%",
						margin: 0,
						anchor: "center",
					},
				},
			);
		} finally {
			setStudioSidebarSuppressed(false);
		}
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

	const modalLines = (preferredMode === "stream" || targetTask.status === "running")
		? renderSubagentLiveConsoleView(targetTask, 80, 24)
		: (tasks.length > 1
			? renderSubagentSplitView(tasks, initialIndex, 80)
			: renderSubagentModalView(targetTask, 80, {
				selectedIndex: initialIndex,
				totalTasks: tasks.length,
			}));

	const screenText = modalLines.join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(screenText, "info");
	} else {
		console.log("\n" + screenText + "\n");
	}
}
