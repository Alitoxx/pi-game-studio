const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// qa-verifier is the release-gate auditor and the only read-only role: it is
// always installed alongside the engine specialist. Setup used to accept 9 of 10
// agents as "configured", so a project whose verifier never landed looked ready
// while the blocking verification channel had no auditor.
describe("Studio setup readiness", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "setup-probe.mjs");
	const dirs = [];

	const makeProject = (agentNames, { gameStudioDir = true, engine = "Godot", projectYaml = true } = {}) => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-setup-"));
		dirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		for (const name of agentNames) {
			fs.writeFileSync(path.join(agentsDir, `${name}.md`), `---\nname: ${name}\n---\n`, "utf8");
		}
		if (gameStudioDir) fs.mkdirSync(path.join(dir, ".pi", "game-studio"), { recursive: true });
		if (projectYaml) {
			fs.writeFileSync(path.join(dir, "project.yaml"), `engine: "${engine}"\n`, "utf8");
		}
		return dir;
	};

	const probe = (projectDir) =>
		JSON.parse(
			execFileSync(process.execPath, ["--experimental-strip-types", probePath, projectDir], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			}),
		);

	const FULL_ROSTER = [
		"producer",
		"creative-director",
		"technical-director",
		"game-designer",
		"gameplay-programmer",
		"art-director",
		"audio-director",
		"qa-lead",
		"godot-specialist",
		"qa-verifier",
	];

	afterAll(() => {
		for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
	});

	test("reports a complete roster as configured", () => {
		const result = probe(makeProject(FULL_ROSTER));
		expect(result.expectedAgents).toBe(10);
		expect(result.agentsInstalled).toBe(10);
		expect(result.isConfigured).toBe(true);
		expect(result.missingAgents).toEqual([]);
	});

	test("does not report a project missing the verifier as configured", () => {
		const result = probe(makeProject(FULL_ROSTER.filter((name) => name !== "qa-verifier")));
		expect(result.agentsInstalled).toBe(9);
		expect(result.isConfigured).toBe(false);
		expect(result.missingAgents).toContain("qa-verifier");
	});

	test("names every absent agent, not just the verifier", () => {
		const result = probe(makeProject(["producer", "game-designer"]));
		expect(result.isConfigured).toBe(false);
		expect(result.missingAgents.length).toBe(8);
		expect(result.missingAgents).toEqual(
			expect.arrayContaining(["qa-verifier", "godot-specialist", "audio-director"]),
		);
	});

	test("an unknown engine installs no specialist instead of Godot's", () => {
		// Issue #82: every unrecognised engine name fell through to Godot, so a typo in
		// project.yaml silently installed an unrelated engine specialist and nothing
		// said so. Core roles plus the verifier are the honest answer.
		const script = `
			const setup = await import("./extensions/hooks/studio-setup.ts");

			const specialists = (names) => names.filter((n) => n.endsWith("-specialist"));

			const unknown = setup.filterAgentsForEngine("Unknown-Engine");
			const typo = setup.filterAgentsForEngine("Godto");
			const spaced = setup.filterAgentsForEngine("Godot 4");
			const known = setup.filterAgentsForEngine("Bevy");

			if (specialists(unknown).length !== 0) {
				throw new Error("an unknown engine must install no specialist, got " + specialists(unknown).join(","));
			}
			if (specialists(typo).length !== 0) {
				throw new Error("a misspelled engine must install no specialist, got " + specialists(typo).join(","));
			}
			if (unknown.length !== 9) {
				throw new Error("unknown engine must still install core + verifier (9 roles), got " + unknown.length);
			}
			if (!unknown.includes("qa-verifier")) throw new Error("the verifier is always installed");
			if (specialists(spaced).join(",") !== "godot-specialist") {
				throw new Error("a qualified name still resolves, got " + specialists(spaced).join(","));
			}
			if (specialists(known).join(",") !== "bevy-specialist") {
				throw new Error("a known engine still resolves, got " + specialists(known).join(","));
			}

			const supported = setup.SUPPORTED_ENGINES;
			if (!Array.isArray(supported) || supported.join(",") !== "Godot,Unity,Unreal,Bevy,Raylib,Phaser") {
				throw new Error("the supported list must be exported and complete, got " + JSON.stringify(supported));
			}
			if (setup.getEngineAgents("Unknown-Engine").length !== 0) {
				throw new Error("getEngineAgents must not fall back to another engine");
			}
		`;
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			});
		}).not.toThrow();
	});

	test("a project.yaml naming an unknown engine is not configured, and says why", () => {
		// The typo case: ten agents on disk, but the engine string matches none of the
		// six. Setup must refuse to call that ready instead of installing Godot's
		// specialist for it.
		const result = probe(makeProject(FULL_ROSTER, { engine: "Godto" }));

		expect(result.engineSupported).toBe(false);
		expect(result.isConfigured).toBe(false);
		expect(result.supportedEngines).toEqual(["Godot", "Unity", "Unreal", "Bevy", "Raylib", "Phaser"]);
	});

	test("/studio:settings keeps the engine case the user typed, and canonicalises known names", () => {
		// Issue #98: the whole argument was lowercased before parsing, so
		// `engine=Bevy` wrote `engine: "bevy"` while /setup writes `"Bevy"`.
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-settings-"));
			fs.writeFileSync(path.join(dir, "project.yaml"), 'engine: "Godot"\\n', "utf8");
			const ctx = { cwd: dir, hasUI: false };

			const { handleStudioSettings } = await import("./extensions/hooks/studio-settings.ts");
			const engineLine = () => fs.readFileSync(path.join(dir, "project.yaml"), "utf8").match(/^engine:\\s*"([^"]+)"/m)?.[1];

			await handleStudioSettings("engine=Bevy", ctx);
			if (engineLine() !== "Bevy") throw new Error("a known engine must be written in canonical case, got " + engineLine());

			await handleStudioSettings("engine=bevy", ctx);
			if (engineLine() !== "Bevy") throw new Error("a lowercase known engine must canonicalise, got " + engineLine());

			await handleStudioSettings("engine=Godto", ctx);
			if (engineLine() !== "Godto") throw new Error("an unknown value must survive as typed so setup can report it, got " + engineLine());

			fs.rmSync(dir, { recursive: true, force: true });
		`;
		expect(() => {
			execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			});
		}).not.toThrow();
	});

	test("an empty project is not configured", () => {
		const result = probe(makeProject([], { gameStudioDir: false, projectYaml: false }));
		expect(result.isConfigured).toBe(false);
		expect(result.missingAgents.length).toBeGreaterThan(5);
	});
});
