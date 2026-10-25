import { recordFailure } from "./studio-diagnostics.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { findStudioRoot } from "./studio-root.ts";
import { readProducerState } from "./studio-start.ts";
import { ACCENT, ACCENT as BLUE, BOLD, BORDER, CYAN, DIM, GRAY, GREEN, RED, RESET, SECONDARY, WHITE, YELLOW, padAnsi } from "./studio-palette.ts";

export interface FeatureOptions {
	premise?: string;
	rules?: string[];
	targetFps?: number;
}

export function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/[^a-z0-9_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

/**
 * Generates an ODD Live Spec document template conforming to the gamedev protocol.
 */
export function generateLiveSpecTemplate(
	featureName: string,
	options: FeatureOptions = {},
): string {
	const title = featureName
		.split(/[-_]/)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(" ");

	const premise = options.premise || `Mecánica y sistema de ${title} para el juego.`;
	const rules = options.rules && options.rules.length > 0
		? options.rules
		: [
			"El sistema opera con funciones puras sin efectos colaterales ocultos.",
			"Toda transición inválida devuelve Result::Err tipado en lugar de paniquear.",
			"Cero allocations (Vec/String/Box) en el loop principal de gameplay.",
		];

	const targetFps = options.targetFps || 60;

	return [
		`# Live Spec — ${title}`,
		"",
		`> **Feature:** ${title}`,
		`> **Premisa:** ${premise}`,
		`> **Target:** ${targetFps} FPS estables · Cero allocations en loop · Paquetes atómicos ~400 líneas.`,
		"",
		"---",
		"",
		"## 1. Reglas e Invariantes de Diseño",
		"",
		...rules.map((r, i) => `${i + 1}. **Regla ${i + 1}:** ${r}`),
		"",
		"---",
		"",
		"## 2. Diagrama de Estados y Flujo de Datos",
		"",
		"```text",
		"┌───────────────┐          Trigger          ┌───────────────┐",
		"│    Inactivo   │ ────────────────────────► │     Activo    │",
		"└───────────────┘                           └───────────────┘",
		"        ↑                                           │",
		"        │                 Reset                     │",
		"        └───────────────────────────────────────────┘",
		"```",
		"",
		"---",
		"",
		"## 3. Tareas Atómicas de Implementación (~400 líneas c/u)",
		"",
		`- [ ] **T1 — Esquema de Datos**: \`assets/data/${slugify(featureName)}.yaml\` con knobs y deserializador validado con tests.`,
		`- [ ] **T2 — Componentes Core**: Componentes y structs fundamentales del sistema (sin sistemas todavía).`,
		`- [ ] **T3 — State Machine Pura**: Lógica y transiciones de estado puras con tests de casos válidos e inválidos.`,
		`- [ ] **T4 — UI & Feedback**: Presentación visual, marcadores e interacción en pantalla.`,
		`- [ ] **T5 — Sistemas de Gameplay**: Integración con el loop principal y listeners de eventos/mensajes.`,
		`- [ ] **T6 — Smoke Test & Cierre**: Verificación end-to-end, compilación limpia y validación de FPS.`,
		"",
		"---",
		"",
		"## 4. Log de Decisiones y Cambios",
		"",
		`- L1 (${new Date().toISOString().split("T")[0]}): Creación del Live Spec inicial para ${title}.`,
		"",
	].join("\n");
}

/**
 * Creates a Live Spec on disk and registers it in the roadmap.
 */
export function createLiveSpec(
	studioRoot: string,
	rawName: string,
	options: FeatureOptions = {},
): { success: boolean; filePath: string; error?: string } {
	const slug = slugify(rawName);
	if (!slug) {
		return { success: false, filePath: "", error: "Nombre de feature inválido." };
	}

	const gddDir = join(studioRoot, "design", "gdd");
	const filePath = join(gddDir, `${slug}.md`);

	if (existsSync(filePath)) {
		return {
			success: false,
			filePath,
			error: `El Live Spec ya existe en design/gdd/${slug}.md`,
		};
	}

	try {
		mkdirSync(gddDir, { recursive: true });
		const content = generateLiveSpecTemplate(rawName, options);
		writeFileSync(filePath, content, "utf8");

		// Sincronizar en roadmap si existe
		const roadmapPath = join(studioRoot, "production", "roadmap.md");
		if (existsSync(roadmapPath)) {
			try {
				const current = readFileSync(roadmapPath, "utf8");
				const sprintBlock = [
					"",
					`### Sprint — Feature ${slug}`,
					`- [ ] Feature ${slug}: implementar según design/gdd/${slug}.md`,
					"",
				].join("\n");
				writeFileSync(roadmapPath, current + sprintBlock, "utf8");
			} catch (error) {
				recordFailure("roadmap.write", error);
			}
		}

		return { success: true, filePath };
	} catch (err: any) {
		return { success: false, filePath, error: err.message || String(err) };
	}
}

/**
 * Command: /studio:feature <nombre>
 */
export async function handleStudioFeature(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const studioRoot = findStudioRoot(ctx.cwd) || ctx.cwd;
	const trimmed = (args || "").trim();

	if (!trimmed) {
		console.log("\n" + YELLOW + "Uso:\x1b[0m /studio:feature <nombre-del-feature>");
		console.log("Ejemplo: " + SECONDARY + "/studio:feature combate-cuerpo-a-cuerpo\x1b[0m\n");
		return;
	}

	console.log(`\n${BLUE}${BOLD}LIVE SPEC GENERATOR (/studio:feature)${RESET}`);
	console.log(`${DIM}Generando Live Spec atómico ODD en design/gdd/...${RESET}\n`);

	const result = createLiveSpec(studioRoot, trimmed);
	if (!result.success) {
		console.log(`${RED}Error:\x1b[0m ${result.error}\n`);
		return;
	}

	console.log(`${GREEN}✓ Live Spec generado con éxito:\x1b[0m`);
	console.log(`  • Archivo: \x1b[1m${WHITE}${result.filePath}\x1b[0m`);
	console.log(`  • Tareas creadas: ${ACCENT}6 tareas atómicas (T1 a T6)\x1b[0m`);
	console.log(`  • Roadmap: Sincronizado en ${GRAY}production/roadmap.md\x1b[0m\n`);
	console.log(`Siguiente paso: Revisa las reglas en ${SECONDARY}${result.filePath}\x1b[0m y arranca con \x1b[1m/code\x1b[0m o \x1b[1m/studio:next\x1b[0m.\n`);
}
