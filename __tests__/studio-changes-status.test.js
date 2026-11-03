const path = require("path");
const { execFileSync } = require("child_process");

// /studio:changes read `git status --porcelain` through a leading trim, so the
// first entry of a worktree-only change -- whose porcelain line begins with a
// space -- lost its first character: `a.txt` was reported as `.txt` while every
// later entry stayed intact. Renames were reported as the literal `old -> new`.
describe("Studio changes status parsing", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "changes-status-probe.mjs");

	const report = JSON.parse(
		execFileSync(process.execPath, ["--experimental-strip-types", probePath], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		}),
	);

	test("the first worktree modification keeps its full path", () => {
		const paths = report.parsed.map((entry) => entry.path);

		expect(report.porcelain[0]).toBe(" M a.txt");
		expect(paths).toContain("a.txt");
		expect(paths).not.toContain(".txt");
	});

	test("an untracked file keeps its full path", () => {
		expect(report.parsed.map((entry) => entry.path)).toContain("nuevo.txt");
	});

	test("a rename reports the destination, not the arrow", () => {
		const renamed = report.parsed.find((entry) => entry.status.startsWith("R"));

		expect(renamed).toBeDefined();
		expect(renamed.path).toBe("movido.txt");
		expect(renamed.path).not.toContain("->");
	});
});
