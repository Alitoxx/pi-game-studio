import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";

export interface McpServerDef {
	id: string;
	name: string;
	category: string;
	description: string;
	targetRoles: string[];
	command: string;
	args: string[];
	env?: Record<string, string>;
	isInstalledCheck?: string; // command to test availability
}

export const STUDIO_MCP_REGISTRY: McpServerDef[] = [
	{
		id: "rea",
		name: "REA MCP (Reverse Engineering Agent)",
		category: "Ingeniería Inversa",
		description: "Decompilación e inspección de WebAssembly, Electron, JS y binarios nativos (morluto/rea)",
		targetRoles: ["engine-programmer", "gameplay-programmer", "prototyper"],
		command: "npx",
		args: ["-y", "rea-agents@latest"],
	},
	{
		id: "playwright",
		name: "Playwright MCP (Browser & WebGL Testing)",
		category: "Testing & QA",
		description: "Inspección de juegos Web/WASM en navegador, capturas de UI y consola WebGL sin GUI",
		targetRoles: ["qa-tester", "qa-lead", "devops-engineer"],
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-playwright"],
	},
	{
		id: "context7",
		name: "Context7 MCP (Live Engine & Library Docs)",
		category: "Documentación & APIs",
		description: "Documentación oficial actualizada en tiempo real para Bevy ECS, Godot 4, Raylib y Unity",
		targetRoles: ["bevy-specialist", "godot-specialist", "raylib-specialist", "unity-specialist", "unreal-specialist"],
		command: "npx",
		args: ["-y", "@upstash/context7-mcp"],
	},
	{
		id: "codegraph",
		name: "Codegraph MCP (AST & Dependency Graph)",
		category: "Indexación de Código",
		description: "Grafo de dependencias entre componentes, sistemas y llamadas del motor",
		targetRoles: ["lead-programmer", "gameplay-programmer", "technical-director"],
		command: "codegraph",
		args: ["serve", "--mcp"],
		isInstalledCheck: "which codegraph",
	},
	{
		id: "sqlite",
		name: "SQLite MCP (Game Data & Economy Tables)",
		category: "Economía & Datos",
		description: "Consultas SQL directas sobre tablas de balance de armas, loot, stats de enemigos y savegames",
		targetRoles: ["economy-designer", "game-designer", "systems-designer"],
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-sqlite", "--db-path", "./assets/data/game.db"],
	},
	{
		id: "knowledge-vector",
		name: "Knowledge Vector DB MCP (Game Bible & Lore)",
		category: "Narrativa & Lore",
		description: "Búsqueda semántica sobre la biblia de diseño, reglas del mundo y coherencia de guión",
		targetRoles: ["narrative-director", "writer", "creative-director"],
		command: "npx",
		args: ["-y", "mcp-server-chroma", "--data-dir", "./assets/lore"],
	},
	{
		id: "blender",
		name: "Blender MCP (3D Assets & Collision Meshes)",
		category: "3D & Assets",
		description: "Ejecución de scripts Python en Blender para optimizar LODs, colisiones y exportar .glb/.gltf",
		targetRoles: ["technical-artist", "art-director", "level-designer"],
		command: "python3",
		args: ["-m", "blender_mcp"],
		isInstalledCheck: "which blender",
	},
	{
		id: "image-gen",
		name: "Image / Sprite Gen MCP (Textures & Icons)",
		category: "Arte 2D & Sprites",
		description: "Generación de spritesheets, texturas tileables, iconos de inventario y skyboxes",
		targetRoles: ["art-director", "prototyper"],
		command: "npx",
		args: ["-y", "mcp-server-comfyui"],
	},
	{
		id: "audio-sfx",
		name: "Audio & SFX MCP (Procedural Sounds & Music)",
		category: "Audio & Música",
		description: "Generación de efectos de sonido procedurales (.wav) y pistas musicales o voces dinámicas",
		targetRoles: ["sound-designer", "audio-director"],
		command: "npx",
		args: ["-y", "mcp-server-elevenlabs"],
	},
	{
		id: "live-engine",
		name: "Live Engine MCP (Hot Editor & Runtime Bridge)",
		category: "Inspección en Caliente",
		description: "Inspección de entidades en tiempo real: Bevy BRP (15702), Godot (6006), Unreal (30010)",
		targetRoles: ["bevy-specialist", "godot-specialist", "unity-specialist", "unreal-specialist"],
		command: "npx",
		args: ["-y", "@pi-game-studio/engine-mcp-bridge"],
	},
];

export interface McpStatusInfo {
	configured: boolean;
	running: boolean;
	toolCount: number;
}

export function readLocalMcpConfig(cwd: string): Record<string, any> {
	const root = findStudioRoot(cwd) || cwd;
	const mcpPath = join(root, ".pi", "mcp.json");
	if (!existsSync(mcpPath)) return {};
	try {
		return JSON.parse(readFileSync(mcpPath, "utf8"))?.mcpServers || {};
	} catch {
		return {};
	}
}

export function writeLocalMcpConfig(cwd: string, servers: Record<string, any>): void {
	const root = findStudioRoot(cwd) || cwd;
	const piDir = join(root, ".pi");
	mkdirSync(piDir, { recursive: true });
	const mcpPath = join(piDir, "mcp.json");
	let current: Record<string, any> = {};
	if (existsSync(mcpPath)) {
		try {
			current = JSON.parse(readFileSync(mcpPath, "utf8"));
		} catch {}
	}
	current.mcpServers = servers;
	writeFileSync(mcpPath, JSON.stringify(current, null, 2), "utf8");
}

export function getMcpServerStatuses(cwd: string): Map<string, McpStatusInfo> {
	const localServers = readLocalMcpConfig(cwd);
	const statuses = new Map<string, McpStatusInfo>();

	// Get active CLI list if available
	let cliOutput = "";
	try {
		cliOutput = execSync("pi mcp list 2>/dev/null", { encoding: "utf8", timeout: 4000 });
	} catch {}

	for (const server of STUDIO_MCP_REGISTRY) {
		const isConfiguredLocal = Boolean(localServers[server.id]);
		const isPresentInCli = cliOutput.includes(`${server.id}:`) || cliOutput.includes(`tools: ${server.id}`);
		const isConnected = cliOutput.includes(`${server.id}: connected`);

		// Extract tool count if connected
		let toolCount = 0;
		if (isPresentInCli) {
			const match = cliOutput.match(new RegExp(`${server.id}:[^\\n]*?(\\d+)\\s+tool`, "i"));
			if (match) {
				toolCount = parseInt(match[1], 10);
			}
		}

		statuses.set(server.id, {
			configured: isConfiguredLocal || isPresentInCli,
			running: isConnected,
			toolCount,
		});
	}

	return statuses;
}

export async function addMcpServer(cwd: string, serverId: string): Promise<boolean> {
	const server = STUDIO_MCP_REGISTRY.find((s) => s.id === serverId);
	if (!server) return false;

	const root = findStudioRoot(cwd) || cwd;
	try {
		// Run pi mcp add -l
		const cmd = `pi mcp add ${server.id} -l -- ${server.command} ${server.args.join(" ")}`;
		execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "pipe"], timeout: 10000 });
		return true;
	} catch {
		// Fallback: direct write to .pi/mcp.json
		const servers = readLocalMcpConfig(cwd);
		servers[server.id] = {
			command: server.command,
			args: server.args,
			...(server.env ? { env: server.env } : {}),
		};
		writeLocalMcpConfig(cwd, servers);
		return true;
	}
}

export async function removeMcpServer(cwd: string, serverId: string): Promise<boolean> {
	const root = findStudioRoot(cwd) || cwd;
	try {
		execSync(`pi mcp remove ${serverId} -l`, { cwd: root, stdio: ["ignore", "pipe", "pipe"], timeout: 5000 });
	} catch {
		const servers = readLocalMcpConfig(cwd);
		delete servers[serverId];
		writeLocalMcpConfig(cwd, servers);
	}
	return true;
}

export async function handleStudioMcp(args: string, ctx: ExtensionContext): Promise<void> {
	const root = findStudioRoot(ctx.cwd) || ctx.cwd;
	const arg = args?.trim().toLowerCase();

	if (arg === "list" || arg === "status") {
		renderMcpTerminalSummary(root);
		return;
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		await renderMcpInteractiveHub(ctx);
		return;
	}

	renderMcpTerminalSummary(root);
}

function renderMcpTerminalSummary(cwd: string): void {
	const statuses = getMcpServerStatuses(cwd);
	console.log("\n\x1b[1m\x1b[38;2;167;139;250mPI GAME STUDIO — SERVIDORES MCP (10 ROLES)\x1b[0m");
	console.log("\x1b[2mFilosofía: Files First, MCP Accelerated\x1b[0m\n");

	for (const s of STUDIO_MCP_REGISTRY) {
		const st = statuses.get(s.id);
		const badge = st?.running
			? "\x1b[32m[🟢 CONECTADO]\x1b[0m"
			: st?.configured
			? "\x1b[33m[⚪ CONFIGURADO]\x1b[0m"
			: "\x1b[90m[  INACTIVO  ]\x1b[0m";

		console.log(`${badge} \x1b[1m${s.name}\x1b[0m (${s.category})`);
		console.log(`   \x1b[2m• Roles:\x1b[0m ${s.targetRoles.join(", ")}`);
		console.log(`   \x1b[2m• Función:\x1b[0m ${s.description}\n`);
	}
}

async function renderMcpInteractiveHub(ctx: ExtensionContext): Promise<void> {
	const statuses = getMcpServerStatuses(ctx.cwd);
	const options: string[] = [];

	for (const s of STUDIO_MCP_REGISTRY) {
		const st = statuses.get(s.id);
		const icon = st?.running ? "🟢 [Activo]" : st?.configured ? "⚪ [Config]" : "➕ [Instalar]";
		options.push(`${icon} ${s.name} (${s.category})`);
	}

	options.push("🚀 Activar Preset: Kit Rápido (REA + Context7 + Codegraph)");
	options.push("✨ Activar Preset: Todos los 10 MCPs del Estudio");
	options.push("🗑️ Desactivar todos los servidores MCP locales");

	const choice = await (ctx.ui as any).select(
		"PI GAME STUDIO — HUB DE SERVIDORES MCP",
		options,
	);

	if (choice === undefined || choice === null) return;
	const idx = typeof choice === "number" ? choice : options.indexOf(choice);
	if (idx === -1) return;

	if (idx < STUDIO_MCP_REGISTRY.length) {
		const server = STUDIO_MCP_REGISTRY[idx];
		const st = statuses.get(server.id);

		if (st?.configured) {
			const subChoice = await (ctx.ui as any).select(
				`${server.name} — Opciones`,
				[`Desactivar / Remover servidor`, `Mantener activo`],
			);
			if (subChoice === 0 || subChoice === "Desactivar / Remover servidor") {
				await removeMcpServer(ctx.cwd, server.id);
				ctx.ui?.notify?.(`Servidor MCP '${server.id}' desactivado.`, "info");
			}
		} else {
			await addMcpServer(ctx.cwd, server.id);
			ctx.ui?.notify?.(`Servidor MCP '${server.id}' configurado exitosamente.`, "info");
		}
	} else if (idx === STUDIO_MCP_REGISTRY.length) {
		// Preset: REA + Context7 + Codegraph
		await addMcpServer(ctx.cwd, "rea");
		await addMcpServer(ctx.cwd, "context7");
		await addMcpServer(ctx.cwd, "codegraph");
		ctx.ui?.notify?.("Preset Rápido configurado: REA, Context7 y Codegraph.", "info");
	} else if (idx === STUDIO_MCP_REGISTRY.length + 1) {
		// Preset: All 10
		for (const s of STUDIO_MCP_REGISTRY) {
			await addMcpServer(ctx.cwd, s.id);
		}
		ctx.ui?.notify?.("Los 10 servidores MCP han sido configurados para este proyecto.", "info");
	} else {
		// Desactivar todos
		writeLocalMcpConfig(ctx.cwd, {});
		ctx.ui?.notify?.("Todos los servidores MCP locales han sido desactivados.", "info");
	}
}
