const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// Issue #89: config and generated files were written straight to their final
// path, so a crash mid-write left a truncated `.pi/settings.json` or
// `project.yaml` that `/studio:setup` no longer recognized — silently, because
// the only failure path was an empty `catch {}`. This suite pins the two
// properties that make that impossible: the write lands whole or not at all,
// and a module that owns user-facing config goes through the one helper.
describe("Studio atomic writes", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "fs-probe.mjs");
	const tmpDirs = [];

	const makeDir = () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-fs-"));
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
		for (const dir of tmpDirs) {
			// A failing case may leave its directory read-only, which rmSync cannot
			// empty; cleanup is not the property under test, so make it total.
			try {
				fs.chmodSync(dir, 0o755);
			} catch {}
			fs.rmSync(dir, { recursive: true, force: true });
		}
	});

	test("writes the whole file and leaves no temp residue", () => {
		const dir = makeDir();
		const file = path.join(dir, "project.yaml");
		const result = probe("write", file, 'engine: "bevy"\n');

		expect(result.content).toBe('engine: "bevy"\n');
		expect(result.entries).toEqual(["project.yaml"]);
	});

	test("a write that cannot complete keeps the previous bytes and reports the failure", () => {
		const dir = makeDir();
		const file = path.join(dir, "settings.json");
		fs.writeFileSync(file, '{"tuiMode":"fullscreen"}', "utf8");
		fs.chmodSync(dir, 0o500);

		const result = probe("fail", dir, file);

		expect(result.error).toBeTruthy();
		expect(result.content).toBe('{"tuiMode":"fullscreen"}');
		expect(result.entries).toEqual(["settings.json"]);
	});

	test("replacing a file preserves its existing permissions", () => {
		const dir = makeDir();
		const file = path.join(dir, "models.json");
		fs.writeFileSync(file, "{}", "utf8");
		fs.chmodSync(file, 0o600);

		const result = probe("mode", file);

		expect(result.mode).toBe("600");
		expect(result.content).toBe("replaced");
	});

	test("writes JSON with the project's two-space convention, unchanged in shape", () => {
		const dir = makeDir();
		const file = path.join(dir, "models.json");

		const result = probe("json", file, JSON.stringify({ director: { model: "inherit" } }));

		expect(result.content).toBe('{\n  "director": {\n    "model": "inherit"\n  }\n}');
		expect(result.entries).toEqual(["models.json"]);
	});

	test("writes binary payloads intact, so copied templates are not re-encoded", () => {
		const dir = makeDir();
		const file = path.join(dir, "burst.wav");

		const result = probe("binary", file);

		expect(result.bytes).toEqual([0x00, 0xff, 0x10, 0x7f]);
		expect(result.entries).toEqual(["burst.wav"]);
	});

	test("every module that owns user-facing config writes through the helper", () => {
		// The list is the boundary of the policy, not the whole repository: a plain
		// writeFileSync here is the regression this test exists to catch.
		// Policy: writes the user cannot rebuild if truncated go through the atomic
		// helper — re-read user content (roadmap, Live Spec, tuning, steam page,
		// generated source, play log header/pid) and config (.pi/settings.json).
		// Direct writes stay outside on purpose: idempotent boolean flags, fresh
		// transcripts under the OS temp dir, and append-only log lines.
		const owned = [
			"index.ts",
			"studio-setup.ts",
			"studio-settings.ts",
			"studio-models.ts",
			"studio-mcp.ts",
			"studio-scaffold.ts",
			"studio-feature.ts",
			"studio-start.ts",
			"studio-tuning.ts",
			"studio-steam-page.ts",
			"studio-audio-bus.ts",
			"studio-new.ts",
			"studio-play.ts",
		];

		for (const name of owned) {
			const source = fs.readFileSync(path.join(repoRoot, "extensions", "hooks", name), "utf8");
			expect({ file: name, directWrites: source.match(/writeFileSync\(/g) || [] }).toEqual({
				file: name,
				directWrites: [],
			});
			expect({ file: name, importsHelper: source.includes('from "./studio-fs.ts"') }).toEqual({
				file: name,
				importsHelper: true,
			});
		}
	});

	test("a short write never publishes a truncated file", () => {
		// The kernel may accept fewer bytes than writeSync was given. Retrying is the
		// whole difference between "the file lands whole or not at all" and silently
		// publishing a prefix of it — reproduced here with a 2 KiB file-size rlimit
		// against an 8 KiB payload.
		const dir = makeDir();
		const file = path.join(dir, "project.yaml");
		fs.writeFileSync(file, 'engine: "bevy"\n', "utf8");

		const output = execFileSync(
			"bash",
			[
				"-c",
				`ulimit -f 4; exec "${process.execPath}" --experimental-strip-types "${probePath}" big "${file}" 8192`,
			],
			{ cwd: repoRoot, encoding: "utf8", timeout: 60000 },
		);
		const result = JSON.parse(output);

		// The kernel accepted only part of the payload, so the write must report the
		// failure instead of publishing the prefix it managed to write.
		expect(result.error).toBe("EFBIG");
		expect(fs.readFileSync(file, "utf8")).toBe('engine: "bevy"\n');
	});

	test("a failed settings write is recorded instead of swallowed", () => {
		const setupSource = fs.readFileSync(
			path.join(repoRoot, "extensions", "hooks", "studio-setup.ts"),
			"utf8",
		);
		const settingsBlock = setupSource.slice(
			setupSource.indexOf("const settingsJsonPath"),
			setupSource.indexOf("// 6. Configure language preference"),
		);

		expect(settingsBlock).toContain("recordFailure(");
	});
});
