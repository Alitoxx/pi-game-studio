const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const ROOT_DIR = path.resolve(__dirname, "..");

describe("End-to-End Game Creation Flows (All 5 Engines)", () => {
	const starters = [
		{
			id: "bevy-2d-arpg",
			alias: "bevy",
			engine: "Bevy",
			version: "0.15",
			language: "Rust",
			sourceFile: "Cargo.toml",
			expectedFiles: ["Cargo.toml", "Cargo.lock", "src/main.rs", "project.yaml", "README.md"],
			runCommand: "cargo run",
		},
		{
			id: "godot-2d-character",
			alias: "godot",
			engine: "Godot",
			version: "4.3",
			language: "GDScript",
			sourceFile: "project.godot",
			expectedFiles: ["project.godot", "main.tscn", "scripts/player.gd", "project.yaml", "README.md"],
			runCommand: "godot project.godot",
		},
		{
			id: "raylib-cpp-entt",
			alias: "raylib",
			engine: "Raylib",
			version: "5.5",
			language: "C++",
			sourceFile: "CMakeLists.txt",
			expectedFiles: ["CMakeLists.txt", "src/main.cpp", "project.yaml", "README.md"],
			runCommand: "cmake -B build && cmake --build build && ./build/game",
		},
		{
			id: "unity-2d-platformer",
			alias: "unity",
			engine: "Unity",
			version: "2022.3.20f1",
			language: "C#",
			sourceFile: "ProjectSettings/ProjectVersion.txt",
			expectedFiles: [
				"ProjectSettings/ProjectVersion.txt",
				"ProjectSettings/ProjectSettings.asset",
				"Assets/Scripts/PlayerController.cs",
				"Packages/manifest.json",
				"project.yaml",
				"README.md",
			],
			runCommand: "Abrir en Unity Hub y presionar Play",
		},
		{
			id: "ue5-third-person",
			alias: "unreal",
			engine: "Unreal",
			version: "5.4",
			language: "C++ / Blueprints",
			sourceFile: "Game.uproject",
			expectedFiles: [
				"Game.uproject",
				"Source/Game/Game.Build.cs",
				"Config/DefaultEngine.ini",
				"project.yaml",
				"README.md",
			],
			runCommand: "Abrir Game.uproject en Unreal Editor",
		},
	];

	function runEngineCreation(starterArg, targetDir) {
		const runnerScript = `
			import { handleStudioNew } from "./extensions/hooks/studio-new.ts";
			import { detectProjectEngine } from "./extensions/hooks/engine-detector.ts";

			const target = process.argv[1];
			const starter = process.argv[2];

			const mockCtx = {
				cwd: target,
				hasUI: false,
				ui: {}
			};

			const origLog = console.log;
			console.log = () => {};
			await handleStudioNew(starter, mockCtx);
			console.log = origLog;

			const detection = detectProjectEngine(target);
			process.stdout.write("__START_JSON__" + JSON.stringify(detection) + "__END_JSON__");
		`;

		const output = execFileSync(
			process.execPath,
			["--experimental-strip-types", "-e", runnerScript, targetDir, starterArg],
			{
				cwd: ROOT_DIR,
				encoding: "utf8",
			}
		);

		const match = output.match(/__START_JSON__([\s\S]*?)__END_JSON__/);
		if (!match) {
			throw new Error("Failed to extract JSON from output: " + output);
		}
		return JSON.parse(match[1]);
	}

	test("all 5 starters exist in repository with required starter assets", () => {
		for (const starter of starters) {
			const starterDir = path.join(ROOT_DIR, "starters", starter.id);
			expect(fs.existsSync(starterDir)).toBe(true);

			for (const file of starter.expectedFiles) {
				const filePath = path.join(starterDir, file);
				expect(fs.existsSync(filePath)).toBe(true);
			}

			// Validate project.yaml in starter
			const yamlContent = fs.readFileSync(path.join(starterDir, "project.yaml"), "utf8");
			expect(yamlContent).toMatch(new RegExp(`engine:\\s*["\']?${starter.engine}["\']?`, "i"));
		}
	});

	for (const starter of starters) {
		describe(`Creation Flow: ${starter.engine} (${starter.id})`, () => {
			let tmpDir;

			beforeEach(() => {
				tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `pi-test-flow-${starter.alias}-`));
			});

			afterEach(() => {
				if (tmpDir && fs.existsSync(tmpDir)) {
					fs.rmSync(tmpDir, { recursive: true, force: true });
				}
			});

			test(`scaffolds project and detects ${starter.engine} using alias "${starter.alias}"`, () => {
				const detection = runEngineCreation(starter.alias, tmpDir);

				expect(detection.detected).toBe(true);
				expect(detection.engine).toBe(starter.engine);
				expect(detection.language).toBe(starter.language);
				expect(detection.version).toBe(starter.version);
				expect(detection.sourceFile).toBe(starter.sourceFile);

				// Verify all expected scaffolded files exist in targetDir
				for (const relFile of starter.expectedFiles) {
					const dest = path.join(tmpDir, relFile);
					expect(fs.existsSync(dest)).toBe(true);
				}

				// Verify .pi/game-studio directory and local package binding in .pi/settings.json
				const studioDir = path.join(tmpDir, ".pi", "game-studio");
				expect(fs.existsSync(studioDir)).toBe(true);

				const settingsFile = path.join(tmpDir, ".pi", "settings.json");
				expect(fs.existsSync(settingsFile)).toBe(true);
				const settings = JSON.parse(fs.readFileSync(settingsFile, "utf8"));
				expect(Array.isArray(settings.packages)).toBe(true);
				expect(settings.packages).toContain(ROOT_DIR);
			});
		});
	}

	test("prevents accidental overwrite when target directory has conflicts", () => {
		const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-test-conflict-"));
		try {
			// Simulate existing project file
			fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), "# existing cargo file");

			const runnerScript = `
				import { handleStudioNew } from "./extensions/hooks/studio-new.ts";

				const target = process.argv[1];
				let logOutput = "";
				const origLog = console.log;
				console.log = (...args) => {
					logOutput += args.join(" ") + "\\n";
				};

				const mockCtx = {
					cwd: target,
					hasUI: false,
					ui: {}
				};

				await handleStudioNew("godot", mockCtx);
				process.stdout.write(JSON.stringify({ output: logOutput }));
			`;

			const res = JSON.parse(
				execFileSync(
					process.execPath,
					["--experimental-strip-types", "-e", runnerScript, tmpDir],
					{
						cwd: ROOT_DIR,
						encoding: "utf8",
					}
				).trim()
			);

			expect(res.output).toContain("ya contiene archivos de proyecto");
			expect(fs.existsSync(path.join(tmpDir, "project.godot"))).toBe(false);
		} finally {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	});
});
