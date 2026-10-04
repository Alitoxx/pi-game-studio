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
} from "./studio-palette.ts";

/**
 * Renders an interactive full-screen log inspector / detail view for subagents.
 * When the user executes /studio:subagents or /studio:logs, they can view
 * the live activity, tool calls, and completion output of any specialist.
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
	let targetTask: TaskRecord | undefined;

	if (trimmedArg) {
		targetTask = tasks.find(
			(t) => t.id === trimmedArg || t.agent.toLowerCase() === trimmedArg.toLowerCase(),
		);
	}

	// Si no se especificó un target, o si hay varias, abrir selector interactivo o tomar la más reciente
	if (!targetTask) {
		if (tasks.length === 1) {
			targetTask = tasks[0];
		} else if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
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
			targetTask = tasks[idx] || tasks[0];
		} else {
			targetTask = tasks[0];
		}
	}

	if (!targetTask) return;

	// Renderizar pantalla completa detallada de logs
	const lines: string[] = [];
	const width = 80;
	const innerWidth = width - 4;

	const pad = (str: string, len: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		return visibleLen < len ? str + " ".repeat(len - visibleLen) : str;
	};

	const truncate = (str: string, maxLen: number) => {
		const visibleLen = str.replace(/\x1b\[[0-9;]*m/g, "").length;
		if (visibleLen <= maxLen) return str;
		return str.slice(0, maxLen - 1) + "…";
	};

	const now = Date.now();
	const elapsedMs = targetTask.startedAt
		? (targetTask.endedAt ? targetTask.endedAt - targetTask.startedAt : now - targetTask.startedAt)
		: 0;
	const elapsedStr = formatElapsed(elapsedMs);

	let statusBadge = `${YELLOW}◐ EN EJECUCIÓN${RESET}`;
	if (targetTask.status === "completed") statusBadge = `${GREEN}✓ COMPLETADO${RESET}`;
	if (targetTask.status === "failed") statusBadge = `${RED}✗ FALLIDO${RESET}`;
	if (targetTask.status === "cancelled") statusBadge = `${GRAY}○ CANCELADO${RESET}`;

	const headerTitle = `✿ INSPECTOR DE ESPECIALISTA · ${targetTask.title.toUpperCase()}`;
	const ruleLen = Math.max(0, width - headerTitle.length - 5);

	lines.push(`${BORDER}╭─${RESET} ${BLUE}${headerTitle}${RESET} ${BORDER}${"─".repeat(ruleLen)}╮${RESET}`);
	lines.push(`${BORDER}│${RESET} ${pad(`${LAVENDER}${BOLD}Detalles de Ejecución${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${pad(`  ${GRAY}Agente:${RESET}  ${WHITE}${targetTask.agent}${RESET} (${targetTask.title})`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${pad(`  ${GRAY}Modelo:${RESET}  ${BLUE}${targetTask.model || "inherit"}${RESET}  ${GRAY}·  Estado:${RESET} ${statusBadge}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${pad(`  ${GRAY}Tiempo:${RESET}  ${WHITE}${elapsedStr}${RESET}  ${GRAY}·  Task ID:${RESET} ${DIM}${targetTask.id}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	lines.push(`${BORDER}│${RESET} ${pad("", innerWidth)} ${BORDER}│${RESET}`);

	lines.push(`${BORDER}│${RESET} ${pad(`${LAVENDER}${BOLD}Instrucción Asignada${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const taskLines = targetTask.task.split("\n").slice(0, 4);
	for (const tl of taskLines) {
		lines.push(`${BORDER}│${RESET} ${pad(`  ${WHITE}${truncate(tl.trim(), innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}
	lines.push(`${BORDER}│${RESET} ${pad("", innerWidth)} ${BORDER}│${RESET}`);

	lines.push(`${BORDER}│${RESET} ${pad(`${LAVENDER}${BOLD}Eventos y Llamadas de Herramientas (En Vivo)${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	const eventLogs = targetTask.logs && targetTask.logs.length > 0
		? targetTask.logs.slice(-14)
		: [`  ${DIM}(esperando primeros eventos de ejecución...)${RESET}`];

	for (const log of eventLogs) {
		lines.push(`${BORDER}│${RESET} ${pad(`  ${WHITE}${truncate(log, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	if (targetTask.result) {
		lines.push(`${BORDER}│${RESET} ${pad("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`${BORDER}│${RESET} ${pad(`${LAVENDER}${BOLD}Resultado / Entrega Final${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		const resultPreview = targetTask.result.split("\n").slice(0, 8);
		for (const rl of resultPreview) {
			lines.push(`${BORDER}│${RESET} ${pad(`  ${GREEN}${truncate(rl, innerWidth - 4)}${RESET}`, innerWidth)} ${BORDER}│${RESET}`);
		}
	} else if (targetTask.error) {
		lines.push(`${BORDER}│${RESET} ${pad("", innerWidth)} ${BORDER}│${RESET}`);
		lines.push(`${BORDER}│${RESET} ${pad(`${RED}${BOLD}Error Registrado:${RESET} ${targetTask.error}`, innerWidth)} ${BORDER}│${RESET}`);
	}

	lines.push(`${BORDER}╰${"─".repeat(width - 2)}╯${RESET}`);

	const screenText = lines.join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		(ctx.ui as any).notify(screenText, "info");
	} else {
		console.log("\n" + screenText + "\n");
	}
}
