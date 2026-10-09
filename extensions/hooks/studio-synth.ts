import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec } from "node:child_process";
import { join } from "node:path";

export async function handleStudioSfx(args: string, ctx: ExtensionContext): Promise<void> {
	const studioRoot = ctx.cwd || process.cwd();
	const scriptPath = join(studioRoot, "scripts/synth-studio.js");

	const parts = args?.trim().split(/\s+/) || [];
	const name = parts[0] || "custom_sfx";
	const extraArgs = parts.slice(1).join(" ");

	ctx.ui?.notify?.(`Sintetizando audio procedural "${name}"...`, "info");

	exec(`node "${scriptPath}" sfx ${name} ${extraArgs}`, { cwd: studioRoot }, (err, stdout, stderr) => {
		if (err) {
			ctx.ui?.notify?.(`Error sintetizando SFX: ${err.message}`, "error");
			return;
		}
		ctx.ui?.notify?.(`SFX creado en assets/sfx/${name}.wav`, "info");
	});
}

export async function handleStudioPalettes(args: string, ctx: ExtensionContext): Promise<void> {
	const studioRoot = ctx.cwd || process.cwd();
	const scriptPath = join(studioRoot, "scripts/synth-studio.js");

	const parts = args?.trim().split(/\s+/) || [];
	const palette = parts[0] || "pico8";
	const target = parts[1] || "godot";

	ctx.ui?.notify?.(`Generando shader de paleta "${palette}" para ${target}...`, "info");

	exec(`node "${scriptPath}" palette ${palette} ${target}`, { cwd: studioRoot }, (err, stdout, stderr) => {
		if (err) {
			ctx.ui?.notify?.(`Error generando paleta: ${err.message}`, "error");
			return;
		}
		ctx.ui?.notify?.(`Shader generado en shaders/palette_${palette}.${target === "godot" ? "gdshader" : "fs"}`, "info");
	});
}
