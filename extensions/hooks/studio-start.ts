import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { inspectSetup } from "./studio-setup.ts";

export interface ProjectAudit {
	hasEngine: boolean;
	engineName: string;
	hasConcept: boolean;
	gddCount: number;
	srcFileCount: number;
	hasPrototypes: boolean;
}

export function auditProject(cwd: string): ProjectAudit {
	const setup = inspectSetup(cwd);
	const hasConcept = existsSync(join(cwd, "design", "gdd", "game-concept.md"));

	let gddCount = 0;
	const gddDir = join(cwd, "design", "gdd");
	if (existsSync(gddDir)) {
		try {
			gddCount = readdirSync(gddDir).filter((f) => f.endsWith(".md")).length;
		} catch {}
	}

	let srcFileCount = 0;
	const srcDir = join(cwd, "src");
	if (existsSync(srcDir)) {
		try {
			srcFileCount = countFilesRecursive(srcDir);
		} catch {}
	}

	const protoDir = join(cwd, "prototypes");
	const hasPrototypes = existsSync(protoDir);

	return {
		hasEngine: setup.hasProjectYaml,
		engineName: setup.currentEngine,
		hasConcept,
		gddCount,
		srcFileCount,
		hasPrototypes,
	};
}

function countFilesRecursive(dir: string): number {
	let count = 0;
	try {
		const entries = readdirSync(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.isDirectory()) {
				count += countFilesRecursive(join(dir, entry.name));
			} else if (entry.isFile()) {
				count++;
			}
		}
	} catch {}
	return count;
}

export async function handleStudioStart(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";
	const audit = auditProject(ctx.cwd);

	// Quick action flags
	if (query === "new" || query === "brainstorm") {
		notifyOrLog(ctx, "💡 Siguiente paso: escribe /brainstorm open para comenzar la ideación de tu juego.");
		return;
	}

	if (query === "gdd") {
		notifyOrLog(ctx, "📋 Siguiente paso: escribe /game-design-document para crear tu primer documento de diseño.");
		return;
	}

	if (query === "engine") {
		notifyOrLog(ctx, "⚙️ Siguiente paso: escribe /studio:settings o /setup-engine para configurar tu motor.");
		return;
	}

	// Interactive mode: Producer-led guidance (maximum 3 clear choices)
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		let phaseLabel = "Fase 1: Concepción / Idea";
		let options: string[] = [];
		let actions: Array<() => void> = [];

		if (!audit.hasConcept && audit.srcFileCount === 0) {
			// Early stage: No concept, no code
			phaseLabel = "Fase 1: Concepción & Prototipo";
			options = [
				"💡 1. Definir la idea y fantasía de mi juego (/brainstorm)",
				"⚡ 2. Crear un prototipo rápido con código listo para jugar (/studio:new)",
				"💬 3. Hablar directamente con el equipo (Escribe libremente en el chat)",
			];
			actions = [
				() => notifyOrLog(ctx, "💡 Escribe /brainstorm open para explorar temas, género y mecánicas."),
				() => notifyOrLog(ctx, "⚡ Escribe /studio:new para crear una plantilla jugable (Bevy, Raylib o Godot)."),
				() => notifyOrLog(ctx, "💬 Escribe en el chat lo que tienes en mente y el equipo te responderá."),
			];
		} else if (audit.hasConcept && audit.srcFileCount === 0) {
			// Mid stage: Has concept, needs GDD & first systems
			phaseLabel = "Fase 2: Diseño de Sistemas & Motor";
			options = [
				"📋 1. Redactar el documento de diseño y mecánicas (/game-design-document)",
				"⚙️ 2. Auditar herramientas y requisitos del motor (/studio:doctor)",
				"🎨 3. Definir la identidad visual y arte (/art-bible)",
			];
			actions = [
				() => notifyOrLog(ctx, "📋 Escribe /game-design-document para estructurar core loop y mecánicas."),
				() => notifyOrLog(ctx, "⚙️ Escribe /studio:doctor para verificar tus compiladores y motor."),
				() => notifyOrLog(ctx, "🎨 Escribe /art-bible para definir paleta de colores y estética."),
			];
		} else {
			// Production stage: Has code and systems
			phaseLabel = "Fase 3: Desarrollo & Validación";
			options = [
				"💻 1. Implementar una nueva mecánica de juego (/dev-story)",
				"🧪 2. Probar y revisar la calidad del código (/code-review)",
				"📊 3. Ver diagnóstico y métricas de avance del estudio (/studio:status)",
			];
			actions = [
				() => notifyOrLog(ctx, "💻 Escribe /dev-story para implementar la siguiente mecánica."),
				() => notifyOrLog(ctx, "🧪 Escribe /code-review para auditar tu código actual."),
				() => displayProjectAudit(ctx, audit),
			];
		}

		const selected = await (ctx.ui as any).select(
			`🎮 Producer: ${phaseLabel} — ¿Cuál es el siguiente paso?`,
			options,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : options.indexOf(selected);
		if (idx === -1 || !actions[idx]) return;

		actions[idx]();
		return;
	}

	// CLI fallback
	displayProjectAudit(ctx, audit);
}

function displayProjectAudit(ctx: ExtensionContext, a: ProjectAudit): void {
	const lines = [
		"┌── 🎮 PI GAME STUDIO — ESTADO Y DIAGNÓSTICO DEL PROYECTO ───┐",
		`│ • Motor de juego:       ${(a.hasEngine ? `✔ ${a.engineName}` : "⚠ No configurado (/studio:settings)").padEnd(36)} │`,
		`│ • Concepto de juego:    ${(a.hasConcept ? "✔ game-concept.md" : "Pendiente (/brainstorm)").padEnd(36)} │`,
		`│ • Documentos de diseño: ${(a.gddCount + " archivos en design/gdd/").padEnd(36)} │`,
		`│ • Archivos de código:   ${(a.srcFileCount + " archivos en src/").padEnd(36)} │`,
		`│ • Prototipos:           ${(a.hasPrototypes ? "✔ prototypes/ detectada" : "Sin prototipos aún").padEnd(36)} │`,
		"├─────────────────────────────────────────────────────────────┤",
		"│ Siguientes acciones recomendadas (Radar de Inicio):         │",
		"│ [1] Si empiezas de cero       ➔ /brainstorm open            │",
		"│ [2] Si tienes concepto claro  ➔ /game-design-document       │",
		"│ [3] Si ya tienes código       ➔ /project-stage-detect       │",
		"│ [4] Entrevista interactiva    ➔ /start                      │",
		"└─────────────────────────────────────────────────────────────┘",
	];

	notifyOrLog(ctx, lines.join("\n"));
}

function notifyOrLog(ctx: ExtensionContext, message: string): void {
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(message, "info");
	} else {
		console.log(message);
	}
}
