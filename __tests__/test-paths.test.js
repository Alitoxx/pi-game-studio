const fs = require("fs");
const path = require("path");

// A probe that hardcodes the maintainer's checkout path passes locally and fails
// on a CI runner, which checks the repository out somewhere else. PR #127 merged
// with a red suite for exactly that: one new fixture imported the extension from
// an absolute `/Users/<name>/...` path and CI answered ERR_MODULE_NOT_FOUND.
// Issue #90 fixed the occurrences of the time; nothing kept them from coming
// back, and one came back the same day.
//
// The roots are assembled from fragments so this file does not trip its own scan.
const HOST_ROOTS = ["Us" + "ers", "ho" + "me", "opt" + "ions"];
const HOST_PATH = new RegExp(`(^|[^A-Za-z0-9._/-])/(${HOST_ROOTS.join("|")})/[A-Za-z0-9._-]+`);

describe("Test fixtures are location independent", () => {
	const testsRoot = __dirname;
	const repoRoot = path.join(testsRoot, "..");

	const files = [];
	const walk = (dir) => {
		for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (/\.(js|mjs|cjs|ts)$/.test(entry.name)) files.push(full);
		}
	};
	walk(testsRoot);

	test("no test or fixture embeds an absolute host path", () => {
		const offenders = files
			.filter((file) => HOST_PATH.test(fs.readFileSync(file, "utf8")))
			.map((file) => path.relative(repoRoot, file));

		expect(offenders).toEqual([]);
	});

	test("the scan actually matches a hardcoded path", () => {
		const sample = `const repo = "/${"Us" + "ers"}/someone/pi-game-studio";`;
		expect(HOST_PATH.test(sample)).toBe(true);
		expect(HOST_PATH.test("const repo = join(root, 'extensions');")).toBe(false);
	});
});
