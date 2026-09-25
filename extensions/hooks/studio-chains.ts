import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "chains"))) return candidate1;
	} catch {}
	try {
		const candidate2 = resolve(__dirname, "..", "..");
		if (existsSync(join(candidate2, "chains"))) return candidate2;
	} catch {}
	return process.cwd();
}

export interface StudioChain {
	name: string;
	title: string;
	description: string;
	steps: Array<{
		agent: string;
		reads?: string;
		output?: string;
		instructions: string;
	}>;
}

export function loadAvailableChains(cwd: string): StudioChain[] {
	const pkgRoot = resolvePackageRoot();
	const chainDirs = [
		join(cwd, ".pi", "chains"),
		join(cwd, "chains"),
		join(pkgRoot, "chains"),
	];

	const foundChains = new Map<string, StudioChain>();

	for (const dir of chainDirs) {
		if (!existsSync(dir)) continue;
		try {
			const files = readdirSync(dir).filter((f) => f.endsWith(".chain.md"));
			for (const file of files) {
				const fullPath = join(dir, file);
				const content = readFileSync(fullPath, "utf8");
				const chain = parseChainFile(content, file);
				if (chain && !foundChains.has(chain.name)) {
					foundChains.set(chain.name, chain);
				}
			}
		} catch {}
	}

	return Array.from(foundChains.values());
}

function parseChainFile(content: string, filename: string): StudioChain | null {
	const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!frontmatterMatch) return null;

	const yaml = frontmatterMatch[1];
	const body = frontmatterMatch[2];

	const nameMatch = yaml.match(/^name:\s*([^\n]+)/m);
	const descMatch = yaml.match(/^description:\s*([^\n]+)/m);

	const name = nameMatch ? nameMatch[1].trim() : filename.replace(".chain.md", "");
	const description = descMatch ? descMatch[1].trim() : "Studio multi-agent chain";

	const stepBlocks = body.split(/^##\s+/m).filter(Boolean);
	const steps: StudioChain["steps"] = [];

	for (const block of stepBlocks) {
		const lines = block.split("\n");
		const agent = lines[0].trim();
		if (!agent || agent.startsWith(">")) continue;

		let reads: string | undefined;
		let output: string | undefined;
		const instructions: string[] = [];

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith("reads:")) {
				reads = line.replace(/^reads:\s*/, "").trim();
			} else if (line.startsWith("output:")) {
				output = line.replace(/^output:\s*/, "").trim();
			} else if (line.startsWith("outputMode:") || line.startsWith("progress:")) {
				continue;
			} else {
				instructions.push(line);
			}
		}

		steps.push({
			agent,
			reads,
			output,
			instructions: instructions.join("\n").trim(),
		});
	}

	const titles: Record<string, string> = {
		"gdd-review": "📋 Revisión Integral de GDD (Visión, Mecánicas, Arquitectura, Producción)",
		"feature-implement": "⚡ Implementación de Mecánica (Diseño, Arquitectura, Código, QA)",
		"release-gate": "🛡️ Auditoría de Milestone / Release (QA, Rendimiento, Seguridad, Release)",
	};

	return {
		name,
		title: titles[name] || `🔗 Cadena: ${name}`,
		description,
		steps,
	};
}

export async function handleStudioChains(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const query = args?.trim().toLowerCase() || "";
	const chains = loadAvailableChains(ctx.cwd);

	if (chains.length === 0) {
		const msg = "No se encontraron cadenas de ejecución en chains/ o .pi/chains/.";
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify(msg, "warning");
		} else {
			console.log(msg);
		}
		return;
	}

	// Direct execution by chain name
	if (query) {
		const targetChain = chains.find(
			(c) => c.name.toLowerCase() === query || c.name.includes(query),
		);
		if (targetChain) {
			displayChainDetails(ctx, targetChain);
			return;
		}
	}

	// Interactive select mode
	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = [
			...chains.map(
				(c) => `${c.title}\n   (${c.steps.length} etapas: ${c.steps.map((s) => s.agent).join(" ➔ ")})`,
			),
			"📋 Ver descripción de todas las cadenas",
		];

		const selected = await (ctx.ui as any).select(
			"🎮 Pi Game Studio — Cadenas de Ejecución Multi-Agente (Chains)",
			options,
		);

		if (selected === undefined || selected === null) return;

		const idx = typeof selected === "number" ? selected : options.indexOf(selected);
		if (idx === -1) return;

		if (idx < chains.length) {
			displayChainDetails(ctx, chains[idx]);
		} else {
			displayAllChains(ctx, chains);
		}
		return;
	}

	// CLI fallback
	displayAllChains(ctx, chains);
}

function displayChainDetails(ctx: ExtensionContext, chain: StudioChain): void {
	const lines = [
		`🎮 CADENA DE ESTUDIO: ${chain.name.toUpperCase()}`,
		`• Descripción: ${chain.description}`,
		`• Flujo secuencial (${chain.steps.length} etapas):`,
	];

	chain.steps.forEach((s, i) => {
		lines.push(`  ${i + 1}. [${s.agent}]`);
		if (s.reads) lines.push(`     📖 Lee:     ${s.reads}`);
		if (s.output) lines.push(`     📝 Genera:  ${s.output}`);
		if (s.instructions) lines.push(`     💡 Misión:  ${s.instructions.slice(0, 100)}...`);
	});

	lines.push("");
	lines.push(`💡 Para ejecutar esta cadena, escribe en el chat de Pi:`);
	lines.push(`   "Ejecuta la cadena ${chain.name} para mi documento/feature"`);

	const output = lines.join("\n");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(output, "info");
	} else {
		console.log(output);
	}
}

function displayAllChains(ctx: ExtensionContext, chains: StudioChain[]): void {
	const lines = [
		"🎮 PI GAME STUDIO — CATÁLOGO DE CADENAS (CHAINS)",
		"Pipelines multi-agente guiados para desarrollo estructurado de videojuegos:",
		"",
	];

	for (const c of chains) {
		lines.push(`🔗 ${c.name}`);
		lines.push(`   ${c.description}`);
		lines.push(`   Etapas: ${c.steps.map((s) => s.agent).join(" ➔ ")}`);
		lines.push("");
	}

	lines.push("Uso interactivo: /studio:chains o /studio:chain <nombre>");

	const output = lines.join("\n");
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(output, "info");
	} else {
		console.log(output);
	}
}
