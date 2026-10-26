import { YELLOW, resolveStudioTheme } from "./studio-palette.ts";
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
import { formatStudioToolDiagnostics, hasStudioTool, listStudioTools } from "./studio-tool-registry.ts";
import { registerAskUserQuestion } from "./studio-choice.ts";
import { studioAgentsRunner, usageToTokens } from "./studio-agents-runner.ts";
import { recordFailure } from "./studio-diagnostics.ts";
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
import { handleStudioJam, isJamModeActive } from "./studio-jam.ts";
import { handleStudioBudget, recordTokenUsage } from "./studio-budget.ts";
import { handleStudioTimeline } from "./studio-timeline.ts";
import { handleStudioMarket } from "./studio-market.ts";
import { handleStudioScaffold } from "./studio-scaffold.ts";
import { handleStudioGameFeel } from "./studio-game-feel.ts";
import { handleStudioCapsule } from "./studio-capsule.ts";
import { handleStudioSteamPage } from "./studio-steam-page.ts";
import { handleStudioAudioBus } from "./studio-audio-bus.ts";
import { handleStudioContinuity } from "./studio-continuity.ts";
import { handleStudioTuning } from "./studio-tuning.ts";
import { handleStudioPlay } from "./studio-play.ts";
import { handleStudioFeature } from "./studio-feature.ts";

export default function (pi: ExtensionAPI) {
	// ──────────────────────────────────────────────
	// Native Studio Subagent Tools (Gentle Architecture)
	// ──────────────────────────────────────────────
	registerStudioSubagentTools(pi);
	registerAskUserQuestion(pi);

	// A specialist is an isolated process, so memory is the only channel that
	// outlives it. Whether the provider exists is the host's answer, not the
	// studio's assumption: the runner asks here and grants or strips accordingly.
	studioAgentsRunner.setToolProbe((name: string) => hasStudioTool(pi, name));

	// The deny baseline needs the runtime's whole tool inventory to derive the
	// complement of a `deny: ["*"]` template; same activation-time pattern as the
	// tool probe above, because the singleton predates the extension API.
	studioAgentsRunner.setToolInventory(() => listStudioTools(pi));

	// ──────────────────────────────────────────────
	// Audio Notifications & Chimes (Gentle Shell Sound Alerts)
	// ──────────────────────────────────────────────
	studioAgentsRunner.subscribe((task) => {
		if (task.status === "completed") {
			playSuccessChime();
			boundedSurfacesGuard.clearTask(task.id);
			const tokens = usageToTokens(task);
			recordTokenUsage(task.agent, task.model || "inherit", tokens.input, tokens.output);
		} else if (task.status === "failed") {
			playErrorChime();
			boundedSurfacesGuard.clearTask(task.id);
		} else if (task.status === "cancelled") {
			boundedSurfacesGuard.clearTask(task.id);
		} else if (task.status === "running" && task.task) {
			boundedSurfacesGuard.setFromTask(task.task, task.id);
		}
	});

	// ──────────────────────────────────────────────
	// Session Lifecycle (Specialist Cleanup)
	// Pi emits no abort event at all: session_abort, turn_abort and agent_abort
	// never fired, so cancelling on Escape is wired through the turn's own
	// AbortSignal below, next to the shutdown hook.
	// ──────────────────────────────────────────────
	pi.on("session_shutdown", () => {
		const cancelled = studioAgentsRunner.cancelAll("Sesión del estudio cerrada");
		if (cancelled > 0) {
			console.log(`[studio] ${cancelled} especialista(s) cancelados al cerrar la sesión.`);
		}
	});

	// Cancelling a turn cancels what it dispatched: Pi exposes no abort event, so the
	// turn's own AbortSignal is the authority. One listener per turn, auto-removed.
	pi.on("turn_start", (_event, ctx) => {
		ctx.signal?.addEventListener(
			"abort",
			() => studioAgentsRunner.cancelAll("Turno abortado por el usuario (Escape)"),
			{ once: true },
		);
	});

	// ──────────────────────────────────────────────
	// Studio Suite Commands (Namespace: studio:*)
	// ──────────────────────────────────────────────

	// /studio — Hub principal y catálogo
	pi.registerCommand("studio", {
		description: "[Studio] Explorador y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// /studio:start — Asistente interactivo de inicio y onboarding
	pi.registerCommand("studio:start", {
		description: "[Studio] Asistente interactivo de inicio y onboarding de tu juego",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStart(args, ctx);
		},
	});

	// /start — Alias directo de inicio y onboarding
	pi.registerCommand("start", {
		description: "[Studio] Asistente interactivo de inicio y onboarding de tu juego",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStart(args, ctx);
		},
	});

	// /studio:setup — Asistente interactivo de instalación y actualización
	pi.registerCommand("studio:setup", {
		description: "[Studio] Asistente interactivo de instalación, verificación y actualización del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSetup(args, ctx);
		},
	});

	// /setup — Alias directo de instalación y actualización
	pi.registerCommand("setup", {
		description: "[Studio] Asistente interactivo de instalación, verificación y actualización del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSetup(args, ctx);
		},
	});

	// /studio:new — Crear nuevo juego desde plantilla o starter
	pi.registerCommand("studio:new", {
		description: "[Studio] Crear nuevo proyecto desde plantilla/starter (Bevy, Raylib, Godot)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioNew(args, ctx);
		},
	});

	// /studio:models — Asignación interactiva de modelos por nivel
	pi.registerCommand("studio:models", {
		description: "[Studio] Configuración interactiva de modelos de IA por nivel de agente",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioModels(args, ctx);
		},
	});

	// /studio:status — Dashboard y diagnóstico en vivo
	pi.registerCommand("studio:status", {
		description: "[Studio] Dashboard en vivo de estado, agentes y métricas del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStatus(args, ctx);
		},
	});

	// /status — Alias directo del dashboard de estado del estudio
	pi.registerCommand("status", {
		description: "[Studio] Dashboard en vivo de estado, agentes y métricas del estudio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioStatus(args, ctx);
		},
	});

	// /studio:changes — Clasificación de cambios gamedev (Gentle Changes)
	pi.registerCommand("studio:changes", {
		description: "[Studio] Clasificación de cambios pendientes en diseño, código, assets y drift de ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChanges(args, ctx);
		},
	});

	// /changes — Alias directo de clasificación de cambios gamedev (Gentle Changes)
	pi.registerCommand("changes", {
		description: "[Studio] Clasificación de cambios pendientes en diseño, código, assets y drift de ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChanges(args, ctx);
		},
	});

	// /studio:sound — Activar o desactivar notificaciones de audio (on/off)
	pi.registerCommand("studio:sound", {
		description: "[Studio] Activar o desactivar notificaciones de audio del estudio (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSound(args, ctx);
		},
	});

	// /sound — Alias de notificaciones de audio (on/off)
	pi.registerCommand("sound", {
		description: "[Studio] Activar o desactivar notificaciones de audio del estudio (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSound(args, ctx);
		},
	});

	// /studio:tasks — Gestión de tareas y radar de obsolescencia (Gentle Todo)
	pi.registerCommand("studio:tasks", {
		description: "[Studio] Gestión de tareas del sprint, Live Specs y radar de tareas obsoletas (Stale)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTasks(args, ctx);
		},
	});

	// /tasks — Alias directo de gestión de tareas y radar de obsolescencia
	pi.registerCommand("tasks", {
		description: "[Studio] Gestión de tareas del sprint, Live Specs y radar de tareas obsoletas (Stale)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTasks(args, ctx);
		},
	});

	// /studio:agents — Visor e inspector en vivo de actividad y logs de subagentes
	pi.registerCommand("studio:agents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /agents — Alias directo del visor e inspector en vivo de subagentes
	pi.registerCommand("agents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:roster — Navegador del catálogo de los 14 agentes del estudio
	pi.registerCommand("studio:roster", {
		description: "[Studio] Navegador interactivo de los 14 agentes oficiales (8 Core + 6 Especialistas de motor)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAgents(args, ctx);
		},
	});

	// /studio:chains — Cadenas multi-agente guiadas
	pi.registerCommand("studio:chains", {
		description: "[Studio] Cadenas de ejecución multi-agente para GDD, mecánicas y release",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChains(args, ctx);
		},
	});

	// /studio:chain — Alias singular de cadenas
	pi.registerCommand("studio:chain", {
		description: "[Studio] Cadenas de ejecución multi-agente para GDD, mecánicas y release",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioChains(args, ctx);
		},
	});

	// /studio:settings — Configuración interactiva del proyecto
	pi.registerCommand("studio:settings", {
		description: "[Studio] Configuración interactiva del proyecto (motor, plataformas, idioma)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSettings(args, ctx);
		},
	});

	// /studio:doctor — Diagnóstico de prerrequisitos de compilación y motor
	pi.registerCommand("studio:doctor", {
		description: "[Studio] Diagnóstico de prerrequisitos, herramientas y compiladores del motor de juego",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioDoctor(args, ctx);
		},
	});

	// /studio:web — Compilar y servir versión Web/WASM en el navegador
	pi.registerCommand("studio:web", {
		description: "[Studio] Compilar versión WebAssembly y lanzar servidor local con aislamiento COOP/COEP",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWeb(ctx, args);
		},
	});

	// /studio:profile — Live Performance Profiler & Budget Tracker
	pi.registerCommand("studio:profile", {
		description: "[Studio] Live Performance Profiler y monitor de presupuestos de FPS/Memoria",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioProfile(args, ctx);
		},
	});

	// /studio:sfx — Sintetizador procedural de audio SFX
	pi.registerCommand("studio:sfx", {
		description: "[Studio] Sintetizador procedural de audio WAV (ondas sine/square/saw/noise y ADSR)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSfx(args, ctx);
		},
	});

	// /studio:palettes — Generador de paletas de color y shaders
	pi.registerCommand("studio:palettes", {
		description: "[Studio] Generador de paletas retro y shaders cuantizadores para Godot y Raylib",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPalettes(args, ctx);
		},
	});

	// /studio:commands — Paleta curada de comandos del estudio
	pi.registerCommand("studio:commands", {
		description: "[Studio] Paleta curada y búsqueda rápida de comandos y herramientas del estudio",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// /palette — Paleta difusa de comandos interactiva (Alt+K)
	pi.registerCommand("palette", {
		description: "[Studio] Paleta difusa de comandos interactiva (Alt+K)",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// Shortcut Alt+K — Abre la paleta de comandos
	pi.registerShortcut("alt+k", {
		description: "[Studio] Paleta difusa de comandos",
		handler: async (ctx: ExtensionContext) => {
			await showCommandPalette(ctx);
		},
	});

	// /studio:toggle-art — Alternar ilustración Braille en el banner de bienvenida
	pi.registerCommand("studio:toggle-art", {
		description: "[Studio] Alternar ilustración Braille de bienvenida (on/off)",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const root = findStudioRoot(ctx.cwd) || ctx.cwd;
			const current = isArtEnabled(root);
			setArtEnabled(root, !current);
			const newState = !current ? "activada" : "desactivada";
			ctx.ui?.setHeader?.((_tui: any, theme: any) => {
				const role = resolveStudioTheme(theme);
				return {
					render(width: number) {
						return renderBanner(width, ctx.cwd, role);
					},
					invalidate() {},
				};
			});
			ctx.ui?.notify?.(`Ilustración de Gamepad ${newState}.`, "info");
		},
	});

	// /studio:art — Alias de toggle-art
	pi.registerCommand("studio:art", {
		description: "[Studio] Alternar ilustración Braille de bienvenida (on/off)",
		handler: async (args: string, ctx: ExtensionContext) => {
			const root = findStudioRoot(ctx.cwd) || ctx.cwd;
			const current = isArtEnabled(root);
			setArtEnabled(root, !current);
			const newState = !current ? "activada" : "desactivada";
			ctx.ui?.setHeader?.((_tui: any, theme: any) => {
				const role = resolveStudioTheme(theme);
				return {
					render(width: number) {
						return renderBanner(width, ctx.cwd, role);
					},
					invalidate() {},
				};
			});
			ctx.ui?.notify?.(`Ilustración de Gamepad ${newState}.`, "info");
		},
	});

	// /studio:subagents — Visor e inspector en vivo de logs y actividades de subagentes
	pi.registerCommand("studio:subagents", {
		description: "[Studio] Visor e inspector en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:mcp — Gestor interactivo de los 10 Servidores MCP del Estudio
	pi.registerCommand("studio:mcp", {
		description: "[Studio] Hub interactivo de los 10 servidores MCP (REA, Playwright, Context7, Blender, etc.)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioMcp(args, ctx);
		},
	});

	// /studio:tools — Diagnóstico de viabilidad e instalador de herramientas multimedia CLI (FFmpeg, ImageMagick, Assimp, gltfpack)
	pi.registerCommand("studio:tools", {
		description: "[Studio] Diagnóstico de viabilidad e instalador interactivo de herramientas multimedia CLI",
		handler: async (_args: string, ctx: ExtensionContext) => {
			await promptMediaToolsInstall(ctx);
		},
	});

	// /studio:logs — Alias de inspección en vivo de subagentes
	pi.registerCommand("studio:logs", {
		description: "[Studio] Alias de inspección en vivo de logs, herramientas y actividad de subagentes",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSubagentsViewer(args, ctx);
		},
	});

	// /studio:help — Alias de ayuda
	pi.registerCommand("studio:help", {
		description: "[Studio] Ayuda rápida y catálogo de comandos de Pi Game Studio",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCommand(args, ctx);
		},
	});

	// /studio:perf-guard — Auditor de rendimiento y detección de allocs en frame loops
	pi.registerCommand("studio:perf-guard", {
		description: "[Studio] Auditor de rendimiento y detección de allocs en frame loops (Rust, GDScript, C++, C#)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPerfAudit(args, ctx);
		},
	});

	// /perf-guard — Alias de studio:perf-guard
	pi.registerCommand("perf-guard", {
		description: "[Studio] Alias de auditor de rendimiento y allocaciones en frame loops",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPerfAudit(args, ctx);
		},
	});

	// /studio:watch — Live Engine Hot-Reload & Watcher
	pi.registerCommand("studio:watch", {
		description: "[Studio] Live engine watcher y compilación en segundo plano (cargo check, godot, cmake)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWatch(args, ctx);
		},
	});

	// /watch — Alias de studio:watch
	pi.registerCommand("watch", {
		description: "[Studio] Alias de live engine watcher y hot-reload en segundo plano",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioWatch(args, ctx);
		},
	});

	// /studio:assets — Asset Pipeline & Manifest Inspector
	pi.registerCommand("studio:assets", {
		description: "[Studio] Auditor de pipeline de assets, optimización oxipng y verificación de manifest",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAssets(args, ctx);
		},
	});

	// /assets — Alias de studio:assets
	pi.registerCommand("assets", {
		description: "[Studio] Alias de auditor de pipeline de assets y manifest inspector",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAssets(args, ctx);
		},
	});

	// /studio:jam — Alternar modo Game Jam / Rapid Prototyping
	pi.registerCommand("studio:jam", {
		description: "[Studio] Alternar modo Game Jam / Rapid Prototyping (relaja perf-guard y acelera iteración)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioJam(args, ctx);
		},
	});

	// /jam — Alias de studio:jam
	pi.registerCommand("jam", {
		description: "[Studio] Alias de modo Game Jam / Rapid Prototyping",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioJam(args, ctx);
		},
	});

	// /studio:budget — Monitor de tokens y presupuesto estimado en USD
	pi.registerCommand("studio:budget", {
		description: "[Studio] Monitor de consumo de tokens y presupuesto estimado en USD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioBudget(args, ctx);
		},
	});

	// /budget — Alias de studio:budget
	pi.registerCommand("budget", {
		description: "[Studio] Alias de monitor de presupuesto y tokens",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioBudget(args, ctx);
		},
	});

	// /studio:timeline — Línea de tiempo de producción y registro histórico de decisiones
	pi.registerCommand("studio:timeline", {
		description: "[Studio] Línea de tiempo de producción, hitos y registro histórico de decisiones (ADRs y Specs)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTimeline(args, ctx);
		},
	});

	// /timeline — Alias de studio:timeline
	pi.registerCommand("timeline", {
		description: "[Studio] Alias de línea de tiempo de producción",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTimeline(args, ctx);
		},
	});

	// /studio:market — Steam Reality Check y validación de viabilidad comercial
	pi.registerCommand("studio:market", {
		description: "[Studio] Steam Reality Check y validación de viabilidad comercial en Steam",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioMarket(args, ctx);
		},
	});

	// /market — Alias de studio:market
	pi.registerCommand("market", {
		description: "[Studio] Alias de Steam Reality Check y auditoría de mercado",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioMarket(args, ctx);
		},
	});

	// /studio:scaffold — Generador de sandbox jugable según motor activo (2D/3D)
	pi.registerCommand("studio:scaffold", {
		description: "[Studio] Generador de sandbox jugable según motor activo (2D/3D)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioScaffold(args, ctx);
		},
	});

	// /scaffold — Alias de studio:scaffold
	pi.registerCommand("scaffold", {
		description: "[Studio] Alias de sandbox jugable según motor activo",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioScaffold(args, ctx);
		},
	});

	// /studio:game-feel — Auditor estático de Game Feel y respuesta de control
	pi.registerCommand("studio:game-feel", {
		description: "[Studio] Auditor estático de Game Feel y respuesta de control (5 pilares)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioGameFeel(args, ctx);
		},
	});

	// /game-feel — Alias de studio:game-feel
	pi.registerCommand("game-feel", {
		description: "[Studio] Alias de auditoría de Game Feel y respuesta de control",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioGameFeel(args, ctx);
		},
	});

	// /studio:capsule — Auditor de portadas y cápsulas de Steamworks (231x87, 460x215, etc.)
	pi.registerCommand("studio:capsule", {
		description: "[Studio] Auditor de portadas y cápsulas de Steamworks (231x87, 460x215, etc.)",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCapsule(args, ctx);
		},
	});

	// /capsule-check — Alias de studio:capsule
	pi.registerCommand("capsule-check", {
		description: "[Studio] Alias de auditoría de cápsulas de Steamworks",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioCapsule(args, ctx);
		},
	});

	// /studio:steam-page — Generador de ficha de Steamworks en BBCode oficial
	pi.registerCommand("studio:steam-page", {
		description: "[Studio] Generador de ficha de Steamworks en BBCode oficial",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSteamPage(args, ctx);
		},
	});

	// /steam-page — Alias de studio:steam-page
	pi.registerCommand("steam-page", {
		description: "[Studio] Alias de generador de ficha de Steamworks",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioSteamPage(args, ctx);
		},
	});

	// /studio:audio-bus — Scaffolding de jerarquía de buses de audio profesionales con ducking
	pi.registerCommand("studio:audio-bus", {
		description: "[Studio] Scaffolding de jerarquía de buses de audio profesionales con ducking",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAudioBus(args, ctx);
		},
	});

	// /audio-bus — Alias de studio:audio-bus
	pi.registerCommand("audio-bus", {
		description: "[Studio] Alias de scaffolding de buses de audio profesionales",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioAudioBus(args, ctx);
		},
	});

	// /studio:continuity — Fast-forward pipeline de continuidad entre tareas atómicas
	pi.registerCommand("studio:continuity", {
		description: "[Studio] Fast-forward pipeline de continuidad entre tareas atómicas ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioContinuity(args, ctx);
		},
	});

	// /studio:next — Alias de studio:continuity
	pi.registerCommand("studio:next", {
		description: "[Studio] Ejecutar o inspeccionar la siguiente tarea atómica en cola ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioContinuity(args, ctx);
		},
	});

	// /next — Alias directo de studio:next
	pi.registerCommand("next", {
		description: "[Studio] Alias para avanzar a la siguiente tarea atómica en cola",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioContinuity(args, ctx);
		},
	});

	// /studio:tuning — Inspector y calibrador interactivo de variables de balance y Game Feel
	pi.registerCommand("studio:tuning", {
		description: "[Studio] Inspector y calibrador de variables de balance y Game Feel en YAML",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTuning(args, ctx);
		},
	});

	// /tuning — Alias de studio:tuning
	pi.registerCommand("tuning", {
		description: "[Studio] Alias de calibrador de balance de gameplay",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioTuning(args, ctx);
		},
	});

	// /studio:play — Runner unificado de ejecución y previsualización del juego
	pi.registerCommand("studio:play", {
		description: "[Studio] Runner de ejecución supervisada y previsualización del motor",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPlay(args, ctx);
		},
	});

	// /play — Alias de studio:play
	pi.registerCommand("play", {
		description: "[Studio] Alias para ejecutar el juego en runtime o preview",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioPlay(args, ctx);
		},
	});

	// /studio:feature — Generador guiado de Live Specs ODD en design/gdd/ con tareas T1-TN
	pi.registerCommand("studio:feature", {
		description: "[Studio] Generador guiado de Live Specs ODD en design/gdd/ con tareas T1-TN",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioFeature(args, ctx);
		},
	});

	// /feature — Alias de studio:feature
	pi.registerCommand("feature", {
		description: "[Studio] Alias para crear un Live Spec ODD",
		handler: async (args: string, ctx: ExtensionContext) => {
			await handleStudioFeature(args, ctx);
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

		// Track tool call input tokens in session budget
		const toolInputLen = JSON.stringify(event.input || {}).length;
		if (toolInputLen > 0) {
			recordTokenUsage("tool", "system", Math.ceil(toolInputLen / 4), 0);
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
			const jamActive = isJamModeActive(findStudioRoot(ctx.cwd) || ctx.cwd);
			if (!perfRes.isClean && perfRes.allocationsCount > 0) {
				if (jamActive) {
					console.log(
						`${YELLOW}[JAM MODE] Soft Perf Warning: ${perfRes.allocationsCount} allocations detected in frame loop of ${filePath} (blocking bypassed for rapid prototyping)\x1b[0m`,
					);
					if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
						(ctx.ui as any).notify(
							`[JAM MODE] Soft Perf Warning: ${perfRes.allocationsCount} allocs en frame loop (no bloqueante)`,
							"warning",
						);
					}
				} else {
					console.log(
						`${YELLOW}PERF ALERT: ${perfRes.allocationsCount} allocations detected in frame loop of ${filePath}\x1b[0m`,
					);
					if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
						(ctx.ui as any).notify(
							`PERF ALERT: ${perfRes.allocationsCount} allocs en frame loop de ${filePath.split("/").pop()}`,
							"warning",
						);
					}
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
			const jamActive = isJamModeActive(studioRoot);

			if (event?.systemPromptOptions) {
				if (!event.systemPromptOptions.promptGuidelines) {
					event.systemPromptOptions.promptGuidelines = [];
				}

				if (jamActive) {
					event.systemPromptOptions.promptGuidelines.push(
						"⚡ GAME JAM / RAPID PROTOTYPING MODE IS ACTIVE: Maximum iteration velocity is prioritized. " +
						"Silence non-critical confirmation prompts, bypass formalities, and focus immediately on producing working, playable gameplay. " +
						"Strict performance guard budgets are relaxed into soft warnings for rapid prototyping. Move fast and iterate."
					);
				}

				if (activeLang === "es") {
					event.systemPromptOptions.promptGuidelines.push(
						"Language Policy & Persona (Gentle Shell Neutral Mode): " +
						"The user's active language for this game studio is Spanish (Español). " +
						"You MUST respond, formulate questions, present menus, and guide the user in Neutral/Professional Spanish. " +
						"Use standard professional tuteo ('tú tienes', 'haz', 'revisa'). Do NOT use voseo ('vos tenés', 'hacé', 'andá') or regional slang. " +
						"Keep code syntax, keywords, and engine API identifiers in standard English nomenclature. " +
						"STRICT ANTI-SYCOPHANCY (Zero Flattery): NEVER open with empty praise, compliments, or conversational filler (e.g. NEVER say 'Buena pregunta', 'Excelente idea', '¡Claro que sí!'). Go directly to the engineering analysis or solution. " +
						"STRICT ANTI-CONDESCENSION: NEVER talk down to the user with paternalistic phrases like 'te lo traduzco a lenguaje llano', 'te lo explico fácil', or 'para que entiendas'. The user is the lead game developer; treat them as a peer senior engineer and director. " +
						"STRICT ZERO EMOJIS: Do NOT use emojis (no 🙂, 🚀, 🎮, etc.) anywhere in conversational chat, headers, or menus. Keep the CLI sober, clean, and focused on game engineering."
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

						const agentsReadyCount = setup.agentsInstalled > 0 ? setup.agentsInstalled : setup.expectedAgents;
						event.systemPromptOptions.promptGuidelines.push(
							`Studio Environment Status: OK. ${agentsReadyCount} agents installed and ready for engine "${setup.currentEngine}".${roadmapDirective} ` +
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
						"- Executive Delivery Principle (Zero Bleed): NEVER dump internal reasoning, self-instructions, preparation notes (e.g. NEVER output lines like '- IMMEDIATELY call ask_user_question', 'Let me prepare the response in clean Spanish...', or planning monologues), raw 20+ row draft tables, step-by-step pipeline traces, internal phase numbers (e.g. 'Fase 4b', 'Fase 5'), or prompt-gate names into user chat. Your conversational output MUST BEGIN DIRECTLY with your dialogue or greeting. NEVER mention internal meta-mechanisms like 'no tenemos subagentes disponibles' or 'modo lean' — simply present the proposal and design options directly. " +
						"- Senior Studio Persona (Gentle Shell Neutral Protocol): Direct, technical, concise, warm, and professional. Concepts before code, no shortcuts. Push back constructively when a request lacks context, inflates scope, or threatens milestone deadlines, FPS, or memory allocations. Correct errors directly, explain why, and show the better path. " +
						"- Professional Neutral Spanish: Clear, rigorous technical Spanish without regionalisms, slang, or voseo. Speak peer-to-peer without condescension, without flattery, and with zero emojis. " +
						"- Elegant Markdown Formatting: Structure your response cleanly using natural, polished GitHub-flavored Markdown. Use clean headings, concise bullet points, and high-contrast bold highlights. Speak fluidly as a lead dev and producer. " +
						"- FOSS CLI Toolchain Acceleration: When generating or handling assets or builds, utilize the installed CLI tools directly via bash: `magick` (image manipulation), `oxipng` (lossless PNG compression), `pngquant` (8-bit alpha quantization), `free-tex-packer-cli` (atlas/spritesheets with JSON metadata), `gltf-transform` (3D mesh inspection & polygon audit), `gltfpack` (meshopt 3D GPU optimization), `assimp` (fast 3D to GLB conversion), `ffmpeg` (audio normalization/conversion to .ogg), `wasm-opt` (WASM optimization), `butler` (itch.io delta publishing), `gh` (GitHub releases/PRs), and `watchexec` (live-reload). If a tool is missing, recommend `/studio:tools`. " +
						"- 2D vs 3D Pipeline Guidance: Check `project.yaml` for dimension (`2d` or `3d`). When the project is 2D, prioritize `free-tex-packer-cli`, `oxipng`, `TileMaps`, and 2D sprite physics. When the project is 3D, prioritize `gltf-transform inspect` to audit polygon budgets, `gltfpack` for GPU LODs/compression, and adopt the Graybox CSG -> Modular Kits methodology. " +
						"- Interactive Question Protocol (Mandatory Native Menus): You have access to the unified tool `ask_user_question` (for 1 decision or up to 4 questions in a single batch). " +
						"Execution Flow & Task Continuity: An authorized feature or sprint includes its planned atomic tasks. " +
						"Do NOT halt execution after every routine task to invent artificial dilemmas or force interactive selection menus. " +
						"When a task is completed and the next step is already clear in `production/roadmap.md` or the Live Spec (`design/gdd/<feature>.md`), simply report the result concisely (1-2 sentences with compilation/test status) and proceed with the next task, or state the clear next step naturally in conversational prose. " +
						"When presenting pending tasks or sprint queues, present them cleanly in GitHub-flavored Markdown checklists (`- [x] T1: ...`, `- [ ] T2: ...`). " +
						"Situational Decision Capture: Use `ask_user_question` EXCLUSIVELY when there is an authentic, non-trivial architectural dilemma, a design fork (e.g. mutually exclusive mechanics, engine choices, data formats), or a scope arbitration where user input is truly required. " +
						"NEVER use `ask_user_question` for simple greetings, routine status updates, or obvious sequential task transitions. " +
						"When an authentic decision IS required: provide a brief, natural rationale in chat (the context, trade-offs between options, and your expert lead recommendation), and launch `ask_user_question({ questions: [...] })` with clean, non-redundant options so the user can select with arrow keys and Enter. " +
						"NEVER print numbered text lists (1, 2, 3...) asking the user to type numbers. When no decision is required, converse naturally without forcing menus. " +
						"- Subagent Delegation Protocol (Gentle Shell Execution): You have access to the native tool `subagent_run`. " +
						"Ideation, brainstorming, user dialogue, and question formulation MUST happen INLINE in this parent session — do NOT spawn subagents for mere chat or high-level concept discussions. " +
						"Delegate ONLY concrete, heavy implementation tasks (writing code, generating complex assets, auditing code, running tests) to specialized agents using `subagent_run({ agent: '<agent_name>', task: '<concrete_task>', mode: 'task' })`. " +
						"CRITICAL RULE: NEVER print raw tool invocation syntax in conversational chat (e.g. NEVER output 'ask_user_question questions=[...]' or 'subagent_run agent=...'). " +
						"Tool calls MUST be executed strictly as real tool calls. Conversational chat must contain only clean, executive prose and markdown. " +
						"Studio Identity & Warm Greeting Protocol: You are the Producer of Pi Game Studio, the lead orchestrator working alongside the user. " +
						"Speak with warmth, collegial pride, and technical clarity (cálido, cercano, profesional y con identidad propia). " +
						"Never talk like an automated machine or dump cold system logs (e.g. NEVER start with 'Entorno del estudio operativo: 9 agentes listos...'). " +
						"When the user greets (e.g. 'hola', 'buenas') or starts a turn: " +
						"1. Greet warmly as the Producer (e.g. '¡Hola! Soy el Producer de tu estudio.'). " +
						"2. Share the current state of the game in 1-2 natural, human sentences (e.g. 'Tenemos todo listo con el proyecto. Estamos en pleno Sprint 1 y el siguiente paso en el roadmap es T4.'). " +
						"3. Ask naturally how they would like to proceed. Do NOT force an interactive question menu unless the user explicitly requests choices or there is a real blocking decision. " +
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
	pi.on("before_agent_start", handleAgentTurnStart);
	pi.on("turn_end", async (event: any, ctx: any) => {
		try {
			if (event?.usage || (event as any)?.tokens) {
				const usage = event?.usage || (event as any)?.tokens;
				const inT = usage?.inputTokens ?? usage?.prompt_tokens ?? usage?.input ?? 0;
				const outT = usage?.outputTokens ?? usage?.completion_tokens ?? usage?.output ?? 0;
				const cacheT = usage?.cacheReadTokens ?? usage?.cache_tokens ?? usage?.cache ?? 0;
				const modelId = (ctx as any)?.model?.id || (ctx as any)?.model || "inherit";
				if (inT > 0 || outT > 0) {
					recordTokenUsage("parent", modelId, inT, outT, cacheT);
				}
			}
			updateStudioHUD(ctx, pi);
			updateTasksWidget(ctx);
			updateSubagentsWidget(ctx);
		} catch {}
	});
	pi.on("model_select", async (_event: any, ctx: any) => {
		try {
			updateStudioHUD(ctx, pi);
		} catch {}
	});

	// ──────────────────────────────────────────────
	// Hook: Session start (banner + gap detection)
	// Fires on session_start to show studio dashboard and check docs
	// ──────────────────────────────────────────────
	pi.on("session_start", async (_event, ctx) => {
		// Bounded edit surfaces forwarded by the parent runner: this process is a
		// dispatched specialist, so enforce the task boundaries declared upstream.
		if (process.env.PI_STUDIO_ALLOWED_SURFACES) {
			boundedSurfacesGuard.setFromEnv(process.env.PI_STUDIO_ALLOWED_SURFACES);
		}

		const studioRoot = findStudioRoot(ctx.cwd);

		// Only run in the game-studio project context
		if (!studioRoot) return;

		// A studio tool replaced by another provider leaves the runner inert with
		// no error at all. Say it at startup instead of looking healthy.
		const toolDiagnostics = formatStudioToolDiagnostics();
		if (toolDiagnostics.length > 0) {
			for (const line of toolDiagnostics) console.log(line);
			(ctx as any).ui?.notify?.(
				"Herramientas del estudio reemplazadas por otro paquete. Revisa /studio:doctor.",
				"warning",
			);
		}

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
				setTimeout(() => {
					try {
						(ctx as any).ui?.setHeader?.((_tui: any, theme: any) => {
							const role = resolveStudioTheme(theme);
							return {
								render(width: number) {
									return renderBanner(width, studioRoot, role);
								},
								invalidate() {},
							};
						});
					} catch {}
				}, 50);
			}

			// Install Studio Footer Bar (Model, Context Gauge, Engine, Sprint)
			setTimeout(() => {
				try {
					updateStudioHUD(ctx, pi);
					updateTasksWidget(ctx);
				} catch {}
			}, 100);

			// Ensure local project tuiMode (fullscreen) is initialized if unconfigured
			const localSettingsPath = join(studioRoot, ".pi", "settings.json");
			if (existsSync(localSettingsPath)) {
				try {
					const parsed = JSON.parse(readFileSync(localSettingsPath, "utf8"));
					let changed = false;
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
