import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type EngineName = "Bevy" | "Godot" | "Phaser" | "Raylib" | "Unity" | "Unreal" | "Desconocido";

export interface EngineDetectionResult {
	detected: boolean;
	engine: EngineName;
	version?: string;
	language: string;
	sourceFile: string;
	details: string;
	isConfigured: boolean; // True if specified in project.yaml
}

const ENGINE_ALIASES: Array<{ match: RegExp; engine: EngineName; language: string }> = [
	{ match: /bevy/, engine: "Bevy", language: "Rust" },
	{ match: /godot/, engine: "Godot", language: "GDScript" },
	{ match: /raylib/, engine: "Raylib", language: "C++" },
	{ match: /phaser/, engine: "Phaser", language: "TypeScript" },
	{ match: /unity/, engine: "Unity", language: "C#" },
	{ match: /unreal/, engine: "Unreal", language: "C++ / Blueprints" },
];

/**
 * Maps an engine name as written by a human (in project.yaml or on the command
 * line) to the engine the studio knows how to drive. Returns null when the name
 * matches no supported engine, so an unknown value can never be silently
 * coerced into a real engine.
 */
export function resolveEngineName(raw: string | null | undefined): { engine: EngineName; language: string } | null {
	const norm = (raw || "").toLowerCase().trim();
	if (!norm) return null;
	const alias = ENGINE_ALIASES.find((entry) => entry.match.test(norm));
	return alias ? { engine: alias.engine, language: alias.language } : null;
}

/**
 * Reads the `engine:` line of project.yaml. This is the human's decision and the
 * authority for every engine-dependent choice in the studio.
 */
export function readConfiguredEngine(dir: string): string | null {
	const projectYaml = join(dir, "project.yaml");
	if (!existsSync(projectYaml)) return null;
	try {
		const yaml = readFileSync(projectYaml, "utf8");
		const m = yaml.match(/^engine:\s*["']?([^\n"']+)["']?/m);
		if (!m || !m[1]) return null;
		const value = m[1].trim();
		if (value === "null" || value === "unknown") return null;
		return value;
	} catch {
		return null;
	}
}

/**
 * Automatically inspects a directory and its key project files to determine
 * which game engine is used, along with its version and primary programming language.
 */
export function detectProjectEngine(dir: string): EngineDetectionResult {
	const configuredEngine = readConfiguredEngine(dir);
	const configured = resolveEngineName(configuredEngine);

	// A marker file may only confirm the configured engine, never overrule it.
	// Godot projects routinely carry a Cargo.toml (a copied starter, a vendored
	// crate) and the studio used to compile those as Rust.
	const allowsMarker = (engine: EngineName) => !configured || configured.engine === engine;

	// 1. Check for Bevy (Cargo.toml with bevy dependency)
	const cargoToml = join(dir, "Cargo.toml");
	if (allowsMarker("Bevy") && existsSync(cargoToml)) {
		try {
			const cargo = readFileSync(cargoToml, "utf8");
			// Match bevy = "0.15" or bevy = { version = "0.15", ... } or [dependencies.bevy] version = "0.15"
			const simpleMatch = cargo.match(/(?:^|\n)\s*bevy\s*=\s*(?:\{[^}]*version\s*=\s*["']([^"']+)["']|["']([^"']+)["'])/);
			const tableMatch = cargo.match(/\[dependencies\.bevy\][\s\S]*?version\s*=\s*["']([^"']+)["']/);
			const version = simpleMatch?.[1] || simpleMatch?.[2] || tableMatch?.[1] || (cargo.includes("bevy") ? "detected" : null);

			if (version) {
				return {
					detected: true,
					engine: "Bevy",
					version: version === "detected" ? undefined : version,
					language: "Rust",
					sourceFile: "Cargo.toml",
					details: version === "detected"
						? "Crate Bevy en Cargo.toml"
						: `Bevy ${version} en Cargo.toml`,
					isConfigured: !!configuredEngine,
				};
			}
		} catch {}
	}

	// 2. Check for Godot (project.godot)
	const projectGodot = join(dir, "project.godot");
	if (allowsMarker("Godot") && existsSync(projectGodot)) {
		try {
			const godotContent = readFileSync(projectGodot, "utf8");
			// Look for config/features=PackedStringArray("4.3", ...)
			const featMatch = godotContent.match(/config\/features=PackedStringArray\([^)]*"([0-9]+\.[0-9]+)"/);
			const version = featMatch ? featMatch[1] : "4.x";

			// Detect if C# (.csproj / *.cs) or GDScript
			let isCSharp = false;
			try {
				const files = readdirSync(dir);
				isCSharp = files.some((f) => f.endsWith(".csproj") || f.endsWith(".sln"));
			} catch {}

			return {
				detected: true,
				engine: "Godot",
				version,
				language: isCSharp ? "C#" : "GDScript",
				sourceFile: "project.godot",
				details: `Godot ${version} (${isCSharp ? "C#" : "GDScript"})`,
				isConfigured: !!configuredEngine,
			};
		} catch {}
	}

	// 3. Check for Raylib (CMakeLists.txt with raylib or main.cpp/c with raylib.h)
	const cmakeLists = join(dir, "CMakeLists.txt");
	let hasRaylibCMake = false;
	let raylibVersion: string | undefined;

	if (existsSync(cmakeLists)) {
		try {
			const cmake = readFileSync(cmakeLists, "utf8");
			if (/raylib/i.test(cmake)) {
				hasRaylibCMake = true;
				const tagMatch = cmake.match(/GIT_TAG\s+([0-9]+\.[0-9]+(?:\.[0-9]+)?)/i);
				if (tagMatch) raylibVersion = tagMatch[1];
			}
		} catch {}
	}

	let hasRaylibSource = false;
	const candidateSources = [
		join(dir, "src", "main.cpp"),
		join(dir, "src", "main.c"),
		join(dir, "main.cpp"),
		join(dir, "main.c"),
	];

	for (const src of candidateSources) {
		if (existsSync(src)) {
			try {
				const content = readFileSync(src, "utf8");
				if (content.includes("raylib.h")) {
					hasRaylibSource = true;
					break;
				}
			} catch {}
		}
	}

	if (allowsMarker("Raylib") && (hasRaylibCMake || hasRaylibSource)) {
		let isCpp = existsSync(join(dir, "src", "main.cpp")) || existsSync(join(dir, "main.cpp"));
		if (!isCpp && existsSync(cmakeLists)) {
			try {
				const cmake = readFileSync(cmakeLists, "utf8");
				if (/CXX/i.test(cmake) || /cpp/i.test(cmake)) isCpp = true;
			} catch {}
		}

		return {
			detected: true,
			engine: "Raylib",
			version: raylibVersion || "5.x",
			language: isCpp ? "C++" : "C",
			sourceFile: hasRaylibCMake ? "CMakeLists.txt" : "source files",
			details: `Raylib ${raylibVersion || "5.x"} (${isCpp ? "C++" : "C"})`,
			isConfigured: !!configuredEngine,
		};
	}

	// 4. Check for Unity (ProjectSettings/ProjectVersion.txt)
	const unityVersionPath = join(dir, "ProjectSettings", "ProjectVersion.txt");
	if (allowsMarker("Unity") && existsSync(unityVersionPath)) {
		try {
			const content = readFileSync(unityVersionPath, "utf8");
			const m = content.match(/m_EditorVersion:\s*([^\r\n]+)/);
			const version = m ? m[1].trim() : undefined;
			return {
				detected: true,
				engine: "Unity",
				version,
				language: "C#",
				sourceFile: "ProjectSettings/ProjectVersion.txt",
				details: version ? `Unity ${version}` : "Proyecto Unity",
				isConfigured: !!configuredEngine,
			};
		} catch {}
	}

	// 5. Check for Unreal Engine (*.uproject)
	try {
		const files = readdirSync(dir);
		const uproject = allowsMarker("Unreal") ? files.find((f) => f.endsWith(".uproject")) : undefined;
		if (uproject) {
			let version: string | undefined;
			try {
				const content = readFileSync(join(dir, uproject), "utf8");
				const json = JSON.parse(content);
				if (json.EngineAssociation) version = String(json.EngineAssociation);
			} catch {}

			return {
				detected: true,
				engine: "Unreal",
				version,
				language: "C++ / Blueprints",
				sourceFile: uproject,
				details: version ? `Unreal Engine ${version}` : "Proyecto Unreal Engine",
				isConfigured: !!configuredEngine,
			};
		}
	} catch {}

	// 6. Check for Phaser (package.json with phaser dependency)
	const packageJsonPath = join(dir, "package.json");
	if (allowsMarker("Phaser") && existsSync(packageJsonPath)) {
		try {
			const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8"));
			const phaserVersion =
				pkg?.dependencies?.phaser ||
				pkg?.devDependencies?.phaser ||
				pkg?.peerDependencies?.phaser;
			if (phaserVersion) {
				const cleanVersion = String(phaserVersion).replace(/[\^~>=<]/g, "").trim();
				const isTs =
					existsSync(join(dir, "tsconfig.json")) ||
					pkg?.devDependencies?.typescript ||
					pkg?.dependencies?.typescript;
				return {
					detected: true,
					engine: "Phaser",
					version: cleanVersion,
					language: isTs ? "TypeScript" : "JavaScript",
					sourceFile: "package.json",
					details: `Phaser ${cleanVersion} (${isTs ? "TypeScript" : "JavaScript"})`,
					isConfigured: !!configuredEngine,
				};
			}
		} catch {}
	}

	// 7. The configured engine answers on its own when no marker confirmed it.
	if (configured) {
		return {
			detected: true,
			engine: configured.engine,
			version: undefined,
			language: configured.language,
			sourceFile: "project.yaml",
			details: `${configured.engine} (configurado en project.yaml)`,
			isConfigured: true,
		};
	}

	return {
		detected: false,
		engine: "Desconocido",
		language: "Desconocido",
		sourceFile: "",
		details: "Ningún archivo de motor detectado",
		isConfigured: false,
	};
}

/**
 * Returns a human-friendly string describing the detected engine and version.
 * e.g. "Bevy 0.15 (Rust)" or "Godot 4.3 (GDScript)"
 */
export function formatEngineBadge(result: EngineDetectionResult): string {
	if (!result.detected) {
		return "Godot · Unity · Unreal · Bevy · Raylib";
	}
	const ver = result.version ? ` ${result.version}` : "";
	return `${result.engine}${ver} (${result.language})`;
}
