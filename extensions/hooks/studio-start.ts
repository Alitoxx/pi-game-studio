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

	// Interactive mode
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const stateSummary = [
			`Motor: ${audit.hasEngine ? audit.engineName : "No configurado"}`,
			`GDDs: ${audit.gddCount} docs`,
			`Código: ${audit.srcFileCount} archivos`,
		].join(" | ");

		const options = [
			"💡 1. Comenzar desde cero / Lluvia de ideas (Exploración guiada con /brainstorm)",
			"📋 2. Formalizar concepto en GDD (Crear documento de diseño de juego)",
			"⚙️ 3. Configurar motor de juego y arquitectura (/studio:settings)",
			"🔍 4. Escanear y auditar proyecto existente (/project-stage-detect)",
			"🤖 5. Entrevista conversacional con el Game Designer (Lanzar /start)",
			"📊 6. Ver diagnóstico actual del proyecto",
		];

		const selected = await (ctx.ui as any).select(
			`🎮 Pi Game Studio — Asistente de Inicio (${stateSummary})`,
			options,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : options.indexOf(selected);
		if (idx === -1) return;

		switch (idx) {
			case 0:
				notifyOrLog(
					ctx,
					"💡 Escribe /brainstorm open en el chat de Pi para explorar temas, mecánicas y fantasía de jugador.",
				);
				break;
			case 1:
				notifyOrLog(
					ctx,
					"📋 Escribe /game-design-document para redactar el primer GDD con pilares y core loop.",
				);
				break;
			case 2:
				notifyOrLog(
					ctx,
					"⚙️ Escribe /studio:settings para seleccionar tu motor (Godot, Unity, Unreal, Bevy) e idioma.",
				);
				break;
			case 3:
				notifyOrLog(
					ctx,
					"🔍 Escribe /project-stage-detect o /adopt para auditar tu código y documentos existentes.",
				);
				break;
			case 4:
				notifyOrLog(
					ctx,
					"🤖 Escribe /start en el chat de Pi para iniciar la entrevista conversacional completa con el Game Designer.",
				);
				break;
			case 5:
				displayProjectAudit(ctx, audit);
				break;
		}
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
