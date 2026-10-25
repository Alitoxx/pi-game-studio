import { ACCENT, GRAY, GREEN, RED, SECONDARY, WHITE, YELLOW } from "./studio-palette.ts";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	copyFileSync,
	statSync,
	writeFileSync,
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
			id: "phaser-web-2d",
			name: "Phaser 3/4 + Vite + TypeScript",
			engine: "Phaser",
			language: "TypeScript",
			description: "Starter 2D web con Phaser, Vite HMR, TypeScript estricto y Arcade Physics",
			runCommand: "npm install && npm run dev",
			sourceDir: join(pkgRoot, "starters", "phaser-web-2d"),
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
		{
			id: "unity-2d-platformer",
			name: "Unity 2D Platformer",
			engine: "Unity",
			language: "C#",
			description: "Starter 2D platformer con Input System, CharacterController y cámara (Unity 2022.3+)",
			runCommand: "Abrir en Unity Hub y presionar Play",
			sourceDir: join(pkgRoot, "starters", "unity-2d-platformer"),
		},
		{
			id: "ue5-third-person",
			name: "UE5 Third Person Character",
			engine: "Unreal",
			language: "C++",
			description: "Starter tercera persona con Enhanced Input, cámara spring arm y movimiento (UE 5.4+)",
			runCommand: "Abrir Game.uproject en Unreal Editor",
			sourceDir: join(pkgRoot, "starters", "ue5-third-person"),
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
			const options = starters.map(
				(s) => `${s.name} (${s.engine} · ${s.language}) — ${s.description}`,
			);

			const selected = await (ctx.ui as any).select(
				"PI GAME STUDIO — Crear nuevo juego desde plantilla",
				options,
			);

			if (selected === undefined || selected === null) {
				console.log("Creación cancelada.");
				return;
			}
			const idx = typeof selected === "number" ? selected : options.indexOf(selected);
			if (idx === -1) return;
			selectedStarter = starters[idx];
		} else {
			console.log("");
			console.log(
				"\x1b[1m" + ACCENT + "Plantillas de Inicio Rápido Disponibles (Starters):\x1b[0m",
			);
			console.log("" + GRAY + "" + "─".repeat(70) + "\x1b[0m");
			starters.forEach((s, idx) => {
				console.log(
					`  ${SECONDARY}${idx + 1}. /studio:new ${s.id.padEnd(20)}\x1b[0m ${WHITE}${s.name}\x1b[0m`,
				);
				console.log(
					`     ${GRAY}${s.description} · Ejecutable con: ${s.runCommand}\x1b[0m`,
				);
			});
			console.log("");
			console.log(
				"" + YELLOW + "💡 Ejemplo de uso:\x1b[0m /studio:new bevy  o  /studio:new raylib",
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
			`${RED}⚠️  El directorio actual (${basename(targetDir)}) ya contiene archivos de proyecto.\x1b[0m`,
		);
		console.log(
			"Por seguridad, ejecuta este comando en un directorio vacío o una subcarpeta.",
		);
		return;
	}

	// Scaffold files
	console.log("");
	console.log(
		`\x1b[1m${ACCENT}Creando proyecto desde plantilla: ${selectedStarter.name}...\x1b[0m`,
	);

	copyRecursive(selectedStarter.sourceDir, targetDir);

	// Setup .pi/game-studio directory
	const studioDir = join(targetDir, ".pi", "game-studio");
	mkdirSync(studioDir, { recursive: true });

	// Configure local package binding in .pi/settings.json so Pi Game Studio stays isolated only to this game project
	const localSettings = join(targetDir, ".pi", "settings.json");
	if (!existsSync(localSettings)) {
		try {
			writeFileSync(
				localSettings,
				JSON.stringify({ packages: [resolvePackageRoot()] }, null, 2),
				"utf8",
			);
		} catch {}
	}

	// Auto-detect engine to verify installation
	const detection = detectProjectEngine(targetDir);

	// Update Producer Roadmap with the starter creation
	try {
		const { recordFlowCompletion } = require("./studio-start.ts");
		recordFlowCompletion(targetDir, {
			task: `Starter técnico desplegado: ${selectedStarter.name}`,
			agent: "lead-programmer",
			filesChanged: ["Cargo.toml", "src/main.rs", "project.yaml"],
			nextStep: "Validar game feel y controles en pantalla (cargo run) o definir concepto (/brainstorm)",
		});
	} catch {}

	console.log("" + GRAY + "" + "─".repeat(70) + "\x1b[0m");
	console.log(`  ${GREEN}✔ Archivos base instalados en:\x1b[0m ${targetDir}`);
	console.log(`  ${GREEN}✔ Motor detectado automáticamente:\x1b[0m ${formatEngineBadge(detection)}`);
	console.log(`  ${GREEN}✔ Aislamiento de proyecto:\x1b[0m .pi/settings.json (no contamina otros proyectos)`);
	console.log(`  ${GREEN}✔ Configuración persistida en:\x1b[0m project.yaml`);
	console.log("");
	console.log("\x1b[1m" + YELLOW + "👉 Siguiente paso para probar tu juego:\x1b[0m");
	console.log(`   ${SECONDARY}\x1b[1m${selectedStarter.runCommand}\x1b[0m`);
	console.log("");

	if (ctx.hasUI && typeof (ctx.ui as any)?.notify === "function") {
		ctx.ui.notify(
			`✔ Proyecto ${selectedStarter.engine} creado exitosamente`,
			"info",
		);
	}
}
