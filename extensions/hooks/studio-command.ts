import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface StudioCategory {
	name: string;
	emoji: string;
	description: string;
	commands: Array<{ cmd: string; desc: string }>;
}

export const STUDIO_CATEGORIES: StudioCategory[] = [
	{
		name: "Pre-producción & Visión",
		emoji: "🎯",
		description: "Onboarding, ideación, pitch y validación inicial",
		commands: [
			{ cmd: "/studio:start", desc: "Asistente interactivo de inicio y onboarding (alias /start)" },
			{ cmd: "/brainstorm", desc: "Ideación estructurada de conceptos de juego" },
			{ cmd: "/concept-pitch", desc: "Pitch deck y elevator pitch de venta" },
			{ cmd: "/vertical-slice", desc: "Validación de loop completo pre-producción" },
			{ cmd: "/gate-check", desc: "Evaluación formal de directores para cambio de fase" },
		],
	},
	{
		name: "Diseño & Sistemas",
		emoji: "📋",
		description: "Mecánicas, loops, economía y niveles",
		commands: [
			{ cmd: "/game-design-document", desc: "GDD por sistema con player fantasy y fórmulas" },
			{ cmd: "/core-loop", desc: "Definición y balance del loop principal" },
			{ cmd: "/level-design-document", desc: "Especificación de niveles, ritmo y gating" },
			{ cmd: "/economy-model", desc: "Modelado matemático de monedas y sumideros" },
			{ cmd: "/combat-matrix", desc: "Diseño de combate, afinidades y matchups" },
		],
	},
	{
		name: "Ingeniería & Motores",
		emoji: "💻",
		description: "Arquitectura, prototipos y motores de juego",
		commands: [
			{ cmd: "/setup-engine", desc: "Configuración de Godot, Unity, Unreal o Bevy" },
			{ cmd: "/engine-capabilities", desc: "Auditoría de features soportadas por el motor" },
			{ cmd: "/architecture-decision", desc: "Crear ADR para decisiones técnicas clave" },
			{ cmd: "/architecture-review", desc: "Revisar arquitectura frente a requerimientos GDD" },
			{ cmd: "/prototype", desc: "Prototipado rápido y spikes de investigación (4h)" },
		],
	},
	{
		name: "Arte & Audio",
		emoji: "🎨",
		description: "Identidad visual, sonido, foley y pulido",
		commands: [
			{ cmd: "/art-bible", desc: "Biblia de arte: estética, guías y especificaciones" },
			{ cmd: "/color-palette", desc: "Paleta cromática y roles de color por gameplay" },
			{ cmd: "/audio-palette", desc: "Diseño y roles de audio ambiental y música" },
			{ cmd: "/sound-palette", desc: "Efectos de sonido (SFX) y feedback de impacto" },
			{ cmd: "/team-audio", desc: "Orquestación del equipo de audio" },
			{ cmd: "/team-polish", desc: "Pase de jugo ('game feel'), pantallas shake y efectos" },
		],
	},
	{
		name: "QA & Testing",
		emoji: "🧪",
		description: "Planes de prueba, smoke checks y triaje",
		commands: [
			{ cmd: "/qa-plan", desc: "Estrategia y suites de prueba por hito" },
			{ cmd: "/smoke-check", desc: "Chequeo rápido de build y controles básicos" },
			{ cmd: "/regression-suite", desc: "Suite de pruebas contra regresiones" },
			{ cmd: "/bug-report", desc: "Reporte estructurado con severidad y pasos" },
			{ cmd: "/playtest-report", desc: "Análisis y métricas de sesiones de prueba" },
		],
	},
	{
		name: "Producción & Releases",
		emoji: "🚀",
		description: "Hitos, retrospectivas y lanzamiento",
		commands: [
			{ cmd: "/milestone-review", desc: "Cierre de hito con directores y evaluación de riesgo" },
			{ cmd: "/retrospective", desc: "Retrospectiva del equipo de desarrollo" },
			{ cmd: "/release-checklist", desc: "Auditoría técnica antes de generar build" },
			{ cmd: "/launch-checklist", desc: "Checklist de lanzamiento en tiendas (Steam, itch, stores)" },
			{ cmd: "/patch-notes", desc: "Redacción de notas de actualización públicas" },
		],
	},
	{
		name: "Configuración & Admin",
		emoji: "⚙️",
		description: "Ajustes de estudio, modelos y memoria",
		commands: [
			{ cmd: "/studio:setup", desc: "Instalación guiada de agentes y configuración inicial" },
			{ cmd: "/studio:models", desc: "Personalizar modelos LLM por nivel o agente" },
			{ cmd: "/studio:chains", desc: "Pipelines multi-agente guiados (GDD, features, release)" },
			{ cmd: "/studio:status", desc: "Dashboard en vivo de estado y métricas del estudio" },
			{ cmd: "/studio:agents", desc: "Catálogo interactivo de los 55 agentes del estudio" },
			{ cmd: "/studio:settings", desc: "Gestor interactivo de project.yaml y motor" },
			{ cmd: "/connect-engram", desc: "Vincular memoria persistente entre sesiones" },
		],
	},
];

export async function handleStudioCommand(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";

	// Match direct query
	if (query && query !== "all" && query !== "list") {
		const matchedCat = STUDIO_CATEGORIES.find(
			(c) =>
				c.name.toLowerCase().includes(query) ||
				c.commands.some((cmd) => cmd.cmd.toLowerCase().includes(query)),
		);

		if (matchedCat) {
			renderCategory(matchedCat);
			return;
		}
	}

	// Interactive select when UI is available
	if (
		ctx.hasUI &&
		typeof (ctx.ui as any)?.select === "function" &&
		query !== "all"
	) {
		const options = [
			...STUDIO_CATEGORIES.map(
				(c) => `${c.emoji} ${c.name} — ${c.description}`,
			),
			"📖 Ver todos los comandos",
		];

		const selected = await (ctx.ui as any).select(
			"🎮 Pi Game Studio — Catálogo de Comandos",
			options,
		);

		if (selected === undefined || selected === null) return;

		const selectedIndex = typeof selected === "number" ? selected : options.indexOf(selected);
		if (selectedIndex === -1) return;

		if (selectedIndex < STUDIO_CATEGORIES.length) {
			renderCategory(STUDIO_CATEGORIES[selectedIndex]);
		} else {
			renderAll();
		}
		return;
	}

	// Fallback print
	renderAll();
}

function renderCategory(cat: StudioCategory): void {
	console.log("");
	console.log(`\x1b[1m\x1b[38;2;167;139;250m${cat.emoji} ${cat.name}\x1b[0m — \x1b[38;2;107;114;128m${cat.description}\x1b[0m`);
	console.log("\x1b[38;2;107;114;128m" + "─".repeat(70) + "\x1b[0m");
	for (const item of cat.commands) {
		const cmdPadded = item.cmd.padEnd(26);
		console.log(`  \x1b[38;2;56;189;248m\x1b[1m${cmdPadded}\x1b[0m \x1b[38;2;243;244;246m${item.desc}\x1b[0m`);
	}
	console.log("");
}

function renderAll(): void {
	console.log("");
	console.log("\x1b[1m\x1b[38;2;167;139;250m🎮 PI GAME STUDIO — CATÁLOGO DE COMANDOS\x1b[0m");
	console.log("\x1b[38;2;107;114;128mTodos los comandos del estudio llevan el prefijo 🎮 [Studio] en el menú /\x1b[0m");
	console.log("");

	for (const cat of STUDIO_CATEGORIES) {
		renderCategory(cat);
	}
}
