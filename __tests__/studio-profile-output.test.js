const path = require("path");
const { execFileSync } = require("child_process");

// /studio:profile assembled its report and handed it to ctx.ui.notify as the only
// output channel, so a session without UI got nothing: no report, no error, no
// usage. It was also unawaited, so the command resolved before the measurement
// existed even when a UI was present.
describe("Studio profile output", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "profile-probe.mjs");

	const report = JSON.parse(
		execFileSync(process.execPath, ["--experimental-strip-types", probePath], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		}),
	);

	test("the report reaches stdout when there is no UI", () => {
		expect(report.printedCount).toBeGreaterThan(0);
		expect(report.printed).toContain("PERFORMANCE");
		expect(report.printed).toContain("FPS");
	});

	test("the UI path is untouched: no notification without a UI", () => {
		expect(report.notified).toBe(0);
	});
});
