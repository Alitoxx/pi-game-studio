import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderBanner } from "./banner.ts";
import { inspectSetup } from "./studio-setup.ts";
import { auditEnginePrerequisites, formatAuditReport } from "./studio-doctor.ts";
import { findStudioRoot } from "./studio-root.ts";

export async function handleStudioStatus(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	if (process.stdout.isTTY && args !== "--no-clear") {
		try {
			process.stdout.write("\x1b[2J\x1b[3J\x1b[H");
		} catch {}
	}
	const termWidth = process.stdout.columns || 80;
	const bannerLines = renderBanner(termWidth, rootDir);

	for (const line of bannerLines) {
		console.log(line);
	}

	const status = inspectSetup(rootDir);
	const audit = auditEnginePrerequisites(status.currentEngine);
	const auditLines = formatAuditReport(audit);
	for (const l of auditLines) console.log(l);

	const summary = [
		`🎮 Pi Game Studio — Estado del Sistema`,
		`• Motor activo: ${status.currentEngine} (${audit.ready ? "Herramientas OK" : "Faltan herramientas"})`,
		`• Agentes instalados: ${status.agentsInstalled}/${status.totalPackageAgents}`,
		`• Configuración de modelos: ${status.hasModelsConfig ? "Configurada" : "Pendiente"}`,
		`• Memoria persistente: ${status.engramEnabled ? "Engram activo" : "Archivos locales"}`,
		`• Configuración de proyecto: ${status.hasProjectYaml ? "project.yaml activo" : "Pendiente"}`,
	].join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(summary, "info");
	}
}
