import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "agents"))) return candidate1;
	} catch {}
	try {
		const candidate2 = resolve(__dirname, "..", "..");
		if (existsSync(join(candidate2, "agents"))) return candidate2;
	} catch {}
	return process.cwd();
}

interface AgentItem {
	name: string;
	title: string;
	tier: string;
	description: string;
}

export const AGENT_GROUPS: Array<{
	name: string;
	emoji: string;
	agents: string[];
}> = [
	{
		name: "Tier 1 — Directores",
		emoji: "👑",
		agents: ["creative-director", "technical-director", "producer"],
	},
	{
		name: "Tier 2 — Leads de Departamento",
		emoji: "🎯",
		agents: [
			"game-designer",
			"lead-programmer",
			"art-director",
			"audio-director",
			"narrative-director",
			"qa-lead",
			"release-manager",
			"localization-lead",
		],
	},
	{
		name: "Tier 3 — Programación & Motores",
		emoji: "💻",
		agents: [
			"gameplay-programmer",
			"engine-programmer",
			"ai-programmer",
			"network-programmer",
			"tools-programmer",
			"ui-programmer",
		],
	},
	{
		name: "Tier 3 — Especialistas de Motor Específicos",
		emoji: "⚡",
		agents: [
			"godot-specialist",
			"godot-gdscript-specialist",
			"godot-shader-specialist",
			"godot-gdextension-specialist",
			"godot-csharp-specialist",
			"unity-specialist",
			"unity-dots-specialist",
			"unity-shader-specialist",
			"unity-addressables-specialist",
			"unity-ui-specialist",
			"unreal-specialist",
			"ue-gas-specialist",
			"ue-blueprint-specialist",
			"ue-replication-specialist",
			"ue-umg-specialist",
			"bevy-specialist",
			"raylib-specialist",
			"raylib-entt-specialist",
			"raylib-shader-specialist",
			"raylib-ui-specialist",
			"raylib-build-specialist",
		],
	},
	{
		name: "Tier 3 — Diseño & Sistemas",
		emoji: "📐",
		agents: [
			"systems-designer",
			"level-designer",
			"economy-designer",
			"ux-designer",
			"prototyper",
		],
	},
	{
		name: "Tier 3 — Arte, Audio & Narrativa",
		emoji: "🎨",
		agents: ["technical-artist", "writer", "world-builder", "sound-designer"],
	},
	{
		name: "Tier 3 — QA, Rendimiento & Seguridad",
		emoji: "🧪",
		agents: ["qa-tester", "performance-analyst", "security-engineer", "analytics-engineer"],
	},
	{
		name: "Tier 3 — Operaciones & Comunidad",
		emoji: "🚀",
		agents: ["devops-engineer", "accessibility-specialist", "live-ops-designer", "community-manager"],
	},
];

export async function handleStudioAgents(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";

	if (query && query !== "all" && query !== "list") {
		const matchedGroup = AGENT_GROUPS.find(
			(g) =>
				g.name.toLowerCase().includes(query) ||
				g.agents.some((a) => a.toLowerCase().includes(query)),
		);

		if (matchedGroup) {
			printGroup(matchedGroup, ctx.cwd);
			return;
		}
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function" && query !== "all") {
		const objectiveOptions = [
			"🎯 1. Quiero diseñar mecánicas, combate o balance → game-designer",
			"💻 2. Quiero programar, resolver arquitectura o motor → technical-director / leads",
			"🎨 3. Quiero definir arte, audio o historia → art-director / audio / narrativa",
			"🧪 4. Quiero probar, optimizar o reportar bugs → qa-lead / qa-tester",
			"👑 5. Quiero visión global o planificar entregas → producer / creative-director",
			"📂 6. Explorar agentes por área técnica (Directores, Leads, Motores...)",
			"📖 7. Ver el catálogo completo de los 55 agentes",
		];

		const selected = await (ctx.ui as any).select(
			"🎮 Pi Game Studio — ¿Con qué parte de tu juego quieres avanzar?",
			objectiveOptions,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : objectiveOptions.indexOf(selected);
		if (idx === -1) return;

		switch (idx) {
			case 0:
				// Mecánicas & Balance
				printGroup(AGENT_GROUPS[4] || AGENT_GROUPS[1], ctx);
				break;
			case 1:
				// Programación & Motor
				printGroup(AGENT_GROUPS[2], ctx);
				break;
			case 2:
				// Arte, Audio & Narrativa
				printGroup(AGENT_GROUPS[5], ctx);
				break;
			case 3:
				// QA & Rendimiento
				printGroup(AGENT_GROUPS[6], ctx);
				break;
			case 4:
				// Visión & Directores
				printGroup(AGENT_GROUPS[0], ctx);
				break;
			case 5: {
				// Submenú por grupos
				const groupOpts = AGENT_GROUPS.map((g) => `${g.emoji} ${g.name} (${g.agents.length} agentes)`);
				const groupPick = await (ctx.ui as any).select("Selecciona un área del estudio:", groupOpts);
				if (groupPick !== undefined && groupPick !== null) {
					const gIdx = typeof groupPick === "number" ? groupPick : groupOpts.indexOf(groupPick);
					if (gIdx !== -1 && gIdx < AGENT_GROUPS.length) {
						printGroup(AGENT_GROUPS[gIdx], ctx);
					}
				}
				break;
			}
			case 6:
				printAllAgents(ctx);
				break;
		}
		return;
	}

	printAllAgents(ctx);
}

function printGroup(
	group: { name: string; emoji: string; agents: string[] },
	ctx: ExtensionContext,
): void {
	const pkgRoot = resolvePackageRoot();
	const lines = [
		`🎮 ${group.emoji} ${group.name}`,
		"─".repeat(50),
	];

	for (const agentName of group.agents) {
		const agentInfo = readAgentInfo(agentName, ctx.cwd, pkgRoot);
		lines.push(`• ${agentName.padEnd(26)} ${agentInfo.title}`);
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(lines.join("\n"), "info");
	} else {
		console.log("");
		console.log(`\x1b[1m\x1b[38;2;167;139;250m${group.emoji} ${group.name}\x1b[0m`);
		console.log("\x1b[38;2;107;114;128m" + "─".repeat(60) + "\x1b[0m");

		for (const agentName of group.agents) {
			const agentInfo = readAgentInfo(agentName, ctx.cwd, pkgRoot);
			console.log(
				`  \x1b[38;2;56;189;248m\x1b[1m${agentName.padEnd(28)}\x1b[0m \x1b[38;2;243;244;246m${agentInfo.title}\x1b[0m`,
			);
		}
		console.log("");
	}
}

function printAllAgents(ctx: ExtensionContext): void {
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const lines = [
			"🎮 PI GAME STUDIO — CATÁLOGO DE 55 AGENTES",
			"─".repeat(50),
			...AGENT_GROUPS.map((g) => `${g.emoji} ${g.name}: ${g.agents.length} agentes`),
			"",
			"Usa /studio:agents <grupo> para ver los especialistas de un área.",
		];
		ctx.ui.notify(lines.join("\n"), "info");
	} else {
		console.log("");
		console.log("\x1b[1m\x1b[38;2;167;139;250m🎮 PI GAME STUDIO — CATÁLOGO DE 55 AGENTES\x1b[0m");
		console.log("\x1b[38;2;107;114;128m" + "─".repeat(60) + "\x1b[0m");

		for (const group of AGENT_GROUPS) {
			printGroup(group, ctx);
		}
	}
}

function readAgentInfo(name: string, cwd: string, pkgRoot: string): { title: string } {
	let candidatePath = join(cwd, ".pi", "agents", `${name}.md`);
	if (!existsSync(candidatePath)) {
		candidatePath = join(pkgRoot, "agents", `${name}.md`);
	}

	if (existsSync(candidatePath)) {
		try {
			const content = readFileSync(candidatePath, "utf8");
			const titleMatch = content.match(/title:\s*["']?([^"'\n]+)["']?/i) ||
				content.match(/^#\s*([^\n]+)/m);
			if (titleMatch && titleMatch[1]) {
				return { title: titleMatch[1].trim() };
			}
		} catch {}
	}

	return { title: name.replace(/-/g, " ") };
}
