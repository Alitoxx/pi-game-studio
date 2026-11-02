const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// project.yaml is the human's engine decision, so it outranks whatever marker
// files happen to sit next to it. The watcher used to answer `cargo check`
// whenever a Cargo.toml existed, before ever looking at the configured engine,
// and its last resort was `cargo check` too: a Godot project with a stray
// Cargo.toml (a starter copied in, a vendored crate) was compiled as Rust.
describe("Engine authority", () => {
	const repoRoot = path.join(__dirname, "..");
	const probePath = path.join(__dirname, "fixtures", "engine-authority-probe.mjs");
	const dirs = [];

	const makeProject = ({ engine = null, godot = false, bevy = false } = {}) => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studio-engine-"));
		dirs.push(dir);
		if (engine) fs.writeFileSync(path.join(dir, "project.yaml"), `engine: "${engine}"\n`, "utf8");
		if (godot) fs.writeFileSync(path.join(dir, "project.godot"), `config/features=PackedStringArray("4.3")\n`, "utf8");
		if (bevy) {
			fs.writeFileSync(
				path.join(dir, "Cargo.toml"),
				`[package]\nname = "demo"\nversion = "0.1.0"\n\n[dependencies]\nbevy = { version = "0.15" }\n`,
				"utf8",
			);
		}
		return dir;
	};

	const probe = (projectDir) =>
		JSON.parse(
			execFileSync(process.execPath, ["--experimental-strip-types", probePath, projectDir], {
				cwd: repoRoot,
				encoding: "utf8",
				timeout: 60000,
			}),
		);

	afterAll(() => {
		for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true });
	});

	test("the configured Godot engine outranks a stray Bevy Cargo.toml", () => {
		const report = probe(makeProject({ engine: "Godot", godot: true, bevy: true }));

		expect(report.engine).toBe("Godot");
		expect(report.compileEngine).toBe("Godot");
		expect(report.compileCommand).toContain("godot");
		expect(report.compileCommand).not.toContain("cargo");
	});

	test("the configured Bevy engine compiles with cargo check", () => {
		const report = probe(makeProject({ engine: "Bevy", bevy: true }));

		expect(report.engine).toBe("Bevy");
		expect(report.compileEngine).toBe("Bevy");
		expect(report.compileCommand).toContain("cargo check");
	});

	test("without a configured engine the Bevy marker still detects", () => {
		const report = probe(makeProject({ bevy: true }));

		expect(report.engine).toBe("Bevy");
		expect(report.isConfigured).toBe(false);
		expect(report.compileCommand).toContain("cargo check");
	});

	test("an unrecognized project runs no compile command at all", () => {
		const report = probe(makeProject());

		expect(report.compileCommand).toBeNull();
	});

	// `--check-only` is not a Godot 4 option (it belonged to Godot 3 and only
	// paired with --script), so the watcher reported a BUILD ERROR on every
	// healthy Godot project. The headless editor import followed by --quit is
	// listed by Godot 4 help and validates the project without running the game.
	test("the Godot command only uses options Godot 4 accepts", () => {
		const report = probe(makeProject({ engine: "Godot", godot: true }));

		expect(report.compileCommand).not.toContain("--check-only");
		expect(report.compileCommand).toContain("--headless");
		expect(report.compileCommand).toContain("--quit");
	});
});
