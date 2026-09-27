import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { inspectSetup } from "./studio-setup.ts";

export interface PrerequisiteCheck {
	name: string;
	required: boolean;
	satisfied: boolean;
	version?: string;
	details: string;
	installHelp: {
		macos: string;
		linux: string;
		windows: string;
	};
}

export interface EngineAuditReport {
	engine: string;
	ready: boolean;
	checks: PrerequisiteCheck[];
	recommendations: string[];
}

function runCommandSilent(cmd: string): string | null {
	try {
		return execSync(cmd, {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			timeout: 3000,
		}).trim();
	} catch {
		return null;
	}
}

export function auditEnginePrerequisites(engine: string): EngineAuditReport {
	const normalized = engine.trim().toLowerCase();
	const checks: PrerequisiteCheck[] = [];
	const recommendations: string[] = [];

	if (normalized.includes("bevy")) {
		// 1. Rust Compiler (rustc)
		const rustcOutput = runCommandSilent("rustc --version");
		const hasRustc = !!rustcOutput;
		checks.push({
			name: "Rust Compiler (rustc)",
			required: true,
			satisfied: hasRustc,
			version: rustcOutput || undefined,
			details: hasRustc ? `Instalado: ${rustcOutput}` : "No encontrado en el PATH",
			installHelp: {
				macos: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
				linux: "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
				windows: "Descarga e instala rustup-init.exe desde https://rustup.rs",
			},
		});

		// 2. Cargo
		const cargoOutput = runCommandSilent("cargo --version");
		const hasCargo = !!cargoOutput;
		checks.push({
			name: "Cargo (Package Manager)",
			required: true,
			satisfied: hasCargo,
			version: cargoOutput || undefined,
			details: hasCargo ? `Instalado: ${cargoOutput}` : "No encontrado en el PATH",
			installHelp: {
				macos: "Se instala automáticamente junto con rustup",
				linux: "Se instala automáticamente junto con rustup",
				windows: "Se instala automáticamente junto con rustup",
			},
		});

		// 3. C Toolchain / Clang / GCC
		const clangOutput = runCommandSilent("clang --version") || runCommandSilent("gcc --version");
		const hasCC = !!clangOutput;
		checks.push({
			name: "C/C++ Build Toolchain (para dependencias nativas)",
			required: true,
			satisfied: hasCC,
			details: hasCC ? "Compilador nativo disponible" : "Compilador C/C++ no detectado",
			installHelp: {
				macos: "xcode-select --install",
				linux: "sudo apt install build-essential pkg-config libasound2-dev libudev-dev",
				windows: "Instala Visual Studio C++ Build Tools",
			},
		});

		if (!hasRustc || !hasCargo) {
			recommendations.push(
				"Instala la herramienta oficial Rustup ejecutando: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
			);
			recommendations.push(
				"En tu editor de código (VS Code/Cursor/Zed) instala la extensión 'rust-analyzer' para tipado y autocompletado en tiempo real.",
			);
		}
	} else if (normalized.includes("raylib")) {
		// 1. CMake
		const cmakeOutput = runCommandSilent("cmake --version");
		const hasCmake = !!cmakeOutput;
		const cmakeVer = cmakeOutput ? cmakeOutput.split("\n")[0] : undefined;
		checks.push({
			name: "CMake (>= 3.20)",
			required: true,
			satisfied: hasCmake,
			version: cmakeVer,
			details: hasCmake ? `Instalado: ${cmakeVer}` : "No encontrado en el PATH",
			installHelp: {
				macos: "brew install cmake",
				linux: "sudo apt install cmake",
				windows: "winget install Kitware.CMake o desde https://cmake.org",
			},
		});

		// 2. C++ Compiler (clang++ / g++)
		const cxxOutput = runCommandSilent("clang++ --version") || runCommandSilent("g++ --version");
		const hasCxx = !!cxxOutput;
		const cxxVer = cxxOutput ? cxxOutput.split("\n")[0] : undefined;
		checks.push({
			name: "Compilador C++ (C++17/C++20)",
			required: true,
			satisfied: hasCxx,
			version: cxxVer,
			details: hasCxx ? `Instalado: ${cxxVer}` : "No encontrado en el PATH",
			installHelp: {
				macos: "xcode-select --install",
				linux: "sudo apt install build-essential g++",
				windows: "Instala Visual Studio Community o clang via LLVM",
			},
		});

		// 3. Git
		const gitOutput = runCommandSilent("git --version");
		const hasGit = !!gitOutput;
		checks.push({
			name: "Git (para FetchContent de Raylib y EnTT)",
			required: true,
			satisfied: hasGit,
			details: hasGit ? "Git instalado" : "Git no detectado",
			installHelp: {
				macos: "xcode-select --install o brew install git",
				linux: "sudo apt install git",
				windows: "winget install Git.Git",
			},
		});

		if (!hasCmake) {
			recommendations.push("Instala CMake para compilar el stack C++: brew install cmake o apt install cmake.");
		}
		if (!hasCxx) {
			recommendations.push("Instala las herramientas de compilación C++ nativas.");
		}
	} else if (normalized.includes("godot")) {
		// 1. Godot Binary
		const godotCli = runCommandSilent("godot --version") || runCommandSilent("godot4 --version");
		let hasGodotApp = false;
		if (process.platform === "darwin") {
			hasGodotApp = existsSync("/Applications/Godot.app") ||
				existsSync("/Applications/Godot_mono.app") ||
				existsSync(join(process.env.HOME || "", "Applications/Godot.app"));
		}

		const hasGodot = !!godotCli || hasGodotApp;
		checks.push({
			name: "Godot 4 Editor / Binary",
			required: true,
			satisfied: hasGodot,
			version: godotCli || (hasGodotApp ? "Godot.app detectado en Aplicaciones" : undefined),
			details: hasGodot
				? (godotCli ? `CLI: ${godotCli}` : "App detectada en /Applications")
				: "No encontrado en PATH ni en /Applications",
			installHelp: {
				macos: "brew install --cask godot o descarga desde https://godotengine.org",
				linux: "Descarga el binario oficial o via Flatpak: flatpak install flathub org.godotengine.Godot",
				windows: "winget install GodotEngine.GodotEngine o descarga desde https://godotengine.org",
			},
		});

		// 2. .NET SDK (Requerido solo si se usa C#)
		const dotnetOutput = runCommandSilent("dotnet --version");
		const hasDotnet = !!dotnetOutput;
		checks.push({
			name: ".NET SDK (Opcional - solo requerido para Godot C#)",
			required: false,
			satisfied: hasDotnet,
			version: dotnetOutput || undefined,
			details: hasDotnet ? `Instalado: .NET ${dotnetOutput}` : "No instalado (no necesario si usas GDScript)",
			installHelp: {
				macos: "brew install --cask dotnet-sdk",
				linux: "sudo apt install dotnet-sdk-8.0",
				windows: "winget install Microsoft.DotNet.SDK.8",
			},
		});

		if (!hasGodot) {
			recommendations.push(
				"Descarga Godot 4.x desde https://godotengine.org/download o ejecuta 'brew install --cask godot'.",
			);
		}
	} else if (normalized.includes("unity")) {
		let hasUnity = false;
		if (process.platform === "darwin") {
			hasUnity = existsSync("/Applications/Unity Hub.app") || existsSync("/Applications/Unity/Unity.app");
		} else if (process.platform === "win32") {
			hasUnity = existsSync("C:\\Program Files\\Unity Hub\\Unity Hub.exe");
		}

		checks.push({
			name: "Unity Hub / Unity Editor",
			required: true,
			satisfied: hasUnity,
			details: hasUnity ? "Unity Hub detectado en el sistema" : "No detectado en rutas estándar",
			installHelp: {
				macos: "brew install --cask unity-hub o descarga desde https://unity.com/download",
				linux: "Descarga Unity Hub AppImage o via Flatpak",
				windows: "winget install Unity.UnityHub o descarga desde https://unity.com/download",
			},
		});

		if (!hasUnity) {
			recommendations.push(
				"Instala Unity Hub desde https://unity.com/download e instala una versión LTS (ej. Unity 6 o 2022.3 LTS).",
			);
		}
	} else if (normalized.includes("unreal")) {
		let hasUnreal = false;
		if (process.platform === "darwin") {
			hasUnreal = existsSync("/Applications/Epic Games Launcher.app") || existsSync("/Users/Shared/Epic Games");
		} else if (process.platform === "win32") {
			hasUnreal = existsSync("C:\\Program Files (x86)\\Epic Games\\Launcher\\Portal\\Binaries\\Win64\\EpicGamesLauncher.exe");
		}

		checks.push({
			name: "Epic Games Launcher / Unreal Engine 5",
			required: true,
			satisfied: hasUnreal,
			details: hasUnreal ? "Epic Games Launcher detectado" : "No detectado en rutas estándar",
			installHelp: {
				macos: "Descarga Epic Games Launcher desde https://store.epicgames.com",
				linux: "Compila Unreal Engine desde GitHub (código fuente) o usa un container de desarrollo",
				windows: "Descarga Epic Games Launcher desde https://store.epicgames.com",
			},
		});

		if (!hasUnreal) {
			recommendations.push(
				"Descarga Epic Games Launcher para instalar Unreal Engine 5.4+ y asegúrate de tener Visual Studio 2022 o Xcode instalado.",
			);
		}
	}

	const ready = checks.filter((c) => c.required).every((c) => c.satisfied);

	return {
		engine,
		ready,
		checks,
		recommendations,
	};
}

export function formatAuditReport(report: EngineAuditReport): string[] {
	const lines: string[] = [];
	const isReady = report.ready;

	lines.push("");
	lines.push(
		`\x1b[1m\x1b[38;2;167;139;250m🔍 Diagnóstico de Requisitos de Motor: ${report.engine}\x1b[0m`,
	);
	lines.push("\x1b[38;2;107;114;128m" + "─".repeat(70) + "\x1b[0m");

	for (const check of report.checks) {
		const symbol = check.satisfied
			? "\x1b[38;2;52;211;153m✔\x1b[0m"
			: check.required
			? "\x1b[38;2;239;68;68m❌\x1b[0m"
			: "\x1b[38;2;251;191;36mℹ\x1b[0m";

		const namePadded = check.name.padEnd(42);
		const statusText = check.satisfied
			? `\x1b[38;2;52;211;153mOK\x1b[0m (${check.details})`
			: check.required
			? `\x1b[38;2;239;68;68mFALTA\x1b[0m (${check.details})`
			: `\x1b[38;2;251;191;36mOPCIONAL\x1b[0m (${check.details})`;

		lines.push(`  ${symbol} ${namePadded} ${statusText}`);

		if (!check.satisfied && check.required) {
			const platformHelp =
				process.platform === "darwin"
					? check.installHelp.macos
					: process.platform === "win32"
					? check.installHelp.windows
					: check.installHelp.linux;
			lines.push(`     \x1b[38;2;243;244;246m👉 Para instalar: \x1b[38;2;56;189;248m${platformHelp}\x1b[0m`);
		}
	}

	lines.push("");
	if (isReady) {
		lines.push(
			`\x1b[38;2;52;211;153m✔ Tu sistema cuenta con todas las herramientas necesarias para compilar y ejecutar ${report.engine}.\x1b[0m`,
		);
	} else {
		lines.push(
			`\x1b[38;2;251;191;36m⚠️  ATENCIÓN: Tu sistema no tiene instaladas todas las herramientas para ${report.engine}.\x1b[0m`,
		);
		for (const rec of report.recommendations) {
			lines.push(`   • ${rec}`);
		}
	}
	lines.push("");

	return lines;
}

export async function handleStudioDoctor(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	let targetEngine = args?.trim();
	if (!targetEngine) {
		const status = inspectSetup(ctx.cwd);
		targetEngine = status.currentEngine || "Godot";
	}

	const audit = auditEnginePrerequisites(targetEngine);
	const lines = formatAuditReport(audit);
	for (const l of lines) console.log(l);

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const msg = audit.ready
			? `✔ Herramientas para ${targetEngine} listas`
			: `⚠️ Faltan herramientas para ${targetEngine}`;
		ctx.ui.notify(msg, audit.ready ? "info" : "warning");
	}
}

