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

	const makeProject = (agentNames, { gameStudioDir = true } = {}) => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-setup-"));
		dirs.push(dir);
		const agentsDir = path.join(dir, ".pi", "agents");
		fs.mkdirSync(agentsDir, { recursive: true });
		for (const name of agentNames) {
			fs.writeFileSync(path.join(agentsDir, `${name}.md`), `---\nname: ${name}\n---\n`, "utf8");
		}
		if (gameStudioDir) fs.mkdirSync(path.join(dir, ".pi", "game-studio"), { recursive: true });
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

	test("an empty project is not configured", () => {
		const result = probe(makeProject([], { gameStudioDir: false }));
		expect(result.isConfigured).toBe(false);
		expect(result.missingAgents.length).toBeGreaterThan(5);
	});
});
