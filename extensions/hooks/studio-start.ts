import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { inspectSetup, installStudioFiles, runGuidedSetup } from "./studio-setup.ts";

export interface ProducerState {
	gameTitle?: string;
	engine?: string;
	milestone?: string;
	sprint?: string;
	inProgress?: string;
	nextStep?: string;
}

export interface FlowCompletionReceipt {
	task: string;
	agent?: string;
	filesChanged?: string[];
	nextStep?: string;
}

export function recordFlowCompletion(cwd: string, receipt: FlowCompletionReceipt): void {
	const { hasRoadmap, roadmapPath: existingRoadmap, state } = readProducerState(cwd);
	const prodDir = join(cwd, "production");
	const roadmapPath = existingRoadmap || join(prodDir, "roadmap.md");
	mkdirSync(join(roadmapPath, ".."), { recursive: true });

	const gameTitle = state?.gameTitle || "Mi Videojuego";
	const engine = state?.engine || "Bevy";
	const milestone = state?.milestone || "M1 — Prototipo Jugable";
	const sprint = state?.sprint || "Sprint 1";
	const next = receipt.nextStep || state?.nextStep || "Siguiente tarea de desarrollo";

	const newBlock = [
		"<!-- PRODUCER_STATE -->",
		`Juego: ${gameTitle}`,
		`Motor: ${engine}`,
		`Hito Actual: ${milestone}`,
		`Sprint Activo: ${sprint}`,
		`Última Tarea Completada: ${receipt.task}`,
		`En Progreso: ${next}`,
		`Siguiente Paso: ${next}`,
		`Actualizado: ${new Date().toISOString()}`,
		"<!-- /PRODUCER_STATE -->",
	].join("\n");

	if (hasRoadmap && existsSync(roadmapPath)) {
		try {
			let content = readFileSync(roadmapPath, "utf8");
			if (/<!--\s*PRODUCER_STATE\s*[\s\S]*?<!--\s*\/PRODUCER_STATE\s*-->/i.test(content)) {
				content = content.replace(
					/<!--\s*PRODUCER_STATE\s*[\s\S]*?<!--\s*\/PRODUCER_STATE\s*-->/i,
					newBlock,
				);
			} else {
				content = newBlock + "\n\n" + content;
			}
			writeFileSync(roadmapPath, content, "utf8");
		} catch {}
	} else {
		const initialRoadmap = [
			`# 🗺️ Roadmap de Producción — ${gameTitle}`,
			"",
			newBlock,
			"",
			"## 🎯 Hitos del Proyecto",
			"",
			`### 🟡 ${milestone}`,
			`- [x] ${receipt.task}`,
			`- [/] ${next}`,
			"",
		].join("\n");
		writeFileSync(roadmapPath, initialRoadmap, "utf8");
	}
}

export interface ProjectAudit {
	hasEngine: boolean;
	engineName: string;
	hasConcept: boolean;
	gddCount: number;
	srcFileCount: number;
	hasPrototypes: boolean;
	agentsInstalled: number;
	isConfigured: boolean;
	hasRoadmap: boolean;
	producerState?: ProducerState;
}

export function readProducerState(cwd: string): { hasRoadmap: boolean; roadmapPath?: string; state?: ProducerState } {
	const possibleRoadmaps = [
		join(cwd, "production", "roadmap.md"),
		join(cwd, "roadmap.md"),
		join(cwd, "docs", "roadmap.md"),
	];

	const roadmapPath = possibleRoadmaps.find((p) => existsSync(p));
	if (!roadmapPath) {
		return { hasRoadmap: false };
	}
	try {
		const content = readFileSync(roadmapPath, "utf8");
		const match = content.match(/<!--\s*PRODUCER_STATE\s*([\s\S]*?)<!--\s*\/PRODUCER_STATE\s*-->/i);
		if (!match || !match[1]) return { hasRoadmap: true, roadmapPath };

		const block = match[1];
		const state: ProducerState = {};

		const game = block.match(/Juego:\s*([^\n]+)/i);
		if (game) state.gameTitle = game[1].trim();

		const engine = block.match(/Motor:\s*([^\n]+)/i);
		if (engine) state.engine = engine[1].trim();

		const milestone = block.match(/Hito Actual:\s*([^\n]+)/i);
		if (milestone) state.milestone = milestone[1].trim();

		const sprint = block.match(/Sprint Activo:\s*([^\n]+)/i);
		if (sprint) state.sprint = sprint[1].trim();

		const inProgress = block.match(/En Progreso:\s*([^\n]+)/i);
		if (inProgress) state.inProgress = inProgress[1].trim();

		const nextStep = block.match(/Siguiente Paso:\s*([^\n]+)/i);
		if (nextStep) state.nextStep = nextStep[1].trim();

		return { hasRoadmap: true, roadmapPath, state };
	} catch {
		return { hasRoadmap: true, roadmapPath };
	}
}

export function auditProject(cwd: string): ProjectAudit {
	const setup = inspectSetup(cwd);

	const possibleConcepts = [
		join(cwd, "design", "gdd", "game-concept.md"),
		join(cwd, "design", "concept.md"),
		join(cwd, "design", "gdd", "concept.md"),
		join(cwd, "docs", "concept.md"),
		// Legacy fallback if migrating from an older repo
		join(cwd, "production", "design", "concept.md"),
	];
	const hasConcept = possibleConcepts.some((p) => existsSync(p));

	const { hasRoadmap, state: producerState } = readProducerState(cwd);

	let gddCount = 0;
	const possibleGddDirs = [
		join(cwd, "design", "gdd"),
		join(cwd, "design"),
		join(cwd, "docs", "design"),
	];
	for (const gddDir of possibleGddDirs) {
		if (existsSync(gddDir)) {
			try {
				gddCount += readdirSync(gddDir).filter((f) => f.endsWith(".md")).length;
			} catch {}
		}
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
		agentsInstalled: setup.agentsInstalled,
		isConfigured: setup.isConfigured,
		hasRoadmap,
		producerState,
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

		if (!audit.isConfigured) {
			const setupChoice = await (ctx.ui as any).select(
				"🎮 Producer: ¡Bienvenido al estudio! Tu entorno aún no está configurado. ¿Cómo prefieres inicializarlo?",
				[
					`⚡ 1. Instalación Automática (Recomendada: Agentes optimizados para ${audit.engineName || "Godot 4"} en modo 'inherit')`,
					"🛠️ 2. Instalación Manual / Guiada (Tú eliges el motor de juego, tu idioma preferido y personalizas los modelos de IA por rol)",
				],
			);

			if (setupChoice === undefined || setupChoice === null) return;

			const choiceIdx = typeof setupChoice === "number" ? setupChoice : [0, 1].indexOf(setupChoice);
			if (choiceIdx === 0) {
				installStudioFiles(ctx, { engine: audit.engineName || "Godot" });
				const updated = inspectSetup(ctx.cwd);
				audit.agentsInstalled = updated.agentsInstalled;
				audit.isConfigured = updated.isConfigured;
			} else if (choiceIdx === 1) {
				const currentStatus = inspectSetup(ctx.cwd);
				await runGuidedSetup(ctx, currentStatus);
				return;
			} else {
				return;
			}
		}

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

		let promptHeadline = `🎮 Producer: ${phaseLabel} — ¿Cuál es el siguiente paso?`;
		if (audit.producerState?.gameTitle) {
			const st = audit.producerState;
			promptHeadline = `🎮 Producer: [${st.gameTitle} · ${st.milestone || phaseLabel}] — Siguiente paso activo: ${st.nextStep || "Continuar desarrollo"}`;
		}

		const selected = await (ctx.ui as any).select(
			promptHeadline,
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
	const envStatus = a.isConfigured
		? "✔ Entorno OK (55 agentes)"
		: "⚠ Incompleto (/studio:setup)";
	const roadmapStatus = a.hasRoadmap
		? (a.producerState?.milestone ? `✔ ${a.producerState.milestone}` : "✔ Roadmap activo")
		: "Pendiente (production/roadmap.md)";

	const lines = [
		"┌── 🎮 PI GAME STUDIO — ESTADO Y DIAGNÓSTICO DEL PROYECTO ───┐",
		`│ • Estado Ambiente:      ${envStatus.padEnd(36)} │`,
		`│ • Línea / Hito Actual:  ${roadmapStatus.padEnd(36)} │`,
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
