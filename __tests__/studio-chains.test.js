const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const run = (body) =>
	execFileSync(process.execPath, ["--experimental-strip-types", "-e", body], { cwd: repoRoot });

describe("Chain step contract", () => {
	test("two steps replacing the same output are rejected as a collision", () => {
		expect(() => run(`
			const { validateChain } = await import("./extensions/hooks/studio-chains.ts");

			const chain = {
				name: "collide",
				title: "collide",
				description: "",
				steps: [
					{ agent: "game-designer", output: "design/gdd/x.md", instructions: "write it" },
					{ agent: "technical-director", output: "design/gdd/x.md", instructions: "architect it" },
				],
			};

			const report = validateChain(chain);
			if (report.errors.length === 0) {
				throw new Error("two replace-writers on one path must be an error");
			}
			const text = report.errors.join(" ");
			if (!text.includes("design/gdd/x.md")) throw new Error("the error must name the path: " + text);
			if (!text.includes("game-designer") || !text.includes("technical-director")) {
				throw new Error("the error must name both steps: " + text);
			}
		`)).not.toThrow();
	}, 30000);

	test("the same output is allowed when every step owns a distinct section", () => {
		expect(() => run(`
			const { validateChain } = await import("./extensions/hooks/studio-chains.ts");

			const chain = {
				name: "sections",
				title: "sections",
				description: "",
				steps: [
					{ agent: "game-designer", output: "design/gdd/x.md", section: "Diseño", surfaces: ["design/gdd/x.md"], instructions: "a" },
					{ agent: "technical-director", output: "design/gdd/x.md", section: "Arquitectura", surfaces: ["design/gdd/x.md"], instructions: "b" },
				],
			};

			const report = validateChain(chain);
			if (report.errors.length !== 0) {
				throw new Error("distinct sections resolve the collision: " + report.errors.join(" | "));
			}
		`)).not.toThrow();
	}, 30000);

	test("a step without surfaces is reported as unbounded, without blocking the chain", () => {
		expect(() => run(`
			const { validateChain } = await import("./extensions/hooks/studio-chains.ts");

			const chain = {
				name: "unbounded",
				title: "unbounded",
				description: "",
				steps: [{ agent: "qa-lead", output: "production/qa/bugs.md", instructions: "review" }],
			};

			const report = validateChain(chain);
			if (report.errors.length !== 0) throw new Error("an unbounded step must not be fatal");
			if (!report.warnings.join(" ").includes("qa-lead")) {
				throw new Error("the unbounded step must be named: " + report.warnings.join(" "));
			}
		`)).not.toThrow();
	}, 30000);

	test("a read-only step is not reported as unbounded, and cannot claim surfaces it does not use", () => {
		expect(() => run(`
			const { validateChain } = await import("./extensions/hooks/studio-chains.ts");

			const readOnly = {
				name: "readonly",
				title: "readonly",
				description: "",
				steps: [{ agent: "qa-verifier", readOnly: true, instructions: "verify" }],
			};

			const report = validateChain(readOnly);
			if (report.errors.length !== 0) throw new Error("a read-only step must not be an error");
			// The warning exists to flag a step that can write anywhere. A step whose
			// agent declares no write tools cannot, so the warning would be a lie.
			if (report.warnings.length !== 0) {
				throw new Error("a read-only step must not be reported as unbounded: " + report.warnings.join(" "));
			}

			// Declaring both is self-contradictory: one of the two statements is false.
			const contradictory = {
				name: "contradictory",
				title: "contradictory",
				description: "",
				steps: [{ agent: "qa-verifier", readOnly: true, surfaces: ["src/"], instructions: "verify" }],
			};
			const contradiction = validateChain(contradictory);
			if (contradiction.errors.length === 0) {
				throw new Error("readOnly plus surfaces must be rejected as contradictory");
			}
		`)).not.toThrow();
	}, 30000);

	test("the step prompt carries the surfaces and the section contract", () => {
		expect(() => run(`
			const { buildStepPrompt } = await import("./extensions/hooks/studio-chains.ts");

			const prompt = buildStepPrompt(
				{
					agent: "technical-director",
					reads: "design/gdd/x.md",
					output: "design/gdd/x.md",
					section: "Arquitectura",
					surfaces: ["design/gdd/x.md"],
					instructions: "Architect it.",
				},
				"combat",
				null,
			);

			if (!prompt.includes("## Allowed edit surfaces")) throw new Error("missing the canonical surfaces heading: " + prompt);
			if (!prompt.includes("- design/gdd/x.md")) throw new Error("missing the surface entry");
			if (!prompt.includes("Arquitectura")) throw new Error("missing the section contract");
			if (!/no reescribas|no borres|únicamente/i.test(prompt)) {
				throw new Error("the section instruction must forbid rewriting the document");
			}
		`)).not.toThrow();
	}, 30000);

	test("every shipped chain validates without collisions", () => {
		expect(() => run(`
			const { loadAvailableChains, validateChain } = await import("./extensions/hooks/studio-chains.ts");

			const chains = loadAvailableChains(process.cwd());
			if (chains.length === 0) throw new Error("no chains loaded");

			const problems = [];
			for (const chain of chains) {
				const report = validateChain(chain);
				for (const e of report.errors) problems.push(chain.name + ": " + e);
			}
			if (problems.length > 0) throw new Error("shipped chains collide: " + problems.join(" | "));
		`)).not.toThrow();
	}, 30000);
});
