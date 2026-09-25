import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderBanner } from "./banner.ts";
import { inspectSetup } from "./studio-setup.ts";

export async function handleStudioStatus(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	if (process.stdout.isTTY && args !== "--no-clear") {
		try {
			process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
		} catch {}
	}
	const termWidth = process.stdout.columns || 80;
	const bannerLines = renderBanner(termWidth, ctx.cwd);

	for (const line of bannerLines) {
		console.log(line);
	}

	const status = inspectSetup(ctx.cwd);
	const summary = [
		`🎮 Pi Game Studio — Estado del Sistema`,
		`• Agentes instalados: ${status.agentsInstalled}/${status.totalPackageAgents}`,
		`• Configuración de modelos: ${status.hasModelsConfig ? "Configurada" : "Pendiente"}`,
		`• Memoria persistente: ${status.engramEnabled ? "Engram activo" : "Archivos locales"}`,
		`• Configuración de proyecto: ${status.hasProjectYaml ? "project.yaml activo" : "Pendiente"}`,
	].join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(summary, "info");
	}
}
