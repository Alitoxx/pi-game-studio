const path = require("path");
const { execFileSync } = require("child_process");

// Issue #104: a child that failed reported only its stderr tail, so the one datum a
// human needs first — how the process died — was lost exactly when the noise was
// worst. A signal-terminated child reported a bare null code. The exit status now
// always leads the diagnostic and a signal is named.
describe("Studio child exit status", () => {
	const repoRoot = path.join(__dirname, "..");

	// Runs the real runner against the fake child in a throwaway directory and returns
	// the record fields the diagnostic is built from.
	const dispatch = (env) => {
		const script = `
			const fs = await import("node:fs");
			const os = await import("node:os");
			const path = await import("node:path");

			const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "studio-exit-"));
			const fakePi = path.join(tmp, "pi");
			fs.copyFileSync("__tests__/fixtures/fake-pi-rpc.mjs", fakePi);
			fs.chmodSync(fakePi, 0o755);
			process.env.PI_PATH = fakePi;
			Object.assign(process.env, JSON.parse(process.env.STUDIO_FAKE_ENV));

			const { StudioAgentsRunner } = await import("./extensions/hooks/studio-agents-runner.ts");
			const manifest = { name: "gameplay-programmer", title: "GP", tier: "workhorse", model: "inherit", thinking: "medium", tools: ["read"], systemPrompt: "test" };
			const record = await new StudioAgentsRunner().run(manifest, "Tarea que falla", tmp, "task");

			const out = {
				status: record.status,
				error: record.error || "",
				latestActivity: record.latestActivity || "",
			};
			fs.rmSync(tmp, { recursive: true, force: true });
			process.stdout.write(JSON.stringify(out) + "\\n");
			process.exit(0);
		`;

		const output = execFileSync(process.execPath, ["--experimental-strip-types", "-e", script], {
			cwd: repoRoot,
			encoding: "utf8",
			timeout: 120000,
			maxBuffer: 64 * 1024 * 1024,
			env: { ...process.env, STUDIO_FAKE_ENV: JSON.stringify(env) },
		});
		return JSON.parse(output.trim().split("\n").pop());
	};

	test("a child that writes stderr and exits non-zero reports both", () => {
		const record = dispatch({ FAKE_STDERR_FLOOD: "1", FAKE_EXIT_CODE: "3" });

		expect(record.status).toBe("failed");
		// The diagnostic keeps the tail, but the exit code leads it.
		expect(record.error).toContain("flood-0");
		expect(record.error).toContain("3");
		expect(record.error.split("\n")[0]).toContain("3");
	});

	test("a child killed by a signal names the signal instead of a null code", () => {
		const record = dispatch({ FAKE_SELF_SIGNAL: "SIGKILL" });

		expect(record.status).toBe("failed");
		expect(record.error).toContain("SIGKILL");
		expect(record.error).not.toContain("null");
	});
});
