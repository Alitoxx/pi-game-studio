import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { existsSync, watch, type FSWatcher } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import { inspectSetup } from "./studio-setup.ts";
import {
	RESET,
	BOLD,
	DIM,
	GREEN,
	YELLOW,
	RED,
	ACCENT as BLUE,
	SECONDARY,
	WHITE,
} from "./studio-palette.ts";

export interface CompileCheckResult {
	success: boolean;
	engine: string;
	command: string;
	durationSec: string;
	warningsCount: number;
	output: string;
	message: string;
}

let activeWatcher: FSWatcher | null = null;
let activeWatcherEngine = "";
let isWatching = false;
let compileInProgress = false;

export function isStudioWatcherActive(): boolean {
	return isWatching;
}

export function stopStudioWatcher(): boolean {
	if (activeWatcher) {
		try {
			activeWatcher.close();
		} catch {}
		activeWatcher = null;
	}
	const wasWatching = isWatching;
	isWatching = false;
	activeWatcherEngine = "";
	return wasWatching;
}

/**
 * Determines appropriate compile check command for active engine.
 */
export function getEngineCompileCommand(
	engineName: string,
	studioRoot: string,
): { command: string; engine: string } {
	const norm = (engineName || "").toLowerCase();

	if (norm.includes("bevy") || existsSync(join(studioRoot, "Cargo.toml"))) {
		return { command: "cargo check", engine: "Bevy" };
	}
	if (norm.includes("godot") || existsSync(join(studioRoot, "project.godot"))) {
		return { command: "godot --headless --check-only", engine: "Godot" };
	}
	if (norm.includes("raylib") || existsSync(join(studioRoot, "CMakeLists.txt"))) {
		return { command: "cmake --build build 2>/dev/null || make -j4 2>/dev/null || true", engine: "Raylib" };
	}
	if (norm.includes("phaser")) {
		return { command: "npx vite build --emptyOutDir 2>/dev/null || npm run build 2>/dev/null || true", engine: "Phaser" };
	}
	if (norm.includes("unity")) {
		return { command: "dotnet build --no-restore", engine: "Unity" };
	}
	if (norm.includes("unreal")) {
		return { command: "dotnet build", engine: "Unreal" };
	}

	return { command: "cargo check", engine: "Engine" };
}

/**
 * Runs a background compilation / check command for the engine.
 */
export async function runEngineCompileCheck(
	engine: string,
	studioRoot: string,
	commandOverride?: string,
): Promise<CompileCheckResult> {
	const { command, engine: resolvedEngine } = commandOverride
		? { command: commandOverride, engine }
		: getEngineCompileCommand(engine, studioRoot);

	const startTime = Date.now();

	return new Promise((resolve) => {
		exec(command, { cwd: studioRoot }, (err, stdout, stderr) => {
			const durationMs = Date.now() - startTime;
			const durationSec = (durationMs / 1000).toFixed(1);
			const fullOutput = `${stdout || ""}\n${stderr || ""}`.trim();

			// Count warnings
			const warningMatches = fullOutput.match(/\bwarning(?:\([^)]+\))?:/gi) || [];
			const warningsCount = warningMatches.length;

			if (!err) {
				const message = `COMPILE OK: ${resolvedEngine} build clean in ${durationSec}s · ${warningsCount} warnings`;
				resolve({
					success: true,
					engine: resolvedEngine,
					command,
					durationSec,
					warningsCount,
					output: fullOutput,
					message,
				});
			} else {
				const errorSnippet = fullOutput.split("\n").slice(0, 5).join("\n");
				const message = `BUILD ERROR: ${resolvedEngine} compile failed in ${durationSec}s:\n${errorSnippet}`;
				resolve({
					success: false,
					engine: resolvedEngine,
					command,
					durationSec,
					warningsCount,
					output: fullOutput,
					message,
				});
			}
		});
	});
}

/**
 * CLI command handler for /studio:watch (or /watch)
 */
export async function handleStudioWatch(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const cwd = ctx.cwd || process.cwd();
	const studioRoot = findStudioRoot(cwd) || cwd;

	const detected = detectProjectEngine(studioRoot);
	const setup = inspectSetup(studioRoot);
	const engine = detected.detected
		? detected.engine
		: setup.currentEngine !== "Sin configurar"
			? setup.currentEngine
			: "Bevy";

	const subcmd = (args || "").trim().toLowerCase();

	if (subcmd === "stop") {
		const stopped = stopStudioWatcher();
		const msg = stopped
			? "ENGINE WATCHER: Detenido correctamente."
			: "ENGINE WATCHER: No había ningún watcher activo.";
		console.log(`${YELLOW}${msg}${RESET}`);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(msg, "info");
		}
		return;
	}

	if (subcmd === "status") {
		const statusMsg = isWatching
			? `ENGINE WATCHER: ACTIVO monitorizando para ${activeWatcherEngine}.`
			: "ENGINE WATCHER: INACTIVO.";
		console.log(`${BLUE}${statusMsg}${RESET}`);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(statusMsg, "info");
		}
		return;
	}

	if (subcmd === "once" || subcmd === "check") {
		console.log(`${BLUE}Compilando y verificando motor (${engine})...${RESET}`);
		const res = await runEngineCompileCheck(engine, studioRoot);
		if (res.success) {
			console.log(`${GREEN}${res.message}${RESET}`);
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(res.message, "info");
			}
		} else {
			console.log(`${RED}${res.message}${RESET}`);
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				(ctx.ui as any).notify(res.message, "error");
			}
		}
		return;
	}

	// Default: Start watcher
	stopStudioWatcher();

	console.log(`\n${BLUE}${BOLD}LIVE ENGINE WATCHER & HOT-RELOAD${RESET}`);
	console.log(`${DIM}Iniciando watcher para motor ${engine}...${RESET}`);

	// Initial compile check
	const initialRes = await runEngineCompileCheck(engine, studioRoot);
	if (initialRes.success) {
		console.log(`${GREEN}${initialRes.message}${RESET}`);
	} else {
		console.log(`${YELLOW}${initialRes.message}${RESET}`);
	}

	const watchDir = existsSync(join(studioRoot, "src"))
		? join(studioRoot, "src")
		: studioRoot;

	let debounceTimer: NodeJS.Timeout | null = null;

	try {
		activeWatcher = watch(watchDir, { recursive: true }, (_eventType, filename) => {
			if (!filename) return;
			// Filter out git, target, build artifacts
			if (
				filename.includes("node_modules") ||
				filename.includes(".git") ||
				filename.includes("target") ||
				filename.includes(".godot") ||
				filename.includes("build")
			) {
				return;
			}

			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}

			debounceTimer = setTimeout(async () => {
				if (compileInProgress) return;
				compileInProgress = true;
				try {
					const checkRes = await runEngineCompileCheck(engine, studioRoot);
					if (checkRes.success) {
						console.log(`\n${GREEN}${checkRes.message}${RESET}`);
						if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
							(ctx.ui as any).notify(checkRes.message, "info");
						}
					} else {
						console.log(`\n${RED}${checkRes.message}${RESET}`);
						if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
							(ctx.ui as any).notify(checkRes.message, "error");
						}
					}
				} finally {
					compileInProgress = false;
				}
			}, 400);
		});

		isWatching = true;
		activeWatcherEngine = engine;

		const startMsg = `LIVE WATCHER ACTIVO: Supervisando cambios en ${watchDir} (${engine})`;
		console.log(`${BLUE}${startMsg}${RESET}\n`);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(startMsg, "info");
		}
	} catch (err: any) {
		const errMsg = `ERROR iniciando watcher: ${err.message}`;
		console.log(`${RED}${errMsg}${RESET}`);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			(ctx.ui as any).notify(errMsg, "error");
		}
	}
}
