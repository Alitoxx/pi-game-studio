const path = require("path");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");

// The footer is the studio's most-read line, and it used to carry two invented
// numbers: a hardcoded 60fps and a green 100% for a context usage it had failed
// to read. Both read as measurements. A metric the studio cannot sample must
// render as absent or unknown — never as a plausible value.
describe("Footer truthfulness", () => {
	const repoRoot = path.join(__dirname, "..");
	const hooksDir = path.join(repoRoot, "extensions", "hooks");

	const runScript = (script) =>
		execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 60000,
		});

	// Shared preamble: a scratch project root, an ANSI stripper and a ctx builder.
	const PRELUDE = `
		const fs = await import("node:fs");
		const os = await import("node:os");
		const path = await import("node:path");
		const hud = await import("./extensions/hooks/studio-hud.ts");
		const studioRoot = fs.mkdtempSync(path.join(os.tmpdir(), "studio-footer-"));
		const plain = (s) => s.replace(/\\x1b\\[[0-9;]*m/g, "");
		const footer = (extra = {}, width = 100) => {
			const ctx = Object.assign({ cwd: studioRoot, model: { id: "test-model" } }, extra);
			return plain(hud.renderStudioFooterBar({}, ctx, width));
		};
	`;

	test("an unreadable context usage renders as unknown, never as 100%", () => {
		const out = runScript(`
			${PRELUDE}
			const line = footer({});
			if (/100%/.test(line)) throw new Error("unknown usage painted a full gauge: " + line);
			if (!/n\\/d/.test(line)) throw new Error("unknown usage must say n/d: " + line);
		`);
		expect(out).toBeDefined();
	}, 60000);

	test("a context usage that really is 100% still renders as 100%", () => {
		runScript(`
			${PRELUDE}
			const line = footer({ getContextUsage: () => ({ tokens: 200000, contextWindow: 200000, percent: 100 }) });
			if (!/100%/.test(line)) throw new Error("a real 100% must still render: " + line);
			if (/n\\/d/.test(line)) throw new Error("a read usage must not claim unknown: " + line);
		`);
	}, 60000);

	describe("performance sampling", () => {
		test("no matching process means no metrics, not a fabricated baseline", () => {
			runScript(`
				const { measurePerfMetrics } = await import("./extensions/hooks/studio-profile.ts");
				if (typeof measurePerfMetrics !== "function") throw new Error("measurePerfMetrics must be exported");
				const budget = { targetFps: 60, maxMemoryMb: 256, maxFrameTimeMs: 16.6 };
				const idle = measurePerfMetrics("", budget);
				if (idle.fps !== null) throw new Error("fps must be null when nothing measured it, got " + idle.fps);
				if (idle.frameTimeMs !== null) throw new Error("frameTimeMs must be null when nothing measured it");
				if (idle.memoryMb !== null) throw new Error("memory must be null without a matching process, got " + idle.memoryMb);
				if (idle.status === "OK") throw new Error("an unmeasured state must not report OK");
			`);
		}, 60000);

		test("a matching process yields its real memory and still no fps", () => {
			runScript(`
				const { measurePerfMetrics } = await import("./extensions/hooks/studio-profile.ts");
				const budget = { targetFps: 60, maxMemoryMb: 256, maxFrameTimeMs: 16.6 };
				const line = "alexis 4242 1.5 2.0 335544 186368 ? Sl 10:00 1:23 ./test_game";
				const live = measurePerfMetrics(line, budget);
				if (live.memoryMb !== 182) throw new Error("memory must come from the sampled RSS, got " + live.memoryMb);
				if (live.fps !== null) throw new Error("fps cannot be sampled from outside the game process, got " + live.fps);
				if (live.status !== "OK") throw new Error("real memory inside budget must report OK: " + live.status);
				const over = measurePerfMetrics(line, { targetFps: 60, maxMemoryMb: 100, maxFrameTimeMs: 16.6 });
				if (over.status === "OK") throw new Error("memory over budget must not report OK");
			`);
		}, 60000);

		test("the footer only shows the perf segment for values that were set", () => {
			runScript(`
				${PRELUDE}
				const { setActivePerfMetrics } = await import("./extensions/hooks/studio-profile.ts");
				if (typeof setActivePerfMetrics !== "function") throw new Error("setActivePerfMetrics must be exported");

				const before = footer({}, 100);
				if (/fps|MB/.test(before)) throw new Error("no metrics means no perf segment: " + before);

				setActivePerfMetrics({ engine: "Active Engine", fps: null, frameTimeMs: null, memoryMb: 182, status: "OK", alerts: [] });
				const withMemory = footer({}, 100);
				if (!/182MB/.test(withMemory)) throw new Error("a measured memory value must render: " + withMemory);
				if (/fps/.test(withMemory)) throw new Error("no fps was measured, so none may render: " + withMemory);

				setActivePerfMetrics(null);
				const after = footer({}, 100);
				if (/182MB/.test(after)) throw new Error("clearing the metrics must clear the segment: " + after);
			`);
		}, 60000);
	});

	test("no fabricated measurement constants survive in the profiler", () => {
		const source = fs.readFileSync(path.join(hooksDir, "studio-profile.ts"), "utf8");
		expect(source).not.toMatch(/const\s+fps\s*=\s*60/);
		expect(source).not.toMatch(/const\s+frameTimeMs\s*=\s*16\.6/);
		expect(source).not.toMatch(/memMb\s*=\s*48/);
	});
});
