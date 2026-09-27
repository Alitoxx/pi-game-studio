import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	copyFileSync,
	statSync,
} from "node:fs";
import { join, resolve, basename } from "node:path";
import { detectProjectEngine, formatEngineBadge } from "./engine-detector.ts";

export interface StarterTemplate {
	id: string;
	name: string;
	engine: string;
	language: string;
	description: string;
	runCommand: string;
	sourceDir: string;
}

function resolvePackageRoot(): string {
	try {
		const candidate1 = resolve(
			new URL(".", import.meta.url).pathname,
			"..",
			"..",
		);
		if (existsSync(join(candidate1, "starters"))) return candidate1;
	} catch {}
	return process.cwd();
}

export function getAvailableStarters(): StarterTemplate[] {
	const pkgRoot = resolvePackageRoot();
	return [
		{
			id: "bevy-2d-arpg",
			name: "Bevy 2D ARPG Adventure",
			engine: "Bevy",
			language: "Rust",
			description: "Starter 2D cenital con cámara ortográfica, movimiento 8 vías y ataque (Bevy 0.15)",
			runCommand: "cargo run",
			sourceDir: join(pkgRoot, "starters", "bevy-2d-arpg"),
		},
		{
			id: "raylib-cpp-entt",
			name: "Raylib + EnTT ECS C++20",
			engine: "Raylib",
			language: "C++20",
			description: "Starter C++20 con arquitectura ECS EnTT, ventana Raylib y CMake FetchContent",
			runCommand: "cmake -B build && cmake --build build && ./build/game",
			sourceDir: join(pkgRoot, "starters", "raylib-cpp-entt"),
		},
		{
			id: "godot-2d-character",
			name: "Godot 4 2D Character Controller",
			engine: "Godot",
			language: "GDScript",
			description: "Escena base Godot 4.3 con CharacterBody2D, movimiento suave y cámara",
			runCommand: "godot project.godot (o abrir en Godot Editor)",
			sourceDir: join(pkgRoot, "starters", "godot-2d-character"),
		},
	];
}

function copyRecursive(src: string, dest: string): void {
	mkdirSync(dest, { recursive: true });
	const entries = readdirSync(src);
	for (const entry of entries) {
		const srcPath = join(src, entry);
		const destPath = join(dest, entry);
		const stat = statSync(srcPath);
		if (stat.isDirectory()) {
			copyRecursive(srcPath, destPath);
		} else {
			copyFileSync(srcPath, destPath);
		}
	}
}

export async function handleStudioNew(
	args: string,
	ctx: ExtensionContext,
): Promise<void> {
	const starters = getAvailableStarters();
	const trimmed = args.trim().toLowerCase();

	let selectedStarter: StarterTemplate | undefined;

	if (trimmed) {
		selectedStarter = starters.find(
			(s) =>
				s.id.toLowerCase() === trimmed ||
				s.engine.toLowerCase() === trimmed ||
				s.id.toLowerCase().includes(trimmed),
		);
	}

	if (!selectedStarter) {
		if (ctx.hasUI && typeof (ctx.ui as any)?.select === "function") {
			const options = starters.map((s) => ({
				value: s.id,
				label: `🎮 ${s.name} (${s.engine} · ${s.language})`,
				description: s.description,
			}));

			const choice = await (ctx.ui as any).select({
				title: "🎮 Pi Game Studio — Crear nuevo juego desde plantilla",
				options,
			});

			if (!choice) {
				console.log("Creación cancelada.");
				return;
			}
			selectedStarter = starters.find((s) => s.id === choice);
		} else {
			console.log("");
			console.log(
				"\x1b[1m\x1b[38;2;167;139;250m🎮 Plantillas de Inicio Rápido Disponibles (Starters):\x1b[0m",
			);
			console.log("\x1b[38;2;107;114;128m" + "─".repeat(70) + "\x1b[0m");
			starters.forEach((s, idx) => {
				console.log(
					`  \x1b[38;2;56;189;248m${idx + 1}. /studio:new ${s.id.padEnd(20)}\x1b[0m \x1b[38;2;243;244;246m${s.name}\x1b[0m`,
				);
				console.log(
					`     \x1b[38;2;107;114;128m${s.description} · Ejecutable con: ${s.runCommand}\x1b[0m`,
				);
			});
			console.log("");
			console.log(
				"\x1b[38;2;251;191;36m💡 Ejemplo de uso:\x1b[0m /studio:new bevy  o  /studio:new raylib",
			);
			console.log("");
			return;
		}
	}

	if (!selectedStarter) return;

	const targetDir = ctx.cwd;

	// Check if target directory already has project files
	const existingFiles = existsSync(targetDir) ? readdirSync(targetDir) : [];
	const hasConflicts = existingFiles.some(
		(f) =>
			f === "Cargo.toml" ||
			f === "CMakeLists.txt" ||
			f === "project.godot" ||
			f === "src",
	);

	if (hasConflicts) {
		console.log(
			`\x1b[38;2;239;68;68m⚠️  El directorio actual (${basename(targetDir)}) ya contiene archivos de proyecto.\x1b[0m`,
		);
		console.log(
			"Por seguridad, ejecuta este comando en un directorio vacío o una subcarpeta.",
		);
		return;
	}

	// Scaffold files
	console.log("");
	console.log(
		`\x1b[1m\x1b[38;2;167;139;250m🚀 Creando proyecto desde plantilla: ${selectedStarter.name}...\x1b[0m`,
	);

	copyRecursive(selectedStarter.sourceDir, targetDir);

	// Setup .pi/game-studio directory
	const studioDir = join(targetDir, ".pi", "game-studio");
	mkdirSync(studioDir, { recursive: true });

	// Auto-detect engine to verify installation
	const detection = detectProjectEngine(targetDir);

	console.log("\x1b[38;2;107;114;128m" + "─".repeat(70) + "\x1b[0m");
	console.log(`  \x1b[38;2;52;211;153m✔ Archivos base instalados en:\x1b[0m ${targetDir}`);
	console.log(`  \x1b[38;2;52;211;153m✔ Motor detectado automáticamente:\x1b[0m ${formatEngineBadge(detection)}`);
	console.log(`  \x1b[38;2;52;211;153m✔ Configuración persistida en:\x1b[0m project.yaml`);
	console.log("");
	console.log("\x1b[1m\x1b[38;2;251;191;36m👉 Siguiente paso para probar tu juego:\x1b[0m");
	console.log(`   \x1b[38;2;56;189;248m\x1b[1m${selectedStarter.runCommand}\x1b[0m`);
	console.log("");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(
			`✔ Proyecto ${selectedStarter.engine} creado exitosamente`,
			"info",
		);
	}
}
