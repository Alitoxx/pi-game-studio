const fs = require("fs");
const path = require("path");

describe("Utility Scripts", () => {
	describe("assign-models.js", () => {
		const scriptPath = path.join(__dirname, "..", "scripts", "assign-models.js");
		const scriptContent = fs.readFileSync(scriptPath, "utf8");

		const lightweightMatch = scriptContent.match(/const LIGHTWEIGHT_AGENTS = (\[[\s\S]*?\]);/);
		const tiersMatch = scriptContent.match(/const TIERS = (\{[\s\S]*?\n\});/);

		const LIGHTWEIGHT_AGENTS = eval(lightweightMatch[1]);
		const TIERS = eval(
			`(function(LIGHTWEIGHT_AGENTS){ return ${tiersMatch[1]}; })(LIGHTWEIGHT_AGENTS)`
		);

		test("total count of unique agents across all tiers equals 55", () => {
			const allAgents = [
				...TIERS.director,
				...TIERS.workhorse,
				...TIERS.lightweight,
			];
			const uniqueAgents = new Set(allAgents);
			expect(allAgents.length).toBe(55);
			expect(uniqueAgents.size).toBe(55);
		});

		test("each agent in TIERS exists as a file in agents/", () => {
			const allAgents = [
				...TIERS.director,
				...TIERS.workhorse,
				...TIERS.lightweight,
			];
			for (const agent of allAgents) {
				const agentPath = path.join(__dirname, "..", "agents", `${agent}.md`);
				expect(fs.existsSync(agentPath)).toBe(true);
			}
		});

		test("each file in agents/ appears in exactly one tier", () => {
			const agentsDir = path.join(__dirname, "..", "agents");
			const agentFiles = fs
				.readdirSync(agentsDir)
				.filter((f) => f.endsWith(".md"))
				.map((f) => f.replace(".md", ""));

			const allAgents = [
				...TIERS.director,
				...TIERS.workhorse,
				...TIERS.lightweight,
			];
			const uniqueAgents = new Set(allAgents);

			for (const agent of agentFiles) {
				expect(uniqueAgents.has(agent)).toBe(true);
			}
			expect(agentFiles.length).toBe(55);
		});

		test("all 5 raylib specialists must be in workhorse tier", () => {
			const raylibSpecialists = [
				"raylib-specialist",
				"raylib-entt-specialist",
				"raylib-shader-specialist",
				"raylib-ui-specialist",
				"raylib-build-specialist",
			];

			for (const specialist of raylibSpecialists) {
				expect(TIERS.workhorse).toContain(specialist);
			}
		});
	});

	describe("yaml-helper.sh", () => {
		const scriptPath = path.join(__dirname, "..", "scripts", "yaml-helper.sh");
		const scriptContent = fs.readFileSync(scriptPath, "utf8");

		test("engine.name enum contains all 5 engines", () => {
			const enumLineMatch = scriptContent.match(/engine\.name::([^\n]+)/);
			expect(enumLineMatch).not.toBeNull();

			const enumValues = enumLineMatch[1].split("|");
			expect(enumValues).toContain("Godot");
			expect(enumValues).toContain("Unity");
			expect(enumValues).toContain("Unreal");
			expect(enumValues).toContain("Bevy");
			expect(enumValues).toContain("Raylib");
		});

		test("no .claude/ paths remain", () => {
			expect(scriptContent).not.toMatch(/\.claude\//);
		});
	});

	describe("soak-test.sh", () => {
		const scriptPath = path.join(__dirname, "..", "scripts", "soak-test.sh");

		test("soak-test.sh exists and is executable", () => {
			expect(fs.existsSync(scriptPath)).toBe(true);
			const stats = fs.statSync(scriptPath);
			expect((stats.mode & 0o111) !== 0).toBe(true);
		});

		test("soak-test.sh has duration and cleanup handlers", () => {
			const content = fs.readFileSync(scriptPath, "utf8");
			expect(content).toMatch(/DURATION=60/);
			expect(content).toMatch(/trap cleanup/);
			expect(content).toMatch(/SOAK TEST/);
		});
	});

	describe("generate-placeholders.js", () => {
		const scriptPath = path.join(__dirname, "..", "scripts", "generate-placeholders.js");

		test("generate-placeholders.js exports audio and texture generators", () => {
			expect(fs.existsSync(scriptPath)).toBe(true);
			const { sfxGenerators, textureGenerators, createWavBuffer, createBmpBuffer } = require(scriptPath);
			expect(typeof createWavBuffer).toBe("function");
			expect(typeof createBmpBuffer).toBe("function");
			expect(typeof sfxGenerators.jump).toBe("function");
			expect(typeof sfxGenerators.coin).toBe("function");
			expect(typeof sfxGenerators.hit).toBe("function");
			expect(typeof sfxGenerators.laser).toBe("function");
			expect(typeof sfxGenerators.explosion).toBe("function");
			expect(typeof textureGenerators["checker-magenta-32"]).toBe("function");
		});

		test("createWavBuffer returns valid RIFF/WAVE header", () => {
			const { createWavBuffer } = require(scriptPath);
			const samples = new Float32Array(4410); // 0.1s
			const wav = createWavBuffer(samples);
			expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
			expect(wav.toString("ascii", 8, 12)).toBe("WAVE");
			expect(wav.length).toBe(44 + 4410 * 2);
		});

		test("createBmpBuffer returns valid BMP header", () => {
			const { createBmpBuffer } = require(scriptPath);
			const bmp = createBmpBuffer(16, 16, () => [255, 0, 0]);
			expect(bmp.toString("ascii", 0, 2)).toBe("BM");
			expect(bmp.length).toBeGreaterThan(54);
		});
	});
});

