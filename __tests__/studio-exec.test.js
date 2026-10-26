const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// Every shell-out in the extension used to be `execSync("... " + value)`: no
// timeout on 11 of 17 sites, and repository-controlled filenames interpolated
// inside double quotes. One hung git froze the TUI; one hostile filename ran a
// command. studio-exec.ts is the single door this suite pins.
describe("Studio command execution boundary", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "exec-probe.mjs");
	const tmpDirs = [];

	const makeDir = () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-exec-"));
		tmpDirs.push(dir);
		return dir;
	};

	const probe = (...args) =>
		JSON.parse(
			execFileSync(process.execPath, ["--experimental-strip-types", probePath, ...args], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			}),
		);

	afterAll(() => {
		for (const dir of tmpDirs) fs.rmSync(dir, { recursive: true, force: true });
	});

	test("passes arguments literally, so shell metacharacters cannot run", () => {
		const payload = 'x"; touch PWNED; $(touch PWNED2); "';
		const result = probe("printf", "%s", payload);
		expect(result.stdout).toBe(payload);
	});

	test("gives up on a command that outlives its timeout", () => {
		const result = probe(
			"timeout",
			JSON.stringify({ timeoutMs: 300 }),
			process.execPath,
			"-e",
			"setTimeout(() => {}, 10000)",
		);
		expect(result.stdout).toBeNull();
		expect(result.elapsedMs).toBeLessThan(5000);
	});

	test("returns null instead of throwing when the command does not exist", () => {
		const result = probe("missing", "definitely-not-a-real-binary-xyz");
		expect(result.stdout).toBeNull();
	});

	test("a hostile filename from git status cannot escape the git call", () => {
		const repo = makeDir();
		execFileSync("git", ["init", "-q"], { cwd: repo });
		const hostile = 'x"; touch PWNED; "';
		fs.writeFileSync(path.join(repo, hostile), "content\n");

		const result = probe("git-diff", repo, hostile);
		expect(fs.existsSync(path.join(repo, "PWNED"))).toBe(false);
		expect(typeof result.stdout === "string" || result.stdout === null).toBe(true);
	});

	test("no call site reaches for a shell any more", () => {
		const hooksDir = path.join(repoRoot, "extensions", "hooks");
		const offenders = fs
			.readdirSync(hooksDir)
			.filter((file) => file.endsWith(".ts"))
			.filter((file) => /execSync\(/.test(fs.readFileSync(path.join(hooksDir, file), "utf8")));
		expect(offenders).toEqual([]);
	});
});
