const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// The model a specialist runs is a documented contract (AGENTS.md: "override per
// agent"), and until now nothing read the file it promises. These tests pin the
// resolution order so the promise cannot rot again.
describe("Studio per-agent model configuration", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "model-config-probe.mjs");
	const dirs = [];

	const makeProject = (models) => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-models-"));
		dirs.push(dir);
		if (models !== undefined) {
			fs.mkdirSync(path.join(dir, ".pi", "game-studio"), { recursive: true });
			fs.writeFileSync(
				path.join(dir, ".pi", "game-studio", "models.json"),
				typeof models === "string" ? models : JSON.stringify(models, null, 2),
				"utf8",
			);
		}
		return dir;
	};

	const probe = (projectRoot) =>
		JSON.parse(
			execFileSync(process.execPath, ["--experimental-strip-types", probePath, projectRoot], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			}),
		);

	afterAll(() => {
		for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
	});

	test("maps the three directors to the director tier and everyone else to workhorse", () => {
		const result = probe(makeProject({}));
		expect(result.tiers).toEqual({
			producer: "director",
			"creative-director": "director",
			"technical-director": "director",
			"game-designer": "workhorse",
			"bevy-specialist": "workhorse",
			"qa-verifier": "workhorse",
		});
	});

	test("resolves the agent key before the tier key", () => {
		const result = probe(
			makeProject({
				director: "vendor/director-model",
				workhorse: "vendor/workhorse-model",
				"bevy-specialist": "vendor/bevy-model",
			}),
		);
		expect(result.resolved["bevy-specialist"]).toBe("vendor/bevy-model");
		expect(result.resolved["gameplay-programmer"]).toBe("vendor/workhorse-model");
		expect(result.resolved["creative-director"]).toBe("vendor/director-model");
	});

	test("ignores the literal inherit and unknown agents", () => {
		const result = probe(
			makeProject({ workhorse: "inherit", "bevy-specialist": "inherit" }),
		);
		expect(result.resolved["bevy-specialist"]).toBeNull();
		expect(result.resolved["gameplay-programmer"]).toBeNull();
		expect(result.resolved["qa-verifier"]).toBeNull();
	});

	test("survives a missing or corrupt configuration", () => {
		expect(probe(makeProject(undefined)).resolved["bevy-specialist"]).toBeNull();
		expect(probe(makeProject("{ not json")).resolved["bevy-specialist"]).toBeNull();
		expect(probe(makeProject({ "bevy-specialist": 42 })).resolved["bevy-specialist"]).toBeNull();
	});

	test("the tier panel renders the model the manifest gives the engine specialists", () => {
		// AGENTS.md names models.default.json as the source of truth for the mapping,
		// and the panel printed the lightweight model for Tier 3 while every specialist
		// key in the manifest is the workhorse model. Rendering from the manifest is the
		// only version of that line that can stay true.
		const script = `
			const fs = await import("node:fs");
			const { formatModelsList } = await import("./extensions/hooks/studio-models.ts");

			const manifest = JSON.parse(fs.readFileSync("models.default.json", "utf8"));
			const card = formatModelsList(manifest);
			const tierRow = (text) => text.split("\\n").find((line) => line.includes("Tier 3"));
			const tier3 = tierRow(card);
			if (!tier3) throw new Error("the panel must show a Tier 3 row");

			const specialists = Object.keys(manifest).filter((key) => key.endsWith("-specialist"));
			if (specialists.length !== 6) throw new Error("expected six specialist keys, got " + specialists.length);

			const shared = manifest[specialists[0]];
			if (!specialists.every((key) => manifest[key] === shared)) {
				throw new Error("the specialists disagree in the manifest, so the row must say so");
			}
			if (!tier3.includes(shared)) {
				throw new Error("Tier 3 must show " + shared + ", got: " + tier3);
			}
			if (tier3.includes(manifest.lightweight) && shared !== manifest.lightweight) {
				throw new Error("Tier 3 must not show the lightweight model: " + tier3);
			}

			// A mixed configuration cannot be summarised by one model.
			const mixed = formatModelsList({ ...manifest, "bevy-specialist": "openrouter/x/other:free" });
			const mixedTier3 = tierRow(mixed);
			if (!mixedTier3.includes("por agente")) {
				throw new Error("a mixed specialist configuration must say so, got: " + mixedTier3);
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

	test("keeps the documented precedence: manifest, config, session, inherit", () => {
		const result = probe(
			makeProject({
				director: "vendor/director-model",
				"bevy-specialist": "vendor/bevy-model",
			}),
		);
		expect(result.choose).toEqual({
			manifestExplicit: "vendor/role-model",
			configBeatsSession: "vendor/bevy-model",
			configTier: "vendor/director-model",
			fallbackSession: "vendor/session-model",
			fallbackInherit: "inherit",
		});
	});
});
