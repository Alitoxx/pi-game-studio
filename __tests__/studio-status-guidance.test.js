const path = require("path");
const { execFileSync } = require("child_process");

// The guidance injected into the session claimed "OK. 10 agents installed and
// ready" when zero were installed, and in the same breath forbade the agent from
// asking about setup. A project with no roster therefore looked fully configured:
// the Producer worked inline with nothing to delegate to and never surfaced the
// gap, because it had been told not to.
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

	test("no roster reports package mode and points at /setup", () => {
		const line = report.none;

		expect(line).toContain("PACKAGE MODE");
		expect(line).toContain("0 of 10");
		expect(line).toContain("/setup");
		expect(line).not.toContain("ALREADY fully configured");
		expect(line).not.toContain("installed and ready");
	});

	test("a partial roster names the count and the missing agents", () => {
		const line = report.partial;

		expect(line).toContain("PARTIAL");
		expect(line).toContain("9 of 10");
		expect(line).toContain("qa-verifier");
		expect(line).not.toContain("ALREADY fully configured");
	});

	test("a complete roster is the only state that claims readiness", () => {
		const line = report.complete;

		expect(line).toContain("OK.");
		expect(line).toContain("10 agents installed and ready");
		expect(line).toContain("ALREADY fully configured");
	});
});
