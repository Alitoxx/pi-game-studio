import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { exec, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export async function handleStudioWeb(ctx: ExtensionContext, args?: string): Promise<void> {
	const studioRoot = ctx.cwd || process.cwd();
	const buildScript = join(studioRoot, "scripts/build-web.sh");
	const serveScript = join(studioRoot, "scripts/serve-web.js");

	ctx.ui?.notify?.("Construyendo paquete Web/WASM...", "info");

	// Step 1: Run build-web.sh
	exec(`bash "${buildScript}"`, { cwd: studioRoot }, (error, stdout, stderr) => {
		if (error) {
			ctx.ui?.notify?.(`Error al compilar Web/WASM: ${error.message}`, "error");
			return;
		}

		ctx.ui?.notify?.("Paquete Web listo. Iniciando servidor local...", "info");

		// Step 2: Spawn background server
		const serverProcess = spawn("node", [serveScript], {
			cwd: studioRoot,
			detached: true,
			stdio: "ignore",
		});
		serverProcess.unref();

		// Step 3: Open in default browser if on macOS or Linux
		const port = process.env.PORT || "8080";
		const url = `http://localhost:${port}`;
		const openCmd = process.platform === "darwin" ? `open "${url}"` : `xdg-open "${url}"`;

		exec(openCmd, () => {
			ctx.ui?.notify?.(`Juego corriendo en ${url} (COOP/COEP habilitado)`, "info");
		});
	});
}
