import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { renderBanner } from "./banner.ts";
import { inspectSetup } from "./studio-setup.ts";
import { auditEnginePrerequisites, formatAuditReport } from "./studio-doctor.ts";
import { findStudioRoot } from "./studio-root.ts";
import { renderStudioStatusCard, updateStudioHUD, isStatusCardCollapsed, setStatusCardCollapsed } from "./studio-hud.ts";

export async function handleStudioStatus(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const rootDir = findStudioRoot(ctx.cwd) || ctx.cwd;
	const trimmed = (args || "").trim().toLowerCase();

	if (trimmed === "collapse" || trimmed.startsWith("collapse")) {
		const action = trimmed.replace("collapse", "").trim();
		let nextState: boolean;
		if (action === "on" || action === "true" || action === "enable") {
			nextState = true;
		} else if (action === "off" || action === "false" || action === "disable") {
			nextState = false;
		} else {
			nextState = !isStatusCardCollapsed(rootDir);
		}
		setStatusCardCollapsed(rootDir, nextState);
		updateStudioHUD(ctx);
		try {
			const { invalidateStudioSidebar } = await import("./studio-sidebar.ts");
			invalidateStudioSidebar();
		} catch {}
		try {
			const { updateTasksWidget } = await import("./studio-tasks-widget.ts");
			updateTasksWidget(ctx);
		} catch {}
		console.log(
			nextState
				? "\x1b[38;2;251;191;36mTarjeta de estado colapsada [collapsed].\x1b[0m"
				: "\x1b[38;2;52;211;153mTarjeta de estado expandida.\x1b[0m"
		);
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(
				`Status: Tarjeta ${nextState ? "colapsada" : "expandida"}`,
				"info",
			);
		}
		return;
	}

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

	// Render Live Studio Status Card (Model, Context Gauge, Sprint, Game)
	console.log("");
	const cardLines = renderStudioStatusCard(ctx, rootDir, Math.min(termWidth, 76));
	for (const line of cardLines) {
		console.log(line);
	}
	console.log("");

	const status = inspectSetup(rootDir);
	const audit = auditEnginePrerequisites(status.currentEngine);
	const auditLines = formatAuditReport(audit);
	for (const l of auditLines) console.log(l);

	// Also update HUD bar
	updateStudioHUD(ctx);

	const summary = [
		`PI GAME STUDIO — ESTADO DEL SISTEMA`,
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
