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

	const shippedDefaults = () =>
		JSON.parse(fs.readFileSync(path.join(repoRoot, "models.default.json"), "utf8"));

	// The panel test and the resolution tests both need a fresh process: the hooks are
	// TypeScript, and jest's own loader is not the one the extension runs under.
	const runInline = (script, projectRoot) =>
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
			env: { ...process.env, STUDIO_PROBE_ROOT: projectRoot },
		});

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

	test("the shipped defaults assign no model: three tiers, every one inheriting", () => {
		// A package cannot ship model ids: an id that does not resolve in the user's
		// environment makes the child return nothing, and the runner reports it as the
		// agent breaking its return contract. Inheritance is the only default a package
		// can promise without controlling the provider.
		const manifest = shippedDefaults();
		expect(Object.keys(manifest).sort()).toEqual(["director", "lightweight", "workhorse"]);
		for (const [tier, model] of Object.entries(manifest)) {
			expect(`${tier}=${model}`).toBe(`${tier}=inherit`);
		}
	});

	test("a project installed with the shipped defaults inherits the session model", () => {
		const project = makeProject(shippedDefaults());
		const result = JSON.parse(
			runInline(
				`
				const { chooseModelForAgent } = await import("./extensions/hooks/studio-model-config.ts");
				const choose = (agentName) => chooseModelForAgent({
					manifestModel: "inherit",
					projectRoot: process.env.STUDIO_PROBE_ROOT,
					agentName,
					activeModel: "openrouter/openai/gpt-4o",
				});
				process.stdout.write(JSON.stringify({
					director: choose("creative-director"),
					workhorse: choose("gameplay-programmer"),
					specialist: choose("bevy-specialist"),
					verifier: choose("qa-verifier"),
				}));
			`,
				project,
			),
		);
		expect(result).toEqual({
			director: "openrouter/openai/gpt-4o",
			workhorse: "openrouter/openai/gpt-4o",
			specialist: "openrouter/openai/gpt-4o",
			verifier: "openrouter/openai/gpt-4o",
		});
	});

	test("an explicit per-agent override still beats the inherited session model", () => {
		const project = makeProject({ ...shippedDefaults(), "bevy-specialist": "vendor/bevy-model" });
		const chosen = JSON.parse(
			runInline(
				`
				const { chooseModelForAgent } = await import("./extensions/hooks/studio-model-config.ts");
				process.stdout.write(JSON.stringify({
					overridden: chooseModelForAgent({
						manifestModel: "inherit",
						projectRoot: process.env.STUDIO_PROBE_ROOT,
						agentName: "bevy-specialist",
						activeModel: "vendor/session-model",
					}),
					inherited: chooseModelForAgent({
						manifestModel: "inherit",
						projectRoot: process.env.STUDIO_PROBE_ROOT,
						agentName: "godot-specialist",
						activeModel: "vendor/session-model",
					}),
				}));
			`,
				project,
			),
		);
		expect(chosen).toEqual({ overridden: "vendor/bevy-model", inherited: "vendor/session-model" });
	});

	test("the tier panel states inheritance instead of a model nobody assigned", () => {
		// The panel used to print the model a manifest key pointed at. With every tier
		// inheriting, the only honest thing to print is that the agents inherit the
		// session model — printing an id here means printing an assignment that does
		// not exist.
		const script = `
			const fs = await import("node:fs");
			const { formatModelsList } = await import("./extensions/hooks/studio-models.ts");

			const manifest = JSON.parse(fs.readFileSync("models.default.json", "utf8"));
			const card = formatModelsList(manifest);
			const tierRow = (index, text) => {
				const row = text.split("\\n").find((line) => line.includes("Tier " + index));
				if (!row) throw new Error("the panel must show a Tier " + index + " row");
				return row;
			};

			for (const index of [1, 2]) {
				const row = tierRow(index, card);
				if (!row.includes("inherit")) {
					throw new Error("Tier " + index + " must state inheritance, got: " + row);
				}
			}
			if (!card.includes("heredan el modelo activo de tu sesión")) {
				throw new Error("the panel must say the agents inherit the session model");
			}
			for (const id of ["openai-codex/", "openrouter/", "anthropic/", "gpt-", "claude"]) {
				if (card.includes(id)) {
					throw new Error("the panel must not print an unassigned id, found: " + id);
				}
			}

			// A per-agent override is real information and must be shown where it applies.
			const oneOverride = formatModelsList({ ...manifest, "bevy-specialist": "vendor/bevy-model" });
			if (!tierRow(3, oneOverride).includes("vendor/bevy-model")) {
				throw new Error("Tier 3 must show the specialist override, got: " + tierRow(3, oneOverride));
			}

			// Two specialists on different models cannot be summarised by one id.
			const mixed = formatModelsList({
				...manifest,
				"bevy-specialist": "vendor/bevy-model",
				"godot-specialist": "vendor/godot-model",
			});
			if (!tierRow(3, mixed).includes("por agente")) {
				throw new Error("a mixed specialist configuration must say so, got: " + tierRow(3, mixed));
			}
		`;
		expect(() => runInline(script, repoRoot)).not.toThrow();
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
