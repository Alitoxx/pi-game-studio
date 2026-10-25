import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";
import { ACCENT, ACCENT as BLUE, BORDER, CYAN, DIM, GRAY, GREEN, RESET, SECONDARY, WHITE, YELLOW, padAnsi } from "./studio-palette.ts";

export interface PendingTaskInfo {
	id: string;
	title: string;
	sourceFile: string;
	specTitle?: string;
	brief?: string;
}

/**
 * Searches for the next pending atomic task in the active Live Spec (design/gdd/*.md)
 * or in production/roadmap.md.
 */
export function findNextPendingTask(studioRoot: string): PendingTaskInfo | null {
	// 1. Prioritize active Live Spec in design/gdd/*.md
	const gddDir = join(studioRoot, "design", "gdd");
	if (existsSync(gddDir)) {
		try {
			const files = readdirSync(gddDir).filter((f) => f.endsWith(".md"));
			for (const file of files) {
				const fullPath = join(gddDir, file);
				const content = readFileSync(fullPath, "utf8");
				const lines = content.split("\n");

				for (let idx = 0; idx < lines.length; idx++) {
					const line = lines[idx];
					if (line.startsWith("  ") || line.startsWith("\t")) continue;
					const match = line.trim().match(/^-\s*\[([ ])\]\s*(.+)$/i);
					if (match) {
						const title = match[2].trim();
						return {
							id: `${file.replace(".md", "")}-${idx + 1}`,
							title,
							sourceFile: `design/gdd/${file}`,
							specTitle: file.replace(".md", ""),
						};
					}
				}
			}
		} catch {}
	}

	// 2. Fallback to production/roadmap.md
	const { hasRoadmap, roadmapPath } = readProducerState(studioRoot);
	if (hasRoadmap && roadmapPath && existsSync(roadmapPath)) {
		try {
			const content = readFileSync(roadmapPath, "utf8");
			const lines = content.split("\n");

			for (let idx = 0; idx < lines.length; idx++) {
				const line = lines[idx];
				if (line.startsWith("  ") || line.startsWith("\t")) continue;
				const match = line.trim().match(/^-\s*\[([ ])\]\s*(.+)$/i);
				if (match) {
					const title = match[2].trim();
					return {
						id: `roadmap-${idx + 1}`,
						title,
						sourceFile: "production/roadmap.md",
					};
				}
			}
		} catch {}
	}

	return null;
}

/**
 * Renders the fast-forward sprint continuity banner and prompt.
 */
export function formatContinuityPrompt(nextTask: PendingTaskInfo): string[] {
	const lines: string[] = [];
	lines.push(`┌── SPRINT CONTINUITY GATE: FAST-FORWARD PIPELINE ────────────────┐`);
	lines.push(`│ Tarea anterior completada con éxito. Siguiente en cola ODD:    │`);
	lines.push(`│ • Origen: ${nextTask.sourceFile.padEnd(52, " ")} │`);
	lines.push(`│ • Tarea:  ${nextTask.title.slice(0, 52).padEnd(52, " ")} │`);
	lines.push(`└─────────────────────────────────────────────────────────────────┘`);
	return lines;
}

/**
 * Command: /studio:next or /studio:continuity
 * Evaluates the next atomic step and offers fast-forward handoff.
 */
export async function handleStudioContinuity(
	_args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const next = findNextPendingTask(studioRoot);

	if (!next) {
		console.log("\n" + GREEN + "✓ No hay tareas atómicas pendientes en el Live Spec ni en el roadmap.\x1b[0m");
		console.log("El sprint actual está 100% completado. Usa " + SECONDARY + "/studio:start\x1b[0m o " + SECONDARY + "/studio:feature\x1b[0m para planificar la siguiente etapa.\n");
		return;
	}

	console.log("");
	console.log("\x1b[1m" + ACCENT + "SITUACIÓN ACTUAL:\x1b[0m");
	console.log(`La tarea anterior se verificó con éxito. La siguiente tarea atómica en cola es:\n${WHITE}${next.title}\x1b[0m (en ${GRAY}${next.sourceFile}\x1b[0m).`);
	console.log("");
	console.log("\x1b[1m" + ACCENT + "ANÁLISIS DEL DILEMA:\x1b[0m");
	console.log("- Avanzar de inmediato: Mantener la inercia de desarrollo y delegar al especialista sin perder foco.");
	console.log("- Inspeccionar cambios: Auditar el diff y pruebas antes de abrir la siguiente unidad.");
	console.log("- Pausar sprint: Salvar progreso actual y retomar más tarde.");
	console.log("");
	console.log("\x1b[1m" + ACCENT + "RECOMENDACIÓN DEL LEAD:\x1b[0m");
	console.log("Si la compilación y los tests de la tarea previa están limpios, avanzar directo a la siguiente tarea atómica para cerrar el feature.");
	console.log("");

	const questionData = {
		questions: [
			{
				header: "Continuidad",
				question: `¿Cómo deseas proceder con la siguiente tarea: ${next.title}?`,
				options: [
					{
						label: "Ejecutar tarea siguiente de inmediato",
						description: `Delegar al especialista correspondiente la implementación de ${next.title}`,
					},
					{
						label: "Inspeccionar cambios previos (/changes)",
						description: "Revisar git diff y recibos de validación antes de continuar",
					},
					{
						label: "Pausar sprint actual",
						description: "Dejar el estado guardado y concluir la sesión de trabajo",
					},
				],
			},
		],
	};

	try {
		const { executeAskUserQuestion } = await import("./studio-choice.ts");
		const answer = await executeAskUserQuestion(questionData, ctx);
		const chosen = typeof answer === "string" ? answer : (answer as any)?.answers?.[0]?.answer || "";

		if (chosen.includes("Ejecutar tarea") || chosen === "1") {
			console.log(`\n${GREEN}▶ Iniciando ejecución de:\x1b[0m ${next.title}\n`);
			if (typeof (ctx as any).sendMessage === "function") {
				(ctx as any).sendMessage(`Por favor continúa e implementa la tarea: ${next.title} (según ${next.sourceFile})`);
			}
		} else if (chosen.includes("Inspeccionar") || chosen === "2") {
			const { handleStudioChanges } = await import("./studio-changes.ts");
			await handleStudioChanges("", ctx);
		} else {
			console.log("\n" + GRAY + "Sprint pausado. El progreso está registrado en roadmap.md y Live Spec.\x1b[0m\n");
		}
	} catch {
		console.log(`\n${SECONDARY}Próximo paso sugerido:\x1b[0m Implementar ${next.title}\n`);
	}
}
