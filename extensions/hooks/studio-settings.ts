import { ACCENT, GRAY, GREEN, SECONDARY, YELLOW } from "./studio-palette.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { auditEnginePrerequisites, formatAuditReport } from "./studio-doctor.ts";
import { findStudioRoot } from "./studio-root.ts";
import { writeFileAtomicSync } from "./studio-fs.ts";
import { recordFailure } from "./studio-diagnostics.ts";
import { SUPPORTED_ENGINES } from "./studio-setup.ts";

export async function handleStudioSettings(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	// Case matters in the value (`engine=Bevy`), and not in the key or the subcommand.
	// Lowercasing the whole argument made /studio:settings write `engine: "bevy"`.
	const rawArgs = args?.trim() || "";
	const query = rawArgs.toLowerCase();
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const projectYamlPath = join(rootDir, "project.yaml");
	const studioDir = join(rootDir, ".pi", "game-studio");
	const prefsPath = join(studioDir, "technical-preferences.md");

	let currentEngine = "Godot";
	if (existsSync(projectYamlPath)) {
		try {
			const content = readFileSync(projectYamlPath, "utf8");
			const m = content.match(/^engine:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1]) currentEngine = m[1];
		} catch {}
	}

	if (query.startsWith("engine=")) {
		const typed = rawArgs.slice(rawArgs.indexOf("=") + 1).trim();
		// A known engine is stored in its canonical spelling; anything else survives as
		// typed, so setup can name the value that it cannot resolve.
		const canonical = SUPPORTED_ENGINES.find((name) => name.toLowerCase() === typed.toLowerCase());
		const eng = canonical || typed;
		if (eng) {
			setEngine(rootDir, eng);
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				ctx.ui.notify(`Motor configurado a: ${eng}`, "info");
			}
			console.log(`${GREEN}✓ Motor de juego actualizado a: ${eng}\x1b[0m`);
			return;
		}
	}

	// Interactive select
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const noClearFlag = join(rootDir, ".pi", "game-studio", "no-clear-screen");
		const clearScreenActive = !existsSync(noClearFlag);

		const options = [
			`Cambiar Motor de Juego (Actual: ${currentEngine})`,
			"Cambiar Idioma del Estudio (Español / English)",
			`Limpiar terminal al iniciar: ${clearScreenActive ? "Activado (Recomendado)" : "Desactivado"}`,
			"Ver archivo de configuración project.yaml",
		];

		const selected = await (ctx.ui as any).select(
			"PI GAME STUDIO — Configuración del Estudio",
			options,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : options.indexOf(selected);
		if (idx === -1) return;

		switch (idx) {
			case 0: {
				const engines = ["Godot (Recomendado)", "Unity", "Unreal Engine", "Bevy (Rust)", "Raylib (C++ / EnTT)", "Phaser (TypeScript / WebGL)"];
				const picked = await (ctx.ui as any).select("Selecciona tu motor:", engines);
				if (picked !== undefined && picked !== null) {
					const pIdx = typeof picked === "number" ? picked : engines.indexOf(picked);
					if (pIdx !== -1) {
						const cleanName = ["Godot", "Unity", "Unreal", "Bevy", "Raylib", "Phaser"][pIdx];
						setEngine(rootDir, cleanName);
						if (typeof (ctx.ui as any)?.notify === "function") {
							ctx.ui.notify(`Motor configurado: ${cleanName}`, "info");
						}
						const audit = auditEnginePrerequisites(cleanName);
						const lines = formatAuditReport(audit);
						for (const l of lines) console.log(l);
					}
				}
				break;
			}
			case 1: {
				const langs = ["Español (es)", "English (en)"];
				const picked = await (ctx.ui as any).select("Idioma de trabajo:", langs);
				if (picked !== undefined && picked !== null) {
					const pIdx = typeof picked === "number" ? picked : langs.indexOf(picked);
					if (pIdx !== -1) {
						const lang = pIdx === 0 ? "es" : "en";
						setLanguage(rootDir, lang);
						if (typeof (ctx.ui as any)?.notify === "function") {
							ctx.ui.notify(`🌐 Idioma configurado: ${lang}`, "info");
						}
					}
				}
				break;
			}
			case 2: {
				const studioDir = join(rootDir, ".pi", "game-studio");
				mkdirSync(studioDir, { recursive: true });
				if (clearScreenActive) {
					writeFileAtomicSync(noClearFlag, "true", "utf8");
					if (typeof (ctx.ui as any)?.notify === "function") {
						ctx.ui.notify("🧹 Limpieza de terminal al iniciar: Desactivada", "info");
					}
					console.log("" + YELLOW + "🧹 Limpieza de terminal al iniciar: Desactivada\x1b[0m");
				} else {
					try { unlinkSync(noClearFlag); } catch {}
					if (typeof (ctx.ui as any)?.notify === "function") {
						ctx.ui.notify("🧹 Limpieza de terminal al iniciar: Activada", "info");
					}
					console.log("" + GREEN + "✓ Limpieza de terminal al iniciar: Activada\x1b[0m");
				}
				break;
			}
			case 3:
				printYamlConfig(rootDir);
				break;
		}
		return;
	}

	// CLI Fallback
	printYamlConfig(rootDir);
	console.log("" + ACCENT + "\x1b[1mUso rápido:\x1b[0m");
	console.log("  " + SECONDARY + "/studio:settings engine=Godot\x1b[0m   (Godot | Unity | Unreal | Bevy)");
	console.log("  " + SECONDARY + "/settings\x1b[0m                        Asistente de configuración");
}

function setEngine(cwd: string, engineName: string): void {
	const projectYamlPath = join(cwd, "project.yaml");
	let content = existsSync(projectYamlPath) ? readFileSync(projectYamlPath, "utf8") : "";

	if (/^engine:\s*.*/m.test(content)) {
		content = content.replace(/^engine:\s*.*/m, `engine: "${engineName}"`);
	} else {
		content += `\nengine: "${engineName}"\n`;
	}

	writeFileAtomicSync(projectYamlPath, content, "utf8");

	// Update technical-preferences if present
	const prefsPath = join(cwd, ".pi", "game-studio", "technical-preferences.md");
	if (existsSync(prefsPath)) {
		try {
			let prefs = readFileSync(prefsPath, "utf8");
			prefs = prefs.replace(/Engine:\s*[^\n]+/i, `Engine: ${engineName}`);
			writeFileAtomicSync(prefsPath, prefs, "utf8");
		} catch (error) {
			recordFailure("settings.technicalPreferences", error);
		}
	}
}

export function getLanguage(cwd: string): string {
	const root = findStudioRoot(cwd) || cwd;
	const studioDir = join(root, ".pi", "game-studio");
	const langFile = join(studioDir, "language");
	if (existsSync(langFile)) {
		try {
			const lang = readFileSync(langFile, "utf8").trim().toLowerCase();
			if (lang === "es" || lang === "en") return lang;
		} catch {}
	}
	const projectYamlPath = join(root, "project.yaml");
	if (existsSync(projectYamlPath)) {
		try {
			const content = readFileSync(projectYamlPath, "utf8");
			const m = content.match(/^language:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1]) {
				const lang = m[1].trim().toLowerCase();
				if (lang === "es" || lang === "en") return lang;
			}
		} catch {}
	}
	return "es";
}

export function setLanguage(cwd: string, lang: string): void {
	const root = findStudioRoot(cwd) || cwd;
	const studioDir = join(root, ".pi", "game-studio");
	mkdirSync(studioDir, { recursive: true });
	const langFile = join(studioDir, "language");
	writeFileAtomicSync(langFile, lang, "utf8");
}

function printYamlConfig(cwd: string): void {
	const projectYamlPath = join(cwd, "project.yaml");
	console.log("");
	console.log("\x1b[1m" + ACCENT + "⚙️ PI GAME STUDIO — CONFIGURACIÓN ACTUAL\x1b[0m");
	console.log("" + GRAY + "" + "─".repeat(60) + "\x1b[0m");
	if (existsSync(projectYamlPath)) {
		console.log(readFileSync(projectYamlPath, "utf8"));
	} else {
		console.log("" + YELLOW + "project.yaml no encontrado en la raíz del proyecto.\x1b[0m");
	}
	console.log("");
}
