import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inspectSetup } from "./studio-setup.ts";
import { findStudioRoot } from "./studio-root.ts";
import { detectProjectEngine } from "./engine-detector.ts";

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "docs"))) return candidate1;
	} catch {}
	return process.cwd();
}

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

export interface VersionAuditResult {
	projectVersion?: string;
	referenceVersion?: string;
	sourceFile?: string;
	status: "ok" | "warning" | "info";
	summary: string;
	advice?: string;
}

export interface EngineAuditReport {
	engine: string;
	ready: boolean;
	checks: PrerequisiteCheck[];
	versionAudit?: VersionAuditResult;
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

export function auditEnginePrerequisites(engine: string, dir = process.cwd()): EngineAuditReport {
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

	const versionAudit = auditEngineVersion(engine, dir);
	if (versionAudit.advice) {
		recommendations.push(versionAudit.advice);
	}

	const ready = checks.filter((c) => c.required).every((c) => c.satisfied);

	return {
		engine,
		ready,
		checks,
		versionAudit,
		recommendations,
	};
}

export function auditEngineVersion(engine: string, dir = process.cwd()): VersionAuditResult {
	const studioRoot = findStudioRoot(dir) || dir;
	const detected = detectProjectEngine(studioRoot);
	const normalized = engine.trim().toLowerCase();

	let engineDir = "godot";
	if (normalized.includes("bevy")) engineDir = "bevy";
	else if (normalized.includes("raylib")) engineDir = "raylib";
	else if (normalized.includes("unity")) engineDir = "unity";
	else if (normalized.includes("unreal")) engineDir = "unreal";

	let refVersion: string | undefined;
	const candidatePaths = [
		join(studioRoot, "docs", "engine-reference", engineDir, "VERSION.md"),
		join(resolvePackageRoot(), "docs", "engine-reference", engineDir, "VERSION.md"),
	];

	for (const p of candidatePaths) {
		if (existsSync(p)) {
			try {
				const content = readFileSync(p, "utf8");
				const m = content.match(/\*\*Engine Version\*\*\s*\|\s*([^|\n]+)/);
				if (m) {
					refVersion = m[1].trim();
					break;
				}
			} catch {}
		}
	}

	const isTargetEngine = detected.detected && detected.engine.toLowerCase() === engineDir;
	const projVer = isTargetEngine ? detected.version : undefined;

	if (normalized.includes("bevy")) {
		if (projVer) {
			const numProj = parseFloat(projVer.replace(/^[^0-9]*/, ""));
			if (!isNaN(numProj) && numProj < 0.17) {
				return {
					projectVersion: projVer,
					referenceVersion: refVersion || "Bevy 0.19.0",
					sourceFile: detected.sourceFile,
					status: "info",
					summary: `Versión en proyecto: Bevy ${projVer} (referencia técnica en estudio: ${refVersion || "0.19.0"})`,
					advice: `Tu proyecto usa Bevy ${projVer}. Pi Game Studio incluye guías de migración y breaking changes hasta Bevy 0.19 en docs/engine-reference/bevy/breaking-changes.md.`,
				};
			} else if (!isNaN(numProj) && numProj > 0.19) {
				return {
					projectVersion: projVer,
					referenceVersion: refVersion || "Bevy 0.19.0",
					sourceFile: detected.sourceFile,
					status: "warning",
					summary: `Versión en proyecto: Bevy ${projVer} (más reciente que la base técnica local: ${refVersion || "0.19.0"})`,
					advice: `Tu versión (${projVer}) supera la referencia local (0.19.0). Si encuentras diferencias de API, el bevy-specialist consultará la documentación oficial en línea.`,
				};
			}
			return {
				projectVersion: projVer,
				referenceVersion: refVersion || "Bevy 0.19.0",
				sourceFile: detected.sourceFile,
				status: "ok",
				summary: `Versión en proyecto: Bevy ${projVer} (sincronizada con la base técnica del estudio)`,
			};
		}
	} else if (normalized.includes("godot")) {
		if (projVer && projVer.startsWith("3.")) {
			return {
				projectVersion: projVer,
				referenceVersion: refVersion || "Godot 4.3",
				sourceFile: detected.sourceFile,
				status: "warning",
				summary: `Versión en proyecto: Godot ${projVer} (desactualizada frente a Godot 4.x)`,
				advice: "Pi Game Studio está diseñado para Godot 4.x. Se recomienda migrar a Godot 4 para compatibilidad total con los agentes.",
			};
		} else if (projVer) {
			return {
				projectVersion: projVer,
				referenceVersion: refVersion || "Godot 4.3",
				sourceFile: detected.sourceFile,
				status: "ok",
				summary: `Versión en proyecto: Godot ${projVer} (${detected.language})`,
			};
		}
	} else if (normalized.includes("raylib")) {
		if (projVer) {
			return {
				projectVersion: projVer,
				referenceVersion: refVersion || "Raylib 5.5 / EnTT 3.13",
				sourceFile: detected.sourceFile,
				status: "ok",
				summary: `Versión en proyecto: Raylib ${projVer} (${detected.language})`,
			};
		}
	} else if (projVer) {
		return {
			projectVersion: projVer,
			referenceVersion: refVersion,
			sourceFile: detected.sourceFile,
			status: "ok",
			summary: `Versión en proyecto: ${detected.engine} ${projVer}`,
		};
	}

	return {
		referenceVersion: refVersion,
		status: "info",
		summary: detected.detected
			? `Proyecto configurado con ${detected.engine}, sin versión estricta declarada`
			: `Sin archivos de proyecto específicos en el directorio actual`,
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

	if (report.versionAudit) {
		lines.push("");
		lines.push(
			`  \x1b[1m\x1b[38;2;56;189;248m📦 Auditoría de Versión y Base de Conocimiento:\x1b[0m`,
		);
		const va = report.versionAudit;
		const sym = va.status === "ok"
			? "\x1b[38;2;52;211;153m✔\x1b[0m"
			: va.status === "warning"
			? "\x1b[38;2;239;68;68m⚠️\x1b[0m"
			: "\x1b[38;2;251;191;36mℹ\x1b[0m";

		lines.push(`     ${sym} ${va.summary}`);
		if (va.referenceVersion) {
			lines.push(`       \x1b[38;2;107;114;128mBase local de referencia: ${va.referenceVersion}\x1b[0m`);
		}
		if (va.advice) {
			lines.push(`       \x1b[38;2;251;191;36m💡 Recomendación: ${va.advice}\x1b[0m`);
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
		const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
		const detected = detectProjectEngine(studioRoot);
		if (detected.detected) {
			targetEngine = detected.engine;
		} else {
			const status = inspectSetup(studioRoot);
			targetEngine = status.currentEngine || "Godot";
		}
	}

	const audit = auditEnginePrerequisites(targetEngine, studioRoot);
	const lines = formatAuditReport(audit);
	for (const l of lines) console.log(l);

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		const msg = audit.ready
			? `✔ Herramientas para ${targetEngine} listas`
			: `⚠️ Faltan herramientas para ${targetEngine}`;
		ctx.ui.notify(msg, audit.ready ? "info" : "warning");
	}
}

