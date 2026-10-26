const path = require("path");
const { execFileSync } = require("child_process");

// Issue #96: the runner kept every stderr chunk of a child in one string for the
// whole dispatch and then used it verbatim as `record.error`, so a child that
// failed noisily grew memory for as long as it ran and produced an error text the
// viewer, the transcript and the tool result all carried at full size. The log
// array became a ring buffer in #87; this is the last unbounded buffer.
describe("Studio child stderr bound", () => {
	const repoRoot = path.join(__dirname, "..");

	test("a child that fails noisily yields a bounded error that keeps the tail", () => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-stderr-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			process.env.PI_PATH = fakePi;
			process.env.FAKE_STDERR_FLOOD = "2000";
			process.env.FAKE_EXIT_CODE = "3";

			const { StudioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "qa-lead", title: "QA", tier: "workhorse", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };
			const record = await new StudioAgentsRunner().run(manifest, "Tarea que falla", tmp, "task");

			const out = { status: record.status, error: record.error || "", stderrTail: (record.stderrTail || []).length };
			fs.rmSync(tmp, { recursive: true, force: true });
			process.stdout.write(JSON.stringify(out) + "\\n");
			process.exit(0);
		`;

		const output = execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 120000,
			maxBuffer: 64 * 1024 * 1024,
		});
		const result = JSON.parse(output.trim().split("\n").pop());

		expect(result.status).toBe("failed");
		expect(result.error.length).toBeGreaterThan(0);

		// 2000 lines of ~190 bytes each are what the child writes. The record keeps a
		// bounded tail: 20 lines, each itself capped.
		const lineCount = result.error.split("\n").length;
		expect({ lines: lineCount <= 21, bytes: result.error.length <= 20 * 420 }).toEqual({
			lines: true,
			bytes: true,
		});
		expect(result.stderrTail).toBeLessThanOrEqual(20);
		expect(result.error).toContain("flood-1999");
	});
});
