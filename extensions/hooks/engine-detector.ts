import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface EngineDetectionResult {
	detected: boolean;
	engine: "Bevy" | "Godot" | "Raylib" | "Unity" | "Unreal" | "Desconocido";
	version?: string;
	language: string;
	sourceFile: string;
	details: string;
	isConfigured: boolean; // True if specified in project.yaml
}

/**
 * Automatically inspects a directory and its key project files to determine
 * which game engine is used, along with its version and primary programming language.
 */
export function detectProjectEngine(dir: string): EngineDetectionResult {
	let configuredEngine: string | null = null;
	const projectYaml = join(dir, "project.yaml");

	if (existsSync(projectYaml)) {
		try {
			const yaml = readFileSync(projectYaml, "utf8");
			const m = yaml.match(/^engine:\s*["']?([^\n"']+)["']?/m);
			if (m && m[1] && m[1] !== "null" && m[1] !== "unknown") {
				configuredEngine = m[1].trim();
			}
		} catch {}
	}

	// 1. Check for Bevy (Cargo.toml with bevy dependency)
	const cargoToml = join(dir, "Cargo.toml");
	if (existsSync(cargoToml)) {
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
	if (existsSync(projectGodot)) {
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

	if (hasRaylibCMake || hasRaylibSource) {
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
	if (existsSync(unityVersionPath)) {
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
		const uproject = files.find((f) => f.endsWith(".uproject"));
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

	// 6. Fallback to configuredEngine if specified in project.yaml
	if (configuredEngine) {
		const norm = configuredEngine.toLowerCase();
		let engineName: "Bevy" | "Godot" | "Raylib" | "Unity" | "Unreal" = "Godot";
		let lang = "GDScript";

		if (norm.includes("bevy")) {
			engineName = "Bevy";
			lang = "Rust";
		} else if (norm.includes("raylib")) {
			engineName = "Raylib";
			lang = "C++";
		} else if (norm.includes("unity")) {
			engineName = "Unity";
			lang = "C#";
		} else if (norm.includes("unreal")) {
			engineName = "Unreal";
			lang = "C++";
		}

		return {
			detected: true,
			engine: engineName,
			version: undefined,
			language: lang,
			sourceFile: "project.yaml",
			details: `${engineName} (configurado en project.yaml)`,
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
