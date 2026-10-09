import type { ExtensionContext } from "@earendil-works/pi-coding-agent";

export interface StudioCategory {
	name: string;
	emoji: string;
	description: string;
	commands: Array<{ cmd: string; desc: string }>;
}

export const STUDIO_CATEGORIES: StudioCategory[] = [
	{
		name: "ODD GAMEDEV PIPELINE (6 SKILLS)",
		emoji: "•",
		description: "Ciclo de vida oficial Organic Driven Development",
		commands: [
			{ cmd: "/concept", desc: "[Fase 1] Visión, 3-5 pilares, anti-pilares y ancla visual" },
			{ cmd: "/spec", desc: "[Fase 2] Live Specs vivas en design/gdd/<feature>.md" },
			{ cmd: "/arch", desc: "[Fase 3] ADRs, presupuesto de memoria/FPS y manifiesto técnico" },
			{ cmd: "/code", desc: "[Fase 4] Implementación pura en motor (~400 líneas / test)" },
			{ cmd: "/test", desc: "[Fase 5] Smoke checks, regresiones, memory leaks y triaje" },
			{ cmd: "/ship", desc: "[Fase 6] Empaquetado de builds, parches y changelogs" },
		],
	},
	{
		name: "HERRAMIENTAS & TUI DEL ESTUDIO",
		emoji: "•",
		description: "Asistentes interactivos, diagnóstico y gestión",
		commands: [
			{ cmd: "/studio:start", desc: "Asistente interactivo de inicio y diagnóstico en vivo" },
			{ cmd: "/studio:setup", desc: "Instalación guiada de los 9 agentes oficiales (8+1)" },
			{ cmd: "/studio:doctor", desc: "Diagnóstico local de toolchains y compiladores del motor" },
			{ cmd: "/studio:web", desc: "Compilar a WebAssembly y lanzar servidor con aislamiento COOP/COEP" },
			{ cmd: "/studio:tasks", desc: "Gestión interactiva de tareas y radar de obsolescencia" },
			{ cmd: "/studio:changes", desc: "Inspector de cambios pendientes y drift de diseño vs código" },
			{ cmd: "/studio:agents", desc: "Navegador interactivo de los agentes activos (8 Core + 1 Motor)" },
			{ cmd: "/studio:models", desc: "Personalización de modelos LLM por nivel o agente" },
			{ cmd: "/studio:settings", desc: "Gestión interactiva de motor de juego e idioma (es/en)" },
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
				(c) => `${c.name} — ${c.description}`,
			),
			"Ver todos los comandos",
		];

		const selected = await (ctx.ui as any).select(
			"PI GAME STUDIO — Catálogo de Comandos",
			options,
		);

		if (selected === undefined || selected === null) return;

		const selectedIndex = typeof selected === "number" ? selected : options.indexOf(selected);
		if (selectedIndex === -1) return;

		if (selectedIndex < STUDIO_CATEGORIES.length) {
			renderCategory(STUDIO_CATEGORIES[selectedIndex], ctx);
		} else {
			renderAll(ctx);
		}
		return;
	}

	// Fallback print
	renderAll(ctx);
}

function renderCategory(cat: StudioCategory, ctx?: ExtensionContext): void {
	const lines = [
		`${cat.name} — ${cat.description}`,
		"─".repeat(50),
		...cat.commands.map((item) => `• ${item.cmd.padEnd(24)} ${item.desc}`),
	];
	const msg = lines.join("\n");

	if (ctx?.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(msg, "info");
	} else {
		console.log("");
		console.log(`\x1b[1m\x1b[38;2;167;139;250m${cat.name}\x1b[0m — \x1b[38;2;107;114;128m${cat.description}\x1b[0m`);
		console.log("\x1b[38;2;107;114;128m" + "─".repeat(70) + "\x1b[0m");
		for (const item of cat.commands) {
			const cmdPadded = item.cmd.padEnd(26);
			console.log(`  \x1b[38;2;56;189;248m\x1b[1m${cmdPadded}\x1b[0m \x1b[38;2;243;244;246m${item.desc}\x1b[0m`);
		}
		console.log("");
	}
}

function renderAll(ctx?: ExtensionContext): void {
	if (ctx?.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const lines = [
			"PI GAME STUDIO — CATÁLOGO DE COMANDOS",
			"Todos los comandos llevan el prefijo [Studio] en el menú /",
			"",
			...STUDIO_CATEGORIES.map((c) => `${c.name} (${c.commands.length} comandos)`),
		];
		ctx.ui.notify(lines.join("\n"), "info");
	} else {
		console.log("");
		console.log("\x1b[1m\x1b[38;2;167;139;250mPI GAME STUDIO — CATÁLOGO DE COMANDOS\x1b[0m");
		console.log("\x1b[38;2;107;114;128mTodos los comandos del estudio llevan el prefijo [Studio] en el menú /\x1b[0m");
		console.log("");

		for (const cat of STUDIO_CATEGORIES) {
			renderCategory(cat);
		}
	}
}
