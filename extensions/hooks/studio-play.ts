import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";
import { ACCENT as BLUE, BORDER, CYAN, DIM, GRAY, GREEN, RED, RESET, SECONDARY, YELLOW, padAnsi } from "./studio-palette.ts";

export interface PlayCommandConfig {
	engine: string;
	command: string;
	args: string[];
	isWeb: boolean;
	description: string;
}

let activeChildProcess: ChildProcess | null = null;
let activeStartTime: number | null = null;

function getPidFilePath(studioRoot: string): string {
	return join(studioRoot, ".pi", "game-studio", "active-run.pid");
}

function getLogFilePath(studioRoot: string): string {
	return join(studioRoot, ".pi", "game-studio", "play-output.log");
}

/**
 * Resolves the appropriate launch command according to the active game engine.
 */
export function resolveEnginePlayCommand(studioRoot: string): PlayCommandConfig {
	const detection = detectProjectEngine(studioRoot);
	const engineLower = (detection?.engine || "").toLowerCase();

	if (engineLower.includes("bevy") || existsSync(join(studioRoot, "Cargo.toml"))) {
		return {
			engine: "Bevy (Rust)",
			command: "cargo",
			args: ["run"],
			isWeb: false,
			description: "Compila y ejecuta el binario nativo de Bevy",
		};
	}

	if (
		engineLower.includes("phaser") ||
		(existsSync(join(studioRoot, "package.json")) &&
			readFileSync(join(studioRoot, "package.json"), "utf8").includes("phaser"))
	) {
		return {
			engine: "Phaser (Web)",
			command: "pnpm",
			args: ["run", "dev"],
			isWeb: true,
			description: "Servidor de desarrollo local Vite con live-reload",
		};
	}

	if (engineLower.includes("godot") || existsSync(join(studioRoot, "project.godot"))) {
		return {
			engine: "Godot 4",
			command: "godot",
			args: ["--path", "."],
			isWeb: false,
			description: "Ejecuta el proyecto en el motor Godot",
		};
	}

	if (engineLower.includes("raylib") || existsSync(join(studioRoot, "CMakeLists.txt"))) {
		return {
			engine: "Raylib (C++)",
			command: "bash",
			args: ["-c", "cmake --build build 2>/dev/null && ./build/game 2>/dev/null || ./game"],
			isWeb: false,
			description: "Compila y lanza el ejecutable nativo de Raylib",
		};
	}

	return {
		engine: "Desconocido / Genérico",
		command: "echo",
		args: ["No se detectó un motor compatible para /studio:play"],
		isWeb: false,
		description: "Configura el motor en project.yaml",
	};
}

/**
 * Checks if a play process is currently active.
 */
export function isPlayProcessRunning(studioRoot: string): boolean {
	if (activeChildProcess && !activeChildProcess.killed) {
		return true;
	}
	const pidFile = getPidFilePath(studioRoot);
	if (existsSync(pidFile)) {
		try {
			const pid = Number(readFileSync(pidFile, "utf8").trim());
			if (pid && !Number.isNaN(pid)) {
				// Signal 0 tests process existence without killing it
				process.kill(pid, 0);
				return true;
			}
		} catch {
			try {
				unlinkSync(pidFile);
			} catch {}
		}
	}
	return false;
}

/**
 * Stops any active play process.
 */
export function stopPlayProcess(studioRoot: string): boolean {
	let stopped = false;
	if (activeChildProcess) {
		try {
			activeChildProcess.kill("SIGTERM");
			stopped = true;
		} catch {}
		activeChildProcess = null;
		activeStartTime = null;
	}

	const pidFile = getPidFilePath(studioRoot);
	if (existsSync(pidFile)) {
		try {
			const pid = Number(readFileSync(pidFile, "utf8").trim());
			if (pid && !Number.isNaN(pid)) {
				process.kill(pid, "SIGTERM");
				stopped = true;
			}
		} catch {}
		try {
			unlinkSync(pidFile);
		} catch {}
	}

	return stopped;
}

/**
 * Command: /studio:play [status | stop]
 */
export async function handleStudioPlay(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const trimmed = (args || "").trim().toLowerCase();

	if (trimmed === "status") {
		const running = isPlayProcessRunning(studioRoot);
		if (running) {
			const uptime = activeStartTime ? `${Math.floor((Date.now() - activeStartTime) / 1000)}s` : "activo";
			console.log(`\n${GREEN}◐ El juego está en ejecución\x1b[0m (tiempo activo: ${uptime}).`);
			console.log(`Log de ejecución: ${GRAY}.pi/game-studio/play-output.log\x1b[0m`);
			console.log(`Para detenerlo: ${SECONDARY}/studio:play stop\x1b[0m\n`);
		} else {
			console.log("\n" + GRAY + "○ El juego no se encuentra en ejecución actualmente.\x1b[0m");
			console.log(`Usa ${SECONDARY}/studio:play\x1b[0m para lanzarlo.\n`);
		}
		return;
	}

	if (trimmed === "stop") {
		const stopped = stopPlayProcess(studioRoot);
		if (stopped) {
			console.log("\n" + GREEN + "✓ Ejecución del juego detenida correctamente.\x1b[0m\n");
		} else {
			console.log("\n" + GRAY + "No se encontró ningún proceso del juego en ejecución.\x1b[0m\n");
		}
		return;
	}

	if (isPlayProcessRunning(studioRoot)) {
		console.log("\n" + YELLOW + "⚠ El juego ya está corriendo.\x1b[0m");
		console.log(`Usa ${SECONDARY}/studio:play stop\x1b[0m para detenerlo o ${SECONDARY}/studio:play status\x1b[0m para ver el estado.\n`);
		return;
	}

	const config = resolveEnginePlayCommand(studioRoot);
	if (config.command === "echo") {
		console.log(`\n${RED}${config.args[0]}\x1b[0m\n`);
		return;
	}

	console.log("");
	console.log(`┌── STUDIO PLAY RUNNER: ${config.engine.toUpperCase()} ─────────────────────┐`);
	console.log(`│ Comando: ${`${config.command} ${config.args.join(" ")}`.padEnd(52, " ")} │`);
	console.log(`│ Modo:    ${(config.isWeb ? "Web Browser Preview" : "Native Desktop Window").padEnd(52, " ")} │`);
	console.log("└─────────────────────────────────────────────────────────────────┘");
	console.log("");

	const logPath = getLogFilePath(studioRoot);
	try {
		mkdirSync(dirname(logPath), { recursive: true });
		writeFileSync(logPath, `=== Studio Play Log: ${new Date().toISOString()} ===\n`, "utf8");
	} catch {}

	try {
		const child = spawn(config.command, config.args, {
			cwd: studioRoot,
			detached: true,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				RUST_LOG: "info",
			},
		});

		activeChildProcess = child;
		activeStartTime = Date.now();

		if (child.pid) {
			try {
				writeFileSync(getPidFilePath(studioRoot), String(child.pid), "utf8");
			} catch {}
		}

		child.stdout?.on("data", (data) => {
			try {
				const current = readFileSync(logPath, "utf8");
				writeFileSync(logPath, current + data.toString(), "utf8");
			} catch {}
		});

		child.stderr?.on("data", (data) => {
			try {
				const current = readFileSync(logPath, "utf8");
				writeFileSync(logPath, current + data.toString(), "utf8");
			} catch {}
		});

		child.on("exit", (code) => {
			activeChildProcess = null;
			activeStartTime = null;
			try {
				unlinkSync(getPidFilePath(studioRoot));
			} catch {}
			if (code !== 0 && code !== null) {
				console.log(`\n${RED}[Studio Play] El juego finalizó con código de error ${code}.\x1b[0m Revisa ${logPath}`);
			}
		});

		// Don't keep parent waiting
		child.unref();

		console.log(`${GREEN}✓ Proceso lanzado en background (PID ${child.pid}).\x1b[0m`);
		console.log(`• Monitoreo de salida: ${GRAY}.pi/game-studio/play-output.log\x1b[0m`);
		console.log(`• Para detener la ejecución: ${SECONDARY}/studio:play stop\x1b[0m\n`);
	} catch (err: any) {
		console.log(`\n${RED}Fallo al lanzar el juego:\x1b[0m ${err.message || String(err)}\n`);
	}
}
