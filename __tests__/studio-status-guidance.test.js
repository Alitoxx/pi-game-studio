const path = require("path");
const { execFileSync } = require("child_process");

// Two opposite lies lived in the same line of guidance.
//
// First, `agentsInstalled` of 0 was substituted with `expectedAgents`, so an
// untouched project reported "10 agents installed and ready" and the same
// paragraph forbade asking about setup.
//
// Then the correction over-reported the gap: it announced "no specialists, work
// inline". That is backwards, because the loader falls back to the package's
// agents directory — zero project overrides still leaves a complete roster
// available, and delegation works. Local templates are overrides, not a
// prerequisite, so the line has to report availability and never tell the
// Producer to work inline when a roster exists.
describe("Studio status guidance", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "studio-status-probe.mjs");

	const report = JSON.parse(
		execFileSync(process.execPath, ["--experimental-strip-types", probePath], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		}),
	);

	test("package templates with no project overrides report a usable roster", () => {
		const line = report.packageOnly;

		expect(line).toContain("OK.");
		expect(line).toContain("10 specialist templates available");
		expect(line).toContain("no local overrides");
		expect(line).toContain("MUST delegate");
		expect(line).not.toContain("works inline");
		expect(line).not.toContain("no specialists");
	});

	test("an empty package roster is the only state that blocks delegation", () => {
		const line = report.noRoster;

		expect(line).toContain("NO ROSTER");
		expect(line).toContain("subagent_run cannot dispatch");
		expect(line).toContain("/setup");
	});

	test("partial project overrides still delegate through the package", () => {
		const line = report.partialOverrides;

		expect(line).toContain("PARTIAL OVERRIDES");
		expect(line).toContain("9 of 10");
		expect(line).toContain("qa-verifier");
		expect(line).toContain("delegation works");
	});

	test("a complete local roster is the one state that forbids asking again", () => {
		const line = report.complete;

		expect(line).toContain("10 project-level agents installed");
		expect(line).toContain("ALREADY fully configured");
	});
});
