import type {
	ExtensionAPI,
	ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { isToolCallEventType } from "@earendil-works/pi-coding-agent";
import { opendir, readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { renderBanner, isArtEnabled, setArtEnabled } from "./banner.ts";
import { findStudioRoot } from "./studio-root.ts";
import { handleStudioCommand } from "./studio-command.ts";
import { handleStudioSetup, inspectSetup } from "./studio-setup.ts";
import { handleStudioModels } from "./studio-models.ts";
import { handleStudioStatus } from "./studio-status.ts";
import { handleStudioAgents } from "./studio-agents.ts";
import { handleStudioSettings, getLanguage } from "./studio-settings.ts";
import { handleStudioChains } from "./studio-chains.ts";
import { handleStudioStart, readProducerState, recordFlowCompletion, auditProject } from "./studio-start.ts";
import { handleStudioDoctor } from "./studio-doctor.ts";
import { handleStudioWeb } from "./studio-web.ts";
import { handleStudioProfile } from "./studio-profile.ts";
import { handleStudioMcp } from "./studio-mcp.ts";
import { promptMediaToolsInstall } from "./studio-media-tools.ts";
import { handleStudioSfx, handleStudioPalettes } from "./studio-synth.ts";
import { handleStudioNew } from "./studio-new.ts";
import { handleStudioChanges } from "./studio-changes.ts";
import { handleStudioTasks } from "./studio-tasks.ts";
import { updateStudioHUD } from "./studio-hud.ts";
import { updateTasksWidget } from "./studio-tasks-widget.ts";
import { updateSubagentsWidget, installSubagentsWidget } from "./studio-subagents-widget.ts";
import { handleStudioSubagentsViewer } from "./studio-subagents-viewer.ts";
import { registerStudioSubagentTools } from "./studio-subagents.ts";
import { registerAskUserQuestion } from "./studio-choice.ts";
import { studioAgentsRunner } from "./studio-agents-runner.ts";
import {
	playSuccessChime,
	playAlertChime,
	playErrorChime,
	handleStudioSound,
} from "./studio-sound.ts";
import { handleStudioPerfAudit, auditFilePerformance } from "./studio-perf-guard.ts";
import { handleStudioWatch } from "./studio-watch.ts";
import { handleStudioAssets } from "./studio-assets.ts";
import { showCommandPalette } from "./studio-palette-overlay.ts";
import { doubleEscapeGuard } from "./studio-esc-guard.ts";
import { validateCommandSafety, isDestructiveCommand } from "./studio-destructive-guard.ts";
import { boundedSurfacesGuard } from "./studio-surfaces-guard.ts";

export default function (pi: ExtensionAPI) {
	// ──────────────────────────────────────────────
	// Native Studio Subagent Tools (Gentle Architecture)
	// ──────────────────────────────────────────────
	registerStudioSubagentTools(pi);
	registerAskUserQuestion(pi);

	// ──────────────────────────────────────────────
	// Audio Notifications & Chimes (Gentle Shell Sound Alerts)
	// ──────────────────────────────────────────────
	studioAgentsRunner.subscribe((task) => {
		if (task.status === "completed") {
			playSuccessChime();
			boundedSurfacesGuard.clear();
		} else if (task.status === "failed") {
			playErrorChime();
			boundedSurfacesGuard.clear();
		} else if (task.status === "cancelled") {
			boundedSurfacesGuard.clear();
		} else if (task.status === "running" && task.task) {
			boundedSurfacesGuard.setFromTask(task.task);
		}
	});

	// ──────────────────────────────────────────────
	// Escape & Abort Handling (Double-Escape Emergency Cancel)
	// ──────────────────────────────────────────────
	(pi as any).on?.("session_abort", (_event: any, ctx: any) => {
		doubleEscapeGuard.handleEscape(ctx);
		studioAgentsRunner.cancelAll("Sesión interrumpida por el usuario (Escape)");
	});
	(pi as any).on?.("turn_abort", (_event: any, ctx: any) => {
		doubleEscapeGuard.handleEscape(ctx);
		studioAgentsRunner.cancelAll("Turno abortado por el usuario (Escape)");
	});
	(pi as any).on?.("agent_abort", (_event: any, ctx: any) => {
		doubleEscapeGuard.handleEscape(ctx);
		studioAgentsRunner.cancelAll("Agente abortado por el usuario (Escape)");
	});

	// ──────────────────────────────────────────────
	// Studio Suite Commands (Namespace: studio:*)
	// ──────────────────────────────────────────────

	// /studio — Hub principal y catálogo
	(pi as any).registerCommand?.("studio", {
		description: "[Studio] Explorador y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// /studio:start — Asistente interactivo de inicio y onboarding
	(pi as any).registerCommand?.("studio:start", {
		description: "[Studio] Asistente interactivo de inicio y onboarding de tu juego",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStart(args, ctx);
		},
	});

	// /studio:setup — Asistente interactivo de instalación y actualización
	(pi as any).registerCommand?.("studio:setup", {
		description: "[Studio] Asistente interactivo de instalación, verificación y actualización del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSetup(args, ctx);
		},
	});

	// /studio:new — Crear nuevo juego desde plantilla o starter
	(pi as any).registerCommand?.("studio:new", {
		description: "[Studio] Crear nuevo proyecto desde plantilla/starter (Bevy, Raylib, Godot)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioNew(args, ctx);
		},
	});

	// /studio:models — Asignación interactiva de modelos por nivel
	(pi as any).registerCommand?.("studio:models", {
		description: "[Studio] Configuración interactiva de modelos de IA por nivel de agente",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioModels(args, ctx);
		},
	});

	// /studio:status — Dashboard y diagnóstico en vivo
	(pi as any).registerCommand?.("studio:status", {
		description: "[Studio] Dashboard en vivo de estado, agentes y métricas del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStatus(args, ctx);
		},
	});

	// /studio:changes — Clasificación de cambios gamedev (Gentle Changes)
	(pi as any).registerCommand?.("studio:changes", {
		description: "[Studio] Clasificación de cambios pendientes en diseño, código, assets y drift de ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChanges(args, ctx);
		},
	});

	// /changes — Alias directo de clasificación de cambios gamedev (Gentle Changes)
	(pi as any).registerCommand?.("changes", {
		description: "[Studio] Clasificación de cambios pendientes en diseño, código, assets y drift de ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChanges(args, ctx);
		},
	});

	// /studio:sound — Activar o desactivar notificaciones de audio (on/off)
	(pi as any).registerCommand?.("studio:sound", {
		description: "[Studio] Activar o desactivar notificaciones de audio del estudio (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSound(args, ctx);
		},
	});

	// /sound — Alias de notificaciones de audio (on/off)
	(pi as any).registerCommand?.("sound", {
		description: "[Studio] Activar o desactivar notificaciones de audio del estudio (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSound(args, ctx);
		},
	});

	// /studio:tasks — Gestión de tareas y radar de obsolescencia (Gentle Todo)
	(pi as any).registerCommand?.("studio:tasks", {
		description: "[Studio] Gestión de tareas del sprint, Live Specs y radar de tareas obsoletas (Stale)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTasks(args, ctx);
		},
	});

	// /studio:agents — Visor e inspector en vivo de actividad y logs de subagentes
	(pi as any).registerCommand?.("studio:agents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /agents — Alias directo del visor e inspector en vivo de subagentes
	(pi as any).registerCommand?.("agents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:roster — Navegador del catálogo de los 13 agentes del estudio
	(pi as any).registerCommand?.("studio:roster", {
		description: "[Studio] Navegador interactivo de los 13 agentes oficiales (8 Core + 5 Especialistas de motor)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAgents(args, ctx);
		},
	});

	// /studio:chains — Cadenas multi-agente guiadas
	(pi as any).registerCommand?.("studio:chains", {
		description: "[Studio] Cadenas de ejecución multi-agente para GDD, mecánicas y release",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChains(args, ctx);
		},
	});

	// /studio:chain — Alias singular de cadenas
	(pi as any).registerCommand?.("studio:chain", {
		description: "[Studio] Cadenas de ejecución multi-agente para GDD, mecánicas y release",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChains(args, ctx);
		},
	});

	// /studio:settings — Configuración interactiva del proyecto
	(pi as any).registerCommand?.("studio:settings", {
		description: "[Studio] Configuración interactiva del proyecto (motor, plataformas, idioma)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSettings(args, ctx);
		},
	});

	// /studio:doctor — Diagnóstico de prerrequisitos de compilación y motor
	(pi as any).registerCommand?.("studio:doctor", {
		description: "[Studio] Diagnóstico de prerrequisitos, herramientas y compiladores del motor de juego",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioDoctor(args, ctx);
		},
	});

	// /studio:web — Compilar y servir versión Web/WASM en el navegador
	(pi as any).registerCommand?.("studio:web", {
		description: "[Studio] Compilar versión WebAssembly y lanzar servidor local con aislamiento COOP/COEP",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWeb(ctx, args);
		},
	});

	// /studio:profile — Live Performance Profiler & Budget Tracker
	(pi as any).registerCommand?.("studio:profile", {
		description: "[Studio] Live Performance Profiler y monitor de presupuestos de FPS/Memoria",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioProfile(args, ctx);
		},
	});

	// /studio:sfx — Sintetizador procedural de audio SFX
	(pi as any).registerCommand?.("studio:sfx", {
		description: "[Studio] Sintetizador procedural de audio WAV (ondas sine/square/saw/noise y ADSR)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSfx(args, ctx);
		},
	});

	// /studio:palettes — Generador de paletas de color y shaders
	(pi as any).registerCommand?.("studio:palettes", {
		description: "[Studio] Generador de paletas retro y shaders cuantizadores para Godot y Raylib",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPalettes(args, ctx);
		},
	});

	// /studio:commands — Paleta curada de comandos del estudio
	(pi as any).registerCommand?.("studio:commands", {
		description: "[Studio] Paleta curada y búsqueda rápida de comandos y herramientas del estudio",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// /palette — Paleta difusa de comandos interactiva (Alt+K)
	(pi as any).registerCommand?.("palette", {
		description: "[Studio] Paleta difusa de comandos interactiva (Alt+K)",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// Shortcut Alt+K — Abre la paleta de comandos
	(pi as any).registerShortcut?.("alt+k", {
		description: "[Studio] Paleta difusa de comandos",
		handler: async (ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// /studio:toggle-art — Alternar ilustración Braille en el banner de bienvenida
	(pi as any).registerCommand?.("studio:toggle-art", {
		description: "[Studio] Alternar ilustración Braille de bienvenida (on/off)",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const root = findStudioRoot(ctx.cwd) || ctx.cwd;
			const current = isArtEnabled(root);
			setArtEnabled(root, !current);
			const newState = !current ? "activada" : "desactivada";
			ctx.ui?.setHeader?.(renderBanner(ctx.cwd));
			ctx.ui?.notify?.(`Ilustración de Gamepad ${newState}.`, "info");
		},
	});

	// /studio:art — Alias de toggle-art
	(pi as any).registerCommand?.("studio:art", {
		description: "[Studio] Alternar ilustración Braille de bienvenida (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			const root = findStudioRoot(ctx.cwd) || ctx.cwd;
			const current = isArtEnabled(root);
			setArtEnabled(root, !current);
			const newState = !current ? "activada" : "desactivada";
			ctx.ui?.setHeader?.(renderBanner(ctx.cwd));
			ctx.ui?.notify?.(`Ilustración de Gamepad ${newState}.`, "info");
		},
	});

	// /studio:subagents — Visor e inspector en vivo de logs y actividades de subagentes
	(pi as any).registerCommand?.("studio:subagents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:mcp — Gestor interactivo de los 10 Servidores MCP del Estudio
	(pi as any).registerCommand?.("studio:mcp", {
		description: "[Studio] Hub interactivo de los 10 servidores MCP (REA, Playwright, Context7, Blender, etc.)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioMcp(args, ctx);
		},
	});

	// /studio:tools — Diagnóstico de viabilidad e instalador de herramientas multimedia CLI (FFmpeg, ImageMagick, Assimp, SoX)
	(pi as any).registerCommand?.("studio:tools", {
		description: "[Studio] Diagnóstico de viabilidad e instalador interactivo de herramientas multimedia CLI",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await promptMediaToolsInstall(ctx);
		},
	});

	// /studio:logs — Alias de inspección en vivo de subagentes
	(pi as any).registerCommand?.("studio:logs", {
		description: "[Studio] Alias de inspección en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:help — Alias de ayuda
	(pi as any).registerCommand?.("studio:help", {
		description: "[Studio] Ayuda rápida y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// /studio:perf-guard — Auditor de rendimiento y detección de allocs en frame loops
	(pi as any).registerCommand?.("studio:perf-guard", {
		description: "[Studio] Auditor de rendimiento y detección de allocs en frame loops (Rust, GDScript, C++, C#)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPerfAudit(args, ctx);
		},
	});

	// /perf-guard — Alias de studio:perf-guard
	(pi as any).registerCommand?.("perf-guard", {
		description: "[Studio] Alias de auditor de rendimiento y allocaciones en frame loops",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPerfAudit(args, ctx);
		},
	});

	// /studio:watch — Live Engine Hot-Reload & Watcher
	(pi as any).registerCommand?.("studio:watch", {
		description: "[Studio] Live engine watcher y compilación en segundo plano (cargo check, godot, cmake)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWatch(args, ctx);
		},
	});

	// /watch — Alias de studio:watch
	(pi as any).registerCommand?.("watch", {
		description: "[Studio] Alias de live engine watcher y hot-reload en segundo plano",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWatch(args, ctx);
		},
	});

	// /studio:assets — Asset Pipeline & Manifest Inspector
	(pi as any).registerCommand?.("studio:assets", {
		description: "[Studio] Auditor de pipeline de assets, optimización oxipng y verificación de manifest",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAssets(args, ctx);
		},
	});

	// /assets — Alias de studio:assets
	(pi as any).registerCommand?.("assets", {
		description: "[Studio] Alias de auditor de pipeline de assets y manifest inspector",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAssets(args, ctx);
		},
	});

	// ──────────────────────────────────────────────
	// Hook: Validate git commits
	// Fires on tool_call for git commit commands
	// ──────────────────────────────────────────────
	pi.on("tool_call", async (event, ctx) => {
		if ((event as any)?.toolName === "ask_user_question") {
			playAlertChime();
		}

		if (!isToolCallEventType("bash", event)) return;

		const cmd = event.input.command?.trim() || "";

		// --- Destructive Command Guard ---
		const safetyCheck = validateCommandSafety(cmd);
		if (!safetyCheck.allowed) {
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(
					safetyCheck.reason || "Comando destructivo bloqueado por seguridad del motor",
					"error",
				);
			}
			return { block: true, reason: safetyCheck.reason };
		}

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

		// --- Bounded Edit Surfaces Guard ---
		const surfaceCheck = boundedSurfacesGuard.validate(filePath);
		if (!surfaceCheck.allowed) {
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(
					surfaceCheck.reason || "Edición fuera de las superficies permitidas",
					"error",
				);
			}
			return { block: true, reason: surfaceCheck.reason };
		}

		const skillMatch = filePath.match(/(?:\/skills\/|\.pi\/skills\/)([^/]+)/);

		if (skillMatch) {
			const skillName = skillMatch[1];
			// Advisory only — don't block
			console.log(
				`Reminder: run skill-test to validate ${skillName} after changes.`,
			);
		}

		// Auto-check performance anti-patterns on code files
		const ext = filePath.split(".").pop()?.toLowerCase();
		if (
			ext === "rs" ||
			ext === "gd" ||
			ext === "cs" ||
			ext === "cpp" ||
			ext === "hpp" ||
			ext === "h" ||
			ext === "cc"
		) {
			const content = (event.input as any)?.content;
			const perfRes = auditFilePerformance(
				filePath,
				typeof content === "string" ? content : undefined,
			);
			if (!perfRes.isClean && perfRes.allocationsCount > 0) {
				console.log(
					`\x1b[38;2;253;230;138m◈ PERF ALERT: ${perfRes.allocationsCount} allocations detected in frame loop of ${filePath}\x1b[0m`,
				);
				if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
					(ctx.ui as any).notify(
						`◈ PERF ALERT: ${perfRes.allocationsCount} allocs en frame loop de ${filePath.split("/").pop()}`,
						"warning",
					);
				}
			}
		}

		// Auto-detect production deliveries and update Producer roadmap
		const studioRoot = findStudioRoot(ctx.cwd);
		if (studioRoot) {
			if (
				(filePath.includes("design/") || filePath.includes("docs/")) &&
				filePath.endsWith(".md")
			) {
				const fileName = filePath.split("/").pop()?.replace(".md", "") || "Documento";
				if (fileName.includes("concept") || fileName.includes("brainstorm")) {
					recordFlowCompletion(studioRoot, {
						task: `Concepto aprobado: ${fileName}`,
						agent: "creative-director",
						filesChanged: [filePath],
						nextStep: "Detallar Live Specs de sistemas (/spec)",
					});
				} else if (fileName.includes("art-bible") || filePath.includes("design/art/")) {
					recordFlowCompletion(studioRoot, {
						task: "Identidad visual y biblia de arte completada",
						agent: "art-director",
						filesChanged: [filePath],
						nextStep: "Límites técnicos y ADRs de arquitectura (/arch)",
					});
				} else if (fileName.includes("systems") || fileName.includes("architecture")) {
					recordFlowCompletion(studioRoot, {
						task: `Arquitectura de sistemas definida: ${fileName}`,
						agent: "technical-director",
						filesChanged: [filePath],
						nextStep: "Implementación atómica en motor (/code)",
					});
				} else {
					recordFlowCompletion(studioRoot, {
						task: `Diseño completado: ${fileName}`,
						agent: "game-designer",
						filesChanged: [filePath],
						nextStep: "Implementar en código en paquetes de ~400 líneas (/code)",
					});
				}
				try {
					updateTasksWidget(ctx);
					updateStudioHUD(ctx, pi);
				} catch {}
			}
		}
	});

	// ──────────────────────────────────────────────
	// Hook: Agent turn & language policy enforcement
	// Logs agent calls and injects active language rules & producer guidance
	// ──────────────────────────────────────────────
	const handleAgentTurnStart = async (event: any, ctx: ExtensionContext) => {
		const logDir = join(ctx.cwd, "production", "session-logs");
		await mkdir(logDir, { recursive: true }).catch(() => {});

		const line = `${new Date().toISOString()} | Agent called\n`;
		await appendToFile(join(logDir, "agent-audit.log"), line).catch(() => {});

		// Active language policy enforcement
		const studioRoot = findStudioRoot(ctx.cwd);

		if (studioRoot) {
			const activeLang = getLanguage(studioRoot);
			const setup = inspectSetup(studioRoot);

			if (event?.systemPromptOptions) {
				if (!event.systemPromptOptions.promptGuidelines) {
					event.systemPromptOptions.promptGuidelines = [];
				}

				if (activeLang === "es") {
					event.systemPromptOptions.promptGuidelines.push(
						"Language Policy: The user's active language for this game studio is Spanish (Español). " +
						"You MUST respond, formulate questions, present menus, and guide the user in Spanish at all times unless the user explicitly asks for another language. " +
						"Keep code syntax, keywords, and engine API identifiers in their standard form, but all dialogue, explanations, choices, and recommendations MUST be in natural Spanish."
					);
				}

					// Environment Status & Producer Line Guidance
					if (setup.isConfigured) {
						const { hasRoadmap, state: prodState } = readProducerState(studioRoot);
						const projAudit = auditProject(studioRoot);
						let roadmapDirective = "";
						if (hasRoadmap && prodState?.gameTitle) {
							roadmapDirective = ` Active Project Line: Game="${prodState.gameTitle}", Engine="${prodState.engine || setup.currentEngine}", Milestone="${prodState.milestone || 'In progress'}", Sprint="${prodState.sprint || 'Active'}", InProgress="${prodState.inProgress || 'Development'}", NextStep="${prodState.nextStep || 'Continue development'}".`;
						} else if (projAudit.srcFileCount > 0 && !projAudit.hasConcept) {
							roadmapDirective = ` Active Project Line: Code-First Prototype Phase. The project already has functional starter code in src/ (${projAudit.srcFileCount} source files, engine "${setup.currentEngine}"). Acknowledge that the starter code already exists and is working. Do NOT offer to create a new starter (/studio:new). The immediate next options are: 1. Definir el concepto a partir de este prototipo (/concept), 2. Detallar Live Specs de mecánicas (/spec), o 3. Implementar mecánicas directamente en código (/code).`;
						} else {
							roadmapDirective = " Active Project Line: Concept & Inception phase (no concept doc or prototype yet). In this phase, do NOT suggest downstream tasks like mapping systems or defining an art bible, as those strictly require a concept first. The only valid starting actions are: 1. Brainstorm concept (/concept), 2. Write concept from user premise, or 3. Code-first prototype starter (/studio:new).";
						}

						event.systemPromptOptions.promptGuidelines.push(
							`Studio Environment Status: OK. ${setup.agentsInstalled} agents installed and ready for engine "${setup.currentEngine}".${roadmapDirective} ` +
							"IMPORTANT: The environment is ALREADY fully configured. Do NOT ask the user to configure or run setup again. " +
							"When communicating as or with the Producer, DO NOT ask speculative questions about where the project is at; state the current project line directly."
						);
					} else {
						event.systemPromptOptions.promptGuidelines.push(
							"Studio Environment Status: PENDING SETUP. The project is not configured yet. " +
							"MANDATORY: You MUST NOT print text-based numbered menus asking the user to type '1' or '2'. " +
							"Instead, you MUST immediately call the `ask_user_question` tool to present the setup choice interactively so the user can select with arrow keys and Enter. " +
							"Example tool call: ask_user_question({ questions: [{ question: 'PRODUCER: ¡Bienvenido al estudio! ¿Cómo deseas inicializar el entorno?', options: [{ label: 'Instalación Automática', description: 'Recomendada: motor Godot 4 en modo inherit' }, { label: 'Instalación Manual / Guiada', description: 'Elegir motor (Godot, Unity, Unreal, Bevy, Raylib), idioma y modelos' }] }] })."
						);
					}

					event.systemPromptOptions.promptGuidelines.push(
						"Studio Directory Standard (Single Source of Truth): All game design documents (concept, systems index, mechanics GDDs) MUST be stored strictly in `design/gdd/`, and art specs in `design/art/`. " +
						"The `production/` directory is strictly reserved for production tracking (`production/roadmap.md`, `production/session-logs/`). NEVER create or reference `production/design/`. " +
						"Organic Driven Development (ODD) Sole Workflow: Pi Game Studio operates ONLY under ODD (docs/odd-gamedev-workflow.md). " +
						"Eliminate all traditional SDD / paper bureaucracy (no multi-phase proposal/spec/tasks/verify/archive paperwork). " +
						"Substantial features use a single Live Spec file in `design/gdd/<feature>.md` with tasks implemented atomically (~400 lines per task) and validated directly in the engine (clean compile, FPS, zero allocs). " +
						"Gentle Shell Interaction Standards (High Signal, Low Noise, Zero Bleed): " +
						"- Executive Delivery Principle: NEVER dump internal reasoning, raw 20+ row draft tables, step-by-step pipeline traces, internal phase numbers (e.g. 'Fase 4b', 'Fase 5'), or prompt-gate names into user chat. NEVER mention internal meta-mechanisms like 'no tenemos subagentes disponibles' or 'modo lean' — simply present the proposal and design options directly. " +
						"- Senior Studio Persona: Speak as a seasoned, pragmatic game producer and colleague. Be clear, direct, and constructive. Avoid pedantic jargon or robotic academic speech (e.g. instead of 'el starter es boilerplate puro sinAssets ni GAME FEEL para validar toolchain', say clearly: 'El starter es una base técnica funcional con un cuadrado azul que se mueve; aún no tiene arte ni diversión, pero valida que Bevy compila y responde perfectamente'). " +
						"- Natural Spanish: Express technical ideas fluidly and accessible in Spanish. Don't use dry jargon just for the sake of sounding technical. " +
						"- Elegant Markdown Formatting: Structure your response cleanly using natural, polished GitHub-flavored Markdown. Use clean headings, concise bullet points, and high-contrast bold highlights. Speak fluidly as a lead dev and producer. " +
						"- FOSS CLI Toolchain Acceleration: When generating or handling assets or builds, utilize the installed CLI tools directly via bash: `magick` (spritesheets & atlas), `oxipng` (lossless PNG compression), `ffmpeg` (audio normalization/conversion to .ogg), `sox` (audio DSP), `assimp` (3D conversion to .glb), `wasm-opt` (WASM optimization), `butler` (itch.io delta publishing), `gh` (GitHub releases/PRs), and `watchexec` (live-reload). If a tool is missing, recommend `/studio:tools`. " +
						"- Interactive Question Protocol (Mandatory Native Menus): You have access to the unified tool `ask_user_question` (for 1 decision or up to 4 questions in a single batch). " +
						"When you need decisions from the user (such as design trade-offs, architecture choices, or setup steps: motor, idioma, modelos, alcance), " +
						"DO NOT print text blocks asking the user to type '1' or '2'. " +
						"Always call `ask_user_question({ questions: [...] })`. " +
						"Pi will present each question interactively in sequence with arrow keys (↑/↓) and Enter, including an automatic 'Otro (escribir respuesta personalizada)...' option for custom free-text input, and return all answers in a single result. " +
						"- Subagent Delegation Protocol (Gentle Shell Execution): You have access to the native tool `subagent_run`. " +
						"Ideation, brainstorming, user dialogue, and question formulation MUST happen INLINE in this parent session — do NOT spawn subagents for mere chat or high-level concept discussions. " +
						"Delegate ONLY concrete, heavy implementation tasks (writing code, generating complex assets, auditing code, running tests) to specialized agents using `subagent_run({ agent: '<agent_name>', task: '<concrete_task>', mode: 'task' })`. " +
						"CRITICAL RULE: NEVER print raw tool invocation syntax in conversational chat (e.g. NEVER output 'ask_user_question questions=[...]' or 'subagent_run agent=...'). " +
						"Tool calls MUST be executed strictly as real tool calls. Conversational chat must contain only clean, executive prose and markdown. " +
						"Flow Completion Protocol: When any specialist finishes a task (design doc, mechanic, art asset, code review), the Producer immediately closes the loop: " +
						"1. Acknowledges the completed item and updates the production roadmap line. " +
						"2. Declares the next concrete step in the sprint and hands off to the next specialist directly without asking what to do next. " +
						"If the user greets (e.g. 'hola', 'buenas'), acknowledge the OK environment in 1 polite sentence, state the current project state, and present the immediate next options cleanly. " +
						"- Game Engine Performance Guard: Zero allocations in frame loops (update, _process, FixedUpdate). Avoid .clone(), Box::new, malloc, new, or blocking I/O on the main thread."
					);
			}
		}

		try {
			updateStudioHUD(ctx, pi);
			updateTasksWidget(ctx);
			installSubagentsWidget(ctx);
			updateSubagentsWidget(ctx);
		} catch {}
	};

	pi.on("turn_start", handleAgentTurnStart);
	(pi as any).on?.("before_agent_start", handleAgentTurnStart);
	(pi as any).on?.("turn_end", async (_event: any, ctx: any) => {
		try {
			updateStudioHUD(ctx, pi);
			updateTasksWidget(ctx);
			updateSubagentsWidget(ctx);
		} catch {}
	});
	(pi as any).on?.("model_change", async (_event: any, ctx: any) => {
		try {
			updateStudioHUD(ctx, pi);
		} catch {}
	});

	// ──────────────────────────────────────────────
	// Hook: Session start (banner + gap detection)
	// Fires on session_start to show studio dashboard and check docs
	// ──────────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		const studioRoot = findStudioRoot(ctx.cwd);

		// Only run in the game-studio project context
		if (!studioRoot) return;

		// Raw terminal input listener for Double-Escape emergency guard
		if ((ctx as any).hasUI && typeof (ctx as any).ui?.onTerminalInput === "function") {
			(ctx as any).ui.onTerminalInput((data: string) => {
				if (data === "\x1b") {
					doubleEscapeGuard.handleEscape(ctx);
				}
			});
		}

		// Mount header banner cleanly via TUI
		try {
			if ((ctx as any).hasUI && (ctx as any).ui?.setHeader) {
				(ctx as any).ui.setHeader((_tui: any, _theme: any) => ({
					render(width: number) {
						return renderBanner(width, studioRoot);
					},
					invalidate() {},
				}));
			}

			// Install Studio Footer Bar (Model, Context Gauge, Engine, Sprint)
			updateStudioHUD(ctx, pi);
			// Mount Live Tasks Widget (only if active tasks exist)
			updateTasksWidget(ctx);

			// Ensure local project theme and tuiMode (fullscreen) are initialized if unconfigured
			const localSettingsPath = join(studioRoot, ".pi", "settings.json");
			if (existsSync(localSettingsPath)) {
				try {
					const parsed = JSON.parse(readFileSync(localSettingsPath, "utf8"));
					let changed = false;
					if (!parsed.theme) {
						parsed.theme = "GameStudio-Gentle";
						changed = true;
					}
					if (!parsed.tuiMode) {
						parsed.tuiMode = "fullscreen";
						changed = true;
					}
					if (changed) {
						writeFileSync(localSettingsPath, JSON.stringify(parsed, null, 2), "utf8");
					}
				} catch {}
			}
		} catch {}

		const gaps: string[] = [];

		// Check 1: Code without design docs
		const srcExists = existsSync(join(studioRoot, "src"));
		const designExists = existsSync(join(studioRoot, "design", "gdd"));

		if (srcExists) {
			let srcCount = 0;
			try {
				const dir = await opendir(join(studioRoot, "src"));
				for await (const _ of dir) srcCount++;
			} catch {}

			let designCount = 0;
			if (designExists) {
				try {
					const dir = await opendir(join(studioRoot, "design", "gdd"));
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
		const protoExists = existsSync(join(studioRoot, "prototypes"));
		if (protoExists) {
			try {
				const dir = await opendir(join(studioRoot, "prototypes"));
				for await (const entry of dir) {
					if (entry.isDirectory()) {
						const protoDir = join(studioRoot, "prototypes", entry.name);
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
			existsSync(join(studioRoot, "src", "core")) ||
			existsSync(join(studioRoot, "src", "engine"));
		const archExists = existsSync(join(studioRoot, "docs", "architecture"));

		if (coreExists && !archExists) {
			gaps.push(
				"Core systems exist but no docs/architecture/ directory. Start with /architecture-decision.",
			);
		}

		if (gaps.length > 0) {
			(ctx as any).ui?.notify?.(`Documentation gaps found: ${gaps.length}`, "info");
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
