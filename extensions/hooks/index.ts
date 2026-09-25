import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { opendir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { renderBanner } from "./banner.ts";
import { handleStudioCommand } from "./studio-command.ts";
import { handleStudioSetup } from "./studio-setup.ts";
import { handleStudioModels } from "./studio-models.ts";
import { handleStudioStatus } from "./studio-status.ts";
import { handleStudioAgents } from "./studio-agents.ts";
import { handleStudioSettings } from "./studio-settings.ts";

export default function (pi: ExtensionAPI) {
	// ──────────────────────────────────────────────
	// Studio Suite Commands (Namespace: studio:*)
	// ──────────────────────────────────────────────

	// /studio — Hub principal y catálogo
	(pi as any).registerCommand?.("studio", {
		description: "🎮 [Studio] Explorador y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// /studio:setup — Asistente interactivo de instalación y actualización
	(pi as any).registerCommand?.("studio:setup", {
		description: "🎮 [Studio] Asistente interactivo de instalación, verificación y actualización del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSetup(args, ctx);
		},
	});

	// /studio:models — Asignación interactiva de modelos por nivel
	(pi as any).registerCommand?.("studio:models", {
		description: "🎮 [Studio] Configuración interactiva de modelos de IA por nivel de agente",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioModels(args, ctx);
		},
	});

	// /studio:status — Dashboard y diagnóstico en vivo
	(pi as any).registerCommand?.("studio:status", {
		description: "🎮 [Studio] Dashboard en vivo de estado, agentes y métricas del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStatus(args, ctx);
		},
	});

	// /studio:agents — Catálogo de los 50 agentes
	(pi as any).registerCommand?.("studio:agents", {
		description: "🎮 [Studio] Catálogo interactivo de los 50 agentes y sus especialidades",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAgents(args, ctx);
		},
	});

	// /studio:settings — Configuración interactiva del proyecto
	(pi as any).registerCommand?.("studio:settings", {
		description: "🎮 [Studio] Configuración interactiva del proyecto (motor, plataformas, idioma)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSettings(args, ctx);
		},
	});

	// /studio:help — Alias de ayuda
	(pi as any).registerCommand?.("studio:help", {
		description: "🎮 [Studio] Ayuda rápida y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// ──────────────────────────────────────────────
	// Hook: Validate git commits
	// Fires on tool_call for git commit commands
	// ──────────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if (!isToolCallEventType("bash", event)) return;

		const cmd = event.input.command?.trim() || "";

		// --- Git commit validation ---
		if (/^git\s+commit/.test(cmd)) {
			return handleGitCommit(event, cmd, ctx);
		}

		// --- Git push protection ---
		if (/^git\s+push/.test(cmd)) {
			return handleGitPush(event, cmd, ctx);
		}
	});

	// ──────────────────────────────────────────────
	// Hook: Validate skill changes
	// Fires on tool_call for write/edit on skill files
	// ──────────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if (
			!isToolCallEventType("write", event) &&
			!isToolCallEventType("edit", event)
		)
			return;

		// Check if writing to a skill file (skills/ or .pi/skills/)
		const filePath = event.input.path || "";
		const skillMatch = filePath.match(/(?:\/skills\/|\.pi\/skills\/)([^/]+)/);

		if (skillMatch) {
			const skillName = skillMatch[1];
			// Advisory only — don't block
			console.log(
				`Reminder: run skill-test to validate ${skillName} after changes.`,
			);
		}
	});

	// ──────────────────────────────────────────────
	// Hook: Agent audit trail
	// Logs agent invocations for debugging
	// ──────────────────────────────────────────────
	pi.on("turn_start", async (event, ctx) => {
		const logDir = join(ctx.cwd, "production", "session-logs");
		await mkdir(logDir, { recursive: true }).catch(() => {});

		const line = `${new Date().toISOString()} | Agent called\n`;
		await appendToFile(join(logDir, "agent-audit.log"), line).catch(() => {});
	});

	// ──────────────────────────────────────────────
	// Hook: Session start (banner + gap detection)
	// Fires on session_start to show studio dashboard and check docs
	// ──────────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		const isGameStudio =
			existsSync(join(ctx.cwd, ".pi", "game-studio")) ||
			existsSync(join(ctx.cwd, "project.yaml"));

		// Only run in the game-studio project context
		if (!isGameStudio) return;

		// Clear terminal screen and scrollback buffer for a clean studio experience
		const shouldClear = !existsSync(join(ctx.cwd, ".pi", "game-studio", "no-clear-screen"));
		if (shouldClear && process.stdout.isTTY) {
			try {
				process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
			} catch {}
		}

		// Display startup banner / dashboard
		try {
			if ((ctx as any).hasUI && (ctx as any).ui?.setHeader) {
				(ctx as any).ui.setHeader((_tui: any, _theme: any) => ({
					render(width: number) {
						return renderBanner(width, ctx.cwd);
					},
				}));
			} else {
				const termWidth = process.stdout.columns || 80;
				const bannerLines = renderBanner(termWidth, ctx.cwd);
				for (const line of bannerLines) {
					console.log(line);
				}
			}
		} catch {}

		const gaps: string[] = [];

		// Check 1: Code without design docs
		const srcExists = existsSync(join(ctx.cwd, "src"));
		const designExists = existsSync(join(ctx.cwd, "design", "gdd"));

		if (srcExists) {
			let srcCount = 0;
			try {
				const dir = await opendir(join(ctx.cwd, "src"));
				for await (const _ of dir) srcCount++;
			} catch {}

			let designCount = 0;
			if (designExists) {
				try {
					const dir = await opendir(join(ctx.cwd, "design", "gdd"));
					for await (const _ of dir) designCount++;
				} catch {}
			}

			if (srcCount > 50 && designCount < 5) {
				gaps.push(
					`Codebase with ${srcCount}+ files but only ${designCount} design docs. Run /reverse-document or /project-stage-detect.`,
				);
			}
		}

		// Check 2: Prototypes without README
		const protoExists = existsSync(join(ctx.cwd, "prototypes"));
		if (protoExists) {
			try {
				const dir = await opendir(join(ctx.cwd, "prototypes"));
				for await (const entry of dir) {
					if (entry.isDirectory()) {
						const protoDir = join(ctx.cwd, "prototypes", entry.name);
						if (
							!existsSync(join(protoDir, "README.md")) &&
							!existsSync(join(protoDir, "CONCEPT.md"))
						) {
							gaps.push(
								`Undocumented prototype: prototypes/${entry.name}/. Run /reverse-document concept prototypes/${entry.name}`,
							);
						}
					}
				}
			} catch {}
		}

		// Check 3: Core systems without architecture docs
		const coreExists =
			existsSync(join(ctx.cwd, "src", "core")) ||
			existsSync(join(ctx.cwd, "src", "engine"));
		const archExists = existsSync(join(ctx.cwd, "docs", "architecture"));

		if (coreExists && !archExists) {
			gaps.push(
				"Core systems exist but no docs/architecture/ directory. Start with /architecture-decision.",
			);
		}

		if (gaps.length > 0) {
			ctx.ui.notify(`Documentation gaps found: ${gaps.length}`, "info");
		}
	});
}

// ──────────────────────────────────────────────
// Git commit validation
// ──────────────────────────────────────────────
async function handleGitCommit(
	event: any,
	_cmd: string,
	ctx: ExtensionContext,
) {
	const warnings: string[] = [];

	// Get staged files
	let staged: string[] = [];
	try {
		const output = execSync("git diff --cached --name-only", {
			encoding: "utf-8",
			cwd: ctx.cwd,
		});
		staged = output.trim().split("\n").filter(Boolean);
	} catch {
		return; // Not a git repo or no staged files
	}

	if (staged.length === 0) return;

	// Check design docs for required sections
	const designFiles = staged.filter((f) => f.startsWith("design/gdd/"));
	for (const file of designFiles) {
		if (!file.endsWith(".md")) continue;
		const fullPath = join(ctx.cwd, file);
		if (!existsSync(fullPath)) continue;

		try {
			const content = await readFile(fullPath, "utf-8");
			const required = [
				"Overview",
				"Player Fantasy",
				"Formulas",
				"Edge Cases",
				"Dependencies",
				"Tuning Knobs",
			];
			for (const section of required) {
				if (!content.toLowerCase().includes(section.toLowerCase())) {
					warnings.push(`DESIGN: ${file} missing required section: ${section}`);
				}
			}
		} catch {}
	}

	// Check for hardcoded gameplay values
	const codeFiles = staged.filter((f) => f.startsWith("src/gameplay/"));
	for (const file of codeFiles) {
		const fullPath = join(ctx.cwd, file);
		if (!existsSync(fullPath)) continue;
		try {
			const content = await readFile(fullPath, "utf-8");
			const matches = content.match(
				/(damage|health|speed|rate|chance|cost|duration)\s*[:=]\s*\d+/g,
			);
			if (matches?.length) {
				warnings.push(
					`CODE: ${file} may contain hardcoded gameplay values. Use data files.`,
				);
			}
		} catch {}
	}

	if (warnings.length > 0) {
		ctx.ui.notify(
			`Commit validation: ${warnings.length} warning(s). Check output for details.`,
			"warning",
		);
		// Don't block — just warn via notification
	}
}

// ──────────────────────────────────────────────
// Git push protection
// ──────────────────────────────────────────────
async function handleGitPush(event: any, cmd: string, ctx: ExtensionContext) {
	const protectedBranches = ["main", "master", "develop"];

	// Get current branch
	let currentBranch = "";
	try {
		currentBranch = execSync("git rev-parse --abbrev-ref HEAD", {
			encoding: "utf-8",
			cwd: ctx.cwd,
		}).trim();
	} catch {
		return;
	}

	for (const branch of protectedBranches) {
		if (
			currentBranch === branch ||
			new RegExp(`\\b${branch}(\\s|$)`).test(cmd)
		) {
			ctx.ui.notify(
				`Push to protected branch '${branch}'. Ensure builds and tests pass first.`,
				"warning",
			);
			return;
		}
	}
}

// ──────────────────────────────────────────────
// File append utility
// ──────────────────────────────────────────────
async function appendToFile(filePath: string, content: string): Promise<void> {
	const existing = existsSync(filePath)
		? await readFile(filePath, "utf-8")
		: "";
	await writeFile(filePath, existing + content, "utf-8");
}
