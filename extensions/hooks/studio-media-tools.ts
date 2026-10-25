import { ACCENT } from "./studio-palette.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { execSync } from "node:child_process";
import { promptSelectSafe } from "./studio-setup.ts";

export interface MediaToolDef {
	id: string;
	name: string;
	bin: string;
	brewPkg: string;
	category: string;
	whyNeeded: string;
	benefitedRoles: string[];
	essential: boolean;
}

export const MEDIA_TOOLS_REGISTRY: MediaToolDef[] = [
	{
		id: "ffmpeg",
		name: "FFmpeg",
		bin: "ffmpeg",
		brewPkg: "ffmpeg",
		category: "Audio, Video & Compresión",
		whyNeeded: "Normalizar volumen de audio, recortar silencios y convertir sonidos pesados (.wav) a formatos óptimos (.ogg/.mp3) para web y móvil.",
		benefitedRoles: ["audio-director", "gameplay-programmer"],
		essential: true,
	},
	{
		id: "imagemagick",
		name: "ImageMagick",
		bin: "magick", // en brew moderno es magick o convert
		brewPkg: "imagemagick",
		category: "Imágenes 2D & Spritesheets",
		whyNeeded: "Empaquetar sprites sueltos en spritesheets (atlas), recortar márgenes transparentes, reescalar texturas y generar iconos en múltiples resoluciones.",
		benefitedRoles: ["art-director", "gameplay-programmer"],
		essential: true,
	},
	{
		id: "assimp",
		name: "Assimp (Open Asset Import)",
		bin: "assimp",
		brewPkg: "assimp",
		category: "Modelos 3D & Conversión",
		whyNeeded: "Convertir modelos 3D (.obj, .fbx, .dae) a .gltf/.glb en milisegundos desde CLI sin la sobrecarga ni el tiempo de carga de Blender.",
		benefitedRoles: ["art-director", "technical-director"],
		essential: true,
	},
	{
		id: "git-lfs",
		name: "Git LFS (Large File Storage)",
		bin: "git-lfs",
		brewPkg: "git-lfs",
		category: "Versionado de Assets Pesados",
		whyNeeded: "Evitar que archivos pesados (texturas de alta resolución, audio WAV, modelos 3D .glb) inflen el historial Git del repositorio.",
		benefitedRoles: ["producer", "technical-director"],
		essential: true,
	},
	{
		id: "free-tex-packer-cli",
		name: "Free Texture Packer CLI",
		bin: "free-tex-packer-cli",
		brewPkg: "free-tex-packer-cli",
		category: "Atlas de Sprites 2D & Metadatos",
		whyNeeded: "Empaquetado algorítmico de spritesheets (MaxRects), recorte de transparencias y exportación de descriptores de coordenadas JSON/Godot/Raylib.",
		benefitedRoles: ["art-director", "gameplay-programmer"],
		essential: true,
	},
	{
		id: "gltfpack",
		name: "gltfpack (meshoptimizer)",
		bin: "gltfpack",
		brewPkg: "gltfpack",
		category: "Optimización 3D & glTF",
		whyNeeded: "Optimización de mallas glTF/GLB para GPU, simplificación automática con generación de LODs y compresión de vertex cache (meshopt).",
		benefitedRoles: ["art-director", "technical-director"],
		essential: false,
	},
	{
		id: "gltf-transform",
		name: "glTF-Transform (CLI)",
		bin: "gltf-transform",
		brewPkg: "gltf-transform",
		category: "Inspección & Diagnóstico 3D",
		whyNeeded: "Inspección de mallas en consola ('gltf-transform inspect'), auditoría de draw calls, recuento de polígonos y validación de assets GLTF/GLB.",
		benefitedRoles: ["art-director", "technical-director"],
		essential: false,
	},
	{
		id: "oxipng",
		name: "oxipng",
		bin: "oxipng",
		brewPkg: "oxipng",
		category: "Optimización de Sprites PNG",
		whyNeeded: "Optimizador multihilo sin pérdida de calidad (lossless) para reducir el tamaño de sprites y texturas 2D en disco hasta un 40%.",
		benefitedRoles: ["art-director", "gameplay-programmer"],
		essential: true,
	},
	{
		id: "pngquant",
		name: "pngquant",
		bin: "pngquant",
		brewPkg: "pngquant",
		category: "Cuantización de Texturas PBR & 2D",
		whyNeeded: "Cuantización inteligente a 8-bit con canal alfa, reduciendo drásticamente el peso de texturas de alta resolución (hasta 70%) antes de optimizar con oxipng.",
		benefitedRoles: ["art-director", "gameplay-programmer"],
		essential: false,
	},
	{
		id: "wasm-opt",
		name: "wasm-opt (Binaryen)",
		bin: "wasm-opt",
		brewPkg: "binaryen",
		category: "Optimización WebAssembly",
		whyNeeded: "Optimizador oficial de bytecode WASM para reducir el peso de builds web en Bevy, Godot y Raylib hasta un 65% para itch.io y navegador.",
		benefitedRoles: ["bevy-specialist", "godot-specialist", "raylib-specialist", "technical-director"],
		essential: true,
	},
	{
		id: "butler",
		name: "Butler (Itch.io CLI)",
		bin: "butler",
		brewPkg: "--cask butler",
		category: "Distribución & Lanzamiento",
		whyNeeded: "Publicación y actualización automática de builds y demos a itch.io mediante parches delta en 1 línea de comandos.",
		benefitedRoles: ["producer", "technical-director"],
		essential: false,
	},
	{
		id: "gh",
		name: "GitHub CLI (gh)",
		bin: "gh",
		brewPkg: "gh",
		category: "Control de Versiones & Releases",
		whyNeeded: "Creación automática de Pull Requests, publicación de releases con binarios adjuntos y gestión de issues y workflows de CI/CD.",
		benefitedRoles: ["producer", "technical-director", "qa-lead"],
		essential: true,
	},
	{
		id: "watchexec",
		name: "watchexec",
		bin: "watchexec",
		brewPkg: "watchexec",
		category: "Live-Reload & Hot Compilation",
		whyNeeded: "Monitor de cambios en archivos de código fuente y shaders para recompilar o relanzar pruebas automáticamente en tiempo real.",
		benefitedRoles: ["gameplay-programmer", "bevy-specialist", "godot-specialist", "raylib-specialist"],
		essential: false,
	},
];

export interface ToolCheckResult {
	tool: MediaToolDef;
	installed: boolean;
	path?: string;
}

export function checkToolInstalled(bin: string): { installed: boolean; path?: string } {
	try {
		// check with which or type
		const out = execSync(`which ${bin} 2>/dev/null || which convert 2>/dev/null`, {
			encoding: "utf8",
			timeout: 2000,
		}).trim();
		return { installed: Boolean(out), path: out };
	} catch {
		return { installed: false };
	}
}

export function auditMediaTools(): ToolCheckResult[] {
	return MEDIA_TOOLS_REGISTRY.map((t) => {
		const res = checkToolInstalled(t.bin);
		return {
			tool: t,
			installed: res.installed,
			path: res.path,
		};
	});
}

export async function promptMediaToolsInstall(
	ctx: ExtensionContext,
): Promise<void> {
	const audit = auditMediaTools();
	const missing = audit.filter((a) => !a.installed);

	if (missing.length === 0) {
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify("Todas las herramientas multimedia FOSS están instaladas en el sistema.", "info");
		} else {
			console.log("\n[OK] Todas las herramientas multimedia CLI están instaladas.");
		}
		return;
	}

	const hasBrew = checkToolInstalled("brew").installed;
	if (!hasBrew) {
		console.warn("Homebrew no está instalado en el sistema. Instala Homebrew primero (https://brew.sh).");
		return;
	}

	if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
		const options = [
			`🚀 Instalar Paquete Esencial Recomendado (${missing.filter(m => m.tool.essential).map(m => m.tool.name).join(", ")})`,
			`✨ Instalar Todas las Faltantes (${missing.map(m => m.tool.name).join(", ")})`,
			"🔍 Seleccionar herramientas una por una",
			"⏩ Omitir por ahora (Continuar sin herramientas multimedia)",
		];

		const summary = [
			"DIAGNÓSTICO DE HERRAMIENTAS MULTIMEDIA (FOSS CLI):",
			"Los agentes de Pi Game Studio necesitan estas utilidades para transformar sprites, audio y 3D automáticamente:\n",
			...missing.map(
				(m) => `• ${m.tool.name.padEnd(14)} [${m.tool.category}]\n  - ¿Por qué?: ${m.tool.whyNeeded}\n  - Roles: ${m.tool.benefitedRoles.join(", ")}`,
			),
		].join("\n");

		const choice = await promptSelectSafe(
			ctx,
			summary + "\n\n¿Deseas instalar las herramientas faltantes con Homebrew?",
			options,
		);

		if (!choice || choice.index === 3) return;

		let pkgsToInstall: string[] = [];

		if (choice.index === 0) {
			pkgsToInstall = missing.filter((m) => m.tool.essential).map((m) => m.tool.brewPkg);
		} else if (choice.index === 1) {
			pkgsToInstall = missing.map((m) => m.tool.brewPkg);
		} else if (choice.index === 2) {
			// One by one
			for (const m of missing) {
				const pick = await promptSelectSafe(
					ctx,
					`Herramienta: ${m.tool.name}\nCategoría: ${m.tool.category}\nUtilidad: ${m.tool.whyNeeded}\nComando: brew install ${m.tool.brewPkg}`,
					[`Instalar ${m.tool.name}`, `Omitir ${m.tool.name}`],
				);
				if (pick && pick.index === 0) {
					pkgsToInstall.push(m.tool.brewPkg);
				}
			}
		}

		if (pkgsToInstall.length > 0) {
			executeBrewInstall(ctx, pkgsToInstall);
		}
	} else {
		// Terminal CLI fallback
		console.log("\n\x1b[1m" + ACCENT + "DIAGNÓSTICO DE VIABILIDAD MULTIMEDIA (FOSS CLI)\x1b[0m");
		for (const m of missing) {
			console.log(`\n\x1b[33m[FALTA]\x1b[0m \x1b[1m${m.tool.name}\x1b[0m (${m.tool.category})`);
			console.log(`  \x1b[2m• Utilidad:\x1b[0m ${m.tool.whyNeeded}`);
			console.log(`  \x1b[2m• Instalar con:\x1b[0m brew install ${m.tool.brewPkg}`);
		}
		console.log(`\n\x1b[36mComando recomendado:\x1b[0m brew install ${missing.filter(m => m.tool.essential).map(m => m.tool.brewPkg).join(" ")}\n`);
	}
}

function executeBrewInstall(ctx: ExtensionContext, pkgs: string[]): void {
	const cmd = `brew install ${pkgs.join(" ")}`;
	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(`Instalando herramientas: ${pkgs.join(", ")}... Por favor espera unos segundos.`, "info");
	}
	console.log(`\nEjecutando: ${cmd}\n`);
	try {
		execSync(cmd, { stdio: "inherit", timeout: 180000 });
		if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
			ctx.ui.notify("Herramientas multimedia instaladas con éxito.", "info");
		}
	} catch (err: any) {
		console.error(`Error al ejecutar brew install: ${err?.message || err}`);
	}
}
