import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export async function handleStudioSettings(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";
	const projectYamlPath = join(ctx.cwd, "project.yaml");
	const studioDir = join(ctx.cwd, ".pi", "game-studio");
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
		const eng = query.split("=")[1]?.trim();
		if (eng) {
			setEngine(ctx.cwd, eng);
			if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
				ctx.ui.notify(`🎮 Motor configurado a: ${eng}`, "info");
			}
			console.log(`\x1b[38;2;52;211;153m✔ Motor de juego actualizado a: ${eng}\x1b[0m`);
			return;
		}
	}

	// Interactive select
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const noClearFlag = join(ctx.cwd, ".pi", "game-studio", "no-clear-screen");
		const clearScreenActive = !existsSync(noClearFlag);

		const options = [
			`🎮 Cambiar Motor de Juego (Actual: ${currentEngine})`,
			"🌐 Cambiar Idioma del Estudio (Español / English)",
			`🧹 Limpiar terminal al iniciar: ${clearScreenActive ? "Activado (Recomendado)" : "Desactivado"}`,
			"📄 Ver archivo de configuración project.yaml",
		];

		const selected = await (ctx.ui as any).select(
			"🎮 Pi Game Studio — Configuración del Estudio",
			options,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : options.indexOf(selected);
		if (idx === -1) return;

		switch (idx) {
			case 0: {
				const engines = ["Godot (Recomendado)", "Unity", "Unreal Engine", "Bevy (Rust)"];
				const picked = await (ctx.ui as any).select("Selecciona tu motor:", engines);
				if (picked !== undefined && picked !== null) {
					const pIdx = typeof picked === "number" ? picked : engines.indexOf(picked);
					if (pIdx !== -1) {
						const cleanName = ["Godot", "Unity", "Unreal", "Bevy"][pIdx];
						setEngine(ctx.cwd, cleanName);
						if (typeof (ctx.ui as any)?.notify === "function") {
							ctx.ui.notify(`🎮 Motor configurado: ${cleanName}`, "info");
						}
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
						setLanguage(ctx.cwd, lang);
						if (typeof (ctx.ui as any)?.notify === "function") {
							ctx.ui.notify(`🌐 Idioma configurado: ${lang}`, "info");
						}
					}
				}
				break;
			}
			case 2: {
				const studioDir = join(ctx.cwd, ".pi", "game-studio");
				mkdirSync(studioDir, { recursive: true });
				if (clearScreenActive) {
					writeFileSync(noClearFlag, "true", "utf8");
					if (typeof (ctx.ui as any)?.notify === "function") {
						ctx.ui.notify("🧹 Limpieza de terminal al iniciar: Desactivada", "info");
					}
					console.log("\x1b[38;2;251;191;36m🧹 Limpieza de terminal al iniciar: Desactivada\x1b[0m");
				} else {
					try { unlinkSync(noClearFlag); } catch {}
					if (typeof (ctx.ui as any)?.notify === "function") {
						ctx.ui.notify("🧹 Limpieza de terminal al iniciar: Activada", "info");
					}
					console.log("\x1b[38;2;52;211;153m✔ Limpieza de terminal al iniciar: Activada\x1b[0m");
				}
				break;
			}
			case 3:
				printYamlConfig(ctx.cwd);
				break;
		}
		return;
	}

	// CLI Fallback
	printYamlConfig(ctx.cwd);
	console.log("\x1b[38;2;167;139;250m\x1b[1mUso rápido:\x1b[0m");
	console.log("  \x1b[38;2;56;189;248m/studio:settings engine=Godot\x1b[0m   (Godot | Unity | Unreal | Bevy)");
	console.log("  \x1b[38;2;56;189;248m/settings\x1b[0m                        Asistente de configuración");
}

function setEngine(cwd: string, engineName: string): void {
	const projectYamlPath = join(cwd, "project.yaml");
	let content = existsSync(projectYamlPath) ? readFileSync(projectYamlPath, "utf8") : "";

	if (/^engine:\s*.*/m.test(content)) {
		content = content.replace(/^engine:\s*.*/m, `engine: "${engineName}"`);
	} else {
		content += `\nengine: "${engineName}"\n`;
	}

	writeFileSync(projectYamlPath, content, "utf8");

	// Update technical-preferences if present
	const prefsPath = join(cwd, ".pi", "game-studio", "technical-preferences.md");
	if (existsSync(prefsPath)) {
		try {
			let prefs = readFileSync(prefsPath, "utf8");
			prefs = prefs.replace(/Engine:\s*[^\n]+/i, `Engine: ${engineName}`);
			writeFileSync(prefsPath, prefs, "utf8");
		} catch {}
	}
}

export function getLanguage(cwd: string): string {
	const studioDir = join(cwd, ".pi", "game-studio");
	const langFile = join(studioDir, "language");
	if (existsSync(langFile)) {
		try {
			const lang = readFileSync(langFile, "utf8").trim().toLowerCase();
			if (lang === "es" || lang === "en") return lang;
		} catch {}
	}
	const projectYamlPath = join(cwd, "project.yaml");
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
	const studioDir = join(cwd, ".pi", "game-studio");
	mkdirSync(studioDir, { recursive: true });
	const langFile = join(studioDir, "language");
	writeFileSync(langFile, lang, "utf8");
}

function printYamlConfig(cwd: string): void {
	const projectYamlPath = join(cwd, "project.yaml");
	console.log("");
	console.log("\x1b[1m\x1b[38;2;167;139;250m⚙️ PI GAME STUDIO — CONFIGURACIÓN ACTUAL\x1b[0m");
	console.log("\x1b[38;2;107;114;128m" + "─".repeat(60) + "\x1b[0m");
	if (existsSync(projectYamlPath)) {
		console.log(readFileSync(projectYamlPath, "utf8"));
	} else {
		console.log("\x1b[38;2;251;191;36mproject.yaml no encontrado en la raíz del proyecto.\x1b[0m");
	}
	console.log("");
}
