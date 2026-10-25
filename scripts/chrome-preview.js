#!/usr/bin/env node
/**
 * scripts/chrome-preview.js — Muestra el chrome persistente del estudio con la
 * paleta real: banner de bienvenida y tarjeta de estado.
 *
 * Ejecutar:  node --experimental-strip-types scripts/chrome-preview.js
 * Sin color: NO_COLOR=1 node --experimental-strip-types scripts/chrome-preview.js
 */

const path = require("node:path");
const { pathToFileURL } = require("node:url");

const useColor = !process.env.NO_COLOR;
const bold = (t) => (useColor ? `\x1b[1m${t}\x1b[0m` : t);
const dim = (t) => (useColor ? `\x1b[2m${t}\x1b[0m` : t);
const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

async function main() {
	const hooks = path.join(__dirname, "..", "extensions", "hooks");
	const load = (file) => import(pathToFileURL(path.join(hooks, file)).href);
	const { renderBanner } = await load("banner.ts");
	const { renderStudioStatusCard } = await load("studio-hud.ts");

	const root = process.cwd();
	const width = 78;

	const banner = renderBanner(width, root);
	const fakeCtx = {
		cwd: root,
		hasUI: false,
		ui: {},
		model: undefined,
		getContextUsage: () => undefined,
		sessionManager: { getEntries: () => [] },
	};

	let card = [];
	try {
		card = renderStudioStatusCard(fakeCtx, root, width);
	} catch (error) {
		card = [`  ${dim("(tarjeta de estado no disponible fuera de una sesión activa: " + error.message + ")")}`];
	}

	const out = [];
	out.push(bold("  BANNER DE BIENVENIDA"));
	out.push("");
	out.push(...banner.map((l) => `  ${l}`));
	out.push("");
	out.push(bold("  TARJETA DE ESTADO"));
	out.push("");
	out.push(...card.map((l) => `  ${l}`));
	out.push("");
	out.push(dim(`  ancho de muestra: ${width} columnas · ${strip(banner.join("")).length > 0 ? "render real, no maqueta" : ""}`));
	out.push("");
	process.stdout.write(out.join("\n"));
}

main().catch((error) => {
	console.error("preview falló:", error.message);
	process.exit(1);
});
