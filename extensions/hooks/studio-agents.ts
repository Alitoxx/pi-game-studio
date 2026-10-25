import { ACCENT, GRAY, SECONDARY, WHITE } from "./studio-palette.ts";
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
		name: "TIER 1 — DIRECTORES",
		emoji: "•",
		agents: ["creative-director", "technical-director", "producer"],
	},
	{
		name: "TIER 2 — LEADS & DESARROLLADORES CORE",
		emoji: "•",
		agents: [
			"game-designer",
			"gameplay-programmer",
			"art-director",
			"audio-director",
			"qa-lead",
		],
	},
	{
		name: "TIER 3 — ESPECIALISTAS DE MOTOR DEDICADOS",
		emoji: "•",
		agents: [
			"bevy-specialist",
			"godot-specialist",
			"phaser-specialist",
			"raylib-specialist",
			"unity-specialist",
			"unreal-specialist",
		],
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
			printGroup(matchedGroup, ctx);
			return;
		}
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function" && query !== "all") {
		const objectiveOptions = [
			"1. Directores (Visión, Arquitectura y Producción)",
			"2. Desarrolladores Core (Diseño, Gameplay, Arte, Audio, QA)",
			"3. Especialistas de Motor (Bevy, Godot, Phaser, Raylib, Unity, Unreal)",
			"4. Ver la dotación completa (14 agentes)",
		];

		const selected = await (ctx.ui as any).select(
			"PI GAME STUDIO — Selección de Especialistas",
			objectiveOptions,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : objectiveOptions.indexOf(selected);
		if (idx === -1) return;

		switch (idx) {
			case 0:
				printGroup(AGENT_GROUPS[0], ctx);
				break;
			case 1:
				printGroup(AGENT_GROUPS[1], ctx);
				break;
			case 2:
				printGroup(AGENT_GROUPS[2], ctx);
				break;
			case 3:
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
		`${group.name}`,
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
		console.log(`\x1b[1m${ACCENT}${group.name}\x1b[0m`);
		console.log("" + GRAY + "" + "─".repeat(60) + "\x1b[0m");

		for (const agentName of group.agents) {
			const agentInfo = readAgentInfo(agentName, ctx.cwd, pkgRoot);
			console.log(
				`  ${SECONDARY}\x1b[1m${agentName.padEnd(28)}\x1b[0m ${WHITE}${agentInfo.title}\x1b[0m`,
			);
		}
		console.log("");
	}
}

function printAllAgents(ctx: ExtensionContext): void {
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const lines = [
			"PI GAME STUDIO — DOTACIÓN DE 13 AGENTES (8+1)",
			"─".repeat(50),
			...AGENT_GROUPS.map((g) => `${g.name}: ${g.agents.length} agentes`),
			"",
			"Usa /studio:agents <grupo> para ver los especialistas de un área.",
		];
		ctx.ui.notify(lines.join("\n"), "info");
	} else {
		console.log("");
		console.log("\x1b[1m" + ACCENT + "PI GAME STUDIO — DOTACIÓN DE 13 AGENTES (8+1)\x1b[0m");
		console.log("" + GRAY + "" + "─".repeat(60) + "\x1b[0m");

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
